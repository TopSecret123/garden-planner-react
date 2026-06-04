import { useRef, useEffect, useCallback } from 'react';
import { useGardenStore } from '../store/gardenStore';
import { isInPoly, isRectBed, edgeLenCm, fmtDim, shoelaceArea } from '../../src/lib/geometry';
import { SOIL_COLORS, COLORS, GRID_SNAP_CM } from '../../src/lib/constants';
import type { Bed, Pot } from '../types';

type DrawMode = 'none' | 'draw_rect' | 'draw_rect_drag' | 'draw_poly' | 'drag_pot' | 'drag_bed_point';

export interface CanvasHandle {
  startDrawRect: () => void;
  startDrawPoly: () => void;
  cancelDraw:    () => void;
  zoomIn:        () => void;
  zoomOut:       () => void;
  fitToScreen:   () => void;
  toggleGrid:    () => void;
}

export function useCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onBedAdded?: () => void,
): CanvasHandle {
  const storeRef = useRef(useGardenStore.getState());
  useEffect(() => useGardenStore.subscribe(s => { storeRef.current = s; }), []);

  const modeRef             = useRef<DrawMode>('none');
  const drawStartRef        = useRef<{x:number;y:number}|null>(null);
  const drawRectScreenStart = useRef<{x:number;y:number}|null>(null);
  const drawPolyRef         = useRef<{x:number;y:number}[]>([]);
  const dragOffsetRef       = useRef({x:0,y:0});
  const isPanningRef        = useRef(false);
  const panStartRef         = useRef<{x:number;y:number}|null>(null);
  const pinchDistRef        = useRef<number|null>(null);
  const rectOverlayRef      = useRef<HTMLDivElement|null>(null);
  const dragBedIdRef        = useRef<number|null>(null);
  const dragBedPointIdxRef  = useRef(-1);
  const dragBedAnchorRef    = useRef<{x:number;y:number}|null>(null);

  // ── helpers ──────────────────────────────────────────
  function getCP(e: {clientX:number;clientY:number}): {x:number;y:number} {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function toWorld(cp: {x:number;y:number}) {
    const { viewX, viewY, viewScale } = storeRef.current;
    return { x: (cp.x - viewX) / viewScale, y: (cp.y - viewY) / viewScale };
  }
  function snapToGrid(val: number) {
    const { moveMode, state } = storeRef.current;
    if (moveMode !== 'grid' || !state.pxPerCm) return val;
    const snapPx = GRID_SNAP_CM * state.pxPerCm;
    return Math.round(val / snapPx) * snapPx;
  }
  function getPotAt(wx: number, wy: number): Pot | null {
    const { state, viewScale } = storeRef.current;
    const scale = state.pxPerCm ?? 2;
    for (let i = state.pots.length - 1; i >= 0; i--) {
      const pot = state.pots[i];
      const dx = wx - pot.position.x, dy = wy - pot.position.y;
      const pw = pot.width_cm * scale, ph = pot.height_cm * scale;
      if (pot.shape === 'round') { if (Math.sqrt(dx*dx+dy*dy) <= pw/2+5/viewScale) return pot; }
      else { if (Math.abs(dx) <= pw/2+5/viewScale && Math.abs(dy) <= ph/2+5/viewScale) return pot; }
    }
    return null;
  }
  function getBedPointAt(wx: number, wy: number): {bed:Bed;idx:number}|null {
    const { state, viewScale } = storeRef.current;
    const HIT = 10/viewScale;
    for (const bed of state.beds)
      for (let i = 0; i < bed.points.length; i++) {
        const pt = bed.points[i], dx = wx-pt.x, dy = wy-pt.y;
        if (Math.sqrt(dx*dx+dy*dy) <= HIT) return { bed, idx: i };
      }
    return null;
  }
  function alignSnap(x: number, y: number, potId: number) {
    const { state, alignMode, viewScale } = storeRef.current;
    if (!alignMode || state.pots.length < 2) return {x,y};
    const T = 8/viewScale;
    let nx = x, ny = y;
    for (const o of state.pots) {
      if (o.id === potId) continue;
      if (Math.abs(nx - o.position.x) < T) nx = o.position.x;
      if (Math.abs(ny - o.position.y) < T) ny = o.position.y;
    }
    return {x:nx,y:ny};
  }
  function startRectOverlay(cp: {x:number;y:number}) {
    removeRectOverlay();
    const area = canvasRef.current?.parentElement;
    if (!area) return;
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;border:2px dashed #4a7c59;background:rgba(74,124,89,0.1);pointer-events:none;border-radius:3px;z-index:5;';
    Object.assign(d.style, {left:cp.x+'px',top:cp.y+'px',width:'0',height:'0'});
    area.appendChild(d); rectOverlayRef.current = d;
  }
  function updateRectOverlay(s: {x:number;y:number}, c: {x:number;y:number}) {
    const d = rectOverlayRef.current; if (!d) return;
    Object.assign(d.style, {left:Math.min(s.x,c.x)+'px',top:Math.min(s.y,c.y)+'px',width:Math.abs(c.x-s.x)+'px',height:Math.abs(c.y-s.y)+'px'});
  }
  function removeRectOverlay() { rectOverlayRef.current?.remove(); rectOverlayRef.current = null; }
  function startPan(cx: number, cy: number) {
    isPanningRef.current = true;
    const { viewX, viewY } = storeRef.current;
    panStartRef.current = {x: cx-viewX, y: cy-viewY};
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
  }

  // ── render ────────────────────────────────────────────
  const renderRef = useRef<() => void>(() => {});

  const render = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const s = storeRef.current;
    const { state, viewX, viewY, viewScale, showGrid, selectedBedId, selectedPotId, alignMode, appSettings, isActiveGardenArchived } = s;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(viewX, viewY);
    ctx.scale(viewScale, viewScale);

    if (showGrid) drawGrid(ctx, canvas, state, viewX, viewY, viewScale);
    drawAllBeds(ctx, state, selectedBedId, viewScale);
    drawPotsAll(ctx, state, selectedPotId, viewScale, appSettings);
    if (modeRef.current === 'draw_poly' && drawPolyRef.current.length > 0) {
      const poly = drawPolyRef.current;
      ctx.beginPath(); ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.strokeStyle = '#4a7c59'; ctx.lineWidth = 2/viewScale;
      ctx.setLineDash([6/viewScale,3/viewScale]); ctx.stroke(); ctx.setLineDash([]);
      poly.forEach(pt => { ctx.beginPath(); ctx.arc(pt.x,pt.y,4/viewScale,0,Math.PI*2); ctx.fillStyle='#4a7c59'; ctx.fill(); });
    }
    if (alignMode && modeRef.current === 'drag_pot' && selectedPotId)
      drawAlignmentGuides(ctx, state, selectedPotId, viewX, viewY, canvas, viewScale);
    ctx.restore();
    if (isActiveGardenArchived()) drawArchivedBanner(ctx, canvas);
  }, []);

  useEffect(() => { renderRef.current = render; });

  // re-render on store changes
  useEffect(() => {
    return useGardenStore.subscribe(() => { renderRef.current(); });
  }, []);

  // resize
  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current!;
      const area = canvas.parentElement; if (!area) return;
      canvas.width = area.clientWidth; canvas.height = area.clientHeight;
      renderRef.current();
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // mouse
  useEffect(() => {
    const canvas = canvasRef.current!;
    function onMouseDown(e: MouseEvent) {
      if (e.button === 1 || e.button === 2) { startPan(e.clientX, e.clientY); return; }
      const cp = getCP(e), wp = toWorld(cp), s = storeRef.current;
      if (s.isActiveGardenArchived()) { startPan(e.clientX, e.clientY); return; }
      if (modeRef.current === 'draw_rect') {
        modeRef.current = 'draw_rect_drag'; drawStartRef.current = wp;
        drawRectScreenStart.current = cp; startRectOverlay(cp); return;
      }
      if (modeRef.current === 'draw_poly') { drawPolyRef.current.push(wp); renderRef.current(); return; }
      const bpHit = getBedPointAt(wp.x, wp.y);
      if (bpHit) {
        modeRef.current = 'drag_bed_point'; dragBedIdRef.current = bpHit.bed.id;
        dragBedPointIdxRef.current = bpHit.idx; dragBedAnchorRef.current = {...bpHit.bed.points[bpHit.idx]};
        s.selectBed(bpHit.bed.id); canvas.style.cursor = 'move'; renderRef.current(); return;
      }
      const pot = getPotAt(wp.x, wp.y);
      if (pot) {
        modeRef.current = 'drag_pot'; s.selectPot(pot.id);
        dragOffsetRef.current = {x: wp.x-pot.position.x, y: wp.y-pot.position.y};
        canvas.style.cursor = 'grabbing'; renderRef.current(); return;
      }
      for (const bed of s.state.beds) {
        if (bed.points.length >= 3 && isInPoly(wp.x, wp.y, bed.points)) {
          s.selectBed(bed.id); renderRef.current(); startPan(e.clientX, e.clientY); return;
        }
      }
      s.selectPot(null); s.selectBed(null); renderRef.current(); startPan(e.clientX, e.clientY);
    }
    function onMouseMove(e: MouseEvent) {
      const cp = getCP(e), wp = toWorld(cp), s = storeRef.current;
      if (isPanningRef.current && panStartRef.current) {
        s.setView(e.clientX - panStartRef.current.x, e.clientY - panStartRef.current.y, s.viewScale); return;
      }
      if (modeRef.current === 'draw_rect_drag' && drawRectScreenStart.current) {
        updateRectOverlay(drawRectScreenStart.current, cp); return;
      }
      if (modeRef.current === 'drag_bed_point' && dragBedIdRef.current !== null) {
        let wx = snapToGrid(wp.x), wy = snapToGrid(wp.y);
        if (e.shiftKey && dragBedAnchorRef.current) {
          const dx = Math.abs(wx - dragBedAnchorRef.current.x), dy = Math.abs(wy - dragBedAnchorRef.current.y);
          if (dx > dy) wy = dragBedAnchorRef.current.y; else wx = dragBedAnchorRef.current.x;
        }
        const bed = s.state.beds.find(b => b.id === dragBedIdRef.current);
        if (bed) { const pts = [...bed.points]; pts[dragBedPointIdxRef.current] = {x:wx,y:wy}; s.updateBed(bed.id,'points',pts); }
        return;
      }
      if (modeRef.current === 'drag_pot' && s.selectedPotId) {
        let nx = snapToGrid(wp.x - dragOffsetRef.current.x), ny = snapToGrid(wp.y - dragOffsetRef.current.y);
        if (s.alignMode) ({x:nx,y:ny} = alignSnap(nx, ny, s.selectedPotId));
        s.movePot(s.selectedPotId, nx, ny); return;
      }
      if (modeRef.current === 'draw_poly' && drawPolyRef.current.length > 0) {
        renderRef.current();
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        ctx.save(); ctx.translate(s.viewX, s.viewY); ctx.scale(s.viewScale, s.viewScale);
        const last = drawPolyRef.current[drawPolyRef.current.length-1];
        ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(wp.x,wp.y);
        ctx.strokeStyle='#4a7c59'; ctx.lineWidth=1.5/s.viewScale;
        ctx.setLineDash([4/s.viewScale,3/s.viewScale]); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      }
    }
    function onMouseUp(e: MouseEvent) {
      const s = storeRef.current;
      if (isPanningRef.current) {
        isPanningRef.current = false; panStartRef.current = null;
        canvas.style.cursor = (modeRef.current==='draw_rect'||modeRef.current==='draw_poly') ? 'crosshair' : 'default'; return;
      }
      if (modeRef.current === 'drag_bed_point') {
        s.pushHistory(); modeRef.current = 'none'; dragBedIdRef.current = null;
        dragBedPointIdxRef.current = -1; dragBedAnchorRef.current = null;
        canvas.style.cursor = 'default'; s.saveToStorage(); return;
      }
      if (modeRef.current === 'draw_rect_drag' && drawStartRef.current) {
        const cp = getCP(e), wp = toWorld(cp);
        const x1=Math.min(drawStartRef.current.x,wp.x), y1=Math.min(drawStartRef.current.y,wp.y);
        const x2=Math.max(drawStartRef.current.x,wp.x), y2=Math.max(drawStartRef.current.y,wp.y);
        if (x2-x1>5 && y2-y1>5) { s.addBed([{x:x1,y:y1},{x:x2,y:y1},{x:x2,y:y2},{x:x1,y:y2}]); onBedAdded?.(); }
        removeRectOverlay(); drawStartRef.current = null; drawRectScreenStart.current = null;
        modeRef.current = 'none'; canvas.style.cursor = 'default'; return;
      }
      if (modeRef.current === 'drag_pot') {
        s.pushHistory(); modeRef.current = 'none'; canvas.style.cursor = 'default'; s.saveToStorage();
      }
    }
    function onDblClick() {
      if (modeRef.current === 'draw_poly' && drawPolyRef.current.length >= 3) {
        storeRef.current.addBed([...drawPolyRef.current]);
        drawPolyRef.current = []; modeRef.current = 'none';
        canvas.style.cursor = 'default'; onBedAdded?.();
      }
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const s = storeRef.current, d = e.deltaY > 0 ? 0.9 : 1.1;
      const r = canvas.getBoundingClientRect(), cp = {x:e.clientX-r.left, y:e.clientY-r.top};
      s.setView(cp.x-(cp.x-s.viewX)*d, cp.y-(cp.y-s.viewY)*d, s.viewScale*d);
    }
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('wheel', onWheel, {passive:false});
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  // touch
  useEffect(() => {
    const canvas = canvasRef.current!;
    function pinchDist(e: TouchEvent) {
      const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY;
      return Math.sqrt(dx*dx+dy*dy);
    }
    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      const s = storeRef.current;
      if (e.touches.length===2) { pinchDistRef.current=pinchDist(e); return; }
      const t=e.touches[0], r=canvas.getBoundingClientRect();
      const cp={x:t.clientX-r.left,y:t.clientY-r.top}, wp=toWorld(cp);
      if (s.isActiveGardenArchived()) { startPan(t.clientX,t.clientY); return; }
      const pot=getPotAt(wp.x,wp.y);
      if (pot) { modeRef.current='drag_pot'; s.selectPot(pot.id); dragOffsetRef.current={x:wp.x-pot.position.x,y:wp.y-pot.position.y}; }
      else startPan(t.clientX,t.clientY);
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const s=storeRef.current;
      if (e.touches.length===2 && pinchDistRef.current!==null) {
        const nd=pinchDist(e), d=nd/pinchDistRef.current;
        const cx=(e.touches[0].clientX+e.touches[1].clientX)/2, cy=(e.touches[0].clientY+e.touches[1].clientY)/2;
        const r=canvas.getBoundingClientRect();
        s.setView((cx-r.left)-(cx-r.left-s.viewX)*d, (cy-r.top)-(cy-r.top-s.viewY)*d, s.viewScale*d);
        pinchDistRef.current=nd; return;
      }
      const t=e.touches[0], r=canvas.getBoundingClientRect();
      const cp={x:t.clientX-r.left,y:t.clientY-r.top}, wp=toWorld(cp);
      if (isPanningRef.current && panStartRef.current) { s.setView(t.clientX-panStartRef.current.x,t.clientY-panStartRef.current.y,s.viewScale); return; }
      if (modeRef.current==='drag_pot' && s.selectedPotId) {
        let nx=snapToGrid(wp.x-dragOffsetRef.current.x), ny=snapToGrid(wp.y-dragOffsetRef.current.y);
        if (s.alignMode) ({x:nx,y:ny}=alignSnap(nx,ny,s.selectedPotId));
        s.movePot(s.selectedPotId,nx,ny);
      }
    }
    function onTouchEnd(e: TouchEvent) {
      const s=storeRef.current; pinchDistRef.current=null;
      if (e.touches.length===0) {
        if (modeRef.current==='drag_pot') { s.pushHistory(); modeRef.current='none'; s.saveToStorage(); }
        isPanningRef.current=false; panStartRef.current=null;
      }
    }
    canvas.addEventListener('touchstart',onTouchStart,{passive:false});
    canvas.addEventListener('touchmove',onTouchMove,{passive:false});
    canvas.addEventListener('touchend',onTouchEnd);
    return () => {
      canvas.removeEventListener('touchstart',onTouchStart);
      canvas.removeEventListener('touchmove',onTouchMove);
      canvas.removeEventListener('touchend',onTouchEnd);
    };
  }, []);

  // keyboard
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag=(document.activeElement as HTMLElement)?.tagName;
      if (tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') return;
      const ctrl=e.ctrlKey||e.metaKey, s=storeRef.current;
      if (ctrl&&e.key==='z'&&!e.shiftKey) { e.preventDefault(); s.undo(); return; }
      if (ctrl&&(e.key==='y'||(e.key==='z'&&e.shiftKey))) { e.preventDefault(); s.redo(); return; }
      if (e.key==='Escape') cancelDraw();
    }
    window.addEventListener('keydown',onKeyDown);
    return ()=>window.removeEventListener('keydown',onKeyDown);
  }, []);

  function cancelDraw() {
    if (modeRef.current==='draw_rect_drag') removeRectOverlay();
    drawPolyRef.current=[]; drawStartRef.current=null; drawRectScreenStart.current=null;
    modeRef.current='none';
    if (canvasRef.current) canvasRef.current.style.cursor='default';
  }
  function applyZoom(d: number) {
    const s=storeRef.current, canvas=canvasRef.current; if (!canvas) return;
    const cx=canvas.width/2, cy=canvas.height/2;
    s.setView(cx-(cx-s.viewX)*d, cy-(cy-s.viewY)*d, s.viewScale*d);
  }
  function fitToScreen() {
    const { state }=storeRef.current, canvas=canvasRef.current; if (!canvas) return;
    const allPts=[...state.beds.flatMap(b=>b.points),...state.pots.map(p=>p.position)];
    if (allPts.length>=1) {
      const xs=allPts.map(p=>p.x),ys=allPts.map(p=>p.y);
      const lx=Math.min(...xs),rx=Math.max(...xs),ty=Math.min(...ys),by=Math.max(...ys);
      const pad=80, sw=rx-lx||100, sh=by-ty||100;
      const scale=Math.min((canvas.width-pad*2)/sw,(canvas.height-pad*2)/sh,4);
      storeRef.current.setView((canvas.width-(lx+rx)*scale)/2,(canvas.height-(ty+by)*scale)/2,scale);
    } else storeRef.current.setView(100,100,1);
  }

  return {
    startDrawRect() { cancelDraw(); modeRef.current='draw_rect'; storeRef.current.selectPot(null); if(canvasRef.current) canvasRef.current.style.cursor='crosshair'; },
    startDrawPoly() { cancelDraw(); modeRef.current='draw_poly'; drawPolyRef.current=[]; if(canvasRef.current) canvasRef.current.style.cursor='crosshair'; },
    cancelDraw,
    zoomIn:     ()=>applyZoom(1.2),
    zoomOut:    ()=>applyZoom(0.83),
    fitToScreen,
    toggleGrid: ()=>storeRef.current.setShowGrid(!storeRef.current.showGrid),
  };
}

