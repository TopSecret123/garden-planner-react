import type { ColorEntry } from '../types';

export const COLORS: ColorEntry[] = [
  { id: 'terracotta', name: 'Terracotta', hex: '#c1654a' },
  { id: 'sage',       name: 'Sage',       hex: '#6b8f71' },
  { id: 'slate',      name: 'Slate',      hex: '#607d8b' },
  { id: 'cream',      name: 'Cream',      hex: '#c8a96e' },
  { id: 'charcoal',   name: 'Charcoal',   hex: '#3d3d3d' },
  { id: 'rose',       name: 'Dusty Rose', hex: '#b97a8a' },
  { id: 'ochre',      name: 'Ochre',      hex: '#c8972a' },
  { id: 'cobalt',     name: 'Cobalt',     hex: '#3a5fa0' },
];

export const SOIL_COLORS: ColorEntry[] = [
  { id: 'loam',  name: 'Loam',  hex: '#c8b89a' },
  { id: 'dark',  name: 'Dark',  hex: '#5c4a35' },
  { id: 'sandy', name: 'Sandy', hex: '#d4bc8a' },
  { id: 'clay',  name: 'Clay',  hex: '#b87050' },
  { id: 'rich',  name: 'Rich',  hex: '#3d2b1a' },
  { id: 'mulch', name: 'Mulch', hex: '#7a5c3a' },
];

export const GARDEN_EMOJIS = [
  '🌿','🪴','🌻','🥕','🍅','🌺','🌳','🍓','🌾','🫛','🌷','🍃','☘️','🌱','🌹','🎋',
];

export const GRID_SNAP_CM = 5;
export const STORAGE_KEY  = 'gardenPlannerV3';
export const SETTINGS_KEY = 'gardenPlannerSettings';
export const CUSTOM_COLOR_SLOTS = 6;

export const FONT_MAP: Record<string, string> = {
  'dm-sans':  "'DM Sans', sans-serif",
  'playfair': "'Playfair Display', serif",
  'system':   'system-ui, sans-serif',
};
