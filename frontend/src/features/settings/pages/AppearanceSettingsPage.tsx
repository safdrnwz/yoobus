import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, History, Palette, RotateCcw, Save, Sparkles, SquareStack, Type as TypeIcon, Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Alert, Badge, Button, Card, CardBody, CardHeader, ColorField, ConfirmDialog, DataTable,
  Input, RangeField, SegmentedField, Select, StatusBadge, Switch, Tabs,
} from '@/components/ui';
import { queryKeys } from '@/core/api/query-client';
import { ApiError } from '@/core/api/api-error';
import { formatDateTime, formatRelative } from '@/core/utils/date';
import { useDisclosure } from '@/core/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { THEME_PRESETS } from '@/theme/defaults';
import type { AppearanceSettings } from '@/theme/theme.types';
import { appearanceApi, platformConfigApi, type ConfigVersion } from '../api/settings.api';

const FONT_STACKS = [
  { value: "'Inter', system-ui, sans-serif", label: 'Inter — neutral, dense UI' },
  { value: "'Sora', system-ui, sans-serif", label: 'Sora — geometric, confident' },
  { value: "'JetBrains Mono', ui-monospace, monospace", label: 'JetBrains Mono — data & figures' },
  { value: "system-ui, -apple-system, sans-serif", label: 'System — matches the operating system' },
  { value: "Georgia, 'Times New Roman', serif", label: 'Georgia — serif, editorial' },
];

type TabId = 'brand' | 'colour' | 'type' | 'controls' | 'layout' | 'history';

/**
 * Global Settings.
 *
 * Changing a control here repaints the entire console immediately — this is a preview, not
 * a saved change, and the topbar says so. Nothing reaches the server until Save, and the
 * backend rejects the write outright unless the caller is a platform SuperAdmin.
 */
