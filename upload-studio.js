const $=s=>document.querySelector(s);
const studioMenuToggle=$("#studioMenuToggle"),studioSidebar=$("#liveSidebar"),studioSidebarBackdrop=$("#liveSidebarBackdrop");
let studioMenuCloseTimer=null;
function setStudioMenu(open){
 if(!studioMenuToggle||!studioSidebar)return;
 const isOpen=Boolean(open),mobile=window.matchMedia("(max-width:760px)").matches;
 clearTimeout(studioMenuCloseTimer);
 if(mobile&&window.DRMMotion){window.DRMMotion.drawer({sidebar:studioSidebar,backdrop:studioSidebarBackdrop,toggle:studioMenuToggle,open:isOpen});return;}
 studioSidebar.classList.remove("mobile-open");
 void studioSidebar.offsetWidth;
 document.body.classList.remove("sidebar-open","drawer-open");
 if(studioSidebarBackdrop){studioSidebarBackdrop.classList.remove("is-closing");if(isOpen&&mobile)studioSidebarBackdrop.hidden=false;}
 if(isOpen){if(mobile){studioSidebar.classList.add("mobile-open");document.body.classList.add("drawer-open");}else document.body.classList.add("sidebar-open");}
 else if(studioSidebarBackdrop&&!studioSidebarBackdrop.hidden){studioSidebarBackdrop.classList.add("is-closing");studioMenuCloseTimer=setTimeout(()=>{studioSidebarBackdrop.hidden=true;studioSidebarBackdrop.classList.remove("is-closing");},720);}
 studioMenuToggle.setAttribute("aria-expanded",String(isOpen));
 studioMenuToggle.setAttribute("aria-label",isOpen?"মেনু বন্ধ করুন":"মেনু খুলুন");
}
studioMenuToggle?.addEventListener("click",()=>setStudioMenu(studioSidebar.classList.contains("mobile-open")||document.body.classList.contains("sidebar-open")?false:true));
studioSidebarBackdrop?.addEventListener("click",()=>setStudioMenu(false));
document.addEventListener("keydown",e=>{if(e.key==="Escape")setStudioMenu(false)});
studioSidebar?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>setStudioMenu(false)));
window.matchMedia("(max-width:760px)").addEventListener?.("change",()=>setStudioMenu(false));

