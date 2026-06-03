import { useGardenStore } from '../../store/gardenStore';
import './CanvasBgPicker.css';
const P=[{c:'',s:'#e8e0d0',t:'Default'},{c:'#d4e8d4',s:'#d4e8d4',t:'Sage'},{c:'#e8d4d4',s:'#e8d4d4',t:'Rose'},{c:'#d4d4e8',s:'#d4d4e8',t:'Lavender'},{c:'#f5f5f0',s:'#f5f5f0',t:'Stone'},{c:'#1a1f1a',s:'#1a1f1a',t:'Midnight'}];
export function CanvasBgPicker(){
  const{displaySettings,updateDisplaySetting}=useGardenStore();
  return(<div className="canvas-bg-picker"><div className="canvas-bg-picker__title">Canvas Background</div><div className="canvas-bg-picker__swatches">{P.map(p=>(<div key={p.c} title={p.t} onClick={()=>updateDisplaySetting('canvasBg',p.c)} className={'canvas-bg-picker__swatch'+(displaySettings.canvasBg===p.c?' is-active':'')} style={{'--bg-color':p.s} as React.CSSProperties}/>))}</div><div className="canvas-bg-picker__custom"><input type="color" className="canvas-bg-picker__color-input" value={displaySettings.canvasBg||'#e8e0d0'} onChange={e=>updateDisplaySetting('canvasBg',e.target.value)}/><label className="canvas-bg-picker__custom-label">Custom colour</label></div></div>);
}
