/**
 * useCanvas.ts — Garden Canvas Hook
 *
 * This file does two big things:
 *   1. HANDLES INPUT — mouse, touch, and keyboard events on the canvas
 *   2. DRAWS — renders beds, pots, grid, and overlays onto the canvas
 *
 * It's a custom React hook, meaning it packages up logic you can plug
 * into any component with: const handle = useCanvas(canvasRef, onBedAdded)
 */

import { useRef, useEffect, useCallback } from 'react';
import { useGardenStore } from '../store/gardenStore';
import { isInPoly, isRectBed, edgeLenCm, fmtDim, shoelaceArea } from '../../src/lib/geometry';
import { SOIL_COLORS, COLORS, GRID_SNAP_CM } from '../../src/lib/constants';
import type { Bed, Pot } from '../types';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

/**
 * All the possible "modes" the canvas can be in.
 * Only one mode is active at a time.
 *
 *   none          → idle, just panning
 *   draw_rect     → user clicked "Draw Rectangle" button, waiting for first click
 *   draw_rect_drag→ user is dragging to size the rectangle
 *   draw_poly     → user is clicking to place polygon points
 *   drag_pot      → user is dragging a pot around
 *   drag_bed_point→ user is dragging one corner of a bed
 */
type DrawMode =
  | 'none'
  | 'draw_rect'
  | 'draw_rect_drag'
  | 'draw_poly'
  | 'drag_pot'
  | 'drag_bed_point';

/**
 * These are the functions this hook exposes to the outside world.
 * The parent component calls these to trigger actions.
 */
export interface CanvasHandle {
  startDrawRect: () => void; // activate rectangle draw mode
  startDrawPoly: () => void; // activate polygon draw mode
  cancelDraw:    () => void; // exit any draw mode (also triggered by Escape key)
  zoomIn:        () => void;
  zoomOut:       () => void;
  fitToScreen:   () => void; // zoom/pan so all items are visible
  toggleGrid:    () => void;
}

// ─────────────────────────────────────────────────────────────────
// THE HOOK
// ─────────────────────────────────────────────────────────────────

