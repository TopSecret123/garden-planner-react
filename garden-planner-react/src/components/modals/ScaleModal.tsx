import { useState } from 'react';
import { useGardenStore } from '../../store/gardenStore';
import './ScaleModal.css';
export function ScaleModal({onClose}:{onClose:()=>void}){
  const[w,setW]=useState('2');
  function confirm(){
    const m=parseFloat(w); if(!m||m<=0) return;
    const s=useGardenStore.getState();
    if(s.state.beds.length>0){const bed=s.state.beds[0];const xs=bed.points.map(p=>p.x);const lw=Math.max(...xs)-Math.min(...xs);if(lw>0) useGardenStore.setState(st=>({state:{...st.state,pxPerCm:lw/(m*100)}}));}
    else useGardenStore.setState(st=>({state:{...st.state,pxPerCm:8}}));
    useGardenStore.getState().saveToStorage(); onClose();
  }
  return(<Overlay><div className="scale-modal"><h2 className="scale-modal__title">Set Real-World Scale 📐</h2><p className="scale-modal__desc">Draw a garden bed and enter its real width in metres.</p><label className="scale-modal__label">Real width of drawn area (metres)</label><input className="form-input" type="number" min={0.1} max={50} step={0.1} value={w} onChange={e=>setW(e.target.value)}/><div className="scale-modal__actions"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={confirm}>Apply Scale →</button></div></div></Overlay>);
}
function Overlay({children}:{children:React.ReactNode}){return <div className="scale-modal__overlay">{children}</div>;}
