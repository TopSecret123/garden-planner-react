import { useGardenStore } from '../../store/gardenStore';
import './PlantEditPanel.css';
const TYPES=[{v:'vegetable',l:'🥕 Vegetable'},{v:'herb',l:'🌿 Herb'},{v:'fruit',l:'🍓 Fruit'},{v:'flower',l:'🌸 Flower'},{v:'tree',l:'🌳 Tree/Shrub'},{v:'other',l:'🌱 Other'}];
export function PlantEditPanel(){
  const{state,selectedPlantId,updatePlant,deletePlant}=useGardenStore();
  const plant=state.plants.find(pl=>String(pl.id)===String(selectedPlantId)); if(!plant) return null;
  return(
    <div className="plant-edit-panel">
      <div className="plant-edit-panel__title">Edit Plant</div>
      <FR label="Name"><input className="form-input" value={plant.name} onChange={e=>updatePlant(plant.id,'name',e.target.value)}/></FR>
      <FR label="Emoji"><input className="form-input plant-edit-panel__emoji" value={plant.emoji??''} maxLength={4} onChange={e=>updatePlant(plant.id,'emoji',e.target.value)}/></FR>
      <FR label="Type"><select className="form-input" value={plant.type} onChange={e=>updatePlant(plant.id,'type',e.target.value)}>{TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}</select></FR>
      <FR label="Date Planted"><input className="form-input" type="date" value={plant.datePlanted??''} onChange={e=>updatePlant(plant.id,'datePlanted',e.target.value)}/></FR>
      <FR label="Notes"><textarea className="form-input" value={plant.notes??''} onChange={e=>updatePlant(plant.id,'notes',e.target.value)}/></FR>
      <button type="button" className="btn danger plant-edit-panel__delete" onClick={()=>deletePlant(plant.id)}>Delete Plant</button>
    </div>
  );
}
function FR({label,children}:{label:string;children:React.ReactNode}){return(<div className="plant-edit-panel__field"><label className="plant-edit-panel__label">{label}</label>{children}</div>);}
