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
const folderName=s=>{const name=String(s??"").replace(/^\d+_/,"").replaceAll("_"," ").trim();const label=name.split(" ").map(part=>part.toLowerCase()==="cinema"?"Movies":part).join(" ");return label.toLowerCase()==="dhallywood"?"Bangla Movies":label};
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
 return children.sort((a,b)=>(folderName(folderNameOverrides[a.id]||a.name)).localeCompare(folderName(folderNameOverrides[b.id]||b.name),undefined,{numeric:true,sensitivity:"base"}));
}
function count(){return groups().filter(g=>g.key!=="year").reduce((n,g)=>n+items(g).length,0)}
function closeMenu(focus=false){clearTimeout(hoverTimer);clearTimeout(closeTimer);activeMenu="";renderCategories();if(focus)nav.querySelector("[data-category-menu]")?.focus()}
function openMenu(key){clearTimeout(hoverTimer);clearTimeout(closeTimer);if(activeMenu===key)return;if(groups().some(g=>g.key===key)){activeMenu=key;renderCategories()}}
function renderPanel(g){
 if(!g)return "";
 const list=items(g),isYear=g.key==="year";
 return '<section class="dufn-panel" id="dufnFolderPanel-'+esc(g.key)+'" aria-label="'+esc(g.title)+' folder list">'+
 '<header class="dufn-panel-head"><div class="dufn-panel-count">'+list.length+' Folders</div><button type="button" class="dufn-close" data-close-menu aria-label="Close folder menu">×</button></header>'+
 '<div class="dufn-folder-grid">'+list.map(n=>{
  const baseLabel=isYear?String(n.year):folderName(n.name),label=folderName(folderNameOverrides[n.id]||baseLabel),selected=isYear?activeYear===String(n.year):activeFolder===n.id,isFutureYear=isYear&&n.year>2026;
  return '<button type="button" class="dumc-nav-item dufn-folder'+(selected?' active':'')+(isFutureYear?' dufn-future-year':'')+'" data-folder-id="'+esc(n.id)+'" data-folder-label="'+esc(label)+'" '+(isYear?'data-year="'+String(n.year)+'"':'data-category-folder="'+esc(n.id)+'" data-category-label="'+esc(label)+'"')+' aria-pressed="'+(selected?'true':'false')+'">'+folderIcon+'<span>'+esc(label)+'</span></button>'
 }).join("")+'</div></section>'
}
function renderCategories(){
 const gs=groups();
 nav.innerHTML='<div class="dufn-tabs" role="group" aria-label="Movie folder categories">'+gs.map(g=>
  '<div class="dufn-tab-wrap"><button type="button" class="dufn-tab'+(activeMenu===g.key?' is-open':'')+'" data-category-menu="'+g.key+'" aria-expanded="'+(activeMenu===g.key)+'" aria-controls="dufnFolderPanel-'+g.key+'">'+esc(g.title)+'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 6 4.5 4 4.5-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'+(activeMenu===g.key?renderPanel(g):'')+'</div>'
 ).join("")+'</div><span class="dumc-home-count" id="dumcHomeCount">'+count().toLocaleString("en-US")+' folders · '+movies.length.toLocaleString("en-US")+' movies</span>'
}
function updateCount(){const el=$("#dumcHomeCount");if(el)el.textContent=count().toLocaleString("en-US")+" folders · "+movies.length.toLocaleString("en-US")+" movies"}
async function loadTaxonomy(){
 try{
  const r=await fetch("/assets/dufs/taxonomy.json",{cache:"no-cache"});
  if(!r.ok)throw Error("Folder taxonomy unavailable");
  const d=await r.json();roots=d.children||[];
  try{
   const namesResponse=await fetch("/api/dufs/folder-name-overrides",{credentials:"same-origin",cache:"no-store"});
   if(namesResponse.ok){
    const payload=await namesResponse.json();
    if(payload.overrides&&typeof payload.overrides==="object"&&!Array.isArray(payload.overrides))folderNameOverrides=payload.overrides;
   }
  }catch{}
  window.DUFSFolderNameOverrides=folderNameOverrides;
  window.DUMCFolderNameOverrides=folderNameOverrides;
  window.DUFSRefresh=()=>{renderCategories();updateCount()};
  window.DUMCRefresh=window.DUFSRefresh;
  renderCategories();updateCount();
 }catch(e){
  $("#dumcHomeStatus").textContent="Folder taxonomy could not be loaded. Refresh the page.";
  nav.innerHTML='<p class="dumc-nav-empty">Folder categories unavailable.</p>';
 }
}
function renderMovies(){host.innerHTML=movies.length?movies.map(v=>'<article class="dumc-movie-card" data-movie-id="'+esc(v.id)+'"><button type="button" class="dumc-movie-open" data-movie-id="'+esc(v.id)+'" aria-label="Play '+esc(v.title)+'"><img src="'+esc(thumb(v))+'" alt="" loading="lazy" decoding="async"><span class="dumc-movie-play" aria-hidden="true">▶</span></button><div class="dumc-movie-copy"><h3>'+esc(v.title)+'</h3><p>'+esc(v.description||v.category||"মুভি দেখুন")+'</p>'+(v.release_year?'<small>'+esc(v.release_year)+'</small>':"")+'</div></article>').join(""):'<p class="empty dumc-empty">'+(query?"কোনো মিল পাওয়া যায়নি।":"এই Category ও Year-এ এখনো কোনো প্রকাশিত মুভি নেই।")+'</p>';updateCount();$("#dumcHomeMore").hidden=!hasMore||Boolean(query)}
async function loadMovies(reset=true){if(loading)return;loading=true;const status=$("#dumcHomeStatus");status.textContent="মুভি লোড হচ্ছে…";if(reset){offset=0;movies=[];host.innerHTML='<p class="empty">মুভি লোড হচ্ছে…</p>'}try{const p=new URLSearchParams({limit:"36",offset:String(offset)});if(activeFolder)p.set("folder_id",activeFolder);if(activeYear)p.set("year",activeYear);if(query)p.set("q",query);const r=await fetch("/api/dufs/browse?"+p.toString(),{credentials:"same-origin",cache:"no-store"}),d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"DUMC লাইব্রেরি লোড করা যায়নি।");movies=reset?(d.movies||[]):movies.concat(d.movies||[]);offset+=d.movies?.length||0;hasMore=(d.movies||[]).length===36;renderMovies();status.textContent=""}catch(e){status.textContent=e.message;host.innerHTML='<p class="empty dumc-empty">'+esc(e.message)+'</p>';$("#dumcHomeMore").hidden=true;updateCount()}finally{loading=false}}
nav.addEventListener("pointerover",e=>{if(!matchMedia("(hover: hover) and (pointer: fine)").matches)return;const t=e.target.closest("[data-category-menu]");if(!t)return;clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>openMenu(t.dataset.categoryMenu),140)});
nav.addEventListener("pointerleave",()=>{if(!matchMedia("(hover: hover) and (pointer: fine)").matches)return;clearTimeout(hoverTimer);closeTimer=setTimeout(()=>{if(!nav.contains(document.activeElement))closeMenu()},260)});
nav.addEventListener("click",e=>{const x=e.target.closest("[data-close-menu]");if(x){closeMenu();return}const t=e.target.closest("[data-category-menu]");if(t){if(activeMenu===t.dataset.categoryMenu){if(!matchMedia("(hover: hover) and (pointer: fine)").matches)closeMenu()}else openMenu(t.dataset.categoryMenu);return}const f=e.target.closest("[data-category-folder]");if(f){activeFolder=f.dataset.categoryFolder;activeYear="";closeMenu();loadMovies(true);return}const y=e.target.closest("[data-year]");if(y){activeYear=y.dataset.year;activeFolder="";closeMenu();loadMovies(true)}});
document.addEventListener("click",e=>{if(!activeMenu||layout.contains(e.target))return;e.preventDefault();e.stopImmediatePropagation();closeMenu()},true);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&activeMenu){e.preventDefault();closeMenu(true);return}if(e.key==="ArrowDown"&&e.target.matches("[data-category-menu]")){e.preventDefault();openMenu(e.target.dataset.categoryMenu);nav.querySelector(".dufn-folder")?.focus()}});
$("#dumcHomeSearch").addEventListener("input",e=>{query=e.target.value.trim().toLowerCase();clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadMovies(true),250)});
$("#dumcHomeMore").addEventListener("click",()=>loadMovies(false));
host.addEventListener("click",e=>{const b=e.target.closest("[data-movie-id]");if(!b)return;const m=movies.find(x=>x.id===b.dataset.movieId);if(m&&typeof window.play==="function")window.play(m)});
loadTaxonomy().finally(()=>loadMovies(true));
})();