import{useState}from 'react';
import{useGardenStore}from'../../store/gardenStore';
import{GARDEN_EMOJIS}from'../../../src/lib/constants';
import './NewGardenModal.css';
export function NewGardenModal({onClose}:{onClose:()=>void}){
  const{createGarden}=useGardenStore();
  const[name,setName]=useState('');const[emoji,setEmoji]=useState('🌿');
  return(<O><div className="new-garden-modal">
    <h2 className="new-garden-modal__title">New Garden 🪴</h2>
    <p className="new-garden-modal__desc">Create a new garden plan.</p>
    <div className="new-garden-modal__field">
      <label className="new-garden-modal__label">Garden Name</label>
      <input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Summer 2025"/>
    </div>
    <div className="new-garden-modal__field">
      <label className="new-garden-modal__label">Icon</label>
      <div className="new-garden-modal__emoji-grid">{GARDEN_EMOJIS.map(e=>(<div key={e} onClick={()=>setEmoji(e)} className={'new-garden-modal__emoji'+(emoji===e?' is-selected':'')}>{e}</div>))}</div>
    </div>
    <div className="new-garden-modal__actions"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={()=>{createGarden(name.trim()||'New Garden',emoji);onClose();}}>Create Garden</button></div>
  </div></O>);
}
function O({children}:{children:React.ReactNode}){return<div className="new-garden-modal__overlay">{children}</div>;}
