import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Download, Search, Ticket as TicketIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Alert, Badge, Button, Card, CardBody, CardHeader, DataTable, Drawer, EmptyState, Input,
  Modal, Select, Skeleton, StatusBadge,
} from '@/components/ui';
import { stopsApi, tripsApi, type Seat, type SeatDeck, type Stop } from '@/features/operations/api/operations.api';
import { ResourcePage, defineResource } from '@/components/common/ResourcePage';
import { Permission } from '@/core/rbac/permissions';
import { useAuthStore } from '@/core/auth/auth.store';
import { ApiError } from '@/core/api/api-error';
import { useDisclosure } from '@/core/hooks';
import { downloadBlob } from '@/core/utils/download';
import { formatDate, formatDateTime, formatTime, todayInput } from '@/core/utils/date';
import { formatMoney } from '@/core/utils/format';
import { BusSeatMap, SeatLegend } from '../components/BusSeatMap';
import { bookingsApi, journeyApi, type Booking, type JourneyResult } from '../api/booking.api';
import { busesApi } from '@/features/operations/api/operations.api';

/* ---------------- Bookings list ---------------- */

export function BookingsPage() {
  const can = useAuthStore((state) => state.can);
  const [ticketBooking, setTicketBooking] = useState<Booking | null>(null);

  const downloadTicket = useMutation({
    mutationFn: async (booking: Booking) => {
      const blob = await bookingsApi.ticketPdf(booking.id);
      downloadBlob(blob, `ticket-${booking.pnr}.pdf`);
    },
    onError: () => toast.error('The ticket could not be downloaded.'),
  });

  return (
    <ResourcePage
      config={defineResource<Booking>({
        key: 'bookings',
        title: 'Bookings',
        singular: 'Booking',
        description: 'Every ticket sold, and what has happened to it since.',
        breadcrumbs: [{ label: 'Bookings' }],
        list: (params) => bookingsApi.list(params),
        rowId: (row) => row.id,
        filters: [
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'CONFIRMED', label: 'Confirmed' },
              { value: 'HELD', label: 'Held' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'COMPLETED', label: 'Completed' },
            ],
          },
        ],
        emptyDescription: 'Bookings appear here the moment a passenger pays.',
        columns: [
          {
            id: 'pnr',
            header: 'PNR',
            cell: (row) => <span className="tabular font-medium text-ink">{row.pnr}</span>,
            sortValue: (row) => row.pnr,
          },
          {
            id: 'passenger',
            header: 'Passenger',
            cell: (row) => (
              <div>
                <p className="text-ink">{row.passengerName ?? '—'}</p>
                {row.seatNumbers && row.seatNumbers.length > 0 && (
                  <p className="tabular text-step--1 text-ink-muted">Seats {row.seatNumbers.join(', ')}</p>
                )}
              </div>
            ),
          },
          {
            id: 'journey',
            header: 'Travelling',
            secondary: true,
            cell: (row) => formatDate(row.journeyDate),
            sortValue: (row) => row.journeyDate ?? '',
          },
          {
            id: 'fare',
            header: 'Fare',
            align: 'right',
            cell: (row) => <span className="tabular font-medium">{formatMoney(row.totalFare)}</span>,
            sortValue: (row) => row.totalFare,
          },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status },
        ],
        actions: [
          {
            label: 'Ticket',
            permission: Permission.DOWNLOAD_TICKET,
            tone: 'ghost',
            visible: (row) => row.status === 'CONFIRMED' || row.status === 'COMPLETED',
            run: async (row) => downloadTicket.mutateAsync(row),
          },
          {
            label: 'Cancel',
            permission: Permission.CANCEL_BOOKING,
            tone: 'danger',
            visible: (row) => row.status === 'CONFIRMED',
            confirm: (row) =>
              `Booking ${row.pnr} will be cancelled and the refund calculated against the cancellation policy. This cannot be undone.`,
            run: (row) => bookingsApi.cancel(row.id),
          },
        ],
      })}
    />
  );
}

/* ---------------- PNR lookup ---------------- */

