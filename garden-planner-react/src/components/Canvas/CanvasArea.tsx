import { useRef, forwardRef, useImperativeHandle } from 'react';
import { useCanvas, type CanvasHandle } from '../../hooks/useCanvas';
import { CanvasToolbar } from './CanvasToolbar';
import { ModeHint } from './ModeHint';
import './CanvasArea.css';
export type CanvasAreaHandle = CanvasHandle;
export const CanvasArea = forwardRef<CanvasAreaHandle>((_,ref)=>{
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const handle=useCanvas(canvasRef);
  useImperativeHandle(ref,()=>handle);
  return(
    <div className="canvas-area">
      <canvas ref={canvasRef} className="canvas-area__canvas"/>
      <CanvasToolbar canvasHandle={handle}/>
      <ModeHint/>
    </div>
  );
});
CanvasArea.displayName='CanvasArea';