// ── Module-level draw functions ────────────────────────────────────────────────
type State = ReturnType<typeof useGardenStore.getState>['state'];
type AppSettings = ReturnType<typeof useGardenStore.getState>['appSettings'];

function drawGrid(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: State, viewX: number, viewY: number, viewScale: number) {
  const pxPerCm=state.pxPerCm;
  let stepWorldPx: number, stepLabel: string|null;
  if (pxPerCm) {
    const cmSteps=[10,25,50,100,200,500,1000];
    const targetCm=(60/viewScale)*(1/pxPerCm);
    const niceCm=cmSteps.find(s=>s>=targetCm)??cmSteps[cmSteps.length-1];
    stepWorldPx=niceCm*pxPerCm; stepLabel=niceCm>=100?`${niceCm/100}m`:`${niceCm}cm`;
  } else { stepWorldPx=80/viewScale; stepLabel=null; }
  const left=-viewX/viewScale, top=-viewY/viewScale;
  const right=(canvas.width-viewX)/viewScale, bottom=(canvas.height-viewY)/viewScale;
  const startX=Math.floor(left/stepWorldPx)*stepWorldPx, startY=Math.floor(top/stepWorldPx)*stepWorldPx;
  ctx.strokeStyle='rgba(0,0,0,0.07)'; ctx.lineWidth=0.5/viewScale;
  for(let x=startX;x<right+stepWorldPx;x+=stepWorldPx){ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();}
  for(let y=startY;y<bottom+stepWorldPx;y+=stepWorldPx){ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}
  ctx.strokeStyle='rgba(0,0,0,0.13)'; ctx.lineWidth=1/viewScale;
  for(let x=startX;x<right+stepWorldPx*5;x+=stepWorldPx*5){ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();}
  for(let y=startY;y<bottom+stepWorldPx*5;y+=stepWorldPx*5){ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}
  if (stepLabel&&pxPerCm) {
    ctx.fillStyle='rgba(80,60,30,0.4)'; ctx.font=`${11/viewScale}px DM Sans`; ctx.textBaseline='top';
    for(let x=Math.ceil(left/stepWorldPx)*stepWorldPx;x<right;x+=stepWorldPx){
      const cm=Math.round(x/pxPerCm);
      ctx.fillText(cm>=100?`${(cm/100).toFixed(cm%100===0?0:1)}m`:`${cm}cm`,x+2/viewScale,top+2/viewScale);
    }
  } else {
    ctx.fillStyle='rgba(80,60,30,0.25)'; ctx.font=`${12/viewScale}px DM Sans`; ctx.textBaseline='top';
    ctx.fillText('Draw a garden bed, then set scale →',left+10/viewScale,top+10/viewScale);
  }
}

