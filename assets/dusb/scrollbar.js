(()=>{"use strict";
const SELECTOR='[data-dusb="true"]';
const instances=new WeakMap();
function enhance(el){
 if(!(el instanceof HTMLElement)||instances.has(el))return;
 if(getComputedStyle(el).position==="static")el.style.position="relative";
 el.classList.add("dusb-managed-scroll");
 el.style.setProperty("--dusb-thumb-color","#3B82F6");
 el.style.setProperty("--dusb-thumb-hover-color","#60A5FA");
 const rail=document.createElement("div");
 rail.className="dusb-rail dusb-managed-rail";
 rail.setAttribute("role","scrollbar");
 rail.setAttribute("aria-label","List scrollbar");
 rail.setAttribute("aria-controls",el.id||"");
 rail.setAttribute("aria-orientation","vertical");
 const thumb=document.createElement("span");thumb.className="dusb-thumb dusb-managed-thumb";thumb.setAttribute("aria-hidden","true");rail.append(thumb);el.append(rail);
 let frame=0,drag=null;
 const metrics=()=>{
  const track=rail.clientHeight,viewport=el.clientHeight,total=el.scrollHeight,max=Math.max(0,total-viewport);
  const thumbHeight=track>0?Math.min(track,Math.max(34,track*viewport/Math.max(total,1))):0;
  const travel=Math.max(0,track-thumbHeight);
  return {track,viewport,total,max,thumbHeight,travel};
 };
 const update=()=>{
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
   const m=metrics();
   if(m.max<=1||m.track<=1){rail.hidden=true;return}
   rail.hidden=false;
   const top=m.travel*(el.scrollTop/m.max);
   thumb.style.height=m.thumbHeight+"px";
   thumb.style.top=top+"px";
   rail.setAttribute("aria-valuemin","0");
   rail.setAttribute("aria-valuemax",String(Math.round(m.max)));
   rail.setAttribute("aria-valuenow",String(Math.round(el.scrollTop)));
  });
 };
 const scrollToPointer=e=>{
  const m=metrics(),rect=rail.getBoundingClientRect();
  if(m.max<=0||m.travel<=0)return;
  const y=Math.min(m.track,Math.max(0,e.clientY-rect.top));
  el.scrollTop=(y-drag.offset)*m.max/m.travel;
 };
 const onDown=e=>{
  if(e.button!==0||rail.hidden)return;
  const m=metrics(),rect=rail.getBoundingClientRect();
  const localY=e.clientY-rect.top;
  const thumbTop=m.max?m.travel*el.scrollTop/m.max:0;
  const onThumb=e.target===thumb||thumb.contains(e.target);
  drag={pointerId:e.pointerId,offset:onThumb?localY-thumbTop:m.thumbHeight/2};
  rail.setPointerCapture(e.pointerId);
  if(!onThumb)scrollToPointer(e);
  e.preventDefault();
 };
 const onMove=e=>{if(!drag||e.pointerId!==drag.pointerId)return;scrollToPointer(e)};
 const onUp=e=>{if(!drag||e.pointerId!==drag.pointerId)return;drag=null;if(rail.hasPointerCapture(e.pointerId))rail.releasePointerCapture(e.pointerId)};
 rail.addEventListener("pointerdown",onDown);
 rail.addEventListener("pointermove",onMove);
 rail.addEventListener("pointerup",onUp);
 rail.addEventListener("pointercancel",onUp);
 el.addEventListener("scroll",update,{passive:true});
 el.addEventListener("keydown",e=>{
  if(e.target!==el)return;
  const step=Math.max(40,el.clientHeight*.12);
  if(e.key==="ArrowDown")el.scrollTop+=step;
  else if(e.key==="ArrowUp")el.scrollTop-=step;
  else if(e.key==="PageDown")el.scrollTop+=el.clientHeight*.85;
  else if(e.key==="PageUp")el.scrollTop-=el.clientHeight*.85;
  else if(e.key==="Home")el.scrollTop=0;
  else if(e.key==="End")el.scrollTop=el.scrollHeight;
  else return;
  e.preventDefault();
 });
 el.tabIndex=el.tabIndex<0?0:el.tabIndex;
 const ro=typeof ResizeObserver!=="undefined"?new ResizeObserver(update):null;
 ro?.observe(el);
 Array.from(el.children).filter(n=>n!==rail).forEach(n=>ro?.observe(n));
 const mo=new MutationObserver(update);mo.observe(el,{childList:true,subtree:true,characterData:true});
 instances.set(el,{rail,ro,mo,update});update();
}
function scan(root=document){if(root.matches?.(SELECTOR))enhance(root);root.querySelectorAll?.(SELECTOR).forEach(enhance)}
function start(){
 scan();
 const mo=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)scan(n)})));
 mo.observe(document.body,{childList:true,subtree:true});
 window.DUSB={refresh:scan,update:()=>document.querySelectorAll(SELECTOR).forEach(el=>instances.get(el)?.update()),version:"1.1.0"};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();