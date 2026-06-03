import { create } from 'zustand';
import type { AppData, GardenData, Garden, Bed, Pot, Plant, AppSettings, DisplaySettings, ColorEntry } from '../types';
import { db } from '../lib/supabase';
import { migrateGarden } from '../lib/migrations';
import { getAppSettings, saveAppSettings, loadDisplaySettings, saveDisplaySettings, applyDisplaySettingsToDom, getCustomColors } from '../lib/settings';
import { COLORS } from '../lib/constants';

function newGardenData(): GardenData {
  return { pxPerCm: null, beds: [], pots: [], plants: [], nextId: 1, nextBedId: 1, nextPlantId: 1 };
}
function cloneData(d: GardenData): GardenData { return JSON.parse(JSON.stringify(d)) as GardenData; }

export interface GardenStore {
  appData: AppData; state: GardenData;
  selectedPotId: number | null; selectedBedId: number | null; selectedPlantId: string | null;
  history: string[]; historyIdx: number;
  viewX: number; viewY: number; viewScale: number; showGrid: boolean;
  alignMode: boolean; moveMode: 'free' | 'grid';
  appSettings: AppSettings; displaySettings: DisplaySettings;
  pushHistory: () => void; undo: () => void; redo: () => void;
  saveToStorage: () => Promise<void>; loadFromStorage: () => Promise<void>;
  loadActiveGarden: () => void; createFirstGarden: () => void;
  switchGarden: (id: number) => void; createGarden: (name: string, emoji: string) => void;
  deleteGarden: (id: number) => void; toggleArchiveGarden: (id: number) => void;
  addBed: (points: {x:number;y:number}[]) => void;
  updateBed: (id: number, field: keyof Bed, value: unknown) => void;
  deleteBed: (id: number) => void; resizeBed: (id: number, wCm: number, hCm: number) => void;
  addPot: (pot: Omit<Pot,'id'>) => void;
  updatePot: (id: number, field: keyof Pot, value: unknown) => void;
  deletePot: (id: number) => void; duplicatePot: (id: number) => void;
  movePot: (id: number, x: number, y: number) => void;
  addPlant: (plant: Omit<Plant,'id'>) => void;
  updatePlant: (id: string, field: keyof Plant, value: unknown) => void;
  deletePlant: (id: string) => void;
  setView: (x: number, y: number, scale: number) => void;
  setShowGrid: (v: boolean) => void; setAlignMode: (v: boolean) => void; setMoveMode: (v: 'free'|'grid') => void;
  selectPot: (id: number|null) => void; selectBed: (id: number|null) => void; selectPlant: (id: string|null) => void;
  updateAppSetting: <K extends keyof AppSettings>(key: K, val: AppSettings[K]) => void;
  updateDisplaySetting: <K extends keyof DisplaySettings>(key: K, val: DisplaySettings[K]) => void;
  saveCustomColor: (slot: number, hex: string) => void;
  getPotColors: () => ColorEntry[];
  isActiveGardenArchived: () => boolean;
}

