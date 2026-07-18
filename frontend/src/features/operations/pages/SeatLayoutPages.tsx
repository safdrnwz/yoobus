import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, Check, Copy, FlipHorizontal2, Hash, RotateCw, Save, Trash2, Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, Badge, Button, Card, CardBody, Input, Select, Skeleton, Switch, Tabs } from '@/components/ui';
import { ApiError } from '@/core/api/api-error';
import { humanise } from '@/core/utils/format';
import {
  layoutsApi,
  type BuilderCatalogue,
  type DeckId,
  type LayoutDefinition,
  type LayoutError,
  type LayoutItem,
  type Rotation,
} from '../api/layouts.api';

/**
 * The seat layout builder.
 *
 * An operator draws the inside of a bus once — seats, sleepers, the driver, the door, the
 * stair, the toilet — numbers the seats, publishes it, and points as many buses at it as they
 * like. Before this, a bus carried a flat list of seat numbers and nothing else: no idea where
 * a seat physically sat, so no seat map worth looking at, no sleeper berths, no upper deck,
 * and seat adjacency typed in by hand, pair by pair.
 *
 * NOTHING HERE IS HARDCODED. The canvas size, the grid, and every component in the toolbox
 * come from `GET /seat-layouts/catalogue`. Add a washroom or a charging point on the server
 * and it appears in the toolbox without anyone touching this file — which is the "no code
 * changes for a new bus type" promise, made good.
 */

let seq = 0;
const newId = () => `it_${Date.now().toString(36)}_${seq++}`;

/** How each component draws itself. Colour carries meaning; a seat is not a wheel arch. */
const KIND_STYLE: Record<string, { fill: string; label: string }> = {
  SEATER: { fill: 'bg-surface border-primary/50', label: '' },
  SEMI_SLEEPER: { fill: 'bg-surface border-primary/50', label: '' },
  SLEEPER_V: { fill: 'bg-surface border-primary/50', label: '' },
  SLEEPER_H: { fill: 'bg-surface border-primary/50', label: '' },
  DRIVER: { fill: 'bg-ink/10 border-ink/40', label: '🕹' },
  CREW: { fill: 'bg-ink/5 border-ink/30', label: 'Crew' },
  ENTRANCE: { fill: 'bg-success-soft border-success/50', label: 'In' },
  EXIT: { fill: 'bg-warning-soft border-warning/50', label: 'Out' },
  STAIR: { fill: 'bg-surface-sunken border-line', label: 'Stair' },
  TOILET: { fill: 'bg-surface-sunken border-line', label: 'WC' },
  WHEEL_ARCH: { fill: 'bg-surface-sunken border-line', label: 'Wheel' },
  PARTITION: { fill: 'bg-ink/20 border-ink/40', label: '' },
  EMPTY: { fill: 'bg-transparent border-dashed border-line', label: '' },
};

