(()=>{"use strict";
const SELECTOR='[data-dusb="true"]';
const instances=new WeakMap();
function enhance(el){
 if(!(el instanceof HTMLElement)||instances.has(el))return;
 if(getComputedStyle(el).position==="static")el.style.position="relative";
 el.classList.add("dusb-managed-scroll");
 el.style.setProperty("--dusb-thumb-color","rgba(59,130,246,.78)");
 el.style.setProperty("--dusb-thumb-hover-color","#60a5fa");
 const rail=document.createElement("div");rail.className="dusb-rail dusb-managed-rail";rail.setAttribute("aria-hidden","true");
 const thumb=document.createElement("span");thumb.className="dusb-thumb dusb-managed-thumb";rail.append(thumb);el.append(rail);
 let dragging=false,startY=0,startScroll=0,frame=0;
 const update=()=>{
  cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   const max=el.scrollHeight-el.clientHeight,track=rail.clientHeight;
   if(max<=1||track<=0){rail.hidden=true;return}
   rail.hidden=false;
   const height=Math.max(26,Math.min(track,track*el.clientHeight/el.scrollHeight));
   const top=(track-height)*(el.scrollTop/max);
   thumb.style.height=height+"px";thumb.style.transform="translateY("+top+"px)";
  })
 };
 const onDown=e=>{if(e.button!==0)return;dragging=true;startY=e.clientY;startScroll=el.scrollTop;thumb.setPointerCapture?.(e.pointerId);e.preventDefault()};
 const onMove=e=>{if(!dragging)return;const track=rail.clientHeight,range=Math.max(1,track-thumb.offsetHeight),max=el.scrollHeight-el.clientHeight;el.scrollTop=startScroll+(e.clientY-startY)*max/range};
 const onUp=()=>{dragging=false};
 const onTrack=e=>{if(e.target===thumb)return;const rect=rail.getBoundingClientRect(),ratio=(e.clientY-rect.top)/Math.max(1,rect.height);el.scrollTop=ratio*(el.scrollHeight-el.clientHeight)};
 thumb.addEventListener("pointerdown",onDown);window.addEventListener("pointermove",onMove,{passive:true});window.addEventListener("pointerup",onUp,{passive:true});rail.addEventListener("pointerdown",onTrack);
 el.addEventListener("scroll",update,{passive:true});
 const ro=typeof ResizeObserver!=="undefined"?new ResizeObserver(update):null;ro?.observe(el);if(el.firstElementChild)ro?.observe(el.firstElementChild);
 instances.set(el,{rail,ro,update});update();
}
function scan(root=document){if(root.matches?.(SELECTOR))enhance(root);root.querySelectorAll?.(SELECTOR).forEach(enhance)}
function start(){scan();const mo=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)scan(n)})));mo.observe(document.body,{childList:true,subtree:true});window.DUSB={refresh:scan,version:"1.0.0"}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();