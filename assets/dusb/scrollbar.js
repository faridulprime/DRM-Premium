(()=>{"use strict";
const SELECTOR='[data-dusb="true"]',instances=new WeakMap(),active=new Set();
function enhance(el){
 if(!(el instanceof HTMLElement)||instances.has(el))return;
 el.classList.add("dusb-managed-scroll");
 const rail=document.createElement("div");rail.className="dusb-rail dusb-managed-rail";rail.setAttribute("role","scrollbar");rail.setAttribute("aria-label","List scrollbar");rail.setAttribute("aria-orientation","vertical");
 const thumb=document.createElement("span");thumb.className="dusb-thumb dusb-managed-thumb";thumb.setAttribute("aria-hidden","true");rail.append(thumb);document.body.append(rail);
 let frame=0,drag=null;
 const measure=()=>{
  const rect=el.getBoundingClientRect(),view=el.clientHeight,total=el.scrollHeight,max=Math.max(0,total-view);
  const top=Math.max(8,rect.top+8),bottom=Math.min(innerHeight-8,rect.bottom-8),height=Math.max(0,bottom-top);
  rail.style.top=top+"px";rail.style.left=(rect.right-13)+"px";rail.style.height=height+"px";
  const visible=rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight&&getComputedStyle(el).display!=="none"&&height>12;
  const thumbHeight=height?Math.min(height,Math.max(28,height*view/Math.max(total,1))):0,travel=Math.max(0,height-thumbHeight);
  return {height,max,thumbHeight,travel,visible};
 };
 const update=()=>{
  cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   const m=measure();
   if(!m.visible||m.max<=1||m.height<=1){rail.hidden=true;return}
   rail.hidden=false;thumb.style.height=m.thumbHeight+"px";thumb.style.top=(m.travel*el.scrollTop/m.max)+"px";
   rail.setAttribute("aria-valuemin","0");rail.setAttribute("aria-valuemax",String(Math.round(m.max)));rail.setAttribute("aria-valuenow",String(Math.round(el.scrollTop)));
  });
 };
 const toPointer=e=>{
  const m=measure();if(m.max<=0||m.travel<=0)return;
  const rect=rail.getBoundingClientRect(),y=Math.min(m.height,Math.max(0,e.clientY-rect.top));
  el.scrollTop=(y-drag.offset)*m.max/m.travel;
 };
 const down=e=>{
  if(e.button!==0||rail.hidden)return;
  const m=measure(),rect=rail.getBoundingClientRect(),local=e.clientY-rect.top;
  const current=m.max?m.travel*el.scrollTop/m.max:0,onThumb=e.target===thumb||thumb.contains(e.target);
  drag={id:e.pointerId,offset:onThumb?local-current:m.thumbHeight/2};
  rail.setPointerCapture(e.pointerId);if(!onThumb)toPointer(e);e.preventDefault();
 };
 const move=e=>{if(drag&&e.pointerId===drag.id)toPointer(e)};
 const up=e=>{if(!drag||e.pointerId!==drag.id)return;drag=null;if(rail.hasPointerCapture(e.pointerId))rail.releasePointerCapture(e.pointerId)};
 rail.addEventListener("pointerdown",down);rail.addEventListener("pointermove",move);rail.addEventListener("pointerup",up);rail.addEventListener("pointercancel",up);
 const onScroll=()=>update();el.addEventListener("scroll",onScroll,{passive:true});
 const onLayout=()=>update();window.addEventListener("scroll",onLayout,{passive:true,capture:true});window.addEventListener("resize",onLayout,{passive:true});
 const ro=typeof ResizeObserver!=="undefined"?new ResizeObserver(update):null;ro?.observe(el);
 const mo=new MutationObserver(update);mo.observe(el,{childList:true,subtree:true,characterData:true});
 el.tabIndex=el.tabIndex<0?0:el.tabIndex;
 el.addEventListener("keydown",e=>{if(e.target!==el)return;const step=Math.max(40,el.clientHeight*.12);if(e.key==="ArrowDown")el.scrollTop+=step;else if(e.key==="ArrowUp")el.scrollTop-=step;else if(e.key==="PageDown")el.scrollTop+=el.clientHeight*.85;else if(e.key==="PageUp")el.scrollTop-=el.clientHeight*.85;else if(e.key==="Home")el.scrollTop=0;else if(e.key==="End")el.scrollTop=el.scrollHeight;else return;e.preventDefault()});
 const instance={rail,ro,mo,update,cleanup(){rail.remove();ro?.disconnect();mo.disconnect();el.removeEventListener("scroll",onScroll);window.removeEventListener("scroll",onLayout,true);window.removeEventListener("resize",onLayout)}};
 instances.set(el,instance);active.add(el);update();
}
function cleanupTree(node){if(!(node instanceof Element))return;for(const el of active){if(el===node||node.contains(el)){instances.get(el)?.cleanup();active.delete(el);instances.delete(el)}}}
function scan(root=document){if(root.matches?.(SELECTOR))enhance(root);root.querySelectorAll?.(SELECTOR).forEach(enhance)}
function start(){scan();const mo=new MutationObserver(records=>records.forEach(r=>{r.addedNodes.forEach(n=>{if(n.nodeType===1)scan(n)});r.removedNodes.forEach(cleanupTree)}));mo.observe(document.body,{childList:true,subtree:true});window.DUSB={refresh:scan,update:()=>active.forEach(el=>instances.get(el)?.update()),version:"1.2.0"}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();