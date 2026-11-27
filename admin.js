const $=s=>document.querySelector(s);
let state={videos:[],categories:[],settings:{},analytics:null,user:null}
let activeUsersTimer=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function setRoleBadge(el,role){if(!el)return;const key=role==="owner"?"owner":role==="admin"?"admin":role==="user"||role==="member"?"member":"";el.classList.add("role-badge");el.classList.remove("role-badge--owner","role-badge--admin","role-badge--member");if(key)el.classList.add("role-badge--"+key);}
async function api(path,opts={}){const res=await fetch("/api/"+path,{...opts,headers:{"Content-Type":"application/json",...(opts.headers||{})},credentials:"same-origin"});let data={};try{data=await res.json()}catch{}if(!res.ok)throw new Error(data.error||("Request failed ("+res.status+")"));return data}
function show(id){
 ["loading","setup","login","dashboard"].forEach(x=>$("#"+x).hidden=x!==id);
 const dashboard=id==="dashboard";
 $("#adminCategoryBar").hidden=!dashboard;
 $("#adminHeaderAccount").hidden=!(dashboard&&state.user);
 document.body.classList.toggle("admin-gate-state",!dashboard);
 document.body.classList.toggle("admin-dashboard-state",dashboard);
 if(dashboard&&state.user){
  const isPrimaryOwner=state.user.role==="owner"&&String(state.user.email||"").trim().toLowerCase()==="faridulprime@gmail.com";
  const brandRole=$("#adminBrandRole");
  if(brandRole){brandRole.textContent=isPrimaryOwner?"Owner":"Admin";brandRole.classList.toggle("brand-owner-suffix",isPrimaryOwner);}
  $(".admin-topbar .brand")?.setAttribute("aria-label",isPrimaryOwner?"DRM– Premium Owner — Admin Dashboard":"DRM– Premium Admin — Admin Dashboard");
  $("#adminHeaderIdentity").textContent=state.user.role==="owner"?"OWNER":state.user.role==="admin"?"ADMIN":"MEMBER";
  $("#dashRole").textContent=state.user.role==="user"?"MEMBER":state.user.role.toUpperCase();
  setRoleBadge($("#adminHeaderIdentity"),state.user.role);setRoleBadge($("#dashRole"),state.user.role);
  $("#adminSidebarLogoutArea").hidden=false;
 }else $("#adminSidebarLogoutArea").hidden=true;
}
function notice(msg,error=false){const el=$("#notice");if(!el)return;el.textContent=msg;el.classList.toggle("error",error)}
function ytId(value){const s=value.trim();if(/^[\w-]{11}$/.test(s))return s;try{const u=new URL(s),host=u.hostname.toLowerCase();if(host==="youtu.be"){const id=u.pathname.split("/").filter(Boolean)[0]||"";return /^[\w-]{11}$/.test(id)?id:""}if(!["youtube.com","www.youtube.com","m.youtube.com","youtube-nocookie.com","www.youtube-nocookie.com"].includes(host))return"";const id=u.searchParams.get("v")||u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1]||"";return /^[\w-]{11}$/.test(id)?id:""}catch{return ""}}
async function status(){try{applyAdminTheme();const s=await api("auth/status");if(!s.configured){show("setup");return}const me=await api("auth/me");if(me.authenticated&&(me.user?.role==="owner"||me.user?.role==="admin")){state.user=me.user;show("dashboard");startAdminPresence();$("#adminIdentity").textContent=me.user.email+" · "+(me.user.role==="owner"?"OWNER":"ADMIN");await refresh();activateAdminTab(currentAdminTab())}else{state.user=null;show("login")}}catch(e){state.user=null;show("login");notice(e.message,true)}}
async function applyAdminTheme(){try{const settings=await api("settings");if(/^#[0-9a-f]{6}$/i.test(settings.accent_color||"")){document.documentElement.style.setProperty("--accent",settings.accent_color);document.documentElement.style.setProperty("--red",settings.accent_color);}}catch{}}
async function refresh(){const [videos,categories]=await Promise.all([api("admin/videos"),api("admin/categories")]);state={...state,videos,categories};renderVideos();renderCategories();await loadOverviewAnalytics();renderOverview();if(state.user.role==="owner"){const settings=await api("settings");state.settings=settings;renderSettings();applyAdminThemeFromSettings(settings);["headerSiteTab","sidebarSiteTab","liveUsersSidebarTab","headerLiveUsersTab"].forEach(id=>$("#"+id).hidden=false);}else{["headerSiteTab","sidebarSiteTab","liveUsersSidebarTab","headerLiveUsersTab"].forEach(id=>$("#"+id).hidden=true);}}
function applyAdminThemeFromSettings(settings){if(/^#[0-9a-f]{6}$/i.test(settings?.accent_color||"")){document.documentElement.style.setProperty("--accent",settings.accent_color);document.documentElement.style.setProperty("--red",settings.accent_color);}}
async function loadOverviewAnalytics(){try{state.analytics=await api("admin/analytics")}catch{state.analytics=null}}
function renderOverview(){
 const videos=state.videos||[],published=videos.filter(v=>!!v.published).length,unpublished=videos.length-published,featured=videos.filter(v=>!!v.featured).length;
 const active=state.analytics?.online_count;
 const metrics=[["Total Videos",videos.length,"সব ভিডিও"],["Published",published,"প্রকাশিত ভিডিও"],["Categories",(state.categories||[]).length,"সক্রিয় ক্যাটাগরি"],["Active Admins",Number.isFinite(active)?active:"—","গত ৯০ সেকেন্ডে"]];
 $("#overviewMetrics").innerHTML=metrics.map(([label,value,sub])=>'<article class="overview-metric"><span>'+label+'</span><strong>'+value+'</strong><small>'+sub+'</small></article>').join("");
 const pct=videos.length?Math.round(published/videos.length*100):0;
 $("#overviewContentStatus").innerHTML='<div class="overview-status-top"><span>Published</span><strong>'+published+' / '+videos.length+'</strong></div><div class="overview-progress"><i style="width:'+pct+'%"></i></div><div class="overview-status-foot"><span>'+pct+'% প্রকাশিত</span><span>'+unpublished+' Unpublished · '+featured+' Featured</span></div>';
 const recent=[...videos].sort((a,b)=>Number(b.created_at||0)-Number(a.created_at||0)).slice(0,4);
 $("#overviewRecent").innerHTML=recent.length?recent.map(v=>'<div class="overview-recent-row"><span class="overview-recent-dot"></span><div><strong>'+esc(v.title)+'</strong><small>'+esc(v.category)+' · '+(v.published?"Published":"Unpublished")+'</small></div></div>').join(""):'<p class="muted overview-empty">এখনো কোনো ভিডিও যোগ করা হয়নি।</p>';
 $("#overviewActivity").innerHTML='<span>Recorded tab views</span><strong>'+(state.analytics?Number(state.analytics.total_tab_views||0).toLocaleString():"—")+'</strong><small>সমস্ত রেকর্ডকৃত পৃষ্ঠা ভিজিট</small>';
}
document.querySelectorAll("[data-go-tab]").forEach(b=>b.addEventListener("click",()=>{const tab=b.dataset.goTab;navigateAdminTab(tab);if(b.dataset.action==="new-video")setTimeout(()=>editVideo(""),0)}));
function renderVideos(){$("#videoCategory").innerHTML=state.categories.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");$("#videoList").innerHTML=state.videos.map(v=>`<div class="data-row"><div><strong>${esc(v.title)}</strong><small>${esc(v.category)} · ${v.published?"Published":"Unpublished"} · ${v.featured?"Featured":"Standard"}</small></div><div class="row-actions"><button data-edit="${esc(v.id)}">Edit</button><button class="delete" data-remove-video="${esc(v.id)}">Delete</button></div></div>`).join("")||'<p class="muted">এখনো কোনো ভিডিও নেই।</p>';document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editVideo(b.dataset.edit));document.querySelectorAll("[data-remove-video]").forEach(b=>b.onclick=()=>removeVideo(b.dataset.removeVideo))}
function editVideo(id){const v=state.videos.find(x=>x.id===id),f=$("#videoForm");f.hidden=false;f.elements.id.value=v?.id||"";f.elements.title.value=v?.title||"";f.elements.category.value=v?.category||state.categories[0]?.name||"";f.elements.youtube_id.value=v?.youtube_id||"";f.elements.thumbnail_url.value=v?.thumbnail_url||"";f.elements.description.value=v?.description||"";f.elements.featured.checked=!!v?.featured;f.elements.published.checked=v?!!v.published:true;f.scrollIntoView({behavior:"smooth",block:"center"})}
async function removeVideo(id){if(!confirm("এই ভিডিওটি মুছে ফেলবেন?"))return;try{await api("admin/videos/"+encodeURIComponent(id),{method:"DELETE"});await refresh();notice("ভিডিও মুছে ফেলা হয়েছে।")}catch(e){notice(e.message,true)}}
function renderCategories(){$("#categoryList").innerHTML=state.categories.map(c=>`<div class="data-row"><strong>${esc(c.name)}</strong><div class="row-actions"><button data-edit-cat="${esc(c.id)}">Edit</button><button class="delete" data-remove-cat="${esc(c.id)}">Delete</button></div></div>`).join("")||'<p class="muted">কোনো ক্যাটাগরি নেই।</p>';document.querySelectorAll("[data-edit-cat]").forEach(b=>b.onclick=()=>editCategory(b.dataset.editCat));document.querySelectorAll("[data-remove-cat]").forEach(b=>b.onclick=()=>removeCategory(b.dataset.removeCat))}
async function editCategory(id){const c=state.categories.find(x=>x.id===id);if(!c)return;const name=prompt("নতুন ক্যাটাগরির নাম লিখুন:",c.name);if(name===null||!name.trim())return;try{await api("admin/categories/"+encodeURIComponent(id),{method:"PUT",body:JSON.stringify({name:name.trim()})});await refresh();notice("ক্যাটাগরি পরিবর্তন হয়েছে।")}catch(e){notice(e.message,true)}}
async function removeCategory(id){if(!confirm("ক্যাটাগরিটি মুছবেন? সংশ্লিষ্ট ভিডিও আগে অন্য category-তে সরানো থাকতে হবে।"))return;try{await api("admin/categories/"+encodeURIComponent(id),{method:"DELETE"});await refresh();notice("ক্যাটাগরি মুছে ফেলা হয়েছে।")}catch(e){notice(e.message,true)}}
function renderSettings(){const f=$("#settingsForm");for(const el of f.elements){if(!el.name||state.settings[el.name]===undefined)continue;if(el.type==="checkbox")el.checked=state.settings[el.name]!=="false";else el.value=state.settings[el.name]}}
function startAdminPresence(){const beat=()=>{api("presence",{method:"POST",body:"{}"}).catch(()=>{});api("admin/presence",{method:"POST",body:"{}"}).catch(()=>{});};beat();if(activeUsersTimer)clearInterval(activeUsersTimer);activeUsersTimer=setInterval(()=>{beat();if(state.user?.role==="owner")loadOverviewAnalytics().then(renderOverview);},30000);}

$("#sendOwnerCode").onclick=async()=>{const f=$("#setupForm"),email=f.elements.email.value.trim();if(!email){notice("Owner email দিন।",true);return}try{await api("auth/owner-otp",{method:"POST",body:JSON.stringify({email})});notice("Verification code ইমেইলে পাঠানো হয়েছে।")}catch(err){notice(err.message,true)}};
$("#setupForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("auth/setup",{method:"POST",body:JSON.stringify({email:f.get("email"),username:f.get("username"),password:f.get("password"),code:f.get("code")})});notice("Owner account তৈরি হয়েছে।");await status()}catch(err){notice(err.message,true)}};
$("#loginForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("auth/login",{method:"POST",body:JSON.stringify({email:f.get("email"),password:f.get("password")})});e.target.reset();await status()}catch(err){notice(err.message,true)}};
$("#logout").onclick=async()=>{const button=$("#logout");button.disabled=true;try{await api("auth/logout",{method:"POST",body:"{}"});state.user=null;if(activeUsersTimer){clearInterval(activeUsersTimer);activeUsersTimer=null;}show("login");closeAdminMenu();notice("সফলভাবে Logout হয়েছে।")}catch(e){notice(e.message,true)}finally{button.disabled=false}};
function validAdminTab(value){return ["overview","videos","categories","site"].includes(value)?value:"overview";}
async function recordAdminTabView(tab){try{await api("analytics/event",{method:"POST",body:JSON.stringify({tab})});if(tab==="overview"){await loadOverviewAnalytics();renderOverview();}}catch(error){console.error("Admin analytics event failed:",error);}}
function syncAdminTabAccessibility(target){
 const tabs=[...document.querySelectorAll('[data-tab][role="tab"]')];
 tabs.forEach(tab=>{
  const visible=tab.getClientRects().length>0&&!tab.closest("[hidden]");
  const selected=tab.dataset.tab===target&&visible&&!tab.hidden;
  tab.setAttribute("aria-selected",String(selected));tab.tabIndex=selected?0:-1;
 });
 const panel=$("#tab-"+target);
 if(panel){
  const label=tabs.find(tab=>tab.dataset.tab===target&&tab.getAttribute("aria-selected")==="true")||tabs.find(tab=>tab.dataset.tab===target);
  if(label)panel.setAttribute("aria-labelledby",label.id);
 }
}
function activateAdminTab(value){
 const target=validAdminTab(value),allowedButton=document.querySelector('[data-tab="'+target+'"]:not([hidden])'),allowedPanel=$("#tab-"+target);
 if(!allowedButton||!allowedPanel)return;
 recordAdminTabView(target);
 document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x.dataset.tab===target));
 document.querySelectorAll(".tab-panel").forEach(x=>x.hidden=x.id!=="tab-"+target);
 syncAdminTabAccessibility(target);closeAdminMenu();
}
function currentAdminTab(){const match=location.hash.match(/^#tab=(overview|videos|categories|site)(?:&|$)/);return match?match[1]:"overview";}
function navigateAdminTab(target){target=validAdminTab(target);if(target==="site"&&$("#headerSiteTab").hidden)return;if(location.hash!=="#tab="+target){location.hash="tab="+target;return;}activateAdminTab(target);}
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>navigateAdminTab(b.dataset.tab));
document.querySelectorAll('[role="tablist"]').forEach(list=>list.addEventListener("keydown",event=>{
 const current=event.target.closest('[role="tab"]');if(!current||!list.contains(current))return;
 const tabs=[...list.querySelectorAll('[role="tab"]:not([hidden])')].filter(tab=>!tab.closest("[hidden]")&&tab.getClientRects().length>0);
 const index=tabs.indexOf(current);if(index<0)return;let next=null;
 if(event.key==="ArrowRight"||event.key==="ArrowDown")next=tabs[(index+1)%tabs.length];
 else if(event.key==="ArrowLeft"||event.key==="ArrowUp")next=tabs[(index-1+tabs.length)%tabs.length];
 else if(event.key==="Home")next=tabs[0];else if(event.key==="End")next=tabs[tabs.length-1];
 if(next){event.preventDefault();next.focus();next.click();}
}));
window.addEventListener("hashchange",()=>{if(!$("#dashboard").hidden)activateAdminTab(currentAdminTab());});
$("#newVideo").onclick=()=>editVideo("");$("#cancelVideo").onclick=()=>{$("#videoForm").hidden=true};
$("#videoForm").onsubmit=async e=>{e.preventDefault();const f=e.target,body={title:f.elements.title.value.trim(),category:f.elements.category.value,youtube_id:ytId(f.elements.youtube_id.value),thumbnail_url:f.elements.thumbnail_url.value.trim(),description:f.elements.description.value.trim(),featured:f.elements.featured.checked,published:f.elements.published.checked};if(!body.youtube_id){notice("সঠিক YouTube URL বা Video ID দিন।",true);return}try{if(f.elements.id.value)await api("admin/videos/"+encodeURIComponent(f.elements.id.value),{method:"PUT",body:JSON.stringify(body)});else await api("admin/videos",{method:"POST",body:JSON.stringify(body)});f.reset();f.hidden=true;await refresh();notice("ভিডিও সংরক্ষণ হয়েছে।")}catch(err){notice(err.message,true)}};
$("#categoryForm").onsubmit=async e=>{e.preventDefault();const name=new FormData(e.target).get("name").trim();try{await api("admin/categories",{method:"POST",body:JSON.stringify({name})});e.target.reset();await refresh();notice("ক্যাটাগরি যোগ হয়েছে।")}catch(err){notice(err.message,true)}};
$("#settingsForm").onsubmit=async e=>{e.preventDefault();const f=e.target,body={};for(const el of f.elements)if(el.name)body[el.name]=el.type==="checkbox"?(el.checked?"true":"false"):el.value;try{await api("admin/settings",{method:"PUT",body:JSON.stringify(body)});await refresh();notice("ওয়েবসাইটের সেটিংস সংরক্ষণ হয়েছে।")}catch(err){notice(err.message,true)}};
let adminMenuCloseTimer=null;
function openAdminMenu(open){
 const isOpen=Boolean(open),backdrop=$("#adminSidebarBackdrop"),sidebar=$("#adminSidebar");
 clearTimeout(adminMenuCloseTimer);
 if(window.matchMedia("(max-width:760px)").matches&&window.DRMMotion){window.DRMMotion.drawer({sidebar,backdrop,toggle:$("#adminMenuToggle"),open:isOpen});return;}
 if(sidebar){sidebar.classList.remove("mobile-open");void sidebar.offsetWidth;}
 document.body.classList.toggle("sidebar-open",isOpen);
 if(sidebar&&isOpen&&window.matchMedia("(max-width:760px)").matches)sidebar.classList.add("mobile-open");
 $("#adminMenuToggle").setAttribute("aria-expanded",String(isOpen));
 $("#adminMenuToggle").setAttribute("aria-label",isOpen?"মেনু বন্ধ করুন":"মেনু খুলুন");
 if(backdrop){
  backdrop.classList.remove("is-closing");
  if(isOpen)backdrop.hidden=false;
  else if(!backdrop.hidden){
   backdrop.classList.add("is-closing");
   adminMenuCloseTimer=setTimeout(()=>{backdrop.hidden=true;backdrop.classList.remove("is-closing");},720);
  }
 }
}
function closeAdminMenu(){openAdminMenu(false);}
$("#adminMenuToggle").onclick=()=>openAdminMenu(!(document.body.classList.contains("sidebar-open")||$("#adminSidebar")?.classList.contains("mobile-open")));
$("#adminSidebarBackdrop").onclick=closeAdminMenu;
document.addEventListener("pointerdown",e=>{if(!document.body.classList.contains("sidebar-open"))return;if($("#adminSidebar").contains(e.target)||$("#adminMenuToggle").contains(e.target))return;closeAdminMenu();},true);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeAdminMenu();});
const adminMenuBreakpoint=window.matchMedia("(max-width: 760px)");adminMenuBreakpoint.addEventListener?.("change",closeAdminMenu);

$("#adminSearch").addEventListener("input",e=>{const q=e.target.value.trim().toLocaleLowerCase();document.querySelectorAll(".tab-panel:not([hidden]) .data-row").forEach(row=>row.hidden=!row.textContent.toLocaleLowerCase().includes(q));});
$("#adminSearchClear").onclick=()=>{$("#adminSearch").value="";$("#adminSearch").dispatchEvent(new Event("input"));};
status();