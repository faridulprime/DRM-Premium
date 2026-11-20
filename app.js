const $=s=>document.querySelector(s);
const demoVideos=[
 {id:"demo1",title:"The Art of Cinematic Storytelling",category:"Featured",youtube_id:"ysz5S6PUM-U",description:"একটি নমুনা ভিডিও। Admin Panel থেকে নিজের ভিডিও যোগ করুন।",featured:1,thumbnail_url:""},
 {id:"demo2",title:"Learn Something New Today",category:"Education",youtube_id:"ScMzIvxBSi4",description:"শিক্ষামূলক ভিডিওর নমুনা।",featured:0,thumbnail_url:""},
 {id:"demo3",title:"Creative Inspiration",category:"Entertainment",youtube_id:"aqz-KE-bpKQ",description:"বিনোদন বিভাগের নমুনা ভিডিও।",featured:0,thumbnail_url:""}
];
let videos=[],categories=[],settings={};
let categoryOptionsKey="";
let searchRenderTimer=null;
let renderLimit=24;
const RENDER_BATCH=24;
const bn=n=>Number(n||0).toLocaleString("bn-BD");
let adminHeartbeat=null;
let visualConfig={},visualSelected=null,visualMode=false;
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function thumb(v){return v.thumbnail_url||`https://img.youtube.com/vi/${encodeURIComponent(v.youtube_id)}/hqdefault.jpg`;}
function play(v){$("#playerTitle").textContent=v.title;$("#playerDescription").textContent=v.description||"";$("#playerFrame").innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.youtube_id)}?autoplay=1&rel=0" title="${esc(v.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;$("#playerDialog").showModal();}
function applySettings(){
 const pairs={heroEyebrow:"hero_eyebrow",libraryEyebrow:"library_eyebrow",libraryTitle:"library_title",footerText:"footer_text"};
 for(const [id,key] of Object.entries(pairs)){const el=$("#"+id);if(el&&settings[key])el.textContent=settings[key];}
  // Keep the public brand canonical; legacy site_name settings must not overwrite it.
  $("#brandName").textContent="DRM PREMIUM";
  $("#footerBrand").textContent="DRM PREMIUM";
 if(settings.hero_image)$("#hero").style.backgroundImage=`linear-gradient(90deg,#080808 0%,rgba(8,8,8,.86) 32%,rgba(8,8,8,.12) 100%),url("${settings.hero_image}")`;
 if(settings.show_hero==="false")$("#hero").hidden=true;
 if(settings.show_library==="false")$("#browse").hidden=true;
 if(settings.accent_color&&/^#[0-9a-f]{6}$/i.test(settings.accent_color))document.documentElement.style.setProperty("--red",settings.accent_color);
 document.title="DRM PREMIUM";
}

function visualSelector(el){
 const doc=el.ownerDocument||document,root=doc.body;if(el.id)return "#"+CSS.escape(el.id);
 const parts=[];let node=el;while(node&&node!==root){let part=node.tagName.toLowerCase();if(node.parentElement){const siblings=[...node.parentElement.children].filter(x=>x.tagName===node.tagName);if(siblings.length>1)part+=":nth-of-type("+(siblings.indexOf(node)+1)+")";}parts.unshift(part);node=node.parentElement;}return "body>"+parts.join(">");
}
function applyVisualConfig(){
 for(const item of Object.values(visualConfig)){if(!item||typeof item.selector!=="string")continue;let el;try{el=document.querySelector(item.selector)}catch{}if(!el)continue;if(typeof item.text==="string"&&item.replaceText===true&&el.children.length===0)el.textContent=item.text;const s=item.style||{};if(Number.isFinite(s.fontSize))el.style.fontSize=s.fontSize+"px";if(/^#[0-9a-f]{6}$/i.test(s.color||""))el.style.color=s.color;if(/^#[0-9a-f]{6}$/i.test(s.background||""))el.style.backgroundColor=s.background;if(s.shadow&&/^#[0-9a-f]{6}$/i.test(s.shadow.color||""))el.style.textShadow=(s.shadow.x||0)+"px "+(s.shadow.y||0)+"px "+(s.shadow.blur||0)+"px "+s.shadow.color;}
}
function setVisualEditor(user){
 const toggle=$("#visualEditorToggle");if(!toggle)return;toggle.hidden=Boolean(new URLSearchParams(location.search).has("builderPreview"))||!(user&&user.role==="owner");
}
function selectVisualElement(el){
 visualSelected=el;const id=visualSelector(el),saved=visualConfig[id]||{};$("#veText").value=el.textContent;$("#veFontSize").value=parseFloat(getComputedStyle(el).fontSize)||16;$("#veColor").value=saved.style?.color||"#183d5c";$("#veBackground").value=saved.style?.background||"#ffffff";$("#veShadowColor").value=saved.style?.shadow?.color||"#000000";$("#veShadowX").value=saved.style?.shadow?.x||0;$("#veShadowY").value=saved.style?.shadow?.y||0;$("#veShadowBlur").value=saved.style?.shadow?.blur||0;$("#veHelp").textContent="নির্বাচিত: "+el.tagName.toLowerCase()+(el.id?"#"+el.id:"");
}
function visualDraft(){
 if(!visualSelected)return null;const selector=visualSelector(visualSelected);
 return {selector,text:$("#veText").value.slice(0,2000),replaceText:true,style:{fontSize:Math.min(96,Math.max(8,Number($("#veFontSize").value)||16)),color:$("#veColor").value,background:$("#veBackground").value,shadow:{color:$("#veShadowColor").value,x:Math.min(20,Math.max(-20,Number($("#veShadowX").value)||0)),y:Math.min(20,Math.max(-20,Number($("#veShadowY").value)||0)),blur:Math.min(30,Math.max(0,Number($("#veShadowBlur").value)||0))}}};
}
function applyVisualDraft(item){
 if(!item||!visualSelected)return;visualSelected.textContent=item.text;const s=item.style;visualSelected.style.fontSize=s.fontSize+"px";visualSelected.style.color=s.color;visualSelected.style.backgroundColor=s.background;visualSelected.style.textShadow=s.shadow.x+"px "+s.shadow.y+"px "+s.shadow.blur+"px "+s.shadow.color;
}
function initVisualEditor(){
 const toggle=$("#visualEditorToggle"),panel=$("#visualEditorPanel");
 toggle.addEventListener("click",()=>openSiteBuilder());
 $("#veClose").onclick=()=>{visualMode=false;panel.hidden=true;document.body.classList.remove("visual-editor-active");toggle.classList.remove("active");};
 document.addEventListener("click",e=>{if(!visualMode||panel.contains(e.target)||e.target===toggle)return;const el=e.target.closest("h1,h2,h3,h4,p,a,button,label,span,small,strong,li");if(!el||el.closest("#visualEditorPanel")||el.children.length)return;e.preventDefault();e.stopPropagation();selectVisualElement(el);},{capture:true});
 $("#veApply").onclick=()=>{const item=visualDraft();if(!item){$("#veStatus").textContent="আগে একটি লেখা নির্বাচন করুন।";return;}applyVisualDraft(item);visualConfig[item.selector]=item;$("#veStatus").textContent="Preview প্রয়োগ হয়েছে। Save Changes চাপলে স্থায়ী হবে।";};
 $("#veSave").onclick=async()=>{const item=visualDraft();if(!item){$("#veStatus").textContent="আগে একটি লেখা নির্বাচন করুন।";return;}applyVisualDraft(item);visualConfig[item.selector]=item;const button=$("#veSave");button.disabled=true;$("#veStatus").textContent="সংরক্ষণ হচ্ছে…";try{const r=await fetch("/api/admin/settings",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({visual_editor_config:JSON.stringify(visualConfig)})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Save করা যায়নি।");$("#veStatus").textContent="পরিবর্তন সংরক্ষিত হয়েছে।";}catch(err){$("#veStatus").textContent=err.message;}finally{button.disabled=false;}};
 $("#veReset").onclick=()=>{if(!visualSelected)return;const id=visualSelector(visualSelected);delete visualConfig[id];visualSelected.removeAttribute("style");fetch("/api/admin/settings",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({visual_editor_config:JSON.stringify(visualConfig)})}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Reset save failed");$("#veStatus").textContent="নির্বাচিত element reset ও সংরক্ষণ হয়েছে।";}).catch(e=>$("#veStatus").textContent=e.message);};
}

function videoCardHTML(v){
 return `<article class="video-card" data-id="${esc(v.id)}"><img class="thumb" src="${esc(thumb(v))}" alt="" width="640" height="360" loading="lazy" decoding="async" fetchpriority="low" onerror="this.onerror=null;this.src='https://placehold.co/640x360/17152e/e9e2ff?text=DRM+PREMIUM'"><div class="card-copy"><h4>${esc(v.title)}</h4><p>${esc(v.description||"ভিডিও দেখুন")}</p></div></article>`;
}
function render(append=false){
 const q=$("#search").value.toLowerCase().trim(),cat=$("#categoryFilter").value;
 const cats=[...new Set(categories.map(c=>c.name).filter(Boolean))].sort();
 const categoryKey=cats.join("\u0000");
 if(categoryOptionsKey!==categoryKey){
  $("#categoryFilter").innerHTML='<option value="all">সব ক্যাটাগরি</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
  categoryOptionsKey=categoryKey;
  $("#categoryFilter").value=cats.includes(cat)?cat:"all";
 }
 const activeCategory=$("#categoryFilter").value;
 const filteredAll=videos.filter(v=>(activeCategory==="all"||v.category===activeCategory)&&(`${v.title} ${v.category} ${v.description||""}`.toLowerCase().includes(q)));
 const from=append?Math.max(0,renderLimit-RENDER_BATCH):0;
 const visible=filteredAll.slice(from,renderLimit);
 const featured=videos.find(v=>Number(v.featured))||videos[0];
 const heroTitle=$("#heroTitle");if(heroTitle)heroTitle.textContent=settings.hero_title||(featured?featured.title:"আপনার পরবর্তী পছন্দের ভিডিও");
 $("#heroDescription").textContent=settings.hero_description||(featured?(featured.description||featured.category):"নতুন ভিডিও শিগগিরই আসছে।");
 $("#heroPlay").disabled=!featured;$("#heroPlay").onclick=()=>featured&&play(featured);
 if(!append)$("#videoRows").replaceChildren();
 const groups=new Map();
 visible.forEach(v=>{const name=v.category||"অন্যান্য";if(!groups.has(name))groups.set(name,[]);groups.get(name).push(v);});
 for(const [name,items] of groups){
  let section=[...$("#videoRows").children].find(el=>el.dataset.category===name);
  if(!section){section=document.createElement("section");section.className="video-row";section.dataset.category=name;section.innerHTML=`<h3>${esc(name)}</h3><div class="cards"></div>`;$("#videoRows").append(section);}
  const cards=section.querySelector(".cards");
  cards.insertAdjacentHTML("beforeend",items.map(videoCardHTML).join(""));
 }
 $("#emptyState").hidden=filteredAll.length>0;
 const more=$("#loadMoreVideos");if(more){more.hidden=renderLimit>=filteredAll.length;more.textContent="আরও ভিডিও দেখুন ("+Math.min(RENDER_BATCH,filteredAll.length-renderLimit)+")";}
}

async function sendTabView(tab){try{await fetch("/api/analytics/event",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({tab})});}catch{}}
function trackNavigation(){const links=[...document.querySelectorAll("#mainNav a")];links.forEach(a=>a.addEventListener("click",()=>{const tab=(a.getAttribute("href")||"").replace(/^#/,"");if(tab)sendTabView(tab);if(tab==="admin")loadAdminDashboard();}));}
function accountAge(ts){const days=Math.max(0,Math.floor((Date.now()-Number(ts||Date.now()))/86400000));const years=Math.floor(days/365),months=Math.floor((days%365)/30);return years?years+" বছর "+months+" মাস":months?months+" মাস "+(days%30)+" দিন":days+" দিন";}
function renderAdminActivity(items){const el=$("#adminActivity");if(!items.length){el.innerHTML='<p class="admin-empty">এখনো কোনো Admin নেই।</p>';return;}el.innerHTML=items.map(x=>'<div class="report-row"><div class="report-label"><span>'+esc(x.email)+' · '+(x.role==="owner"?"Owner":"Admin")+'<small class="account-age">অ্যাকাউন্টের বয়স: '+accountAge(x.created_at)+'</small></span><strong>'+bn(x.post_count)+' পোস্ট</strong></div><div class="report-track"><i style="width:'+Math.max(2,Math.round(Number(x.post_count||0)/Math.max(1,...items.map(a=>Number(a.post_count||0)))*100))+'%"></i></div></div>').join("");}
function renderBars(el,items,labelKey,valueKey){if(!items.length){el.innerHTML='<p class="admin-empty">এখনো কোনো তথ্য নেই।</p>';return;}const max=Math.max(1,...items.map(x=>Number(x[valueKey]||0)));el.innerHTML=items.map(x=>{const n=Number(x[valueKey]||0),w=Math.max(2,Math.round(n/max*100));return '<div class="report-row"><div class="report-label"><span>'+esc(x[labelKey]||"অন্যান্য")+'</span><strong>'+bn(n)+'</strong></div><div class="report-track"><i style="width:'+w+'%"></i></div></div>';}).join("");}
async function startAdminPresence(){try{const me=await fetch("/api/auth/me",{credentials:"same-origin"}).then(r=>r.json());if(!me.authenticated||!["owner","admin"].includes(me.user?.role))return;const beat=()=>fetch("/api/admin/presence",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:"{}"}).catch(()=>{});beat();if(adminHeartbeat)clearInterval(adminHeartbeat);adminHeartbeat=setInterval(beat,30000);}catch{}}
async function loadAdminDashboard(){const guest=$("#adminGuest"),stats=$("#adminStats"),error=$("#adminError");if(!guest||!stats)return;guest.hidden=false;stats.hidden=true;error.hidden=true;try{const me=await fetch("/api/auth/me",{credentials:"same-origin"}).then(r=>r.json());if(!me.authenticated||!["owner","admin"].includes(me.user?.role))return;guest.hidden=true;stats.hidden=false;const data=await fetch("/api/admin/analytics",{credentials:"same-origin"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"ড্যাশবোর্ড লোড করা যায়নি।");return d;});$("#onlineAdminCount").textContent=bn(data.online_count);$("#totalAdminCount").textContent=bn(data.admin_count);$("#totalPostCount").textContent=bn(data.total_posts);$("#totalTabViews").textContent=bn(data.total_tab_views);renderAdminActivity(data.admins);renderBars($("#tabActivity"),data.tabs,"label","view_count");$("#adminUpdated").textContent="সর্বশেষ আপডেট: "+new Date().toLocaleTimeString("bn-BD");}catch(e){error.hidden=false;error.textContent=e.message;}}

function setSignedIn(user){setVisualEditor(user);const form=$("#headerLoginForm"),badge=$("#proBadge"),label=$("#drawerAccountLabel"),logout=$("#logoutButton"),upload=$("#quickUploadButton");form.hidden=!!user;badge.hidden=!user;logout.hidden=!user;if(upload)upload.hidden=!(user&&["owner","admin"].includes(user.role));label.textContent=!user?"অতিথি":user.role==="owner"?"Owner":user.role==="admin"?"Admin":"DRM- Member";if(user)startAdminPresence();}
function openAccountMenu(open){const drawer=$("#accountDrawer"),backdrop=$("#menuBackdrop"),toggle=$("#menuToggle");if(!drawer||!backdrop||!toggle)return;const state=Boolean(open);drawer.classList.toggle("open",state);backdrop.hidden=!state;drawer.setAttribute("aria-hidden",String(!state));toggle.setAttribute("aria-expanded",String(state));toggle.setAttribute("aria-label",state?"মেনু বন্ধ করুন":"মেনু খুলুন");document.body.classList.toggle("drawer-open",state);}
async function restoreAccount(){try{const me=await fetch("/api/auth/me",{credentials:"same-origin"}).then(r=>r.json());setSignedIn(me.authenticated?me.user:null);}catch{setSignedIn(null);}}
async function submitHeaderLogin(e){e.preventDefault();const form=e.currentTarget,button=$("#headerLoginButton"),status=$("#headerLoginStatus"),email=$("#headerEmail").value.trim(),password=$("#headerPassword").value;status.classList.remove("error");status.textContent="";button.disabled=true;button.textContent="...";try{const res=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({email,password})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"লগইন করা যায়নি।");const me=await fetch("/api/auth/me",{credentials:"same-origin"}).then(r=>r.json());if(!me.authenticated)throw new Error("লগইন সেশন তৈরি হয়নি। আবার চেষ্টা করুন।");form.reset();setSignedIn(me.user);status.textContent="";}catch(err){status.textContent=err.message;status.classList.add("error");}finally{button.disabled=false;button.textContent="Login";}}
let logoutToastTimer=null,logoutToastExitTimer=null;function displayAccountToast(id){const toast=$(id);if(logoutToastTimer)clearTimeout(logoutToastTimer);if(logoutToastExitTimer)clearTimeout(logoutToastExitTimer);document.querySelectorAll("#loginToast,#logoutToast").forEach(t=>{t.classList.remove("show","closing");t.setAttribute("aria-hidden","true");});toast.classList.add("show");toast.setAttribute("aria-hidden","false");logoutToastTimer=setTimeout(()=>{toast.classList.add("closing");logoutToastExitTimer=setTimeout(()=>{toast.classList.remove("show","closing");toast.setAttribute("aria-hidden","true");},380);},2000);}

async function submitLogout(){const button=$("#logoutButton");button.disabled=true;try{const res=await fetch("/api/auth/logout",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",credentials:"same-origin"});if(!res.ok)throw new Error("Logout করা যায়নি। আবার চেষ্টা করুন।");setSignedIn(null);openAccountMenu(false);}catch(e){$("#drawerAccountLabel").textContent=e.message;}finally{button.disabled=false;}}

async function init(){
 $("#headerLoginForm").addEventListener("submit",submitHeaderLogin);$("#menuToggle").addEventListener("click",()=>openAccountMenu(!$("#accountDrawer").classList.contains("open")));$("#menuClose").addEventListener("click",()=>openAccountMenu(false));$("#menuBackdrop").addEventListener("click",()=>openAccountMenu(false));$("#logoutButton").addEventListener("click",submitLogout);$("#accountDrawer").addEventListener("click",e=>{const action=e.target.closest("a,button,[role=menuitem]");if(action&&!action.matches("#logoutButton,#menuClose")&&!action.disabled)openAccountMenu(false);});document.addEventListener("keydown",e=>{if(e.key==="Escape")openAccountMenu(false);});document.addEventListener("pointerdown",e=>{const drawer=$("#accountDrawer"),toggle=$("#menuToggle");if(!drawer?.classList.contains("open"))return;if(drawer.contains(e.target)||toggle?.contains(e.target))return;openAccountMenu(false);},true);restoreAccount();$("#videoRows").addEventListener("click",e=>{const card=e.target.closest(".video-card");if(!card)return;const video=videos.find(v=>v.id===card.dataset.id);if(video)play(video);});$("#search").addEventListener("input",()=>{clearTimeout(searchRenderTimer);renderLimit=RENDER_BATCH;searchRenderTimer=setTimeout(render,140);});$("#categoryFilter").addEventListener("change",()=>{renderLimit=RENDER_BATCH;render();});$("#loadMoreVideos").addEventListener("click",()=>{renderLimit+=RENDER_BATCH;render(true);});trackNavigation();
 document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{const d=document.getElementById(b.dataset.close);d.close();$("#playerFrame").innerHTML="";});
 $("#playerDialog").addEventListener("close",()=>$("#playerFrame").innerHTML="");
 let apiReady=false;
 try{const [vr,cr,sr]=await Promise.all([fetch("/api/videos"),fetch("/api/categories"),fetch("/api/settings")]);if(vr.ok){videos=await vr.json();apiReady=true;}if(cr.ok)categories=await cr.json();if(sr.ok)settings=await sr.json();}
 catch(e){console.warn("DRM PREMIUM API is not available yet.",e);}
 if(!apiReady)videos=demoVideos;if(!categories.length)categories=[...new Set(videos.map(v=>v.category))].map(name=>({name}));
 applySettings();visualConfig={};try{visualConfig=JSON.parse(settings.visual_editor_config||"{}");}catch{}applyVisualConfig();initVisualEditor();render();
}

/* Full Website Builder — draft-only visual editor. */
let sbDoc=null,sbRevision=0,sbSelected=null,sbPageIndex=0,sbUndoStack=[],sbRedoStack=[],sbPreviewMode=false,sbDirty=false;
let sbLiveSelected=null,sbLiveHover=null,sbLiveFrame=null;
let sbLiveDraftDirty=false;
const SB_TYPES=["section","container","grid","column","text","heading","image","button","link","icon","card","list","divider","spacer","video","form","input","textarea","select","checkbox","navbar","footer","hero"];
const SB_LABELS={section:"Section",container:"Container",grid:"Grid",column:"Column",text:"Text",heading:"Heading",image:"Image",button:"Button",link:"Link",icon:"Icon",card:"Card",list:"List",divider:"Divider",spacer:"Spacer",video:"Video",form:"Form",input:"Input",textarea:"Textarea",select:"Select",checkbox:"Checkbox",navbar:"Navigation",footer:"Footer",hero:"Hero"};
function sbId(){return "n-"+crypto.randomUUID().replace(/-/g,"").slice(0,12);}
function sbPage(){if(!sbDoc?.pages?.length)return null;sbPageIndex=Math.max(0,Math.min(sbPageIndex,sbDoc.pages.length-1));return sbDoc.pages[sbPageIndex];}
function sbNodeList(nodes=sbPage()?.nodes){const out=[];for(const n of nodes||[]){out.push(n);if(Array.isArray(n.children))out.push(...sbNodeList(n.children));}return out;}
function sbFind(id,nodes=sbPage()?.nodes,parent=null){for(let i=0;i<(nodes||[]).length;i++){const n=nodes[i];if(n.id===id)return {node:n,nodes,index:i,parent};const found=sbFind(id,n.children||[],n);if(found)return found;}return null;}
function sbSnapshot(){return JSON.stringify(sbDoc);}
function sbMarkChange(){sbUndoStack.push(sbSnapshot());if(sbUndoStack.length>60)sbUndoStack.shift();sbRedoStack=[];sbDirty=true;$("#sbSaveState").textContent="Unsaved draft changes";sbRender();}
function sbNewNode(type){const props={};if(["text","heading","button","link","hero","navbar","footer","card"].includes(type))props.text=type==="heading"?"New heading":type==="button"?"Button label":"New "+(SB_LABELS[type]||type);if(type==="heading")props.level=2;if(type==="section"||type==="hero")props.background="#f1f4f7";if(type==="image")props.src="";return {id:sbId(),type,props,children:["section","container","grid","column","card","hero","navbar","footer"].includes(type)?[]:undefined};}
function sbSafeText(v){return String(v??"").slice(0,2000);}
function sbSelectLiveElement(el){
 if(!el||!el.isConnected)return;
 if(sbLiveSelected&&sbLiveSelected!==el)sbLiveSelected.style.outline=sbLiveSelected.dataset.sbOriginalOutline||"";
 sbLiveSelected=el;if(!el.dataset.sbOriginalOutline)el.dataset.sbOriginalOutline=el.style.outline||"";
 el.style.setProperty("outline","2px solid #e11d48","important");el.style.setProperty("outline-offset","2px","important");
 const cs=el.ownerDocument.defaultView.getComputedStyle(el),host=$("#sbInspectorBody");
 host.innerHTML='<p>Selected website element: <strong>'+esc(el.tagName.toLowerCase()+(el.id?"#"+el.id:""))+'</strong></p>'+(el.children.length===0?sbField("Text / label","liveText",(el.innerText||el.textContent||"").trim().slice(0,2000)):'<p class="sb-muted">Text editing is disabled for this container to preserve its child elements. Select a text element inside it.</p>')+sbField("Font size (px)","liveFontSize",parseFloat(cs.fontSize)||16,"number")+sbField("Text color","liveColor",rgbToHex(cs.color),"color")+sbField("Background","liveBackground",rgbToHex(cs.backgroundColor),"color")+'<div class="sb-inspector-actions"><button id="sbApplyLive" type="button">Apply preview</button><button id="sbSaveLive" type="button">Save website style</button></div><p class="sb-muted">Website navigation and actions are disabled in Builder mode.</p>';
 $("#sbSelectedType").textContent="Website · "+el.tagName.toLowerCase();
}
function rgbToHex(value){const m=String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);return m?"#"+[m[1],m[2],m[3]].map(v=>Number(v).toString(16).padStart(2,"0")).join(""):"#ffffff";}
function sbAttachLivePreview(frame){
 const wrap=frame.parentElement;
 if(!wrap||!wrap.classList.contains("sb-live-preview-wrap")){$("#sbMessage").textContent="Builder preview overlay could not initialize.";return;}
 let overlay=wrap.querySelector(".sb-live-edit-overlay");
 if(!overlay){overlay=document.createElement("div");overlay.className="sb-live-edit-overlay";overlay.setAttribute("aria-label","Website element selection layer");wrap.appendChild(overlay);}
 sbLiveFrame=frame;frame.style.pointerEvents="none";
 const getElement=e=>{
  let doc;try{doc=frame.contentDocument;if(!doc||!doc.body)return null;}catch{return null;}
  const r=frame.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  if(x<0||y<0||x>r.width||y>r.height)return null;
  return doc.elementFromPoint(x,y)?.closest("body *")||null;
 };
 overlay.addEventListener("click",e=>{
  e.preventDefault();e.stopPropagation();
  const el=getElement(e);if(el)sbSelectLiveElement(el);
 },true);
 overlay.addEventListener("pointermove",e=>{
  const el=getElement(e);if(!el||el===sbLiveSelected)return;
  if(sbLiveHover&&sbLiveHover!==sbLiveSelected)sbLiveHover.style.outline=sbLiveHover.dataset.sbHoverOutline||"";
  sbLiveHover=el;if(!el.dataset.sbHoverOutline)el.dataset.sbHoverOutline=el.style.outline||"";
  el.style.setProperty("outline","1px dashed #e11d48","important");
 },true);
 overlay.addEventListener("pointerleave",()=>{
  if(sbLiveHover&&sbLiveHover!==sbLiveSelected)sbLiveHover.style.outline=sbLiveHover.dataset.sbHoverOutline||"";
  sbLiveHover=null;
 });
 overlay.addEventListener("wheel",e=>{
  let doc;try{doc=frame.contentDocument;}catch{return;}
  if(!doc)return;e.preventDefault();
  const scroller=doc.scrollingElement||doc.documentElement;
  scroller.scrollTop+=e.deltaY;scroller.scrollLeft+=e.deltaX;
 },{passive:false});
 frame.addEventListener("load",()=>{
  try{if(!frame.contentDocument?.body)throw new Error();sbApplySavedLiveDraft(doc);$("#sbMessage").textContent="Editing mode active · click any website element to select it.";}
  catch{$("#sbMessage").textContent="Preview unavailable: same-origin access is required for editing.";}
 });
 try{if(frame.contentDocument?.body)$("#sbMessage").textContent="Editing mode active · click any website element to select it.";}
 catch{$("#sbMessage").textContent="Preview unavailable: same-origin access is required for editing.";}
}
function sbApplySavedLiveDraft(doc){
 const edits=sbDoc?.visualEdits;if(!edits||typeof edits!=="object")return;
 for(const [selector,item] of Object.entries(edits)){let el;try{el=doc.querySelector(selector)}catch{}if(!el||!item||typeof item!=="object")continue;
  if(typeof item.text==="string"&&item.replaceText===true&&el.children.length===0)el.textContent=item.text;
  if(Number.isFinite(item.fontSize)&&item.fontSize>=8&&item.fontSize<=96)el.style.fontSize=item.fontSize+"px";
  if(/^#[0-9a-f]{6}$/i.test(item.color||""))el.style.color=item.color;
  if(/^#[0-9a-f]{6}$/i.test(item.background||""))el.style.backgroundColor=item.background;
 }
}
function sbCaptureLiveDraft(){
 const el=sbLiveSelected,host=$("#sbInspectorBody");if(!el||!sbDoc)return false;
 const get=k=>host.querySelector('[data-sb-prop="'+k+'"]')?.value;
 const text=get("liveText"),font=Number(get("liveFontSize")),color=get("liveColor"),background=get("liveBackground");
 const selector=visualSelector(el);
 const item={fontSize:Number.isFinite(font)?Math.max(8,Math.min(96,font)):16,color:/^#[0-9a-f]{6}$/i.test(color||"")?color:"#ffffff",background:/^#[0-9a-f]{6}$/i.test(background||"")?background:"#ffffff",replaceText:text!==undefined&&el.children.length===0};
 if(item.replaceText)item.text=String(text).slice(0,2000);
 sbDoc.visualEdits=sbDoc.visualEdits||{};sbDoc.visualEdits[selector]=item;
 if(item.replaceText)el.textContent=item.text;
 el.style.fontSize=item.fontSize+"px";el.style.color=item.color;el.style.backgroundColor=item.background;
 sbLiveDraftDirty=true;sbDirty=true;
 return true;
}
function sbApplyLiveChanges(save){
 const el=sbLiveSelected,host=$("#sbInspectorBody");if(!el)return;
 const get=k=>host.querySelector('[data-sb-prop="'+k+'"]')?.value;
 const text=get("liveText"),font=Number(get("liveFontSize")),color=get("liveColor"),bg=get("liveBackground");
 if(text!==undefined&&el.children.length===0){if(el.matches("input,textarea"))el.value=text;else el.textContent=text;}
 if(Number.isFinite(font)&&font>=8&&font<=96)el.style.fontSize=font+"px";
 if(/^#[0-9a-f]{6}$/i.test(color||""))el.style.color=color;
 if(/^#[0-9a-f]{6}$/i.test(bg||""))el.style.backgroundColor=bg;
 if(!save){$("#sbMessage").textContent="Preview changes applied.";return;}
 const selector=visualSelector(el),item={selector,text:el.children.length===0?(el.innerText||el.textContent||"").slice(0,2000):"",replaceText:el.children.length===0,style:{fontSize:Math.min(96,Math.max(8,font||16)),color:color||"#ffffff",background:bg||"#ffffff",shadow:{color:"#000000",x:0,y:0,blur:0}}},config={...visualConfig,[selector]:item};
 fetch("/api/admin/settings",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({visual_editor_config:JSON.stringify(config)})}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Save failed");visualConfig=config;$("#sbMessage").textContent="Website style saved.";}).catch(e=>$("#sbMessage").textContent=e.message);
}
function sbLayerHTML(n,depth){return '<button class="sb-layer '+(n.id===sbSelected?'active':'')+'" data-sb-select="'+esc(n.id)+'" style="--depth:'+Math.min(depth,8)+'" type="button"><span>▧</span>'+esc(SB_LABELS[n.type]||n.type)+' <small>'+esc(n.id.slice(-5))+'</small></button>'+(n.children||[]).map(c=>sbLayerHTML(c,depth+1)).join("");}
function sbCanvasHTML(n){const p=n.props||{},txt=esc(p.text||SB_LABELS[n.type]||"");let inner="";if(n.type==="image")inner=p.src?'<img src="'+esc(p.src)+'" alt="'+esc(p.alt||"")+'">':'<div class="sb-image-placeholder">Image · add URL in settings</div>';else if(n.type==="divider")inner="<hr>";else if(n.type==="spacer")inner='<div style="height:'+(Number(p.height)||24)+'px"></div>';else inner=txt?'<span>'+txt+'</span>':"";const children=(n.children||[]).map(sbCanvasHTML).join("");return '<div class="sb-node sb-node-'+esc(n.type)+'" data-sb-node="'+esc(n.id)+'" style="'+(p.background?'background:'+esc(p.background)+';':'')+(p.color?'color:'+esc(p.color)+';':'')+(p.padding?'padding:'+Number(p.padding)+'px;':'')+'">'+(inner||'<span class="sb-node-kind">'+esc(SB_LABELS[n.type])+'</span>')+children+'</div>';}
function sbField(label,key,value,type="text"){return '<label class="sb-field">'+label+'<input data-sb-prop="'+key+'" type="'+type+'" value="'+esc(value??"")+'"></label>';}
function sbRenderInspector(){const host=$("#sbInspectorBody"),found=sbSelected?sbFind(sbSelected):null;if(!found){host.innerHTML='<p>Canvas বা Layers থেকে কোনো element নির্বাচন করুন।</p>';return;}const n=found.node,p=n.props||{};let h=sbField("Text / label","text",p.text||"");if(n.type==="image")h+=sbField("Image URL","src",p.src||"")+sbField("Alt text","alt",p.alt||"");h+=sbField("Background color","background",p.background||"#ffffff","color")+sbField("Text color","color",p.color||"#202833","color")+sbField("Padding (px)","padding",p.padding??16,"number");if(["heading","text"].includes(n.type))h+=sbField("Font size (px)","fontSize",p.fontSize??24,"number");if(n.type==="spacer")h+=sbField("Height (px)","height",p.height??24,"number");h+='<div class="sb-inspector-actions"><button id="sbAddChild" type="button">＋ Add inside</button><button id="sbMoveUp" type="button">↑ Move</button><button id="sbMoveDown" type="button">↓ Move</button><button id="sbDelete" class="danger" type="button">Delete</button></div><p class="sb-muted">Element ID: '+esc(n.id)+'</p>';host.innerHTML=h;}
function sbRenderSelectedOnly(){sbRender();}
function sbInsert(type,parentId=null){
 const target=parentId?sbFind(parentId)?.node:null;
 const canContain=["section","container","grid","column","card","hero","navbar","footer"];
 if(parentId&&(!target||!canContain.includes(target.type))){$("#sbMessage").textContent="এই element-এর ভেতরে নতুন element যোগ করা যাবে না।";return;}
 sbMarkChange();const node=sbNewNode(type);const list=target?(target.children||(target.children=[])):sbPage().nodes;list.push(node);sbSelected=node.id;sbRender();
}
function sbAddPicker(parentId=null){const choice=prompt("Add component: "+SB_TYPES.join(", "),"text");if(!choice)return;if(!SB_TYPES.includes(choice.trim())){alert("Unsupported component type.");return;}sbInsert(choice.trim(),parentId);}
function sbBindEvents(){
 const canvas=$("#sbCanvas"),layers=$("#sbLayers");
 canvas.onclick=e=>{const n=e.target.closest("[data-sb-node]");if(n){sbSelected=n.dataset.sbNode;sbRender();}};
 layers.onclick=e=>{const b=e.target.closest("[data-sb-select]");if(b){sbSelected=b.dataset.sbSelect;sbRender();}};
 canvas.ondragstart=e=>{const n=e.target.closest("[data-sb-node]");if(n)e.dataTransfer.setData("text/plain",n.dataset.sbNode);};
 canvas.ondragover=e=>{if(e.target.closest("[data-sb-node]"))e.preventDefault();};
 canvas.ondrop=e=>{
  const target=e.target.closest("[data-sb-node]"),id=e.dataTransfer.getData("text/plain");if(!target||!id||id===target.dataset.sbNode)return;e.preventDefault();
  const from=sbFind(id),to=sbFind(target.dataset.sbNode),canContain=["section","container","grid","column","card","hero","navbar","footer"];
  if(!from||!to||!canContain.includes(to.node.type))return;
  const descendants=node=>[...(node.children||[]),...(node.children||[]).flatMap(descendants)];
  if(descendants(from.node).some(n=>n.id===to.node.id)){ $("#sbMessage").textContent="নিজের child-এর ভেতরে element সরানো যাবে না।";return; }
  sbMarkChange();const source=sbFind(id),destination=sbFind(target.dataset.sbNode);if(!source||!destination)return;
  const [moved]=source.nodes.splice(source.index,1);(destination.node.children||(destination.node.children=[])).push(moved);sbSelected=id;sbRender();
 };
}
function sbRender(){
 if(!sbDoc)return;const page=sbPage();if(!page)return;if(sbSelected&&!sbFind(sbSelected))sbSelected=null;
 $("#sbPage").innerHTML=sbDoc.pages.map((p,i)=>'<option value="'+i+'">'+esc(p.title||p.slug)+'</option>').join("");$("#sbPage").value=String(sbPageIndex);
 $("#sbLayers").innerHTML=(page.nodes||[]).map(n=>sbLayerHTML(n,0)).join("")||'<p class="sb-muted">No elements yet.</p>';
 const canvas=$("#sbCanvas");let preview=canvas.querySelector(".sb-live-preview");
 if(!preview){canvas.innerHTML='<div class="sb-live-preview-head"><strong>বর্তমান DRM PREMIUM ওয়েবসাইট</strong><span>Live reference preview · read-only</span></div><div class="sb-live-preview-wrap"><iframe class="sb-live-preview" title="বর্তমান DRM PREMIUM ওয়েবসাইটের প্রিভিউ" src="/?builderPreview=1#home" loading="eager"></iframe></div><div class="sb-draft-area"><div class="sb-draft-area-head"><strong>Builder Draft Elements</strong><span>এখানে নতুন draft elements তৈরি ও সাজানো যাবে</span></div><div id="sbDraftNodes"></div></div>';}
 preview=canvas.querySelector(".sb-live-preview");if(preview&&!preview.dataset.sbBound){preview.dataset.sbBound="1";sbAttachLivePreview(preview);preview.dataset.sbBound="1";}
 $("#sbDraftNodes").innerHTML=(page.nodes||[]).map(n=>sbCanvasHTML(n)).join("")||'<div class="sb-empty">Draft এখনো খালি। বাম পাশের ＋ Section বা ＋ Element দিয়ে শুরু করুন।</div>';
 $("#sbSelectedType").textContent=sbSelected?(SB_LABELS[sbFind(sbSelected)?.node?.type]||"Selected"):"Nothing selected";
 canvas.querySelectorAll("[data-sb-node]").forEach(el=>{el.classList.toggle("sb-selected",el.dataset.sbNode===sbSelected);el.draggable=true;});sbRenderInspector();
}
async function openSiteBuilder(){const me=await fetch("/api/auth/me",{credentials:"same-origin"}).then(r=>r.json()).catch(()=>({}));if(!me.authenticated||me.user?.role!=="owner"){alert("শুধু Owner Website Builder ব্যবহার করতে পারবেন।");return;}$("#siteBuilder").hidden=false;document.body.classList.add("sb-open");$("#sbSaveState").textContent="Loading draft…";try{const r=await fetch("/api/builder/state",{credentials:"same-origin"}),d=await r.json();if(!r.ok)throw new Error(d.error||"Builder load failed");sbDoc=d.document;sbRevision=d.revision||0;sbSelected=null;sbUndoStack=[];sbRedoStack=[];sbDirty=false;$("#sbSaveState").textContent="Draft revision "+sbRevision;$("#sbMessage").textContent="Draft only · public website unchanged";sbBindEvents();sbRender();}catch(e){$("#sbMessage").textContent=e.message;}}
async function sbSaveDraft(){
 if(!sbDoc){$("#sbMessage").textContent="Draft এখনও load হয়নি। Builder বন্ধ করে আবার খোলো।";return;}
 const b=$("#sbSave");if(b.disabled)return;
 if(sbLiveSelected)sbCaptureLiveDraft();
 b.disabled=true;b.textContent="Saving…";$("#sbSaveState").textContent="Saving…";$("#sbMessage").textContent="Draft ও নির্বাচিত website changes সংরক্ষণ হচ্ছে…";
 try{
  const r=await fetch("/api/builder/draft",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({baseRevision:sbRevision,document:sbDoc})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||("Save failed (HTTP "+r.status+")"));
  if(!Number.isInteger(d.revision))throw new Error("Server response-এ revision পাওয়া যায়নি।");
  sbRevision=d.revision;sbDirty=false;sbLiveDraftDirty=false;
  $("#sbSaveState").textContent="Saved · revision "+sbRevision;
  $("#sbMessage").textContent="Draft এবং website-এর নির্বাচিত পরিবর্তন সংরক্ষিত হয়েছে। এগুলো এখনো public website-এ প্রকাশিত হয়নি।";
 }catch(e){
  $("#sbSaveState").textContent="Save failed";$("#sbMessage").textContent="সংরক্ষণ ব্যর্থ: "+e.message;
 }finally{b.disabled=false;b.textContent="Save Draft";}
}
function initSiteBuilder(){const $id=id=>document.getElementById(id);$id("sbExit").onclick=()=>{$id("siteBuilder").hidden=true;document.body.classList.remove("sb-open");};$id("sbSave").onclick=sbSaveDraft;$id("sbAddSection").onclick=()=>sbInsert("section");$id("sbAddElement").onclick=()=>sbAddPicker();$id("sbAddPage").onclick=()=>{const title=prompt("Page title?","New page");if(!title)return;const baseSlug=title.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");const slug="/"+(baseSlug||("page-"+Date.now()));if(sbDoc.pages.some(p=>p.slug===slug)){alert("এই URL আগে থেকেই আছে।");return;}sbMarkChange();sbDoc.pages.push({id:sbId(),slug,title:title.slice(0,120),nodes:[]});sbPageIndex=sbDoc.pages.length-1;sbSelected=null;sbRender();};$id("sbPage").onchange=e=>{sbPageIndex=Number(e.target.value)||0;sbSelected=null;sbRender();};$id("sbPreview").onclick=()=>{sbPreviewMode=!sbPreviewMode;$id("sbCanvas").classList.toggle("tablet",sbPreviewMode);$id("sbViewportLabel").textContent=sbPreviewMode?"Tablet":"Desktop";};$id("sbHistory").onclick=async()=>{const d=$id("sbHistoryDialog");$id("sbHistoryList").textContent="Loading…";d.showModal();try{const r=await fetch("/api/builder/history",{credentials:"same-origin"}),x=await r.json();$id("sbHistoryList").innerHTML=(x.revisions||[]).map(v=>'<div class="sb-history-row">Revision '+v.revision+' · '+esc(v.summary||"Draft")+' · '+new Date(v.created_at*1000).toLocaleString()+'</div>').join("")||"No history yet";}catch(e){$id("sbHistoryList").textContent=e.message;}};$id("sbUndo").onclick=()=>{if(!sbUndoStack.length)return;sbRedoStack.push(sbSnapshot());sbDoc=JSON.parse(sbUndoStack.pop());sbDirty=true;sbRender();};$id("sbRedo").onclick=()=>{if(!sbRedoStack.length)return;sbUndoStack.push(sbSnapshot());sbDoc=JSON.parse(sbRedoStack.pop());sbDirty=true;sbRender();};$id("sbInspectorBody").addEventListener("click",e=>{if(e.target.id==="sbApplyLive")sbApplyLiveChanges(false);if(e.target.id==="sbSaveLive")sbApplyLiveChanges(true);});$id("sbInspectorBody").addEventListener("input",e=>{if(e.target.dataset.sbProp?.startsWith("live")){const el=sbLiveSelected;if(!el)return;const key=e.target.dataset.sbProp,v=e.target.value;if(key==="liveFontSize"&&Number(v)>=8&&Number(v)<=96)el.style.fontSize=Number(v)+"px";if(key==="liveColor"&&/^#[0-9a-f]{6}$/i.test(v))el.style.color=v;if(key==="liveBackground"&&/^#[0-9a-f]{6}$/i.test(v))el.style.backgroundColor=v;if(key==="liveText"&&el.children.length===0)el.textContent=v;return;}});$id("sbInspectorBody").addEventListener("change",e=>{if(e.target.dataset.sbProp?.startsWith("live"))return;const key=e.target.dataset.sbProp;if(!key||!sbSelected)return;const found=sbFind(sbSelected);if(!found)return;sbMarkChange();let v=e.target.type==="number"?Number(e.target.value):e.target.value;if(["padding","fontSize","height"].includes(key))v=Math.max(0,Math.min(1200,v));found.node.props=found.node.props||{};found.node.props[key]=v;sbRender();});$id("sbInspectorBody").addEventListener("click",e=>{const id=e.target.id;if(id==="sbAddChild")sbAddPicker(sbSelected);if(id==="sbDelete"&&sbSelected){const f=sbFind(sbSelected);if(f){sbMarkChange();f.nodes.splice(f.index,1);sbSelected=null;sbRender();}}if((id==="sbMoveUp"||id==="sbMoveDown")&&sbSelected){const f=sbFind(sbSelected);if(f){const next=f.index+(id==="sbMoveUp"?-1:1);if(next>=0&&next<f.nodes.length){sbMarkChange();[f.nodes[f.index],f.nodes[next]]=[f.nodes[next],f.nodes[f.index]];sbRender();}}}});$id("sbCanvas").addEventListener("dblclick",e=>{const n=e.target.closest("[data-sb-node]");if(n){sbSelected=n.dataset.sbNode;const f=sbFind(sbSelected);if(f&&f.node.props.text!==undefined){const v=prompt("Edit text",f.node.props.text);if(v!==null){sbMarkChange();f.node.props.text=sbSafeText(v);sbRender();}}}});}

initSiteBuilder();
init();