/* DRM Universal Motion System (DUME)
 * First migration: shared mobile universal-drawer controller.
 * Desktop drawer layout remains owned by each page's existing CSS.
 */
(function(){
 "use strict";
 const rootStyle=getComputedStyle(document.documentElement);
 const readMs=(name,fallback)=>{const value=rootStyle.getPropertyValue(name).trim();const parsed=parseFloat(value);return Number.isFinite(parsed)?(value.endsWith("s")&&!value.endsWith("ms")?parsed*1000:parsed):fallback;};
 const DURATION=readMs("--dume-drawer-duration",700);
 const OPACITY_DURATION=readMs("--dume-drawer-opacity-duration",520);
 const EASING=rootStyle.getPropertyValue("--dume-drawer-easing").trim()||"cubic-bezier(.16,1,.3,1)";
 const REDUCED=window.matchMedia("(prefers-reduced-motion: reduce)");
 const jobs=new WeakMap();
 const dropdownJobs=new WeakMap();
 const instances=new Map();
 const DROPDOWN_DURATION=readMs("--dume-dropdown-duration",380);
 const DROPDOWN_EASING=rootStyle.getPropertyValue("--dume-dropdown-easing").trim()||EASING;
 const DROPDOWN_OFFSET=parseFloat(rootStyle.getPropertyValue("--dume-dropdown-offset"))||22;
 const DROPDOWN_SCALE=parseFloat(rootStyle.getPropertyValue("--dume-dropdown-scale"))||.97;
 function dropdown(options){
  const {panel,open,onFinish}=options||{};
  if(!panel)return Promise.resolve({cancelled:false,skipped:true});
  const previous=dropdownJobs.get(panel);
  let currentFrame=null;
  if(previous){
   const computed=getComputedStyle(panel);
   currentFrame={opacity:computed.opacity,transform:computed.transform==="none"?"translate3d(0,0,0) scale(1)":computed.transform,filter:computed.filter==="none"?"blur(0px)":computed.filter};
   previous.animation.cancel();
   dropdownJobs.delete(panel);
  }
  const isOpen=Boolean(open);
  if(isOpen){
   panel.hidden=false;
   panel.inert=false;
   panel.setAttribute("aria-hidden","false");
  }else{
   panel.inert=true;
   panel.setAttribute("aria-hidden","true");
  }
  const closedFrame={opacity:0,transform:"translate3d(0,-"+DROPDOWN_OFFSET+"px,0) scale("+DROPDOWN_SCALE+")",filter:"blur(2px)"};
  const openFrame={opacity:1,transform:"translate3d(0,0,0) scale(1)",filter:"blur(0px)"};
  const from=currentFrame||(isOpen?closedFrame:openFrame);
  const to=isOpen?openFrame:closedFrame;
  const duration=REDUCED.matches?0:DROPDOWN_DURATION;
  if(duration<=0||typeof panel.animate!=="function"){
   panel.style.removeProperty("will-change");
   if(!isOpen)panel.hidden=true;
   if(typeof onFinish==="function")onFinish();
   return Promise.resolve({cancelled:false,reducedMotion:REDUCED.matches});
  }
  panel.style.willChange="transform, opacity, filter";
  const animation=panel.animate([from,to],{duration,easing:DROPDOWN_EASING,fill:"both"});
  const job={animation,open:isOpen};
  dropdownJobs.set(panel,job);
  const finish=()=>{
   if(dropdownJobs.get(panel)!==job)return;
   dropdownJobs.delete(panel);
   animation.cancel();
   panel.style.removeProperty("will-change");
   if(!isOpen)panel.hidden=true;
   if(typeof onFinish==="function")onFinish();
  };
  animation.addEventListener("finish",finish,{once:true});
  animation.addEventListener("cancel",()=>{
   if(dropdownJobs.get(panel)===job){
    dropdownJobs.delete(panel);
    panel.style.removeProperty("will-change");
   }
  },{once:true});
  return animation.finished.then(()=>({cancelled:false})).catch(()=>({cancelled:true}));
 }
 function mobile(){return window.matchMedia("(max-width:760px)").matches;}
 function clearJob(el){const job=jobs.get(el);if(job){clearTimeout(job.timer);jobs.delete(el);}}
 function setImportant(el,p,v){el.style.setProperty(p,v,"important");}
 function clearInline(el){["transition","animation","transform","opacity","visibility","pointer-events","will-change"].forEach(p=>el.style.removeProperty(p));}
 function backdropState(backdrop,open){
  if(!backdrop)return;
  backdrop.classList.add("dume-mobile-backdrop");
  if(open){
   backdrop.hidden=false;backdrop.classList.remove("is-closing");
   setImportant(backdrop,"opacity","0");void backdrop.offsetWidth;
   requestAnimationFrame(()=>{if(!backdrop.hidden)setImportant(backdrop,"opacity","1");});
  }else if(!backdrop.hidden){backdrop.classList.add("is-closing");setImportant(backdrop,"opacity","0");}
 }
 function setAria(toggle,open){if(toggle){toggle.setAttribute("aria-expanded",String(open));toggle.setAttribute("aria-label",open?"মেনু বন্ধ করুন":"মেনু খুলুন");}}
 function drawer(options){
  const {sidebar,backdrop,toggle,open}=options||{};
  if(!sidebar)return;
  const state=Boolean(open),isMobile=mobile();
  if(isMobile)instances.set(sidebar,{sidebar,backdrop,toggle});
  else instances.delete(sidebar);
  clearJob(sidebar);setAria(toggle,state);
  if(!isMobile){
   sidebar.classList.remove("mobile-open","dume-mobile-drawer");clearInline(sidebar);
   document.body.classList.remove("drawer-open");document.body.classList.toggle("sidebar-open",state);
   if(backdrop){backdrop.classList.remove("dume-mobile-backdrop","is-closing");backdrop.hidden=!state;clearInline(backdrop);}
   return;
  }
  document.body.classList.remove("sidebar-open");document.body.classList.toggle("drawer-open",state);
  sidebar.classList.add("dume-mobile-drawer");
  const duration=REDUCED.matches?0:DURATION;
  setImportant(sidebar,"transition","transform "+duration+"ms "+EASING+", opacity "+Math.min(duration,OPACITY_DURATION)+"ms ease");
  /* Disable legacy page keyframes; DUME owns the transition on this element. */
  setImportant(sidebar,"animation","none");
  setImportant(sidebar,"visibility","visible");setImportant(sidebar,"pointer-events",state?"auto":"none");setImportant(sidebar,"will-change","transform,opacity");
  if(state){
   sidebar.classList.add("mobile-open");backdropState(backdrop,true);
   setImportant(sidebar,"transform","translate3d(-110%,0,0)");setImportant(sidebar,"opacity","0");
   void sidebar.offsetWidth;
   requestAnimationFrame(()=>{if(sidebar.classList.contains("mobile-open")){setImportant(sidebar,"transform","translate3d(0,0,0)");setImportant(sidebar,"opacity","1");}});
  }else{
   const current=getComputedStyle(sidebar).transform;
   if(current!=="none")setImportant(sidebar,"transform",current);
   setImportant(sidebar,"opacity","1");void sidebar.offsetWidth;
   requestAnimationFrame(()=>{setImportant(sidebar,"transform","translate3d(-110%,0,0)");setImportant(sidebar,"opacity","0");});
   backdropState(backdrop,false);
   const timer=setTimeout(()=>{
    sidebar.classList.remove("mobile-open");clearInline(sidebar);sidebar.classList.remove("dume-mobile-drawer");
    if(backdrop){backdrop.hidden=true;backdrop.classList.remove("is-closing","dume-mobile-backdrop");clearInline(backdrop);}
    document.body.classList.remove("drawer-open");jobs.delete(sidebar);instances.delete(sidebar);
   },duration+40);
   jobs.set(sidebar,{timer});
  }
 }
 window.DRMMotion=Object.freeze({drawer,dropdown,config:Object.freeze({drawerDuration:DURATION,drawerOpacityDuration:OPACITY_DURATION,drawerEasing:EASING,dropdownDuration:DROPDOWN_DURATION,dropdownEasing:DROPDOWN_EASING,dropdownOffset:DROPDOWN_OFFSET,dropdownScale:DROPDOWN_SCALE,get reducedMotion(){return REDUCED.matches;}})});
 window.addEventListener("resize",()=>{
  if(mobile())return;
  for(const [sidebar,options] of instances){
   if(!sidebar.isConnected){instances.delete(sidebar);continue;}
   if(sidebar.classList.contains("dume-mobile-drawer"))drawer({...options,open:false});
   else instances.delete(sidebar);
  }
 });
})();