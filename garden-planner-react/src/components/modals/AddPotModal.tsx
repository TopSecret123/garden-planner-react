import{useState,useRef}from 'react';
import{useGardenStore}from'../../store/gardenStore';
import{COLORS}from'../../lib/constants';
import type{PotShape}from'../../types';
import './AddPotModal.css';
const SH=[{id:'round' as PotShape,icon:'⬤',lbl:'Round'},{id:'square' as PotShape,icon:'■',lbl:'Square'},{id:'rect' as PotShape,icon:'▬',lbl:'Rect'},{id:'trough' as PotShape,icon:'▭',lbl:'Trough'}];
export function AddPotModal({onClose}:{onClose:()=>void}){
  const{state,addPot,getPotColors,saveCustomColor}=useGardenStore();
  const[shape,setShape]=useState<PotShape>('round');
  const[diam,setDiam]=useState(30);const[len,setLen]=useState(60);
  const[color,setColor]=useState('terracotta');const[name,setName]=useState('');
  const cRef=useRef<HTMLInputElement>(null),slotRef=useRef<number|null>(null);
  const allColors=getPotColors(),customs=allColors.slice(COLORS.length);
  const isNR=shape==='rect'||shape==='trough';
  function confirm(){
    let cx=400,cy=300;
    if(state.beds.length>0){const b=state.beds[0];const xs=b.points.map(p=>p.x);cx=Math.max(...xs)+80;cy=(Math.min(...b.points.map(p=>p.y))+Math.max(...b.points.map(p=>p.y)))/2;}
    addPot({label:name,emoji:'',shape,width_cm:diam,height_cm:isNR?len:diam,color,position:{x:cx,y:cy},rotation:0,plantId:'',notes:'',displayMode:'name'});
    onClose();
  }
  return(<O><div className="add-pot-modal">
    <h2 className="add-pot-modal__title">Add a Pot</h2>
    <FR label="Shape"><div className="add-pot-modal__shapes">{SH.map(s=>(<button key={s.id} onClick={()=>setShape(s.id)} className={'add-pot-modal__shape'+(shape===s.id?' is-active':'')}><span className="add-pot-modal__shape-icon">{s.icon}</span>{s.lbl}</button>))}</div></FR>
    <div className="add-pot-modal__row"><FR label={shape==='round'?'Diameter (cm)':'Width (cm)'}><input className="form-input" type="number" min={5} max={300} value={diam} onChange={e=>setDiam(+e.target.value)}/></FR>{isNR&&<FR label="Length (cm)"><input className="form-input" type="number" min={5} max={300} value={len} onChange={e=>setLen(+e.target.value)}/></FR>}</div>
    <FR label="Colour"><div className="add-pot-modal__swatches">
      {COLORS.map(c=>(<div key={c.id} title={c.name} onClick={()=>setColor(c.id)} className={'add-pot-modal__swatch'+(color===c.id?' is-selected':'')} style={{'--swatch-color':c.hex} as React.CSSProperties}/>))}
      {Array.from({length:6}).map((_,i)=>{const cc=customs[i];return cc?(<div key={`c${i}`} onClick={()=>setColor(cc.id)} onContextMenu={e=>{e.preventDefault();slotRef.current=i;cRef.current?.click();}} className={'add-pot-modal__swatch'+(color===cc.id?' is-selected':'')} style={{'--swatch-color':cc.hex} as React.CSSProperties}/>):(<div key={`s${i}`} onClick={()=>{slotRef.current=i;cRef.current?.click();}} className="add-pot-modal__swatch-empty">+</div>);})}
      <input ref={cRef} type="color" className="add-pot-modal__color-input" onChange={e=>{if(slotRef.current!==null)saveCustomColor(slotRef.current,e.target.value);}}/>
    </div></FR>
    <FR label="Name (optional)"><input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Herb pot"/></FR>
    <div className="add-pot-modal__actions"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={confirm}>Add to Garden</button></div>
  </div></O>);
}
function O({children}:{children:React.ReactNode}){return<div className="add-pot-modal__overlay">{children}</div>;}
function FR({label,children}:{label:string;children:React.ReactNode}){return<div className="add-pot-modal__field"><label className="add-pot-modal__label">{label}</label>{children}</div>;}