export function AppearanceSettingsPage() {
  const queryClient = useQueryClient();
  const { saved, preview, cancelPreview, isPreviewing, refresh } = useTheme();
  const [tab, setTab] = useState<TabId>('brand');
  const resetDialog = useDisclosure();

  // The working copy. Seeded from the server, and re-seeded whenever a save lands.
  const [draft, setDraft] = useState<AppearanceSettings>(saved);
  useEffect(() => {
    setDraft(saved);
  }, [saved]);

  // Every keystroke paints the real UI, so the admin judges the theme in situ.
  useEffect(() => {
    preview(draft);
    return () => cancelPreview();
  }, [draft, preview, cancelPreview]);

  const isDirty = useMemo(
    () => (Object.keys(draft) as Array<keyof AppearanceSettings>).some((key) => draft[key] !== saved[key]),
    [draft, saved],
  );

  const set = <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: () => appearanceApi.update(draft),
    onSuccess: async () => {
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['appearance', 'versions'] });
      toast.success('Theme saved. Every screen is using it now.');
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : 'The theme could not be saved.';
      toast.error(message);
    },
  });

  const resetMutation = useMutation({
    mutationFn: appearanceApi.reset,
    onSuccess: async () => {
      await refresh();
      resetDialog.close();
      toast.success('Theme reset to the platform defaults.');
    },
    onError: () => toast.error('The theme could not be reset.'),
  });

  const versionsQuery = useQuery({
    queryKey: ['appearance', 'versions'],
    queryFn: appearanceApi.versions,
    enabled: tab === 'history',
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => platformConfigApi.restoreVersion(id),
    onSuccess: async () => {
      await refresh();
      toast.success('Theme restored from history.');
    },
    onError: () => toast.error('That revision could not be restored.'),
  });

  const applyPreset = (values: Partial<AppearanceSettings>) => {
    setDraft((current) => ({ ...current, ...values }));
    toast.message('Preset applied', { description: 'Save to make it live for everyone.' });
  };

  const discard = () => {
    setDraft(saved);
    toast.message('Changes discarded');
  };

  return (
    <>
      <PageHeader
        title="Global settings"
        description="Set the look and feel of every Yoo Bus screen. Changes here apply across the whole platform the moment you save."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Global settings' }]}
        actions={
          <>
            <Button variant="outline" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={resetDialog.open}>
              Reset to defaults
            </Button>
            {isDirty && (
              <Button variant="ghost" leftIcon={<Undo2 className="h-4 w-4" />} onClick={discard}>
                Discard
              </Button>
            )}
            <Button
              leftIcon={<Save className="h-4 w-4" />}
              onClick={() => saveMutation.mutate()}
              isLoading={saveMutation.isPending}
              disabled={!isDirty}
            >
              Save theme
            </Button>
          </>
        }
      />

      {isPreviewing && isDirty && (
        <Alert tone="warning" title="You are previewing an unsaved theme" className="mb-gutter">
          Only you can see this. Save to apply it for everyone, or discard to go back to the live theme.
        </Alert>
      )}

      <Tabs
        className="mb-gutter"
        active={tab}
        onChange={(id) => setTab(id as TabId)}
        tabs={[
          { id: 'brand', label: 'Brand', icon: <Sparkles className="h-4 w-4" /> },
          { id: 'colour', label: 'Colour', icon: <Palette className="h-4 w-4" /> },
          { id: 'type', label: 'Typography', icon: <TypeIcon className="h-4 w-4" /> },
          { id: 'controls', label: 'Buttons', icon: <SquareStack className="h-4 w-4" /> },
          { id: 'layout', label: 'Layout', icon: <Eye className="h-4 w-4" /> },
          { id: 'history', label: 'History', icon: <History className="h-4 w-4" /> },
        ]}
      />

      {tab === 'brand' && (
        <div className="grid gap-gutter lg:grid-cols-2">
          <Card>
            <CardHeader title="Identity" description="What people see in the sidebar, the tab and the footer." />
            <CardBody className="space-y-4">
              <Input
                label="Product name"
                value={draft.brandName}
                onChange={(event) => set('brandName', event.target.value)}
                hint="Shown in the sidebar and the browser tab."
              />
              <Input
                label="Logo URL"
                value={draft.logoUrl}
                onChange={(event) => set('logoUrl', event.target.value)}
                placeholder="https://cdn.example.com/logo.svg"
                hint="Leave empty to use the initial of the product name."
              />
              <Input
                label="Favicon URL"
                value={draft.faviconUrl}
                onChange={(event) => set('faviconUrl', event.target.value)}
                placeholder="https://cdn.example.com/favicon.png"
              />
              <Switch
                label="Show the footer"
                description="Turn off to reclaim the space on small counter screens."
                checked={draft.showFooter}
                onChange={(value) => set('showFooter', value)}
              />
              {draft.showFooter && (
                <Input
                  label="Footer text"
                  value={draft.footerText}
                  onChange={(event) => set('footerText', event.target.value)}
                />
              )}
              <Switch
                label="Animations"
                description="Motion is reduced automatically for anyone who has asked their system for it."
                checked={draft.animationsEnabled}
                onChange={(value) => set('animationsEnabled', value)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Presets" description="A starting point you can then adjust." />
            <CardBody className="space-y-3">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.values)}
                  className="flex w-full items-center gap-3 rounded-surface border-hair border-line p-3 text-left transition-colors duration-motion hover:border-primary hover:bg-surface-sunken"
                >
                  <span className="flex shrink-0 gap-1" aria-hidden>
                    {[preset.values.primaryColor, preset.values.secondaryColor, preset.values.accentColor].map((colour) => (
                      <span
                        key={colour}
                        className="h-8 w-4 rounded-sm border-hair border-line"
                        style={{ backgroundColor: colour }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-step-0 font-medium text-ink">{preset.name}</span>
                    <span className="block text-step--1 text-ink-muted">{preset.description}</span>
                  </span>
                </button>
              ))}
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'colour' && (
        <div className="space-y-gutter">
          <Card>
            <CardHeader
              title="Theme mode"
              description="Dark mode swaps the surfaces only — your brand colours, fonts and shapes carry over."
            />
            <CardBody>
              <SegmentedField
                label="Mode"
                value={draft.themeMode}
                onChange={(value) => set('themeMode', value)}
                options={[
                  { value: 'LIGHT', label: 'Light' },
                  { value: 'DARK', label: 'Dark' },
                  { value: 'CUSTOM', label: 'Custom' },
                ]}
                description="Custom uses exactly the colours you set below, with no surface overrides."
              />
            </CardBody>
          </Card>

          <div className="grid gap-gutter lg:grid-cols-2">
            <Card>
              <CardHeader title="Brand" description="The colours that carry meaning." />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <ColorField label="Primary" value={draft.primaryColor} onChange={(v) => set('primaryColor', v)} contrastAgainst="#FFFFFF" description="Actions and the active state." />
                <ColorField label="Secondary" value={draft.secondaryColor} onChange={(v) => set('secondaryColor', v)} contrastAgainst="#FFFFFF" />
                <ColorField label="Accent" value={draft.accentColor} onChange={(v) => set('accentColor', v)} description="Reserve this for things that must be noticed." />
                <ColorField label="Border" value={draft.borderColor} onChange={(v) => set('borderColor', v)} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Surfaces & text" description="The canvas the product sits on." />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <ColorField label="Background" value={draft.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
                <ColorField label="Surface" value={draft.surfaceColor} onChange={(v) => set('surfaceColor', v)} />
                <ColorField label="Text" value={draft.textColor} onChange={(v) => set('textColor', v)} contrastAgainst={draft.surfaceColor} />
                <ColorField label="Muted text" value={draft.mutedTextColor} onChange={(v) => set('mutedTextColor', v)} contrastAgainst={draft.surfaceColor} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Chrome" description="Sidebar and footer." />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <ColorField label="Sidebar" value={draft.sidebarColor} onChange={(v) => set('sidebarColor', v)} />
                <ColorField label="Sidebar text" value={draft.sidebarTextColor} onChange={(v) => set('sidebarTextColor', v)} contrastAgainst={draft.sidebarColor} />
                <ColorField label="Footer" value={draft.footerColor} onChange={(v) => set('footerColor', v)} />
                <ColorField label="Footer text" value={draft.footerTextColor} onChange={(v) => set('footerTextColor', v)} contrastAgainst={draft.footerColor} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Status" description="These carry meaning — change them only with good reason." />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <ColorField label="Success" value={draft.successColor} onChange={(v) => set('successColor', v)} />
                <ColorField label="Warning" value={draft.warningColor} onChange={(v) => set('warningColor', v)} />
                <ColorField label="Danger" value={draft.dangerColor} onChange={(v) => set('dangerColor', v)} />
                <ColorField label="Info" value={draft.infoColor} onChange={(v) => set('infoColor', v)} />
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {tab === 'type' && (
        <div className="grid gap-gutter lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader title="Typefaces & scale" description="One base size and one ratio generate the whole type scale." />
            <CardBody className="space-y-4">
              <Select
                label="Body font"
                value={draft.fontFamily}
                onChange={(event) => set('fontFamily', event.target.value)}
                options={FONT_STACKS}
              />
              <Select
                label="Heading font"
                value={draft.headingFontFamily}
                onChange={(event) => set('headingFontFamily', event.target.value)}
                options={FONT_STACKS}
              />
              <Select
                label="Figures & code font"
                value={draft.monoFontFamily}
                onChange={(event) => set('monoFontFamily', event.target.value)}
                options={FONT_STACKS}
                hint="Used for fares, PNRs and anything that must line up in a column."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <RangeField label="Base size" value={draft.baseFontSize} onChange={(v) => set('baseFontSize', v)} min={12} max={18} />
                <RangeField label="Scale ratio" value={draft.fontScale} onChange={(v) => set('fontScale', v)} min={1.05} max={1.333} step={0.008} unit="×" />
                <RangeField label="Line height" value={draft.lineHeight} onChange={(v) => set('lineHeight', v)} min={1.2} max={1.9} step={0.05} unit="" />
                <RangeField label="Letter spacing" value={draft.letterSpacing} onChange={(v) => set('letterSpacing', v)} min={-0.02} max={0.06} step={0.005} unit="em" />
                <RangeField label="Body weight" value={draft.bodyWeight} onChange={(v) => set('bodyWeight', v)} min={300} max={500} step={100} unit="" />
                <RangeField label="Heading weight" value={draft.headingWeight} onChange={(v) => set('headingWeight', v)} min={500} max={800} step={100} unit="" />
              </div>
            </CardBody>
          </Card>

          <Card className="h-fit">
            <CardHeader title="Preview" />
            <CardBody className="space-y-3">
              <p className="text-step-3 text-ink">Departures</p>
              <p className="text-step-1 text-ink">Delhi → Jaipur, 21:30</p>
              <p className="text-step-0 text-ink-muted">
                Seat holds expire {draft.baseFontSize} minutes after selection. Passengers are notified once.
              </p>
              <p className="tabular text-step-0 text-ink">PNR 8FQ2M4KD · ₹1,240.00 · 42/48 seats</p>
              <p className="text-step--1 text-ink-faint">Secondary text and captions look like this.</p>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'controls' && (
        <div className="grid gap-gutter lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader
              title="Button style"
              description="This is the house style. Any button that doesn't override it follows what you set here."
            />
            <CardBody className="space-y-5">
              <SegmentedField
                label="Default variant"
                value={draft.buttonVariant}
                onChange={(value) => set('buttonVariant', value)}
                options={[
                  { value: 'SOLID', label: 'Solid' },
                  { value: 'OUTLINE', label: 'Outline' },
                  { value: 'SOFT', label: 'Soft' },
                  { value: 'GHOST', label: 'Ghost' },
                ]}
              />
              <SegmentedField
                label="Shape"
                value={draft.buttonShape}
                onChange={(value) => set('buttonShape', value)}
                options={[
                  { value: 'SQUARE', label: 'Square' },
                  { value: 'ROUNDED', label: 'Rounded' },
                  { value: 'PILL', label: 'Pill' },
                ]}
              />
              <SegmentedField
                label="Size"
                value={draft.buttonSize}
                onChange={(value) => set('buttonSize', value)}
                options={[
                  { value: 'SM', label: 'Small' },
                  { value: 'MD', label: 'Medium' },
                  { value: 'LG', label: 'Large' },
                ]}
              />
              {draft.buttonShape === 'ROUNDED' && (
                <RangeField label="Corner radius" value={draft.buttonRadius} onChange={(v) => set('buttonRadius', v)} min={0} max={20} />
              )}
              <RangeField label="Label weight" value={draft.buttonWeight} onChange={(v) => set('buttonWeight', v)} min={400} max={700} step={100} unit="" />
              <Switch
                label="Uppercase labels"
                description="Adds letter spacing automatically so the label stays readable."
                checked={draft.buttonUppercase}
                onChange={(value) => set('buttonUppercase', value)}
              />
            </CardBody>
          </Card>

          <Card className="h-fit">
            <CardHeader title="Preview" />
            <CardBody className="flex flex-wrap gap-2">
              <Button>Save changes</Button>
              <Button variant="outline">Cancel</Button>
              <Button variant="soft">Duplicate</Button>
              <Button variant="danger">Cancel trip</Button>
              <Button variant="ghost">Learn more</Button>
              <div className="mt-2 flex w-full flex-wrap gap-2">
                <Badge tone="success" dot>Confirmed</Badge>
                <Badge tone="warning" dot>Held</Badge>
                <StatusBadge status="CANCELLED" />
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'layout' && (
        <div className="grid gap-gutter lg:grid-cols-2">
          <Card>
            <CardHeader title="Surfaces" description="How the containers on every screen are shaped." />
            <CardBody className="space-y-5">
              <RangeField label="Corner radius" value={draft.radius} onChange={(v) => set('radius', v)} min={0} max={20} description="Cards, inputs, modals." />
              <RangeField label="Border width" value={draft.borderWidth} onChange={(v) => set('borderWidth', v)} min={0} max={2} />
              <SegmentedField
                label="Shadow"
                value={draft.shadowLevel}
                onChange={(value) => set('shadowLevel', value)}
                options={[
                  { value: 'NONE', label: 'None' },
                  { value: 'SUBTLE', label: 'Subtle' },
                  { value: 'ELEVATED', label: 'Elevated' },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Density & width" description="How much the interface fits on one screen." />
            <CardBody className="space-y-5">
              <SegmentedField
                label="Density"
                value={draft.density}
                onChange={(value) => set('density', value)}
                options={[
                  { value: 'COMPACT', label: 'Compact' },
                  { value: 'COMFORTABLE', label: 'Comfortable' },
                  { value: 'SPACIOUS', label: 'Spacious' },
                ]}
                description="Compact suits ticket counters; spacious suits large displays."
              />
              <RangeField label="Sidebar width" value={draft.sidebarWidth} onChange={(v) => set('sidebarWidth', v)} min={200} max={340} />
              <RangeField label="Content width" value={draft.contentMaxWidth} onChange={(v) => set('contentMaxWidth', v)} min={1080} max={1920} step={20} />
              <Switch
                label="Start with the sidebar collapsed"
                description="The default for everyone. Individuals can still expand it."
                checked={draft.sidebarCollapsed}
                onChange={(value) => set('sidebarCollapsed', value)}
              />
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'history' && (
        <Card>
          <CardHeader
            title="Theme history"
            description="Every save snapshots the previous theme. Restore one to roll back."
          />
          <DataTable<ConfigVersion>
            data={versionsQuery.data}
            isLoading={versionsQuery.isLoading}
            error={versionsQuery.error}
            onRetry={versionsQuery.refetch}
            rowKey={(row) => row.id}
            empty={{
              title: 'No revisions yet',
              description: 'The first time you save a theme, the previous one is recorded here.',
            }}
            columns={[
              {
                id: 'when',
                header: 'Saved',
                cell: (row) => (
                  <div>
                    <p className="text-ink">{formatRelative(row.createdAt)}</p>
                    <p className="text-step--1 text-ink-muted">{formatDateTime(row.createdAt)}</p>
                  </div>
                ),
                sortValue: (row) => row.createdAt,
              },
              {
                id: 'keys',
                header: 'Values captured',
                secondary: true,
                cell: (row) => <span className="tabular text-ink-muted">{Object.keys(row.snapshot).length}</span>,
              },
              {
                id: 'action',
                header: '',
                align: 'right',
                cell: (row) => (
                  <Button
                    size="sm"
                    variant="outline"
                    isLoading={restoreMutation.isPending && restoreMutation.variables === row.id}
                    onClick={() => restoreMutation.mutate(row.id)}
                  >
                    Restore
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      )}

      <ConfirmDialog
        isOpen={resetDialog.isOpen}
        onClose={resetDialog.close}
        onConfirm={() => resetMutation.mutate()}
        isLoading={resetMutation.isPending}
        title="Reset the theme?"
        message="Every colour, font and shape returns to the Yoo Bus defaults, for everyone. The current theme is saved to history first, so you can restore it."
        confirmLabel="Reset to defaults"
      />
    </>
  );
}
