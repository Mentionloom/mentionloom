/* Stable numeric labels with masked, individually rolling digits. */
(() => {
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'), values=new WeakMap(),visible=new Set(),initialized=new WeakSet();
 const format=(value,kind)=>new Intl.NumberFormat('en-US',kind==='percent'?{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}:kind==='currency'?{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}:{}).format(value);
 function set(el,value,{kind=el.dataset.format||'number',initial=false,duration=null}={}) {
  if(!el)return;
  const kindChanged=el.dataset.numberKind&&el.dataset.numberKind!==kind;el.dataset.numberKind=kind;
  const next=format(value,kind),previous=initial?'0':(values.get(el)||el.textContent.trim());
  if(!initial&&next===previous&&el.classList.contains('rolling-number'))return;
  const old=[...previous].reverse();values.set(el,next);el.dataset.value=value;
  el.classList.add('rolling-number');el.setAttribute('aria-label',next);el.setAttribute('role','img');
  el.getAnimations({subtree:true}).forEach(a=>a.cancel());el.replaceChildren();
  [...next].forEach((character,index)=>{
   const digit=document.createElement('span');digit.setAttribute('aria-hidden','true');
   if(!/\d/.test(character)){digit.className='number-punctuation';digit.textContent=character;el.append(digit);return}
   digit.className='number-digit';const oldCharacter=old[next.length-1-index];
   const from=/\d/.test(oldCharacter||'')?Number(oldCharacter):0,to=Number(character);
   if(reduced.matches||from===to){digit.textContent=character;el.append(digit);return}
   const track=document.createElement('span');track.className='number-track';
   const direction=Number(value)>=Number(el.dataset.previous||0)?1:-1;
   const steps=direction>0?(to-from+10)%10:(from-to+10)%10;
   const digits=Array.from({length:steps+1},(_,n)=>(from+direction*n+100)%10);
   if(direction<0)digits.reverse();
   digits.forEach(n=>{const cell=document.createElement('span');cell.textContent=n;track.append(cell)});
   const distance=steps*1.2;track.style.transform=`translateY(${direction>0?-distance:0}em)`;digit.append(track);el.append(digit);
   const rollDuration=duration??(initial?800:650);
   OrbitMotion.animate(track,[{transform:`translateY(${direction>0?0:-distance}em)`},{transform:`translateY(${direction>0?-distance:0}em)`}],rollDuration,{delay:initial?index*24:0});
  });
  el.dataset.previous=value;
  if(kindChanged)OrbitMotion.animate(el,[{opacity:0,translate:'0 5px'},{opacity:1,translate:'0 0'}],150);
 }
 const countries=[['🇺🇸','United States',1823,4680],['🇬🇧','United Kingdom',672,2180],['🇩🇪','Germany',521,1290],['🇫🇷','France',398,0],['🇨🇦','Canada',312,0],['🇦🇺','Australia',245,0],['🇳🇱','Netherlands',176,0]];
 const sources=[['search','Search',2341,5280],['arrow','Direct',1892,3600],['chat','Social',743,1490],['code','Referral',521,790],['type','Newsletter',412,0],['layers','Campaign',298,0],['smile','Community',187,0]];
 function rowValue(row,initial=false){const revenue=row.matches(':hover')||row.contains(document.activeElement)||row.closest('[data-attribution]').dataset.metric==='revenue';row.classList.toggle('show-revenue',revenue);set(row.querySelector('[data-row-value]'),Number(row.dataset[revenue?'revenue':'people']),{kind:revenue?'currency':'number',initial});}
 function build(table,initial=true){
  const type=table.dataset.dimension||'countries',step=Number(table.dataset.tick||0),data=type==='countries'?countries:sources;
  const maxPeople=data[0][2]+step*37,maxRevenue=data[0][3]+step*80;
  const tbody=table.querySelector('tbody');
  if(tbody.dataset.dimension!==type){tbody.innerHTML=data.map((r,i)=>`<tr data-ranked-row><th scope="row"><span class="rank-bars" aria-hidden="true"><span class="traffic-bar"></span><span class="revenue-bar"></span></span><button class="rank-name" aria-label="Show revenue for ${r[1]}"><span class="source-symbol">${type==='countries'?r[0]:icon(r[0])}</span><span>${r[1]}</span></button></th><td><span data-row-value>0</span></td></tr>`).join('');tbody.dataset.dimension=type;initial=true;}
  tbody.querySelectorAll('tr').forEach((row,i)=>{const dataRow=data[i],people=dataRow[2]+step*(37-i*4),revenue=dataRow[3]?(dataRow[3]+step*(80-i*9)):0;
   row.dataset.people=people;row.dataset.revenue=revenue;
   const traffic=(people/maxPeople)*50,sales=(revenue/maxRevenue)*50;
   row.style.setProperty('--traffic-share',`${traffic}%`);row.style.setProperty('--revenue-share',`${sales}%`);
   if(initial)row.querySelectorAll('.rank-bars>span').forEach(bar=>OrbitMotion.animate(bar,[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],650,{delay:i*35}));
   rowValue(row,initial);
  });
  table.querySelector('[data-table-time]').textContent=step?'Updated just now':'Live preview';
 }
 function reveal(root){root.querySelectorAll('[data-number]').forEach(el=>set(el,Number(el.dataset.number),{initial:true}));root.querySelectorAll('[data-attribution]').forEach(el=>build(el,true));}
 function prepare(root){
  root.querySelectorAll('[data-attribution]').forEach(el=>{if(initialized.has(el))return;initialized.add(el);build(el,true);observer.observe(el)});
  root.querySelectorAll('.mini-stats .stat strong,.ring strong').forEach(el=>{if(!el.dataset.number){const raw=el.textContent;el.dataset.number=Number(raw.replace(/[^\d.]/g,''));if(raw.includes('$'))el.dataset.format='currency';set(el,Number(el.dataset.number),{initial:true})}});
  root.querySelectorAll('[data-number]').forEach(el=>{if(!values.has(el))set(el,Number(el.dataset.number),{initial:true})});
 }
 const observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{if(isIntersecting)visible.add(target);else visible.delete(target)}),{threshold:.15});
 function tick(table){table.dataset.tick=Number(table.dataset.tick||0)+1;build(table,false)}
 setInterval(()=>{visible.forEach(table=>{if(!table.isConnected){visible.delete(table);observer.unobserve(table);return}if(document.hidden||reduced.matches||table.dataset.playing!=='true')return;tick(table)})},3000);
 document.addEventListener('pointerover',e=>{const row=e.target.closest('[data-ranked-row]');if(row&&!row.contains(e.relatedTarget))rowValue(row)});
 document.addEventListener('pointerout',e=>{const row=e.target.closest('[data-ranked-row]');if(row&&!row.contains(e.relatedTarget))requestAnimationFrame(()=>rowValue(row))});
 document.addEventListener('focusin',e=>{const row=e.target.closest('[data-ranked-row]');if(row)rowValue(row)});
 document.addEventListener('focusout',e=>{const row=e.target.closest('[data-ranked-row]');if(row)requestAnimationFrame(()=>rowValue(row))});
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  const table=b.closest('[data-attribution]');
  if(table){if(b.dataset.dimension){table.dataset.dimension=b.dataset.dimension;table.dataset.tick=0;build(table,true)}
   if(b.hasAttribute('data-table-update'))tick(table);
   if(b.hasAttribute('data-table-play')){const playing=table.dataset.playing!=='true';table.dataset.playing=playing;b.setAttribute('aria-pressed',playing);b.textContent=playing?'Pause':'Play'}
   if(b.hasAttribute('data-table-metric')){const revenue=table.dataset.metric!=='revenue';table.dataset.metric=revenue?'revenue':'people';b.textContent=revenue?'Show people':'Show revenue';table.querySelectorAll('[data-ranked-row]').forEach(row=>rowValue(row));}
  }
  if(b.dataset.numberAction){const demo=b.closest('[data-number-demo]'),el=demo.querySelector('[data-number]');let value=Number(el.dataset.value);value=b.dataset.numberAction==='increase'?value+127:b.dataset.numberAction==='decrease'?Math.max(0,value-89):2369;el.dataset.number=value;set(el,value);demo.querySelector('[role=status]').textContent=`Current value: ${format(value)}`;}
 });
 addEventListener('DOMContentLoaded',()=>prepare(document));
 window.OrbitNumbers={prepare,reveal,set};
})();
