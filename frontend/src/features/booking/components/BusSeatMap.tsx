import { Fragment } from 'react';
import { formatMoney } from '@/core/utils/format';
import type { LayoutDefinition, LayoutItem } from '@/features/operations/api/layouts.api';
import type { Seat } from '@/features/operations/api/operations.api';

/**
 * The seat map a passenger actually books from.
 *
 * This used to be a flat grid of numbered boxes: four across on every bus, whatever the bus
 * actually was. A 2x2 seater and a 2x1 sleeper are physically different vehicles, and drawing
 * both as an identical grid means the seat you tap is not the seat you thought you tapped.
 *
 * Now it draws the REAL bus — the drawing the operator made in the builder, complete with its
 * decks, its aisle, its driver, its toilet and its stair. Nothing about the shape of this map
 * is written into this file; every coordinate comes from the server.
 *
 * The states below are the reference design's, and each colour carries a meaning that matters:
 * a woman travelling alone needs to see, before she taps, which seats she is allowed to take
 * and who is already sitting beside them.
 */

export type SeatState =
  | 'AVAILABLE'
  | 'SELECTED'
  | 'MALE_ONLY'
  | 'FEMALE_ONLY'
  | 'BOOKED'
  | 'BOOKED_MALE'
  | 'BOOKED_FEMALE'
  | 'RESERVED'
  | 'BLOCKED';

/** Who is already sitting there, when we are allowed to know. */
export interface Occupancy {
  [seatNumber: string]: 'MALE' | 'FEMALE' | undefined;
}

/**
 * The colour scheme, and what every colour MEANS.
 *
 *   Available            green outline, white fill
 *   You selected         solid green
 *   Female only          PINK outline    — free, and only a woman may take it
 *   Booked by female     PINK fill       — taken, by a woman
 *   Male only            BLUE outline    — free, and only a man may take it
 *   Booked by male       BLUE fill       — taken, by a man
 *   Already booked       GREY            — taken, and we do not publish by whom
 *   Reserved / blocked   GREY            — never sellable
 *
 * The pink/blue distinction is not decoration. A woman travelling alone needs to know who is
 * sitting in the seat beside the one she is about to pick, and every Indian operator's seat
 * map shows exactly this. Both booked states are greyed DOWN (soft fill, faint text) so a sold
 * seat never competes for attention with one she can actually buy.
 */
const STATE_STYLE: Record<SeatState, string> = {
  AVAILABLE: 'border-success bg-white text-ink',
  SELECTED: 'border-success bg-success text-white',
  MALE_ONLY: 'border-info bg-white text-info',
  FEMALE_ONLY: 'border-accent bg-white text-accent',
  BOOKED: 'border-line bg-surface-sunken text-ink-faint',
  BOOKED_MALE: 'border-info/40 bg-info-soft/60 text-info/60',
  BOOKED_FEMALE: 'border-accent/40 bg-accent-soft/60 text-accent/60',
  RESERVED: 'border-line bg-surface-sunken text-ink-faint',
  BLOCKED: 'border-dashed border-line bg-transparent text-ink-faint',
};

export const LEGEND: Array<{ state: SeatState; label: string }> = [
  { state: 'AVAILABLE', label: 'Available' },
  { state: 'SELECTED', label: 'You selected' },
  { state: 'MALE_ONLY', label: 'Available for male only' },
  { state: 'BOOKED_MALE', label: 'Booked by male' },
  { state: 'FEMALE_ONLY', label: 'Available for female only' },
  { state: 'BOOKED_FEMALE', label: 'Booked by female' },
  { state: 'BOOKED', label: 'Already booked' },
];

function stateOf(
  item: LayoutItem,
  seat: Seat | undefined,
  selected: boolean,
  occupancy: Occupancy,
): SeatState {
  if (item.props?.blocked) return 'BLOCKED';
  if (item.props?.reserved) return 'RESERVED';
  if (selected) return 'SELECTED';

  if (seat && !seat.available) {
    // The server tells us who is sitting there. `occupancy` is only a fallback for callers
    // that carry it separately.
    const who = seat.bookedBy ?? occupancy[item.seatNumber ?? ''];
    if (who === 'MALE') return 'BOOKED_MALE';
    if (who === 'FEMALE') return 'BOOKED_FEMALE';
    // Taken, and we do not know by whom — say "sold" rather than invent a gender.
    return 'BOOKED';
  }

  // A FREE seat held for women. `ladiesReserved` is derived from the layout on the server, so
  // the two sources agree by construction.
  if (item.props?.gender === 'FEMALE_ONLY' || seat?.ladiesReserved) return 'FEMALE_ONLY';
  if (item.props?.gender === 'MALE_ONLY') return 'MALE_ONLY';
  return 'AVAILABLE';
}

/** A sleeper is a bed, drawn long. A seater is a chair. The shape tells you what you are buying. */
function isSleeper(kind: string): boolean {
  return kind.startsWith('SLEEPER');
}

