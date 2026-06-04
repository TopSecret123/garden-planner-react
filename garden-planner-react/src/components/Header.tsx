import { useGardenStore } from '../store/gardenStore';
import './Header.css';
export function Header() {
  const { history, historyIdx, undo, redo } = useGardenStore();
  function exportData() {
    const { appData } = useGardenStore.getState();
    const blob = new Blob(
      [JSON.stringify(appData,null,2)], 
      {type: 'application/json'} 
    );
    const a = document.createElement('a'); 
    a.href=URL.createObjectURL(blob); 
    a.download='garden-plan.json'; 
    a.click();
  }
  return (
    <header className="app-header">
      <h1 className="app-header__title">🌿 Garden Planner</h1>
      <div className="app-header__actions">
        <button className="btn icon-btn" onClick={undo} disabled={historyIdx<=0} title="Undo">↩</button>
        <button className="btn icon-btn" onClick={redo} disabled={historyIdx>=history.length-1} title="Redo">↪</button>
        <button className="btn" onClick={exportData}>↓ Export</button>
      </div>
    </header>
  );
}
