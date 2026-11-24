const $=s=>document.querySelector(s);
const liveMenuToggle=$("#liveMenuToggle"),liveSidebar=$("#liveSidebar"),liveSidebarBackdrop=$("#liveSidebarBackdrop");
let liveMenuCloseTimer=null;
function setLiveMenu(open){
 if(!liveMenuToggle||!liveSidebar)return;
 const isOpen=Boolean(open),mobile=window.matchMedia("(max-width:760px)").matches;
 clearTimeout(liveMenuCloseTimer);
 liveSidebar.classList.remove("mobile-open");
 void liveSidebar.offsetWidth;
 document.body.classList.remove("sidebar-open","drawer-open");
 if(liveSidebarBackdrop){liveSidebarBackdrop.classList.remove("is-closing");if(isOpen&&mobile)liveSidebarBackdrop.hidden=false;}
 if(isOpen){
  if(mobile){liveSidebar.classList.add("mobile-open");document.body.classList.add("drawer-open");}
  else document.body.classList.add("sidebar-open");
 }else if(liveSidebarBackdrop&&!liveSidebarBackdrop.hidden){
  liveSidebarBackdrop.classList.add("is-closing");
  liveMenuCloseTimer=setTimeout(()=>{liveSidebarBackdrop.hidden=true;liveSidebarBackdrop.classList.remove("is-closing");},720);
 }
 liveMenuToggle.setAttribute("aria-expanded",String(isOpen));
 liveMenuToggle.setAttribute("aria-label",isOpen?"মেনু বন্ধ করুন":"মেনু খুলুন");
}
liveMenuToggle?.addEventListener("click",()=>setLiveMenu(liveSidebar.classList.contains("mobile-open")||document.body.classList.contains("sidebar-open")?false:true));
liveSidebarBackdrop?.addEventListener("click",()=>setLiveMenu(false));
document.addEventListener("keydown",e=>{if(e.key==="Escape")setLiveMenu(false)});
liveSidebar?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>setLiveMenu(false)));
window.matchMedia("(max-width:760px)").addEventListener?.("change",()=>setLiveMenu(false));
let liveUser=null,refreshTimer=null,presenceTimer=null,latestUsers=[],accountUsers=[],selectedUser=null,drawerCloseTimer=null,restrictionCloseTimer=null,restrictionView="ban";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(path,opts={}){const r=await fetch("/api/"+path,{...opts,headers:{"Content-Type":"application/json",...(opts.headers||{})},credentials:"same-origin"});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||("Request failed ("+r.status+")"));return d}
function notice(message){const n=$("#liveNotice");n.textContent=message;n.classList.add("show");setTimeout(()=>n.classList.remove("show"),2600)}
function roleInfo(role){if(role==="owner")return ["Owner","crown"];if(role==="admin")return ["Admin","shield"];if(role==="guest")return ["Guest","guest"];return ["Member","user"]}
function roleIcon(kind){if(kind==="crown")return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m2 5 3 2 3-4 3 4 3-2-1 7H3L2 5Z"/><path d="M4 14h8"/></svg>';if(kind==="shield")return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 13 3.4v4.1c0 3.1-2 5.4-5 7-3-1.6-5-3.9-5-7V3.4L8 1.5Z"/><path d="m5.5 7.5 1.6 1.6 3.4-3.4"/></svg>';return '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5" r="2.5"/><path d="M2.5 14c.5-3 2.3-4.5 5.5-4.5s5 1.5 5.5 4.5"/></svg>'}
function flatten(data){return [...(data.admins||[]),...(data.members||[]),...(data.guests||[])].map(u=>({...u,role:u.role||"guest"})).sort((a,b)=>({owner:0,admin:1,user:2,guest:3}[a.role]??4)-({owner:0,admin:1,user:2,guest:3}[b.role]??4)||Number(b.last_seen||0)-Number(a.last_seen||0))}
function isRestricted(u){return !!u?.restriction_type&&(u.restriction_expires_at==null||Number(u.restriction_expires_at)>Math.floor(Date.now()/1000))}
function render(){const q=$("#liveSearch").value.trim().toLocaleLowerCase();const rows=latestUsers.filter(u=>String(u.name||"").toLocaleLowerCase().includes(q)||String(u.email||"").toLocaleLowerCase().includes(q));$("#liveCount").textContent=latestUsers.length.toLocaleString();$("#liveUpdated").textContent="UPDATED "+new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});$("#liveSearchClear").hidden=!q;
if(!rows.length){$("#liveList").innerHTML='<div class="live-state">'+(q?"No matching online users.":"No users are currently online.")+'</div>';return}
const groups=[["owner","Owner"],["admin","Admin"],["user","Member"],["guest","Guest"]];$("#liveList").innerHTML=groups.map(([role,title])=>{const list=rows.filter(u=>u.role===role);if(!list.length)return "";return '<section class="live-group"><div class="live-group-heading">'+title+'</div>'+list.map(u=>{const name=String(u.name||u.email||"Guest").trim()||"Guest",initial=esc(name.charAt(0).toLocaleUpperCase()),r=roleInfo(role),canOpen=!!u.id;return '<button type="button" class="live-user-row" data-user-id="'+esc(u.id||"")+'" '+(canOpen?'':'disabled aria-disabled="true"')+'><span class="live-avatar">'+initial+'<i class="live-presence-dot"></i></span><span class="live-user-copy"><span class="live-username">'+esc(name)+'</span><span class="live-role role-badge '+(role==="owner"?"role-badge--owner":role==="admin"?"role-badge--admin":role==="user"?"role-badge--member":"")+'">'+roleIcon(r[1])+esc(r[0])+'</span></span><span class="live-row-arrow" aria-hidden="true">›</span></button>'}).join("")+'</section>'}).join("");syncSourceHighlight()}
async function loadUsers(){const [active,all]=await Promise.all([api("admin/active-users"),api("admin/users")]);latestUsers=flatten(active);accountUsers=Array.isArray(all)?all:[];render();if($("#liveRestrictionsModal")?.classList.contains("is-open"))renderRestrictions()}
async function heartbeat(){try{await api("presence",{method:"POST",body:"{}"});await api("admin/presence",{method:"POST",body:"{}"});}catch{}}
function syncSourceHighlight(){document.querySelectorAll(".live-user-row.is-source-highlight").forEach(row=>row.classList.remove("is-source-highlight"));if(!selectedUser||!$("#liveUserDrawer")?.classList.contains("is-open"))return;const row=[...document.querySelectorAll(".live-user-row")].find(item=>String(item.dataset.userId)===String(selectedUser.id));row?.classList.add("is-source-highlight")}
function openDrawer(id){const u=accountUsers.find(x=>String(x.id)===String(id));if(!u){notice("এই ব্যবহারকারীর Account record পাওয়া যায়নি।");return}selectedUser=u;const restricted=isRestricted(u),role=u.role==="owner"?"Owner":u.role==="admin"?"Admin":"Member",created=new Date(Number(u.created_at)<1e12?Number(u.created_at)*1000:Number(u.created_at)),date=Number.isNaN(created.getTime())?"Unavailable":created.toLocaleDateString(),displayName=String(u.name||u.username||u.email||"User account").trim(),initial=displayName.charAt(0).toUpperCase();
$("#drawerTitle").textContent=displayName;const host=$("#liveDrawerBody");
const action=(key,symbol,label,cls="")=>'<button type="button" class="live-drawer-action '+cls+'" data-action="'+key+'"><span class="action-symbol" aria-hidden="true">'+symbol+'</span>'+label+'</button>';
const roleActions=u.role==="owner"?"":(u.role==="user"?action("promote","♛","Promote to Admin"):action("demote","♙","Remove Admin Access"));
const securityActions=u.role==="owner"?'<div class="live-drawer-protected">Owner account is protected. Role and security controls are unavailable.</div>':restricted?action("restore","↻","Restore Account Access"):action("revoke","↗","Revoke All Sessions")+action("suspend","Ⅱ","Suspend for 24 Hours","warning")+action("ban","⊘","Permanently Ban","danger");
host.innerHTML='<div class="live-drawer-profile"><span class="live-drawer-avatar">'+esc(initial)+'</span><div><strong>'+esc(displayName)+'</strong><small>'+esc(u.email||u.username||"")+'</small></div></div><div class="live-drawer-meta"><span class="live-drawer-chip role-badge '+(u.role==="owner"?"role-badge--owner":u.role==="admin"?"role-badge--admin":u.role==="user"?"role-badge--member":"")+'">'+role.toUpperCase()+'</span><span class="live-drawer-chip">'+(u.email_verified?"EMAIL VERIFIED":"EMAIL UNVERIFIED")+'</span><span class="live-drawer-chip '+(restricted?"restricted":"")+'">'+(restricted?(u.restriction_type==="ban"?"BANNED":"SUSPENDED"):"ACTIVE")+'</span><span class="live-drawer-chip">SINCE '+esc(date)+'</span></div><section class="live-drawer-section"><h3>ROLE & ACCESS</h3>'+roleActions+'</section><section class="live-drawer-section"><h3>ACCOUNT</h3>'+action("details","▤","Account Details")+action("activity","◷","Most Active Hours")+action("copy","▢","Copy Email Address")+'</section><section class="live-drawer-section"><h3>SECURITY & CONTROL</h3>'+securityActions+'</section>';
const drawer=$("#liveUserDrawer"),backdrop=$("#liveDrawerBackdrop");clearTimeout(drawerCloseTimer);drawer.classList.remove("is-closing","is-opening");drawer.classList.add("is-open","is-opening");setTimeout(()=>drawer.classList.remove("is-opening"),450);drawer.setAttribute("aria-hidden","false");backdrop.hidden=false;document.body.style.overflow="hidden";syncSourceHighlight();$("#liveDrawerClose").focus()}
function closeDrawer(){const drawer=$("#liveUserDrawer");if(!drawer.classList.contains("is-open"))return;drawer.classList.remove("is-open","is-opening");drawer.classList.add("is-closing");drawer.setAttribute("aria-hidden","true");$("#liveDrawerBackdrop").hidden=true;document.body.style.overflow="";clearTimeout(drawerCloseTimer);drawerCloseTimer=setTimeout(()=>{drawer.classList.remove("is-closing");},390);selectedUser=null;document.querySelectorAll(".live-user-row.is-source-highlight").forEach(row=>row.classList.remove("is-source-highlight"))}