function drawAllBeds(ctx: CanvasRenderingContext2D, state: State, selectedBedId: number|null, viewScale: number) {
  state.beds.forEach(bed => drawBed(ctx, bed, state, selectedBedId, viewScale));
}

function drawBed(
  ctx: CanvasRenderingContext2D,
  bed: Bed,
  state: State,
  selectedBedId: number | null,
  viewScale: number
) {
  // Need at least 3 points to draw a shape
  if (bed.points.length < 3) return;

  const soilColor = SOIL_COLORS.find(c => c.id === bed.soilColor) ?? SOIL_COLORS[0];
  const isSelected = bed.id === selectedBedId;

  // ── 1. Draw filled bed shape ─────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bed.points[0].x, bed.points[0].y);
  for (let i = 1; i < bed.points.length; i++) {
    ctx.lineTo(bed.points[i].x, bed.points[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = soilColor.hex;
  ctx.fill();

  // ── 2. Draw soil texture grid lines (clipped inside bed) ─
  ctx.save();
  ctx.clip(); // restrict drawing to inside the bed shape
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 0.8 / viewScale;

  const xs = bed.points.map(p => p.x);
  const ys = bed.points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  for (let x = minX; x < maxX; x += 18) {
    ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x, maxY); ctx.stroke();
  }
  for (let y = minY; y < maxY; y += 18) {
    ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke();
  }
  ctx.restore(); // end clip

  // ── 3. Draw bed outline border ───────────────────────
  // 🎨 Change '#5c4a35' to remove/change the brown border on unselected beds
  //ctx.strokeStyle = isSelected ? '#4a7c59' : '#5c4a35';
  //ctx.lineWidth = isSelected ? 3 / viewScale : 2.5 / viewScale;
  if (isSelected) ctx.setLineDash([6 / viewScale, 3 / viewScale]); // dashed when selected
  //ctx.stroke();
  ctx.setLineDash([]); // reset dash
  ctx.restore();

  // ── 4. Draw corner handle dots ───────────────────────
  bed.points.forEach(pt => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, (isSelected ? 6 : 4) / viewScale, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#4a7c59' : '#8b6e4b';
    ctx.fill();
  });

  // ── 5. Draw centre label (name or dimensions) ────────
  const centerX = bed.points.reduce((sum, p) => sum + p.x, 0) / bed.points.length;
  const centerY = bed.points.reduce((sum, p) => sum + p.y, 0) / bed.points.length;
  const displayMode = bed.displayMode ?? 'name';

  if (displayMode !== 'none') {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = 14 / viewScale;
    ctx.font = `500 ${fontSize}px DM Sans`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';

    if (displayMode === 'name') {
      ctx.fillText(bed.label, 0, 0);

    } else if (displayMode === 'dims' && state.pxPerCm) {
      if (isRectBed(bed)) {
        // Rectangle: show width × height
        const w = edgeLenCm(bed.points[0], bed.points[1], state.pxPerCm);
        const h = edgeLenCm(bed.points[1], bed.points[2], state.pxPerCm);
        ctx.fillText(`${fmtDim(w)} × ${fmtDim(h)}`, 0, 0);
      } else {
        // Polygon: show approximate area
        const areaCm2 = shoelaceArea(bed.points) / (state.pxPerCm * state.pxPerCm);
        ctx.fillText(`~${(areaCm2 / 10000).toFixed(2)}m²`, 0, 0);
      }
    }
    ctx.restore();
  }

  // ── 6. Draw edge dimension labels (only when selected + dims mode) ──
  if (isSelected && displayMode === 'dims' && state.pxPerCm) {
    ctx.save();
    ctx.font = `${10 / viewScale}px DM Sans`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < bed.points.length; i++) {
      const a = bed.points[i];
      const b = bed.points[(i + 1) % bed.points.length]; // wrap to first point

      // Midpoint of this edge
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;

      const len = edgeLenCm(a, b, state.pxPerCm);

      // Offset label perpendicular to the edge
      const dx = b.x - a.x, dy = b.y - a.y;
      const mag = Math.sqrt(dx * dx + dy * dy) || 1;
      const offsetX = (-dy / mag) * 14 / viewScale;
      const offsetY = (dx / mag) * 14 / viewScale;

      // Draw white pill background behind label
      const label = fmtDim(len);
      const textWidth = ctx.measureText(label).width;
      const pad = 3 / viewScale;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillRect(midX + offsetX - textWidth / 2 - pad, midY + offsetY - 6 / viewScale, textWidth + pad * 2, 12 / viewScale);

      // Draw label text
      ctx.fillStyle = 'rgba(44,36,22,0.85)';
      ctx.fillText(label, midX + offsetX, midY + offsetY);
    }
    ctx.restore();
  }
}

