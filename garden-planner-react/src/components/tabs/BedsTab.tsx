import{useGardenStore}from'../../store/gardenStore';
import{BedEditPanel}from'../editpanels/BedEditPanel';
import{SOIL_COLORS}from'../../../src/lib/constants';
import{bedDimSummary}from'../../../src/lib/geometry';
import type{CanvasAreaHandle}from'../Canvas/CanvasArea';
import './BedsTab.css';
interface Props{canvasRef?:React.RefObject<CanvasAreaHandle|null>;}
export function BedsTab({canvasRef}:Props){
  const{state,selectedBedId,selectBed,deleteBed}=useGardenStore();
  return(<div className="beds-tab">
    <div className="beds-tab__header">
      <div className="beds-tab__title">Garden Beds</div>
      <div className="beds-tab__draw">
        <button className="btn" onClick={()=>canvasRef?.current?.startDrawRect()}>▭ Rectangle</button>
        <button className="btn" onClick={()=>canvasRef?.current?.startDrawPoly()}>⬡ Freeform</button>
      </div>
    </div>
    <div className="beds-tab__list">
      {state.beds.length===0?<E>No garden beds yet.<br/>Draw one on the canvas.</E>:state.beds.map(bed=>{
        const sc=SOIL_COLORS.find(c=>c.id===bed.soilColor)??SOIL_COLORS[0];
        return(<div key={bed.id} onClick={()=>selectBed(bed.id)} className={'beds-tab__item'+(bed.id===selectedBedId?' is-selected':'')}>
          <div className="beds-tab__swatch" style={{'--soil-color':sc.hex} as React.CSSProperties}/>
          <div className="beds-tab__body"><div className="beds-tab__name">{bed.label}</div><div className="beds-tab__meta">{bedDimSummary(bed,state.pxPerCm)}</div></div>
          <button className="btn beds-tab__delete" onClick={e=>{e.stopPropagation();deleteBed(bed.id);}}>✕</button>
        </div>);
      })}
    </div>
    {selectedBedId!==null&&<BedEditPanel/>}
  </div>);
}
function E({children}:{children:React.ReactNode}){return<div className="beds-tab__empty">{children}</div>;}
