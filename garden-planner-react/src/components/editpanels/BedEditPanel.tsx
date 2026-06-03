import { useGardenStore } from '../../store/gardenStore';
import { SOIL_COLORS } from '../../../src/lib/constants';
import { isRectBed, edgeLenCm } from '../../../src/lib/geometry';
import './BedEditPanel.css';
export function BedEditPanel(){
  const{state,selectedBedId,updateBed,deleteBed,resizeBed}=useGardenStore();
  const bed=state.beds.find(b=>b.id===selectedBedId); if(!bed) return null;
  const showDims=isRectBed(bed)&&!!state.pxPerCm;
  return(
    <div className="bed-edit-panel">
      <div className="bed-edit-panel__title">Edit Bed</div>
      <FR label="Name">
        <input id="bed-name" className="form-input" value={bed.label} 
        onChange={e=>updateBed(bed.id,'label',e.target.value)}/>
      </FR>
      
      {showDims&&state.pxPerCm&&<div className="bed-edit-panel__row">
        <FR label="Width (cm)"><input className="form-input" type="number" min={10} defaultValue={Math.round(edgeLenCm(bed.points[0],bed.points[1],state.pxPerCm))} onBlur={e=>resizeBed(bed.id,+e.target.value,Math.round(edgeLenCm(bed.points[1],bed.points[2],state.pxPerCm!)))}/></FR>
        <FR label="Height (cm)"><input className="form-input" type="number" min={10} defaultValue={Math.round(edgeLenCm(bed.points[1],bed.points[2],state.pxPerCm))} onBlur={e=>resizeBed(bed.id,Math.round(edgeLenCm(bed.points[0],bed.points[1],state.pxPerCm!)),+e.target.value)}/></FR>
      </div>}
      {isRectBed(bed)&&!state.pxPerCm&&<p className="bed-edit-panel__note">Set scale to edit dimensions.</p>}
      <FR label="Soil Colour"><div className="bed-edit-panel__swatches">{SOIL_COLORS.map(c=>(<div key={c.id} title={c.name} onClick={()=>updateBed(bed.id,'soilColor',c.id)} className={'bed-edit-panel__swatch'+(bed.soilColor===c.id?' is-selected':'')} style={{'--swatch-color':c.hex} as React.CSSProperties}/>))}</div></FR>
      <FR label="Display"><div className="bed-edit-panel__modes">{(['name','dims','none'] as const).map(dm=>(<button type="button" key={dm} onClick={()=>updateBed(bed.id,'displayMode',dm)} className={'bed-edit-panel__mode'+(bed.displayMode===dm?' is-active':'')}>{dm[0].toUpperCase()+dm.slice(1)}</button>))}</div></FR>
      <button type="button" className="btn danger bed-edit-panel__delete" onClick={()=>deleteBed(bed.id)}>Delete Bed</button>
    </div>
  );
}
function FR ( {label, children}: {label: string; children: React.ReactNode} ){
  return(
    <div className="bed-edit-panel__field">
      <label className="bed-edit-panel__label">{`${label}`}</label>{children}
    </div>
    );
  }