export function useCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onBedAdded?: () => void, // optional callback when a new bed is finished drawing
): CanvasHandle {

  // ── Store access ──────────────────────────────────────────────
  // We use a ref to the store so event listeners always see fresh data
  // (if we used the hook directly inside event handlers, they'd be stale)
  const storeRef = useRef(useGardenStore.getState());
  useEffect(() => useGardenStore.subscribe(freshState => {
    storeRef.current = freshState;
  }), []);

  // ── Mode & draw state (all refs so they don't trigger re-renders) ──
  const currentMode = useRef<DrawMode>('none');

  // Rectangle drawing
  const rectWorldStart  = useRef<{x:number; y:number} | null>(null); // world coords of first click
  const rectScreenStart = useRef<{x:number; y:number} | null>(null); // screen coords (for overlay div)

  // Polygon drawing — accumulates clicked points
  const polyPoints = useRef<{x:number; y:number}[]>([]);

  // Dragging a pot — offset from pot center to where the user clicked
  const dragOffset = useRef({ x: 0, y: 0 });

  // Panning the canvas
  const isPanning   = useRef(false);
  const panStart    = useRef<{x:number; y:number} | null>(null);

  // Pinch-to-zoom on touch devices
  const lastPinchDistance = useRef<number | null>(null);

  // The dashed rectangle shown while dragging to draw a rect bed
  const rectOverlayDiv = useRef<HTMLDivElement | null>(null);

  // Dragging a bed's corner point
  const draggingBedId       = useRef<number | null>(null);
  const draggingPointIndex  = useRef(-1);
  const dragPointOriginal   = useRef<{x:number; y:number} | null>(null); // position before drag started


  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: HELPER UTILITIES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Convert a mouse/touch event position to canvas-relative pixel coords.
   * (because clientX/Y is relative to the browser window)
   */
  function getCanvasPoint(event: {clientX:number; clientY:number}): {x:number; y:number} {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  /**
   * Convert canvas pixel coords → "world" coords.
   *
   * The canvas has a pan offset (viewX, viewY) and zoom level (viewScale).
   * World coords are what get stored in beds/pots — they don't change when you pan/zoom.
   */
  function canvasToWorld(canvasPoint: {x:number; y:number}) {
    const { viewX, viewY, viewScale } = storeRef.current;
    return {
      x: (canvasPoint.x - viewX) / viewScale,
      y: (canvasPoint.y - viewY) / viewScale,
    };
  }

  /**
   * Snap a world-coordinate value to the nearest grid line.
   * Only applies when the user has grid-snap enabled AND scale is set.
   */
  function snapToGrid(value: number): number {
    const { moveMode, state } = storeRef.current;
    if (moveMode !== 'grid' || !state.pxPerCm) return value; // snap is off
    const snapSizePx = GRID_SNAP_CM * state.pxPerCm;
    return Math.round(value / snapSizePx) * snapSizePx;
  }

  /**
   * Find which pot (if any) is under the given world coordinate.
   * Iterates backwards so items drawn on top get priority.
   * Returns the pot, or null if the click missed everything.
   */
  function getPotAtPosition(worldX: number, worldY: number): Pot | null {
    const { state, viewScale } = storeRef.current;
    const scale = state.pxPerCm ?? 2;

    // Iterate in reverse so topmost-rendered pot is hit first
    for (let i = state.pots.length - 1; i >= 0; i--) {
      const pot = state.pots[i];
      const dx = worldX - pot.position.x;
      const dy = worldY - pot.position.y;
      const potW = pot.width_cm * scale;
      const potH = pot.height_cm * scale;
      const hitSlop = 5 / viewScale; // small tolerance so clicking near the edge works

      if (pot.shape === 'round') {
        // Circle hit test: distance from center ≤ radius
        if (Math.sqrt(dx*dx + dy*dy) <= potW/2 + hitSlop) return pot;
      } else {
        // Rectangle hit test: within bounding box
        if (Math.abs(dx) <= potW/2 + hitSlop && Math.abs(dy) <= potH/2 + hitSlop) return pot;
      }
    }
    return null;
  }

  /**
   * Find which bed corner point (if any) is near the given world coordinate.
   * Returns both the bed and the index of the matching corner, or null.
   */
  function getBedCornerAtPosition(worldX: number, worldY: number): {bed: Bed; idx: number} | null {
    const { state, viewScale } = storeRef.current;
    const hitRadius = 10 / viewScale;

    for (const bed of state.beds) {
      for (let i = 0; i < bed.points.length; i++) {
        const point = bed.points[i];
        const dx = worldX - point.x;
        const dy = worldY - point.y;
        if (Math.sqrt(dx*dx + dy*dy) <= hitRadius) {
          return { bed, idx: i };
        }
      }
    }
    return null;
  }

  /**
   * When dragging a pot, snap it to align with other pots' X or Y positions.
   * This lets you easily line things up without the grid.
   * Only applies when "align mode" is on.
   */
  function applyAlignSnap(x: number, y: number, draggingPotId: number) {
    const { state, alignMode, viewScale } = storeRef.current;
    if (!alignMode || state.pots.length < 2) return { x, y };

    const snapThreshold = 8 / viewScale;
    let snappedX = x, snappedY = y;

    for (const otherPot of state.pots) {
      if (otherPot.id === draggingPotId) continue;
      if (Math.abs(snappedX - otherPot.position.x) < snapThreshold) snappedX = otherPot.position.x;
      if (Math.abs(snappedY - otherPot.position.y) < snapThreshold) snappedY = otherPot.position.y;
    }
    return { x: snappedX, y: snappedY };
  }


  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: RECT OVERLAY DIV
  // (the dashed rectangle shown while dragging to create a bed)
  // ═══════════════════════════════════════════════════════════════

  function createRectOverlay(startPoint: {x:number; y:number}) {
    removeRectOverlay(); // clean up any old one first
    const parentArea = canvasRef.current?.parentElement;
    if (!parentArea) return;

    const div = document.createElement('div');
    div.style.cssText = [
      'position:absolute',
      'border:2px dashed #4a7c59',
      'background:rgba(74,124,89,0.1)',
      'pointer-events:none', // don't intercept mouse events
      'border-radius:3px',
      'z-index:5',
    ].join(';');
    Object.assign(div.style, {
      left:   startPoint.x + 'px',
      top:    startPoint.y + 'px',
      width:  '0',
      height: '0',
    });

    parentArea.appendChild(div);
    rectOverlayDiv.current = div;
  }

  function updateRectOverlay(start: {x:number; y:number}, current: {x:number; y:number}) {
    const div = rectOverlayDiv.current;
    if (!div) return;
    // Use min/max so dragging left/up still works correctly
    Object.assign(div.style, {
      left:   Math.min(start.x, current.x) + 'px',
      top:    Math.min(start.y, current.y) + 'px',
      width:  Math.abs(current.x - start.x) + 'px',
      height: Math.abs(current.y - start.y) + 'px',
    });
  }

  function removeRectOverlay() {
    rectOverlayDiv.current?.remove();
    rectOverlayDiv.current = null;
  }


  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: PANNING
  // ═══════════════════════════════════════════════════════════════

  function startPanning(clientX: number, clientY: number) {
    isPanning.current = true;
    const { viewX, viewY } = storeRef.current;
    // Save how far the cursor is from the current view origin
    // so we can maintain that offset as the user drags
    panStart.current = { x: clientX - viewX, y: clientY - viewY };
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
  }


  // ═══════════════════════════════════════════════════════════════
  // SECTION 4: RENDER FUNCTION
  // Redraws the entire canvas from scratch each frame.
  // Called whenever the store changes.
  // ═══════════════════════════════════════════════════════════════

  // We store the render function in a ref so event listeners can always
  // call the latest version without needing to re-register themselves.
  const renderRef = useRef<() => void>(() => {});

  const render = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const store = storeRef.current;
    const {
      state, viewX, viewY, viewScale,
      showGrid, selectedBedId, selectedPotId,
      alignMode, appSettings, isActiveGardenArchived,
    } = store;

    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply pan + zoom transform so everything draws in world space
    ctx.save();
    ctx.translate(viewX, viewY);
    ctx.scale(viewScale, viewScale);

    // Draw layers from bottom to top
    if (showGrid) drawGrid(ctx, canvas, state, viewX, viewY, viewScale);
    drawAllBeds(ctx, state, selectedBedId, viewScale);
    drawPotsAll(ctx, state, selectedPotId, viewScale, appSettings);

    // Draw the in-progress polygon while the user is placing points
    if (currentMode.current === 'draw_poly' && polyPoints.current.length > 0) {
      const points = polyPoints.current;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.strokeStyle = '#4a7c59';
      ctx.lineWidth = 2 / viewScale;
      ctx.setLineDash([6/viewScale, 3/viewScale]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Draw dots at each placed point
      points.forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4/viewScale, 0, Math.PI * 2);
        ctx.fillStyle = '#4a7c59';
        ctx.fill();
      });
    }

    // Draw alignment guide lines while dragging a pot
    if (alignMode && currentMode.current === 'drag_pot' && selectedPotId) {
      drawAlignmentGuides(ctx, state, selectedPotId, viewX, viewY, canvas, viewScale);
    }

    ctx.restore();

    // Archived banner is drawn in screen space (no transform), always on top
    if (isActiveGardenArchived()) drawArchivedBanner(ctx, canvas);
  }, []);

  // Keep renderRef pointing at the latest render function
  useEffect(() => { renderRef.current = render; });

  // Re-render whenever the store changes (beds moved, pots added, etc.)
  useEffect(() => {
    return useGardenStore.subscribe(() => { renderRef.current(); });
  }, []);

  // Re-render when the browser window is resized

  useEffect(() => {
    const canvas = canvasRef.current!;
    const parent = canvas.parentElement;
    if (!parent) return;
  
    function handleResize() {
      canvas.width  = parent!.clientWidth;
      canvas.height = parent!.clientHeight;
      renderRef.current();
    }
  
    handleResize();
  
    const ro = new ResizeObserver(handleResize);
    ro.observe(parent);
  
    return () => ro.disconnect();
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // SECTION 5: MOUSE EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    const canvas = canvasRef.current!;

    function onMouseDown(e: MouseEvent) {
      // Middle-click or right-click → always pan (never draw)
      if (e.button === 1 || e.button === 2) {
        startPanning(e.clientX, e.clientY);
        return;
      }

      const canvasPoint = getCanvasPoint(e);
      const worldPoint  = canvasToWorld(canvasPoint);
      const store       = storeRef.current;

      // Don't allow edits on archived gardens
      if (store.isActiveGardenArchived()) {
        startPanning(e.clientX, e.clientY);
        return;
      }

      // ── Drawing a rectangle bed ────────────────────────
      if (currentMode.current === 'draw_rect') {
        currentMode.current  = 'draw_rect_drag';
        rectWorldStart.current  = worldPoint;
        rectScreenStart.current = canvasPoint;
        createRectOverlay(canvasPoint);
        return;
      }

      // ── Placing a polygon point ────────────────────────
      if (currentMode.current === 'draw_poly') {
        polyPoints.current.push(worldPoint);
        renderRef.current();
        return;
      }

      // ── Dragging a bed corner ──────────────────────────
      const cornerHit = getBedCornerAtPosition(worldPoint.x, worldPoint.y);
      if (cornerHit) {
        currentMode.current          = 'drag_bed_point';
        draggingBedId.current        = cornerHit.bed.id;
        draggingPointIndex.current   = cornerHit.idx;
        dragPointOriginal.current    = { ...cornerHit.bed.points[cornerHit.idx] };
        store.selectBed(cornerHit.bed.id);
        canvas.style.cursor = 'move';
        renderRef.current();
        return;
      }

      // ── Dragging a pot ─────────────────────────────────
      const pot = getPotAtPosition(worldPoint.x, worldPoint.y);
      if (pot) {
        currentMode.current = 'drag_pot';
        store.selectPot(pot.id);
        dragOffset.current = {
          x: worldPoint.x - pot.position.x,
          y: worldPoint.y - pot.position.y,
        };
        canvas.style.cursor = 'grabbing';
        renderRef.current();
        return;
      }

      // ── Clicking inside a bed (select it + pan) ────────
      for (const bed of store.state.beds) {
        if (bed.points.length >= 3 && isInPoly(worldPoint.x, worldPoint.y, bed.points)) {
          store.selectBed(bed.id);
          renderRef.current();
          startPanning(e.clientX, e.clientY);
          return;
        }
      }

      // ── Clicked empty space → deselect everything + pan ─
      store.selectPot(null);
      store.selectBed(null);
      renderRef.current();
      startPanning(e.clientX, e.clientY);
    }

    function onMouseMove(e: MouseEvent) {
      const canvasPoint = getCanvasPoint(e);
      const worldPoint  = canvasToWorld(canvasPoint);
      const store       = storeRef.current;

      // ── Pan the view ───────────────────────────────────
      if (isPanning.current && panStart.current) {
        store.setView(
          e.clientX - panStart.current.x,
          e.clientY - panStart.current.y,
          store.viewScale,
        );
        return;
      }

      // ── Update the dashed rect overlay while dragging ──
      if (currentMode.current === 'draw_rect_drag' && rectScreenStart.current) {
        updateRectOverlay(rectScreenStart.current, canvasPoint);
        return;
      }

      // ── Move a bed corner ──────────────────────────────
      if (currentMode.current === 'drag_bed_point' && draggingBedId.current !== null) {
        let wx = snapToGrid(worldPoint.x);
        let wy = snapToGrid(worldPoint.y);

        // Hold Shift to lock to horizontal/vertical axis from where you started
        if (e.shiftKey && dragPointOriginal.current) {
          const dxFromOrigin = Math.abs(wx - dragPointOriginal.current.x);
          const dyFromOrigin = Math.abs(wy - dragPointOriginal.current.y);
          if (dxFromOrigin > dyFromOrigin) {
            wy = dragPointOriginal.current.y; // lock to horizontal
          } else {
            wx = dragPointOriginal.current.x; // lock to vertical
          }
        }

        const bed = store.state.beds.find(b => b.id === draggingBedId.current);
        if (bed) {
          const updatedPoints = [...bed.points];
          updatedPoints[draggingPointIndex.current] = { x: wx, y: wy };
          store.updateBed(bed.id, 'points', updatedPoints);
        }
        return;
      }

      // ── Move a pot ─────────────────────────────────────
      if (currentMode.current === 'drag_pot' && store.selectedPotId) {
        let newX = snapToGrid(worldPoint.x - dragOffset.current.x);
        let newY = snapToGrid(worldPoint.y - dragOffset.current.y);
        if (store.alignMode) {
          ({ x: newX, y: newY } = applyAlignSnap(newX, newY, store.selectedPotId));
        }
        store.movePot(store.selectedPotId, newX, newY);
        return;
      }

      // ── Draw preview line from last polygon point to cursor ─
      if (currentMode.current === 'draw_poly' && polyPoints.current.length > 0) {
        renderRef.current(); // redraw clean first
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.save();
        ctx.translate(store.viewX, store.viewY);
        ctx.scale(store.viewScale, store.viewScale);
        const lastPoint = polyPoints.current[polyPoints.current.length - 1];
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(worldPoint.x, worldPoint.y);
        ctx.strokeStyle = '#4a7c59';
        ctx.lineWidth = 1.5 / store.viewScale;
        ctx.setLineDash([4/store.viewScale, 3/store.viewScale]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    function onMouseUp(e: MouseEvent) {
      const store = storeRef.current;

      // ── End panning ────────────────────────────────────
      if (isPanning.current) {
        isPanning.current  = false;
        panStart.current   = null;
        const isDrawMode = currentMode.current === 'draw_rect' || currentMode.current === 'draw_poly';
        canvas.style.cursor = isDrawMode ? 'crosshair' : 'default';
        return;
      }

      // ── Finish dragging a bed corner ───────────────────
      if (currentMode.current === 'drag_bed_point') {
        store.pushHistory();       // save to undo stack
        currentMode.current         = 'none';
        draggingBedId.current       = null;
        draggingPointIndex.current  = -1;
        dragPointOriginal.current   = null;
        canvas.style.cursor = 'default';
        store.saveToStorage();
        return;
      }

      // ── Finish drawing a rectangle bed ─────────────────
      if (currentMode.current === 'draw_rect_drag' && rectWorldStart.current) {
        const canvasPoint = getCanvasPoint(e);
        const worldPoint  = canvasToWorld(canvasPoint);

        const x1 = Math.min(rectWorldStart.current.x, worldPoint.x);
        const y1 = Math.min(rectWorldStart.current.y, worldPoint.y);
        const x2 = Math.max(rectWorldStart.current.x, worldPoint.x);
        const y2 = Math.max(rectWorldStart.current.y, worldPoint.y);

        // Only create if the rect has meaningful size (not an accidental click)
        if (x2 - x1 > 5 && y2 - y1 > 5) {
          store.addBed([
            { x: x1, y: y1 },
            { x: x2, y: y1 },
            { x: x2, y: y2 },
            { x: x1, y: y2 },
          ]);
          onBedAdded?.();
        }

        removeRectOverlay();
        rectWorldStart.current  = null;
        rectScreenStart.current = null;
        currentMode.current     = 'none';
        canvas.style.cursor     = 'default';
        return;
      }

      // ── Finish dragging a pot ──────────────────────────
      if (currentMode.current === 'drag_pot') {
        store.pushHistory();    // save to undo stack
        currentMode.current = 'none';
        canvas.style.cursor = 'default';
        store.saveToStorage();
      }
    }

    /**
     * Double-click closes a polygon and creates the bed.
     * Need at least 3 points to form a valid shape.
     */
    function onDoubleClick() {
      if (currentMode.current === 'draw_poly' && polyPoints.current.length >= 3) {
        storeRef.current.addBed([...polyPoints.current]);
        polyPoints.current  = [];
        currentMode.current = 'none';
        canvas.style.cursor = 'default';
        onBedAdded?.();
      }
    }

    /**
     * Zoom in/out by scrolling.
     * Zooms toward/away from the cursor position.
     */
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const store = storeRef.current;
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1; // scroll down = zoom out
      const rect        = canvas.getBoundingClientRect();
      const cursorOnCanvas = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      // Keep the point under the cursor stationary while zooming
      store.setView(
        cursorOnCanvas.x - (cursorOnCanvas.x - store.viewX) * zoomFactor,
        cursorOnCanvas.y - (cursorOnCanvas.y - store.viewY) * zoomFactor,
        store.viewScale * zoomFactor,
      );
    }

    canvas.addEventListener('mousedown',   onMouseDown);
    canvas.addEventListener('mousemove',   onMouseMove);
    canvas.addEventListener('mouseup',     onMouseUp);
    canvas.addEventListener('dblclick',    onDoubleClick);
    canvas.addEventListener('wheel',       onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault()); // disable right-click menu

    return () => {
      canvas.removeEventListener('mousedown',   onMouseDown);
      canvas.removeEventListener('mousemove',   onMouseMove);
      canvas.removeEventListener('mouseup',     onMouseUp);
      canvas.removeEventListener('dblclick',    onDoubleClick);
      canvas.removeEventListener('wheel',       onWheel);
    };
  }, []);


  // ═══════════════════════════════════════════════════════════════
  // SECTION 6: TOUCH EVENT HANDLERS
  // (separate from mouse because touch has pinch-zoom and no button)
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    const canvas = canvasRef.current!;

    /** Get the distance between two touch points (for pinch zoom) */
    function getTouchPinchDistance(e: TouchEvent): number {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      return Math.sqrt(dx*dx + dy*dy);
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      const store = storeRef.current;

      // Two fingers → start tracking pinch-to-zoom
      if (e.touches.length === 2) {
        lastPinchDistance.current = getTouchPinchDistance(e);
        return;
      }

      // One finger
      const touch = e.touches[0];
      const rect  = canvas.getBoundingClientRect();
      const canvasPoint = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      const worldPoint  = canvasToWorld(canvasPoint);

      if (store.isActiveGardenArchived()) {
        startPanning(touch.clientX, touch.clientY);
        return;
      }

      const pot = getPotAtPosition(worldPoint.x, worldPoint.y);
      if (pot) {
        currentMode.current = 'drag_pot';
        store.selectPot(pot.id);
        dragOffset.current = {
          x: worldPoint.x - pot.position.x,
          y: worldPoint.y - pot.position.y,
        };
      } else {
        startPanning(touch.clientX, touch.clientY);
      }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const store = storeRef.current;

      // ── Pinch zoom ─────────────────────────────────────
      if (e.touches.length === 2 && lastPinchDistance.current !== null) {
        const newDistance  = getTouchPinchDistance(e);
        const zoomFactor   = newDistance / lastPinchDistance.current;
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = canvas.getBoundingClientRect();
        const cx = midX - rect.left;
        const cy = midY - rect.top;
        store.setView(
          cx - (cx - store.viewX) * zoomFactor,
          cy - (cy - store.viewY) * zoomFactor,
          store.viewScale * zoomFactor,
        );
        lastPinchDistance.current = newDistance;
        return;
      }

      // ── Single finger pan or drag ──────────────────────
      const touch = e.touches[0];
      const rect  = canvas.getBoundingClientRect();
      const canvasPoint = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      const worldPoint  = canvasToWorld(canvasPoint);

      if (isPanning.current && panStart.current) {
        store.setView(
          touch.clientX - panStart.current.x,
          touch.clientY - panStart.current.y,
          store.viewScale,
        );
        return;
      }

      if (currentMode.current === 'drag_pot' && store.selectedPotId) {
        let newX = snapToGrid(worldPoint.x - dragOffset.current.x);
        let newY = snapToGrid(worldPoint.y - dragOffset.current.y);
        if (store.alignMode) {
          ({ x: newX, y: newY } = applyAlignSnap(newX, newY, store.selectedPotId));
        }
        store.movePot(store.selectedPotId, newX, newY);
      }
    }

    function onTouchEnd(e: TouchEvent) {
      const store = storeRef.current;
      lastPinchDistance.current = null;

      // All fingers lifted
      if (e.touches.length === 0) {
        if (currentMode.current === 'drag_pot') {
          store.pushHistory();
          currentMode.current = 'none';
          store.saveToStorage();
        }
        isPanning.current  = false;
        panStart.current   = null;
      }
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
    };
  }, []);


  // ═══════════════════════════════════════════════════════════════
  // SECTION 7: KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't intercept keys when the user is typing in a form field
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const store = storeRef.current;

      if (isCtrlOrCmd && e.key === 'z' && !e.shiftKey) { e.preventDefault(); store.undo(); return; }
      if (isCtrlOrCmd && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); store.redo(); return; }
      if (e.key === 'Escape') cancelDraw();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);


  // ═══════════════════════════════════════════════════════════════
  // SECTION 8: ACTIONS (exposed via CanvasHandle)
  // ═══════════════════════════════════════════════════════════════

  function cancelDraw() {
    if (currentMode.current === 'draw_rect_drag') removeRectOverlay();
    polyPoints.current      = [];
    rectWorldStart.current  = null;
    rectScreenStart.current = null;
    currentMode.current     = 'none';
    if (canvasRef.current) canvasRef.current.style.cursor = 'default';
  }

  /** Zoom in or out, keeping the canvas center fixed. */
  function applyZoom(factor: number) {
    const store  = storeRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    store.setView(
      centerX - (centerX - store.viewX) * factor,
      centerY - (centerY - store.viewY) * factor,
      store.viewScale * factor,
    );
  }

  /** Pan and zoom so that all beds and pots are visible. */
  function fitToScreen() {
    const { state } = storeRef.current;
    const canvas    = canvasRef.current;
    if (!canvas) return;

    // Collect every point in the scene
    const allPoints = [
      ...state.beds.flatMap(bed => bed.points),
      ...state.pots.map(pot => pot.position),
    ];

    if (allPoints.length >= 1) {
      const xs = allPoints.map(p => p.x);
      const ys = allPoints.map(p => p.y);
      const left   = Math.min(...xs), right  = Math.max(...xs);
      const top    = Math.min(...ys), bottom = Math.max(...ys);
      const padding = 80;
      const contentW = right  - left || 100;
      const contentH = bottom - top  || 100;

      // Scale so content fills the canvas (but don't zoom in more than 4×)
      const scale = Math.min(
        (canvas.width  - padding * 2) / contentW,
        (canvas.height - padding * 2) / contentH,
        4,
      );
      // Center the content
      storeRef.current.setView(
        (canvas.width  - (left + right)  * scale) / 2,
        (canvas.height - (top  + bottom) * scale) / 2,
        scale,
      );
    } else {
      storeRef.current.setView(100, 100, 1); // nothing to show, reset to origin
    }
  }

  // Return the public API
  return {
    startDrawRect() {
      cancelDraw();
      currentMode.current = 'draw_rect';
      storeRef.current.selectPot(null);
      if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair';
    },
    startDrawPoly() {
      cancelDraw();
      currentMode.current = 'draw_poly';
      polyPoints.current  = [];
      if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair';
    },
    cancelDraw,
    zoomIn:      () => applyZoom(1.2),
    zoomOut:     () => applyZoom(0.83),
    fitToScreen,
    toggleGrid:  () => storeRef.current.setShowGrid(!storeRef.current.showGrid),
  };
}


