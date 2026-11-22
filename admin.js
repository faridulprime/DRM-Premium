const $=s=>document.querySelector(s);
let state={videos:[],categories:[],settings:{},users:[],analytics:null,user:null};
let activeUsersTimer=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(path,opts={}){const res=await fetch("/api/"+path,{...opts,headers:{"Content-Type":"application/json",...(opts.headers||{})},credentials:"same-origin"});let data={};try{data=await res.json()}catch{}if(!res.ok)throw new Error(data.error||("Request failed ("+res.status+")"));return data}
function show(id){
 ["loading","setup","login","dashboard"].forEach(x=>$("#"+x).hidden=x!==id);
 const dashboard=id==="dashboard";
 $("#adminCategoryBar").hidden=!dashboard;
 $("#adminHeaderAccount").hidden=!(dashboard&&state.user);
 document.body.classList.toggle("admin-gate-state",!dashboard);
 document.body.classList.toggle("admin-dashboard-state",dashboard);
 if(dashboard&&state.user){
  $("#adminHeaderIdentity").textContent=state.user.role==="owner"?"OWNER":state.user.role==="admin"?"ADMIN":"USER";
  $("#dashRole").textContent=state.user.role.toUpperCase();
  $("#adminSidebarLogoutArea").hidden=false;
 }else $("#adminSidebarLogoutArea").hidden=true;
}
function notice(msg,error=false){const el=$("#notice");if(!el)return;el.textContent=msg;el.classList.toggle("error",error)}
function ytId(value){const s=value.trim();if(/^[\w-]{11}$/.test(s))return s;try{const u=new URL(s),host=u.hostname.toLowerCase();if(host==="youtu.be"){const id=u.pathname.split("/").filter(Boolean)[0]||"";return /^[\w-]{11}$/.test(id)?id:""}if(!["youtube.com","www.youtube.com","m.youtube.com","youtube-nocookie.com","www.youtube-nocookie.com"].includes(host))return"";const id=u.searchParams.get("v")||u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1]||"";return /^[\w-]{11}$/.test(id)?id:""}catch{return ""}}
async function status(){try{applyAdminTheme();const s=await api("auth/status");if(!s.configured){show("setup");return}const me=await api("auth/me");if(me.authenticated){state.user=me.user;show("dashboard");startAdminPresence();$("#adminIdentity").textContent=me.user.email+" · "+(me.user.role==="owner"?"OWNER":me.user.role==="admin"?"ADMIN":"USER");await refresh();activateAdminTab(currentAdminTab())}else{state.user=null;show("login")}}catch(e){state.user=null;show("login");notice(e.message,true)}}
async function applyAdminTheme(){try{const settings=await api("settings");if(/^#[0-9a-f]{6}$/i.test(settings.accent_color||"")){document.documentElement.style.setProperty("--accent",settings.accent_color);document.documentElement.style.setProperty("--red",settings.accent_color);}}catch{}}
async function refresh(){const [videos,categories]=await Promise.all([api("admin/videos"),api("admin/categories")]);state={...state,videos,categories};renderVideos();renderCategories();await loadOverviewAnalytics();renderOverview();if(state.user.role==="owner"){const [settings,users]=await Promise.all([api("settings"),api("admin/users")]);state.settings=settings;state.users=users;renderSettings();renderAdmins();applyAdminThemeFromSettings(settings);["headerSiteTab","headerAdminsTab","sidebarSiteTab","sidebarAdminsTab"].forEach(id=>$("#"+id).hidden=false);await loadActiveUsers();}else{["headerSiteTab","headerAdminsTab","sidebarSiteTab","sidebarAdminsTab"].forEach(id=>$("#"+id).hidden=true);}}
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
 $("#overviewUsersAction").hidden=state.user?.role!=="owner";
}
document.querySelectorAll("[data-go-tab]").forEach(b=>b.addEventListener("click",()=>{const tab=b.dataset.goTab;navigateAdminTab(tab);if(b.dataset.action==="new-video")setTimeout(()=>editVideo(""),0)}));
function renderVideos(){$("#videoCategory").innerHTML=state.categories.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");$("#videoList").innerHTML=state.videos.map(v=>`<div class="data-row"><div><strong>${esc(v.title)}</strong><small>${esc(v.category)} · ${v.published?"Published":"Unpublished"} · ${v.featured?"Featured":"Standard"}</small></div><div class="row-actions"><button data-edit="${esc(v.id)}">Edit</button><button class="delete" data-remove-video="${esc(v.id)}">Delete</button></div></div>`).join("")||'<p class="muted">এখনো কোনো ভিডিও নেই।</p>';document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editVideo(b.dataset.edit));document.querySelectorAll("[data-remove-video]").forEach(b=>b.onclick=()=>removeVideo(b.dataset.removeVideo))}
function editVideo(id){const v=state.videos.find(x=>x.id===id),f=$("#videoForm");f.hidden=false;f.elements.id.value=v?.id||"";f.elements.title.value=v?.title||"";f.elements.category.value=v?.category||state.categories[0]?.name||"";f.elements.youtube_id.value=v?.youtube_id||"";f.elements.thumbnail_url.value=v?.thumbnail_url||"";f.elements.description.value=v?.description||"";f.elements.featured.checked=!!v?.featured;f.elements.published.checked=v?!!v.published:true;f.scrollIntoView({behavior:"smooth",block:"center"})}
async function removeVideo(id){if(!confirm("এই ভিডিওটি মুছে ফেলবেন?"))return;try{await api("admin/videos/"+encodeURIComponent(id),{method:"DELETE"});await refresh();notice("ভিডিও মুছে ফেলা হয়েছে।")}catch(e){notice(e.message,true)}}
function renderCategories(){$("#categoryList").innerHTML=state.categories.map(c=>`<div class="data-row"><strong>${esc(c.name)}</strong><div class="row-actions"><button data-edit-cat="${esc(c.id)}">Edit</button><button class="delete" data-remove-cat="${esc(c.id)}">Delete</button></div></div>`).join("")||'<p class="muted">কোনো ক্যাটাগরি নেই।</p>';document.querySelectorAll("[data-edit-cat]").forEach(b=>b.onclick=()=>editCategory(b.dataset.editCat));document.querySelectorAll("[data-remove-cat]").forEach(b=>b.onclick=()=>removeCategory(b.dataset.removeCat))}
async function editCategory(id){const c=state.categories.find(x=>x.id===id);if(!c)return;const name=prompt("নতুন ক্যাটাগরির নাম লিখুন:",c.name);if(name===null||!name.trim())return;try{await api("admin/categories/"+encodeURIComponent(id),{method:"PUT",body:JSON.stringify({name:name.trim()})});await refresh();notice("ক্যাটাগরি পরিবর্তন হয়েছে।")}catch(e){notice(e.message,true)}}
async function removeCategory(id){if(!confirm("ক্যাটাগরিটি মুছবেন? সংশ্লিষ্ট ভিডিও আগে অন্য category-তে সরানো থাকতে হবে।"))return;try{await api("admin/categories/"+encodeURIComponent(id),{method:"DELETE"});await refresh();notice("ক্যাটাগরি মুছে ফেলা হয়েছে।")}catch(e){notice(e.message,true)}}
function renderSettings(){const f=$("#settingsForm");for(const el of f.elements){if(!el.name||state.settings[el.name]===undefined)continue;if(el.type==="checkbox")el.checked=state.settings[el.name]!=="false";else el.value=state.settings[el.name]}}
function renderActiveUsers(data){
 const groups=[{key:"admins",title:"Admin"},{key:"members",title:"Members"},{key:"guests",title:"Guest"}];
 const total=groups.reduce((n,g)=>n+(data[g.key]||[]).length,0);$("#activeUsersTotal").textContent=total+" Active";
 $("#activeUsersList").innerHTML=groups.map(group=>{const users=data[group.key]||[],cards=users.map(u=>{
  const badge=group.key==="admins"?(u.role==="owner"?'<span class="active-user-badge owner">Owner</span>':'<span class="active-user-badge admin">Admin</span>'):group.key==="members"?'<span class="active-user-badge member">Member</span>':"";
  return '<div class="active-user-card"><span class="active-user-name">'+esc(u.name||u.email||"Guest")+'</span>'+badge+'</div>';
 }).join("");return '<section class="active-user-group"><div class="active-user-group-heading"><span>'+group.title+'</span><i aria-hidden="true"></i></div><div class="active-user-cards">'+(cards||'<p class="active-user-empty">কেউ বর্তমানে সক্রিয় নেই।</p>')+'</div></section>';}).join("");
}
async function loadActiveUsers(){if(state.user?.role!=="owner")return;try{renderActiveUsers(await api("admin/active-users"));}catch(e){$("#activeUsersList").innerHTML='<p class="active-user-empty">তালিকা লোড করা যায়নি: '+esc(e.message)+'</p>';}}
function startAdminPresence(){const beat=()=>{api("presence",{method:"POST",body:"{}"}).catch(()=>{});api("admin/presence",{method:"POST",body:"{}"}).catch(()=>{});};beat();if(activeUsersTimer)clearInterval(activeUsersTimer);activeUsersTimer=setInterval(()=>{beat();if(state.user?.role==="owner"&&currentAdminTab()==="admins")loadActiveUsers();if(state.user?.role==="owner")loadOverviewAnalytics().then(renderOverview);},30000);}
function renderAdmins(){
 const users=state.users||[];
 $("#adminList").innerHTML=users.map(u=>{
  const created=new Date(Number(u.created_at)<1e12?Number(u.created_at)*1000:Number(u.created_at));
  const date=Number.isNaN(created.getTime())?"Date unavailable":created.toLocaleDateString();
  const restricted=!!u.restriction_type&&(u.restriction_expires_at==null||Number(u.restriction_expires_at)>Math.floor(Date.now()/1000));
  const restrictionLabel=restricted?(u.restriction_type==="ban"?"BANNED":"SUSPENDED"):"";
  const roleLabel=u.role==="owner"?"Owner":u.role==="admin"?"Admin":"Member";
  const initial=String(u.username||u.email||"?").trim().charAt(0).toUpperCase();
  let actions='<span class="user-protected-label"><span aria-hidden="true">◆</span> Protected account</span>';
  if(u.role!=="owner"){
   const roleAction=restricted?"":u.role==="user"?'<button type="button" data-user-action="promote"><span class="uam-icon" aria-hidden="true">♛</span><span>Promote to Admin</span><span class="uam-chevron" aria-hidden="true">›</span></button>':'<button type="button" data-user-action="demote"><span class="uam-icon" aria-hidden="true">♙</span><span>Remove Admin Access</span><span class="uam-chevron" aria-hidden="true">›</span></button>';
   const restrictionAction=restricted?'<button type="button" data-user-action="restore" class="uam-restore"><span class="uam-icon" aria-hidden="true">↻</span><span>Restore Account Access</span><span class="uam-chevron" aria-hidden="true">›</span></button>':'<button type="button" data-user-action="suspend" class="uam-warning"><span class="uam-icon" aria-hidden="true">Ⅱ</span><span>Suspend for 24 Hours</span><span class="uam-chevron" aria-hidden="true">›</span></button><button type="button" data-user-action="ban" class="uam-danger"><span class="uam-icon" aria-hidden="true">⊘</span><span>Permanently Ban</span><span class="uam-chevron" aria-hidden="true">›</span></button>';
   actions=`<button type="button" class="user-details-trigger" data-user-details-open aria-label="Open details for ${esc(u.email)}">Details <span aria-hidden="true">›</span></button>`;
  }
  const status=restricted?'<span class="user-restriction-status '+(u.restriction_type==="ban"?"banned":"suspended")+'">'+restrictionLabel+'</span>':"";
  return `<article class="data-row user-management-row ${u.role==="owner"?"is-owner":""} ${restricted?"is-restricted":""}" data-user-row="${esc(u.id)}">
   <div class="user-avatar" aria-hidden="true">${esc(initial)}</div>
   <div class="user-row-identity">
    <div class="user-identity-top"><strong>${esc(u.email)}</strong>${status}</div>
    <div class="user-meta-line"><span class="user-role-chip ${u.role}">${roleLabel}</span><span>${esc(date)}</span><i></i><span class="user-verified ${u.email_verified?"verified":"unverified"}">${u.email_verified?"Verified":"Unverified"}</span></div>
   </div>
   <div class="row-actions">${actions}</div>
  </article>`;
 }).join("")||'<p class="muted">এখনো কোনো ব্যবহারকারী নেই।</p>';
}
async function restrictUser(id,action){
 const labels={suspend:"এই অ্যাকাউন্ট ২৪ ঘণ্টার জন্য স্থগিত হবে এবং সব সক্রিয় Session বাতিল হবে।",ban:"এই অ্যাকাউন্ট স্থায়ীভাবে নিষিদ্ধ হবে। ব্যবহারকারী আর Login করতে পারবেন না; তার কনটেন্ট/ডেটা মুছে ফেলা হবে না।",restore:"এই অ্যাকাউন্টের স্থগিতাদেশ/নিষেধাজ্ঞা তুলে নেওয়া হবে।"};
 if(!confirm(labels[action]||"চালিয়ে যাবেন?"))return;
 if(action==="ban"&&!confirm("এটি স্থায়ী নিষেধাজ্ঞা। নিশ্চিতভাবে এই অ্যাকাউন্ট Ban করবেন?"))return;
 let reason="";
 if(action==="suspend"||action==="ban"){const entered=prompt("কারণ লিখুন (ঐচ্ছিক):","");if(entered===null)return;reason=entered.trim().slice(0,500);}
 const payload={action:action==="suspend"?"suspend_24h":action==="ban"?"ban_permanent":"restore_access",reason};
 try{const result=await api("admin/users/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify(payload)});await refresh();if(action==="suspend"&&result.emailNotification==="failed")notice("অ্যাকাউন্ট Suspend হয়েছে, কিন্তু ইমেইল পাঠানো যায়নি। Apps Script deploy ও mailer log পরীক্ষা করুন।",true);else notice(action==="suspend"?"অ্যাকাউন্ট ২৪ ঘণ্টার জন্য স্থগিত হয়েছে এবং নোটিশ ইমেইল পাঠানো হয়েছে।":action==="ban"?"অ্যাকাউন্ট স্থায়ীভাবে নিষিদ্ধ হয়েছে।":"অ্যাকাউন্টের Access পুনরুদ্ধার হয়েছে।");}
 catch(e){notice(e.message,true);await refresh();}
}
async function showUserActivity(id){
 const u=state.users.find(x=>String(x.id)===String(id));if(!u)return;
 $("#userDetailsTitle").textContent="Most Active Hours";
 $("#userDetailsContent").innerHTML='<p class="muted">গত ৯০ দিনের Activity লোড হচ্ছে…</p>';
 $("#userDetailsDialog").showModal();
 try{
  const data=await api("admin/users/"+encodeURIComponent(id)+"/activity");
  const counts=Array(24).fill(0);
  for(const item of data.hours||[]){const hour=new Date(Number(item.hour_start)*1000).getHours();counts[hour]++;}
  const max=Math.max(0,...counts),peak=counts.indexOf(max);
  if(!max){$("#userDetailsContent").innerHTML='<p class="muted">এই অ্যাকাউন্টের ঘণ্টাভিত্তিক Activity History এখনো নেই। Tracking চালুর পর থেকে তথ্য জমা হবে।</p>';return;}
  const label=h=>{const d=new Date();d.setHours(h,0,0,0);return d.toLocaleTimeString([], {hour:"numeric",hour12:true});};
  $("#userDetailsContent").innerHTML='<div class="activity-summary"><span>Most observed hour</span><strong>'+label(peak)+'</strong><small>গত ৯০ দিনের '+max+'টি সক্রিয় ঘণ্টার রেকর্ড</small></div><div class="activity-hour-list">'+counts.map((n,h)=>'<div class="activity-hour-row"><span>'+label(h)+'</span><div class="activity-hour-track"><i style="width:'+(max?Math.round(n/max*100):0)+'%"></i></div><b>'+n+'</b></div>').join("")+'</div><p class="activity-disclaimer">প্রতিটি রেকর্ড মানে ওই ঘণ্টায় অন্তত একবার Activity শনাক্ত হয়েছে; এটি স্ক্রিন-টাইম বা ধারাবাহিক ব্যবহারের সময় নয়।</p>';
 }catch(e){$("#userDetailsContent").innerHTML='<p class="notice error">'+esc(e.message)+'</p>';}
}


$("#sendOwnerCode").onclick=async()=>{const f=$("#setupForm"),email=f.elements.email.value.trim();if(!email){notice("Owner email দিন।",true);return}try{await api("auth/owner-otp",{method:"POST",body:JSON.stringify({email})});notice("Verification code ইমেইলে পাঠানো হয়েছে।")}catch(err){notice(err.message,true)}};
$("#setupForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("auth/setup",{method:"POST",body:JSON.stringify({email:f.get("email"),username:f.get("username"),password:f.get("password"),code:f.get("code")})});notice("Owner account তৈরি হয়েছে।");await status()}catch(err){notice(err.message,true)}};
$("#loginForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("auth/login",{method:"POST",body:JSON.stringify({email:f.get("email"),password:f.get("password")})});e.target.reset();await status()}catch(err){notice(err.message,true)}};
$("#logout").onclick=async()=>{const button=$("#logout");button.disabled=true;try{await api("auth/logout",{method:"POST",body:"{}"});state.user=null;if(activeUsersTimer){clearInterval(activeUsersTimer);activeUsersTimer=null;}show("login");closeAdminMenu();notice("সফলভাবে Logout হয়েছে।")}catch(e){notice(e.message,true)}finally{button.disabled=false}};
function validAdminTab(value){
 return ["overview","videos","categories","site","admins"].includes(value)?value:"overview";
}
async function recordAdminTabView(tab){
 try{
  await api("analytics/event",{method:"POST",body:JSON.stringify({tab})});
  if(tab==="overview"){await loadOverviewAnalytics();renderOverview();}
 }catch(error){console.error("Admin analytics event failed:",error);}
}
function activateAdminTab(value){
 const target=validAdminTab(value);
 const allowedButton=document.querySelector('[data-tab="'+target+'"]:not([hidden])');
 const allowedPanel=$("#tab-"+target);
 if(!allowedButton||!allowedPanel)return;
 if(target==="admins"&&state.user?.role==="owner")loadActiveUsers();
 recordAdminTabView(target);
 document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x.dataset.tab===target));
 document.querySelectorAll(".tab-panel").forEach(x=>x.hidden=x.id!=="tab-"+target);
 closeAdminMenu();
}
function currentAdminTab(){
 const match=location.hash.match(/^#tab=(overview|videos|categories|site|admins)$/);
 return match?match[1]:"overview";
}
function navigateAdminTab(target){
 target=validAdminTab(target);
 if(target==="site"&&$("#headerSiteTab").hidden||target==="admins"&&$("#headerAdminsTab").hidden)return;
 if(location.hash!=="#tab="+target){location.hash="tab="+target;return;}
 activateAdminTab(target);
}
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>navigateAdminTab(b.dataset.tab));
window.addEventListener("hashchange",()=>{
 if(!$("#dashboard").hidden)activateAdminTab(currentAdminTab());
});
$("#newVideo").onclick=()=>editVideo("");$("#cancelVideo").onclick=()=>{$("#videoForm").hidden=true};
$("#videoForm").onsubmit=async e=>{e.preventDefault();const f=e.target,body={title:f.elements.title.value.trim(),category:f.elements.category.value,youtube_id:ytId(f.elements.youtube_id.value),thumbnail_url:f.elements.thumbnail_url.value.trim(),description:f.elements.description.value.trim(),featured:f.elements.featured.checked,published:f.elements.published.checked};if(!body.youtube_id){notice("সঠিক YouTube URL বা Video ID দিন।",true);return}try{if(f.elements.id.value)await api("admin/videos/"+encodeURIComponent(f.elements.id.value),{method:"PUT",body:JSON.stringify(body)});else await api("admin/videos",{method:"POST",body:JSON.stringify(body)});f.reset();f.hidden=true;await refresh();notice("ভিডিও সংরক্ষণ হয়েছে।")}catch(err){notice(err.message,true)}};
$("#categoryForm").onsubmit=async e=>{e.preventDefault();const name=new FormData(e.target).get("name").trim();try{await api("admin/categories",{method:"POST",body:JSON.stringify({name})});e.target.reset();await refresh();notice("ক্যাটাগরি যোগ হয়েছে।")}catch(err){notice(err.message,true)}};
$("#settingsForm").onsubmit=async e=>{e.preventDefault();const f=e.target,body={};for(const el of f.elements)if(el.name)body[el.name]=el.type==="checkbox"?(el.checked?"true":"false"):el.value;try{await api("admin/settings",{method:"PUT",body:JSON.stringify(body)});await refresh();notice("ওয়েবসাইটের সেটিংস সংরক্ষণ হয়েছে।")}catch(err){notice(err.message,true)}};
function closeAdminMenu(){
 document.body.classList.remove("sidebar-open");
 const b=$("#adminMenuToggle");if(b){b.setAttribute("aria-expanded","false");b.setAttribute("aria-label","মেনু খুলুন");}
 $("#adminSidebarBackdrop").hidden=true;
}
$("#adminMenuToggle").onclick=()=>{const open=!document.body.classList.contains("sidebar-open");document.body.classList.toggle("sidebar-open",open);$("#adminMenuToggle").setAttribute("aria-expanded",String(open));$("#adminMenuToggle").setAttribute("aria-label",open?"মেনু বন্ধ করুন":"মেনু খুলুন");$("#adminSidebarBackdrop").hidden=!open;};
$("#adminSidebarBackdrop").onclick=closeAdminMenu;
document.addEventListener("pointerdown",e=>{if(!document.body.classList.contains("sidebar-open"))return;if($("#adminSidebar").contains(e.target)||$("#adminMenuToggle").contains(e.target))return;closeAdminMenu();},true);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeAdminMenu();});
const adminMenuBreakpoint=window.matchMedia("(max-width: 760px)");adminMenuBreakpoint.addEventListener?.("change",closeAdminMenu);

$("#adminSearch").addEventListener("input",e=>{const q=e.target.value.trim().toLocaleLowerCase();document.querySelectorAll(".tab-panel:not([hidden]) .data-row").forEach(row=>row.hidden=!row.textContent.toLocaleLowerCase().includes(q));});
$("#adminSearchClear").onclick=()=>{$("#adminSearch").value="";$("#adminSearch").dispatchEvent(new Event("input"));};
const adminForm=$("#adminForm");if(adminForm)adminForm.hidden=true;
async function changeRole(id,role){if(!confirm(role==="admin"?"এই ব্যবহারকারীকে Admin করবেন?":"এই ব্যক্তির Admin permission বাতিল করবেন?"))return;try{await api("admin/users/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({role})});await refresh();notice(role==="admin"?"Admin permission দেওয়া হয়েছে।":"Admin permission বাতিল হয়েছে।")}catch(e){notice(e.message,true);await refresh()}}
async function revokeUserSessions(id){if(!confirm("এই ব্যবহারকারীর সব সক্রিয় Login session বাতিল করবেন? পরবর্তীবার তাকে আবার Login করতে হবে।"))return;try{const r=await api("admin/users/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({action:"revoke_sessions"})});notice("সক্রিয় Session বাতিল হয়েছে ("+Number(r.revokedSessions||0)+")।")}catch(e){notice(e.message,true)}}
function showUserDetails(id){
 const u=state.users.find(x=>String(x.id)===String(id));if(!u)return;$("#userDetailsTitle").textContent="Account Details";
 const d=new Date(Number(u.created_at)<1e12?Number(u.created_at)*1000:Number(u.created_at));
 $("#userDetailsContent").innerHTML=[
  ["Email",u.email],["Username",u.username||"—"],["Role",String(u.role||"").toUpperCase()],
  ["Account created",Number.isNaN(d.getTime())?"Unavailable":d.toLocaleString()],
  ["Email status",u.email_verified?"Verified":"Unverified"],["Account restriction",u.restriction_type&&(u.restriction_expires_at==null||Number(u.restriction_expires_at)>Math.floor(Date.now()/1000))?(u.restriction_type==="ban"?"Permanently banned":(u.restriction_expires_at?new Date(Number(u.restriction_expires_at)*1000).toLocaleString():"Suspended")):"None"],["Restriction reason",u.restriction_reason||"—"]
 ].map(([k,v])=>'<div class="user-detail-item"><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join("");
 $("#userDetailsDialog").showModal();
}
$("#userDetailsClose").addEventListener("click",()=>$("#userDetailsDialog").close());
$("#userDetailsDialog").addEventListener("click",e=>{if(e.target===$("#userDetailsDialog"))$("#userDetailsDialog").close()});

function openUserDetailsPanel(id){
 const user=state.users.find(x=>String(x.id)===String(id));if(!user)return;
 const panel=$("#userDetailsRail");if(!panel)return;
 const restricted=!!user.restriction_type&&(user.restriction_expires_at==null||Number(user.restriction_expires_at)>Math.floor(Date.now()/1000));
 const role=user.role==="owner"?"Owner":user.role==="admin"?"Admin":"Member";
 const created=new Date(Number(user.created_at)<1e12?Number(user.created_at)*1000:Number(user.created_at));
 const date=Number.isNaN(created.getTime())?"Date unavailable":created.toLocaleDateString();
 const action=(key,icon,label,cls="")=>'<button type="button" class="'+cls+'" data-user-action="'+key+'"><span class="udr-icon" aria-hidden="true">'+icon+'</span><span>'+label+'</span><span class="udr-arrow" aria-hidden="true">›</span></button>';
 let roleActions="";
 if(user.role!=="owner"&&!restricted)roleActions=user.role==="user"?action("promote","♛","Promote to Admin"):action("demote","♙","Remove Admin Access");
 let securityActions=restricted?action("restore","↻","Restore Account Access","udr-restore"):(action("revoke","↪","Revoke All Sessions")+action("suspend","Ⅱ","Suspend for 24 Hours","udr-warning")+action("ban","⊘","Permanently Ban","udr-danger"));
 panel.dataset.userId=String(user.id);
 panel.innerHTML='<div class="udr-head"><div><span class="udr-eyebrow">USER DETAILS</span><strong>'+esc(user.email)+'</strong><span class="udr-status">'+(restricted?(user.restriction_type==="ban"?"BANNED":"SUSPENDED"):"ACCOUNT ACTIVE")+'</span></div><button type="button" class="udr-close" aria-label="Close details">×</button></div>'+
 '<div class="udr-profile"><div class="udr-avatar">'+esc(String(user.username||user.email||"?").trim().charAt(0).toUpperCase())+'</div><div><strong>'+esc(user.email)+'</strong><span>'+role+' · '+(user.email_verified?"Verified":"Unverified")+'</span></div></div>'+
 '<section class="udr-section"><div class="udr-section-title">ROLE & ACCESS</div>'+(roleActions||'<p class="udr-note">'+(user.role==="owner"?"Owner account is protected.":"Role changes are unavailable while restricted.")+'</p>')+'</section>'+
 '<section class="udr-section"><div class="udr-section-title">ACCOUNT</div>'+action("details","▤","Account Details")+action("activity","◷","Most Active Hours")+action("copy","▢","Copy Email Address")+'</section>'+
 '<section class="udr-section"><div class="udr-section-title">SECURITY & CONTROL</div>'+securityActions+'</section>'+
 '<div class="udr-foot"><span>MEMBER SINCE</span><strong>'+esc(date)+'</strong></div>';
 document.body.classList.add("user-details-open");
 panel.setAttribute("aria-hidden","false");
 document.querySelectorAll("[data-user-details-open]").forEach(btn=>btn.setAttribute("aria-expanded",String(btn.closest("[data-user-row]")?.dataset.userRow===String(user.id))));
}
function closeUserDetailsPanel(){
 const panel=$("#userDetailsRail");if(!panel)return;
 document.body.classList.remove("user-details-open");panel.setAttribute("aria-hidden","true");
 document.querySelectorAll("[data-user-details-open]").forEach(btn=>btn.setAttribute("aria-expanded","false"));
}
$("#adminList").addEventListener("click",async e=>{
 const trigger=e.target.closest("[data-user-details-open]");if(trigger){const row=trigger.closest("[data-user-row]");if(row)openUserDetailsPanel(row.dataset.userRow);return;}
 const button=e.target.closest("[data-user-action]");if(!button)return;
 const row=button.closest("[data-user-row]");if(!row)return;
 const id=row.dataset.userRow,action=button.dataset.userAction;
 
 if(action==="promote")return changeRole(id,"admin");
 if(action==="demote")return changeRole(id,"user");
 if(action==="details")return showUserDetails(id);
 if(action==="activity")return showUserActivity(id);
 if(action==="suspend")return restrictUser(id,"suspend");
 if(action==="ban")return restrictUser(id,"ban");
 if(action==="restore")return restrictUser(id,"restore");
 if(action==="revoke")return revokeUserSessions(id);
 if(action==="copy"){const u=state.users.find(x=>String(x.id)===String(id));try{await navigator.clipboard.writeText(u.email);notice("ইমেইল কপি হয়েছে।")}catch{notice("Clipboard access পাওয়া যায়নি।",true)}}
});
$("#userDetailsRail")?.addEventListener("click",e=>{if(e.target.closest(".udr-close"))closeUserDetailsPanel();});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeUserDetailsPanel();});
status();