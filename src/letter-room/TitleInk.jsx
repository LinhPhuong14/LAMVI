import { useCallback, useEffect, useRef, useState } from 'react';
import '@fontsource/dancing-script/vietnamese-400.css';
import '@fontsource/dancing-script/latin-400.css';
import './title-ink.css';
export default function TitleInk({name, active, reduced, onReady}) {
  const [elapsed,setElapsed]=useState(reduced?5600:0), clock=useRef(0), done=useRef(false);
  const title = useRef(null);
  const completed = elapsed >= 5600;
  const publishReady = useCallback(() => {
    if (!active || !completed || done.current) return;
    const moving = title.current?.getAnimations?.().some(a => a.constructor?.name === "CSSTransition" && a.playState === "running");
    if (moving) return;
    done.current = true; onReady();
  }, [active, completed, onReady]);
  useEffect(()=>{
    if(!active || completed) return;
    clock.current=performance.now();
    const timer=setInterval(()=>{const now=performance.now(),delta=now-clock.current;clock.current=now;setElapsed(v=>Math.min(5600,v+delta));},80);
    return ()=>clearInterval(timer);
  },[active,completed]);
  useEffect(() => {publishReady();}, [publishReady]);
  const docked=reduced||elapsed>=4750;
  return <h2 ref={title} onTransitionEnd={publishReady} className={`lr-title-ink ${docked?'is-docked':''}`} style={{animationPlayState:active?'running':'paused'}} aria-label={`Gửi ${name},`}>
    <span className="lr-title-dynamic" aria-hidden="true" style={{animationPlayState:active?'running':'paused'}}>Gửi {name},</span>
  </h2>;
}
