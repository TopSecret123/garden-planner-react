import{useState}from 'react';
import{useGardenStore}from'../../store/gardenStore';
import{NewGardenModal}from'../modals/NewGardenModal';
import './GardensTab.css';
export function GardensTab(){
  const{appData,state,switchGarden,deleteGarden,toggleArchiveGarden}=useGardenStore();
  const[showModal,setShowModal]=useState(false);
  return(<div className="gardens-tab">
    <div className="gardens-tab__header">
      <div className="gardens-tab__title">My Gardens</div>
      <button className="btn primary gardens-tab__add" onClick={()=>setShowModal(true)}>+ New Garden</button>
    </div>
    <div className="gardens-tab__list">
      {appData.gardens.map(g=>{
        const isA=g.id===appData.activeGardenId,d=isA?state:g.data,arch=g.status==='archived';
        return(<div key={g.id} onClick={()=>switchGarden(g.id)} className={'gardens-tab__item'+(isA?' is-active':'')+(arch?' is-archived':'')}>
          <div className="gardens-tab__emoji">{g.emoji}{arch?' 🔒':''}</div>
          <div className="gardens-tab__body"><div className="gardens-tab__name">{g.name}{arch?' (archived)':''}</div><div className="gardens-tab__meta">{d.beds?.length??0} beds · {d.pots?.length??0} pots · {g.created??''}</div></div>
          <div className="gardens-tab__actions">
            <button className="btn gardens-tab__icon-btn" onClick={e=>{e.stopPropagation();toggleArchiveGarden(g.id);}} title={arch?'Unarchive':'Archive'}>{arch?'↩':'📦'}</button>
            {appData.gardens.length>1&&<button className="btn gardens-tab__icon-btn is-danger" onClick={e=>{e.stopPropagation();if(confirm('Delete this garden?'))deleteGarden(g.id);}}>✕</button>}
          </div>
        </div>);
      })}
    </div>
    {showModal&&<NewGardenModal onClose={()=>setShowModal(false)}/>}
  </div>);
}
