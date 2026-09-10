(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const route={overview:'overview',visits:'sources',answers:'questions',opportunities:'actions'};
$$('[data-view]').forEach(button=>button.addEventListener('click',()=>{location.href=`app/#${route[button.dataset.view]||'overview'}`;}));
$('.map-replay')?.addEventListener('click',()=>{const path=$('.signal-path');if(!path||reduced)return;const length=path.getTotalLength();path.animate([{strokeDasharray:length,strokeDashoffset:length},{strokeDasharray:length,strokeDashoffset:0}],{duration:650,easing:'cubic-bezier(.22,1,.36,1)'});});
if(!reduced){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;observer.unobserve(entry.target);entry.target.animate([{opacity:.35,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:450,easing:'cubic-bezier(.22,1,.36,1)'});}),{threshold:.15});$$('.portal-visual,.feature-card,.outcome-visual').forEach(el=>observer.observe(el));}
})();
