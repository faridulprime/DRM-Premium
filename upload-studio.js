const $=s=>document.querySelector(s);
const studioMenuToggle=$("#studioMenuToggle"),studioSidebar=$("#liveSidebar"),studioSidebarBackdrop=$("#liveSidebarBackdrop");
let studioMenuCloseTimer=null;
function setStudioMenu(open){
 if(!studioMenuToggle||!studioSidebar)return;
 const isOpen=Boolean(open),mobile=window.matchMedia("(max-width:760px)").matches;
 clearTimeout(studioMenuCloseTimer);
 studioSidebar.classList.remove("mobile-open");
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
async function refresh(){state.categories=await api("admin/categories");renderCategories();state.videos=await api("admin/videos");const videos=state.videos;$("#managedList").innerHTML=videos.length?videos.map(v=>'<div class="list-row"><div><strong>'+esc(v.title)+'</strong><small>'+esc(v.category)+' · '+(v.published?"Published":"Draft")+'</small></div><button data-edit-video="'+esc(v.id)+'">Edit in legacy panel</button></div>').join(""):'<div class="empty-state">No posts yet.</div>';$("#categoryList").innerHTML=state.categories.map(c=>'<div class="list-row"><strong>'+esc(c.name)+'</strong><small>Existing category</small></div>').join("")||'<div class="empty-state">No categories yet.</div>';$("#folderSelect").innerHTML="";$("#folderSelect").disabled=true;$("#newFolder").disabled=true;$("#folderList").innerHTML='<div class="empty-state">Folder management will be enabled after the folder schema and API are added.</div>';renderDrafts();}
async function savePost(){const title=$("#postTitle").value.trim(),description=$("#postDescription").value.trim(),status=$("#publishStatus").value;if(!title){setMessage("Post title is required.",true);$("#postTitle").focus();return;}if(state.type!=="video"){setMessage("Article and Link publishing are being built in the next backend phase. Video posts can be saved now.",true);return;}if(!state.videoId){loadYouTube();if(!state.videoId){setMessage("Valid YouTube URL is required.",true);return;}}const selected=[...$("#categorySelect").selectedOptions].map(o=>o.value);if(!selected.length){setMessage("Select at least one category.",true);return;}if(status==="scheduled"){setMessage("Scheduled publishing is not enabled in the current backend.",true);return;}const body={title,description,category:selected[0],youtube_id:state.videoId,thumbnail_url:$("#coverUrl").value.trim()||state.cover,featured:false,published:status==="published"};$("#savePost").disabled=true;setSaveStatus("Saving…");try{await api("admin/videos",{method:"POST",body:JSON.stringify(body)});setSaveStatus("Saved");setMessage(status==="published"?"Post published.":"Draft saved. Note: drafts use the existing unpublished-video storage.");await refresh();if(status==="draft")switchView("drafts");}catch(e){setSaveStatus("Save failed");setMessage(e.message,true);}finally{$("#savePost").disabled=false;}}
function renderDrafts(){const drafts=state.videos.filter(v=>!Number(v.published));$("#draftList").innerHTML=drafts.length?drafts.map(v=>'<div class="list-row"><div><strong>'+esc(v.title)+'</strong><small>Unpublished video · '+esc(v.category)+'</small></div><small>Draft saved</small></div>').join(""):'<div class="empty-state">No drafts yet.</div>';$("#draftCount").textContent=String(drafts.length);$("#tabDraftCount").textContent=String(drafts.length);}
async function init(){try{const me=await api("auth/me");if(!me.authenticated||!["owner","admin"].includes(me.user?.role))throw new Error("Admin or Owner access is required. Please sign in through the admin panel first.");state.user=me.user;$("#identity").innerHTML=studioRoleBadge(me.user.role)+'<span class="studio-header-email">'+esc(me.user.email||"")+'</span>';await refresh();$("#studioContent").hidden=false;renderDrafts();}catch(e){$("#accessError").hidden=false;$("#accessError").textContent=e.message;}
document.querySelectorAll(".type").forEach(b=>b.onclick=()=>setType(b.dataset.type));document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>switchView(b.dataset.tab));document.querySelectorAll("[data-local-tab]").forEach(a=>a.onclick=e=>{e.preventDefault();switchView(a.dataset.localTab)});document.querySelectorAll("[data-device]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-device]").forEach(x=>x.classList.toggle("active",x===b));$("#postPreview").className="post-preview "+b.dataset.device;writeStudioRoute({device:b.dataset.device},true);});window.addEventListener("hashchange",restoreStudioRoute);$("#loadYoutube").onclick=loadYouTube;$("#youtubeUrl").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();loadYouTube();}});$("#playPreview").onclick=()=>{if(!state.videoId)return;$("#inlinePlayer").hidden=false;$("#inlinePlayer").innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+encodeURIComponent(state.videoId)+'?autoplay=1&rel=0" title="YouTube preview" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';};$("#useYoutube").onclick=()=>{$("#coverUrl").value=state.cover;updatePreview();setMessage("YouTube thumbnail selected as the cover. Enter the post title and description manually; metadata lookup is not connected.");};$("#applyCover").onclick=()=>{const u=$("#coverUrl").value.trim();if(!/^https:\/\//i.test(u)){setMessage("Cover image must be an HTTPS URL.",true);return;}state.cover=u;updatePreview();};$("#coverUrl").addEventListener("input",()=>{if(/^https:\/\//i.test($("#coverUrl").value)){state.cover=$("#coverUrl").value.trim();updatePreview();}});$("#postTitle").addEventListener("input",updatePreview);$("#postDescription").addEventListener("input",updatePreview);$("#articleMarkdown").addEventListener("input",()=>$("#markdownPreview").innerHTML=safeMarkdown($("#articleMarkdown").value)||'<span class="preview-empty">Live preview appears here.</span>');$("#publishStatus").onchange=()=>{$("#savePost").textContent=$("#publishStatus").value==="published"?"Publish Post":$("#publishStatus").value==="scheduled"?"Schedule Post":"Save Draft";$("#scheduleFields").hidden=$("#publishStatus").value!=="scheduled";};$("#savePost").onclick=savePost;$("#resetForm").onclick=()=>{if(!confirm("Discard the current form values?"))return;["youtubeUrl","postTitle","postDescription","externalUrl","articleMarkdown","coverUrl","postTags","postSlug"].forEach(id=>$("#"+id).value="");state.videoId="";state.cover="";$("#youtubePreview").hidden=true;$("#inlinePlayer").hidden=true;updatePreview();setSaveStatus("Not saved");setMessage("Form cleared.");};$("#newCategory").onclick=async()=>{const name=prompt("New category name");if(!name?.trim())return;try{await api("admin/categories",{method:"POST",body:JSON.stringify({name:name.trim()})});await refresh();setMessage("Category created.");}catch(e){setMessage(e.message,true);}};$("#newFolder").onclick=null;updatePreview();restoreStudioRoute();}
init();