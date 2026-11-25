(()=>{"use strict";
const $=s=>document.querySelector(s),host=$("#dumcHomeGrid");
if(!host)return;
const labels={"01_MOVIE_LIBRARY":"মুভি লাইব্রেরি","02_LANGUAGE":"ভাষা","03_FILM_INDUSTRY":"ফিল্ম ইন্ডাস্ট্রি","04_DUBBED_MOVIES":"ডাবড মুভি","05_GENRES":"Genre","06_COUNTRIES":"দেশ","07_COLLECTIONS":"Collections","08_RELEASE_YEARS":"মুক্তির বছর","09_SUBTITLES":"সাবটাইটেল"};
const visibleRoots=new Set(["01_MOVIE_LIBRARY","02_LANGUAGE","03_FILM_INDUSTRY","04_DUBBED_MOVIES","05_GENRES","06_COUNTRIES","07_COLLECTIONS","08_RELEASE_YEARS","09_SUBTITLES"]);
let roots=[],activeRoot="",activeFolder="",movies=[],offset=0,query="",loading=false,hasMore=false,searchTimer=null;
const folderName=s=>String(s??"").replace(/^\\d+_/,"").replace(/_/g," ");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const thumb=v=>v.thumbnail_url||(v.youtube_id?"https://img.youtube.com/vi/"+encodeURIComponent(v.youtube_id)+"/hqdefault.jpg":"https://placehold.co/640x360/17152e/e9e2ff?text=DRM+PREMIUM");
function flatten(n,out=[]){for(const c of n.children||[]){if(c.id==="ARCHIVED")continue;out.push(c);flatten(c,out)}return out}
async function loadTaxonomy(){
 try{
  const response=await fetch("/assets/dumc/taxonomy.json",{cache:"force-cache"});
  if(!response.ok)throw new Error("Folder taxonomy unavailable");
  const data=await response.json();
  roots=(data.children||[]).filter(x=>visibleRoots.has(x.id));
  renderCategories();renderSubcategories();
  $("#dumcHomeCount").textContent=roots.length+"টি প্রধান ফোল্ডার";
 }catch{}
}
function renderCategories(){
 const el=$("#dumcHomeCategories");
 const items=[{id:"",name:"সব মুভি"},...roots.map(x=>({id:x.id,name:labels[x.id]||folderName(x.name)}))];
 el.innerHTML=items.map(x=>'<button type="button" class="dumc-home-chip'+((x.id===activeRoot)?" active":"")+'" data-root="'+esc(x.id)+'">'+esc(folderName(x.name))+'</button>').join("");
}
function renderSubcategories(){
 const el=$("#dumcHomeSubcategories"),root=roots.find(x=>x.id===activeRoot);
 if(!root){el.innerHTML="";el.hidden=true;return}
 const children=flatten(root,[]);
 el.hidden=!children.length;
 el.innerHTML=children.map(x=>'<button type="button" class="dumc-home-subchip'+(x.id===activeFolder?" active":"")+'" data-folder="'+esc(x.id)+'">'+esc(folderName(x.name))+(Number(x.movie_count||0)>0?' <span>'+Number(x.movie_count)+'</span>':'')+'</button>').join("");
}
function renderMovies(){
 const filtered=movies;
 host.innerHTML=filtered.length?filtered.map(v=>'<article class="dumc-movie-card" data-movie-id="'+esc(v.id)+'"><button type="button" class="dumc-movie-open" data-movie-id="'+esc(v.id)+'" aria-label="Play '+esc(v.title)+'"><img src="'+esc(thumb(v))+'" alt="" loading="lazy" decoding="async"><span class="dumc-movie-play" aria-hidden="true">▶</span></button><div class="dumc-movie-copy"><h3>'+esc(v.title)+'</h3><p>'+esc(v.description||v.category||"মুভি দেখুন")+'</p>'+(v.release_year?'<small>'+esc(v.release_year)+'</small>':"")+'</div></article>').join(""):'<p class="empty dumc-empty">'+(query?"কোনো মিল পাওয়া যায়নি।":"এই ফোল্ডারে এখনো কোনো প্রকাশিত মুভি নেই।")+'</p>';
 $("#dumcHomeCount").textContent=movies.length.toLocaleString("bn-BD")+"টি মুভি";
 $("#dumcHomeMore").hidden=!hasMore||Boolean(query);
}
async function loadMovies(reset=true){
 if(loading)return;loading=true;
 const status=$("#dumcHomeStatus");status.textContent="লোড হচ্ছে…";
 if(reset){offset=0;movies=[];host.innerHTML='<p class="empty">মুভি লোড হচ্ছে…</p>'}
 try{
  const params=new URLSearchParams({limit:"36",offset:String(offset)});
  if(activeFolder)params.set("folder_id",activeFolder);
  if(query)params.set("q",query);
  const res=await fetch("/api/dumc/browse?"+params.toString(),{credentials:"same-origin",cache:"no-store"});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||"DUMC লাইব্রেরি লোড করা যায়নি।");
  if(!roots.length){roots=(data.folders||[]).filter(x=>visibleRoots.has(x.id));renderCategories();}
  movies=reset?(data.movies||[]):movies.concat(data.movies||[]);
  offset+=data.movies?.length||0;hasMore=(data.movies||[]).length===36;
  renderSubcategories();renderMovies();status.textContent="";
 }catch(e){if(!roots.length){await loadTaxonomyFallback();status.textContent="Folder catalog loaded in preview mode; movie data awaits database setup.";}else{status.textContent=e.message;host.innerHTML='<p class="empty dumc-empty">'+esc(e.message)+'</p>';$("#dumcHomeMore").hidden=true;}}
 finally{loading=false}
}
$("#dumcHomeCategories").addEventListener("click",e=>{
 const b=e.target.closest("[data-root]");if(!b)return;
 activeRoot=b.dataset.root;activeFolder=activeRoot;renderCategories();loadMovies(true);
});
$("#dumcHomeSubcategories").addEventListener("click",e=>{
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