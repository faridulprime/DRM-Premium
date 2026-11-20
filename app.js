const $=s=>document.querySelector(s);
const demoVideos=[
 {id:"demo1",title:"The Art of Cinematic Storytelling",category:"Featured",youtube_id:"ysz5S6PUM-U",description:"একটি নমুনা ভিডিও। Admin Panel থেকে নিজের ভিডিও যোগ করুন।",featured:1,thumbnail_url:""},
 {id:"demo2",title:"Learn Something New Today",category:"Education",youtube_id:"ScMzIvxBSi4",description:"শিক্ষামূলক ভিডিওর নমুনা।",featured:0,thumbnail_url:""},
 {id:"demo3",title:"Creative Inspiration",category:"Entertainment",youtube_id:"aqz-KE-bpKQ",description:"বিনোদন বিভাগের নমুনা ভিডিও।",featured:0,thumbnail_url:""}
];
let videos=[],categories=[],settings={};
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function thumb(v){return v.thumbnail_url||`https://img.youtube.com/vi/${encodeURIComponent(v.youtube_id)}/hqdefault.jpg`;}
function play(v){$("#playerTitle").textContent=v.title;$("#playerDescription").textContent=v.description||"";$("#playerFrame").innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.youtube_id)}?autoplay=1&rel=0" title="${esc(v.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;$("#playerDialog").showModal();}
function applySettings(){
 const pairs={brandName:"site_name",footerBrand:"site_name",heroEyebrow:"hero_eyebrow",libraryEyebrow:"library_eyebrow",libraryTitle:"library_title",footerText:"footer_text"};
 for(const [id,key] of Object.entries(pairs))if(settings[key])$("#"+id).textContent=settings[key];
 if(settings.hero_image)$("#hero").style.backgroundImage=`linear-gradient(90deg,#080808 0%,rgba(8,8,8,.86) 32%,rgba(8,8,8,.12) 100%),url("${settings.hero_image}")`;
 if(settings.accent_color&&/^#[0-9a-f]{6}$/i.test(settings.accent_color))document.documentElement.style.setProperty("--red",settings.accent_color);
 document.title=(settings.site_name||"FRAME")+" — Watch something great";
}
function render(){
 const q=$("#search").value.toLowerCase().trim(),cat=$("#categoryFilter").value;
 const cats=[...new Set(categories.map(c=>c.name).filter(Boolean))].sort();
 $("#categoryFilter").innerHTML='<option value="all">সব ক্যাটাগরি</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
 $("#categoryFilter").value=cats.includes(cat)?cat:"all";
 const filtered=videos.filter(v=>(cat==="all"||v.category===cat)&&(`${v.title} ${v.category} ${v.description||""}`.toLowerCase().includes(q)));
 const featured=videos.find(v=>Number(v.featured))||videos[0];
 $("#heroTitle").textContent=settings.hero_title|| (featured?featured.title:"আপনার পরবর্তী পছন্দের ভিডিও");
 $("#heroDescription").textContent=settings.hero_description|| (featured?(featured.description||featured.category):"নতুন ভিডিও শিগগিরই আসছে।");
 $("#heroPlay").disabled=!featured;$("#heroPlay").onclick=()=>featured&&play(featured);
 const groups={};filtered.forEach(v=>(groups[v.category||"অন্যান্য"]??=[]).push(v));
 $("#videoRows").innerHTML=Object.entries(groups).map(([name,items])=>`<section class="video-row"><h3>${esc(name)}</h3><div class="cards">${items.map(v=>`<article class="video-card" data-id="${esc(v.id)}"><img class="thumb" src="${esc(thumb(v))}" alt="" loading="lazy" onerror="this.src='https://placehold.co/640x360/202020/ffffff?text=FRAME'"><div class="card-copy"><h4>${esc(v.title)}</h4><p>${esc(v.description||"ভিডিও দেখুন")}</p></div></article>`).join("")}</div></section>`).join("");
 $("#emptyState").hidden=filtered.length>0;
 document.querySelectorAll(".video-card").forEach(el=>el.addEventListener("click",()=>{const v=videos.find(x=>x.id===el.dataset.id);if(v)play(v);}));
}
async function init(){
 $("#search").addEventListener("input",render);$("#categoryFilter").addEventListener("change",render);
 document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{const d=document.getElementById(b.dataset.close);d.close();$("#playerFrame").innerHTML="";});
 $("#playerDialog").addEventListener("close",()=>$("#playerFrame").innerHTML="");
 let apiReady=false;
 try{const [vr,cr,sr]=await Promise.all([fetch("/api/videos"),fetch("/api/categories"),fetch("/api/settings")]);if(vr.ok){videos=await vr.json();apiReady=true;}if(cr.ok)categories=await cr.json();if(sr.ok)settings=await sr.json();}
 catch(e){console.warn("FRAME API is not available yet.",e);}
 if(!apiReady)videos=demoVideos;if(!categories.length)categories=[...new Set(videos.map(v=>v.category))].map(name=>({name}));
 applySettings();render();
}
init();