export const useGardenStore = create<GardenStore>((set, get) => ({
  appData: { gardens: [], activeGardenId: null },
  state: newGardenData(),
  selectedPotId: null, selectedBedId: null, selectedPlantId: null,
  history: [], historyIdx: -1,
  viewX: 0, viewY: 0, viewScale: 1, showGrid: true,
  alignMode: false, moveMode: 'free',
  appSettings: getAppSettings(), displaySettings: loadDisplaySettings(),

  pushHistory() {
    const { state, history, historyIdx } = get();
    const snap = JSON.stringify(cloneData(state));
    const h = [...history.slice(0, historyIdx + 1), snap];
    if (h.length > 50) h.shift();
    set({ history: h, historyIdx: h.length - 1 });
  },

  undo() {
    const { historyIdx, history } = get();
    if (historyIdx <= 0) return;
    const idx = historyIdx - 1;
    const snap = JSON.parse(history[idx]) as GardenData;
    const { appData } = get();
    const g = appData.gardens.find(g => g.id === appData.activeGardenId);
    if (g) g.data = snap;
    set({ state: snap, historyIdx: idx, selectedPotId: null, selectedBedId: null, selectedPlantId: null });
    get().saveToStorage();
  },

  redo() {
    const { historyIdx, history } = get();
    if (historyIdx >= history.length - 1) return;
    const idx = historyIdx + 1;
    const snap = JSON.parse(history[idx]) as GardenData;
    const { appData } = get();
    const g = appData.gardens.find(g => g.id === appData.activeGardenId);
    if (g) g.data = snap;
    set({ state: snap, historyIdx: idx, selectedPotId: null, selectedBedId: null, selectedPlantId: null });
    get().saveToStorage();
  },

  async saveToStorage() {
    const { appData, state } = get();
    if (appData.activeGardenId !== null) {
      const g = appData.gardens.find(g => g.id === appData.activeGardenId);
      if (g) g.data = state;
    }
    const { error } = await db.from('gardens').upsert(appData.gardens);
    if (error) console.error('Save failed:', error);
  },

  async loadFromStorage() {
    const { data, error } = await db.from('gardens').select('*');
    if (error) { console.error('Load failed:', error); return; }
    if (!data || !data.length) return;
    const gardens = data as Garden[];
    gardens.forEach(migrateGarden);
    set(s => ({ appData: { ...s.appData, gardens } }));
  },

  loadActiveGarden() {
    const { appData } = get();
    let activeId = appData.activeGardenId;
    let g = appData.gardens.find(g => g.id === activeId);
    if (!g && appData.gardens.length > 0) { g = appData.gardens[0]; activeId = g.id; }
    if (!g) return;
    const snap = JSON.stringify(cloneData(g.data));
    set({ state: g.data, appData: { ...appData, activeGardenId: activeId }, history: [snap], historyIdx: 0 });
  },

  createFirstGarden() {
    const g: Garden = { id: Date.now(), name: 'My Garden', emoji: '🌿', status: 'active', created: new Date().toISOString().split('T')[0], data: newGardenData() };
    const appData: AppData = { gardens: [g], activeGardenId: g.id };
    const snap = JSON.stringify(cloneData(g.data));
    set({ appData, state: g.data, history: [snap], historyIdx: 0 });
    get().saveToStorage();
  },

  switchGarden(id) {
    const { appData, state } = get();
    if (id === appData.activeGardenId) return;
    const curr = appData.gardens.find(g => g.id === appData.activeGardenId);
    if (curr) curr.data = state;
    set(s => ({ appData: { ...s.appData, activeGardenId: id } }));
    get().loadActiveGarden();
    set({ selectedPotId: null, selectedBedId: null, selectedPlantId: null });
    get().saveToStorage();
  },

  createGarden(name, emoji) {
    const { appData, state } = get();
    const curr = appData.gardens.find(g => g.id === appData.activeGardenId);
    if (curr) curr.data = state;
    const g: Garden = { id: Date.now(), name, emoji, status: 'active', created: new Date().toISOString().split('T')[0], data: newGardenData() };
    const newAppData: AppData = { gardens: [...appData.gardens, g], activeGardenId: g.id };
    const snap = JSON.stringify(cloneData(g.data));
    set({ appData: newAppData, state: g.data, history: [snap], historyIdx: 0 });
    get().saveToStorage();
  },

  deleteGarden(id) {
    const { appData } = get();
    if (appData.gardens.length <= 1) return;
    const gardens = appData.gardens.filter(g => g.id !== id);
    let activeId = appData.activeGardenId === id ? gardens[0].id : appData.activeGardenId;
    set(s => ({ appData: { ...s.appData, gardens, activeGardenId: activeId } }));
    get().loadActiveGarden(); get().saveToStorage();
  },

  toggleArchiveGarden(id) {
    const { appData } = get();
    const gardens = appData.gardens.map(g => g.id === id ? { ...g, status: (g.status === 'archived' ? 'active' : 'archived') as Garden['status'] } : g);
    set(s => ({ appData: { ...s.appData, gardens } }));
    get().saveToStorage();
  },

  isActiveGardenArchived() {
    const { appData } = get();
    const g = appData.gardens.find(g => g.id === appData.activeGardenId);
    return !!(g && g.status === 'archived');
  },

  addBed(points) {
    get().pushHistory();
    set(s => {
      const bed: Bed = { id: s.state.nextBedId, label: `Bed ${s.state.beds.length + 1}`, points, soilColor: 'loam', displayMode: 'name' };
      return { state: { ...s.state, beds: [...s.state.beds, bed], nextBedId: s.state.nextBedId + 1 }, selectedBedId: bed.id };
    });
    get().saveToStorage();
  },

  updateBed(id, field, value) {
    set(s => ({ state: { ...s.state, beds: s.state.beds.map(b => b.id === id ? { ...b, [field]: value } : b) } }));
    get().saveToStorage();
  },

  deleteBed(id) {
    get().pushHistory();
    set(s => ({ state: { ...s.state, beds: s.state.beds.filter(b => b.id !== id) }, selectedBedId: s.selectedBedId === id ? null : s.selectedBedId }));
    get().saveToStorage();
  },

  resizeBed(id, wCm, hCm) {
    const { state } = get();
    const bed = state.beds.find(b => b.id === id);
    if (!bed || bed.points.length !== 4 || !state.pxPerCm) return;
    const wPx = wCm * state.pxPerCm, hPx = hCm * state.pxPerCm;
    const pts = bed.points;
    const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
    const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
    let ux = pts[1].x - pts[0].x, uy = pts[1].y - pts[0].y;
    const umag = Math.hypot(ux, uy);
    if (umag < 1e-6) { ux = 1; uy = 0; } else { ux /= umag; uy /= umag; }
    let vx = pts[2].x - pts[1].x, vy = pts[2].y - pts[1].y;
    const vmag = Math.hypot(vx, vy);
    if (vmag < 1e-6) { vx = -uy; vy = ux; } else { vx /= vmag; vy /= vmag; }
    const hw = wPx/2, hh = hPx/2;
    get().updateBed(id, 'points', [
      { x: cx - hw*ux - hh*vx, y: cy - hw*uy - hh*vy },
      { x: cx + hw*ux - hh*vx, y: cy + hw*uy - hh*vy },
      { x: cx + hw*ux + hh*vx, y: cy + hw*uy + hh*vy },
      { x: cx - hw*ux + hh*vx, y: cy - hw*uy + hh*vy },
    ]);
  },

  addPot(pot) {
    set(s => {
      const newPot: Pot = { ...pot, id: s.state.nextId };
      return { state: { ...s.state, pots: [...s.state.pots, newPot], nextId: s.state.nextId + 1 }, selectedPotId: newPot.id };
    });
    get().saveToStorage();
  },

  updatePot(id, field, value) {
    set(s => ({ state: { ...s.state, pots: s.state.pots.map(p => p.id === id ? { ...p, [field]: value } : p) } }));
    get().saveToStorage();
  },

  deletePot(id) {
    get().pushHistory();
    set(s => ({ state: { ...s.state, pots: s.state.pots.filter(p => p.id !== id) }, selectedPotId: s.selectedPotId === id ? null : s.selectedPotId }));
    get().saveToStorage();
  },

  duplicatePot(id) {
    const { state } = get();
    const pot = state.pots.find(p => p.id === id);
    if (!pot) return;
    get().pushHistory();
    const pxPerCm = state.pxPerCm ?? 2;
    const offset = Math.max(pot.width_cm, pot.height_cm) * pxPerCm + 20;
    let nx = pot.position.x + offset;
    if (state.beds.length > 0) { const xs = state.beds.flatMap(b => b.points.map(p => p.x)); nx = Math.max(...xs) + 80; }
    const newPot: Pot = { ...JSON.parse(JSON.stringify(pot)), id: state.nextId, position: { x: nx, y: pot.position.y + offset } };
    set(s => ({ state: { ...s.state, pots: [...s.state.pots, newPot], nextId: s.state.nextId + 1 }, selectedPotId: newPot.id }));
    get().saveToStorage();
  },

  movePot(id, x, y) {
    set(s => ({ state: { ...s.state, pots: s.state.pots.map(p => p.id === id ? { ...p, position: { x, y } } : p) } }));
  },

  addPlant(plant) {
    set(s => {
      const newPlant: Plant = { ...plant, id: String(s.state.nextPlantId) };
      return { state: { ...s.state, plants: [...s.state.plants, newPlant], nextPlantId: s.state.nextPlantId + 1 }, selectedPlantId: newPlant.id };
    });
    get().saveToStorage();
  },

  updatePlant(id, field, value) {
    set(s => ({ state: { ...s.state, plants: s.state.plants.map(pl => pl.id === id ? { ...pl, [field]: value } : pl) } }));
    get().saveToStorage();
  },

  deletePlant(id) {
    get().pushHistory();
    set(s => ({
      state: {
        ...s.state,
        plants: s.state.plants.filter(pl => pl.id !== id),
        pots: s.state.pots.map(p => String(p.plantId) === String(id) ? { ...p, plantId: '' } : p),
      },
      selectedPlantId: null,
    }));
    get().saveToStorage();
  },

  setView(x, y, scale) { set({ viewX: x, viewY: y, viewScale: scale }); },
  setShowGrid(v)  { set({ showGrid: v }); },
  setAlignMode(v) { set({ alignMode: v }); },
  setMoveMode(v)  { set({ moveMode: v }); },
  selectPot(id)   { set({ selectedPotId: id }); },
  selectBed(id)   { set({ selectedBedId: id }); },
  selectPlant(id) { set({ selectedPlantId: id }); },

  updateAppSetting(key, val) {
    const s = { ...get().appSettings, [key]: val };
    set({ appSettings: s }); saveAppSettings(s);
  },

  updateDisplaySetting(key, val) {
    const ds = { ...get().displaySettings, [key]: val };
    set({ displaySettings: ds }); saveDisplaySettings(ds); applyDisplaySettingsToDom(ds);
  },

  saveCustomColor(slot, hex) {
    const s = { ...get().appSettings };
    const arr = Array.isArray(s.customPotColors) ? [...s.customPotColors] : [];
    arr[slot] = { id: `custom-${slot}`, name: `Custom ${slot + 1}`, hex };
    s.customPotColors = arr;
    set({ appSettings: s }); saveAppSettings(s);
  },

  getPotColors() {
    const customs = getCustomColors();
    return [...COLORS, ...customs.filter((c): c is { id: string; name: string; hex: string } => c !== null)];
  },
}));