// ═══════════════════════════════════════════════════════════════════
// DRAWING FUNCTIONS
// These are plain functions (not part of the hook) so they don't
// re-create on every render. They just draw — no side effects.
// ═══════════════════════════════════════════════════════════════════

// Type aliases to avoid repeating long generics
type State       = ReturnType<typeof useGardenStore.getState>['state'];
type AppSettings = ReturnType<typeof useGardenStore.getState>['appSettings'];


/**
 * Draws the background grid of lines.
 *
 * The grid automatically picks a "nice" spacing (10cm, 25cm, 50cm, etc.)
 * so lines don't get too dense or too sparse when zoomed in/out.
 */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: State,
  viewX: number,
  viewY: number,
  viewScale: number,
) {
  const pxPerCm = state.pxPerCm;
  let stepWorldPx: number;
  let stepLabel: string | null;

  if (pxPerCm) {
    // Pick a round number of cm so grid labels are clean
    const niceStepsCm = [10, 25, 50, 100, 200, 500, 1000];
    const targetCm    = (60 / viewScale) * (1 / pxPerCm); // aim for ~60px between lines
    const chosenCm    = niceStepsCm.find(s => s >= targetCm) ?? niceStepsCm[niceStepsCm.length - 1];
    stepWorldPx = chosenCm * pxPerCm;
    stepLabel   = chosenCm >= 100 ? `${chosenCm/100}m` : `${chosenCm}cm`;
  } else {
    // No scale set yet — use a fixed pixel spacing
    stepWorldPx = 80 / viewScale;
    stepLabel   = null;
  }

  // Calculate visible world-space bounds (so we only draw what's on screen)
  const left   = -viewX / viewScale;
  const top    = -viewY / viewScale;
  const right  = (canvas.width  - viewX) / viewScale;
  const bottom = (canvas.height - viewY) / viewScale;

  // Start on a grid-aligned position just off the left/top edge
  const startX = Math.floor(left / stepWorldPx) * stepWorldPx;
  const startY = Math.floor(top  / stepWorldPx) * stepWorldPx;

  // Fine grid lines (lighter)
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth   = 0.5 / viewScale;
  for (let x = startX; x < right  + stepWorldPx; x += stepWorldPx) {
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  }
  for (let y = startY; y < bottom + stepWorldPx; y += stepWorldPx) {
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
  }

  // Major grid lines every 5 steps (darker)
  ctx.strokeStyle = 'rgba(0,0,0,0.13)';
  ctx.lineWidth   = 1 / viewScale;
  for (let x = startX; x < right  + stepWorldPx*5; x += stepWorldPx*5) {
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  }
  for (let y = startY; y < bottom + stepWorldPx*5; y += stepWorldPx*5) {
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
  }

  // Labels along the top-left of each grid column
  if (stepLabel && pxPerCm) {
    ctx.fillStyle    = 'rgba(80,60,30,0.4)';
    ctx.font         = `${11/viewScale}px DM Sans`;
    ctx.textBaseline = 'top';
    for (let x = Math.ceil(left/stepWorldPx)*stepWorldPx; x < right; x += stepWorldPx) {
      const cm = Math.round(x / pxPerCm);
      const label = cm >= 100 ? `${(cm/100).toFixed(cm % 100 === 0 ? 0 : 1)}m` : `${cm}cm`;
      ctx.fillText(label, x + 2/viewScale, top + 2/viewScale);
    }
  } else {
    // Prompt the user to set a scale before the grid makes sense
    ctx.fillStyle    = 'rgba(80,60,30,0.25)';
    ctx.font         = `${12/viewScale}px DM Sans`;
    ctx.textBaseline = 'top';
    ctx.fillText('Draw a garden bed, then set scale →', left + 10/viewScale, top + 10/viewScale);
  }
}


