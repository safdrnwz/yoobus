import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IndianRupee, Link2, Percent, Save, Unlink, Users } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Skeleton } from '@/components/ui';
import { ApiError } from '@/core/api/api-error';
import { busesApi, type Bus } from '../api/operations.api';

/**
 * Seat configuration for one bus.
 *
 * This screen did not exist. `PATCH /buses/:id/ladies-reserved` and
 * `PATCH /buses/:id/seat-adjacency` were live on the server, had DTOs, had permissions — and
 * nothing in the product ever called them. An operator could create a bus and then had no way
 * to say which seats are reserved for women (a legal requirement in several states) or which
 * seats sit next to each other (which is what stops a lone woman being auto-allocated the seat
 * beside a male stranger).
 *
 * Everything here is drawn from the bus the server returns. No seat count, no row width and
 * no seat name is written into this file.
 */

interface SeatConfig {
  busId: string;
  ladiesReservedSeats: string[];
  seatAdjacency: Record<string, string>;
}

/** What one seat is worth, relative to a standard seat on the same trip and segment. */
interface FareRule {
  multiplier: number;
  delta?: number;
}

export function SeatConfigEditor({ bus, onClose }: { bus: Bus; onClose?: () => void }) {
  const queryClient = useQueryClient();

  const config = useQuery({
    queryKey: ['seat-config', bus.id],
    queryFn: () => busesApi.seatConfig(bus.id) as Promise<SeatConfig>,
  });

  const seatNumbers: string[] = useMemo(() => {
    // The seat names come from the bus, always. A bus with seats "1A, 1B, 2A…" and a bus
    // with seats "1..40" are both legitimate, and neither is this component's business.
    const map = (bus as unknown as { seatMap?: string[] }).seatMap;
    if (Array.isArray(map) && map.length) return map;
    return Array.from({ length: bus.totalSeats ?? 0 }, (_, i) => String(i + 1));
  }, [bus]);

  const cols = useMemo(() => {
    const layout = (bus as unknown as { seatLayout?: { decks?: Array<{ cols?: number }> } }).seatLayout;
    return layout?.decks?.[0]?.cols ?? (seatNumbers.length > 30 ? 5 : 4);
  }, [bus, seatNumbers.length]);

  const [ladies, setLadies] = useState<Set<string>>(new Set());
  const [pairs, setPairs] = useState<Array<[string, string]>>([]);
  const [pairDraft, setPairDraft] = useState<string | null>(null);
  const [mode, setMode] = useState<'ladies' | 'adjacency' | 'fares'>('ladies');

  // ── Per-seat pricing ──
  // Every seat on a trip used to cost exactly the same. A lower berth outsells an upper one
  // and the back row goes last, so an operator who cannot price them differently is leaving
  // money on the table on every departure.
  const [fares, setFares] = useState<Record<string, FareRule>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [percent, setPercent] = useState('5');

  useEffect(() => {
    if (!config.data) return;
    setLadies(new Set(config.data.ladiesReservedSeats ?? []));
    setPairs(Object.entries(config.data.seatAdjacency ?? {}) as Array<[string, string]>);
  }, [config.data]);

  useEffect(() => {
    setFares((bus.seatFares as Record<string, FareRule> | undefined) ?? {});
  }, [bus.seatFares]);

  const saveLadies = useMutation({
    mutationFn: () => busesApi.setLadiesReserved(bus.id, { seatNumbers: [...ladies] }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['seat-config', bus.id] });
      toast.success('Reserved seats saved.');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Those seats could not be saved.'),
  });

  const saveAdjacency = useMutation({
    mutationFn: () => busesApi.setSeatAdjacency(bus.id, { pairs }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['seat-config', bus.id] });
      toast.success('Seat pairs saved.');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Those pairs could not be saved.'),
  });

  const saveFares = useMutation({
    // An array, not a map: class-validator cannot reach inside a record's values, so the
    // server validates a list of rules — one per seat.
    mutationFn: () =>
      busesApi.setSeatFares(bus.id, {
        fares: Object.entries(fares).map(([seatNumber, rule]) => ({
          seatNumber,
          multiplier: Number(rule.multiplier),
          ...(rule.delta !== undefined ? { delta: Number(rule.delta) } : {}),
        })),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['buses'] });
      toast.success('Seat prices saved.');
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Those prices could not be saved.'),
  });

  /**
   * A bulk move.
   *
   * `percent` is a CHANGE, not a target — +5 means "5% dearer than it is now", so pressing
   * it twice compounds, exactly as an operator means it. With seats selected, only those
   * move; with none selected, the whole bus does.
   */
  const bulk = useMutation({
    mutationFn: (pct: number) =>
      busesApi.adjustSeatFares(bus.id, {
        percent: pct,
        ...(selected.size ? { seats: [...selected] } : {}),
      }),
    onSuccess: async (updated) => {
      setFares((updated.seatFares as Record<string, FareRule> | undefined) ?? {});
      await queryClient.invalidateQueries({ queryKey: ['buses'] });
      const scope = selected.size ? `${selected.size} seat${selected.size > 1 ? 's' : ''}` : 'every seat';
      toast.success(`Price changed on ${scope}.`);
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'That price change was refused.'),
  });

  const resetSelection = useMutation({
    mutationFn: () =>
      busesApi.adjustSeatFares(bus.id, {
        setMultiplier: 1,
        ...(selected.size ? { seats: [...selected] } : {}),
      }),
    onSuccess: async (updated) => {
      setFares((updated.seatFares as Record<string, FareRule> | undefined) ?? {});
      await queryClient.invalidateQueries({ queryKey: ['buses'] });
      toast.success('Back to standard price.');
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'That could not be reset.'),
  });

  const pairedWith = useMemo(() => {
    const m = new Map<string, string>();
    for (const [a, b] of pairs) {
      m.set(a, b);
      m.set(b, a);
    }
    return m;
  }, [pairs]);

  const toggleSeat = (seat: string) => {
    if (mode === 'fares') {
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(seat)) next.delete(seat);
        else next.add(seat);
        return next;
      });
      return;
    }
    if (mode === 'ladies') {
      setLadies((current) => {
        const next = new Set(current);
        if (next.has(seat)) next.delete(seat);
        else next.add(seat);
        return next;
      });
      return;
    }

    // Adjacency: tap one seat, then its neighbour. Tapping a paired seat breaks the pair.
    if (pairedWith.has(seat)) {
      setPairs((current) => current.filter(([a, b]) => a !== seat && b !== seat));
      setPairDraft(null);
      return;
    }
    if (pairDraft === null) {
      setPairDraft(seat);
      return;
    }
    if (pairDraft === seat) {
      setPairDraft(null);
      return;
    }
    setPairs((current) => [...current, [pairDraft, seat]]);
    setPairDraft(null);
  };

  if (config.isPending) return <Skeleton className="h-80 w-full" />;

  if (!seatNumbers.length) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" aria-hidden />}
        title="This bus has no seats yet"
        description="Give the bus a seat map first, then come back and configure it."
      />
    );
  }

  return (
    <Card>
      <CardHeader
        title={`Seats — ${bus.name ?? bus.registrationNumber}`}
        description={
          mode === 'ladies'
            ? 'Tap the seats reserved for women.'
            : mode === 'adjacency'
              ? 'Tap two seats to pair them as neighbours. Tap a paired seat to break the pair.'
              : 'Tap seats to select them, then move their price. Select nothing to move the whole bus.'
        }
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === 'ladies' ? 'primary' : 'outline'}
              leftIcon={<Users className="h-4 w-4" />}
              onClick={() => {
                setMode('ladies');
                setPairDraft(null);
              }}
            >
              Reserved for women
            </Button>
            <Button
              size="sm"
              variant={mode === 'adjacency' ? 'primary' : 'outline'}
              leftIcon={<Link2 className="h-4 w-4" />}
              onClick={() => setMode('adjacency')}
            >
              Neighbours
            </Button>
            <Button
              size="sm"
              variant={mode === 'fares' ? 'primary' : 'outline'}
              leftIcon={<IndianRupee className="h-4 w-4" />}
              onClick={() => {
                setMode('fares');
                setPairDraft(null);
              }}
            >
              Prices
            </Button>
          </div>
        }
      />
      <CardBody>
        {mode === 'fares' && (
          <div className="mb-4 rounded-card border-hair border-line bg-surface-sunken p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Input
                label="Change by"
                type="number"
                step="0.5"
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
                containerClassName="w-28"
                hint={selected.size ? `${selected.size} seat${selected.size > 1 ? 's' : ''} selected` : 'Whole bus'}
              />
              <Button
                leftIcon={<Percent className="h-4 w-4" />}
                onClick={() => bulk.mutate(Math.abs(Number(percent) || 0))}
                isLoading={bulk.isPending}
              >
                Raise
              </Button>
              <Button
                variant="outline"
                leftIcon={<Percent className="h-4 w-4" />}
                onClick={() => bulk.mutate(-Math.abs(Number(percent) || 0))}
                isLoading={bulk.isPending}
              >
                Lower
              </Button>
              <Button variant="outline" onClick={() => resetSelection.mutate()} isLoading={resetSelection.isPending}>
                Back to standard
              </Button>
              {selected.size > 0 && (
                <Button variant="ghost" onClick={() => setSelected(new Set())}>
                  Clear selection
                </Button>
              )}
            </div>
            <p className="mt-3 text-step--1 text-ink-muted">
              A change compounds: raise by 5% twice and the seat is 10.25% dearer, not 10%. The number
              shown on each seat is what it costs relative to a standard seat — the actual rupee price
              also depends on how far the passenger is travelling.
            </p>
          </div>
        )}

        {mode === 'adjacency' && (
          <Alert tone="info" title="Why this matters" className="mb-4">
            Pairing seats is what lets the system avoid seating a lone woman next to a male stranger.
            Without pairs, it cannot tell which seats are actually side by side.
          </Alert>
        )}

        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {seatNumbers.map((seat) => {
            const isLadies = ladies.has(seat);
            const partner = pairedWith.get(seat);
            const isDraft = pairDraft === seat;
            const rule = fares[seat.toUpperCase()];
            const mult = rule ? Number(rule.multiplier) : 1;
            const isSelected = selected.has(seat);

            const highlight =
              mode === 'fares'
                ? isSelected
                  ? 'border-primary bg-primary text-primary-fg'
                  : mult > 1
                    ? 'border-warning bg-warning-soft text-warning'
                    : mult < 1
                      ? 'border-success bg-success-soft text-success'
                      : 'border-line bg-surface text-ink hover:border-primary'
                : mode === 'ladies'
                  ? isLadies
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface text-ink hover:border-accent'
                  : isDraft
                    ? 'border-primary bg-primary text-primary-fg'
                    : partner
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-line bg-surface text-ink hover:border-primary';

            return (
              <button
                key={seat}
                type="button"
                onClick={() => toggleSeat(seat)}
                aria-pressed={mode === 'ladies' ? isLadies : mode === 'fares' ? isSelected : Boolean(partner)}
                title={mode === 'adjacency' && partner ? `Paired with ${partner}` : undefined}
                className={[
                  'tabular flex h-11 items-center justify-center rounded-control border-hair',
                  'text-step--1 transition-colors duration-motion',
                  highlight,
                ].join(' ')}
              >
                {mode === 'fares' ? (
                  <span className="flex flex-col leading-none">
                    <span>{seat}</span>
                    {mult !== 1 && (
                      <span className="mt-0.5 text-[0.65rem] opacity-80">
                        {mult > 1 ? '+' : ''}
                        {Math.round((mult - 1) * 100)}%
                      </span>
                    )}
                  </span>
                ) : (
                  <>
                    {seat}
                    {mode === 'adjacency' && partner && (
                      <Unlink className="ml-1 h-3 w-3 opacity-60" aria-hidden />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2 text-step--1 text-ink-muted">
            {mode === 'ladies' ? (
              <Badge tone="accent">{ladies.size} reserved</Badge>
            ) : mode === 'adjacency' ? (
              <Badge tone="primary">{pairs.length} pairs</Badge>
            ) : (
              <Badge tone="primary">
                {Object.values(fares).filter((r) => Number(r.multiplier) !== 1).length} priced differently
              </Badge>
            )}
            <span>of {seatNumbers.length} seats</span>
          </div>

          <div className="flex gap-2">
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            )}
            {mode !== 'fares' && (
              <Button
                leftIcon={<Save className="h-4 w-4" />}
                isLoading={mode === 'ladies' ? saveLadies.isPending : saveAdjacency.isPending}
                onClick={() => (mode === 'ladies' ? saveLadies.mutate() : saveAdjacency.mutate())}
              >
                Save {mode === 'ladies' ? 'reserved seats' : 'pairs'}
              </Button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