function roundedRect(ctx: CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){
  r=Math.min(r,w/2,h/2);
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}

function drawPotsAll(ctx: CanvasRenderingContext2D, state: State, selectedPotId: number|null, viewScale: number, appSettings: AppSettings) {
  const allColors=[...COLORS,...(appSettings.customPotColors??[]).filter((c): c is {id:string;name:string;hex:string}=>c!==null)];
  state.pots.forEach((pot,idx)=>{
    const col=allColors.find(c=>c.id===pot.color)??allColors[0];
    const pxPerCm=state.pxPerCm??2, pw=pot.width_cm*pxPerCm, ph=pot.height_cm*pxPerCm;
    const px=pot.position.x,py=pot.position.y,sel=pot.id===selectedPotId;
    const inAnyBed=state.beds.some(b=>b.points.length>=3&&isInPoly(px,py,b.points));
    const outOfBounds=state.beds.length>=1&&!inAnyBed;
    let overlapping=false;
    if (!appSettings.allowOverlap) {
      const margin=(appSettings.potMarginCm??0)*pxPerCm;
      for(const o of state.pots){
        if(o.id===pot.id) continue;
        const dx=o.position.x-px,dy=o.position.y-py,dist=Math.sqrt(dx*dx+dy*dy);
        const r1=Math.max(pot.width_cm,pot.height_cm)/2*pxPerCm,r2=Math.max(o.width_cm,o.height_cm)/2*pxPerCm;
        if(dist<r1+r2+margin){overlapping=true;break;}
      }
    }
    ctx.save(); ctx.translate(px,py); ctx.rotate(pot.rotation*Math.PI/180);
    ctx.shadowColor='rgba(0,0,0,0.22)'; ctx.shadowBlur=8/viewScale; ctx.shadowOffsetX=2/viewScale; ctx.shadowOffsetY=3/viewScale;
    ctx.beginPath();
    if(pot.shape==='round') ctx.arc(0,0,pw/2,0,Math.PI*2); else roundedRect(ctx,-pw/2,-ph/2,pw,ph,Math.min(pw,ph)*0.12);
    ctx.fillStyle=overlapping?'#e74c3c':(outOfBounds?'rgba(193,101,74,0.6)':col.hex); ctx.fill(); ctx.shadowColor='transparent';
    ctx.beginPath();
    if(pot.shape==='round') ctx.arc(0,0,pw/2*0.82,0,Math.PI*2); else roundedRect(ctx,-pw/2*0.88,-ph/2*0.88,pw*0.88,ph*0.88,Math.min(pw,ph)*0.08);
    ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1.5/viewScale; ctx.stroke();
    ctx.beginPath();
    if(pot.shape==='round') ctx.arc(0,0,pw/2,0,Math.PI*2); else roundedRect(ctx,-pw/2,-ph/2,pw,ph,Math.min(pw,ph)*0.12);
    ctx.strokeStyle=sel?'rgba(255,255,255,0.9)':'rgba(0,0,0,0.22)'; ctx.lineWidth=sel?2.5/viewScale:1.5/viewScale; ctx.stroke();
    if(sel){
      const pad=5/viewScale; ctx.beginPath();
      if(pot.shape==='round') ctx.arc(0,0,pw/2+pad,0,Math.PI*2); else roundedRect(ctx,-pw/2-pad,-ph/2-pad,pw+pad*2,ph+pad*2,Math.min(pw,ph)*0.12+pad);
      ctx.strokeStyle='#4a7c59'; ctx.lineWidth=2/viewScale; ctx.setLineDash([5/viewScale,3/viewScale]); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
    ctx.save(); ctx.translate(px,py);
    const fontSize=Math.max(7,Math.min(13,pw*0.28))/viewScale;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const dm=pot.displayMode??'name';
    const plant=state.plants.find(pl=>String(pl.id)===String(pot.plantId));
    if(dm!=='none'){
      let t='';
      if(dm==='name') t=pot.label??'';
      else if(dm==='emoji') t=pot.emoji??'🏺';
      else if(dm==='dims') t=pot.shape==='round'?`⌀${pot.width_cm}`:`${pot.width_cm}×${pot.height_cm}`;
      if(t){ ctx.font=`bold ${fontSize}px DM Sans`; ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.fillText(t,0,plant?-fontSize*0.65:0); }
    }
    if(plant){ ctx.font=`${fontSize*0.9}px DM Sans`; ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fillText(plant.emoji||'🌱',0,dm==='none'?0:fontSize*0.72); }
    const br=9/viewScale,bx=pw/2*0.65,by2=-ph/2*0.65;
    ctx.beginPath(); ctx.arc(bx,by2,br,0,Math.PI*2); ctx.fillStyle='rgba(30,22,10,0.75)'; ctx.fill();
    ctx.font=`bold ${7.5/viewScale}px DM Sans`; ctx.fillStyle='white'; ctx.fillText(String(idx+1),bx,by2);
    ctx.restore();
  });
}

function drawAlignmentGuides(ctx: CanvasRenderingContext2D,state: State,selectedPotId: number,viewX: number,viewY: number,canvas: HTMLCanvasElement,viewScale: number){
  const pot=state.pots.find(p=>p.id===selectedPotId); if(!pot) return;
  const T=8/viewScale,hLines: number[]=[],vLines: number[]=[];
  state.pots.forEach(o=>{ if(o.id===pot.id) return; if(Math.abs(pot.position.x-o.position.x)<T) vLines.push(o.position.x); if(Math.abs(pot.position.y-o.position.y)<T) hLines.push(o.position.y); });
  const left=-viewX/viewScale,right=(canvas.width-viewX)/viewScale,top=-viewY/viewScale,bottom=(canvas.height-viewY)/viewScale;
  ctx.save(); ctx.strokeStyle='rgba(74,124,89,0.7)'; ctx.lineWidth=1/viewScale; ctx.setLineDash([4/viewScale,4/viewScale]);
  hLines.forEach(y=>{ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();});
  vLines.forEach(x=>{ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();});
  ctx.setLineDash([]); ctx.restore();
}

function drawArchivedBanner(ctx: CanvasRenderingContext2D,canvas: HTMLCanvasElement){
  const msg='🔒  Archived — read only',pad=12,h=36,y=canvas.height-h-12;
  ctx.save(); ctx.font='500 13px DM Sans';
  const tw=ctx.measureText(msg).width,x=(canvas.width-tw-pad*2)/2;
  ctx.fillStyle='rgba(180,130,40,0.92)';
  ctx.beginPath();
  if ((ctx as any).roundRect) (ctx as any).roundRect(x,y,tw+pad*2,h,8); else ctx.rect(x,y,tw+pad*2,h);
  ctx.fill(); ctx.fillStyle='white'; ctx.textBaseline='middle'; ctx.fillText(msg,x+pad,y+h/2); ctx.restore();
}