export function SeatLegend() {
  return (
    <div className="space-y-2">
      <p className="text-step-0 font-medium text-ink">Legends</p>
      {LEGEND.map(({ state, label }) => (
        <div key={state} className="flex items-center gap-2.5">
          <span className={['h-5 w-8 rounded-control border-hair', STATE_STYLE[state]].join(' ')} />
          <span className="text-step--1 text-ink-muted">{label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * One deck of the bus, drawn to the layout's own coordinates.
 *
 * The canvas is scaled down to fit the phone it is being read on, but the PROPORTIONS are the
 * bus's own — which is the whole point of storing coordinates rather than a row/column count.
 */
function DeckPanel({
  title,
  items,
  seats,
  selected,
  occupancy,
  onToggle,
  canvas,
  scale,
}: {
  title: string;
  items: LayoutItem[];
  seats: Seat[];
  selected: string[];
  occupancy: Occupancy;
  onToggle: (seatNumber: string) => void;
  canvas: { width: number; height: number };
  scale: number;
}) {
  const bySeat = new Map(seats.map((s) => [s.seatNumber.toUpperCase(), s]));

  // Crop to what is actually drawn — a deck with six rows should not render 800px of empty bus.
  const maxY = items.reduce((m, i) => Math.max(m, i.y + i.h), 0);
  const height = Math.max(160, maxY + 20);

  return (
    <div className="rounded-card border-hair border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-step-0 font-medium text-ink">{title}</p>
        {items.some((i) => i.kind === 'DRIVER') && (
          <span className="text-ink-faint" aria-label="Driver">
            🕹
          </span>
        )}
      </div>

      <div
        className="relative mx-auto"
        style={{ width: canvas.width * scale, height: height * scale }}
      >
        {items.map((item) => {
          const seat = item.seatNumber ? bySeat.get(item.seatNumber.toUpperCase()) : undefined;
          const bookable = Boolean(item.seatNumber) && Boolean(seat);
          const isSel = Boolean(item.seatNumber && selected.includes(item.seatNumber));
          const state = stateOf(item, seat, isSel, occupancy);

          // Furniture: drawn, never tappable. It is there so the passenger can orient
          // themselves — "I want the seat away from the toilet" is a real preference.
          if (!bookable) {
            if (item.kind === 'EMPTY') return null;
            return (
              <div
                key={item.id}
                className="absolute flex items-center justify-center rounded-control border-hair border-line bg-surface-sunken text-[0.6rem] text-ink-faint"
                style={{
                  left: item.x * scale,
                  top: item.y * scale,
                  width: item.w * scale,
                  height: item.h * scale,
                }}
              >
                {item.kind === 'TOILET' ? 'Toilet' : item.kind === 'STAIR' ? 'Stair' : ''}
              </div>
            );
          }

          const disabled = !seat!.available || state === 'RESERVED' || state === 'BLOCKED';

          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(item.seatNumber!)}
              aria-pressed={isSel}
              aria-label={`Seat ${item.seatNumber}, ${formatMoney(seat!.fare)}`}
              title={disabled ? 'Already booked' : `${item.seatNumber} · ${formatMoney(seat!.fare)}`}
              className={[
                'absolute flex flex-col items-center justify-center border-hair transition-colors duration-motion',
                isSleeper(item.kind) ? 'rounded-[10px]' : 'rounded-control',
                STATE_STYLE[state],
                disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:brightness-95',
              ].join(' ')}
              style={{
                left: item.x * scale,
                top: item.y * scale,
                width: item.w * scale,
                height: item.h * scale,
              }}
            >
              {/* The price is on the seat. Two seats on the same bus can cost different money —
                  a lower berth is not the back row — and hiding that until checkout is how you
                  get an abandoned booking. */}
              {seat!.available ? (
                <span className="text-[0.6rem] font-medium leading-none">{formatMoney(seat!.fare)}</span>
              ) : (
                <span className="text-[0.6rem] leading-none">Sold</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The whole bus: lower deck, and an upper deck when the bus has one.
 *
 * A bus with no drawing — one that predates the layout builder — falls back to a plain grid,
 * because a passenger with an old bus still has to be able to book a seat.
 */
export function BusSeatMap({
  layout,
  seats,
  selected,
  occupancy = {},
  onToggle,
  canvas = { width: 320, height: 800 },
  scale = 0.62,
}: {
  layout: LayoutDefinition | null;
  seats: Seat[];
  selected: string[];
  occupancy?: Occupancy;
  onToggle: (seatNumber: string) => void;
  canvas?: { width: number; height: number };
  scale?: number;
}) {
  const decks = layout?.decks?.filter((d) => d.items.length > 0) ?? [];

  if (!decks.length) {
    // No drawing. Fall back to a plain grid so an old bus is still bookable — but do not
    // pretend it is a seat map: it is a list of seats, and it should look like one.
    return (
      <div className="grid grid-cols-4 gap-2">
        {seats.map((seat) => {
          const isSel = selected.includes(seat.seatNumber);
          const state: SeatState = !seat.available
            ? seat.bookedBy === 'FEMALE'
              ? 'BOOKED_FEMALE'
              : seat.bookedBy === 'MALE'
                ? 'BOOKED_MALE'
                : 'BOOKED'
            : isSel
              ? 'SELECTED'
              : seat.ladiesReserved
                ? 'FEMALE_ONLY'
                : 'AVAILABLE';
          return (
            <button
              key={seat.seatNumber}
              type="button"
              disabled={!seat.available}
              onClick={() => onToggle(seat.seatNumber)}
              className={[
                'flex h-12 flex-col items-center justify-center rounded-control border-hair text-step--1',
                STATE_STYLE[state],
              ].join(' ')}
            >
              <span>{seat.seatNumber}</span>
              {seat.available && <span className="text-[0.6rem] opacity-75">{formatMoney(seat.fare)}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-4">
      {decks.map((d) => (
        <Fragment key={d.deck}>
          <DeckPanel
            title={d.deck === 'UPPER' ? 'Upper deck' : 'Lower deck'}
            items={d.items}
            seats={seats}
            selected={selected}
            occupancy={occupancy}
            onToggle={onToggle}
            canvas={canvas}
            scale={scale}
          />
        </Fragment>
      ))}
    </div>
  );
}
