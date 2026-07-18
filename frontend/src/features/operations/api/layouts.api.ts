import { http } from '@/core/api/http-client';
import type { CreateLayoutDto, UpdateLayoutDto, CloneLayoutDto, AssignLayoutDto } from '@/core/api/generated/dtos';

/* ───────────────────────── The drawing ───────────────────────── */

export type DeckId = 'LOWER' | 'UPPER';
export type Rotation = 0 | 90 | 180 | 270;
export type GenderRule = 'ANY' | 'FEMALE_ONLY' | 'MALE_ONLY';
export type FareZone = 'PREMIUM' | 'STANDARD' | 'ECONOMY' | 'LAST_ROW' | 'LADIES' | 'LUXURY';

export interface SeatProps {
  gender?: GenderRule;
  fareZone?: FareZone;
  isWindow?: boolean;
  isAisle?: boolean;
  reserved?: boolean;
  blocked?: boolean;
  wheelchair?: boolean;
  label?: string;
  notes?: string;
}

export interface LayoutItem {
  id: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: Rotation;
  seatNumber?: string;
  props?: SeatProps;
}

export interface Deck {
  deck: DeckId;
  items: LayoutItem[];
}

export interface LayoutDefinition {
  decks: Deck[];
}

export interface LayoutTemplate {
  id: string;
  familyId: string;
  version: number;
  name: string;
  busType: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  definition: LayoutDefinition;
  seatCount: number;
  publishedAt: string | null;
  createdAt: string;
}

export interface LayoutError {
  code: string;
  message: string;
  itemId?: string;
  deck?: DeckId;
}

/**
 * The builder's own description of itself — canvas size, grid, and every component that can
 * be placed.
 *
 * It comes from the SERVER, deliberately. The moment the frontend hardcodes 320x800 or a
 * fixed list of components, adding a washroom or a charging point means a code change and a
 * deploy. Fetch it, and the toolbox grows on its own.
 */
export interface BuilderCatalogue {
  canvas: { width: number; height: number; grid: number };
  rotations: Rotation[];
  bookableKinds: string[];
  items: Array<{ kind: string; w: number; h: number; bookable: boolean }>;
  genders: GenderRule[];
  fareZones: FareZone[];
  decks: DeckId[];
}

export const layoutsApi = {
  catalogue: () => http.get<BuilderCatalogue>('/seat-layouts/catalogue'),

  list: () => http.get<LayoutTemplate[]>('/seat-layouts'),
  get: (id: string) => http.get<LayoutTemplate>(`/seat-layouts/${id}`),
  versions: (familyId: string) => http.get<LayoutTemplate[]>(`/seat-layouts/family/${familyId}/versions`),

  create: (body: CreateLayoutDto) => http.post<LayoutTemplate>('/seat-layouts', body),

  /** Drafts only. A published layout is frozen — clone it to change it. */
  update: (id: string, body: UpdateLayoutDto) => http.patch<LayoutTemplate>(`/seat-layouts/${id}`, body),

  /** A dry run, called as the operator draws so problems surface while they are still cheap. */
  validate: (id: string) =>
    http.post<{ ok: boolean; errors: LayoutError[]; seatCount: number }>(`/seat-layouts/${id}/validate`, {}),

  publish: (id: string) => http.post<LayoutTemplate>(`/seat-layouts/${id}/publish`, {}),
  clone: (id: string, body: CloneLayoutDto) => http.post<LayoutTemplate>(`/seat-layouts/${id}/clone`, body),
  archive: (id: string) => http.delete<LayoutTemplate>(`/seat-layouts/${id}`),

  /** Point a bus at a published layout. Its seat map is regenerated from the drawing. */
  assign: (busId: string, body: AssignLayoutDto) =>
    http.post<unknown>(`/seat-layouts/assign/${busId}`, body),
};