/** Draws all beds in the garden state */
function drawAllBeds(
  ctx: CanvasRenderingContext2D,
  state: State,
  selectedBedId: number | null,
  viewScale: number,
) {
  state.beds.forEach(bed => drawBed(ctx, bed, state, selectedBedId, viewScale));
}


/**
 * Draws one garden bed, including:
 *   - filled soil colour
 *   - soil texture grid overlay
 *   - border / selection highlight
 *   - corner handle dots
 *   - centre label (name or dimensions)
 *   - per-edge dimension labels (when selected)
 */
function drawBed(
  ctx: CanvasRenderingContext2D,
  bed: Bed,
  state: State,
  selectedBedId: number | null,
  viewScale: number,
) {
  if (bed.points.length < 3) return; // can't draw a shape with fewer than 3 points

  const soilColor  = SOIL_COLORS.find(c => c.id === bed.soilColor) ?? SOIL_COLORS[0];
  const isSelected = bed.id === selectedBedId;

  // ── 1. Filled bed shape ───────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bed.points[0].x, bed.points[0].y);
  for (let i = 1; i < bed.points.length; i++) {
    ctx.lineTo(bed.points[i].x, bed.points[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = soilColor.hex;
  ctx.fill();

  // ── 2. Soil texture: subtle grid lines clipped inside shape ──
  ctx.save();
  ctx.clip(); // anything drawn now is clipped to the bed shape
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth   = 0.8 / viewScale;

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

  // ── 3. Border ─────────────────────────────────────────
  // (currently commented out in original — uncomment & edit to re-enable)
  if (isSelected) ctx.setLineDash([6/viewScale, 3/viewScale]);
  ctx.setLineDash([]);
  ctx.restore();

  // ── 4. Corner handle dots ─────────────────────────────
  bed.points.forEach(pt => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, (isSelected ? 6 : 4) / viewScale, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#4a7c59' : '#8b6e4b';
    ctx.fill();
  });

  // ── 5. Centre label ───────────────────────────────────
  const centerX = bed.points.reduce((sum, p) => sum + p.x, 0) / bed.points.length;
  const centerY = bed.points.reduce((sum, p) => sum + p.y, 0) / bed.points.length;
  const displayMode = bed.displayMode ?? 'name';

  if (displayMode !== 'none') {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = 14 / viewScale;
    ctx.font      = `500 ${fontSize}px DM Sans`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';

    if (displayMode === 'name') {
      ctx.fillText(bed.label, 0, 0);

    } else if (displayMode === 'dims' && state.pxPerCm) {
      if (isRectBed(bed)) {
        // Rectangle: "width × height"
        const w = edgeLenCm(bed.points[0], bed.points[1], state.pxPerCm);
        const h = edgeLenCm(bed.points[1], bed.points[2], state.pxPerCm);
        ctx.fillText(`${fmtDim(w)} × ${fmtDim(h)}`, 0, 0);
      } else {
        // Polygon: approximate area in m²
        const areaCm2 = shoelaceArea(bed.points) / (state.pxPerCm * state.pxPerCm);
        ctx.fillText(`~${(areaCm2 / 10000).toFixed(2)}m²`, 0, 0);
      }
    }
    ctx.restore();
  }

  // ── 6. Per-edge dimension labels (only when selected + dims mode) ──
  if (isSelected && displayMode === 'dims' && state.pxPerCm) {
    ctx.save();
    ctx.font         = `${10/viewScale}px DM Sans`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < bed.points.length; i++) {
      const pointA = bed.points[i];
      const pointB = bed.points[(i + 1) % bed.points.length]; // wrap around to first point

      const midX = (pointA.x + pointB.x) / 2;
      const midY = (pointA.y + pointB.y) / 2;
      const len  = edgeLenCm(pointA, pointB, state.pxPerCm);

      // Calculate a perpendicular offset so the label floats beside the edge
      const edgeDx  = pointB.x - pointA.x;
      const edgeDy  = pointB.y - pointA.y;
      const edgeMag = Math.sqrt(edgeDx*edgeDx + edgeDy*edgeDy) || 1;
      const offsetX = (-edgeDy / edgeMag) * 14 / viewScale;
      const offsetY = ( edgeDx / edgeMag) * 14 / viewScale;

      // White pill background behind the label
      const label     = fmtDim(len);
      const textWidth = ctx.measureText(label).width;
      const pad       = 3 / viewScale;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillRect(
        midX + offsetX - textWidth/2 - pad,
        midY + offsetY - 6/viewScale,
        textWidth + pad*2,
        12/viewScale,
      );

      ctx.fillStyle = 'rgba(44,36,22,0.85)';
      ctx.fillText(label, midX + offsetX, midY + offsetY);
    }
    ctx.restore();
  }
}


/**
 * Draws a rounded rectangle path (helper for drawPotsAll).
 * Built-in `roundRect` isn't available in all browsers yet.
 */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
) {
  r = Math.min(r, w/2, h/2); // clamp radius so it fits
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);             ctx.arcTo(x+w, y,   x+w, y+r,   r);
  ctx.lineTo(x + w, y + h - r);         ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x + r, y + h);             ctx.arcTo(x,   y+h, x,   y+h-r, r);
  ctx.lineTo(x, y + r);                 ctx.arcTo(x,   y,   x+r, y,     r);
  ctx.closePath();
}


