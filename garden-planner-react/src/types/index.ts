export type PotShape = 'round' | 'square' | 'rect' | 'trough';
export type DisplayMode = 'name' | 'emoji' | 'dims' | 'none';
export type BedDisplayMode = 'name' | 'dims' | 'none';
export type PlantType = 'vegetable' | 'herb' | 'fruit' | 'flower' | 'tree' | 'other';
export type MoveMode = 'free' | 'grid';
export type GardenStatus = 'active' | 'archived';
export type AppTheme = '' | 'dark' | 'slate' | 'cream';
export type AppFont = 'dm-sans' | 'playfair' | 'system';

export interface Point { x: number; y: number; }

export interface ColorEntry { id: string; name: string; hex: string; }

export interface Bed {
  id: number; label: string; points: Point[];
  soilColor: string; displayMode: BedDisplayMode;
}

export interface Pot {
  id: number; label: string; emoji: string; shape: PotShape;
  width_cm: number; height_cm: number; color: string;
  position: Point; rotation: number; plantId: string;
  notes: string; displayMode: DisplayMode;
}

export interface Plant {
  id: string; name: string; emoji: string; type: PlantType;
  datePlanted: string; notes: string;
}

export interface GardenData {
  pxPerCm: number | null;
  beds: Bed[]; pots: Pot[]; plants: Plant[];
  nextId: number; nextBedId: number; nextPlantId: number;
}

export interface Garden {
  id: number; name: string; emoji: string;
  status: GardenStatus; created: string; data: GardenData;
}

export interface AppData {
  gardens: Garden[]; activeGardenId: number | null;
}

export interface AppSettings {
  potMarginCm: number; allowOverlap: boolean;
  customPotColors: (ColorEntry | null)[];
}

export interface DisplaySettings {
  theme: AppTheme; font: AppFont;
  canvasBg: string; rightPanelCollapsed: boolean;
}