export function SeatLayoutBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);

  const catalogue = useQuery({ queryKey: ['layout-catalogue'], queryFn: () => layoutsApi.catalogue() });
  const template = useQuery({
    queryKey: ['layout', id],
    queryFn: () => layoutsApi.get(id!),
    enabled: Boolean(id),
  });

  const [deck, setDeck] = useState<DeckId>('LOWER');
  const [def, setDef] = useState<LayoutDefinition>({ decks: [{ deck: 'LOWER', items: [] }] });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<LayoutError[]>([]);

  // Undo. An operator who cannot undo will not experiment, and a builder nobody experiments
  // with produces one layout that is nearly right and never gets fixed.
  const [history, setHistory] = useState<LayoutDefinition[]>([]);
  const [future, setFuture] = useState<LayoutDefinition[]>([]);

  useEffect(() => {
    if (template.data) setDef(template.data.definition ?? { decks: [{ deck: 'LOWER', items: [] }] });
  }, [template.data]);

  const cat: BuilderCatalogue | undefined = catalogue.data;
  const grid = cat?.canvas.grid ?? 20;
  const W = cat?.canvas.width ?? 320;
  const H = cat?.canvas.height ?? 800;
  const snap = useCallback((v: number) => Math.round(v / grid) * grid, [grid]);

  const isFrozen = template.data?.status !== 'DRAFT';

  const items = useMemo(() => def.decks.find((d) => d.deck === deck)?.items ?? [], [def, deck]);

  const commit = useCallback(
    (next: LayoutDefinition) => {
      setHistory((h) => [...h, def]);
      setFuture([]);
      setDef(next);
    },
    [def],
  );

  const setItems = useCallback(
    (updater: (current: LayoutItem[]) => LayoutItem[]) => {
      const decks = def.decks.some((d) => d.deck === deck)
        ? def.decks.map((d) => (d.deck === deck ? { ...d, items: updater(d.items) } : d))
        : [...def.decks, { deck, items: updater([]) }];
      commit({ decks });
    },
    [def, deck, commit],
  );

  const undo = () => {
    if (!history.length) return;
    setFuture((f) => [def, ...f]);
    setDef(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    setHistory((h) => [...h, def]);
    setDef(future[0]);
    setFuture((f) => f.slice(1));
  };

  /* ── Placing ── */

  const place = (kind: string, x: number, y: number) => {
    const spec = cat?.items.find((i) => i.kind === kind);
    if (!spec) return;
    const item: LayoutItem = {
      id: newId(),
      kind,
      x: Math.max(0, Math.min(snap(x), W - spec.w)),
      y: Math.max(0, Math.min(snap(y), H - spec.h)),
      w: spec.w,
      h: spec.h,
      rotation: 0,
      ...(spec.bookable ? { props: { gender: 'ANY' as const, fareZone: 'STANDARD' as const } } : {}),
    };
    setItems((current) => [...current, item]);
    setSelected(new Set([item.id]));
  };

  const move = (itemId: string, x: number, y: number) => {
    setItems((current) =>
      current.map((i) =>
        i.id === itemId
          ? { ...i, x: Math.max(0, Math.min(snap(x), W - i.w)), y: Math.max(0, Math.min(snap(y), H - i.h)) }
          : i,
      ),
    );
  };

  const removeSelected = () => {
    setItems((current) => current.filter((i) => !selected.has(i.id)));
    setSelected(new Set());
  };

  const duplicateSelected = () => {
    const copies = items
      .filter((i) => selected.has(i.id))
      .map((i) => ({ ...i, id: newId(), x: Math.min(i.x + grid, W - i.w), y: Math.min(i.y + grid, H - i.h), seatNumber: undefined }));
    setItems((current) => [...current, ...copies]);
    setSelected(new Set(copies.map((c) => c.id)));
  };

  const rotateSelected = () => {
    setItems((current) =>
      current.map((i) =>
        selected.has(i.id)
          ? { ...i, rotation: (((i.rotation + 90) % 360) as Rotation), w: i.h, h: i.w }
          : i,
      ),
    );
  };

  /**
   * Mirror across the centre line. A bus is symmetrical — drawing one column and mirroring it
   * is how you build a 2x2 coach in ten seconds instead of two minutes.
   *
   * The mirrored seats come back UNNUMBERED on purpose: a silently duplicated seat number is
   * a double-booked passenger, and an error you can see is far cheaper than one you cannot.
   */
  const mirrorSelected = () => {
    const copies = items
      .filter((i) => selected.has(i.id))
      .map((i) => ({ ...i, id: newId(), x: snap(W - i.x - i.w), seatNumber: undefined }));
    setItems((current) => [...current, ...copies]);
    setSelected(new Set(copies.map((c) => c.id)));
  };

  /** Number every seat on this deck, in reading order. Doing it by hand is where mistakes live. */
  const autoNumber = () => {
    const prefix = deck === 'UPPER' ? 'U' : '';
    let n = 1;
    const order = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
    const numbers = new Map<string, string>();
    for (const i of order) {
      if (cat?.bookableKinds.includes(i.kind)) numbers.set(i.id, `${prefix}${n++}`);
    }
    setItems((current) => current.map((i) => (numbers.has(i.id) ? { ...i, seatNumber: numbers.get(i.id) } : i)));
    toast.success(`${numbers.size} seats numbered.`);
  };

  /* ── Saving ── */

  const save = useMutation({
    mutationFn: () => layoutsApi.update(id!, { definition: def as never }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['layout', id] });
      toast.success('Saved.');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'That could not be saved.'),
  });

  const validate = useMutation({
    mutationFn: async () => {
      await layoutsApi.update(id!, { definition: def as never });
      return layoutsApi.validate(id!);
    },
    onSuccess: (result) => {
      setErrors(result.errors);
      if (result.ok) toast.success(`Looks good — ${result.seatCount} bookable seats.`);
      else toast.error(`${result.errors.length} problem${result.errors.length > 1 ? 's' : ''} to fix.`);
    },
  });

  const publish = useMutation({
    mutationFn: async () => {
      await layoutsApi.update(id!, { definition: def as never });
      return layoutsApi.publish(id!);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['layout', id] });
      await queryClient.invalidateQueries({ queryKey: ['layouts'] });
      toast.success('Published. It can now be assigned to buses.');
      setErrors([]);
    },
    onError: (e) => {
      if (e instanceof ApiError && Array.isArray(e.details)) setErrors(e.details as LayoutError[]);
      toast.error(e instanceof ApiError ? e.message : 'That could not be published.');
    },
  });

  /* ── Keyboard ── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if (meta && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size) {
        e.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (catalogue.isPending || (id && template.isPending)) return <Skeleton className="h-96 w-full" />;

  const errorsById = new Map(errors.filter((e) => e.itemId).map((e) => [e.itemId!, e]));
  const one = selected.size === 1 ? items.find((i) => selected.has(i.id)) : undefined;
  const seatCount = def.decks
    .flatMap((d) => d.items)
    .filter((i) => cat?.bookableKinds.includes(i.kind) && !i.props?.blocked && !i.props?.reserved).length;

  return (
    <>
      <PageHeader
        title={template.data?.name ?? 'Seat layout'}
        description={
          isFrozen
            ? 'Published layouts are frozen — clone it to make a new version.'
            : 'Drag components onto the bus. Everything snaps to the grid.'
        }
        breadcrumbs={[{ label: 'Operations' }, { label: 'Layouts', to: '/operations/layouts' }, { label: template.data?.name ?? '' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone={isFrozen ? 'success' : 'warning'}>
              {template.data?.status} · v{template.data?.version}
            </Badge>
            <Badge tone="primary">{seatCount} seats</Badge>
            {!isFrozen && (
              <>
                <Button variant="outline" size="sm" onClick={() => validate.mutate()} isLoading={validate.isPending}>
                  Check
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Save className="h-4 w-4" />}
                  onClick={() => save.mutate()}
                  isLoading={save.isPending}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  leftIcon={<Upload className="h-4 w-4" />}
                  onClick={() => publish.mutate()}
                  isLoading={publish.isPending}
                >
                  Publish
                </Button>
              </>
            )}
            {isFrozen && (
              <Button
                size="sm"
                onClick={async () => {
                  const next = await layoutsApi.clone(id!, {});
                  navigate(`/operations/layouts/${next.id}`);
                }}
              >
                Clone to edit
              </Button>
            )}
          </div>
        }
      />

      {errors.length > 0 && (
        <Alert tone="danger" title={`${errors.length} problem${errors.length > 1 ? 's' : ''}`} className="mb-4">
          <ul className="mt-1 space-y-0.5">
            {errors.slice(0, 8).map((e, i) => (
              <li key={i} className="text-step--1">
                <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden />
                {e.message}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[200px_1fr_260px]">
        {/* ── Toolbox: entirely from the server. ── */}
        <Card>
          <CardBody className="space-y-1.5">
            <p className="mb-2 text-step--1 font-medium text-ink-muted">Drag onto the bus</p>
            {cat?.items.map((spec) => (
              <div
                key={spec.kind}
                draggable={!isFrozen}
                onDragStart={(e) => e.dataTransfer.setData('kind', spec.kind)}
                className={[
                  'flex cursor-grab items-center justify-between rounded-control border-hair border-line',
                  'bg-surface px-2.5 py-2 text-step--1 text-ink active:cursor-grabbing',
                  isFrozen ? 'pointer-events-none opacity-50' : 'hover:border-primary',
                ].join(' ')}
              >
                <span>{humanise(spec.kind)}</span>
                <span className="tabular text-ink-faint">
                  {spec.w}×{spec.h}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* ── The bus. 320×800, from the server, never a number typed in here. ── */}
        <div>
          <Tabs
            tabs={(cat?.decks ?? ['LOWER']).map((d) => ({
              id: d,
              label: `${humanise(d)} deck`,
              count: def.decks.find((x) => x.deck === d)?.items.length ?? 0,
            }))}
            active={deck}
            onChange={(next) => {
              setDeck(next as DeckId);
              setSelected(new Set());
            }}
            className="mb-3"
          />

          <div className="flex justify-center">
            <div
              ref={canvasRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (isFrozen) return;
                const rect = canvasRef.current!.getBoundingClientRect();
                const kind = e.dataTransfer.getData('kind');
                const movingId = e.dataTransfer.getData('itemId');
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                if (movingId) move(movingId, x - 20, y - 20);
                else if (kind) place(kind, x - 20, y - 20);
              }}
              onClick={(e) => {
                if (e.target === canvasRef.current) setSelected(new Set());
              }}
              className="relative rounded-card border-hair border-line bg-white shadow-e1"
              style={{
                width: W,
                height: H,
                // The grid is invisible but present — it is what stops a layout looking
                // hand-drawn, and what guarantees every bus renders identically.
                backgroundImage:
                  'linear-gradient(to right, rgba(0,0,0,.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.04) 1px, transparent 1px)',
                backgroundSize: `${grid}px ${grid}px`,
              }}
            >
              {items.map((item) => {
                const style = KIND_STYLE[item.kind] ?? KIND_STYLE.EMPTY;
                const isSel = selected.has(item.id);
                const bad = errorsById.get(item.id);
                const sleeper = item.kind.startsWith('SLEEPER');

                return (
                  <div
                    key={item.id}
                    draggable={!isFrozen}
                    onDragStart={(e) => e.dataTransfer.setData('itemId', item.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected((current) => {
                        const next = e.shiftKey ? new Set(current) : new Set<string>();
                        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                        return next;
                      });
                    }}
                    title={item.seatNumber ?? humanise(item.kind)}
                    className={[
                      'absolute flex items-center justify-center border-hair text-[0.65rem] transition-shadow',
                      sleeper ? 'rounded-[10px]' : 'rounded-control',
                      style.fill,
                      isSel ? 'ring-2 ring-primary' : '',
                      bad ? 'ring-2 ring-danger' : '',
                      item.props?.blocked ? 'opacity-40' : '',
                      isFrozen ? '' : 'cursor-grab active:cursor-grabbing',
                    ].join(' ')}
                    style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
                  >
                    <span className="pointer-events-none select-none text-ink">
                      {item.seatNumber ?? style.label}
                    </span>
                    {item.props?.gender === 'FEMALE_ONLY' && (
                      <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
                    )}
                    {item.props?.fareZone === 'PREMIUM' && (
                      <span className="absolute left-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-warning" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Properties ── */}
        <div className="space-y-4">
          <Card>
            <CardBody className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={undo} disabled={!history.length}>
                Undo
              </Button>
              <Button variant="outline" size="sm" onClick={redo} disabled={!future.length}>
                Redo
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Copy className="h-4 w-4" />}
                onClick={duplicateSelected}
                disabled={!selected.size || isFrozen}
              >
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RotateCw className="h-4 w-4" />}
                onClick={rotateSelected}
                disabled={!selected.size || isFrozen}
              >
                Rotate
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FlipHorizontal2 className="h-4 w-4" />}
                onClick={mirrorSelected}
                disabled={!selected.size || isFrozen}
              >
                Mirror
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Hash className="h-4 w-4" />}
                onClick={autoNumber}
                disabled={isFrozen}
              >
                Number
              </Button>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 className="h-4 w-4" />}
                onClick={removeSelected}
                disabled={!selected.size || isFrozen}
                className="col-span-2"
              >
                Delete {selected.size ? `(${selected.size})` : ''}
              </Button>
            </CardBody>
          </Card>

          {one && cat && (
            <Card>
              <CardBody className="space-y-3">
                <p className="text-step--1 font-medium text-ink">{humanise(one.kind)}</p>

                {cat.bookableKinds.includes(one.kind) && (
                  <>
                    <Input
                      label="Seat number"
                      value={one.seatNumber ?? ''}
                      disabled={isFrozen}
                      onChange={(e) =>
                        setItems((c) => c.map((i) => (i.id === one.id ? { ...i, seatNumber: e.target.value } : i)))
                      }
                      hint="Must be unique across the whole bus, both decks."
                    />
                    <Select
                      label="Who may sit here"
                      options={cat.genders.map((g) => ({ value: g, label: humanise(g) }))}
                      value={one.props?.gender ?? 'ANY'}
                      disabled={isFrozen}
                      onChange={(e) =>
                        setItems((c) =>
                          c.map((i) =>
                            i.id === one.id ? { ...i, props: { ...i.props, gender: e.target.value as never } } : i,
                          ),
                        )
                      }
                    />
                    <Select
                      label="Fare zone"
                      options={cat.fareZones.map((z) => ({ value: z, label: humanise(z) }))}
                      value={one.props?.fareZone ?? 'STANDARD'}
                      disabled={isFrozen}
                      onChange={(e) =>
                        setItems((c) =>
                          c.map((i) =>
                            i.id === one.id ? { ...i, props: { ...i.props, fareZone: e.target.value as never } } : i,
                          ),
                        )
                      }
                      hint="A zone, never a price. What a PREMIUM seat costs depends on how far the passenger goes."
                    />
                    <Switch
                      label="Window seat"
                      checked={Boolean(one.props?.isWindow)}
                      disabled={isFrozen}
                      onChange={(v) =>
                        setItems((c) => c.map((i) => (i.id === one.id ? { ...i, props: { ...i.props, isWindow: v } } : i)))
                      }
                    />
                    <Switch
                      label="Reserved (staff / VIP)"
                      description="Drawn, never sold."
                      checked={Boolean(one.props?.reserved)}
                      disabled={isFrozen}
                      onChange={(v) =>
                        setItems((c) => c.map((i) => (i.id === one.id ? { ...i, props: { ...i.props, reserved: v } } : i)))
                      }
                    />
                    <Switch
                      label="Blocked (out of service)"
                      checked={Boolean(one.props?.blocked)}
                      disabled={isFrozen}
                      onChange={(v) =>
                        setItems((c) => c.map((i) => (i.id === one.id ? { ...i, props: { ...i.props, blocked: v } } : i)))
                      }
                    />
                  </>
                )}

                <p className="tabular text-step--1 text-ink-faint">
                  {one.x},{one.y} · {one.w}×{one.h} · {one.rotation}°
                </p>
              </CardBody>
            </Card>
          )}

          {selected.size > 1 && (
            <Alert tone="info" title={`${selected.size} selected`}>
              Copy, rotate, mirror and delete all work on the whole selection. Shift-click to add to it.
            </Alert>
          )}
        </div>
      </div>
    </>
  );
}