/**
 * Draws all pots, with visual indicators for:
 *   - selected (dashed green outline)
 *   - out of beds (semi-transparent orange)
 *   - overlapping another pot (red)
 */
function drawPotsAll(
  ctx: CanvasRenderingContext2D,
  state: State,
  selectedPotId: number | null,
  viewScale: number,
  appSettings: AppSettings,
) {
  // Merge built-in colours with any user-defined custom colours
  const allColors = [
    ...COLORS,
    ...(appSettings.customPotColors ?? []).filter(
      (c): c is {id:string; name:string; hex:string} => c !== null,
    ),
  ];

  state.pots.forEach((pot, index) => {
    const color  = allColors.find(c => c.id === pot.color) ?? allColors[0];
    const pxPerCm = state.pxPerCm ?? 2;
    const potW    = pot.width_cm  * pxPerCm;
    const potH    = pot.height_cm * pxPerCm;
    const px      = pot.position.x;
    const py      = pot.position.y;
    const isSelected = pot.id === selectedPotId;

    // Is this pot inside any bed?
    const inAnyBed    = state.beds.some(b => b.points.length >= 3 && isInPoly(px, py, b.points));
    const outOfBounds = state.beds.length >= 1 && !inAnyBed;

    // Is this pot overlapping another pot?
    let isOverlapping = false;
    if (!appSettings.allowOverlap) {
      const marginPx = (appSettings.potMarginCm ?? 0) * pxPerCm;
      for (const otherPot of state.pots) {
        if (otherPot.id === pot.id) continue;
        const dx   = otherPot.position.x - px;
        const dy   = otherPot.position.y - py;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const r1   = Math.max(pot.width_cm,      pot.height_cm)      / 2 * pxPerCm;
        const r2   = Math.max(otherPot.width_cm, otherPot.height_cm) / 2 * pxPerCm;
        if (dist < r1 + r2 + marginPx) { isOverlapping = true; break; }
      }
    }

    // ── Draw pot body ──────────────────────────────────
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(pot.rotation * Math.PI / 180);

    // Drop shadow
    ctx.shadowColor    = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur     = 8 / viewScale;
    ctx.shadowOffsetX  = 2 / viewScale;
    ctx.shadowOffsetY  = 3 / viewScale;

    // Fill: red if overlapping, faded orange if out of bounds, otherwise pot colour
    ctx.beginPath();
    if (pot.shape === 'round') ctx.arc(0, 0, potW/2, 0, Math.PI*2);
    else roundedRect(ctx, -potW/2, -potH/2, potW, potH, Math.min(potW, potH) * 0.12);
    ctx.fillStyle = isOverlapping ? '#e74c3c' : outOfBounds ? 'rgba(193,101,74,0.6)' : color.hex;
    ctx.fill();
    ctx.shadowColor = 'transparent'; // turn off shadow for subsequent strokes

    // Inner shine ring (subtle highlight to suggest depth)
    ctx.beginPath();
    if (pot.shape === 'round') ctx.arc(0, 0, potW/2*0.82, 0, Math.PI*2);
    else roundedRect(ctx, -potW/2*0.88, -potH/2*0.88, potW*0.88, potH*0.88, Math.min(potW,potH)*0.08);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = 1.5 / viewScale;
    ctx.stroke();

    // Outer border (white when selected, dark when not)
    ctx.beginPath();
    if (pot.shape === 'round') ctx.arc(0, 0, potW/2, 0, Math.PI*2);
    else roundedRect(ctx, -potW/2, -potH/2, potW, potH, Math.min(potW,potH)*0.12);
    ctx.strokeStyle = isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.22)';
    ctx.lineWidth   = isSelected ? 2.5/viewScale : 1.5/viewScale;
    ctx.stroke();

    // Dashed green selection ring
    if (isSelected) {
      const pad = 5 / viewScale;
      ctx.beginPath();
      if (pot.shape === 'round') ctx.arc(0, 0, potW/2 + pad, 0, Math.PI*2);
      else roundedRect(ctx, -potW/2-pad, -potH/2-pad, potW+pad*2, potH+pad*2, Math.min(potW,potH)*0.12+pad);
      ctx.strokeStyle = '#4a7c59';
      ctx.lineWidth   = 2 / viewScale;
      ctx.setLineDash([5/viewScale, 3/viewScale]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    // ── Draw pot label & plant emoji ──────────────────
    ctx.save();
    ctx.translate(px, py);
    const fontSize = Math.max(7, Math.min(13, potW * 0.28)) / viewScale;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    const displayMode = pot.displayMode ?? 'name';
    const plant       = state.plants.find(pl => String(pl.id) === String(pot.plantId));

    if (displayMode !== 'none') {
      let labelText = '';
      if      (displayMode === 'name')  labelText = pot.label ?? '';
      else if (displayMode === 'emoji') labelText = pot.emoji ?? '🏺';
      else if (displayMode === 'dims')  labelText = pot.shape === 'round'
        ? `⌀${pot.width_cm}`
        : `${pot.width_cm}×${pot.height_cm}`;

      if (labelText) {
        ctx.font      = `bold ${fontSize}px DM Sans`;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        // Shift up slightly if there's also a plant emoji below
        ctx.fillText(labelText, 0, plant ? -fontSize * 0.65 : 0);
      }
    }

    if (plant) {
      ctx.font      = `${fontSize * 0.9}px DM Sans`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(plant.emoji || '🌱', 0, displayMode === 'none' ? 0 : fontSize * 0.72);
    }

    // ── Small numbered badge (1, 2, 3…) ───────────────
    const badgeRadius = 9 / viewScale;
    const badgeX      = potW/2 * 0.65;
    const badgeY      = -potH/2 * 0.65;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(30,22,10,0.75)';
    ctx.fill();
    ctx.font      = `bold ${7.5/viewScale}px DM Sans`;
    ctx.fillStyle = 'white';
    ctx.fillText(String(index + 1), badgeX, badgeY);

    ctx.restore();
  });
}


/**
 * Draws dotted green guide lines through pots that share the same
 * X or Y coordinate as the pot being dragged — helps with alignment.
 */
function drawAlignmentGuides(
  ctx: CanvasRenderingContext2D,
  state: State,
  selectedPotId: number,
  viewX: number,
  viewY: number,
  canvas: HTMLCanvasElement,
  viewScale: number,
) {
  const draggedPot = state.pots.find(p => p.id === selectedPotId);
  if (!draggedPot) return;

  const snapThreshold = 8 / viewScale;
  const horizontalGuides: number[] = []; // Y positions of matching pots
  const verticalGuides:   number[] = []; // X positions of matching pots

  for (const other of state.pots) {
    if (other.id === draggedPot.id) continue;
    if (Math.abs(draggedPot.position.x - other.position.x) < snapThreshold) verticalGuides.push(other.position.x);
    if (Math.abs(draggedPot.position.y - other.position.y) < snapThreshold) horizontalGuides.push(other.position.y);
  }

  // Lines need to span the full visible area
  const left   = -viewX / viewScale;
  const right  = (canvas.width  - viewX) / viewScale;
  const top    = -viewY / viewScale;
  const bottom = (canvas.height - viewY) / viewScale;

  ctx.save();
  ctx.strokeStyle = 'rgba(74,124,89,0.7)';
  ctx.lineWidth   = 1 / viewScale;
  ctx.setLineDash([4/viewScale, 4/viewScale]);

  horizontalGuides.forEach(y => {
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
  });
  verticalGuides.forEach(x => {
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  });

  ctx.setLineDash([]);
  ctx.restore();
}


/**
 * Draws a semi-transparent amber banner at the bottom of the canvas
 * to remind the user the garden is read-only.
 */
function drawArchivedBanner(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const message  = '🔒  Archived — read only';
  const padding  = 12;
  const height   = 36;
  const bannerY  = canvas.height - height - 12;

  ctx.save();
  ctx.font = '500 13px DM Sans';
  const textWidth = ctx.measureText(message).width;
  const bannerX   = (canvas.width - textWidth - padding*2) / 2; // centred

  ctx.fillStyle = 'rgba(180,130,40,0.92)';
  ctx.beginPath();
  if ((ctx as any).roundRect) {
    (ctx as any).roundRect(bannerX, bannerY, textWidth + padding*2, height, 8);
  } else {
    ctx.rect(bannerX, bannerY, textWidth + padding*2, height);
  }
  ctx.fill();

  ctx.fillStyle    = 'white';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, bannerX + padding, bannerY + height/2);
  ctx.restore();
}