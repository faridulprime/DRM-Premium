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

function setSignedIn(user){const form=$("#headerLoginForm"),badge=$("#proBadge"),label=$("#drawerAccountLabel"),logout=$("#logoutButton"),upload=$("#quickUploadButton");form.hidden=!!user;badge.hidden=!user;logout.hidden=!user;if(upload)upload.hidden=!(user&&["owner","admin"].includes(user.role));label.textContent=!user?"অতিথি":user.role==="owner"?"Owner":user.role==="admin"?"Admin":"DRM- Member";if(user)startAdminPresence();}
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
 applySettings();render();
}
init();