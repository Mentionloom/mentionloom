/* Orbit motion: progressive enhancement; content never depends on animation. */
(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Set();
  const timers = new WeakMap();
  const ease = 'cubic-bezier(.22, 1, .36, 1)';
  const seen = new WeakSet();
  const observed = new Set();
  function animate(el, frames, duration = 240, extra = {}) {
    if (!el || preference.matches || !el.animate) return null;
    const a = el.animate(frames, {duration, easing: ease, ...extra});
    active.add(a);
    a.finished.catch(() => {}).finally(() => active.delete(a));
    return a;
  }
  preference.addEventListener('change', () => { if (preference.matches) {active.forEach(a => a.cancel());document.querySelectorAll('details[data-motion-target]').forEach(el=>{el.open=el.dataset.motionTarget==='open';delete el.dataset.motionTarget;el.style.overflow=''});} });
  function enter(el, delay = 0) {
    animate(el, [{opacity: 0, transform: 'translateY(6px)'}, {opacity: 1, transform: 'translateY(0)'}], 280, {delay});
  }
  function chart(el) {
    window.OrbitNumbers?.reveal(el);
    el.querySelectorAll('.chart path[stroke]').forEach(p => {
      const length = p.getTotalLength();
      animate(p, [{strokeDasharray: `${length} ${length}`, strokeDashoffset: length}, {strokeDasharray: `${length} ${length}`, strokeDashoffset: 0}], 650);
    });
    el.querySelectorAll('.progress>span').forEach(p => {p.style.transformOrigin = 'left';animate(p, [{transform:'scaleX(0)'},{transform:'scaleX(1)'}], 500)});
    el.querySelectorAll('.ring circle:last-child').forEach(p => animate(p, [{strokeDasharray:'0 220'}, {strokeDasharray:'204 220'}], 650));
    el.querySelectorAll('.funnel').forEach(p => animate(p, [{opacity:0},{opacity:1}], 500));
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(({target,isIntersecting}) => {
      if (!isIntersecting) return;
      observer.unobserve(target);observed.delete(target);
      enter(target);
      chart(target);
    });
  }, {threshold:.08});
  const groups = '.segmented, .dock, .theme-toggle, .view-tabs, .tabs';
  function indicator(group, instant = false, from = null) {
    const selected = group.querySelector('button.active');
    if (!selected || !group.getClientRects().length) return;
    let marker = group.querySelector(':scope > .selection-indicator');
    if (!marker) {
      marker = document.createElement('span');marker.className='selection-indicator';marker.setAttribute('aria-hidden','true');
      group.prepend(marker);group.classList.add('has-indicator');instant=true;
    }
    const previous = from || marker.getBoundingClientRect();
    const box = selected.getBoundingClientRect(), parent = group.getBoundingClientRect();
    marker.getAnimations().forEach(a=>a.cancel());
    Object.assign(marker.style,{left:`${box.left-parent.left-group.clientLeft}px`,top:`${box.top-parent.top-group.clientTop}px`,width:`${box.width}px`,height:`${box.height}px`});
    if (!instant && previous.width && box.width) animate(marker,[{transform:`translate(${previous.left-box.left}px, ${previous.top-box.top}px) scale(${previous.width/box.width}, ${previous.height/box.height})`},{transform:'translate(0,0) scale(1,1)'}],260);
  }
  function prepare(root = document) {
    // Discard detached nodes after search/category replacement.
    observed.forEach(card=>{if(!card.isConnected){observer.unobserve(card);observed.delete(card)}});
    const cards=[...root.querySelectorAll('.specimen, .orbit-component')];
    if(root.matches?.('.specimen, .orbit-component'))cards.push(root);
    cards.forEach(card=>{if(!seen.has(card)){seen.add(card);observed.add(card);observer.observe(card)}});
    root.querySelectorAll(groups).forEach(group => indicator(group,true));
  }
  function refresh() { document.querySelectorAll(groups).forEach(group=>indicator(group,true)); }
  const resize = new ResizeObserver(refresh);
  function start() {
    resize.observe(document.querySelector('.page') || document.body);
    document.fonts.ready.then(refresh);
    enter(document.querySelector('.intro'));
    prepare();
    document.querySelectorAll('dialog').forEach(dialog => {
      dialog.addEventListener('cancel',e => {
        if (e.defaultPrevented || document.querySelector('[data-menu-toggle][aria-expanded="true"]')) return;
        e.preventDefault();closeDialog(dialog);
      });
      dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(dialog)});
    });
  }
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  // Capture old selection geometry; update after the existing action has run.
  document.addEventListener('click', e => {
    const button=e.target.closest('button');if(!button)return;
    const group=button.closest(groups);
    if(group){const previous=group.querySelector('.selection-indicator')?.getBoundingClientRect();requestAnimationFrame(()=>indicator(group,false,previous));}
    if(button.hasAttribute('aria-pressed')&&!group)requestAnimationFrame(()=>animate(button.querySelector('.icon'),[{transform:'scale(.88)'},{transform:'scale(1)'}],200));
  },true);
  function showDialog(dialog) {
    clearTimeout(timers.get(dialog));dialog.classList.remove('is-closing');
    dialog.getAnimations().forEach(a=>a.cancel());
    if(!dialog.open)dialog.showModal();
    animate(dialog,[{opacity:0,transform:'translateY(8px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],280);
    prepare(dialog);
  }
  function closeDialog(dialog) {
    if(!dialog.open||dialog.classList.contains('is-closing'))return;
    if(preference.matches){dialog.close();return}
    dialog.classList.add('is-closing');
    const a=animate(dialog,[{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(4px) scale(.99)'}],140);
    const finish=()=>{dialog.close();dialog.classList.remove('is-closing')};
    if(a)a.finished.then(finish,finish);else finish();
  }
  function visibility(el,visible) {
    clearTimeout(timers.get(el));el.getAnimations().forEach(a=>a.cancel());
    if(visible){el.hidden=false;el.inert=false;if(el.matches('.control-panel,.starter-options,.starter-popover-panel,.row-action-menu')&&el.showPopover){el.setAttribute('popover','manual');if(!el.matches(':popover-open'))el.showPopover()}animate(el,[{opacity:0,translate:'0 4px'},{opacity:1,translate:'0 0'}],200)}
    else {el.inert=true;if(preference.matches){if(el.matches(':popover-open'))el.hidePopover();el.hidden=true;return}animate(el,[{opacity:1,translate:'0 0'},{opacity:0,translate:'0 3px'}],120);timers.set(el,setTimeout(()=>{if(el.matches(':popover-open'))el.hidePopover();el.hidden=true;el.inert=false},120))}
  }
  function panel(el) {el?.getAnimations().forEach(a=>a.cancel());enter(el)}
  function feedback(el, text) {
    if(!el || el.textContent===text)return;
    el.textContent=text;
    panel(el);
  }
  // Preserve row identity, focus, and spatial continuity when a list changes order.
  function rearrange(container, update) {
    const before=new Map([...container.children].map(el=>[el,el.getBoundingClientRect()]));
    update();
    [...container.children].forEach(el=>{
      const from=before.get(el),to=el.getBoundingClientRect();
      el.getAnimations().forEach(a=>a.cancel());
      if(from){const x=from.left-to.left,y=from.top-to.top;if(x||y)animate(el,[{transform:`translate(${x}px,${y}px)`},{transform:'translate(0,0)'}],280);}
      else enter(el);
    });
  }
  async function remove(el) {
    if(!el || el.dataset.removing)return;
    el.dataset.removing='true';el.inert=true;
    const parent=el.parentElement;
    const a=animate(el,[{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(10px)'}],140);
    if(a)await a.finished.catch(()=>{});
    if(parent)rearrange(parent,()=>el.remove());
  }
  function replay() {
    document.querySelectorAll('.specimen, .orbit-component').forEach(el=>{const r=el.getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0){enter(el);chart(el)}});
  }
  // Native disclosure semantics are preserved during an interruptible height transition.
  document.addEventListener('click',e=>{
    const summary=e.target.closest('summary');if(!summary||preference.matches||e.target.closest('button,a,input')||summary.parentElement.matches('.column-picker'))return;
    const details=summary.parentElement;e.preventDefault();
    const from=details.getBoundingClientRect().height;
    const opening=details.dataset.motionTarget ? details.dataset.motionTarget!=='open' : !details.open;
    details.getAnimations().forEach(a=>a.cancel());details.open=true;
    details.dataset.motionTarget=opening?'open':'closed';
    const style=getComputedStyle(details);
    const to=opening?details.scrollHeight+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth):summary.getBoundingClientRect().height+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
    details.style.overflow='hidden';
    const a=animate(details,[{height:`${from}px`},{height:`${to}px`}],240);
    if(a)a.finished.then(()=>{details.open=opening;delete details.dataset.motionTarget;details.style.overflow=''},()=>{});
  });
  function settleAncestors(el){for(let node=el.parentElement;node&&node!==document.body;node=node.parentElement){node.getAnimations().forEach(a=>{if(a.effect?.getKeyframes().some(k=>k.transform||k.translate)){try{a.finish()}catch{a.cancel()}}})}}
  window.OrbitMotion={settleAncestors,prepare,panel,showDialog,closeDialog,visibility,replay,animate,indicator,enter,feedback,rearrange,remove};
})();
