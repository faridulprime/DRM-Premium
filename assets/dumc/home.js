(()=>{"use strict";
const $=s=>document.querySelector(s),host=$("#dumcHomeGrid");
if(!host)return;
const labels={"01_MOVIE_LIBRARY":"মুভি লাইব্রেরি","02_LANGUAGE":"ভাষা","03_FILM_INDUSTRY":"ফিল্ম ইন্ডাস্ট্রি","04_DUBBED_MOVIES":"ডাবড মুভি","05_GENRES":"Genre","06_COUNTRIES":"দেশ","07_COLLECTIONS":"Collections","08_RELEASE_YEARS":"মুক্তির বছর","09_SUBTITLES":"সাবটাইটেল","10_ARTWORK":"Artwork","11_METADATA":"Metadata"};
const visibleRoots=new Set(Object.keys(labels));
let roots=[],activeRoot="",activeFolder="",movies=[],offset=0,query="",loading=false,hasMore=false,searchTimer=null;
const folderName=s=>String(s??"").replace(/^\d+_/,"").replace(/_/g," ");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const thumb=v=>v.thumbnail_url||(v.youtube_id?"https://img.youtube.com/vi/"+encodeURIComponent(v.youtube_id)+"/hqdefault.jpg":"https://placehold.co/640x360/17152e/e9e2ff?text=DRM+PREMIUM");
const folderIcon='<svg class="dumc-folder-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.75 6.5A2.75 2.75 0 0 1 5.5 3.75h4.1l2.05 2.1h6.85A2.75 2.75 0 0 1 21.25 8.6v8.9a2.75 2.75 0 0 1-2.75 2.75h-13a2.75 2.75 0 0 1-2.75-2.75z" fill="currentColor"/><path d="M2.9 9h18.2" fill="none" stroke="rgba(20,16,10,.55)" stroke-width="1.25"/></svg>';
function countTree(nodes){return(nodes||[]).reduce((n,x)=>n+1+countTree((x.children||[]).filter(c=>c.id!=="ARCHIVED")),0)}
function renderTree(nodes,depth=0){
 return(nodes||[]).filter(x=>x.id!=="ARCHIVED").map(node=>{
  const children=(node.children||[]).filter(x=>x.id!=="ARCHIVED");
  return '<div class="dumc-folder-node'+(children.length?' has-children':'')+'"><button type="button" class="dumc-folder-entry dumc-home-subchip'+(node.id===activeFolder?' active':'')+'" data-folder="'+esc(node.id)+'" aria-pressed="'+(node.id===activeFolder?'true':'false')+'" style="--folder-depth:'+depth+'">'+folderIcon+'<span class="dumc-folder-label">'+esc(folderName(node.name))+'</span></button>'+(children.length?'<div class="dumc-folder-nested">'+renderTree(children,depth+1)+'</div>':'')+'</div>';
 }).join("");
}
async function loadTaxonomy(){
 try{
  const response=await fetch("/assets/dumc/taxonomy.json",{cache:"no-cache"});
  if(!response.ok)throw new Error("Folder taxonomy unavailable");
  const data=await response.json();
  roots=(data.children||[]).filter(x=>visibleRoots.has(x.id));
  renderCategories();renderSubcategories();
  updateLibraryCount();
 }catch(e){
  $("#dumcHomeStatus").textContent="Folder তালিকা লোড করা যায়নি। পেজটি Refresh করুন।";
  host.innerHTML='<p class="empty dumc-empty">Folder taxonomy পাওয়া যায়নি।</p>';
 }
}
function renderCategories(){
 const el=$("#dumcHomeCategories");
 el.innerHTML='<button type="button" class="dumc-home-chip dumc-folder-entry dumc-all-folders'+(!activeFolder?' active':'')+'" data-root="" aria-pressed="'+(!activeFolder?'true':'false')+'">'+folderIcon+'<span class="dumc-folder-label">সব মুভি</span></button>';
}
function renderSubcategories(){
 const el=$("#dumcHomeSubcategories");
 const groups=activeRoot?roots.filter(x=>x.id===activeRoot):roots;
 if(!groups.length){el.innerHTML="";el.hidden=true;return}
 el.hidden=false;
 el.innerHTML='<div class="dumc-folder-directory">'+groups.map(root=>{
  const rootLabel=labels[root.id]||folderName(root.name);
  return '<section class="dumc-folder-group" aria-label="'+esc(rootLabel)+'"><div class="dumc-folder-group-title"><button type="button" class="dumc-folder-entry dumc-folder-root'+(root.id===activeFolder?' active':'')+'" data-root="'+esc(root.id)+'" aria-pressed="'+(root.id===activeRoot?'true':'false')+'">'+folderIcon+'<span class="dumc-folder-label">'+esc(rootLabel)+'</span></button></div><div class="dumc-folder-group-body">'+renderTree(root.children||[],0)+'</div></section>';
 }).join("")+'</div>';
}
function updateLibraryCount(){
 const folders=countTree(roots);
 $("#dumcHomeCount").textContent=folders.toLocaleString("bn-BD")+"টি ফোল্ডার · "+movies.length.toLocaleString("bn-BD")+"টি মুভি";
}
function renderMovies(){
 host.innerHTML=movies.length?movies.map(v=>'<article class="dumc-movie-card" data-movie-id="'+esc(v.id)+'"><button type="button" class="dumc-movie-open" data-movie-id="'+esc(v.id)+'" aria-label="Play '+esc(v.title)+'"><img src="'+esc(thumb(v))+'" alt="" loading="lazy" decoding="async"><span class="dumc-movie-play" aria-hidden="true">▶</span></button><div class="dumc-movie-copy"><h3>'+esc(v.title)+'</h3><p>'+esc(v.description||v.category||"মুভি দেখুন")+'</p>'+(v.release_year?'<small>'+esc(v.release_year)+'</small>':"")+'</div></article>').join(""):'<p class="empty dumc-empty">'+(query?"কোনো মিল পাওয়া যায়নি।":"এই ফোল্ডারে এখনো কোনো প্রকাশিত মুভি নেই।")+'</p>';
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
 const b=e.target.closest("[data-root]");if(!b)return;
 activeRoot="";activeFolder="";renderCategories();renderSubcategories();loadMovies(true);
});
$("#dumcHomeSubcategories").addEventListener("click",e=>{
 const rootButton=e.target.closest("[data-root]");
 if(rootButton){activeRoot=rootButton.dataset.root;activeFolder=activeRoot;renderCategories();renderSubcategories();loadMovies(true);return}
 const b=e.target.closest("[data-folder]");if(!b)return;
 activeFolder=b.dataset.folder;renderSubcategories();loadMovies(true);
});
$("#dumcHomeSearch").addEventListener("input",e=>{query=e.target.value.trim().toLowerCase();clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadMovies(true),250)});
$("#dumcHomeMore").addEventListener("click",()=>loadMovies(false));
host.addEventListener("click",e=>{
 const b=e.target.closest("[data-movie-id]");if(!b)return;
 const movie=movies.find(x=>x.id===b.dataset.movieId);if(movie&&typeof window.play==="function")window.play(movie);
});
loadTaxonomy().finally(()=>loadMovies(true));
})();