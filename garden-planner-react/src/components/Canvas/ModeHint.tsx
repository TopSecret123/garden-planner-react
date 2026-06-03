import { useState, useEffect } from 'react';
import './ModeHint.css';
let _set: ((m:string)=>void)|null=null, _to: ReturnType<typeof setTimeout>|null=null;
export function showHint(msg: string){_set?.(msg);if(_to)clearTimeout(_to);_to=setTimeout(()=>_set?.(''),6000);}
export function ModeHint(){
  const [text,setText]=useState('');
  useEffect(()=>{_set=setText;return()=>{_set=null;};},[] );
  return <div className={'mode-hint'+(text?' is-visible':'')}>{text}</div>;
}