const state={user:null,type:"video",videoId:"",cover:"",categories:[],drafts:[],videos:[]};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function studioRoleBadge(role){const key=role==="owner"?"owner":role==="admin"?"admin":role==="user"?"member":"";const label=key?key.toUpperCase():"GUEST";return '<span class="studio-role-badge role-badge '+(key?"role-badge--"+key:"")+'">'+label+'</span>';}
async function api(path,opts={}){const r=await fetch("/api/"+path,{...opts,headers:{"Content-Type":"application/json",...(opts.headers||{})},credentials:"same-origin"});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Request failed ("+r.status+")");return d;}
function ytId(v){try{const s=v.trim();if(/^[\w-]{11}$/.test(s))return s;const u=new URL(s),host=u.hostname.toLowerCase();if(host==="youtu.be"){const id=u.pathname.split("/").filter(Boolean)[0]||"";return /^[\w-]{11}$/.test(id)?id:""}if(!["youtube.com","www.youtube.com","m.youtube.com","youtube-nocookie.com","www.youtube-nocookie.com"].includes(host))return"";const id=u.searchParams.get("v")||u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1]||"";return /^[\w-]{11}$/.test(id)?id:""}catch{return""}}
function setMessage(t,error=false){const el=$("#formMessage");el.textContent=t;el.style.color=error?"#ffabb7":"#9de2c1"}
const STUDIO_VIEWS=["create","drafts","manage","categories","folders","media"];
function readStudioRoute(){
 const raw=location.hash.slice(1),params=new URLSearchParams(raw.startsWith("view=")?raw:"");
 const legacy=STUDIO_VIEWS.includes(raw)?raw:"create";
 return {
  view:STUDIO_VIEWS.includes(params.get("view"))?params.get("view"):legacy,
  type:"video",
  device:["desktop","tablet","mobile"].includes(params.get("device"))?params.get("device"):"desktop"
 };
}
function writeStudioRoute(patch={},replace=false){
 const current=readStudioRoute(),next={...current,...patch};
 const params=new URLSearchParams({view:next.view});
 if(next.type!=="video")params.set("type",next.type);
 if(next.device!=="desktop")params.set("device",next.device);
 const hash="#"+params.toString(),url=location.pathname+location.search+hash;
 if(replace)history.replaceState(null,"",url);else if(location.hash!==hash)location.hash=hash;
}
function switchView(name,updateUrl=true){
 if(!STUDIO_VIEWS.includes(name))name="create";
 document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
 document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+name));
 document.querySelectorAll("[data-local-tab]").forEach(a=>a.classList.toggle("active",a.dataset.localTab===name));
 if(updateUrl)writeStudioRoute({view:name});
}
function restoreStudioRoute(){
 const route=readStudioRoute();
 setType(route.type,false);
 document.querySelectorAll("[data-device]").forEach(b=>b.classList.toggle("active",b.dataset.device===route.device));
 $("#postPreview").className="post-preview "+route.device;
 switchView(route.view,false);
}
function updatePreview(){const title=$("#postTitle").value.trim()||"Your post title",desc=$("#postDescription").value.trim()||"Your description will appear here.";$("#previewTitle").textContent=title;$("#previewDescription").textContent=desc;$("#previewType").textContent=state.type.toUpperCase();const cover=$("#previewCover");cover.innerHTML=state.cover?'<img src="'+esc(state.cover)+'" alt="">':'<span>Cover preview</span>';const box=$("#coverPreview");box.innerHTML=state.cover?'<img src="'+esc(state.cover)+'" alt="Cover preview">':'<span>No cover selected</span>';}
function setType(type,updateUrl=true){type="video";state.type=type;document.querySelectorAll(".type").forEach(b=>b.classList.toggle("active",b.dataset.type===type));$("#videoSource").hidden=type!=="video";$("#articleFields").hidden=type!=="article";$("#linkFields").hidden=type!=="link";updatePreview();if(updateUrl)writeStudioRoute({type});}
function safeMarkdown(src){let s=esc(src);s=s.replace(/^### (.*)$/gm,"<h3>$1</h3>").replace(/^## (.*)$/gm,"<h2>$1</h2>").replace(/^# (.*)$/gm,"<h1>$1</h1>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/\n- (.*)/g,"<br>• $1").replace(/\n/g,"<br>");return s;}
function loadYouTube(){const id=ytId($("#youtubeUrl").value);if(!id){$("#youtubeFeedback").textContent="সঠিক YouTube URL দিন।";$("#youtubePreview").hidden=true;return;}state.videoId=id;const thumb="https://img.youtube.com/vi/"+encodeURIComponent(id)+"/hqdefault.jpg";$("#youtubeThumb").src=thumb;$("#ytTitle").textContent="Thumbnail preview ready";$("#ytChannel").textContent="Video ID: "+id+" · Metadata API not connected";$("#ytDescription").textContent="Thumbnail preview loaded. Title and description can be entered manually.";$("#youtubePreview").hidden=false;$("#youtubeFeedback").textContent="Thumbnail loaded. Public title/channel metadata needs a YouTube Data API integration.";if(!$("#coverUrl").value.trim()){state.cover=thumb;updatePreview();}}
function setSaveStatus(t){$("#saveStatus").textContent="● "+t;}
function renderCategories(){const select=$("#categorySelect");select.innerHTML=state.categories.map(c=>'<option value="'+esc(c.name)+'">'+esc(c.name)+'</option>').join("")||'<option disabled>No categories found</option>';}

let dumcTaxonomy=null;
let dumcSelectedNode=null;
function dumcCount(node){return 1+(node.children||[]).reduce((n,c)=>n+dumcCount(c),0);}
function dumcFind(node,id){if(node.id===id)return node;for(const child of node.children||[]){const found=dumcFind(child,id);if(found)return found;}return null;}
function dumcNodeHTML(node,depth=0,query=""){
 const children=(node.children||[]).map(child=>dumcNodeHTML(child,depth+1,query)).filter(Boolean).join("");
 const hay=(node.name+" "+(node.description||"")+" "+node.id).toLocaleLowerCase();
 const match=!query||hay.includes(query)||Boolean(children);
 if(!match)return "";
 const hasChildren=Boolean(node.children?.length);
 const selected=dumcSelectedNode===node.id?" is-selected":"";
 const tag=hasChildren?"summary":"button";const summary='<'+tag+(hasChildren?'':' type="button"')+' class="dumc-node-summary'+selected+'" data-dumc-id="'+esc(node.id)+'"><span class="dumc-folder-glyph">'+(hasChildren?"▸":"•")+'</span><span class="dumc-node-copy"><strong>'+esc(node.name)+'</strong><small>'+esc(node.description||"")+'</small></span><span class="dumc-node-count">'+(hasChildren?dumcCount(node)-1:(Number(node.movie_count||0)||""))+'</span>'+(hasChildren?"</summary>":"</button>");
 return hasChildren?'<details class="dumc-tree-node" '+(depth===0||Boolean(query)?"open":"")+'>'+summary+'<div class="dumc-children">'+children+'</div></details>':'<div class="dumc-leaf">'+summary+'</div>';
}
function selectDUMCNode(id){
 const node=dumcFind(dumcTaxonomy,id);if(!node)return;
 dumcSelectedNode=id;
 $("#dumcSelectedName").textContent=node.name;
 $("#dumcSelectedDescription").textContent=node.description||"No description available.";
 $("#dumcSelectedMeta").textContent=(node.kind||"Folder")+" · "+(node.children?.length?node.children.length+" direct subfolders":"Leaf folder")+" · "+id;
 document.querySelectorAll(".dumc-node-summary").forEach(el=>el.classList.toggle("is-selected",el.dataset.dumcId===id));
}
function dumcFlatten(node,out=[]){out.push(node);(node.children||[]).forEach(child=>dumcFlatten(child,out));return out;}
function dumcOptions(id,parentId,placeholder){
 const select=$(id),nodes=dumcFlatten(dumcTaxonomy).filter(n=>n.parent_id===parentId||n.parentId===parentId);
 select.innerHTML='<option value="">'+esc(placeholder)+'</option>'+nodes.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.name)+'</option>').join("");
}
function renderDUMC(live=false){
 if(!dumcTaxonomy)return;
 const q=$("#dumcSearch").value.trim().toLocaleLowerCase();
 $("#dumcTree").innerHTML=dumcNodeHTML(dumcTaxonomy,0,q)||'<div class="empty-state">No matching folders found.</div>';
 const sections=dumcTaxonomy.children||[],nodes=dumcFlatten(dumcTaxonomy);
 const assigned=nodes.reduce((n,x)=>n+Number(x.movie_count||0),0);
 $("#dumcStats").innerHTML='<span><strong>'+sections.length+'</strong> top-level sections</span><span><strong>'+nodes.length+'</strong> total folders</span><span><strong>'+assigned+'</strong> movie-folder links</span>';
 const options=nodes.filter(n=>n.id!=="DUMC");
 $("#folderSelect").innerHTML='<option value="">Select DUMC folder…</option>'+options.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.name)+' · '+esc(n.id)+'</option>').join("");
 $("#folderSelect").disabled=!live;
 $("#newFolder").disabled=!live;$("#dumcAddFolder").disabled=!live;
 const fill=(selector,parent)=>{const el=$(selector);const children=nodes.filter(n=>n.parent_id===parent||n.parentId===parent);el.innerHTML='<option value="">Not specified</option>'+children.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.name)+'</option>').join("");};
 fill("#dumcOriginalLanguage","02_LANGUAGE");fill("#dumcIndustry","03_FILM_INDUSTRY");fill("#dumcCountry","06_COUNTRIES");
 fill("#dumcGenres","05_GENRES");fill("#dumcDubbed","04_DUBBED_MOVIES");fill("#dumcSubtitleLanguages","09_SUBTITLES");fill("#dumcCollections","07_COLLECTIONS");
 $("#dumcMovieSelect").innerHTML='<option value="">Select a movie…</option>'+state.videos.map(v=>'<option value="'+esc(v.id)+'">'+esc(v.title)+' · '+esc(v.id.slice(0,8))+'</option>').join("");
 if(dumcSelectedNode)selectDUMCNode(dumcSelectedNode);
}
async function loadDUMC(){
 let live=false;
 try{
  const result=await api("admin/dumc/folders");
  dumcTaxonomy=(result.folders||[]).find(x=>x.id==="DUMC")||result.folders?.[0]||null;
  live=Boolean(dumcTaxonomy);
  if(!dumcTaxonomy)throw new Error("DUMC folder records are not available.");
 }catch{
  try{const response=await fetch("/assets/dumc/taxonomy.json",{cache:"no-cache"});if(!response.ok)throw new Error("Taxonomy catalog unavailable.");dumcTaxonomy=await response.json();}
  catch(error){$("#dumcTree").innerHTML='<div class="empty-state">'+esc(error.message)+'</div>';return;}
 }
 dumcSelectedNode=dumcTaxonomy.id;renderDUMC(live);selectDUMCNode(dumcSelectedNode);
 $("#dumcStorageNote").innerHTML=live
  ?"<strong>Storage status:</strong> DUMC database is connected. Folder records and movie classification APIs are available. Audio/subtitle asset references can be registered when the media object is stored in the configured movie asset store."
  :"<strong>Storage status:</strong> Showing the versioned taxonomy catalog. Apply migration 0009 to enable persistent folders and movie classification.";
}

