import { useGardenStore } from '../../store/gardenStore';
import './PotEditPanel.css';
export function PotEditPanel(){
  const{state,selectedPotId,updatePot,deletePot,duplicatePot,getPotColors}=useGardenStore();
  const pot=state.pots.find(p=>p.id===selectedPotId); if(!pot) return null;
  const allColors=getPotColors(); const isNonRound=pot.shape==='rect'||pot.shape==='trough';
  return(
    <div className="pot-edit-panel">
      <div className="pot-edit-panel__title">Edit Pot</div>
      <FR label="Name"><input className="form-input" value={pot.label??''} onChange={e=>updatePot(pot.id,'label',e.target.value)} placeholder="e.g. Big Terracotta"/></FR>
      <FR label="Emoji"><input className="form-input pot-edit-panel__emoji" value={pot.emoji??''} maxLength={4} onChange={e=>updatePot(pot.id,'emoji',e.target.value)}/></FR>
      <FR label="Display"><div className="pot-edit-panel__modes">{(['name','emoji','dims','none'] as const).map(dm=>(<button type="button" key={dm} onClick={()=>updatePot(pot.id,'displayMode',dm)} className={'pot-edit-panel__mode'+(pot.displayMode===dm?' is-active':'')}>{dm[0].toUpperCase()+dm.slice(1)}</button>))}</div></FR>
      <div className="pot-edit-panel__row">
        <FR label={pot.shape==='round'?'Diameter (cm)':'Width (cm)'}><input className="form-input" type="number" min={5} max={300} value={pot.width_cm} onChange={e=>{updatePot(pot.id,'width_cm',+e.target.value);if(pot.shape==='round'||pot.shape==='square')updatePot(pot.id,'height_cm',+e.target.value);}}/></FR>
        {isNonRound&&<FR label="Length (cm)"><input className="form-input" type="number" min={5} max={300} value={pot.height_cm} onChange={e=>updatePot(pot.id,'height_cm',+e.target.value)}/></FR>}
      </div>
      <FR label="Rotation"><div className="pot-edit-panel__rotation"><input className="pot-edit-panel__range" type="range" min={0} max={360} value={pot.rotation} onChange={e=>updatePot(pot.id,'rotation',+e.target.value)}/><span className="pot-edit-panel__rotation-value">{pot.rotation}°</span></div></FR>
      <FR label="Colour"><div className="pot-edit-panel__swatches">{allColors.map(c=>(<div key={c.id} title={c.name} onClick={()=>updatePot(pot.id,'color',c.id)} className={'pot-edit-panel__swatch'+(pot.color===c.id?' is-selected':'')} style={{'--swatch-color':c.hex} as React.CSSProperties}/>))}</div></FR>
      <FR label="Plant"><select className="form-input" value={pot.plantId??''} onChange={e=>updatePot(pot.id,'plantId',e.target.value)}><option value="">— none —</option>{state.plants.map(pl=><option key={pl.id} value={pl.id}>{pl.emoji||'🌱'} {pl.name}</option>)}</select></FR>
      <FR label="Notes"><textarea className="form-input" value={pot.notes??''} onChange={e=>updatePot(pot.id,'notes',e.target.value)} placeholder="Care notes..."/></FR>
      <div className="pot-edit-panel__actions">
        <button type="button" className="btn pot-edit-panel__action" onClick={()=>duplicatePot(pot.id)}>⧉ Dup</button>
        <button type="button" className="btn danger pot-edit-panel__action" onClick={()=>deletePot(pot.id)}>Delete</button>
      </div>
    </div>
  );
}
function FR({label,children}:{label:string;children:React.ReactNode}){return(<div className="pot-edit-panel__field"><label className="pot-edit-panel__label">{label}</label>{children}</div>);}
