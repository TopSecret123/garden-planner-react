import{useState}from 'react';
import{useGardenStore}from'../../store/gardenStore';
import{PlantEditPanel}from'../editpanels/PlantEditPanel';
import{AddPlantModal}from'../modals/AddPlantModal';
import{AssignPlantModal}from'../modals/AssignPlantModal';
import './PlantsTab.css';
const TI:Record<string,string>={vegetable:'🥕',herb:'🌿',fruit:'🍓',flower:'🌸',tree:'🌳',other:'🌱'};
export function PlantsTab(){
  const{state,selectedPlantId,selectPlant}=useGardenStore();
  const[showAdd,setShowAdd]=useState(false);const[assignId,setAssignId]=useState<string|null>(null);
  return(<div className="plants-tab">
    <div className="plants-tab__header">
      <div className="plants-tab__title">Plant Library</div>
      <button className="btn primary plants-tab__add" onClick={()=>setShowAdd(true)}>+ Add Plant</button>
    </div>
    <div className="plants-tab__list">
      {state.plants.length===0?<E>No plants yet.<br/>Add plants and assign them to pots.</E>:state.plants.map(pl=>{
        const inPots=state.pots.filter(p=>String(p.plantId)===String(pl.id)).length;
        return(<div key={pl.id} onClick={()=>selectPlant(pl.id)} className={'plants-tab__item'+(pl.id===selectedPlantId?' is-selected':'')}>
          <div className="plants-tab__emoji">{pl.emoji||TI[pl.type]||'🌱'}</div>
          <div className="plants-tab__body"><div className="plants-tab__name">{pl.name}</div><div className="plants-tab__meta">{TI[pl.type]||''} {pl.type}{inPots?` · ${inPots} pot${inPots>1?'s':''}`:''}</div></div>
          <button className="btn plants-tab__assign" onClick={e=>{e.stopPropagation();setAssignId(pl.id);}} title="Assign to pot">🏺</button>
        </div>);
      })}
    </div>
    {selectedPlantId!==null&&<PlantEditPanel/>}
    {showAdd&&<AddPlantModal onClose={()=>setShowAdd(false)}/>}
    {assignId&&<AssignPlantModal plantId={assignId} onClose={()=>setAssignId(null)}/>}
  </div>);
}
function E({children}:{children:React.ReactNode}){return<div className="plants-tab__empty">{children}</div>;}
