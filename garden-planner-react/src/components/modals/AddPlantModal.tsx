import{useState}from 'react';
import{useGardenStore}from'../../store/gardenStore';
import type{PlantType}from'../../types';
import './AddPlantModal.css';
const T=[{v:'vegetable',l:'🥕 Vegetable'},{v:'herb',l:'🌿 Herb'},{v:'fruit',l:'🍓 Fruit'},{v:'flower',l:'🌸 Flower'},{v:'tree',l:'🌳 Tree/Shrub'},{v:'other',l:'🌱 Other'}];
export function AddPlantModal({onClose}:{onClose:()=>void}){
  const{addPlant}=useGardenStore();
  const[name,setName]=useState('');const[emoji,setEmoji]=useState('');
  const[type,setType]=useState<PlantType>('vegetable');
  const[date,setDate]=useState('');const[notes,setNotes]=useState('');
  function confirm(){if(!name.trim()){alert('Plant needs a name');return;}addPlant({name:name.trim(),emoji:emoji||'🌱',type,datePlanted:date,notes:notes.trim()});onClose();}
  return(<O><div className="add-plant-modal">
    <h2 className="add-plant-modal__title">Add a Plant 🌱</h2>
    <FR label="Name"><input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Cherry Tomatoes"/></FR>
    <FR label="Emoji"><input className="form-input add-plant-modal__emoji" value={emoji} maxLength={4} onChange={e=>setEmoji(e.target.value)} placeholder="🍅"/></FR>
    <FR label="Type"><select className="form-input" value={type} onChange={e=>setType(e.target.value as PlantType)}>{T.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}</select></FR>
    <FR label="Date Planted"><input className="form-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></FR>
    <FR label="Notes"><textarea className="form-input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Watering, variety, notes..."/></FR>
    <div className="add-plant-modal__actions"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={confirm}>Add Plant</button></div>
  </div></O>);
}
function O({children}:{children:React.ReactNode}){return<div className="add-plant-modal__overlay">{children}</div>;}
function FR({label,children}:{label:string;children:React.ReactNode}){return<div className="add-plant-modal__field"><label className="add-plant-modal__label">{label}</label>{children}</div>;}