async function applyDUMCFolder(videoId,folderId){
 const node=dumcFind(dumcTaxonomy,folderId);if(!node)throw new Error("Folder not found.");
 const nodes=dumcFlatten(dumcTaxonomy),parent=nodes.find(x=>(x.children||[]).some(c=>c.id===folderId))?.id;
 if(parent==="02_LANGUAGE"||parent==="03_FILM_INDUSTRY"||parent==="06_COUNTRIES"){
  const detail=await api("admin/dumc/movies/"+encodeURIComponent(videoId));
  const movie=detail.movie||{};
  const patch={original_language_folder_id:movie.original_language_folder_id||null,industry_folder_id:movie.industry_folder_id||null,production_country_folder_id:movie.production_country_folder_id||null,release_year:movie.release_year||null,runtime_seconds:movie.runtime_seconds||null,metadata:movie.metadata_json?JSON.parse(movie.metadata_json):{}};
  if(parent==="02_LANGUAGE")patch.original_language_folder_id=folderId;
  if(parent==="03_FILM_INDUSTRY")patch.industry_folder_id=folderId;
  if(parent==="06_COUNTRIES")patch.production_country_folder_id=folderId;
  await api("admin/dumc/movies/"+encodeURIComponent(videoId),{method:"PUT",body:JSON.stringify(patch)});
 }else{
  const relation={"04_DUBBED_MOVIES":"dubbed_language","05_GENRES":"genre","07_COLLECTIONS":"collection","09_SUBTITLES":"subtitle_language","10_ARTWORK":"artwork","11_METADATA":"metadata"}[parent];
  if(!relation)throw new Error("Choose a classification folder, not a system folder.");
  const detail=await api("admin/dumc/movies/"+encodeURIComponent(videoId));
  const assignments=(detail.assignments||[]).filter(a=>a.relation_type!==relation).map(a=>({folder_id:a.folder_id,relation_type:a.relation_type}));
  assignments.push({folder_id:folderId,relation_type:relation});
  await api("admin/dumc/movies/"+encodeURIComponent(videoId)+"/folders",{method:"PUT",body:JSON.stringify({assignments})});
 }
}
async function loadDUMCMovie(){
 const id=$("#dumcMovieSelect").value;if(!id)return;
 try{
  const d=await api("admin/dumc/movies/"+encodeURIComponent(id)),m=d.movie||{};
  $("#dumcOriginalLanguage").value=m.original_language_folder_id||"";
  $("#dumcIndustry").value=m.industry_folder_id||"";
  $("#dumcCountry").value=m.production_country_folder_id||"";
  $("#dumcYear").value=m.release_year||"";
  const selected={genre:new Set(),dubbed_language:new Set(),subtitle_language:new Set(),collection:new Set()};
  (d.assignments||[]).forEach(a=>selected[a.relation_type]?.add(a.folder_id));
  for(const [type,id] of [["genre","#dumcGenres"],["dubbed_language","#dumcDubbed"],["subtitle_language","#dumcSubtitleLanguages"],["collection","#dumcCollections"]]){
   Array.from($(id).options).forEach(o=>o.selected=selected[type].has(o.value));
  }
  $("#dumcMovieStatus").textContent="Movie metadata loaded.";
 }catch(e){$("#dumcMovieStatus").textContent=e.message;}
}
async function saveDUMCMovie(){
 const id=$("#dumcMovieSelect").value;if(!id){$("#dumcMovieStatus").textContent="Select a movie first.";return;}
 const status=$("#dumcMovieStatus");status.textContent="Saving…";
 try{
  const current=await api("admin/dumc/movies/"+encodeURIComponent(id)),m=current.movie||{};
  const year=$("#dumcYear").value.trim();
  const metadata=m.metadata_json?JSON.parse(m.metadata_json):{};
  await api("admin/dumc/movies/"+encodeURIComponent(id),{method:"PUT",body:JSON.stringify({
   original_language_folder_id:$("#dumcOriginalLanguage").value||null,
   industry_folder_id:$("#dumcIndustry").value||null,
   production_country_folder_id:$("#dumcCountry").value||null,
   release_year:year?Number(year):null,runtime_seconds:m.runtime_seconds||null,metadata
  })});
  const preserved=(current.assignments||[]).filter(a=>!["genre","dubbed_language","subtitle_language","collection"].includes(a.relation_type)).map(a=>({folder_id:a.folder_id,relation_type:a.relation_type}));
  const values=[["genre","#dumcGenres"],["dubbed_language","#dumcDubbed"],["subtitle_language","#dumcSubtitleLanguages"],["collection","#dumcCollections"]];
  for(const [relation,selector] of values)Array.from($(selector).selectedOptions).forEach(o=>preserved.push({folder_id:o.value,relation_type:relation}));
  await api("admin/dumc/movies/"+encodeURIComponent(id)+"/folders",{method:"PUT",body:JSON.stringify({assignments:preserved})});
  status.textContent="Classification saved.";await loadDUMC();
 }catch(e){status.textContent=e.message;}
}
async function createDUMCFolder(){
 const parentId=dumcSelectedNode||"DUMC",name=prompt("New folder name");if(!name?.trim())return;
 try{await api("admin/dumc/folders",{method:"POST",body:JSON.stringify({parent_id:parentId,name:name.trim()})});await loadDUMC();statusDUMC("Folder created.");}
 catch(e){statusDUMC(e.message,true);}
}
function statusDUMC(message,error=false){$("#dumcMovieStatus").textContent=message;$("#dumcMovieStatus").style.color=error?"#ffabb7":"#9de2c1";}

