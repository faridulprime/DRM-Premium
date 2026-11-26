(()=>{"use strict";
const $=s=>document.querySelector(s),host=$("#dumcHomeGrid");
if(!host)return;
const categoryDefinitions=[
 {key:"all-movies",title:"All Movies",rootId:"03_FILM_INDUSTRY"},
 {key:"dubbed-movies",title:"Dubbed Movies",rootId:"04_DUBBED_MOVIES"},
 {key:"country",title:"Country",rootId:"06_COUNTRIES"},
 {key:"collections",title:"Collections",rootId:"07_COLLECTIONS"},
 {key:"genre",title:"Genre",rootId:"05_GENRES"},
 {key:"subtitles",title:"Subtitles",rootId:"09_SUBTITLES"}
];
let roots=[],activeFolder="",activeYear="",movies=[],offset=0,query="",loading=false,hasMore=false,searchTimer=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const folderName=s=>String(s??"").replace(/^\d+_/,"").replace(/_/g," ");
const thumb=v=>v.thumbnail_url||(v.youtube_id?"https://img.youtube.com/vi/"+encodeURIComponent(v.youtube_id)+"/hqdefault.jpg":"https://placehold.co/640x360/17152e/e9e2ff?text=DRM+PREMIUM");
const folderIcon='<svg class="dumc-folder-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.75 6.5A2.75 2.75 0 0 1 5.5 3.75h4.1l2.05 2.1h6.85A2.75 2.75 0 0 1 21.25 8.6v8.9a2.75 2.75 0 0 1-2.75 2.75h-13a2.75 2.75 0 0 1-2.75-2.75z" fill="currentColor"/><path d="M2.9 9h18.2" fill="none" stroke="rgba(20,16,10,.55)" stroke-width="1.25"/></svg>';
function findNode(nodes,id){
 for(const node of nodes||[]){if(node.id===id)return node;const found=findNode(node.children,id);if(found)return found}
 return null;
}
function categoryGroups(){
 return categoryDefinitions.map(definition=>({...definition,node:findNode(roots,definition.rootId)})).filter(group=>group.node);
}
function groupItems(group){
 return(group.node?.children||[]).filter(node=>node.id!=="ARCHIVED");
}
function categoryCount(){
 return categoryGroups().reduce((count,group)=>count+groupItems(group).length,0);
}
function yearFolders(){
 const root=findNode(roots,"08_RELEASE_YEARS");
 const values=[];
 const visit=nodes=>{
  for(const node of nodes||[]){
   const match=/^YEAR_(\d{4})$/.exec(node.id);
   if(match){
    const year=Number(match[1]);
    if(year>=1950&&year<=2026)values.push({year,node});
   }else if(node.children?.length)visit(node.children);
  }
 };
 visit(root?.children||[]);
 return values.sort((a,b)=>b.year-a.year);
}
const dusbBound=new WeakSet();
function refreshDusb(el){
 const rail=el?.parentElement?.querySelector(":scope > .dusb-rail");
 const thumb=rail?.querySelector(".dusb-thumb");
 if(!rail||!thumb)return;
 const trackHeight=rail.clientHeight;
 if(trackHeight<1)return;
 const viewportHeight=el.clientHeight;
 const contentHeight=el.scrollHeight;
 const maxScroll=Math.max(0,contentHeight-viewportHeight);
 const thumbHeight=maxScroll>0?Math.max(26,Math.min(trackHeight,trackHeight*viewportHeight/contentHeight)):trackHeight;
 const travel=Math.max(0,trackHeight-thumbHeight);
 const top=maxScroll>0?(el.scrollTop/maxScroll)*travel:0;
 thumb.style.height=thumbHeight+"px";
 thumb.style.transform="translateY("+top+"px)";
}
function bindDusb(el){
 const rail=el?.parentElement?.querySelector(":scope > .dusb-rail");
 const thumb=rail?.querySelector(".dusb-thumb");
 if(!el||!rail||!thumb)return;
 if(!dusbBound.has(el)){
  el.addEventListener("scroll",()=>refreshDusb(el),{passive:true});
  let drag=null;
  thumb.addEventListener("pointerdown",event=>{
   if(event.button!==0)return;
   event.preventDefault();
   const trackHeight=rail.clientHeight;
   const thumbHeight=thumb.offsetHeight;
   const maxScroll=Math.max(0,el.scrollHeight-el.clientHeight);
   if(trackHeight<=thumbHeight||maxScroll<=0)return;
   drag={pointerId:event.pointerId,startY:event.clientY,startScroll:el.scrollTop,travel:trackHeight-thumbHeight,maxScroll};
   thumb.setPointerCapture(event.pointerId);
   thumb.style.cursor="grabbing";
  });
  thumb.addEventListener("pointermove",event=>{
   if(!drag||drag.pointerId!==event.pointerId)return;
   el.scrollTop=drag.startScroll+((event.clientY-drag.startY)/drag.travel)*drag.maxScroll;
  });
  const endDrag=event=>{
   if(!drag||drag.pointerId!==event.pointerId)return;
   drag=null;thumb.style.cursor="grab";
  };
  thumb.addEventListener("pointerup",endDrag);
  thumb.addEventListener("pointercancel",endDrag);
  thumb.addEventListener("lostpointercapture",()=>{drag=null;thumb.style.cursor="grab"});
  rail.addEventListener("pointerdown",event=>{
   if(event.target!==rail)return;
   const trackHeight=rail.clientHeight,thumbHeight=thumb.offsetHeight;
   const maxScroll=Math.max(0,el.scrollHeight-el.clientHeight);
   const travel=trackHeight-thumbHeight;
   if(travel<=0||maxScroll<=0)return;
   const rect=rail.getBoundingClientRect();
   const target=Math.max(0,Math.min(travel,event.clientY-rect.top-thumbHeight/2));
   el.scrollTop=(target/travel)*maxScroll;
  });
  dusbBound.add(el);
 }
 refreshDusb(el);
}
window.addEventListener("resize",()=>document.querySelectorAll("[data-dusb]").forEach(refreshDusb),{passive:true});
function renderCategories(){
 const el=$("#dumcHomeCategories");
 el.innerHTML=categoryGroups().map((group,index)=>{
  const titleId="dumc-category-title-"+group.key;
  const listId="dusb-list-"+group.key;
  const items=groupItems(group);
  return '<section class="dumc-directory-panel dumc-category-panel" aria-labelledby="'+titleId+'">'+
   '<header class="dumc-directory-panel-head"><h3 id="'+titleId+'">'+esc(group.title)+'</h3></header>'+
   '<div class="dumc-directory-panel-body dusb-viewport">'+
    '<div class="dumc-category-list dusb-scrollbar" id="'+listId+'" data-dusb="true" data-category-list="'+esc(group.key)+'" aria-label="'+esc(group.title)+' folders">'+
    items.map(node=>{
     const selected=activeFolder===node.id;
     return '<button type="button" class="dumc-nav-item'+(selected?' active':'')+'" data-category-folder="'+esc(node.id)+'" data-category-label="'+esc(folderName(node.name))+'" aria-pressed="'+(selected?'true':'false')+'">'+folderIcon+'<span>'+esc(folderName(node.name))+'</span></button>';
    }).join("")+
    '</div><div class="dusb-rail" data-dusb-rail="'+esc(group.key)+'" aria-hidden="true"><span class="dusb-thumb"></span></div>'+
   '</div></section>';
 }).join("");
 el.querySelectorAll("[data-dusb]").forEach(bindDusb);
}
function renderYears(){
 const el=$("#dumcHomeSubcategories");
 const years=yearFolders();
 if(years.length!==77)$("#dumcHomeStatus").textContent="Year taxonomy incomplete: "+years.length+" of 77 folders found.";
 el.innerHTML='<div class="dumc-year-grid" role="group" aria-label="Release years 2026 through 1950">'+years.map(({year})=>{
  const value=String(year);
  return '<button type="button" class="dumc-nav-item dumc-year-item'+(activeYear===value?' active':'')+'" data-year="'+value+'" aria-pressed="'+(activeYear===value?'true':'false')+'">'+folderIcon+'<span>'+value+'</span></button>';
 }).join("")+'</div>';
 bindDusb(el);
}
function updateLibraryCount(){
 $("#dumcHomeCount").textContent=categoryCount().toLocaleString("en-US")+" folders · "+movies.length.toLocaleString("en-US")+" movies";
}
async function loadTaxonomy(){
 try{
  const response=await fetch("/assets/dumc/taxonomy.json",{cache:"no-cache"});
  if(!response.ok)throw new Error("Folder taxonomy unavailable");
  const data=await response.json();
  roots=data.children||[];
  renderCategories();renderYears();updateLibraryCount();
 }catch(e){
  $("#dumcHomeStatus").textContent="Folder taxonomy could not be loaded. Refresh the page.";
  $("#dumcHomeCategories").innerHTML='<p class="dumc-nav-empty">Category lists unavailable.</p>';
  $("#dumcHomeSubcategories").innerHTML='<p class="dumc-nav-empty">Year list unavailable.</p>';
 }
}
function renderMovies(){
 host.innerHTML=movies.length?movies.map(v=>'<article class="dumc-movie-card" data-movie-id="'+esc(v.id)+'"><button type="button" class="dumc-movie-open" data-movie-id="'+esc(v.id)+'" aria-label="Play '+esc(v.title)+'"><img src="'+esc(thumb(v))+'" alt="" loading="lazy" decoding="async"><span class="dumc-movie-play" aria-hidden="true">▶</span></button><div class="dumc-movie-copy"><h3>'+esc(v.title)+'</h3><p>'+esc(v.description||v.category||"মুভি দেখুন")+'</p>'+(v.release_year?'<small>'+esc(v.release_year)+'</small>':"")+'</div></article>').join(""):'<p class="empty dumc-empty">'+(query?"কোনো মিল পাওয়া যায়নি।":"এই Category ও Year-এ এখনো কোনো প্রকাশিত মুভি নেই।")+'</p>';
 updateLibraryCount();
 $("#dumcHomeMore").hidden=!hasMore||Boolean(query);
}
async function loadMovies(reset=true){
 if(loading)return;loading=true;
 const status=$("#dumcHomeStatus");status.textContent="মুভি লোড হচ্ছে…";
 if(reset){offset=0;movies=[];host.innerHTML='<p class="empty">মুভি লোড হচ্ছে…</p>'}
 try{
  const params=new URLSearchParams({limit:"36",offset:String(offset)});
  if(activeFolder)params.set("folder_id",activeFolder);
  if(activeYear)params.set("year",activeYear);
  if(query)params.set("q",query);
  const res=await fetch("/api/dumc/browse?"+params.toString(),{credentials:"same-origin",cache:"no-store"});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||"DUMC লাইব্রেরি লোড করা যায়নি।");
  movies=reset?(data.movies||[]):movies.concat(data.movies||[]);
  offset+=data.movies?.length||0;hasMore=(data.movies||[]).length===36;
  renderMovies();status.textContent="";
 }catch(e){
  status.textContent=e.message;
  host.innerHTML='<p class="empty dumc-empty">'+esc(e.message)+'</p>';
  $("#dumcHomeMore").hidden=true;
  updateLibraryCount();
 }finally{loading=false}
}
$("#dumcHomeCategories").addEventListener("click",e=>{
 const b=e.target.closest("[data-category-folder]");if(!b)return;
 activeFolder=b.dataset.categoryFolder;
 activeYear="";
 renderCategories();renderYears();loadMovies(true);
});
$("#dumcHomeSubcategories").addEventListener("click",e=>{
 const b=e.target.closest("[data-year]");if(!b)return;
 activeYear=b.dataset.year;
 renderYears();loadMovies(true);
});
$("#dumcHomeSearch").addEventListener("input",e=>{query=e.target.value.trim().toLowerCase();clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadMovies(true),250)});
$("#dumcHomeMore").addEventListener("click",()=>loadMovies(false));
host.addEventListener("click",e=>{
 const b=e.target.closest("[data-movie-id]");if(!b)return;
 const movie=movies.find(x=>x.id===b.dataset.movieId);if(movie&&typeof window.play==="function")window.play(movie);
});
loadTaxonomy().finally(()=>loadMovies(true));
})();