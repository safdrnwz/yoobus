import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Gift, Plus, Wallet as WalletIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardBody, CardHeader, DetailRow, ErrorState, Input, Skeleton, StatCard } from '@/components/ui';
import { formatMoney, formatNumber } from '@/core/utils/format';
import { ApiError } from '@/core/api/api-error';
import { loyaltyApi, walletApi } from '../api/travel.api';

function readNumber(data: Record<string, unknown> | undefined, ...keys: string[]): number {
  if (!data) return 0;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && !Number.isNaN(Number(value))) return Number(value);
  }
  return 0;
}

export function WalletPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const form = useForm<{ amount: number }>();

  const topUp = useMutation({
    mutationFn: (values: { amount: number }) => walletApi.topUp({ amount: Number(values.amount) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['wallet'] });
      form.reset();
      toast.success('Wallet topped up.');
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'The top-up did not go through.'),
  });

  if (query.error) {
    return (
      <Card>
        <ErrorState error={query.error} onRetry={query.refetch} />
      </Card>
    );
  }

  return (
    <>
      <PageHeader title="Wallet" description="Money you have on account, ready to spend on a fare." breadcrumbs={[{ label: 'My travel' }, { label: 'Wallet' }]} />

      <div className="grid gap-gutter lg:grid-cols-[320px_1fr]">
        <StatCard
          label="Balance"
          value={formatMoney(readNumber(query.data, 'balance', 'amount'))}
          icon={<WalletIcon className="h-4 w-4" />}
          isLoading={query.isLoading}
          tone="primary"
        />

        <Card>
          <CardHeader title="Add money" description="It is available to spend immediately." />
          <CardBody>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={form.handleSubmit((values) => topUp.mutate(values))}
            >
              <Input
                containerClassName="w-40"
                label="Amount"
                type="number"
                min={1}
                placeholder="500"
                {...form.register('amount', { required: true, valueAsNumber: true })}
              />
              <Button type="submit" leftIcon={<Plus className="h-4 w-4" />} isLoading={topUp.isPending}>
                Add money
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

export function LoyaltyPage() {
  const query = useQuery({ queryKey: ['loyalty'], queryFn: loyaltyApi.get });

  return (
    <>
      <PageHeader title="Rewards" description="Points you have earned, and what they are worth." breadcrumbs={[{ label: 'My travel' }, { label: 'Rewards' }]} />

      {query.error ? (
        <Card>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Card>
      ) : query.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="grid gap-gutter lg:grid-cols-[320px_1fr]">
          <StatCard
            label="Points"
            value={formatNumber(readNumber(query.data, 'points', 'balance'))}
            icon={<Gift className="h-4 w-4" />}
            tone="accent"
            hint="Redeemable against any fare"
          />

          <Card>
            <CardHeader title="Your rewards" />
            <CardBody>
              <dl>
                <DetailRow label="Tier">{String(query.data?.tier ?? 'Standard')}</DetailRow>
                <DetailRow label="Lifetime points">
                  <span className="tabular">{formatNumber(readNumber(query.data, 'lifetimePoints'))}</span>
                </DetailRow>
                <DetailRow label="Referral code">
                  <span className="tabular">{String(query.data?.referralCode ?? '—')}</span>
                </DetailRow>
              </dl>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
