import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, QrCode, UserX } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Alert, Badge, Button, Card, CardBody, CardHeader, DataTable, EmptyState, Input, StatCard, StatusBadge,
} from '@/components/ui';
import { ApiError } from '@/core/api/api-error';
import { formatNumber } from '@/core/utils/format';
import { boardingApi } from '@/features/booking/api/booking.api';

interface ManifestRow extends Record<string, unknown> {
  id: string;
  passengerName?: string;
  seatNumber?: string;
  pnr?: string;
  status?: string;
}

/**
 * The boarding screen is used standing at a bus door, one-handed, often in poor light.
 * So: one big input that takes a scan or a typed PNR, large targets, and an unmissable
 * confirmation. Nothing else competes for attention.
 */
export function BoardingPage() {
  const queryClient = useQueryClient();
  const [tripId, setTripId] = useState('');
  const [activeTrip, setActiveTrip] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const manifest = useQuery({
    queryKey: ['boarding', activeTrip],
    queryFn: () => boardingApi.manifest(activeTrip!) as Promise<ManifestRow[]>,
    enabled: Boolean(activeTrip),
  });

  const rows = manifest.data ?? [];
  const boarded = rows.filter((row) => String(row.status ?? '').toUpperCase() === 'BOARDED').length;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['boarding', activeTrip] });

  const scan = useMutation({
    mutationFn: (qrToken: string) => boardingApi.scan({ qrToken }),
    onSuccess: async () => {
      await refresh();
      setCode('');
      toast.success('Boarded.');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'That ticket could not be verified.'),
  });

  const markBoarded = useMutation({
    mutationFn: (row: ManifestRow) => boardingApi.manual({ pnr: row.pnr!, tripId: activeTrip! }),
    onSuccess: async () => {
      await refresh();
      toast.success('Boarded.');
    },
    onError: () => toast.error('That passenger could not be boarded.'),
  });

  const markNoShow = useMutation({
    mutationFn: (row: ManifestRow) => boardingApi.markNoShow({ pnr: row.pnr!, tripId: activeTrip! }),
    onSuccess: async () => {
      await refresh();
      toast.success('Marked as a no-show.');
    },
    onError: () => toast.error('That could not be recorded.'),
  });

  return (
    <>
      <PageHeader
        title="Boarding"
        description="Scan tickets at the door, or board a passenger by hand."
        breadcrumbs={[{ label: 'Driver' }, { label: 'Boarding' }]}
      />

      <Card className="mb-gutter">
        <CardBody>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setActiveTrip(tripId.trim());
            }}
          >
            <Input
              containerClassName="w-full max-w-sm"
              label="Trip"
              placeholder="Paste or scan the trip ID"
              value={tripId}
              onChange={(event) => setTripId(event.target.value)}
            />
            <Button type="submit" size="lg" disabled={!tripId.trim()}>
              Open the manifest
            </Button>
          </form>
        </CardBody>
      </Card>

      {!activeTrip ? (
        <Card>
          <EmptyState
            icon={<QrCode className="h-5 w-5" />}
            title="Open a trip to start boarding"
            description="Enter the trip you are driving and its passenger list appears here."
          />
        </Card>
      ) : (
        <>
          <div className="mb-gutter grid gap-4 sm:grid-cols-3">
            <StatCard label="Expected" value={formatNumber(rows.length)} isLoading={manifest.isLoading} />
            <StatCard label="Boarded" value={formatNumber(boarded)} tone="primary" isLoading={manifest.isLoading} />
            <StatCard
              label="Still to board"
              value={formatNumber(Math.max(rows.length - boarded, 0))}
              isLoading={manifest.isLoading}
            />
          </div>

          <Card className="mb-gutter">
            <CardHeader title="Scan a ticket" description="The scanner types into this field. A PNR works too." />
            <CardBody>
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (code.trim()) scan.mutate(code.trim());
                }}
              >
                <Input
                  containerClassName="w-full max-w-sm"
                  placeholder="Scan or type the code"
                  className="tabular text-step-1"
                  autoFocus
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  aria-label="Ticket code"
                />
                <Button type="submit" size="lg" isLoading={scan.isPending} disabled={!code.trim()}>
                  Board
                </Button>
              </form>
            </CardBody>
          </Card>

          {manifest.data && rows.length === 0 && (
            <Alert tone="info" className="mb-gutter">
              Nobody has booked this trip.
            </Alert>
          )}

          <DataTable<ManifestRow>
            data={rows}
            isLoading={manifest.isLoading}
            error={manifest.error}
            onRetry={manifest.refetch}
            rowKey={(row) => row.id}
            empty={{ title: 'No passengers on this trip' }}
            columns={[
              {
                id: 'seat',
                header: 'Seat',
                cell: (row) => (
                  <Badge tone="neutral" className="tabular">
                    {String(row.seatNumber ?? '—')}
                  </Badge>
                ),
                sortValue: (row) => String(row.seatNumber ?? ''),
              },
              {
                id: 'passenger',
                header: 'Passenger',
                cell: (row) => (
                  <div>
                    <p className="font-medium text-ink">{String(row.passengerName ?? '—')}</p>
                    <p className="tabular text-step--1 text-ink-muted">{String(row.pnr ?? '')}</p>
                  </div>
                ),
              },
              {
                id: 'status',
                header: 'Status',
                cell: (row) => <StatusBadge status={String(row.status ?? 'PENDING')} />,
                sortValue: (row) => String(row.status ?? ''),
              },
              {
                id: 'actions',
                header: '',
                align: 'right',
                cell: (row) => {
                  const status = String(row.status ?? '').toUpperCase();
                  if (status === 'BOARDED' || status === 'NO_SHOW') return null;
                  return (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        leftIcon={<CheckCircle2 className="h-4 w-4" />}
                        isLoading={markBoarded.isPending && markBoarded.variables?.id === row.id}
                        onClick={() => markBoarded.mutate(row)}
                      >
                        Board
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<UserX className="h-4 w-4" />}
                        isLoading={markNoShow.isPending && markNoShow.variables?.id === row.id}
                        onClick={() => markNoShow.mutate(row)}
                      >
                        No-show
                      </Button>
                    </div>
                  );
                },
              },
            ]}
          />
        </>
      )}
    </>
  );
}
