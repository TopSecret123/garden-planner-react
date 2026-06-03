import type { Garden, GardenData, Bed, Point } from '../types';

function migrateOldBeds(data: Record<string, unknown>): Bed[] {
  const lp = data.landPoints as Point[] | undefined;
  if (lp && lp.length >= 3)
    return [{ id: 1, label: 'Garden Bed', points: lp, soilColor: 'loam', displayMode: 'name' }];
  return [];
}

export function migrateGarden(g: Garden): void {
  const d = g.data as GardenData & Record<string, unknown>;
  if (!d.beds)        d.beds        = migrateOldBeds(d as Record<string, unknown>);
  if (!d.plants)      d.plants      = [];
  if (!d.nextBedId)   d.nextBedId   = 10;
  if (!d.nextPlantId) d.nextPlantId = 1;
  if (!g.status)      g.status      = 'active';
  d.pots.forEach(p => {
    if (p.displayMode === undefined) p.displayMode = 'name';
    if (p.emoji       === undefined) p.emoji       = '';
    if (p.plantId     === undefined) p.plantId     = '';
    if (p.notes       === undefined) p.notes       = '';
    if (p.plantId !== '' && p.plantId !== null) p.plantId = String(p.plantId);
  });
  d.plants.forEach(pl => { pl.id = String(pl.id); });
}