async function refresh(){state.categories=await api("admin/categories");renderCategories();state.videos=await api("admin/videos");const videos=state.videos;$("#managedList").innerHTML=videos.length?videos.map(v=>'<div class="list-row"><div><strong>'+esc(v.title)+'</strong><small>'+esc(v.category)+' · '+(v.published?"Published":"Draft")+'</small></div><button data-edit-video="'+esc(v.id)+'">Edit in legacy panel</button></div>').join(""):'<div class="empty-state">No posts yet.</div>';$("#categoryList").innerHTML=state.categories.map(c=>'<div class="list-row"><strong>'+esc(c.name)+'</strong><small>Existing category</small></div>').join("")||'<div class="empty-state">No categories yet.</div>';renderDrafts();await loadDUMC();}
async function savePost(){const title=$("#postTitle").value.trim(),description=$("#postDescription").value.trim(),status=$("#publishStatus").value;if(!title){setMessage("Post title is required.",true);$("#postTitle").focus();return;}if(state.type!=="video"){setMessage("Article and Link publishing are being built in the next backend phase. Video posts can be saved now.",true);return;}if(!state.videoId){loadYouTube();if(!state.videoId){setMessage("Valid YouTube URL is required.",true);return;}}const selected=[...$("#categorySelect").selectedOptions].map(o=>o.value);if(!selected.length){setMessage("Select at least one category.",true);return;}if(status==="scheduled"){setMessage("Scheduled publishing is not enabled in the current backend.",true);return;}const body={title,description,category:selected[0],youtube_id:state.videoId,thumbnail_url:$("#coverUrl").value.trim()||state.cover,featured:false,published:status==="published"};$("#savePost").disabled=true;setSaveStatus("Saving…");try{const created=await api("admin/videos",{method:"POST",body:JSON.stringify(body)});let dumcNotice="";if($("#folderSelect").value){try{await applyDUMCFolder(created.id,$("#folderSelect").value);dumcNotice=" DUMC folder linked.";}catch(e){dumcNotice=" DUMC folder link could not be saved: "+e.message;}}setSaveStatus("Saved");setMessage((status==="published"?"Post published.":"Draft saved. Note: drafts use the existing unpublished-video storage.")+dumcNotice);await refresh();if(status==="draft")switchView("drafts");}catch(e){setSaveStatus("Save failed");setMessage(e.message,true);}finally{$("#savePost").disabled=false;}}
function renderDrafts(){const drafts=state.videos.filter(v=>!Number(v.published));$("#draftList").innerHTML=drafts.length?drafts.map(v=>'<div class="list-row"><div><strong>'+esc(v.title)+'</strong><small>Unpublished video · '+esc(v.category)+'</small></div><small>Draft saved</small></div>').join(""):'<div class="empty-state">No drafts yet.</div>';$("#draftCount").textContent=String(drafts.length);$("#tabDraftCount").textContent=String(drafts.length);}
async function init(){try{const me=await api("auth/me");if(!me.authenticated||!["owner","admin"].includes(me.user?.role))throw new Error("Admin or Owner access is required. Please sign in through the admin panel first.");state.user=me.user;$("#identity").innerHTML=studioRoleBadge(me.user.role)+'<span class="studio-header-email">'+esc(me.user.email||"")+'</span>';await refresh();$("#studioContent").hidden=false;renderDrafts();}catch(e){$("#accessError").hidden=false;$("#accessError").textContent=e.message;}
$("#dumcSearch").addEventListener("input",()=>renderDUMC(Boolean(dumcTaxonomy)));$("#dumcMovieSelect").addEventListener("change",loadDUMCMovie);$("#dumcSaveMovie").addEventListener("click",saveDUMCMovie);$("#dumcAddFolder").addEventListener("click",createDUMCFolder);$("#newFolder").addEventListener("click",createDUMCFolder);$("#dumcTree").addEventListener("click",e=>{const summary=e.target.closest("[data-dumc-id]");if(summary)selectDUMCNode(summary.dataset.dumcId);});$("#dumcExpandAll").onclick=()=>$("#dumcTree").querySelectorAll("details").forEach(d=>d.open=true);$("#dumcCollapseAll").onclick=()=>$("#dumcTree").querySelectorAll("details").forEach(d=>{d.open=false;});document.querySelectorAll(".type").forEach(b=>b.onclick=()=>setType(b.dataset.type));document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>switchView(b.dataset.tab));document.querySelectorAll("[data-local-tab]").forEach(a=>a.onclick=e=>{e.preventDefault();switchView(a.dataset.localTab)});document.querySelectorAll("[data-device]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-device]").forEach(x=>x.classList.toggle("active",x===b));$("#postPreview").className="post-preview "+b.dataset.device;writeStudioRoute({device:b.dataset.device},true);});window.addEventListener("hashchange",restoreStudioRoute);$("#loadYoutube").onclick=loadYouTube;$("#youtubeUrl").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();loadYouTube();}});$("#playPreview").onclick=()=>{if(!state.videoId)return;$("#inlinePlayer").hidden=false;$("#inlinePlayer").innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+encodeURIComponent(state.videoId)+'?autoplay=1&rel=0" title="YouTube preview" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';};$("#useYoutube").onclick=()=>{$("#coverUrl").value=state.cover;updatePreview();setMessage("YouTube thumbnail selected as the cover. Enter the post title and description manually; metadata lookup is not connected.");};$("#applyCover").onclick=()=>{const u=$("#coverUrl").value.trim();if(!/^https:\/\//i.test(u)){setMessage("Cover image must be an HTTPS URL.",true);return;}state.cover=u;updatePreview();};$("#coverUrl").addEventListener("input",()=>{if(/^https:\/\//i.test($("#coverUrl").value)){state.cover=$("#coverUrl").value.trim();updatePreview();}});$("#postTitle").addEventListener("input",updatePreview);$("#postDescription").addEventListener("input",updatePreview);$("#articleMarkdown").addEventListener("input",()=>$("#markdownPreview").innerHTML=safeMarkdown($("#articleMarkdown").value)||'<span class="preview-empty">Live preview appears here.</span>');$("#publishStatus").onchange=()=>{$("#savePost").textContent=$("#publishStatus").value==="published"?"Publish Post":$("#publishStatus").value==="scheduled"?"Schedule Post":"Save Draft";$("#scheduleFields").hidden=$("#publishStatus").value!=="scheduled";};$("#savePost").onclick=savePost;$("#resetForm").onclick=()=>{if(!confirm("Discard the current form values?"))return;["youtubeUrl","postTitle","postDescription","externalUrl","articleMarkdown","coverUrl","postTags","postSlug"].forEach(id=>$("#"+id).value="");state.videoId="";state.cover="";$("#youtubePreview").hidden=true;$("#inlinePlayer").hidden=true;updatePreview();setSaveStatus("Not saved");setMessage("Form cleared.");};$("#newCategory").onclick=async()=>{const name=prompt("New category name");if(!name?.trim())return;try{await api("admin/categories",{method:"POST",body:JSON.stringify({name:name.trim()})});await refresh();setMessage("Category created.");}catch(e){setMessage(e.message,true);}};$("#newFolder").onclick=null;updatePreview();restoreStudioRoute();}
init();