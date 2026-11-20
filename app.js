const KEY='frame-video-library-v1';
const starter=[
 {id:'demo1',title:'The Art of Cinematic Storytelling',category:'Featured',youtube:'ysz5S6PUM-U',description:'একটি নমুনা ভিডিও। Admin Panel থেকে নিজের ভিডিও যোগ করুন।',featured:true},
 {id:'demo2',title:'Learn Something New Today',category:'Education',youtube:'ScMzIvxBSi4',description:'শিক্ষামূলক ভিডিওর নমুনা।',featured:false},
 {id:'demo3',title:'Creative Inspiration',category:'Entertainment',youtube:'aqz-KE-bpKQ',description:'বিনোদন বিভাগের নমুনা ভিডিও।',featured:false}
];
let videos=load();
const $=s=>document.querySelector(s);
function load(){try{return JSON.parse(localStorage.getItem(KEY))||starter.slice()}catch{return starter.slice()}}
function save(){localStorage.setItem(KEY,JSON.stringify(videos));render()}
function ytId(value){let s=value.trim();if(/^[\w-]{11}$/.test(s))return s;try{let u=new URL(s);if(u.hostname.includes('youtu.be'))return u.pathname.slice(1).split('/')[0];if(u.searchParams.get('v'))return u.searchParams.get('v');let m=u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/);return m?m[1]:''}catch{return ''}}
function thumb(v){return v.thumbnail||`https://img.youtube.com/vi/${v.youtube}/hqdefault.jpg`}
function play(v){$('#playerTitle').textContent=v.title;$('#playerDescription').textContent=v.description||'';$('#playerFrame').innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.youtube)}?autoplay=1&rel=0" title="${escapeHtml(v.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;$('#playerDialog').showModal()}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(){
 const q=$('#search').value.toLowerCase().trim(),cat=$('#categoryFilter').value;
 const cats=[...new Set(videos.map(v=>v.category).filter(Boolean))].sort();
 $('#categoryFilter').innerHTML='<option value="all">সব ক্যাটাগরি</option>'+cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
 $('#categoryFilter').value=cats.includes(cat)?cat:'all';
 const filtered=videos.filter(v=>(cat==='all'||v.category===cat)&&(`${v.title} ${v.category} ${v.description||''}`.toLowerCase().includes(q)));
 const featured=videos.find(v=>v.featured)||videos[0];
 $('#heroTitle').textContent=featured?featured.title:'আপনার পরবর্তী পছন্দের ভিডিও';
 $('#heroDescription').textContent=featured?(featured.description||featured.category):'Admin Panel থেকে প্রথম ভিডিও যোগ করুন।';
 $('#heroPlay').disabled=!featured;$('#heroPlay').onclick=()=>featured&&play(featured);
 const groups={};filtered.forEach(v=>(groups[v.category||'অন্যান্য']??=[]).push(v));
 $('#videoRows').innerHTML=Object.entries(groups).map(([name,items])=>`<section class="video-row"><h3>${escapeHtml(name)}</h3><div class="cards">${items.map(v=>`<article class="video-card" data-id="${escapeHtml(v.id)}"><img class="thumb" src="${escapeHtml(thumb(v))}" alt="" loading="lazy" onerror="this.src='https://placehold.co/640x360/202020/ffffff?text=FRAME'"><div class="card-copy"><h4>${escapeHtml(v.title)}</h4><p>${escapeHtml(v.description||'ভিডিও দেখুন')}</p></div></article>`).join('')}</div></section>`).join('');
 $('#emptyState').hidden=filtered.length>0;
 document.querySelectorAll('.video-card').forEach(el=>el.addEventListener('click',()=>{const v=videos.find(x=>x.id===el.dataset.id);if(v)play(v)}));
 renderAdmin();
}
function renderAdmin(){$('#adminList').innerHTML=videos.map(v=>`<div class="admin-item"><span>${escapeHtml(v.title)} · ${escapeHtml(v.category)}</span><button data-delete="${escapeHtml(v.id)}">মুছুন</button></div>`).join('');document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{videos=videos.filter(v=>v.id!==b.dataset.delete);save()})}
$('#search').addEventListener('input',render);$('#categoryFilter').addEventListener('change',render);
$('#adminOpen').onclick=()=>$('#adminDialog').showModal();
$('#enterAdmin').onclick=()=>{$('#adminLogin').hidden=true;$('#adminPanel').hidden=false};
$('#videoForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),id=ytId(f.get('youtube'));if(!id){alert('সঠিক YouTube URL বা ১১ অক্ষরের Video ID দিন।');return}videos.unshift({id:crypto.randomUUID(),title:f.get('title').trim(),category:f.get('category').trim(),youtube:id,thumbnail:f.get('thumbnail').trim(),description:f.get('description').trim(),featured:f.get('featured')==='on'});save();e.target.reset();alert('ভিডিও যোগ হয়েছে।')};
$('#exportData').onclick=()=>{const blob=new Blob([JSON.stringify(videos,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='frame-videos.json';a.click();URL.revokeObjectURL(a.href)};
$('#importData').onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(!Array.isArray(data))throw Error();videos=data;save();alert('ডেটা Import হয়েছে।')}catch{alert('সঠিক JSON ফাইল নির্বাচন করুন।')}};
$('#resetDemo').onclick=()=>{if(confirm('সব পরিবর্তন মুছে ডেমো ডেটা ফিরিয়ে আনবেন?')){videos=starter.slice();save()}};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{const d=document.getElementById(b.dataset.close);d.close();if(d.id==='playerDialog')$('#playerFrame').innerHTML=''});
$('#playerDialog').addEventListener('close',()=>$('#playerFrame').innerHTML='');
render();