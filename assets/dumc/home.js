(()=>{"use strict";
const $=s=>document.querySelector(s),host=$("#dumcHomeGrid");
if(!host)return;
const labels={
 "01_MOVIE_LIBRARY":"Library",
 "02_LANGUAGE":"Language",
 "03_FILM_INDUSTRY":"Film Industry",
 "04_DUBBED_MOVIES":"Dubbed Movies",
 "05_GENRES":"Genre",
 "06_COUNTRIES":"Country",
 "07_COLLECTIONS":"Collections",
 "09_SUBTITLES":"Subtitles",
 "08_RELEASE_YEARS":"Year"
};
const categoryRootIds=["01_MOVIE_LIBRARY","02_LANGUAGE","03_FILM_INDUSTRY","04_DUBBED_MOVIES","05_GENRES","06_COUNTRIES","07_COLLECTIONS","09_SUBTITLES"];
const categoryRootSet=new Set(categoryRootIds);
let roots=[],activeFolder="",activeYear="",movies=[],offset=0,query="",loading=false,hasMore=false,searchTimer=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const folderName=s=>String(s??"").replace(/^\d+_/,"").replace(/_/g," ");
const thumb=v=>v.thumbnail_url||(v.youtube_id?"https://img.youtube.com/vi/"+encodeURIComponent(v.youtube_id)+"/hqdefault.jpg":"https://placehold.co/640x360/17152e/e9e2ff?text=DRM+PREMIUM");
const folderIcon='<svg class="dumc-folder-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.75 6.5A2.75 2.75 0 0 1 5.5 3.75h4.1l2.05 2.1h6.85A2.75 2.75 0 0 1 21.25 8.6v8.9a2.75 2.75 0 0 1-2.75 2.75h-13a2.75 2.75 0 0 1-2.75-2.75z" fill="currentColor"/><path d="M2.9 9h18.2" fill="none" stroke="rgba(20,16,10,.55)" stroke-width="1.25"/></svg>';
function findNode(nodes,id){
 for(const node of nodes||[]){if(node.id===id)return node;const found=findNode(node.children,id);if(found)return found}
 return null;
}
function nodeLabel(node,rootId){
 if(!node)return "";
 const name=folderName(node.name);
 if(rootId==="02_LANGUAGE")return name+" Movie";
 if(rootId==="01_MOVIE_LIBRARY"&&node.id==="ALL_MOVIES")return "All Movies";
 if(rootId==="01_MOVIE_LIBRARY"&&node.id==="FEATURED")return "Featured Movies";
 if(rootId==="01_MOVIE_LIBRARY"&&node.id==="UNCLASSIFIED")return "Unclassified Movies";
 return name;
}
function categoryGroups(){
 return categoryRootIds.map(id=>({id,title:labels[id],node:findNode(roots,id)})).filter(x=>x.node);
}
function categoryCount(){
 return categoryGroups().reduce((n,g)=>n+(g.node.children||[]).filter(x=>x.id!=="ARCHIVED").length,0);
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
 return values.sort((a,b)=>a.year-b.year);
}
function renderCategories(){
 const el=$("#dumcHomeCategories");
 const groups=categoryGroups();
 el.innerHTML=groups.map(group=>{
  const items=(group.node.children||[]).filter(node=>node.id!=="ARCHIVED");
  if(!items.length)return "";
  return '<section class="dumc-category-group" aria-label="'+esc(group.title)+'"><h4 class="dumc-category-group-title">'+esc(group.title)+'</h4><div class="dumc-folder-list">'+items.map(node=>{
   const selected=activeFolder===node.id;
   return '<button type="button" class="dumc-nav-item'+(selected?' active':'')+'" data-category-folder="'+esc(node.id)+'" data-category-label="'+esc(nodeLabel(node,group.id))+'" aria-pressed="'+(selected?'true':'false')+'">'+folderIcon+'<span>'+esc(nodeLabel(node,group.id))+'</span></button>';
  }).join("")+'</div></section>';
 }).join("");
}
function renderYears(){
 const el=$("#dumcHomeSubcategories");
 const years=yearFolders();
 if(years.length!==77){
  $("#dumcHomeStatus").textContent="Year taxonomy incomplete: "+years.length+" of 77 folders found.";
 }
 el.innerHTML='<div class="dumc-year-grid" role="group" aria-label="Release years 1950 through 2026">'+years.map(({year})=>{
  const value=String(year);
  return '<button type="button" class="dumc-nav-item dumc-year-item'+(activeYear===value?' active':'')+'" data-year="'+value+'" aria-pressed="'+(activeYear===value?'true':'false')+'">'+folderIcon+'<span>'+value+'</span></button>';
 }).join("")+'</div><div class="dumc-year-special"><button type="button" class="dumc-nav-item dumc-year-item'+(activeYear==="unknown"?' active':'')+'" data-year="unknown" aria-pressed="'+(activeYear==="unknown"?'true':'false')+'">'+folderIcon+'<span>Unknown Year</span></button></div>';
}
function activeCategoryLabel(){
 if(!activeFolder)return "";
 const node=findNode(roots,activeFolder);
 if(!node)return "";
 for(const group of categoryGroups()){
  if(findNode([group.node],activeFolder))return nodeLabel(node,group.id);
 }
 return folderName(node.name);
}
function renderBreadcrumb(){
 const parts=['<button type="button" data-crumb="all">Movies</button>'];
 if(activeFolder)parts.push('<span class="dumc-crumb-separator">›</span><span>Category</span><span class="dumc-crumb-separator">›</span><strong>'+esc(activeCategoryLabel())+'</strong>');
 if(activeYear)parts.push('<span class="dumc-crumb-separator">›</span><span>Year</span><span class="dumc-crumb-separator">›</span><strong>'+(activeYear==="unknown"?"Unknown Year":activeYear)+'</strong>');
 if(!activeFolder&&!activeYear)parts.push('<span class="dumc-crumb-hint">Choose a category and year, or browse all movies.</span>');
 $("#dumcHomeBreadcrumb").innerHTML=parts.join("");
}
function updateLibraryCount(){
 $("#dumcHomeCount").textContent=categoryCount().toLocaleString("en-US")+" categories · "+movies.length.toLocaleString("en-US")+" movies";
}
async function loadTaxonomy(){
 try{
  const response=await fetch("/assets/dumc/taxonomy.json",{cache:"no-cache"});
  if(!response.ok)throw new Error("Folder taxonomy unavailable");
  const data=await response.json();
  roots=data.children||[];
  renderCategories();renderYears();renderBreadcrumb();updateLibraryCount();
 }catch(e){
  $("#dumcHomeStatus").textContent="Folder taxonomy could not be loaded. Refresh the page.";
  $("#dumcHomeCategories").innerHTML='<p class="dumc-nav-empty">Category list unavailable.</p>';
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
 renderCategories();renderYears();renderBreadcrumb();loadMovies(true);
});
$("#dumcHomeSubcategories").addEventListener("click",e=>{
 const b=e.target.closest("[data-year]");if(!b)return;
 activeYear=b.dataset.year;
 renderYears();renderBreadcrumb();loadMovies(true);
});
$("#dumcHomeBreadcrumb").addEventListener("click",e=>{
 if(!e.target.closest('[data-crumb="all"]'))return;
 activeFolder="";activeYear="";renderCategories();renderYears();renderBreadcrumb();loadMovies(true);
});
$("#dumcHomeSearch").addEventListener("input",e=>{query=e.target.value.trim().toLowerCase();clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadMovies(true),250)});
$("#dumcHomeMore").addEventListener("click",()=>loadMovies(false));
host.addEventListener("click",e=>{
 const b=e.target.closest("[data-movie-id]");if(!b)return;
 const movie=movies.find(x=>x.id===b.dataset.movieId);if(movie&&typeof window.play==="function")window.play(movie);
});
loadTaxonomy().finally(()=>loadMovies(true));
})();