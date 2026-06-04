//Questions to answer:
//What is the intent of useEffect here? Why is it used? Why is there no dependncies?
//Explain how the garden store works.
//Explain difference between ref and canvasRef
//Explain what's happening in simple language.

import{useEffect,useRef}from 'react';
import{useGardenStore}from'./store/gardenStore';
import{applyDisplaySettingsToDom}from'./lib/settings';
import{Header}from'./components/Header';
import{SidePanel}from'./components/panels/SidePanel';
import{RightPanel}from'./components/panels/RightPanel';
import{CanvasArea,type CanvasAreaHandle}from'./components/Canvas/CanvasArea';
import'./App.css';

export default function App(){
  const{loadFromStorage, createFirstGarden, loadActiveGarden, displaySettings} = useGardenStore();
  const canvasRef=useRef<CanvasAreaHandle>(null);
  useEffect(()=>{
    applyDisplaySettingsToDom(displaySettings);
    loadFromStorage().then(()=>{
      const{appData} = useGardenStore.getState();
      if(appData.gardens.length===0) createFirstGarden(); else loadActiveGarden();
    });
  },[]);
  return(<>
    <Header/>
    <div className="app-layout">
      <SidePanel canvasRef={canvasRef}/>
      <CanvasArea ref={canvasRef}/>
      <RightPanel canvasRef={canvasRef}/>
    </div>
  </>);
}