export function PnrLookupCard() {
  const [pnr, setPnr] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['booking', 'pnr', submitted],
    queryFn: () => bookingsApi.byPnr(submitted!),
    enabled: Boolean(submitted),
    retry: false,
  });

  return (
    <Card className="mb-gutter">
      <CardHeader title="Find a booking" description="Look one up by its PNR." />
      <CardBody>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(pnr.trim().toUpperCase());
          }}
        >
          <Input
            containerClassName="w-full max-w-xs"
            label="PNR"
            placeholder="8FQ2M4KD"
            className="tabular uppercase"
            value={pnr}
            onChange={(event) => setPnr(event.target.value)}
          />
          <Button type="submit" leftIcon={<Search className="h-4 w-4" />} disabled={!pnr.trim()}>
            Find it
          </Button>
        </form>

        {query.isLoading && <Skeleton className="mt-4 h-16 w-full" />}

        {query.error && (
          <Alert tone="danger" className="mt-4">
            {query.error instanceof ApiError && query.error.isNotFound
              ? 'No booking matches that PNR. Check the code and try again.'
              : 'That lookup failed. Try again in a moment.'}
          </Alert>
        )}

        {query.data && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-surface border-hair border-line bg-surface-sunken p-4">
            <div>
              <p className="tabular text-step-1 font-medium text-ink">{query.data.pnr}</p>
              <p className="text-step--1 text-ink-muted">
                {query.data.passengerName ?? 'Passenger'} · {formatDate(query.data.journeyDate)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="tabular font-medium text-ink">{formatMoney(query.data.totalFare)}</span>
              <StatusBadge status={query.data.status} />
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ---------------- Journey search + seat map ---------------- */

/**
 * The server's own key names — `available`, `ladiesReserved`.
 *
 * This interface used to say `isAvailable` / `isLadiesReserved`. Nothing on the wire is
 * called that, so every seat read as `undefined` → falsy → the whole bus rendered as
 * "taken", every time, on every trip.
 */
type SeatCell = Seat;

/**
 * The seat map.
 *
 * A seat is a physical thing, so it's drawn as one — a grid you point at, not a dropdown.
 * Unavailable seats stay visible but inert: a passenger needs to see that the bus is
 * filling up, not just that their choice failed.
 */
function SeatMap({
  seats,
  selected,
  onToggle,
  layout,
}: {
  seats: SeatCell[];
  selected: string[];
  onToggle: (seatNumber: string) => void;
  /** The physical arrangement, from the server. */
  layout?: { decks?: SeatDeck[] } | null;
}) {
  // The grid used to be hardcoded to 4 columns (6 on desktop) regardless of the bus. A
  // 2x2 seater and a 2x1 sleeper are physically different vehicles; drawing both as a
  // 4-wide grid means the seat you tap is not the seat you thought you were tapping.
  // Take the width from the bus if the bus knows it, and fall back to a sane guess only
  // when it genuinely does not.
  const cols = layout?.decks?.[0]?.cols ?? (seats.length > 30 ? 5 : 4);

  return (
    <div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {seats.map((seat) => {
          const isSelected = selected.includes(seat.seatNumber);
          return (
            <button
              key={seat.seatNumber}
              type="button"
              disabled={!seat.available}
              onClick={() => onToggle(seat.seatNumber)}
              aria-pressed={isSelected}
              className={[
                'tabular flex h-11 items-center justify-center rounded-control border-hair text-step--1 transition-colors duration-motion',
                !seat.available
                  ? 'cursor-not-allowed border-line bg-surface-sunken text-ink-faint line-through'
                  : isSelected
                    ? 'border-primary bg-primary text-primary-fg'
                    : seat.ladiesReserved
                      ? 'border-accent bg-accent-soft text-accent hover:border-accent'
                      : 'border-line bg-surface text-ink hover:border-primary',
              ].join(' ')}
            >
              {seat.seatNumber}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-step--1 text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border-hair border-line bg-surface" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-primary" /> Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-accent-soft" /> Reserved for women
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-surface-sunken" /> Taken
        </span>
      </div>
    </div>
  );
}

export function JourneySearchPage() {
  // The search lives in the URL, not in React state.
  //
  // A guest searches Patna → Delhi, picks a bus, picks a seat, and is asked to sign in.
  // With the search held in component state, signing in unmounts the page and every one of
  // those choices is gone — they come back to an empty form and have to start again. Nobody
  // does that twice; they book somewhere else.
  //
  // In the URL, the whole selection survives the round trip through sign-in, and it can be
  // shared, bookmarked and reloaded.
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const status = useAuthStore((state) => state.status);

  const criteria = {
    fromStopId: params.get('fromStopId') ?? '',
    toStopId: params.get('toStopId') ?? '',
    date: params.get('date') ?? todayInput(),
  };
  const setCriteria = (next: Partial<typeof criteria>) => {
    const merged = { ...criteria, ...next };
    setParams(
      (current: URLSearchParams) => {
        const p = new URLSearchParams(current);
        for (const [k, v] of Object.entries(merged)) v ? p.set(k, v) : p.delete(k);
        p.delete('tripId');
        return p;
      },
      { replace: true },
    );
  };

  const submitted = criteria.fromStopId && criteria.toStopId && params.get('searched') === '1' ? criteria : null;
  const [selectedSeats, setSelectedSeats] = useState<string[]>(
    (params.get('seats') ?? '').split(',').filter(Boolean),
  );
  const seatDrawer = useDisclosure();

  const stopsQuery = useQuery({ queryKey: ['stops'], queryFn: () => stopsApi.list({}) });
  const stopOptions = (stopsQuery.data ?? []).map((stop: Stop) => ({
    value: stop.id,
    label: stop.city ? `${stop.name} — ${stop.city}` : stop.name,
  }));

  const searchQuery = useQuery({
    queryKey: ['journeys', submitted],
    queryFn: () => journeyApi.search(submitted!),
    enabled: Boolean(submitted),
  });

  // Which bus was chosen also lives in the URL, so it too survives sign-in.
  const selectedTripId = params.get('tripId');
  const selectedTrip = (searchQuery.data ?? []).find((t) => t.tripId === selectedTripId) ?? null;

  const chooseTrip = (trip: JourneyResult | null) => {
    setParams(
      (current: URLSearchParams) => {
        const p = new URLSearchParams(current);
        if (trip) p.set('tripId', trip.tripId);
        else {
          p.delete('tripId');
          p.delete('seats');
        }
        return p;
      },
      { replace: true },
    );
    setSelectedSeats([]);
  };

  // Keep the chosen seats in the URL as they are tapped.
  useEffect(() => {
    setParams(
      (current: URLSearchParams) => {
        const p = new URLSearchParams(current);
        if (selectedSeats.length) p.set('seats', selectedSeats.join(','));
        else p.delete('seats');
        return p;
      },
      { replace: true },
    );
  }, [selectedSeats, setParams]);

  // The seat map for THIS trip on THIS segment — availability depends on both, since a seat
  // free from Delhi→Jaipur may be taken from Jaipur onward.
  //
  // This used to call busesApi.seatConfig(tripId): the wrong endpoint (it takes a BUS id),
  // with the wrong id (a trip id), behind the wrong guard (OPERATOR_ADMIN — so a passenger
  // got a flat 403). The seat map never loaded for anyone who was actually booking.
  const seatQuery = useQuery({
    queryKey: ['trip-seats', selectedTrip?.tripId, selectedTrip?.fromStopId, selectedTrip?.toStopId],
    queryFn: () => tripsApi.seats(selectedTrip!.tripId, selectedTrip!.fromStopId, selectedTrip!.toStopId),
    enabled: Boolean(selectedTrip),
  });

  const holdMutation = useMutation({
    // boardingStopId/droppingStopId are required by the server. They come straight from the
    // search result, which is the only place the client can learn them.
    mutationFn: () =>
      bookingsApi.hold({
        tripId: selectedTrip!.tripId,
        boardingStopId: selectedTrip!.fromStopId,
        droppingStopId: selectedTrip!.toStopId,
        seatNumbers: selectedSeats,
      }),
    onSuccess: () => {
      toast.success('Seats held. Complete payment before the hold expires.');
      seatDrawer.close();
      setSelectedSeats([]);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Those seats could not be held.'),
  });

  const openTrip = (trip: JourneyResult) => {
    chooseTrip(trip);
    seatDrawer.open();
  };

  // The drawer reopens by itself when the URL already names a trip — which is what happens
  // when a guest comes back from signing in: same bus, same seats, exactly where they left off.
  useEffect(() => {
    if (selectedTrip && !seatDrawer.isOpen) seatDrawer.open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrip?.tripId]);

  /**
   * A guest may search, may see the bus, may even pick a seat. Only holding it needs an
   * account — that is the last possible moment to ask, and it is the one that converts.
   *
   * The whole selection is already in the URL, so we send them to sign-in with this exact
   * page as the destination. They come back to the same bus and the same seats.
   */
  const holdOrSignIn = () => {
    if (status !== 'authenticated') {
      navigate('/sign-in', {
        replace: false,
        state: { from: { pathname: location.pathname, search: location.search } },
      });
      return;
    }
    holdMutation.mutate();
  };

  const seats: SeatCell[] = seatQuery.data?.seats ?? [];
  const seatLayout = seatQuery.data?.seatLayout ?? null;

  return (
    <>
      <PageHeader
        title="Search & book"
        description="Find a departure and hold seats on it."
        breadcrumbs={[{ label: 'Bookings' }, { label: 'Search' }]}
      />

      <Card className="mb-gutter">
        <CardBody>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setParams(
                (current: URLSearchParams) => {
                  const p = new URLSearchParams(current);
                  p.set('searched', '1');
                  return p;
                },
                { replace: true },
              );
            }}
          >
            <Select
              label="From"
              placeholder="Choose a boarding point"
              options={stopOptions}
              value={criteria.fromStopId}
              onChange={(event) => setCriteria({ fromStopId: event.target.value })}
              required
            />
            <Select
              label="To"
              placeholder="Choose a drop point"
              options={stopOptions.filter((o: { value: string }) => o.value !== criteria.fromStopId)}
              value={criteria.toStopId}
              onChange={(event) => setCriteria({ toStopId: event.target.value })}
              required
            />
            <Input
              label="Travelling on"
              type="date"
              value={criteria.date}
              min={todayInput()}
              onChange={(event) => setCriteria({ date: event.target.value })}
            />
            <Button
              type="submit"
              size="lg"
              leftIcon={<Search className="h-4 w-4" />}
              disabled={!criteria.fromStopId || !criteria.toStopId}
            >
              Search
            </Button>
          </form>
        </CardBody>
      </Card>

      {!submitted ? (
        <Card>
          <EmptyState
            icon={<TicketIcon className="h-5 w-5" />}
            title="Where are you going?"
            description="Enter an origin, a destination and a date to see what's running."
          />
        </Card>
      ) : (
        <DataTable<JourneyResult>
          data={searchQuery.data}
          isLoading={searchQuery.isLoading}
          error={searchQuery.error}
          onRetry={searchQuery.refetch}
          rowKey={(row) => row.tripId}
          onRowClick={openTrip}
          empty={{
            title: 'Nothing runs on that day',
            description: 'Try a different date, or a nearby city.',
          }}
          columns={[
            {
              id: 'operator',
              header: 'Operator',
              cell: (row) => (
                <div>
                  <p className="font-medium text-ink">{row.bus?.name ?? row.routeName}</p>
                  {row.bus?.type && (
                    <p className="text-step--1 text-ink-muted">{row.bus.type.replace(/_/g, ' ')}</p>
                  )}
                </div>
              ),
            },
            {
              id: 'timing',
              header: 'Departs',
              cell: (row) => (
                <div className="flex items-center gap-2">
                  <span className="tabular font-medium text-ink">{formatTime(row.departureTime)}</span>
                  <ArrowRight className="h-3 w-3 text-ink-faint" aria-hidden />
                  <span className="tabular text-ink-muted">{row.to ?? '—'}</span>
                </div>
              ),
              sortValue: (row) => row.departureTime,
            },
            {
              id: 'seats',
              header: 'Seats left',
              align: 'right',
              cell: (row) => (
                <Badge tone={row.availableSeats < 5 ? 'warning' : 'neutral'}>
                  {row.availableSeats}
                </Badge>
              ),
              sortValue: (row) => row.availableSeats,
            },
            {
              id: 'fare',
              header: 'Fare',
              align: 'right',
              cell: (row) => <span className="tabular font-medium text-ink">{formatMoney(row.farePerSeat)}</span>,
              sortValue: (row) => row.farePerSeat,
            },
            {
              id: 'go',
              header: '',
              align: 'right',
              cell: (row) => (
                <Button size="sm" onClick={() => openTrip(row)}>
                  Choose seats
                </Button>
              ),
            },
          ]}
        />
      )}

      <Drawer
        isOpen={seatDrawer.isOpen}
        onClose={seatDrawer.close}
        title={selectedTrip ? `${selectedTrip.from} → ${selectedTrip.to}` : 'Choose seats'}
        width="max-w-xl"
        footer={
          <>
            <span className="mr-auto text-step-0 text-ink-muted">
              {selectedSeats.length === 0
                ? 'No seats chosen'
                : `${selectedSeats.length} seat${selectedSeats.length > 1 ? 's' : ''} · ${formatMoney(
                    // Sum the seats actually chosen. Multiplying a count by one price was
                    // only ever right because every seat cost the same.
                    selectedSeats.reduce(
                      (total, sn) => total + (seats.find((x) => x.seatNumber === sn)?.fare ?? 0),
                      0,
                    ),
                  )}`}
            </span>
            <Button variant="outline" onClick={seatDrawer.close}>
              Cancel
            </Button>
            <Button
              disabled={selectedSeats.length === 0}
              isLoading={holdMutation.isPending}
              onClick={holdOrSignIn}
            >
              {status === 'authenticated' ? 'Hold seats' : 'Sign in to hold'}
            </Button>
          </>
        }
      >
        {selectedTrip && (
          <p className="mb-4 text-step-0 text-ink-muted">
            {formatDateTime(selectedTrip.departureTime)} · {formatMoney(selectedTrip.farePerSeat)} per seat
          </p>
        )}

        {seatQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : seats.length === 0 ? (
          <Alert tone="info">The seat layout for this bus is not available. Try another departure.</Alert>
        ) : (
          <div className="flex gap-5">
              <BusSeatMap
                layout={seatLayout as never}
                seats={seats}
                selected={selectedSeats}
                onToggle={(seatNumber) =>
                  setSelectedSeats((current) =>
                    current.includes(seatNumber)
                      ? current.filter((s) => s !== seatNumber)
                      : [...current, seatNumber],
                  )
                }
              />
              <div className="hidden shrink-0 sm:block">
                <SeatLegend />
              </div>
            </div>
        )}
      </Drawer>
    </>
  );
}

/* ---------------- Passenger's own trips ---------------- */

export function MyTripsPage() {
  const query = useQuery({ queryKey: ['bookings', 'mine'], queryFn: () => bookingsApi.mine() });

  const download = useMutation({
    mutationFn: async (booking: Booking) => {
      const blob = await bookingsApi.ticketPdf(booking.id);
      downloadBlob(blob, `ticket-${booking.pnr}.pdf`);
    },
    onError: () => toast.error('The ticket could not be downloaded.'),
  });

  return (
    <>
      <PageHeader title="My trips" description="Your tickets, past and upcoming." breadcrumbs={[{ label: 'My travel' }, { label: 'Trips' }]} />

      <DataTable<Booking>
        data={query.data}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        rowKey={(row) => row.id}
        empty={{ title: 'No trips yet', description: 'Book one and it will show up here.' }}
        columns={[
          { id: 'pnr', header: 'PNR', cell: (row) => <span className="tabular font-medium text-ink">{row.pnr}</span> },
          { id: 'date', header: 'Travelling', cell: (row) => formatDate(row.journeyDate), sortValue: (row) => row.journeyDate ?? '' },
          { id: 'seats', header: 'Seats', secondary: true, cell: (row) => <span className="tabular">{row.seatNumbers?.join(', ') ?? '—'}</span> },
          { id: 'fare', header: 'Paid', align: 'right', cell: (row) => <span className="tabular font-medium">{formatMoney(row.totalFare)}</span> },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
          {
            id: 'ticket',
            header: '',
            align: 'right',
            cell: (row) => (
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Download className="h-4 w-4" />}
                isLoading={download.isPending && download.variables?.id === row.id}
                onClick={() => download.mutate(row)}
              >
                Ticket
              </Button>
            ),
          },
        ]}
      />
    </>
  );
}
