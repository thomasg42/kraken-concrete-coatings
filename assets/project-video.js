/* Real project clips play quietly in view. The original hero is not targeted. */
(function(){
  'use strict';
  const videos=[...document.querySelectorAll('video[data-project-video]')],buttons=[...document.querySelectorAll('[data-video-motion-toggle]')],visible=new Set(),manual=new Set(),expectedPause=new Set();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),key='kraken-project-video-paused';let paused=false;
  try{paused=localStorage.getItem(key)==='true'}catch{}
  function allowed(){return !paused&&!reduced.matches&&!navigator.connection?.saveData&&!document.hidden;}
  function stop(v){if(!v.paused){expectedPause.add(v);v.pause();}}
  function sync(){buttons.forEach(b=>{b.textContent=paused?'Play video motion':'Pause video motion';b.setAttribute('aria-pressed',String(paused));b.disabled=reduced.matches;});videos.forEach(v=>{if(!allowed()||!visible.has(v))stop(v);else if(!manual.has(v)){v.muted=true;v.play().catch(()=>{});}});}
  if(!('IntersectionObserver'in window))return;
  const io=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting&&e.intersectionRatio>=.25)visible.add(e.target);else visible.delete(e.target);}sync();},{threshold:[0,.25]});
  videos.forEach(v=>{v.muted=true;v.addEventListener('pause',()=>{if(expectedPause.has(v))expectedPause.delete(v);else if(!v.ended)manual.add(v);});v.addEventListener('play',()=>manual.delete(v));io.observe(v);});
  buttons.forEach(b=>b.addEventListener('click',()=>{paused=!paused;if(!paused)manual.clear();try{localStorage.setItem(key,String(paused))}catch{}sync();}));
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);sync();
})();
