import type { CanvasHandle } from '../../hooks/useCanvas';
import { useGardenStore } from '../../store/gardenStore';
import './CanvasToolbar.css';
interface Props{canvasHandle:CanvasHandle;}
export function CanvasToolbar({canvasHandle}:Props){
  const{alignMode,setAlignMode}=useGardenStore();
  return(
    <div className="canvas-toolbar">
      <button className="btn icon-btn" onClick={canvasHandle.zoomIn}>＋</button>
      <button className="btn icon-btn" onClick={canvasHandle.zoomOut}>－</button>
      <button className={`btn${alignMode?' active':''}`} onClick={()=>setAlignMode(!alignMode)}>⊟ Align</button>
    </div>
  );
}