/** The list of layouts. Publish one, and it can be put on any number of buses. */
export function SeatLayoutsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const layouts = useQuery({ queryKey: ['layouts'], queryFn: () => layoutsApi.list() });

  const create = useMutation({
    mutationFn: () => layoutsApi.create({ name: name || 'New layout' }),
    onSuccess: async (t) => {
      await queryClient.invalidateQueries({ queryKey: ['layouts'] });
      navigate(`/operations/layouts/${t.id}`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'That could not be created.'),
  });

  return (
    <>
      <PageHeader
        title="Seat layouts"
        description="Draw a bus once. Reuse it on as many buses as you like."
        breadcrumbs={[{ label: 'Operations' }, { label: 'Layouts' }]}
      />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-end gap-3">
          <Input
            label="Name"
            placeholder="Volvo Sleeper 2x1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            containerClassName="max-w-xs"
          />
          <Button onClick={() => create.mutate()} isLoading={create.isPending}>
            Start drawing
          </Button>
        </CardBody>
      </Card>

      {layouts.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(layouts.data ?? []).map((t) => (
            <Card key={t.id} className="cursor-pointer" onClick={() => navigate(`/operations/layouts/${t.id}`)}>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink">{t.name}</p>
                  <Badge tone={t.status === 'PUBLISHED' ? 'success' : t.status === 'DRAFT' ? 'warning' : 'neutral'}>
                    {t.status === 'PUBLISHED' && <Check className="mr-1 h-3 w-3" aria-hidden />}
                    {t.status}
                  </Badge>
                </div>
                <p className="text-step--1 text-ink-muted">
                  v{t.version} · {t.seatCount} seats{t.busType ? ` · ${humanise(t.busType)}` : ''}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
