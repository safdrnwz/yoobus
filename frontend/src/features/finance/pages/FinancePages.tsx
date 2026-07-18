import { Badge, StatusBadge } from '@/components/ui';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, CardBody } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { Can } from '@/core/rbac/Guard';
import { ApiError } from '@/core/api/api-error';
import { operatorsApi } from '@/features/platform/api/platform.api';

import { ResourcePage, defineResource } from '@/components/common/ResourcePage';
import { Permission } from '@/core/rbac/permissions';
import { formatDate } from '@/core/utils/date';
import { formatMoney, formatPercent, humanise } from '@/core/utils/format';
import { billingApi, couponsApi, operatorFinanceApi, settlementsApi, type Coupon, type Settlement } from '../api/finance.api';

import type { CreateCouponDto, PostJournalDto } from '@/core/api/generated/dtos';
type Row = Record<string, unknown> & { id: string };

const fieldBase =
  'w-full rounded-xl border bg-surface px-3.5 py-2.5 text-step-0 text-ink placeholder:text-ink-muted/50 outline-none transition-all focus:ring-4 focus:ring-brand/15';
const fieldOk = 'border-line hover:border-ink-muted/40 focus:border-brand';
const fieldBad = 'border-red-400 focus:border-red-400 focus:ring-red-100';

function CField(props: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  type?: string; error?: string; hint?: string; placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-step--1 font-medium text-ink">{props.label}</label>
      {props.options ? (
        <select className={`${fieldBase} ${props.error ? fieldBad : fieldOk}`} value={props.value} onChange={props.onChange}>
          {props.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          className={`${fieldBase} ${props.error ? fieldBad : fieldOk}`}
          type={props.type ?? 'text'} value={props.value} placeholder={props.placeholder} onChange={props.onChange}
        />
      )}
      {props.error ? <p className="mt-1 text-step--1 text-red-500">{props.error}</p>
        : props.hint ? <p className="mt-1 text-step--1 text-ink-muted">{props.hint}</p> : null}
    </div>
  );
}

