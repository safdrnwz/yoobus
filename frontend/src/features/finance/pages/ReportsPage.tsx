import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, FileText, Receipt } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardBody, CardHeader, ErrorState, Input, Skeleton, StatCard, Tabs } from '@/components/ui';
import { financeSummaryApi, reportsApi } from '../api/finance.api';
import { formatMoney, formatNumber, formatPercent } from '@/core/utils/format';
import { todayInput } from '@/core/utils/date';
import { downloadCsv } from '@/core/utils/download';

type ReportTab = 'revenue' | 'gst';

function readNumber(data: Record<string, unknown> | undefined, ...keys: string[]): number {
  if (!data) return 0;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && !Number.isNaN(Number(value))) return Number(value);
  }
  return 0;
}

export function FinanceSummaryPage() {
  const query = useQuery({ queryKey: ['finance', 'summary'], queryFn: () => financeSummaryApi.get() });

  return (
    <>
      <PageHeader
        title="Finance summary"
        description="What you have earned, what you owe, and what is still to be settled."
        breadcrumbs={[{ label: 'Finance' }, { label: 'Summary' }]}
      />

      {query.error ? (
        <Card>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Gross revenue" value={formatMoney(readNumber(query.data, 'grossRevenue', 'revenue'))} isLoading={query.isLoading} tone="primary" />
          <StatCard label="Commission" value={formatMoney(readNumber(query.data, 'commission'))} isLoading={query.isLoading} />
          <StatCard label="Refunds" value={formatMoney(readNumber(query.data, 'refunds'))} isLoading={query.isLoading} />
          <StatCard label="Net payable" value={formatMoney(readNumber(query.data, 'netPayable', 'net'))} isLoading={query.isLoading} tone="accent" />
        </div>
      )}
    </>
  );
}

/** Revenue and GST reports, with the period the operator actually cares about up front. */
export function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('revenue');
  const [range, setRange] = useState({ from: todayInput(), to: todayInput() });

  const query = useQuery({
    queryKey: ['reports', tab, range],
    queryFn: () => (tab === 'revenue' ? reportsApi.revenue(range) : reportsApi.gst(range)),
  });

  const rows = Array.isArray(query.data?.rows) ? (query.data.rows as Record<string, unknown>[]) : [];

  return (
    <>
      <PageHeader
        title="Reports"
        description="Pull a period and export it."
        breadcrumbs={[{ label: 'Finance' }, { label: 'Reports' }]}
        actions={
          rows.length > 0 ? (
            <Button variant="outline" onClick={() => downloadCsv(rows, `${tab}-report.csv`)}>
              Export CSV
            </Button>
          ) : null
        }
      />

      <Tabs
        className="mb-gutter"
        active={tab}
        onChange={(id) => setTab(id as ReportTab)}
        tabs={[
          { id: 'revenue', label: 'Revenue', icon: <BarChart3 className="h-4 w-4" /> },
          { id: 'gst', label: 'GST', icon: <Receipt className="h-4 w-4" /> },
        ]}
      />

      <Card className="mb-gutter">
        <CardBody className="flex flex-wrap items-end gap-3">
          <Input
            label="From"
            type="date"
            containerClassName="w-44"
            value={range.from}
            onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))}
          />
          <Input
            label="To"
            type="date"
            containerClassName="w-44"
            value={range.to}
            onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))}
          />
        </CardBody>
      </Card>

      {query.error ? (
        <Card>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Card>
      ) : query.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardHeader title={tab === 'revenue' ? 'Revenue' : 'GST'} description={`${range.from} to ${range.to}`} />
          <CardBody>
            {tab === 'revenue' ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Gross" value={formatMoney(readNumber(query.data, 'gross', 'totalRevenue'))} />
                <StatCard label="Tickets" value={formatNumber(readNumber(query.data, 'bookings', 'count'))} />
                <StatCard label="Occupancy" value={formatPercent(readNumber(query.data, 'occupancy') / 100)} />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Taxable value" value={formatMoney(readNumber(query.data, 'taxableValue'))} />
                <StatCard label="GST collected" value={formatMoney(readNumber(query.data, 'gstCollected', 'totalGst'))} />
                <StatCard label="Invoices" value={formatNumber(readNumber(query.data, 'invoiceCount', 'count'))} />
              </div>
            )}

            {rows.length === 0 && (
              <p className="mt-6 text-center text-step-0 text-ink-muted">
                Nothing was recorded in this period.
              </p>
            )}
          </CardBody>
        </Card>
      )}
    </>
  );
}
