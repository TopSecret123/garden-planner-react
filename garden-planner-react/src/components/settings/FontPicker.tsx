import { useGardenStore } from '../../store/gardenStore';
import type { AppFont } from '../../types';
import './FontPicker.css';
const F=[{id:'dm-sans' as AppFont,label:'DM Sans',preview:'Clean & modern',family:"'DM Sans',sans-serif"},{id:'playfair' as AppFont,label:'Playfair Display',preview:'Elegant & editorial',family:"'Playfair Display',serif"},{id:'system' as AppFont,label:'System',preview:'Native & fast',family:'system-ui'}];
export function FontPicker(){
  const{displaySettings,updateDisplaySetting}=useGardenStore();
  return(<div className="font-picker"><div className="font-picker__title">Font</div><div className="font-picker__list">{F.map(f=>(<button key={f.id} onClick={()=>updateDisplaySetting('font',f.id)} className={'font-picker__option'+(displaySettings.font===f.id?' is-active':'')} style={{'--font-preview':f.family} as React.CSSProperties}>{f.label}<div className="font-picker__preview">{f.preview}</div></button>))}</div></div>);
}