/** Coupons list — page-based (no modal). "New coupon" opens a dedicated page. */
export function CouponsPage() {
  const couponsQ = useQuery({ queryKey: ['coupons'], queryFn: () => couponsApi.list() });
  const rows = couponsQ.data ?? [];
  return (
    <div className="space-y-5">
      <PageHeader
        title="Coupons"
        description="Discount codes, what they take off, and how long they last."
        actions={
          <Can permission={Permission.MANAGE_COUPON}>
            <Link to="/finance/coupons/new">
              <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>New coupon</Button>
            </Link>
          </Can>
        }
      />
      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-step-0">
              <thead>
                <tr className="border-b border-line text-left text-ink-muted">
                  <th className="px-4 py-2.5 font-medium">Code</th>
                  <th className="px-4 py-2.5 font-medium">Discount</th>
                  <th className="px-4 py-2.5 font-medium">Valid to</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {couponsQ.isLoading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-muted">Loading\u2026</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-muted">No coupons yet. Create your first one.</td></tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.id} className="border-b border-line/60">
                      <td className="px-4 py-2.5 font-medium uppercase text-ink">{c.code}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone="accent">
                          {c.discountType === 'PERCENT' ? formatPercent(c.discountValue / 100, 0) : formatMoney(c.discountValue)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted">{c.validTo ? formatDate(c.validTo) : '\u2014'}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={c.isActive === false ? 'INACTIVE' : 'ACTIVE'} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/** Create a coupon — a full page, not a modal. */
export function NewCouponPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState({
    code: '', type: 'PERCENT', value: '', maxDiscount: '', minFare: '',
    usageLimit: '', perUserLimit: '', validFrom: '', validTo: '', active: true,
  });
  const [submitted, setSubmitted] = useState(false);
  const errors: Record<string, string | undefined> = {
    code: f.code.trim().length < 2 ? 'Code is required.' : undefined,
    value: !(Number(f.value) > 0) ? 'Enter a value greater than 0.' : undefined,
    validTo: f.validFrom && f.validTo && f.validTo < f.validFrom ? 'Valid-to must be after valid-from.' : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const create = useMutation({
    mutationFn: () =>
      couponsApi.create({
        code: f.code.trim().toUpperCase(),
        type: f.type as 'PERCENT' | 'FLAT',
        value: Number(f.value),
        maxDiscount: f.maxDiscount ? Number(f.maxDiscount) : undefined,
        minFare: f.minFare ? Number(f.minFare) : undefined,
        usageLimit: f.usageLimit ? Number(f.usageLimit) : undefined,
        perUserLimit: f.perUserLimit ? Number(f.perUserLimit) : undefined,
        validFrom: f.validFrom || undefined,
        validTo: f.validTo || undefined,
        active: f.active,
      }),
    onSuccess: () => {
      toast.success('Coupon created.');
      qc.invalidateQueries({ queryKey: ['coupons'] });
      nav('/finance/coupons');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not create the coupon.'),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="New coupon" description="Create a discount code for your customers." />
      <Card>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <CField label="Code *" value={f.code} onChange={(e) => setF((s) => ({ ...s, code: e.target.value.toUpperCase() }))} placeholder="MONSOON20" error={submitted ? errors.code : undefined} />
            <CField label="Type *" value={f.type} onChange={set('type')} options={[{ value: 'PERCENT', label: 'Percent (%)' }, { value: 'FLAT', label: 'Flat (\u20b9)' }]} />
            <CField label="Value *" type="number" value={f.value} onChange={set('value')} error={submitted ? errors.value : undefined} hint={f.type === 'PERCENT' ? 'e.g. 20 for 20%' : 'e.g. 100 for \u20b9100 off'} />
            <CField label="Max discount (\u20b9)" type="number" value={f.maxDiscount} onChange={set('maxDiscount')} hint="Cap for percent coupons." />
            <CField label="Min fare (\u20b9)" type="number" value={f.minFare} onChange={set('minFare')} />
            <CField label="Total usage limit" type="number" value={f.usageLimit} onChange={set('usageLimit')} hint="Leave empty for unlimited." />
            <CField label="Per-user limit" type="number" value={f.perUserLimit} onChange={set('perUserLimit')} />
            <div />
            <CField label="Valid from" type="date" value={f.validFrom} onChange={set('validFrom')} />
            <CField label="Valid to" type="date" value={f.validTo} onChange={set('validTo')} error={submitted ? errors.validTo : undefined} />
          </div>
          <label className="flex items-center gap-2 text-step-0 text-ink">
            <input type="checkbox" checked={f.active} onChange={(e) => setF((s) => ({ ...s, active: e.target.checked }))} />
            Active
          </label>
          <div className="flex gap-2 pt-2">
            <Button
              variant="primary"
              isLoading={create.isPending}
              disabled={create.isPending}
              onClick={() => { setSubmitted(true); if (!hasErrors) create.mutate(); }}
            >
              Create coupon
            </Button>
            <Link to="/finance/coupons"><Button variant="ghost">Cancel</Button></Link>
          </div>
          {submitted && hasErrors && <p className="text-step--1 text-red-500">Please fix the highlighted fields.</p>}
        </CardBody>
      </Card>
    </div>
  );
}

export function SettlementsPage() {
  return (
    <ResourcePage
      config={defineResource<Settlement>({
        key: 'settlements',
        title: 'Settlements',
        singular: 'Settlement',
        description: 'What the platform owes each operator, and what has been paid out.',
        breadcrumbs: [{ label: 'Finance' }, { label: 'Settlements' }],
        list: (params) => settlementsApi.list(params),
        rowId: (row) => row.id,
        searchable: false,
        createHref: '/finance/settlements/new',
        createPermission: Permission.CREATE_SETTLEMENT,
        filters: [
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'PENDING', label: 'Pending' },
              { value: 'PAID', label: 'Paid' },
            ],
          },
        ],
        columns: [
          { id: 'operator', header: 'Operator', cell: (row) => <span className="tabular text-ink">{row.operatorId.slice(0, 8)}</span> },
          {
            id: 'period',
            header: 'Period',
            secondary: true,
            cell: (row) => (
              <span className="text-ink-muted">
                {formatDate(row.periodStart)} – {formatDate(row.periodEnd)}
              </span>
            ),
          },
          { id: 'amount', header: 'Amount', align: 'right', cell: (row) => <span className="tabular font-medium">{formatMoney(row.amount)}</span>, sortValue: (row) => row.amount },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status },
        ],
        actions: [
          {
            label: 'Mark paid',
            permission: Permission.APPROVE_SETTLEMENT,
            tone: 'primary',
            visible: (row) => row.status !== 'PAID',
            confirm: (row) => `${formatMoney(row.amount)} will be recorded as paid out. Make sure the transfer has actually left.`,
            run: (row) => settlementsApi.markPaid(row.id),
          },
        ],
      })}
    />
  );
}

/** Create a settlement for an operator + period — a full page, not a modal. */
export function NewSettlementPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const opsQ = useQuery({ queryKey: ['operators', 'for-settlement'], queryFn: () => operatorsApi.list() });
  const [operatorId, setOperatorId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const errors: Record<string, string | undefined> = {
    operatorId: !operatorId ? 'Select an operator.' : undefined,
    from: !from ? 'Start date is required.' : undefined,
    to: !to ? 'End date is required.' : from && to < from ? 'End date must be after the start date.' : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const create = useMutation({
    mutationFn: () => settlementsApi.create(operatorId, { from, to }),
    onSuccess: () => {
      toast.success('Settlement created.');
      qc.invalidateQueries({ queryKey: ['settlements'] });
      nav('/finance/settlements');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not create the settlement.'),
  });
  const operatorOptions = [
    { value: '', label: 'Select an operator\u2026' },
    ...(opsQ.data ?? []).map((o) => ({ value: o.id, label: o.brandName || o.legalName || o.id })),
  ];
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title="New settlement" description="Settle a payout to an operator for a period." />
      <Card>
        <CardBody className="space-y-4">
          <CField label="Operator *" value={operatorId} onChange={(e) => setOperatorId(e.target.value)} options={operatorOptions} error={submitted ? errors.operatorId : undefined} />
          <div className="grid gap-4 sm:grid-cols-2">
            <CField label="Period from *" type="date" value={from} onChange={(e) => setFrom(e.target.value)} error={submitted ? errors.from : undefined} />
            <CField label="Period to *" type="date" value={to} onChange={(e) => setTo(e.target.value)} error={submitted ? errors.to : undefined} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="primary" isLoading={create.isPending} disabled={create.isPending} onClick={() => { setSubmitted(true); if (!hasErrors) create.mutate(); }}>
              Create settlement
            </Button>
            <Link to="/finance/settlements"><Button variant="ghost">Cancel</Button></Link>
          </div>
          {submitted && hasErrors && <p className="text-step--1 text-red-500">Please fix the highlighted fields.</p>}
        </CardBody>
      </Card>
    </div>
  );
}

export function InvoicesPage() {
  return (
    <ResourcePage
      config={defineResource<Row>({
        key: 'invoices',
        title: 'Invoices',
        singular: 'Invoice',
        description: 'Tax invoices raised against bookings.',
        breadcrumbs: [{ label: 'Finance' }, { label: 'Invoices' }],
        list: (params) => billingApi.invoices(params) as Promise<Row[]>,
        rowId: (row) => row.id,
        columns: [
          { id: 'number', header: 'Invoice', cell: (row) => <span className="tabular font-medium text-ink">{String(row.invoiceNumber ?? row.id.slice(0, 8))}</span> },
          { id: 'pnr', header: 'PNR', secondary: true, cell: (row) => <span className="tabular">{String(row.pnr ?? '—')}</span> },
          { id: 'amount', header: 'Amount', align: 'right', cell: (row) => <span className="tabular font-medium">{formatMoney(Number(row.amount ?? row.total ?? 0))}</span> },
          { id: 'date', header: 'Raised', cell: (row) => formatDate(row.createdAt as string) },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={String(row.status ?? 'PAID')} /> },
        ],
      })}
    />
  );
}

export function LedgerPage() {
  return (
    <ResourcePage
      config={defineResource<Row, PostJournalDto>({
        key: 'ledger',
        title: 'Ledger',
        singular: 'Entry',
        description: 'Double-entry journal for the operator books.',
        breadcrumbs: [{ label: 'Finance' }, { label: 'Ledger' }],
        list: (params) => operatorFinanceApi.listJournal(params) as Promise<Row[]>,
        rowId: (row) => row.id,
        searchable: false,
        createHref: '/finance/ledger/new',
        createPermission: Permission.VIEW_LEDGER,
        columns: [
          { id: 'account', header: 'Account', cell: (row) => <span className="font-medium text-ink">{String(row.account ?? row.accountCode ?? '—')}</span> },
          { id: 'narration', header: 'Narration', secondary: true, cell: (row) => String(row.narration ?? row.description ?? '—') },
          { id: 'debit', header: 'Debit', align: 'right', cell: (row) => <span className="tabular">{row.debit ? formatMoney(Number(row.debit)) : '—'}</span> },
          { id: 'credit', header: 'Credit', align: 'right', cell: (row) => <span className="tabular">{row.credit ? formatMoney(Number(row.credit)) : '—'}</span> },
          { id: 'date', header: 'Date', cell: (row) => formatDate(row.entryDate as string ?? row.createdAt as string) },
        ],
      })}
    />
  );
}

/** Post a double-entry journal — a full page (not a modal), with a balanced-books check. */
export function NewJournalPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [period, setPeriod] = useState('');
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<Array<{ account: string; debit: string; credit: string }>>([
    { account: '', debit: '', credit: '' },
    { account: '', debit: '', credit: '' },
  ]);
  const [submitted, setSubmitted] = useState(false);

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;
  const errors: Record<string, string | undefined> = {
    period: !period ? 'Period is required (e.g. 2026-07).' : undefined,
    narration: narration.trim().length < 2 ? 'Narration is required.' : undefined,
    lines: lines.some((l) => !l.account.trim())
      ? 'Every line needs an account.'
      : !balanced
        ? 'Total debits must equal total credits (and be greater than 0).'
        : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const create = useMutation({
    mutationFn: () =>
      operatorFinanceApi.createJournal({
        period,
        narration: narration.trim(),
        lines: lines.map((l) => ({ account: l.account.trim(), debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
      }),
    onSuccess: () => {
      toast.success('Journal entry posted.');
      qc.invalidateQueries({ queryKey: ['ledger'] });
      nav('/finance/ledger');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not post the entry.'),
  });

  const setLine = (i: number, k: 'account' | 'debit' | 'credit', v: string) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="New journal entry" description="Post a balanced double-entry transaction to the ledger." />
      <Card>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <CField label="Period *" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-07" error={submitted ? errors.period : undefined} />
            <CField label="Narration *" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. Fuel purchase" error={submitted ? errors.narration : undefined} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-step--1 font-medium text-ink">Lines</span>
              <Button size="sm" variant="ghost" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setLines((ls) => [...ls, { account: '', debit: '', credit: '' }])}>
                Add line
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-step-0">
                <thead>
                  <tr className="border-b border-line bg-surface-muted text-left text-ink-muted">
                    <th className="px-3 py-2 font-medium">Account</th>
                    <th className="px-3 py-2 text-right font-medium">Debit</th>
                    <th className="px-3 py-2 text-right font-medium">Credit</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b border-line/60">
                      <td className="px-2 py-1.5"><input className={`${fieldBase} ${fieldOk}`} value={l.account} onChange={(e) => setLine(i, 'account', e.target.value)} placeholder="Account code / name" /></td>
                      <td className="px-2 py-1.5"><input className={`${fieldBase} ${fieldOk} text-right`} type="number" value={l.debit} onChange={(e) => setLine(i, 'debit', e.target.value)} /></td>
                      <td className="px-2 py-1.5"><input className={`${fieldBase} ${fieldOk} text-right`} type="number" value={l.credit} onChange={(e) => setLine(i, 'credit', e.target.value)} /></td>
                      <td className="px-2 py-1.5 text-right">
                        {lines.length > 2 && (
                          <button type="button" className="text-red-500 hover:text-red-600" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} aria-label="Remove line">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line font-semibold text-ink">
                    <td className="px-3 py-2 text-right">Totals</td>
                    <td className="px-3 py-2 text-right tabular">{totalDebit.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular">{totalCredit.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={balanced ? 'text-emerald-600' : 'text-red-500'}>{balanced ? 'Balanced' : 'Off'}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {submitted && errors.lines && <p className="mt-1 text-step--1 text-red-500">{errors.lines}</p>}
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="primary" isLoading={create.isPending} disabled={create.isPending} onClick={() => { setSubmitted(true); if (!hasErrors) create.mutate(); }}>
              Post entry
            </Button>
            <Link to="/finance/ledger"><Button variant="ghost">Cancel</Button></Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
