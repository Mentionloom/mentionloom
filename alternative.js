// Reuse the existing waitlist, including keyboard submission from the URL field.
const gapForm = document.querySelector('#gap-form');
gapForm.addEventListener('submit', event => {
  event.preventDefault();
  gapForm.querySelector('[data-join]').click();
});
gapForm.querySelector('[data-join]').addEventListener('click', () => {
  const website = document.querySelector('#scan-url').value.trim();
  if (website) document.querySelector('#website').value = website;
});
// Keep the original interactive components; lead the product preview with questions.
window.addEventListener('load',()=>document.querySelector('[data-story="questions"]')?.click());

// Shared scene data drives the complete chain; no separate simulated live feed.
const connectedScene = document.querySelector('.connected-scene');
const sceneMotion = matchMedia('(prefers-reduced-motion: reduce)');
let sceneAnimations = [];
let latestScene;
let connectedVisible = false;
function renderConnectedScene(detail) {
  latestScene = detail;
  const {item,index,animate} = detail;
  connectedScene.querySelector('.why-copy').textContent = item.evidence;
  connectedScene.querySelector('.evidence-source span').textContent = item.source;
  connectedScene.querySelector('.question-float .card-label > span').textContent = `1 · ${item.city}`;
  connectedScene.querySelector('.answer-float .card-label > span').textContent = `2 · ${({chatgpt:'ChatGPT',claude:'Claude',perplexity:'Perplexity'})[item.engine]} answer`;
  connectedScene.querySelector('.signal-float > span').textContent = 'Review the brief, then recheck the question.';
  connectedScene.querySelectorAll('[data-network-engine]').forEach(node => node.classList.toggle('is-active',node.dataset.networkEngine===item.engine));
  sceneAnimations.forEach(animation=>animation.cancel());
  sceneAnimations=[];
  if (!animate || !connectedVisible || document.hidden || sceneMotion.matches || document.body.classList.contains('reduce-motion')) return;
  const cards=['.question-float','.answer-float','.missing-float','.why-float','.signal-float'].map(selector=>connectedScene.querySelector(selector));
  const pin=connectedScene.querySelector(`[data-globe-question="${index}"]`).getBoundingClientRect();
  // Measure once before writes. Only transforms and opacity are animated.
  const rects=cards.map(card=>card.getBoundingClientRect());
  cards.forEach((card,i)=>{
    const rect=rects[i];
    const origin=i===0 && innerWidth>700 ? `translate(${pin.x-rect.x-rect.width/2}px,${pin.y-rect.y-rect.height/2}px) scale(.7)` : 'translateY(10px) scale(.98)';
    sceneAnimations.push(card.animate([{opacity:0,transform:origin},{opacity:1,transform:'translate(0,0) scale(1)'}],{duration:600,delay:i*400,fill:'backwards',easing:'cubic-bezier(.22,1,.36,1)'}));
  });
  const activeEngine=connectedScene.querySelector('.network-engine.is-active img');
  sceneAnimations.push(activeEngine.animate([{transform:'scale(1)'},{transform:'scale(1.14)'},{transform:'scale(1)'}],{duration:800,delay:180,easing:'ease-in-out'}));
}
document.addEventListener('mentionloom:scene',event=>renderConnectedScene(event.detail));
const connectedObserver=new IntersectionObserver(([entry])=>{
 connectedVisible=entry.isIntersecting;
 if (connectedVisible && latestScene) renderConnectedScene({...latestScene,animate:true});
 else sceneAnimations.forEach(a=>a.finish());
},{threshold:.15});
connectedObserver.observe(connectedScene);
document.addEventListener('visibilitychange',()=>{if(document.hidden)sceneAnimations.forEach(a=>a.finish());});
sceneMotion.addEventListener('change',()=>{if(sceneMotion.matches)sceneAnimations.forEach(a=>a.finish());});
window.addEventListener('pagehide',()=>{connectedObserver.disconnect();sceneAnimations.forEach(a=>a.cancel());});
