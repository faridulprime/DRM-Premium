(()=>{"use strict";
const $=s=>document.querySelector(s),host=$("#dumcHomeGrid"),layout=$("#dumcDirectoryLayout"),nav=$("#dumcHomeCategories");
if(!host||!layout||!nav)return;
const defs=[
{key:"all-movies",title:"All Movies",rootId:"03_FILM_INDUSTRY"},
{key:"dubbed-movies",title:"Dubbed Movies",rootId:"04_DUBBED_MOVIES"},
{key:"country",title:"Country",rootId:"06_COUNTRIES"},
{key:"collections",title:"Collections",rootId:"07_COLLECTIONS"},
{key:"genre",title:"Genre",rootId:"05_GENRES"},
{key:"subtitles",title:"Subtitles",rootId:"09_SUBTITLES"},
{key:"year",title:"Year",rootId:"08_RELEASE_YEARS"}];
let roots=[],activeFolder="",activeYear="",movies=[],offset=0,query="",loading=false,hasMore=false,searchTimer=null,activeMenu="",hoverTimer=null,closeTimer=null;
let folderNameOverrides={};
window.DUFSFolderNameOverrides=folderNameOverrides;
window.DUMCFolderNameOverrides=folderNameOverrides;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const folderName=s=>window.DUFS?.displayFolderName(s)||String(s??"").replace(/^\\d+_/,"").replaceAll("_"," ").trim();
const thumb=v=>v.thumbnail_url||(v.youtube_id?"https://img.youtube.com/vi/"+encodeURIComponent(v.youtube_id)+"/hqdefault.jpg":"https://placehold.co/640x360/17152e/e9e2ff?text=DRM+PREMIUM");
const folderIcon='<svg class="dumc-folder-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.75 6.5A2.75 2.75 0 0 1 5.5 3.75h4.1l2.05 2.1h6.85A2.75 2.75 0 0 1 21.25 8.6v8.9a2.75 2.75 0 0 1-2.75 2.75h-13a2.75 2.75 0 0 1-2.75-2.75z" fill="currentColor"/><path d="M2.9 9h18.2" fill="none" stroke="rgba(20,16,10,.55)" stroke-width="1.25"/></svg>';
function findNode(nodes,id){for(const n of nodes||[]){if(n.id===id)return n;const f=findNode(n.children,id);if(f)return f}return null}
function years(){const root=findNode(roots,"08_RELEASE_YEARS"),out=[];const walk=nodes=>{for(const n of nodes||[]){const m=/^YEAR_(\d{4})$/.exec(n.id);if(m){const y=+m[1];if(y>=1950&&y<=2027)out.push({year:y,node:n})}else if(n.children?.length)walk(n.children)}};walk(root?.children||[]);return out.sort((a,b)=>b.year-a.year)}
function groups(){return defs.map(d=>({...d,node:findNode(roots,d.rootId)})).filter(g=>g.node)}
function items(g){
 if(g.key==="year")return years().map(x=>({id:x.node.id,name:String(x.year),year:x.year}));
 const children=(g.node.children||[]).filter(n=>n.id!=="ARCHIVED");
 if(g.key==="dubbed-movies"){
  const allowed=new Set(["bangla dubbed","hindi dubbed","english dubbed","other dubbed"]);
  return children.filter(n=>allowed.has(folderName(n.name).trim().toLowerCase()));
 }
 return window.DUFS?.sortFolders?window.DUFS.sortFolders(children,folderNameOverrides):children.sort((a,b)=>folderName(folderNameOverrides[a.id]||a.name).localeCompare(folderName(folderNameOverrides[b.id]||b.name),undefined,{numeric:true,sensitivity:"base"}));
}
function count(){return groups().filter(g=>g.key!=="year").reduce((n,g)=>n+items(g).length,0)}
function measurePanelWidth(panel,button){
 if(!panel||!button)return;
 const wasHidden=panel.hidden;
 const saved={visibility:panel.style.visibility,width:panel.style.width,maxWidth:panel.style.maxWidth,overflowX:panel.style.overflowX,marginLeft:panel.style.marginLeft};
 const rows=[...panel.querySelectorAll(".dufn-folder")];
 const savedRows=rows.map(row=>({maxWidth:row.style.maxWidth,width:row.style.width}));
 const labels=[...panel.querySelectorAll(".dufn-folder span")];
 const savedLabels=labels.map(label=>({whiteSpace:label.style.whiteSpace,width:label.style.width}));
 if(wasHidden){panel.hidden=false;panel.style.visibility="hidden";}
 /* Temporarily remove all width constraints so long names are measured unwrapped. */
 panel.style.width="max-content";
 panel.style.maxWidth="none";
 panel.style.overflowX="visible";
 rows.forEach(row=>{row.style.width="max-content";row.style.maxWidth="none"});
 labels.forEach(label=>{label.style.whiteSpace="nowrap";label.style.width="max-content"});
 const panelLeft=panel.getBoundingClientRect().left;
 const widestRight=rows.reduce((max,row)=>Math.max(max,row.getBoundingClientRect().right),panelLeft);
 const desiredWidth=Math.ceil(widestRight-panelLeft+20);
 const maxWidth=Math.max(120,Math.min(nav.clientWidth,window.innerWidth-40));
 panel.style.width=Math.min(desiredWidth,maxWidth)+"px";
 panel.style.maxWidth=maxWidth+"px";
 rows.forEach((row,i)=>{row.style.width=savedRows[i].width;row.style.maxWidth=savedRows[i].maxWidth});
 labels.forEach((label,i)=>{label.style.whiteSpace=savedLabels[i].whiteSpace;label.style.width=savedLabels[i].width});
 panel.style.overflowX=saved.overflowX;
 if(wasHidden){panel.style.visibility=saved.visibility;panel.hidden=true;}
 const navRect=nav.getBoundingClientRect(),tabRect=button.getBoundingClientRect();
 const finalWidth=parseFloat(panel.style.width)||panel.getBoundingClientRect().width;
 const availableWidth=Math.max(0,nav.clientWidth-finalWidth);
 panel.style.marginLeft=Math.max(0,Math.min(tabRect.left-navRect.left,availableWidth))+"px";
}
function scheduleOpenPanelMeasure(){
 if(!activeMenu)return;
 cancelAnimationFrame(panelMeasureFrame);
 panelMeasureFrame=requestAnimationFrame(()=>{
  const button=nav.querySelector('[data-category-menu="'+activeMenu+'"]');
  const panel=nav.querySelector("#dufnFolderPanel-"+activeMenu);
  if(button&&panel)measurePanelWidth(panel,button);
 });
}
let panelMeasureFrame=0;
function clearFocusModeIfIdle(){
 if(!activeMenu&&!nav.querySelector(".dufn-panel:not([hidden])"))document.body.classList.remove("dufn-focus-mode","dufn-focus-closing");
}
function syncMenuState(animate=true){
 for(const g of groups()){
  const button=nav.querySelector('[data-category-menu="'+g.key+'"]');
  const panel=nav.querySelector("#dufnFolderPanel-"+g.key);
  const isOpen=activeMenu===g.key;
  if(button){
   button.classList.toggle("is-open",isOpen);
   button.setAttribute("aria-expanded",String(isOpen));
  }
  if(!panel)continue;
  const isMarkedHidden=panel.getAttribute("aria-hidden")==="true";
  if(isOpen){
   if(button)measurePanelWidth(panel,button);
   if(panel.hidden||isMarkedHidden){
    if(animate&&window.DRMMotion?.dropdown)window.DRMMotion.dropdown({panel,open:true,duration:600});
    else{panel.hidden=false;panel.inert=false;panel.setAttribute("aria-hidden","false")}
   }
  }else if(!panel.hidden&&!isMarkedHidden){
   if(animate&&window.DRMMotion?.dropdown)window.DRMMotion.dropdown({panel,open:false,duration:500,onFinish:clearFocusModeIfIdle});
   else{panel.hidden=true;panel.inert=true;panel.setAttribute("aria-hidden","true");clearFocusModeIfIdle()}
  }else if(panel.hidden){
   panel.inert=true;
   panel.setAttribute("aria-hidden","true");
  }
 }
 clearFocusModeIfIdle();
}
function closeMenu(focus=false){
 if(activeMenu)document.body.classList.add("dufn-focus-closing");
 activeMenu="";
 syncMenuState(true);
 if(focus)nav.querySelector("[data-category-menu]")?.focus();
}
function openMenu(key){
 if(!groups().some(g=>g.key===key)||activeMenu===key)return;
 document.body.classList.remove("dufn-focus-closing");
 document.body.classList.add("dufn-focus-mode");
 activeMenu=key;
 syncMenuState(true);
}
function toggleMenu(key){
 if(activeMenu===key)closeMenu();
 else openMenu(key);
}
function renderPanel(g){
 if(!g)return "";
 const list=items(g),isYear=g.key==="year";
 return '<section class="dufn-panel" id="dufnFolderPanel-'+esc(g.key)+'" aria-label="'+esc(g.title)+' folder list" hidden inert aria-hidden="true">'+
 '<header class="dufn-panel-head"><div class="dufn-panel-count">'+list.length+' Folders</div></header>'+
 '<div class="dufn-folder-grid">'+list.map(n=>{
  const baseLabel=isYear?String(n.year):folderName(n.name),label=folderName(folderNameOverrides[n.id]||baseLabel),selected=isYear?activeYear===String(n.year):activeFolder===n.id,isFutureYear=isYear&&n.year>2026;
  return '<button type="button" class="dumc-nav-item dufn-folder'+(selected?' active':'')+(isFutureYear?' dufn-future-year':'')+'" data-folder-id="'+esc(n.id)+'" data-folder-label="'+esc(label)+'" '+(isYear?'data-year="'+String(n.year)+'"':'data-category-folder="'+esc(n.id)+'" data-category-label="'+esc(label)+'"')+' aria-pressed="'+(selected?'true':'false')+'">'+folderIcon+'<span>'+esc(label)+'</span></button>'
 }).join("")+'</div></section>'
}
function folderGroupTabIcon(key){
 const paths={
  "all-movies":'<path d="m3 7 9-4 9 4-9 4-9-4Z"/><path d="m3 12 9 4 9-4M3 17l9 4 9-4"/>',
  "dubbed-movies":'<path d="M4 5h16M4 10h10M4 15h16M4 20h10"/><path d="m17 9 3 3-3 3"/>',
  country:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  collections:'<path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  genre:'<path d="M20 13 13 20 3 10V4h6z"/><circle cx="7.5" cy="7.5" r="1"/>',
  subtitles:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h4M13 10h4M7 14h10"/>',
  year:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h7"/>'
 };
 return '<span class="tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">'+(paths[key]||paths["all-movies"])+'</svg></span>';
}
function renderCategories(){
 const gs=groups();
 if(activeMenu&&!gs.some(g=>g.key===activeMenu)){activeMenu="";document.body.classList.remove("dufn-focus-mode","dufn-focus-closing")}
 nav.innerHTML='<div class="dufn-tabs" role="group" aria-label="Movie folder categories">'+gs.map(g=>
  '<button type="button" class="dufn-tab'+(activeMenu===g.key?' is-open':'')+'" data-category-menu="'+g.key+'" aria-expanded="'+(activeMenu===g.key)+'" aria-controls="dufnFolderPanel-'+g.key+'">'+folderGroupTabIcon(g.key)+'<span class="tab-label">'+esc(g.title)+'</span><svg class="dufn-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 6 4.5 4 4.5-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
 ).join('')+'<span class="dumc-home-count" id="dumcHomeCount">'+count().toLocaleString("en-US")+' folders · '+movies.length.toLocaleString("en-US")+' movies</span></div>'+gs.map(renderPanel).join('');
 syncMenuState(true);
}
function updateCount(){const el=$("#dumcHomeCount");if(el)el.textContent=count().toLocaleString("en-US")+" folders · "+movies.length.toLocaleString("en-US")+" movies"}
async function loadTaxonomy(){
 try{
  const d=window.DUFS?.loadTaxonomy?await window.DUFS.loadTaxonomy():await (async()=>{const response=await fetch("/assets/dufs/taxonomy.json",{cache:"no-cache"});if(!response.ok)throw Error("DUFS taxonomy unavailable");return response.json()})();
  if(!d||!Array.isArray(d.children))throw Error("DUFS taxonomy unavailable");roots=d.children||[];
  try{folderNameOverrides=window.DUFS?.loadOverrides?await window.DUFS.loadOverrides():{};}catch{folderNameOverrides={}}
  window.DUFSFolderNameOverrides=folderNameOverrides;
  window.DUMCFolderNameOverrides=folderNameOverrides;
  window.DUFSRefresh=()=>{renderCategories();updateCount()};
  window.DUFSHomepage=Object.freeze({version:"1.0.0",refresh:window.DUFSRefresh,getFolderOverrides:()=>({...folderNameOverrides})});
  window.DUMCRefresh=window.DUFSRefresh;
  renderCategories();updateCount();
 }catch(e){
  $("#dumcHomeStatus").textContent="Folder taxonomy could not be loaded. Refresh the page.";
  nav.innerHTML='<p class="dumc-nav-empty">Folder categories unavailable.</p>';
 }
}
function renderMovies(){host.innerHTML=movies.length?movies.map(v=>'<article class="dumc-movie-card" data-movie-id="'+esc(v.id)+'"><button type="button" class="dumc-movie-open" data-movie-id="'+esc(v.id)+'" aria-label="Play '+esc(v.title)+'"><img src="'+esc(thumb(v))+'" alt="" loading="lazy" decoding="async"><span class="dumc-movie-play" aria-hidden="true">▶</span></button><div class="dumc-movie-copy"><h3>'+esc(v.title)+'</h3><p>'+esc(v.description||v.category||"মুভি দেখুন")+'</p>'+(v.release_year?'<small>'+esc(v.release_year)+'</small>':"")+'</div></article>').join(""):'<p class="empty dumc-empty">'+(query?"কোনো মিল পাওয়া যায়নি।":"এই Category ও Year-এ এখনো কোনো প্রকাশিত মুভি নেই।")+'</p>';updateCount();$("#dumcHomeMore").hidden=!hasMore||Boolean(query)}
async function loadMovies(reset=true){if(loading)return;loading=true;const status=$("#dumcHomeStatus");status.textContent="মুভি লোড হচ্ছে…";if(reset){offset=0;movies=[];host.innerHTML='<p class="empty">মুভি লোড হচ্ছে…</p>'}try{const p=new URLSearchParams({limit:"36",offset:String(offset)});if(activeFolder)p.set("folder_id",activeFolder);if(activeYear)p.set("year",activeYear);if(query)p.set("q",query);const d=window.DUFS?.browse?await window.DUFS.browse({limit:36,offset,folder_id:activeFolder,year:activeYear,q:query}):await (async()=>{const response=await fetch("/api/dufs/browse?"+p.toString(),{credentials:"same-origin",cache:"no-store"});const payload=await response.json().catch(()=>({}));if(!response.ok)throw Error(payload.error||"DUFS browse request failed.");return payload})();movies=reset?(d.movies||[]):movies.concat(d.movies||[]);offset+=d.movies?.length||0;hasMore=(d.movies||[]).length===36;renderMovies();status.textContent=""}catch(e){status.textContent=e.message;host.innerHTML='<p class="empty dumc-empty">'+esc(e.message)+'</p>';$("#dumcHomeMore").hidden=true;updateCount()}finally{loading=false}}
const panelContentObserver=new MutationObserver(()=>scheduleOpenPanelMeasure());
panelContentObserver.observe(nav,{subtree:true,childList:true,characterData:true});
window.addEventListener("resize",scheduleOpenPanelMeasure,{passive:true});
if(document.fonts?.ready)document.fonts.ready.then(scheduleOpenPanelMeasure);
nav.addEventListener("click",e=>{const x=e.target.closest("[data-close-menu]");if(x){closeMenu();return}const t=e.target.closest("[data-category-menu]");if(t){toggleMenu(t.dataset.categoryMenu);return}const f=e.target.closest("[data-category-folder]");if(f){activeFolder=f.dataset.categoryFolder;activeYear="";closeMenu();loadMovies(true);return}const y=e.target.closest("[data-year]");if(y){activeYear=y.dataset.year;activeFolder="";closeMenu();loadMovies(true)}});
document.addEventListener("click",e=>{if(!activeMenu||layout.contains(e.target))return;if(e.target.closest(".topbar .brand")){closeMenu();return}e.preventDefault();e.stopImmediatePropagation();closeMenu()},true);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&activeMenu){e.preventDefault();closeMenu(true);return}if(e.key==="ArrowDown"&&e.target.matches("[data-category-menu]")){e.preventDefault();openMenu(e.target.dataset.categoryMenu);nav.querySelector("#dufnFolderPanel-"+activeMenu+" .dufn-folder")?.focus()}});
$("#dumcHomeSearch").addEventListener("input",e=>{query=e.target.value.trim().toLowerCase();clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadMovies(true),250)});
$("#dumcHomeMore").addEventListener("click",()=>loadMovies(false));
host.addEventListener("click",e=>{const b=e.target.closest("[data-movie-id]");if(!b)return;const m=movies.find(x=>x.id===b.dataset.movieId);if(m&&typeof window.play==="function")window.play(m)});
loadTaxonomy().finally(()=>loadMovies(true));
})();