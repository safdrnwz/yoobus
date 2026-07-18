import { useQuery } from '@tanstack/react-query';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Building2, Bus, Ticket, TrendingUp, Users, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader, ErrorState, Skeleton, StatCard } from '@/components/ui';
import { analyticsApi } from '@/features/platform/api/platform.api';
import { operatorDashboardApi } from '@/features/operations/api/operations.api';
import { formatMoney, formatNumber, formatPercent } from '@/core/utils/format';
import { useAppearance } from '@/theme/ThemeProvider';

/** Charts read their colours from the live theme, so they re-skin with everything else. */
function useChartColours() {
  const appearance = useAppearance();
  return {
    primary: appearance.primaryColor,
    accent: appearance.accentColor,
    grid: appearance.borderColor,
    text: appearance.mutedTextColor,
  };
}

function ChartFrame({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/** Reads a metric out of a loosely-typed analytics payload without exploding on a missing key. */
function metric(data: Record<string, unknown> | undefined, ...keys: string[]): number {
  if (!data) return 0;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && !Number.isNaN(Number(value))) return Number(value);
  }
  return 0;
}

function series(data: Record<string, unknown> | undefined, key: string): Array<Record<string, unknown>> {
  const value = data?.[key];
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

export function PlatformOverviewPage() {
  const colours = useChartColours();
  const query = useQuery({
    queryKey: ['analytics', 'platform'],
    queryFn: () => analyticsApi.platform(),
  });

  const data = query.data;
  const revenueTrend = series(data, 'revenueTrend');
  const topOperators = series(data, 'topOperators');

  return (
    <>
      <PageHeader
        title="Platform overview"
        description="How the whole estate is trading today."
        breadcrumbs={[{ label: 'Platform' }, { label: 'Overview' }]}
      />

      {query.error ? (
        <Card>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Card>
      ) : (
        <>
          <div className="mb-gutter grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Gross bookings"
              value={formatMoney(metric(data, 'grossBookingValue', 'totalRevenue'), { compact: true })}
              icon={<Wallet className="h-4 w-4" />}
              isLoading={query.isLoading}
              tone="primary"
              hint="Across all operators"
            />
            <StatCard
              label="Tickets sold"
              value={formatNumber(metric(data, 'totalBookings', 'bookings'))}
              icon={<Ticket className="h-4 w-4" />}
              isLoading={query.isLoading}
            />
            <StatCard
              label="Active operators"
              value={formatNumber(metric(data, 'activeOperators', 'operators'))}
              icon={<Building2 className="h-4 w-4" />}
              isLoading={query.isLoading}
            />
            <StatCard
              label="Platform commission"
              value={formatMoney(metric(data, 'commissionEarned', 'commission'), { compact: true })}
              icon={<TrendingUp className="h-4 w-4" />}
              isLoading={query.isLoading}
              tone="accent"
            />
          </div>

          <div className="grid gap-gutter lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Revenue" description="Gross booking value over the period." />
              <CardBody>
                {query.isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : revenueTrend.length === 0 ? (
                  <p className="py-16 text-center text-step-0 text-ink-muted">
                    No trading data for this period yet.
                  </p>
                ) : (
                  <ChartFrame>
                    <AreaChart data={revenueTrend} margin={{ left: -16, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={colours.primary} stopOpacity={0.24} />
                          <stop offset="100%" stopColor={colours.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={colours.grid} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" stroke={colours.text} fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke={colours.text} fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-surface)',
                          fontSize: 12,
                        }}
                        formatter={(value: number) => formatMoney(value)}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke={colours.primary}
                        strokeWidth={2}
                        fill="url(#revenueFill)"
                      />
                    </AreaChart>
                  </ChartFrame>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Top operators" description="By gross booking value." />
              <CardBody>
                {query.isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : topOperators.length === 0 ? (
                  <p className="py-16 text-center text-step-0 text-ink-muted">Nothing to rank yet.</p>
                ) : (
                  <ChartFrame>
                    <BarChart data={topOperators} layout="vertical" margin={{ left: 8, right: 8 }}>
                      <CartesianGrid stroke={colours.grid} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" stroke={colours.text} fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke={colours.text}
                        fontSize={12}
                        width={90}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'var(--color-surface-sunken)' }}
                        contentStyle={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-surface)',
                          fontSize: 12,
                        }}
                        formatter={(value: number) => formatMoney(value)}
                      />
                      <Bar dataKey="revenue" fill={colours.primary} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartFrame>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

export function OperatorDashboardPage() {
  const colours = useChartColours();
  const query = useQuery({
    queryKey: ['operator', 'dashboard'],
    queryFn: operatorDashboardApi.get,
  });

  const data = query.data;
  const trend = series(data, 'bookingTrend');

  return (
    <>
      <PageHeader
        title="Today"
        description="What is running, what is selling, and what needs you."
        breadcrumbs={[{ label: 'Operations' }, { label: 'Dashboard' }]}
      />

      {query.error ? (
        <Card>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Card>
      ) : (
        <>
          <div className="mb-gutter grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Today's revenue"
              value={formatMoney(metric(data, 'todayRevenue', 'revenue'), { compact: true })}
              icon={<Wallet className="h-4 w-4" />}
              isLoading={query.isLoading}
              tone="primary"
            />
            <StatCard
              label="Bookings today"
              value={formatNumber(metric(data, 'todayBookings', 'bookings'))}
              icon={<Ticket className="h-4 w-4" />}
              isLoading={query.isLoading}
            />
            <StatCard
              label="Trips running"
              value={formatNumber(metric(data, 'activeTrips', 'trips'))}
              icon={<Bus className="h-4 w-4" />}
              isLoading={query.isLoading}
            />
            <StatCard
              label="Seat occupancy"
              value={formatPercent(metric(data, 'occupancyRate', 'occupancy') / 100)}
              icon={<Users className="h-4 w-4" />}
              isLoading={query.isLoading}
              hint="Across today's departures"
            />
          </div>

          <Card>
            <CardHeader title="Bookings" description="How the last two weeks have sold." />
            <CardBody>
              {query.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : trend.length === 0 ? (
                <p className="py-16 text-center text-step-0 text-ink-muted">
                  No bookings recorded yet. They will appear here as trips start selling.
                </p>
              ) : (
                <ChartFrame>
                  <BarChart data={trend} margin={{ left: -16, right: 8, top: 8 }}>
                    <CartesianGrid stroke={colours.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" stroke={colours.text} fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke={colours.text} fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: 'var(--color-surface-sunken)' }}
                      contentStyle={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-surface)',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="bookings" fill={colours.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartFrame>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </>
  );
}
