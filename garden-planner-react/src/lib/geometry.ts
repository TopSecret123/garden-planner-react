import type { Point, Bed } from '../types';

export function isInPoly(wx: number, wy: number, pts: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (((yi > wy) !== (yj > wy)) && wx < ((xj - xi) * (wy - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

export function isRectBed(bed: Bed): boolean { return bed.points.length === 4; }

export function edgeLenCm(a: Point, b: Point, pxPerCm: number): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy) / pxPerCm;
}

export function fmtDim(cm: number): string {
  if (cm >= 100) return `${(cm / 100).toFixed(2).replace(/\.?0+$/, '')}m`;
  return `${Math.round(cm)}cm`;
}

export function shoelaceArea(pts: Point[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

export function bedDimSummary(bed: Bed, pxPerCm: number | null): string {
  if (!pxPerCm) return `${bed.points.length} points`;
  if (isRectBed(bed)) {
    const w = edgeLenCm(bed.points[0], bed.points[1], pxPerCm);
    const h = edgeLenCm(bed.points[1], bed.points[2], pxPerCm);
    return `${fmtDim(w)} × ${fmtDim(h)}`;
  }
  let perim = 0;
  for (let i = 0; i < bed.points.length; i++)
    perim += edgeLenCm(bed.points[i], bed.points[(i + 1) % bed.points.length], pxPerCm);
  return `${bed.points.length} sides · ${fmtDim(perim)} perim`;
}
