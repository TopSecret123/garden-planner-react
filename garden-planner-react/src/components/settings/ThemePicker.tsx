import { useGardenStore } from '../../store/gardenStore';
import type { AppTheme } from '../../types';
import './ThemePicker.css';
const THEMES=[{id:'' as AppTheme,label:'Natural',acc:'#4a7c59',bg:'#fdfaf4',text:'#2c2416',brd:'#d4c9b0'},{id:'dark' as AppTheme,label:'Dark',acc:'#5a9e6f',bg:'#222820',text:'#e8f0e8',brd:'#3a4a3a'},{id:'slate' as AppTheme,label:'Slate',acc:'#3d6fa8',bg:'#f8f9fb',text:'#1e2430',brd:'#ccd0d8'},{id:'cream' as AppTheme,label:'Cream',acc:'#a05c2c',bg:'#fffdf9',text:'#3a2e1e',brd:'#e8dece'}];
export function ThemePicker(){
  const{displaySettings,updateDisplaySetting}=useGardenStore();
  return(<RpSection label="Theme"><div className="theme-picker__grid">{THEMES.map(t=>(<button key={t.id} onClick={()=>updateDisplaySetting('theme',t.id)} className={'theme-picker__option'+(displaySettings.theme===t.id?' is-active':'')} style={{'--theme-acc':t.acc,'--theme-bg':t.bg,'--theme-text':t.text,'--theme-brd':t.brd,'--theme-glow':`${t.acc}33`} as React.CSSProperties}><div className="theme-picker__dot"/>{t.label}</button>))}</div></RpSection>);
}
function RpSection({label,children}:{label:string;children:React.ReactNode}){
  return(<div className="theme-picker"><div className="theme-picker__title">{label}</div>{children}</div>);
}