function restrictedAccounts(type){return accountUsers.filter(u=>u.restriction_type===type&&isRestricted(u)).sort((a,b)=>Number(b.created_at||0)-Number(a.created_at||0))}
function renderRestrictions(){
 const banned=restrictedAccounts("ban"),suspended=restrictedAccounts("suspend");
 $("#liveBannedCount").textContent=banned.length.toLocaleString();
 $("#liveSuspendedCount").textContent=suspended.length.toLocaleString();
 const rows=restrictionView==="ban"?banned:suspended,kind=restrictionView==="ban"?"BANNED":"SUSPENDED";
 $("#liveRestrictionsList").innerHTML=rows.length?rows.map(u=>{
  const name=String(u.name||u.username||u.email||"User account").trim(),initial=esc(name.charAt(0).toUpperCase());
  const detail=restrictionView==="suspend"&&u.restriction_expires_at?"Access restores "+new Date(Number(u.restriction_expires_at)*1000).toLocaleString():String(u.restriction_reason||"Permanent restriction");
  return '<button type="button" class="live-restricted-user-row" data-restricted-user-id="'+esc(u.id)+'"><span class="live-restricted-avatar">'+initial+'</span><span class="live-restricted-copy"><strong>'+esc(name)+'</strong><small>'+esc(u.email||u.username||"")+'</small><small class="live-restricted-detail">'+esc(detail)+'</small></span><span class="live-restricted-status '+restrictionView+'">'+kind+'</span><span class="live-row-arrow" aria-hidden="true">›</span></button>';
 }).join(""):'<div class="live-state">কোনো '+(restrictionView==="ban"?"Banned":"Suspended")+' account পাওয়া যায়নি।</div>';
}
function openRestrictionsModal(){
 const modal=$("#liveRestrictionsModal"),backdrop=$("#liveDrawerBackdrop"),panel=document.querySelector(".live-panel");if(!modal)return;
 clearTimeout(restrictionCloseTimer);restrictionView="ban";
 /* Anchor the Block List window to the Live Users panel instead of viewport center. */
 if(panel){const rect=panel.getBoundingClientRect();modal.style.left=(rect.left+rect.width/2)+"px";modal.style.top=(rect.top+rect.height/2)+"px";}
 document.querySelectorAll(".live-restriction-tab").forEach(tab=>{const active=tab.dataset.restrictionView===restrictionView;tab.classList.toggle("is-active",active);tab.setAttribute("aria-selected",String(active))});
 renderRestrictions();modal.classList.remove("is-closing","is-opening");modal.classList.add("is-open","is-opening");
 setTimeout(()=>modal.classList.remove("is-opening"),450);modal.setAttribute("aria-hidden","false");backdrop.hidden=false;document.body.style.overflow="hidden";$("#liveRestrictionsClose").focus();
}
function closeRestrictionsModal(keepBackdrop=false){
 const modal=$("#liveRestrictionsModal");if(!modal?.classList.contains("is-open"))return;
 modal.classList.remove("is-open","is-opening");modal.classList.add("is-closing");modal.setAttribute("aria-hidden","true");
 clearTimeout(restrictionCloseTimer);restrictionCloseTimer=setTimeout(()=>{modal.classList.remove("is-closing");if(!keepBackdrop){$("#liveDrawerBackdrop").hidden=true;document.body.style.overflow=""}},390);
}
function detailRows(u){const d=new Date(Number(u.created_at)<1e12?Number(u.created_at)*1000:Number(u.created_at)),restriction=isRestricted(u)?(u.restriction_type==="ban"?"Permanently banned":u.restriction_expires_at?new Date(Number(u.restriction_expires_at)*1000).toLocaleString():"Suspended"):"None";return [["Email",u.email||"—"],["Username",u.username||"—"],["Role",String(u.role||"").toUpperCase()],["Account created",Number.isNaN(d.getTime())?"Unavailable":d.toLocaleString()],["Email status",u.email_verified?"Verified":"Unverified"],["Account restriction",restriction],["Restriction reason",u.restriction_reason||"—"]]}
function showDetails(u){$("#liveDialogTitle").textContent="Account Details";$("#liveDialogBody").innerHTML=detailRows(u).map(([k,v])=>'<div class="live-detail-row"><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join("");$("#liveUserDialog").showModal()}
async function showActivity(u){$("#liveDialogTitle").textContent="Most Active Hours";$("#liveDialogBody").innerHTML='<p class="live-state">Loading activity history…</p>';$("#liveUserDialog").showModal();try{const data=await api("admin/users/"+encodeURIComponent(u.id)+"/activity"),counts=Array(24).fill(0);for(const item of data.hours||[]){const hour=new Date(Number(item.hour_start)*1000).getHours();counts[hour]++}const max=Math.max(0,...counts),peak=counts.indexOf(max),label=h=>{const d=new Date();d.setHours(h,0,0,0);return d.toLocaleTimeString([],{hour:"numeric",hour12:true})};if(!max){$("#liveDialogBody").innerHTML='<p class="live-state">এই অ্যাকাউন্টের ঘণ্টাভিত্তিক Activity History এখনো নেই।</p>';return}$("#liveDialogBody").innerHTML='<div class="live-activity-summary"><span>Most observed hour</span><strong>'+label(peak)+'</strong><small>গত ৯০ দিনের '+max+'টি সক্রিয় ঘণ্টার রেকর্ড</small></div><div class="live-activity-bars">'+counts.map((n,h)=>'<div class="live-activity-row"><span>'+label(h)+'</span><div class="live-activity-track"><i style="width:'+(max?Math.round(n/max*100):0)+'%"></i></div><b>'+n+'</b></div>').join("")+'</div><p class="live-activity-note">প্রতিটি রেকর্ড মানে ওই ঘণ্টায় অন্তত একবার Activity শনাক্ত হয়েছে; এটি স্ক্রিন-টাইম বা ধারাবাহিক ব্যবহারের সময় নয়।</p>'}catch(e){$("#liveDialogBody").innerHTML='<p class="live-state error">'+esc(e.message)+'</p>'}}
async function changeRole(u,role){if(!confirm(role==="admin"?"এই ব্যবহারকারীকে Admin করবেন?":"এই ব্যক্তির Admin permission বাতিল করবেন?"))return;await api("admin/users/"+encodeURIComponent(u.id),{method:"PATCH",body:JSON.stringify({role})});notice(role==="admin"?"Admin permission দেওয়া হয়েছে।":"Admin permission বাতিল হয়েছে।");await loadUsers()}
async function revokeSessions(u){if(!confirm("এই ব্যবহারকারীর সব সক্রিয় Login session বাতিল করবেন? পরবর্তীবার তাকে আবার Login করতে হবে।"))return;const r=await api("admin/users/"+encodeURIComponent(u.id),{method:"PATCH",body:JSON.stringify({action:"revoke_sessions"})});notice("সক্রিয় Session বাতিল হয়েছে ("+Number(r.revokedSessions||0)+")।")}
async function restrictUser(u,action){const labels={suspend:"এই অ্যাকাউন্ট ২৪ ঘণ্টার জন্য স্থগিত হবে এবং সব সক্রিয় Session বাতিল হবে।",ban:"এই অ্যাকাউন্ট স্থায়ীভাবে নিষিদ্ধ হবে। ব্যবহারকারী আর Login করতে পারবেন না; তার কনটেন্ট/ডেটা মুছে ফেলা হবে না।",restore:"এই অ্যাকাউন্টের স্থগিতাদেশ/নিষেধাজ্ঞা তুলে নেওয়া হবে।"};if(!confirm(labels[action]||"চালিয়ে যাবেন?"))return;if(action==="ban"&&!confirm("এটি স্থায়ী নিষেধাজ্ঞা। নিশ্চিতভাবে এই অ্যাকাউন্ট Ban করবেন?"))return;let reason="";if(action==="suspend"||action==="ban"){const entered=prompt("কারণ লিখুন (ঐচ্ছিক):","");if(entered===null)return;reason=entered.trim().slice(0,500)}const payload={action:action==="suspend"?"suspend_24h":action==="ban"?"ban_permanent":"restore_access",reason};const result=await api("admin/users/"+encodeURIComponent(u.id),{method:"PATCH",body:JSON.stringify(payload)});await loadUsers();if(action==="suspend"&&result.emailNotification==="failed")notice("অ্যাকাউন্ট Suspend হয়েছে, কিন্তু ইমেইল পাঠানো যায়নি। Mailer configuration পরীক্ষা করুন।");else notice(action==="suspend"?"অ্যাকাউন্ট ২৪ ঘণ্টার জন্য স্থগিত হয়েছে।":action==="ban"?"অ্যাকাউন্ট স্থায়ীভাবে নিষিদ্ধ হয়েছে।":"অ্যাকাউন্টের Access পুনরুদ্ধার হয়েছে।")}
async function handleDrawerAction(action){const u=selectedUser;if(!u)return;closeDrawer();setTimeout(async()=>{try{if(action==="details")showDetails(u);else if(action==="activity")await showActivity(u);else if(action==="copy"){await navigator.clipboard.writeText(u.email||"");notice("Email address কপি হয়েছে।")}else if(action==="promote")await changeRole(u,"admin");else if(action==="demote")await changeRole(u,"user");else if(action==="revoke")await revokeSessions(u);else if(["suspend","ban","restore"].includes(action))await restrictUser(u,action)}catch(e){notice(e.message);try{await loadUsers()}catch{}}},390)}
async function init(){try{const status=await api("auth/status");if(!status.configured)throw new Error("Admin system is not configured.");const me=await api("auth/me");if(!me.authenticated)throw new Error("Please sign in to the Admin Dashboard first.");if(me.user.role!=="owner")throw new Error("Only the Owner can view Live Users.");liveUser=me.user;await heartbeat();await loadUsers();presenceTimer=setInterval(heartbeat,30000);refreshTimer=setInterval(()=>loadUsers().catch(e=>{$("#liveUpdated").textContent="UPDATE FAILED";notice(e.message)}),15000)}catch(e){$("#liveList").innerHTML='<div class="live-state error">'+esc(e.message)+'<br><br><a href="/admin" style="color:#bbb">Open Admin Dashboard</a></div>';$("#liveCount").textContent="—"}}
$("#liveSearch").addEventListener("input",render);$("#liveSearchClear").addEventListener("click",()=>{$("#liveSearch").value="";render();$("#liveSearch").focus()});
$("#liveList").addEventListener("click",e=>{const row=e.target.closest("[data-user-id]");if(row?.dataset.userId)openDrawer(row.dataset.userId)});
$("#liveDrawerBody").addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(b)handleDrawerAction(b.dataset.action)});

