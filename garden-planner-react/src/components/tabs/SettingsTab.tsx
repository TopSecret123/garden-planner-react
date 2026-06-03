import{useState}from 'react';
import{ScaleModal}from'../modals/ScaleModal';
import './SettingsTab.css';
export function SettingsTab(){
  const[showScale,setShowScale]=useState(false);
  return(<div className="settings-tab">
    <div className="settings-tab__section">
      <div className="settings-tab__title">Scale / Calibration</div>
      <button className="btn settings-tab__btn" onClick={()=>setShowScale(true)}>📐 Set Real-World Scale</button>
    </div>
    {showScale&&<ScaleModal onClose={()=>setShowScale(false)}/>}
  </div>);
}
