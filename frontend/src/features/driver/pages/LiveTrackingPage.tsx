import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, Select, Skeleton } from '@/components/ui';
import { trackingApi } from '@/features/fleet/api/fleet.api';
import { bookingsApi } from '@/features/booking/api/booking.api';
import { useAuthStore } from '@/core/auth/auth.store';
import { Role } from '@/core/rbac/roles';
import { formatDateTime } from '@/core/utils/date';

interface LivePosition {
  tripId?: string;
  latitude?: number;
  longitude?: number;
  speedKmph?: number;
  heading?: number;
  recordedAt?: string;
  stale?: boolean;
}

/**
 * Where is my bus right now.
 *
 * This page did not exist. The route `/driver/tracking` was wired to `BoardingPage` — the
 * driver's boarding manifest — so a passenger who tapped "Live tracking" landed on a screen
 * built for someone else, and was refused by the server anyway.
 *
 * The position feed itself (`GET /tracking/:tripId/live`) is public, which is right: a
 * passenger must be able to follow the bus they are actually sitting on.
 */
export function LiveTrackingPage() {
  const hasRole = useAuthStore((state) => state.hasRole);
  const isPassenger = hasRole(Role.CUSTOMER);

  const [tripId, setTripId] = useState('');

  // A passenger tracks a bus they are booked on, so offer exactly those trips.
  const myBookings = useQuery({
    queryKey: ['bookings', 'my'],
    queryFn: () => bookingsApi.mine(),
    enabled: isPassenger,
  });

  const tripOptions = (myBookings.data ?? [])
    .filter((booking) => booking.status !== 'CANCELLED')
    .map((booking) => ({
      value: booking.tripId,
      label: `${booking.pnr} · ${booking.journeyDate ?? ''}`.trim(),
    }));

  // Pre-select the only trip, so the common case needs no interaction at all.
  useEffect(() => {
    if (!tripId && tripOptions.length === 1) setTripId(tripOptions[0].value);
  }, [tripId, tripOptions]);

  const position = useQuery({
    queryKey: ['tracking', tripId],
    queryFn: () => trackingApi.live(tripId) as Promise<LivePosition>,
    enabled: Boolean(tripId),
    // A moving bus is only interesting if the dot moves.
    refetchInterval: 15_000,
  });

  const live = position.data;
  const fixedAt = live?.recordedAt ? new Date(live.recordedAt) : null;
  const ageMinutes = fixedAt ? Math.round((Date.now() - fixedAt.getTime()) / 60_000) : null;
  const isStale = ageMinutes !== null && ageMinutes > 5;

  return (
    <>
      <PageHeader
        title="Live tracking"
        description="Follow a bus while it is on the road."
        breadcrumbs={[{ label: 'Tracking' }]}
      />

      <Card className="mb-4">
        <CardBody>
          {isPassenger ? (
            <Select
              label="Which trip"
              placeholder={tripOptions.length ? 'Choose one of your trips' : 'You have no upcoming trips'}
              options={tripOptions}
              value={tripId}
              onChange={(event) => setTripId(event.target.value)}
            />
          ) : (
            <Select
              label="Trip"
              placeholder="Paste a trip id"
              options={tripId ? [{ value: tripId, label: tripId }] : []}
              value={tripId}
              onChange={(event) => setTripId(event.target.value)}
            />
          )}
        </CardBody>
      </Card>

      {!tripId ? (
        <EmptyState
          icon={<MapPin className="h-6 w-6" aria-hidden />}
          title="Nothing to follow yet"
          description={
            isPassenger
              ? 'Pick one of your trips above and the bus will appear here.'
              : 'Choose a trip to see where its bus is.'
          }
        />
      ) : position.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : position.isError || !live ? (
        <Alert tone="warning" title="No position yet">
          The bus has not reported its location. Drivers only start pinging once the trip is under way.
        </Alert>
      ) : (
        <Card>
          <CardHeader
            title="Last known position"
            actions={
              <Badge tone={isStale ? 'warning' : 'success'}>
                <RefreshCw className="mr-1 h-3 w-3" aria-hidden />
                {ageMinutes === null ? 'unknown' : ageMinutes < 1 ? 'just now' : `${ageMinutes} min ago`}
              </Badge>
            }
          />
          <CardBody>
            {isStale && (
              <Alert tone="warning" title="This fix is old" className="mb-4">
                The last ping was {ageMinutes} minutes ago — the bus may have moved since, or lost signal.
              </Alert>
            )}
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-step--1 text-ink-muted">Latitude</dt>
                <dd className="tabular text-step-0 text-ink">{live.latitude?.toFixed(5) ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-step--1 text-ink-muted">Longitude</dt>
                <dd className="tabular text-step-0 text-ink">{live.longitude?.toFixed(5) ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-step--1 text-ink-muted">Speed</dt>
                <dd className="tabular text-step-0 text-ink">
                  {live.speedKmph != null ? `${Math.round(live.speedKmph)} km/h` : '—'}
                </dd>
              </div>
              <div className="sm:col-span-3">
                <dt className="text-step--1 text-ink-muted">Reported at</dt>
                <dd className="text-step-0 text-ink">{live.recordedAt ? formatDateTime(live.recordedAt) : '—'}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      )}
    </>
  );
}
