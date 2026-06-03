import{useState}from 'react';
import{useGardenStore}from'../../store/gardenStore';
import{PotEditPanel}from'../editpanels/PotEditPanel';
import{AddPotModal}from'../modals/AddPotModal';
import './PotsTab.css';
export function PotsTab(){
  const{state,selectedPotId,selectPot,deletePot,duplicatePot,getPotColors}=useGardenStore();
  const[search,setSearch]=useState('');const[sortBy,setSortBy]=useState<'index'|'name'|'size'|'plant'>('index');
  const[showAdd,setShowAdd]=useState(false);
  const allColors=getPotColors();
  let pots=[...state.pots];
  if(search){const q=search.toLowerCase();pots=pots.filter(p=>{const pl=state.plants.find(pl=>String(pl.id)===String(p.plantId));return(p.label??'').toLowerCase().includes(q)||(p.notes??'').toLowerCase().includes(q)||(pl?pl.name.toLowerCase().includes(q):false);});}
  if(sortBy==='name') pots.sort((a,b)=>(a.label??'').localeCompare(b.label??''));
  if(sortBy==='size') pots.sort((a,b)=>(b.width_cm*b.height_cm)-(a.width_cm*a.height_cm));
  if(sortBy==='plant') pots.sort((a,b)=>{const pa=state.plants.find(pl=>String(pl.id)===String(a.plantId));const pb=state.plants.find(pl=>String(pl.id)===String(b.plantId));return(pa?.name??'').localeCompare(pb?.name??'');});
  return(<div className="pots-tab">
    <div className="pots-tab__header">
      <div className="pots-tab__title">Pots</div>
      <button className="btn primary pots-tab__add" onClick={()=>setShowAdd(true)}>+ Add Pot</button>
    </div>
    <div className="pots-tab__filters">
      <input className="form-input pots-tab__search" placeholder="🔍 Filter..." value={search} onChange={e=>setSearch(e.target.value)}/>
      <select className="form-input pots-tab__sort" value={sortBy} onChange={e=>setSortBy(e.target.value as typeof sortBy)}><option value="index">Order</option><option value="name">Name</option><option value="size">Size</option><option value="plant">Plant</option></select>
    </div>
    <div className="pots-tab__list">
      {pots.length===0?<E>{state.pots.length===0?'No pots yet. Add your first pot above.':'No pots match your filter.'}</E>:pots.map((p,i)=>{
        const col=allColors.find(c=>c.id===p.color)??allColors[0];
        const plant=state.plants.find(pl=>String(pl.id)===String(p.plantId));
        const sub=[p.shape==='round'?`⌀${p.width_cm}cm`:`${p.width_cm}×${p.height_cm}cm`,plant?`${plant.emoji||'🌱'} ${plant.name}`:''].filter(Boolean).join(' · ');
        return(<div key={p.id} onClick={()=>selectPot(p.id)} className={'pots-tab__item'+(p.id===selectedPotId?' is-selected':'')}>
          <div className={'pots-tab__icon'+(p.shape==='round'?' pots-tab__icon--round':'')+(p.shape==='trough'?' pots-tab__icon--trough':'')} style={{'--pot-color':col.hex} as React.CSSProperties}>{p.emoji||(i+1)}</div>
          <div className="pots-tab__body"><div className="pots-tab__name">{p.label||col.name}</div><div className="pots-tab__sub">{sub}</div></div>
          <div className="pots-tab__actions">
            <button className="btn pots-tab__icon-btn" onClick={e=>{e.stopPropagation();duplicatePot(p.id);}} title="Dup">⧉</button>
            <button className="btn pots-tab__icon-btn is-danger" onClick={e=>{e.stopPropagation();deletePot(p.id);}} title="Del">✕</button>
          </div>
        </div>);
      })}
    </div>
    {selectedPotId!==null&&<PotEditPanel/>}
    {showAdd&&<AddPotModal onClose={()=>setShowAdd(false)}/>}
  </div>);
}
function E({children}:{children:React.ReactNode}){return<div className="pots-tab__empty">{children}</div>;}
