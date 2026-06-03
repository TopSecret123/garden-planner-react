import{useState}from 'react';
import{useGardenStore}from'../../store/gardenStore';
import './AssignPlantModal.css';
export function AssignPlantModal({plantId,onClose}:{plantId:string;onClose:()=>void}){
  const{state,updatePot,getPotColors,pushHistory}=useGardenStore();
  const plant=state.plants.find(pl=>String(pl.id)===String(plantId));
  const[potId,setPotId]=useState(state.pots[0]?.id??0);
  const allColors=getPotColors();
  if(!plant) return null;
  function confirm(){pushHistory();updatePot(potId,'plantId',String(plantId));onClose();}
  return(<O><div className="assign-plant-modal">
    <h2 className="assign-plant-modal__title">Assign Plant to Pot</h2>
    <p className="assign-plant-modal__desc">Choose which pot to assign <strong>{plant.emoji||'🌱'} {plant.name}</strong> to.</p>
    <label className="assign-plant-modal__label">Pot</label>
    <select className="form-input" value={potId} onChange={e=>setPotId(+e.target.value)}>
      {state.pots.map(p=>{const col=allColors.find(c=>c.id===p.color)??allColors[0];const curr=state.plants.find(pl=>String(pl.id)===String(p.plantId));return<option key={p.id} value={p.id}>{p.label||col.name}{curr?` (${curr.emoji||'🌱'} ${curr.name})`:' (empty)'}</option>;})}
    </select>
    <div className="assign-plant-modal__actions"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={confirm}>Assign →</button></div>
  </div></O>);
}
function O({children}:{children:React.ReactNode}){return<div className="assign-plant-modal__overlay">{children}</div>;}
