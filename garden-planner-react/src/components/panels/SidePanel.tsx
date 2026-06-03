import{useState}from 'react';
import{BedsTab}from'../tabs/BedsTab';
import{PotsTab}from'../tabs/PotsTab';
import{PlantsTab}from'../tabs/PlantsTab';
import{GardensTab}from'../tabs/GardensTab';
import{SettingsTab}from'../tabs/SettingsTab';
import type{CanvasAreaHandle}from'../Canvas/CanvasArea';
import './SidePanel.css';
type Tab='beds'|'pots'|'plants'|'gardens'|'settings';
interface Props{canvasRef?:React.RefObject<CanvasAreaHandle|null>;}
const TABS=[{id:'beds' as Tab,icon:'🪴',lbl:'Beds'},{id:'pots' as Tab,icon:'🏺',lbl:'Pots'},{id:'plants' as Tab,icon:'🌱',lbl:'Plants'},{id:'gardens' as Tab,icon:'📁',lbl:'Gardens'},{id:'settings' as Tab,icon:'⚙️',lbl:'Settings'}];
export function SidePanel({canvasRef}:Props){
  const[col,setCol]=useState(false);const[tab,setTab]=useState<Tab>('beds');
  return(<div className={'side-panel'+(col?' is-collapsed':'')}>
    <button onClick={()=>setCol(c=>!c)} className="side-panel__collapse">◀</button>
    {!col&&<div className="side-panel__inner">
      <div className="side-panel__tabs">
        {TABS.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} className={'side-panel__tab'+(tab===t.id?' is-active':'')}><span className="side-panel__tab-icon">{t.icon}</span>{t.lbl}</button>))}
      </div>
      <div className="side-panel__content">
        {tab==='beds'&&<BedsTab canvasRef={canvasRef}/>}
        {tab==='pots'&&<PotsTab/>}
        {tab==='plants'&&<PlantsTab/>}
        {tab==='gardens'&&<GardensTab/>}
        {tab==='settings'&&<SettingsTab/>}
      </div>
    </div>}
  </div>);
}
