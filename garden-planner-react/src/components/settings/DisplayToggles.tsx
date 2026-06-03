import { useGardenStore } from '../../store/gardenStore';
import './DisplayToggles.css';
export function DisplayToggles(){
  const{showGrid,setShowGrid}=useGardenStore();
  return(<div className="display-toggles"><div className="display-toggles__title">Display</div><div className="display-toggles__row"><span className="display-toggles__label">Grid</span><label className="toggle"><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/><span className="toggle-slider"/></label></div></div>);
}