$("#liveDrawerClose").addEventListener("click",closeDrawer);
$("#liveRestrictionsOpen").addEventListener("click",openRestrictionsModal);
$("#liveRestrictionsClose").addEventListener("click",()=>closeRestrictionsModal());
$("#liveRestrictionsModal").addEventListener("click",e=>{
 const tab=e.target.closest("[data-restriction-view]");
 if(tab){restrictionView=tab.dataset.restrictionView;document.querySelectorAll(".live-restriction-tab").forEach(item=>{const active=item===tab;item.classList.toggle("is-active",active);item.setAttribute("aria-selected",String(active))});renderRestrictions();return}
 const row=e.target.closest("[data-restricted-user-id]");
 if(row){const id=row.dataset.restrictedUserId;closeRestrictionsModal(true);setTimeout(()=>openDrawer(id),390)}
});
$("#liveDrawerBackdrop").addEventListener("click",()=>{if($("#liveRestrictionsModal").classList.contains("is-open"))closeRestrictionsModal();else closeDrawer()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if($("#liveRestrictionsModal").classList.contains("is-open"))closeRestrictionsModal();else if($("#liveUserDrawer").classList.contains("is-open"))closeDrawer()}});

$("#liveDialogClose").addEventListener("click",()=>$("#liveUserDialog").close());$("#liveUserDialog").addEventListener("click",e=>{if(e.target===$("#liveUserDialog"))$("#liveUserDialog").close()});
window.addEventListener("pagehide",()=>{clearInterval(refreshTimer);clearInterval(presenceTimer);document.body.style.overflow=""});
init();