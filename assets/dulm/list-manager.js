(()=>{"use strict";
const ROOT="#dumcHomeCategories";
function manage(root=document){
 const lists=root.querySelectorAll?.(".dufn-tab-wrap .dufn-panel:not([data-dulm-managed])")||[];
 lists.forEach(panel=>{
  panel.dataset.dulmManaged="true";
  panel.dataset.dulmList="true";
  panel.dataset.dusb="true";
  panel.setAttribute("role","region");
  panel.querySelectorAll(".dufn-folder").forEach((item,index)=>{item.dataset.dulmItem=String(index+1)});
  if(window.DUSB?.refresh)window.DUSB.refresh(panel);
 });
}
function start(){
 const root=document.querySelector(ROOT);if(!root)return;
 manage(root);
 const observer=new MutationObserver(()=>manage(root));
 observer.observe(root,{childList:true,subtree:true});
 window.DULM={refresh:()=>manage(root),version:"1.0.0"};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();