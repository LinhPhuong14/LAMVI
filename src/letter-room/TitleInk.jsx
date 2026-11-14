import { useCallback, useEffect, useRef, useState } from 'react';
import './title-ink.css';
// Original single-line lettering, including Vietnamese marks as separate ink strokes.
const strokes = [
'M59 25C45 9 17 18 13 44C8 73 40 82 57 59L63 43L40 47M59 57C69 68 72 44 75 40',
'M79 40C72 62 74 75 83 66L96 42C87 70 91 75 104 63M98 40Q111 36 107 28',
'M86 26Q94 18 99 24Q103 30 93 33',
'M111 44L106 65Q109 74 120 62M113 31L114 30',
'M171 18C154 5 139 26 147 43C154 60 135 78 128 69C121 57 159 66 176 71',
'M184 44L178 66Q181 74 191 63M186 31L187 30',
'M197 44L190 69L203 48C213 35 218 43 210 60Q204 78 224 62',
'M232 61C245 38 255 15 246 16C234 18 228 53 223 70M229 57C253 33 256 46 248 61Q241 77 262 62',
'M271 68Q278 73 267 82'
];
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
    {name.trim().toLowerCase()==='linh'?<svg viewBox="0 0 290 100" aria-hidden="true" role="presentation">
      {strokes.map((d,i)=><path key={d} d={d} pathLength="1" style={{'--stroke-delay':`${i*.46}s`,'--stroke-time':`${i===0?.85:.55}s`,animationPlayState:active?'running':'paused'}}/>)}
    </svg>:<span className="lr-title-dynamic" aria-hidden="true" style={{animationPlayState:active?'running':'paused'}}>Gửi {name},</span>}
  </h2>;
}
