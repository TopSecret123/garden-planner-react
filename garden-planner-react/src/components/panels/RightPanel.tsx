import { useGardenStore } from '../../store/gardenStore';
import { ThemePicker } from '../settings/ThemePicker';
import { CanvasBgPicker } from '../settings/CanvasBgPicker';
import { FontPicker } from '../settings/FontPicker';
import { DisplayToggles } from '../settings/DisplayToggles';
import type { CanvasAreaHandle } from '../Canvas/CanvasArea';
import './RightPanel.css';
interface Props{canvasRef?:React.RefObject<CanvasAreaHandle|null>;}
export function RightPanel({canvasRef}:Props){
  const{displaySettings,updateDisplaySetting,showGrid,setShowGrid,moveMode,setMoveMode,appSettings,updateAppSetting}=useGardenStore();
  const col=displaySettings.rightPanelCollapsed;
  return(
    <div className={'right-panel'+(col?' is-collapsed':'')}>
      <button onClick={()=>updateDisplaySetting('rightPanelCollapsed',!col)} className="right-panel__collapse">▶</button>
      {!col&&<div className="right-panel__inner">
        <Sec label="Canvas">
          <div className="right-panel__row">
            <button className="btn right-panel__btn" onClick={()=>canvasRef?.current?.fitToScreen()}>⊡ Fit</button>
            <button className={`btn right-panel__btn${showGrid?' active':''}`} onClick={()=>setShowGrid(!showGrid)}>⊞ Grid</button>
          </div>
          <select value={moveMode} onChange={e=>setMoveMode(e.target.value as 'free'|'grid')} className="form-input right-panel__select">
            <option value="free">✤ Free Move</option><option value="grid">⊞ Grid Snap</option>
          </select>
        </Sec>
        <DisplayToggles/>
        <Sec label="Pots">
          <div className="right-panel__field right-panel__field--gap">
            <span className="right-panel__label">Pot margin (cm)</span>
            <input type="number" min={0} max={20} value={appSettings.potMarginCm??0} className="form-input right-panel__num" onChange={e=>updateAppSetting('potMarginCm',parseFloat(e.target.value)||0)}/>
          </div>
          <div className="right-panel__field">
            <span className="right-panel__label">Allow overlap</span>
            <label className="toggle"><input type="checkbox" checked={!!appSettings.allowOverlap} onChange={e=>updateAppSetting('allowOverlap',e.target.checked)}/><span className="toggle-slider"/></label>
          </div>
        </Sec>
        <ThemePicker/><CanvasBgPicker/><FontPicker/>
      </div>}
    </div>
  );
}
function Sec({label,children}:{label:string;children:React.ReactNode}){
  return(<div className="right-panel__section"><div className="right-panel__title">{label}</div>{children}</div>);
}
