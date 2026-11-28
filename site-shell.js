(()=>{"use strict";
 const q=(s,r=document)=>r.querySelector(s);
 const header=()=>q("header");
 const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6h17M3.5 12h17M3.5 18h17"/></svg>';
 function ensureSidebar(){
   if(q(".yt-sidebar")) return;
   const h=header(); if(!h)return;
   let trigger=q(".yt-menu-trigger");
   if(!trigger){trigger=document.createElement("button");trigger.type="button";trigger.className="site-shell-menu-toggle yt-menu-trigger";trigger.setAttribute("aria-label","মেনু খুলুন");trigger.innerHTML=icon;h.prepend(trigger);}
   const back=document.createElement("div");back.className="site-shell-backdrop";back.hidden=true;
   const side=document.createElement("aside");side.className="site-shell-sidebar yt-sidebar";side.setAttribute("aria-label","প্রধান মেনু");
   side.innerHTML='<nav><a class="side-link" href="/"><span class="side-icon">⌂</span>Home</a><a class="side-link" href="/movies.html"><span class="side-icon">▦</span>Movies</a><a class="side-link" href="/profile.html"><span class="side-icon">◉</span>Profile</a></nav>';
   document.body.append(back,side);
   let closeTimer=null;
   const setOpen=open=>{
    clearTimeout(closeTimer);
    if(open){back.hidden=false;void side.offsetWidth;document.body.classList.add("site-shell-menu-open","sidebar-open");}
    else{document.body.classList.remove("site-shell-menu-open","sidebar-open");closeTimer=setTimeout(()=>{back.hidden=true;},700);}
    trigger.setAttribute("aria-expanded",String(open));
    trigger.setAttribute("aria-label",open?"মেনু বন্ধ করুন":"মেনু খুলুন");
   };
   trigger.addEventListener("click",()=>setOpen(!document.body.classList.contains("site-shell-menu-open")));
   back.addEventListener("click",()=>setOpen(false));
   side.querySelectorAll("a").forEach(link=>link.addEventListener("click",()=>setOpen(false)));
   document.addEventListener("keydown",e=>{if(e.key==="Escape")setOpen(false);});
 }
 function createProfile(){
   if(q("#profileMenuToggle")||q("#profileDrawer"))return;
   const h=header(); if(!h)return;
   const toggle=document.createElement("button");toggle.id="profileMenuToggle";toggle.type="button";toggle.className="site-shell-profile-toggle";toggle.hidden=true;toggle.setAttribute("aria-label","প্রোফাইল মেনু খুলুন");toggle.setAttribute("aria-expanded","false");toggle.setAttribute("aria-controls","profileDrawer");
   const anchor=q(".account-controls",h)||h; anchor.append(toggle);
   const panel=document.createElement("aside");panel.id="profileDrawer";panel.className="site-shell-profile-drawer";panel.setAttribute("aria-hidden","true");
   panel.innerHTML='<div class="site-shell-profile-drawer__head"><span>YOUR ACCOUNT</span><button type="button" class="site-shell-profile-drawer__close" aria-label="Close">×</button></div><div class="site-shell-profile-drawer__identity"><div class="site-shell-profile-drawer__avatar">U</div><div><div class="site-shell-profile-drawer__name">Profile</div><div class="site-shell-profile-drawer__user"></div></div></div><a class="site-shell-profile-drawer__profile" href="/profile.html"><span>View Profile</span><span>→</span></a><div class="site-shell-profile-drawer__details"><div class="site-shell-profile-drawer__detail site-shell-profile-drawer__detail--full"><span class="site-shell-profile-drawer__label">ABOUT</span><span class="site-shell-profile-drawer__value" data-field="bio">Not added yet</span></div><div class="site-shell-profile-drawer__detail"><span class="site-shell-profile-drawer__label">DATE OF BIRTH</span><span class="site-shell-profile-drawer__value" data-field="dob">Not added</span></div><div class="site-shell-profile-drawer__detail"><span class="site-shell-profile-drawer__label">GENDER</span><span class="site-shell-profile-drawer__value" data-field="gender">Not specified</span></div><div class="site-shell-profile-drawer__detail"><span class="site-shell-profile-drawer__label">LOCATION</span><span class="site-shell-profile-drawer__value" data-field="location">Not added</span></div><div class="site-shell-profile-drawer__detail site-shell-profile-drawer__detail--full"><span class="site-shell-profile-drawer__label">EMAIL</span><span class="site-shell-profile-drawer__value" data-field="email">—</span></div></div>';
   document.body.append(panel);
   const open=(state)=>{panel.classList.toggle("is-open",state);panel.setAttribute("aria-hidden",String(!state));toggle.setAttribute("aria-expanded",String(state));toggle.setAttribute("aria-label",state?"প্রোফাইল মেনু বন্ধ করুন":"প্রোফাইল মেনু খুলুন");document.body.classList.toggle("profile-drawer-open",state);};
   toggle.addEventListener("click",()=>open(!panel.classList.contains("is-open")));q(".site-shell-profile-drawer__close",panel).addEventListener("click",()=>open(false));document.addEventListener("keydown",e=>{if(e.key==="Escape")open(false);});
   (async()=>{try{const me=await fetch("/api/auth/me",{credentials:"same-origin"}).then(r=>r.json());if(!me.authenticated)return;const user=me.user||{};const data=await fetch("/api/profile",{credentials:"same-origin"}).then(r=>r.ok?r.json():({}));const p=data.profile||{};const initial=(p.full_name||user.username||"U").trim().charAt(0).toUpperCase();toggle.textContent=initial;q(".site-shell-profile-drawer__avatar",panel).textContent=initial;q(".site-shell-profile-drawer__name",panel).textContent=p.full_name||user.username||"Profile";q(".site-shell-profile-drawer__user",panel).textContent=user.username?"@"+user.username:"";const values={bio:p.bio||"Not added yet",dob:p.date_of_birth||"Not added",gender:({female:"Female",male:"Male",non_binary:"Non-binary",prefer_not_to_say:"Prefer not to say"})[p.gender]||"Not specified",location:p.location||"Not added",email:user.email||"—"};Object.entries(values).forEach(([k,v])=>{const n=q('[data-field="'+k+'"]',panel);if(n)n.textContent=v;});toggle.hidden=false;}catch{}})();
 }
 document.addEventListener("DOMContentLoaded",()=>{ensureSidebar();createProfile();});
})();
