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
let playerClosing=false;
function play(v){
 const dialog=$("#playerDialog");
 if(playerClosing)return;
 $("#playerTitle").textContent=v.title;
 $("#playerDescription").textContent=v.description||"";
 $("#playerFrame").innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.youtube_id)}?autoplay=1&rel=0" title="${esc(v.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
 if(dialog.open)return;
 dialog.showModal();
 if(dialog.animate){
  dialog.animate(
   [{opacity:0,transform:"translateY(22px) scale(.965)"},{opacity:1,transform:"translateY(0) scale(1)"}],
   {duration:700,easing:"cubic-bezier(.16,1,.3,1)",fill:"both"}
  );
 }
}
function closePlayer(){
 const dialog=$("#playerDialog");
 if(!dialog?.open||playerClosing)return;
 playerClosing=true;
 const finish=()=>{
  if(dialog.open)dialog.close();
  $("#playerFrame").innerHTML="";
  playerClosing=false;
 };
 if(!dialog.animate){finish();return;}
 const animation=dialog.animate(
  [{opacity:1,transform:"translateY(0) scale(1)"},{opacity:0,transform:"translateY(14px) scale(.975)"}],
  {duration:350,easing:"cubic-bezier(.4,0,1,1)",fill:"forwards"}
 );
 animation.onfinish=finish;
}
function applySettings(){
 const pairs={heroEyebrow:"hero_eyebrow",libraryEyebrow:"library_eyebrow",libraryTitle:"library_title",footerText:"footer_text"};
 for(const [id,key] of Object.entries(pairs)){const el=$("#"+id);if(el&&settings[key])el.textContent=settings[key];}
  // Keep the public brand canonical; legacy site_name settings must not overwrite it.
  $("#brandName").innerHTML='<span class="brand-word-main">DRM–</span><span class="brand-word-accent">Premium</span>';
  $("#footerBrand").textContent="DRM PREMIUM";
 if(settings.hero_image)$("#hero").style.backgroundImage=`linear-gradient(90deg,#080808 0%,rgba(8,8,8,.86) 32%,rgba(8,8,8,.12) 100%),url("${settings.hero_image}")`;
 if(settings.show_hero==="false")$("#hero").hidden=true;
 if(settings.show_library==="false")$("#browse").hidden=true;
 if(settings.accent_color&&/^#[0-9a-f]{6}$/i.test(settings.accent_color)){document.documentElement.style.setProperty("--red",settings.accent_color);document.documentElement.style.setProperty("--accent",settings.accent_color);}
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
 const toggle=$("#visualEditorToggle");if(!toggle)return;
 const isOwner=Boolean(user&&user.role==="owner");
 toggle.hidden=Boolean(new URLSearchParams(location.search).has("builderPreview"))||!isOwner;
 toggle.dataset.owner=isOwner?"true":"false";
 if(!isOwner)window.DULM?.setOwner(false);
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
 // The floating Owner pencil is now the DULM Folder Editing Mode toggle.
 $("#veClose").onclick=()=>{visualMode=false;panel.hidden=true;document.body.classList.remove("visual-editor-active");toggle.classList.remove("active");};
 document.addEventListener("click",e=>{if(!visualMode||panel.contains(e.target)||e.target===toggle)return;const el=e.target.closest("h1,h2,h3,h4,p,a,button,label,span,small,strong,li");if(!el||el.closest("#visualEditorPanel")||el.children.length)return;e.preventDefault();e.stopPropagation();selectVisualElement(el);},{capture:true});
 $("#veApply").onclick=()=>{const item=visualDraft();if(!item){$("#veStatus").textContent="আগে একটি লেখা নির্বাচন করুন।";return;}applyVisualDraft(item);visualConfig[item.selector]=item;$("#veStatus").textContent="Preview প্রয়োগ হয়েছে। Save Changes চাপলে স্থায়ী হবে।";};
 $("#veSave").onclick=async()=>{const item=visualDraft();if(!item){$("#veStatus").textContent="আগে একটি লেখা নির্বাচন করুন।";return;}if(!confirm("এই style পরিবর্তন বর্তমান environment-এর public website-এ প্রয়োগ হবে। Save করবেন?"))return;applyVisualDraft(item);visualConfig[item.selector]=item;const button=$("#veSave");button.disabled=true;$("#veStatus").textContent="সংরক্ষণ হচ্ছে…";try{const r=await fetch("/api/admin/settings",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({visual_editor_config:JSON.stringify(visualConfig)})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Save করা যায়নি।");$("#veStatus").textContent="Public website style সংরক্ষিত হয়েছে; পরবর্তী page load-এ দেখা যাবে।";}catch(err){$("#veStatus").textContent=err.message;}finally{button.disabled=false;}};
 $("#veReset").onclick=()=>{if(!visualSelected)return;if(!confirm("নির্বাচিত element-এর saved style বর্তমান public website থেকে reset হবে। Continue?"))return;const id=visualSelector(visualSelected);delete visualConfig[id];visualSelected.removeAttribute("style");fetch("/api/admin/settings",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({visual_editor_config:JSON.stringify(visualConfig)})}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Reset save failed");$("#veStatus").textContent="নির্বাচিত public website style reset ও সংরক্ষণ হয়েছে।";}).catch(e=>$("#veStatus").textContent=e.message);};
}

function videoCardHTML(v){
 return `<article class="video-card" data-id="${esc(v.id)}"><img class="thumb" src="${esc(thumb(v))}" alt="" width="640" height="360" loading="lazy" decoding="async" fetchpriority="low" onerror="this.onerror=null;this.src='https://placehold.co/640x360/17152e/e9e2ff?text=DRM+PREMIUM'"><div class="card-copy"><h4>${esc(v.title)}</h4><p>${esc(v.description||"ভিডিও দেখুন")}</p></div></article>`;
}
function renderCategoryTabs(){
 const host=$("#categoryTabs");if(!host)return;
 const names=[...new Set(categories.map(c=>c.name).filter(Boolean))];
 const all=[{name:"All",value:"all"},...names.map(name=>({name,value:name})),{name:"Movies",value:"__movies__"}];
 const onMoviesPage=location.pathname.replace(/\/+$/,"")==="/movies";
 const activeValue=onMoviesPage?"__movies__":($("#categoryFilter")?.value||"all");
 host.innerHTML=all.map(item=>{
  const active=activeValue===item.value;
  if(item.value==="__movies__")return '<a class="category-chip '+(active?'active':'')+'" href="/movies" data-category="__movies__"'+(active?' aria-current="page"':'')+'>Movies</a>';
  return '<button type="button" class="category-chip '+(active?'active':'')+'" data-category="'+esc(item.value)+'">'+esc(item.name)+'</button>';
 }).join("");
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
 renderCategoryTabs();
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
function accountAge(ts){const raw=Number(ts||Date.now()),createdAt=raw<1e12?raw*1000:raw,days=Math.max(0,Math.floor((Date.now()-createdAt)/86400000));const years=Math.floor(days/365),months=Math.floor((days%365)/30);return years?years+" বছর "+months+" মাস":months?months+" মাস "+(days%30)+" দিন":days+" দিন";}
function renderAdminActivity(items){const el=$("#adminActivity");if(!items.length){el.innerHTML='<p class="admin-empty">এখনো কোনো Admin নেই।</p>';return;}el.innerHTML=items.map(x=>'<div class="report-row"><div class="report-label"><span>'+esc(x.email)+' · '+(x.role==="owner"?"Owner":"Admin")+'<small class="account-age">অ্যাকাউন্টের বয়স: '+accountAge(x.created_at)+'</small></span><strong>'+bn(x.post_count)+' পোস্ট</strong></div><div class="report-track"><i style="width:'+Math.max(2,Math.round(Number(x.post_count||0)/Math.max(1,...items.map(a=>Number(a.post_count||0)))*100))+'%"></i></div></div>').join("");}
function renderBars(el,items,labelKey,valueKey){if(!items.length){el.innerHTML='<p class="admin-empty">এখনো কোনো তথ্য নেই।</p>';return;}const max=Math.max(1,...items.map(x=>Number(x[valueKey]||0)));el.innerHTML=items.map(x=>{const n=Number(x[valueKey]||0),w=Math.max(2,Math.round(n/max*100));return '<div class="report-row"><div class="report-label"><span>'+esc(x[labelKey]||"অন্যান্য")+'</span><strong>'+bn(n)+'</strong></div><div class="report-track"><i style="width:'+w+'%"></i></div></div>';}).join("");}
async function startAdminPresence(){const beat=()=>fetch("/api/presence",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:"{}"}).catch(()=>{});beat();if(adminHeartbeat)clearInterval(adminHeartbeat);adminHeartbeat=setInterval(beat,30000);}
async function loadAdminDashboard(){const guest=$("#adminGuest"),stats=$("#adminStats"),error=$("#adminError");if(!guest||!stats)return;guest.hidden=false;stats.hidden=true;error.hidden=true;try{const me=await fetch("/api/auth/me",{credentials:"same-origin"}).then(r=>r.json());if(!me.authenticated||!["owner","admin"].includes(me.user?.role))return;guest.hidden=true;stats.hidden=false;const data=await fetch("/api/admin/analytics",{credentials:"same-origin"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"ড্যাশবোর্ড লোড করা যায়নি।");return d;});$("#onlineAdminCount").textContent=bn(data.online_count);$("#totalAdminCount").textContent=bn(data.admin_count);$("#totalPostCount").textContent=bn(data.total_posts);$("#totalTabViews").textContent=bn(data.total_tab_views);renderAdminActivity(data.admins);renderBars($("#tabActivity"),data.tabs,"label","view_count");$("#adminUpdated").textContent="সর্বশেষ আপডেট: "+new Date().toLocaleTimeString("bn-BD");}catch(e){error.hidden=false;error.textContent=e.message;}}

function setSignedIn(user){setVisualEditor(user);const form=$("#headerLoginForm"),toggle=$("#profileMenuToggle"),upload=$("#quickUploadButton"),sideUpload=$("#sidebarUpload"),logoutArea=$("#sidebarLogoutArea");if(form)form.hidden=!!user;if(toggle)toggle.hidden=!user;if(!user){closeProfileDrawer();renderAccountProfile(null,null);}else loadAccountProfile(user);if(upload)upload.hidden=!(user&&["owner","admin"].includes(user.role));if(sideUpload)sideUpload.hidden=!(user&&["owner","admin"].includes(user.role));if(logoutArea)logoutArea.hidden=!user;startAdminPresence();if(user&&!suspensionPoll)suspensionPoll=setInterval(checkAccountAccess,5000);else if(!user&&suspensionPoll){clearInterval(suspensionPoll);suspensionPoll=null;}}
let accountProfileData=null;
function renderAccountProfile(user,profile){accountProfileData={user,profile};const profileComplete=Boolean(String(profile?.full_name||"").trim());const profileLink=$("#profileDrawerView");if(profileLink)profileLink.innerHTML=(profileComplete?"View Profile":"Setup Profile")+' <span aria-hidden="true">→</span>';const initial=(String(profile?.full_name||user?.username||"U").trim()[0]||"U").toUpperCase(),avatar=profile?.avatar_url||"";const headerImg=$("#headerProfileAvatar"),headerInitial=$("#headerProfileInitial"),drawerImg=$("#drawerAvatarImage"),drawerInitial=$("#drawerAvatarInitial");if(headerImg){headerImg.hidden=!avatar;headerImg.src=avatar||"";}if(headerInitial){headerInitial.hidden=!!avatar;headerInitial.textContent=initial;}if(drawerImg){drawerImg.hidden=!avatar;drawerImg.src=avatar||"";}if(drawerInitial){drawerInitial.hidden=!!avatar;drawerInitial.textContent=initial;}$("#drawerFullName").textContent=profile?.full_name||"Profile not completed";$("#drawerUsername").textContent=user?.username?"@"+user.username:"";$("#drawerBio").textContent=profile?.bio||"Not added yet";$("#drawerDob").textContent=profile?.date_of_birth||"Not added";$("#drawerGender").textContent=({female:"Female",male:"Male",non_binary:"Non-binary",prefer_not_to_say:"Prefer not to say"})[profile?.gender]||"Not specified";$("#drawerLocation").textContent=profile?.location||"Not added";$("#drawerEmail").textContent=user?.email||"—";}
async function loadAccountProfile(user){try{const response=await fetch("/api/profile",{credentials:"same-origin",cache:"no-store"});if(!response.ok)throw new Error("Profile unavailable");const data=await response.json();renderAccountProfile(user,data.profile||{});}catch{renderAccountProfile(user,null);}}
function openProfileDrawer(open){const panel=$("#profileDrawer"),backdrop=$("#profileDrawerBackdrop"),toggle=$("#profileMenuToggle");if(!panel||!backdrop||!toggle)return;const state=Boolean(open);if(state){backdrop.hidden=false;panel.setAttribute("aria-hidden","false");document.body.classList.add("profile-drawer-open");requestAnimationFrame(()=>{backdrop.classList.add("is-visible");panel.classList.add("is-open");});toggle.setAttribute("aria-expanded","true");}else{panel.classList.remove("is-open");panel.setAttribute("aria-hidden","true");backdrop.classList.remove("is-visible");document.body.classList.remove("profile-drawer-open");toggle.setAttribute("aria-expanded","false");setTimeout(()=>{if(!panel.classList.contains("is-open"))backdrop.hidden=true;},300);}}
function closeProfileDrawer(){openProfileDrawer(false);}
let accountMenuCloseTimer=null;
const accountMenuBreakpoint=window.matchMedia("(max-width: 760px)");accountMenuBreakpoint.addEventListener?.("change",()=>openAccountMenu(false));
function openAccountMenu(open){
 const sidebar=$("#ytSidebar"),backdrop=$("#sidebarBackdrop"),toggle=$("#menuToggle");if(!sidebar||!toggle)return;
 const mobile=window.matchMedia("(max-width: 760px)").matches,state=Boolean(open);
 clearTimeout(accountMenuCloseTimer);
 if(mobile&&window.DRMMotion){window.DRMMotion.drawer({sidebar,backdrop,toggle,open:state});return;}
 /* Match Admin's state transition: reset to the closed frame, force layout,
    then apply the same sidebar-open trigger before adding the mobile overlay state. */
 sidebar.classList.remove("mobile-open");
 document.body.classList.remove("drawer-open");
 void sidebar.offsetWidth;
 document.body.classList.toggle("sidebar-open",state);
 if(backdrop){
  backdrop.classList.remove("is-closing");
  if(state&&mobile){backdrop.hidden=false;backdrop.style.opacity="0";void backdrop.offsetWidth;backdrop.style.opacity="";}
 }
 if(state&&mobile){
  document.body.classList.add("drawer-open");
  sidebar.classList.add("mobile-open");
 }else if(!state&&backdrop&&!backdrop.hidden){
  backdrop.classList.add("is-closing");
  accountMenuCloseTimer=setTimeout(()=>{backdrop.hidden=true;backdrop.classList.remove("is-closing");},720);
 }
 toggle.setAttribute("aria-expanded",String(state));
 toggle.setAttribute("aria-label",state?"মেনু বন্ধ করুন":"মেনু খুলুন");
}
let suspensionPoll=null,suspensionClock=null,suspensionExpiry=0,suspensionStarted=0;
function renderSuspensionClock(){
 const screen=$("#accountSuspensionScreen");if(!screen||screen.hidden||!suspensionExpiry)return;
 const remaining=Math.max(0,Math.ceil(suspensionExpiry-Date.now()/1000));
 const h=Math.floor(remaining/3600),m=Math.floor((remaining%3600)/60),s=remaining%60;
 $("#suspensionHours").textContent=String(h).padStart(2,"0");
 $("#suspensionMinutes").textContent=String(m).padStart(2,"0");
 $("#suspensionSeconds").textContent=String(s).padStart(2,"0");
 const total=Math.max(1,suspensionExpiry-suspensionStarted);
 $("#suspensionProgress").style.width=Math.max(0,Math.min(100,(remaining/total)*100))+"%";
 if(remaining===0)checkAccountAccess();
}
function showSuspensionScreen(restriction){
 const screen=$("#accountSuspensionScreen");if(!screen||!restriction)return;
 if(restriction.type!=="suspend"||!restriction.expiresAt)return;
 suspensionExpiry=Number(restriction.expiresAt);suspensionStarted=Number(restriction.createdAt||Math.floor(Date.now()/1000));
 $("#suspensionRestoreAt").textContent=new Date(suspensionExpiry*1000).toLocaleString([], {dateStyle:"medium",timeStyle:"short"});
 const reason=String(restriction.reason||"").trim();
 $("#suspensionReasonWrap").hidden=!reason;$("#suspensionReason").textContent=reason;
 screen.hidden=false;document.body.classList.add("account-suspended");
 renderSuspensionClock();
 if(!suspensionClock)suspensionClock=setInterval(renderSuspensionClock,1000);
 if(!suspensionPoll)suspensionPoll=setInterval(checkAccountAccess,5000);
}
function hideSuspensionScreen(){
 const screen=$("#accountSuspensionScreen");if(screen)screen.hidden=true;
 document.body.classList.remove("account-suspended");suspensionExpiry=0;
 if(suspensionClock){clearInterval(suspensionClock);suspensionClock=null;}
 if(suspensionPoll){clearInterval(suspensionPoll);suspensionPoll=null;}
}
async function checkAccountAccess(){
 try{
  const response=await fetch("/api/auth/access-state",{credentials:"same-origin",cache:"no-store"});
  const data=await response.json();
  if(data.restricted&&data.restriction?.type==="suspend"){showSuspensionScreen(data.restriction);return true;}
  if(!data.restricted&&$("#accountSuspensionScreen")&&!$("#accountSuspensionScreen").hidden){hideSuspensionScreen();const me=await fetch("/api/auth/me",{credentials:"same-origin"}).then(r=>r.json());setSignedIn(me.authenticated?me.user:null);return false;}
  return false;
 }catch{return false;}
}
$("#suspensionCheckButton")?.addEventListener("click",checkAccountAccess);
async function restoreAccount(){try{const access=await fetch("/api/auth/access-state",{credentials:"same-origin",cache:"no-store"}).then(r=>r.json());if(access.restricted&&access.restriction?.type==="suspend"){showSuspensionScreen(access.restriction);return;}const me=await fetch("/api/auth/me",{credentials:"same-origin"}).then(r=>r.json());setSignedIn(me.authenticated?me.user:null);}catch{setSignedIn(null);}}
async function requestRegistrationCode(){
 const button=$("#registerSendCode"),status=$("#registerStatus"),email=$("#registerEmail").value.trim(),username=$("#registerUsername").value.trim(),password=$("#registerPassword").value;
 status.classList.remove("error");status.textContent="";$("#registerDeliveryHint").hidden=true;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){status.textContent="সঠিক ইমেইল ঠিকানা দিন।";status.classList.add("error");return;}
 if(!/^[A-Za-z0-9_]{3,30}$/.test(username)){status.textContent="Username ৩–৩০ অক্ষরের হতে হবে; শুধু English letter, number ও underscore ব্যবহার করুন।";status.classList.add("error");return;}
 if(password.length<8||password.length>200){status.textContent="Password কমপক্ষে ৮ এবং সর্বোচ্চ ২০০ অক্ষরের হতে হবে।";status.classList.add("error");return;}
 button.disabled=true;button.textContent="Sending…";
 try{const res=await fetch("/api/auth/register-otp",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({email,username,password})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"Verification code পাঠানো যায়নি।");$("#registerOtpGroup").hidden=false;$("#registerVerify").hidden=false;$("#registerCode").required=true;status.textContent=data.message||"ইমেইলে verification code পাঠানো হয়েছে।";$("#registerDeliveryHint").hidden=false;$("#registerCode").focus();}
 catch(error){$("#registerDeliveryHint").hidden=true;status.textContent=error.message;status.classList.add("error");}
 finally{button.disabled=false;button.textContent="Resend code";}
}
async function submitRegistration(e){
 e.preventDefault();const button=$("#registerVerify"),status=$("#registerStatus"),email=$("#registerEmail").value.trim(),username=$("#registerUsername").value.trim(),password=$("#registerPassword").value,code=$("#registerCode").value.trim();
 status.classList.remove("error");status.textContent="";
 if(!/^\d{6}$/.test(code)){status.textContent="ইমেইলে পাওয়া ৬ সংখ্যার কোড দিন।";status.classList.add("error");return;}
 button.disabled=true;button.textContent="Verifying…";
 try{const res=await fetch("/api/auth/register-verify",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({email,username,password,code})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"অ্যাকাউন্ট তৈরি করা যায়নি।");const me=await fetch("/api/auth/me",{credentials:"same-origin"}).then(r=>r.json());if(!me.authenticated)throw new Error("অ্যাকাউন্ট তৈরি হয়েছে, কিন্তু Login session শুরু হয়নি। Login করুন।");$("#registerDialog").close();$("#registerForm").reset();$("#registerOtpGroup").hidden=true;$("#registerVerify").hidden=true;$("#registerCode").required=false;$("#registerSendCode").textContent="Send verification code";$("#headerLoginForm").reset();setSignedIn(me.user);$("#headerLoginStatus").textContent="Account created successfully.";showProfileCompleteBar();}
 catch(error){status.textContent=error.message;status.classList.add("error");}
 finally{button.disabled=false;button.textContent="Verify & create account";}
}
async function submitHeaderLogin(e){e.preventDefault();const form=e.currentTarget,button=$("#headerLoginButton"),status=$("#headerLoginStatus"),email=$("#headerEmail").value.trim(),password=$("#headerPassword").value;status.classList.remove("error");status.textContent="";button.disabled=true;button.textContent="...";try{const res=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({email,password})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"লগইন করা যায়নি।");const me=await fetch("/api/auth/me",{credentials:"same-origin"}).then(r=>r.json());if(!me.authenticated)throw new Error("লগইন সেশন তৈরি হয়নি। আবার চেষ্টা করুন।");form.reset();setSignedIn(me.user);status.textContent="";}catch(err){status.textContent=err.message;status.classList.add("error");}finally{button.disabled=false;button.textContent="Login";}}
function showProfileCompleteBar(){const bar=$("#profileCompleteBar"),backdrop=$("#profileBarBackdrop");if(!bar)return;if(backdrop)backdrop.hidden=false;bar.hidden=false;bar.classList.remove("is-hiding");requestAnimationFrame(()=>{backdrop?.classList.add("is-visible");bar.classList.add("is-visible");});}
function hideProfileCompleteBar(){const bar=$("#profileCompleteBar"),backdrop=$("#profileBarBackdrop");if(!bar||bar.hidden)return;bar.classList.remove("is-visible");bar.classList.add("is-hiding");backdrop?.classList.remove("is-visible");setTimeout(()=>{bar.hidden=true;bar.classList.remove("is-hiding");if(backdrop)backdrop.hidden=true;},260);}
async function init(){
 $("#profileBarClose")?.addEventListener("click",hideProfileCompleteBar);
 $("#profileMenuToggle")?.addEventListener("click",()=>openProfileDrawer(!$("#profileDrawer")?.classList.contains("is-open")));
 $("#profileDrawerClose")?.addEventListener("click",closeProfileDrawer);
 $("#profileDrawerBackdrop")?.addEventListener("click",closeProfileDrawer);
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeProfileDrawer();});
 document.addEventListener("pointerdown",e=>{const panel=$("#profileDrawer"),toggle=$("#profileMenuToggle");if(panel?.classList.contains("is-open")&&!panel.contains(e.target)&&!toggle?.contains(e.target))closeProfileDrawer();},true);

 $("#headerLoginForm").addEventListener("submit",submitHeaderLogin);
 $("#createAccountButton")?.addEventListener("click",()=>{const d=$("#registerDialog");if(d&&!d.open)d.showModal();});
 $("#registerClose")?.addEventListener("click",()=>$("#registerDialog").close());
 $("#registerDialog")?.addEventListener("click",e=>{if(e.target===$("#registerDialog"))$("#registerDialog").close();});
 $("#registerDialog")?.addEventListener("keydown",e=>{
  if(e.key!=="Backspace")return;
  const target=e.target;
  const editable=target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target?.isContentEditable;
  if(!editable)e.preventDefault();
 });
 $("#registerSendCode")?.addEventListener("click",requestRegistrationCode);
 $("#registerForm")?.addEventListener("submit",submitRegistration);
 $("#menuToggle")?.addEventListener("click",()=>{const sidebar=$("#ytSidebar"),mobile=window.matchMedia("(max-width: 760px)").matches;openAccountMenu(mobile?!sidebar?.classList.contains("mobile-open"):!document.body.classList.contains("sidebar-open"));});
 $("#sidebarLogoutButton")?.addEventListener("click",async()=>{
  const button=$("#sidebarLogoutButton"),status=$("#sidebarLogoutStatus");
  if(!button||button.disabled)return;
  button.disabled=true;button.classList.add("is-loading");status.textContent="";
  const label=button.querySelector("span");if(label)label.textContent="Logging out…";
  try{
   const response=await fetch("/api/auth/logout",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    credentials:"same-origin",
    cache:"no-store",
    body:JSON.stringify({})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok||data.ok!==true)throw new Error(data.error||"Logout করা যায়নি। আবার চেষ্টা করুন।");
   const sessionCheck=await fetch("/api/auth/me",{method:"GET",credentials:"same-origin",cache:"no-store"});
   const sessionData=await sessionCheck.json().catch(()=>({}));
   if(!sessionCheck.ok||sessionData.authenticated!==false)throw new Error("Logout সম্পন্ন হয়েছে কি না যাচাই করা যায়নি। পেজ Refresh করে আবার চেষ্টা করুন।");
   $("#headerLoginForm")?.reset();
   setSignedIn(null);
   openAccountMenu(false);
   status.textContent="Logout সফল হয়েছে।";
  }catch(error){
   status.textContent=error.message||"Logout করা যায়নি। আবার চেষ্টা করুন।";
  }finally{
   button.disabled=false;button.classList.remove("is-loading");
   if(label)label.textContent="Logout";
  }
 });
 $("#sidebarBackdrop")?.addEventListener("click",()=>openAccountMenu(false));
 document.addEventListener("pointerdown",e=>{
  const sidebar=$("#ytSidebar"),toggle=$("#menuToggle");
  if(!sidebar||!toggle)return;
  const mobile=window.matchMedia("(max-width: 760px)").matches;
  const opened=mobile?sidebar.classList.contains("mobile-open"):document.body.classList.contains("sidebar-open");
  if(!opened||sidebar.contains(e.target)||toggle.contains(e.target))return;
  openAccountMenu(false);
 },true);
 $("#categoryTabs")?.addEventListener("click",e=>{const chip=e.target.closest("[data-category]");if(!chip)return;if(chip.dataset.category==="__movies__")return;$("#categoryFilter").value=chip.dataset.category;syncHomeFilterUrl();renderLimit=RENDER_BATCH;render();});
 $("#searchSubmit")?.addEventListener("click",()=>$("#search").dispatchEvent(new Event("input",{bubbles:true})));
 document.addEventListener("keydown",e=>{if(e.key==="Escape")openAccountMenu(false);});
 document.querySelectorAll("#ytSidebar a").forEach(a=>a.addEventListener("click",()=>{document.querySelectorAll("#ytSidebar .side-link").forEach(x=>x.classList.toggle("active",x===a));openAccountMenu(false);const href=a.getAttribute("href")||"";if(href.startsWith("/"))return;const tab=href.slice(1);if(tab)sendTabView(tab);}));
function restoreHomeFilters(){
 const params=new URLSearchParams(location.search),cats=[...new Set(categories.map(c=>c.name).filter(Boolean))].sort();
 $("#categoryFilter").innerHTML='<option value="all">সব ক্যাটাগরি</option>'+cats.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join("");
 const requested=params.get("category")||"all";
 $("#categoryFilter").value=cats.includes(requested)?requested:"all";
 $("#search").value=params.get("q")||"";
}
function syncHomeFilterUrl(){
 const params=new URLSearchParams(location.search),category=$("#categoryFilter").value,query=$("#search").value.trim();
 if(category&&category!=="all")params.set("category",category);else params.delete("category");
 if(query)params.set("q",query);else params.delete("q");
 const next=location.pathname+(params.toString()?"?"+params.toString():"")+location.hash;
 history.replaceState(null,"",next);
}
restoreAccount();$("#videoRows").addEventListener("click",e=>{const card=e.target.closest(".video-card");if(!card)return;const video=videos.find(v=>v.id===card.dataset.id);if(video)play(video);});$("#search").addEventListener("input",()=>{syncHomeFilterUrl();clearTimeout(searchRenderTimer);renderLimit=RENDER_BATCH;searchRenderTimer=setTimeout(render,140);});$("#categoryFilter").addEventListener("change",()=>{syncHomeFilterUrl();renderLimit=RENDER_BATCH;render();});$("#loadMoreVideos").addEventListener("click",()=>{renderLimit+=RENDER_BATCH;render(true);});
 document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{if(b.dataset.close==="playerDialog")closePlayer();else document.getElementById(b.dataset.close)?.close();});
 $("#playerDialog").addEventListener("cancel",e=>{e.preventDefault();closePlayer();});
 $("#playerDialog").addEventListener("click",e=>{if(e.target===$("#playerDialog"))closePlayer();});
 $("#playerDialog").addEventListener("close",()=>{$("#playerFrame").innerHTML="";playerClosing=false;});
 let apiReady=false;
 try{const [vr,cr,sr]=await Promise.all([fetch("/api/videos"),fetch("/api/categories"),fetch("/api/settings")]);if(vr.ok){videos=await vr.json();apiReady=true;}if(cr.ok)categories=await cr.json();if(sr.ok)settings=await sr.json();}
 catch(e){console.warn("DRM PREMIUM API is not available yet.",e);}
 if(!apiReady)videos=demoVideos;if(!categories.length)categories=[...new Set(videos.map(v=>v.category))].map(name=>({name}));
 applySettings();restoreHomeFilters();visualConfig={};try{visualConfig=JSON.parse(settings.visual_editor_config||"{}");}catch{}applyVisualConfig();initVisualEditor();render();syncHomeFilterUrl();
}

