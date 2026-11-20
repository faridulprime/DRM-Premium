const COOKIE="frame_admin_session",SESSION_SECONDS=604800,ITERATIONS=210000;
const DEFAULT_SETTINGS={site_name:"FRAME",hero_eyebrow:"EDITOR'S PICK",hero_title:"",hero_description:"",library_eyebrow:"DISCOVER",library_title:"ভিডিও লাইব্রেরি",footer_text:"একটি ব্যক্তিগত ভিডিও লাইব্রেরি",hero_image:"https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1800&q=85",accent_color:"#e50914"};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
const fail=(message,status=400)=>json({error:message},status);
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const un64=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
async function hash(s){return b64(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))}
async function passwordHash(password,salt){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);return b64(await crypto.subtle.deriveBits({name:"PBKDF2",salt:un64(salt),iterations:ITERATIONS,hash:"SHA-256"},key,256))}
async function makePassword(password){const salt=b64(crypto.getRandomValues(new Uint8Array(16)));return salt+"."+await passwordHash(password,salt)}
async function verifyPassword(password,stored){const [salt,want]=String(stored).split(".");if(!salt||!want)return false;const got=await passwordHash(password,salt);let d=got.length^want.length;for(let i=0;i<Math.max(got.length,want.length);i++)d|=(got.charCodeAt(i)||0)^(want.charCodeAt(i)||0);return d===0}
const cookie=v=>`${COOKIE}=${v}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
const clearCookie=()=>`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
function cookieToken(req){return (req.headers.get("Cookie")||"").split(";").map(v=>v.trim()).find(v=>v.startsWith(COOKIE+"="))?.slice(COOKIE.length+1)||""}
async function readBody(req){const len=Number(req.headers.get("content-length")||0);if(len>20000)return null;try{return await req.json()}catch{return null}}
const emailOK=v=>typeof v==="string"&&v.length<255&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const passwordOK=v=>typeof v==="string"&&v.length>=12&&v.length<=200;
const textOK=(v,n)=>typeof v==="string"&&v.trim().length>0&&v.length<=n;
function yt(s){if(typeof s!=="string")return"";const v=s.trim();if(/^[\w-]{11}$/.test(v))return v;try{const u=new URL(v);if(u.hostname==="youtu.be")return u.pathname.slice(1).split("/")[0];if(u.searchParams.get("v"))return u.searchParams.get("v");return u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1]||""}catch{return""}}
async function adminsExist(DB){const r=await DB.prepare("SELECT COUNT(*) AS n FROM users").first();return Number(r.n)>0}
async function getSession(req,env){const token=cookieToken(req);if(!token)return null;const now=Math.floor(Date.now()/1000);return await env.DB.prepare("SELECT u.id,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(await hash(token),now).first()}
async function newSession(id,env){const token=b64(crypto.getRandomValues(new Uint8Array(32))),now=Math.floor(Date.now()/1000);await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(await hash(token),id,now+SESSION_SECONDS,now).run();return token}
async function settings(DB){const rows=await DB.prepare("SELECT key,value FROM settings").all(),out={...DEFAULT_SETTINGS};for(const r of rows.results||[])out[r.key]=r.value;return out}
function originOK(req){const origin=req.headers.get("Origin");return !!origin&&origin===new URL(req.url).origin}
async function handle(req,env){
 if(!env.DB)return fail("D1 database binding DB is not configured. Follow the setup guide.",503);
 const u=new URL(req.url),p=u.pathname.replace(/^\/api\/?/,"").split("/").filter(Boolean),m=req.method;
 if(m!=="GET"){if(!originOK(req))return fail("Cross-origin request blocked.",403);if(!(req.headers.get("content-type")||"").toLowerCase().includes("application/json"))return fail("JSON content type required.",415)}
 if(p[0]==="auth"&&p[1]==="status"&&m==="GET")return json({configured:await adminsExist(env.DB)});
 if(p[0]==="auth"&&p[1]==="setup"&&m==="POST"){
  if(!env.BOOTSTRAP_SECRET)return fail("Cloudflare BOOTSTRAP_SECRET is not configured.",503);
  if(await adminsExist(env.DB))return fail("Initial setup is already complete.",409);
  const supplied=req.headers.get("x-setup-secret")||"",a=new TextEncoder().encode(supplied),b=new TextEncoder().encode(env.BOOTSTRAP_SECRET);let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a[i]||0)^(b[i]||0);if(diff!==0)return fail("Bootstrap Secret সঠিক নয়।",403);
  const d=await readBody(req);if(!emailOK(d?.email)||!passwordOK(d?.password))return fail("সঠিক email ও অন্তত ১২ অক্ষরের password দিন।");
  const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO users(id,email,password_hash,role,created_at) VALUES(?,?,?,'admin',?)").bind(id,d.email.toLowerCase(),await makePassword(d.password),Date.now()).run();
  const token=await newSession(id,env);return json({ok:true},201,{"set-cookie":cookie(token)});
 }
 if(p[0]==="auth"&&p[1]==="login"&&m==="POST"){
  if(!env.SESSION_SECRET)return fail("Cloudflare SESSION_SECRET is not configured.",503);
  const d=await readBody(req);if(!emailOK(d?.email)||typeof d?.password!=="string")return fail("Email এবং password প্রয়োজন।");
  const ip=req.headers.get("CF-Connecting-IP")||"unknown",ipHash=await hash(ip+env.SESSION_SECRET),now=Math.floor(Date.now()/1000);
  await env.DB.prepare("DELETE FROM login_attempts WHERE attempted_at<?").bind(now-900).run();
  const tries=await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE ip_hash=? AND attempted_at>?").bind(ipHash,now-900).first();if(Number(tries.n)>=8)return fail("অনেকবার চেষ্টা হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।",429);
  const user=await env.DB.prepare("SELECT id,email,password_hash,role FROM users WHERE email=?").bind(d.email.toLowerCase()).first();
  if(!user||!await verifyPassword(d.password,user.password_hash)){await env.DB.prepare("INSERT INTO login_attempts(ip_hash,attempted_at) VALUES(?,?)").bind(ipHash,now).run();return fail("Email অথবা password সঠিক নয়।",401)}
  await env.DB.prepare("DELETE FROM login_attempts WHERE ip_hash=?").bind(ipHash).run();await env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(now).run();
  const token=await newSession(user.id,env);return json({ok:true},200,{"set-cookie":cookie(token)});
 }
 if(p[0]==="auth"&&p[1]==="me"&&m==="GET"){const u=await getSession(req,env);return json(u?{authenticated:true,user:u}:{authenticated:false})}
 if(p[0]==="auth"&&p[1]==="logout"&&m==="POST"){const t=cookieToken(req);if(t)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hash(t)).run();return json({ok:true},200,{"set-cookie":clearCookie()})}
 if(p[0]==="videos"&&m==="GET"){const r=await env.DB.prepare("SELECT id,title,category,youtube_id,thumbnail_url,description,featured,published,created_at FROM videos WHERE published=1 ORDER BY featured DESC,sort_order ASC,created_at DESC").all();return json(r.results||[])}
 if(p[0]==="categories"&&m==="GET"){const r=await env.DB.prepare("SELECT id,name,sort_order FROM categories ORDER BY sort_order,name").all();return json(r.results||[])}
 if(p[0]==="settings"&&m==="GET")return json(await settings(env.DB));
 const user=await getSession(req,env);if(!user||user.role!=="admin")return fail("Admin login required.",401);
 if(p[0]==="admin"&&p[1]==="videos"&&p.length===2&&m==="GET"){const r=await env.DB.prepare("SELECT * FROM videos ORDER BY created_at DESC").all();return json(r.results||[])}
 if(p[0]==="admin"&&p[1]==="videos"&&p.length===2&&m==="POST"){const d=await readBody(req),id=yt(d?.youtube_id);if(!textOK(d?.title,120)||!textOK(d?.category,50)||!id)return fail("Title, category ও সঠিক YouTube ID প্রয়োজন।");const vid=crypto.randomUUID(),now=Date.now();await env.DB.prepare("INSERT INTO videos(id,title,category,youtube_id,thumbnail_url,description,featured,published,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(vid,d.title.trim(),d.category.trim(),id,String(d.thumbnail_url||"").slice(0,1000),String(d.description||"").slice(0,1000),d.featured?1:0,d.published===false?0:1,now,now).run();return json({ok:true,id:vid},201)}
 if(p[0]==="admin"&&p[1]==="videos"&&p.length===3&&m==="PUT"){const d=await readBody(req),id=yt(d?.youtube_id);if(!textOK(d?.title,120)||!textOK(d?.category,50)||!id)return fail("Title, category ও সঠিক YouTube ID প্রয়োজন।");const r=await env.DB.prepare("UPDATE videos SET title=?,category=?,youtube_id=?,thumbnail_url=?,description=?,featured=?,published=?,updated_at=? WHERE id=?").bind(d.title.trim(),d.category.trim(),id,String(d.thumbnail_url||"").slice(0,1000),String(d.description||"").slice(0,1000),d.featured?1:0,d.published===false?0:1,Date.now(),p[2]).run();return r.meta.changes?json({ok:true}):fail("ভিডিও পাওয়া যায়নি।",404)}
 if(p[0]==="admin"&&p[1]==="videos"&&p.length===3&&m==="DELETE"){const r=await env.DB.prepare("DELETE FROM videos WHERE id=?").bind(p[2]).run();return r.meta.changes?json({ok:true}):fail("ভিডিও পাওয়া যায়নি।",404)}
 if(p[0]==="admin"&&p[1]==="categories"&&p.length===2&&m==="POST"){const d=await readBody(req);if(!textOK(d?.name,50))return fail("ক্যাটাগরির নাম প্রয়োজন।");const id=crypto.randomUUID();try{await env.DB.prepare("INSERT INTO categories(id,name,sort_order) VALUES(?,?,?)").bind(id,d.name.trim(),Date.now()).run()}catch{return fail("এই ক্যাটাগরি আগে থেকেই আছে।",409)}return json({ok:true,id},201)}
 if(p[0]==="admin"&&p[1]==="categories"&&p.length===3&&m==="DELETE"){const n=await env.DB.prepare("SELECT COUNT(*) AS n FROM videos WHERE category=(SELECT name FROM categories WHERE id=?)").bind(p[2]).first();if(Number(n.n)>0)return fail("এই ক্যাটাগরিতে ভিডিও আছে। আগে ভিডিওগুলো অন্য ক্যাটাগরিতে সরান।",409);const r=await env.DB.prepare("DELETE FROM categories WHERE id=?").bind(p[2]).run();return r.meta.changes?json({ok:true}):fail("ক্যাটাগরি পাওয়া যায়নি।",404)}
 if(p[0]==="admin"&&p[1]==="settings"&&m==="PUT"){const d=await readBody(req),keys=["site_name","hero_eyebrow","hero_title","hero_description","library_eyebrow","library_title","footer_text","hero_image","accent_color"],stmts=[];for(const k of keys){if(typeof d?.[k]!=="string"||d[k].length>1000)continue;if(k==="hero_image"&&d[k]&&!/^https:\/\//i.test(d[k]))return fail("Hero image অবশ্যই HTTPS URL হতে হবে।");if(k==="accent_color"&&!/^#[0-9a-f]{6}$/i.test(d[k]))return fail("Accent color সঠিক নয়।");stmts.push(env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(k,d[k]))}if(stmts.length)await env.DB.batch(stmts);return json({ok:true})}
 if(p[0]==="admin"&&p[1]==="users"&&p.length===2&&m==="GET"){const r=await env.DB.prepare("SELECT id,email,role,created_at FROM users ORDER BY created_at").all();return json(r.results||[])}
 if(p[0]==="admin"&&p[1]==="users"&&p.length===2&&m==="POST"){const d=await readBody(req);if(!emailOK(d?.email)||!passwordOK(d?.password))return fail("সঠিক email ও অন্তত ১২ অক্ষরের password দিন।");const id=crypto.randomUUID();try{await env.DB.prepare("INSERT INTO users(id,email,password_hash,role,created_at) VALUES(?,?,?,'admin',?)").bind(id,d.email.toLowerCase(),await makePassword(d.password),Date.now()).run()}catch{return fail("এই email দিয়ে Admin আগে থেকেই আছে।",409)}return json({ok:true,id},201)}
 if(p[0]==="admin"&&p[1]==="users"&&p.length===3&&m==="DELETE"){if(p[2]===user.id)return fail("নিজের Admin account নিজে মুছতে পারবেন না。",400);const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();if(Number(count.n)<=1)return fail("শেষ Admin account মুছতে পারবেন না。",400);await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(p[2]).run();const r=await env.DB.prepare("DELETE FROM users WHERE id=?").bind(p[2]).run();return r.meta.changes?json({ok:true}):fail("Admin পাওয়া যায়নি。",404)}
 return fail("API route not found.",404)
}
export async function onRequest({request,env}){try{return await handle(request,env)}catch(e){console.error("FRAME API error",e);return fail("Server error. Check D1 migration and bindings.",500)}}