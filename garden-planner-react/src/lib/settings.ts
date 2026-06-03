import { SETTINGS_KEY, CUSTOM_COLOR_SLOTS, FONT_MAP } from './constants';
import type { AppSettings, DisplaySettings, ColorEntry } from '../types';

export function getAppSettings(): AppSettings {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') || { potMarginCm: 0, allowOverlap: false, customPotColors: [] }; }
  catch { return { potMarginCm: 0, allowOverlap: false, customPotColors: [] }; }
}

export function saveAppSettings(s: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function getCustomColors(): (ColorEntry | null)[] {
  const s = getAppSettings();
  const arr = Array.isArray(s.customPotColors) ? s.customPotColors : [];
  const out: (ColorEntry | null)[] = [];
  for (let i = 0; i < CUSTOM_COLOR_SLOTS; i++) out[i] = arr[i] || null;
  return out;
}

const DS_THEME_KEY     = 'gp_theme';
const DS_FONT_KEY      = 'gp_font';
const DS_CANVAS_BG_KEY = 'gp_canvas_bg';
const DS_RIGHT_KEY     = 'gp_right_collapsed';

export function loadDisplaySettings(): DisplaySettings {
  return {
    theme:               (localStorage.getItem(DS_THEME_KEY)  ?? '') as DisplaySettings['theme'],
    font:                (localStorage.getItem(DS_FONT_KEY)   ?? 'dm-sans') as DisplaySettings['font'],
    canvasBg:             localStorage.getItem(DS_CANVAS_BG_KEY) ?? '',
    rightPanelCollapsed:  localStorage.getItem(DS_RIGHT_KEY)  === '1',
  };
}

export function saveDisplaySettings(ds: DisplaySettings): void {
  localStorage.setItem(DS_THEME_KEY,     ds.theme);
  localStorage.setItem(DS_FONT_KEY,      ds.font);
  localStorage.setItem(DS_CANVAS_BG_KEY, ds.canvasBg);
  localStorage.setItem(DS_RIGHT_KEY,     ds.rightPanelCollapsed ? '1' : '');
}

export function applyDisplaySettingsToDom(ds: DisplaySettings): void {
  document.documentElement.setAttribute('data-theme', ds.theme);
  document.documentElement.style.setProperty('--font-body', FONT_MAP[ds.font] ?? FONT_MAP['dm-sans']);
  if (ds.canvasBg) document.documentElement.style.setProperty('--canvas-bg', ds.canvasBg);
  else             document.documentElement.style.removeProperty('--canvas-bg');
}