/* Builder document JSON remains draft-only; legacy visual style overrides are saved separately to public settings. */
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
 if(sbLiveSelected&&sbLiveSelected!==el){sbCaptureLiveDraft();sbLiveSelected.style.outline=sbLiveSelected.dataset.sbOriginalOutline||"";}
 sbLiveSelected=el;if(!el.dataset.sbOriginalOutline)el.dataset.sbOriginalOutline=el.style.outline||"";
 el.style.setProperty("outline","2px solid #e11d48","important");el.style.setProperty("outline-offset","2px","important");
 const cs=el.ownerDocument.defaultView.getComputedStyle(el),host=$("#sbInspectorBody");
 host.innerHTML='<p>Selected website element: <strong>'+esc(el.tagName.toLowerCase()+(el.id?"#"+el.id:""))+'</strong></p>'+(el.children.length===0?sbField("Text / label","liveText",(el.innerText||el.textContent||"").trim().slice(0,2000)):'<p class="sb-muted">Text editing is disabled for this container to preserve its child elements. Select a text element inside it.</p>')+sbField("Font size (px)","liveFontSize",parseFloat(cs.fontSize)||16,"number")+sbField("Text color","liveColor",rgbToHex(cs.color),"color")+sbField("Background","liveBackground",rgbToHex(cs.backgroundColor),"color")+'<div class="sb-inspector-actions"><button id="sbApplyLive" type="button">Apply preview</button><button id="sbSaveLive" type="button">Save website style</button></div><p class="sb-muted">Website navigation and actions are disabled in Builder mode.</p>';
 $("#sbSelectedType").textContent="Website · "+el.tagName.toLowerCase();
 const applyButton=host.querySelector("#sbApplyLive"),saveButton=host.querySelector("#sbSaveLive");
 if(applyButton)applyButton.onclick=()=>sbApplyLiveChanges(false);
 if(saveButton)saveButton.onclick=()=>sbApplyLiveChanges(true);
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
 const initializePreview=()=>{
  try{const doc=frame.contentDocument;if(!doc?.body)throw new Error("iframe document unavailable");sbApplySavedLiveDraft(doc);$("#sbMessage").textContent="Editing mode active · click any website element to select it.";}catch(err){$("#sbMessage").textContent="Preview access error: "+(err?.message||String(err));}
 };
 frame.addEventListener("load",initializePreview);
 initializePreview();
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
 const el=sbLiveSelected,host=$("#sbInspectorBody");
 if(!el||!el.isConnected){$("#sbMessage").textContent="আগে Preview থেকে একটি element নির্বাচন করো।";return;}
 const get=k=>host.querySelector('[data-sb-prop="'+k+'"]')?.value;
 const text=get("liveText"),fontRaw=get("liveFontSize"),font=Number(fontRaw),color=get("liveColor"),bg=get("liveBackground");
 if(fontRaw!==undefined&&(!Number.isFinite(font)||font<8||font>96)){$("#sbMessage").textContent="Font size 8 থেকে 96 px-এর মধ্যে দিতে হবে।";return;}
 if(color!==undefined&&!/^#[0-9a-f]{6}$/i.test(color)){$("#sbMessage").textContent="Text color সঠিক HEX color হতে হবে।";return;}
 if(bg!==undefined&&!/^#[0-9a-f]{6}$/i.test(bg)){$("#sbMessage").textContent="Background সঠিক HEX color হতে হবে।";return;}
 // Apply explicitly from the current inspector values; do not depend on input events.
 if(text!==undefined&&el.children.length===0){if(el.matches("input,textarea"))el.value=text;else el.textContent=text;}
 if(fontRaw!==undefined)el.style.setProperty("font-size",font+"px","important");
 if(color)el.style.setProperty("color",color,"important");
 if(bg)el.style.setProperty("background-color",bg,"important");
 if(!save){$("#sbMessage").textContent="Preview updated · পরিবর্তনটি Preview-তে প্রয়োগ হয়েছে, এখনো সংরক্ষিত হয়নি।";return;}
 if(!confirm("এই website style পরিবর্তন বর্তমান environment-এর public website-এ প্রয়োগ হবে। Continue?"))return;
 const selector=visualSelector(el);
 const item={selector,text:el.children.length===0?(el.innerText||el.textContent||"").slice(0,2000):"",replaceText:el.children.length===0,style:{fontSize:font,color,background:bg,shadow:{color:"#000000",x:0,y:0,blur:0}}};
 const config={...visualConfig,[selector]:item},encoded=JSON.stringify(config);
 if(Object.keys(config).length>100){$("#sbMessage").textContent="সর্বোচ্চ ১০০টি website style সংরক্ষণ করা যাবে।";return;}
 if(encoded.length>25000){$("#sbMessage").textContent="Style configuration 25 KB সীমা অতিক্রম করেছে।";return;}
 const applyButton=host.querySelector("#sbApplyLive"),saveButton=host.querySelector("#sbSaveLive");
 if(applyButton)applyButton.disabled=true;if(saveButton){saveButton.disabled=true;saveButton.textContent="Saving…";}
 $("#sbMessage").textContent="Cloudflare D1-এ style সংরক্ষণ হচ্ছে…";
 fetch("/api/builder/style",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({config})})
 .then(async response=>{
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||("HTTP "+response.status));
  if(body.ok!==true||body.saved!==true)throw new Error(body.error||"API save confirmation পাওয়া যায়নি।");
  if(JSON.stringify(body.config)!==encoded)throw new Error("D1-এ সংরক্ষিত configuration মিলেনি।");
  visualConfig=body.config;
  $("#sbMessage").textContent="সফল: Style Cloudflare D1-এ সংরক্ষিত ও যাচাই হয়েছে; public website-এ এটি পরবর্তী page load-এ প্রয়োগ হবে।";
 })
 .catch(error=>{$("#sbMessage").textContent="Save failed: "+(error?.message||String(error));})
 .finally(()=>{if(applyButton)applyButton.disabled=false;if(saveButton){saveButton.disabled=false;saveButton.textContent="Save website style";}});
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
 preview=canvas.querySelector(".sb-live-preview");if(preview&&!preview.dataset.sbBound){preview.dataset.sbBound="1";sbAttachLivePreview(preview);preview.dataset.sbBound="1";}if(preview){try{if(preview.contentDocument?.body)sbApplySavedLiveDraft(preview.contentDocument);}catch{}}
 $("#sbDraftNodes").innerHTML=(page.nodes||[]).map(n=>sbCanvasHTML(n)).join("")||'<div class="sb-empty">Draft এখনো খালি। বাম পাশের ＋ Section বা ＋ Element দিয়ে শুরু করুন।</div>';
 $("#sbSelectedType").textContent=sbSelected?(SB_LABELS[sbFind(sbSelected)?.node?.type]||"Selected"):"Nothing selected";
 canvas.querySelectorAll("[data-sb-node]").forEach(el=>{el.classList.toggle("sb-selected",el.dataset.sbNode===sbSelected);el.draggable=true;});sbRenderInspector();
}
async function openSiteBuilder(){const me=await fetch("/api/auth/me",{credentials:"same-origin"}).then(r=>r.json()).catch(()=>({}));if(!me.authenticated||me.user?.role!=="owner"){alert("শুধু Owner Website Builder ব্যবহার করতে পারবেন।");return;}$("#siteBuilder").hidden=false;document.body.classList.add("sb-open");$("#sbSaveState").textContent="Loading draft…";try{const r=await fetch("/api/builder/state",{credentials:"same-origin"}),d=await r.json();if(!r.ok)throw new Error(d.error||"Builder load failed");sbDoc=d.document;sbRevision=d.revision||0;sbSelected=null;sbUndoStack=[];sbRedoStack=[];sbDirty=false;$("#sbSaveState").textContent="Draft revision "+sbRevision;$("#sbMessage").textContent="Builder document edits remain unpublished drafts. “Save website style” separately updates the public styling in this environment.";sbBindEvents();sbRender();}catch(e){$("#sbMessage").textContent=e.message;}}
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