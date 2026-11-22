const COOKIE="frame_admin_session",VISITOR_COOKIE="frame_visitor_id",SESSION_SECONDS=604800,ITERATIONS=100000;

const BUILDER_NODE_TYPES=new Set(["section","container","grid","column","text","heading","image","button","link","icon","card","list","divider","spacer","video","form","input","textarea","select","checkbox","navbar","footer","hero"]);
const BUILDER_DEFAULT={schemaVersion:1,pages:[{id:"home",slug:"/",title:"Home",nodes:[]}],designTokens:{}};
async function readBuilderBody(req){
 const len=Number(req.headers.get("content-length")||0);if(len>250000)return null;
 try{const raw=await req.text();if(new TextEncoder().encode(raw).length>250000)return null;return JSON.parse(raw)}catch{return null}
}
function plainObject(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype}
function safeBuilderValue(v,depth=0){
 if(depth>6)return false;
 if(v===null||typeof v==="boolean"||typeof v==="number")return Number.isFinite(v);
 if(typeof v==="string")return v.length<=2000;
 if(Array.isArray(v))return v.length<=100&&v.every(x=>safeBuilderValue(x,depth+1));
 if(!plainObject(v)||Object.keys(v).length>100)return false;
 return Object.entries(v).every(([k,x])=>k.length<=80&&!/^(?:__proto__|prototype|constructor|innerHTML|outerHTML|srcdoc)$/i.test(k)&&safeBuilderValue(x,depth+1));
}
function validateBuilderDocument(doc){
 if(!plainObject(doc)||doc.schemaVersion!==1||!Array.isArray(doc.pages)||doc.pages.length<1||doc.pages.length>30||!plainObject(doc.designTokens)||!safeBuilderValue(doc.designTokens))return false;
 const pageIds=new Set(),slugs=new Set();let nodeCount=0;
 function validNode(node,depth=0){
  if(depth>8||!plainObject(node)||typeof node.id!=="string"||node.id.length<1||node.id.length>80||typeof node.type!=="string"||!BUILDER_NODE_TYPES.has(node.type)||!plainObject(node.props||{})||!safeBuilderValue(node.props||{}))return false;
  nodeCount++;if(nodeCount>1500)return false;
  if(node.children!==undefined&&(!Array.isArray(node.children)||node.children.length>100||!node.children.every(n=>validNode(n,depth+1))))return false;
  return true;
 }
 for(const page of doc.pages){
  if(!plainObject(page)||typeof page.id!=="string"||page.id.length>80||typeof page.slug!=="string"||page.slug.length>180||!/^\/(?:[a-z0-9-]+\/?)*$/.test(page.slug)||typeof page.title!=="string"||page.title.length>120||!Array.isArray(page.nodes)||page.nodes.length>100||!page.nodes.every(n=>validNode(n)))return false;
  if(pageIds.has(page.id)||slugs.has(page.slug))return false;pageIds.add(page.id);slugs.add(page.slug);
 }
 return true;
}
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
function visitorToken(req){return (req.headers.get("Cookie")||"").split(";").map(v=>v.trim()).find(v=>v.startsWith(VISITOR_COOKIE+"="))?.slice(VISITOR_COOKIE.length+1)||""}
async function readBody(req){const len=Number(req.headers.get("content-length")||0);if(len>20000)return null;try{return await req.json()}catch{return null}}
const emailOK=v=>typeof v==="string"&&v.length<255&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const passwordOK=v=>typeof v==="string"&&v.length>=8&&v.length<=200;
const textOK=(v,n)=>typeof v==="string"&&v.trim().length>0&&v.length<=n;
function yt(s){if(typeof s!=="string")return"";const v=s.trim();if(/^[\w-]{11}$/.test(v))return v;try{const u=new URL(v),host=u.hostname.toLowerCase();if(host==="youtu.be"){const id=u.pathname.split("/").filter(Boolean)[0]||"";return /^[\w-]{11}$/.test(id)?id:""}if(!["youtube.com","www.youtube.com","m.youtube.com","youtube-nocookie.com","www.youtube-nocookie.com"].includes(host))return"";const id=u.searchParams.get("v")||u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1]||"";return /^[\w-]{11}$/.test(id)?id:""}catch{return""}}
async function adminsExist(DB){const r=await DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role IN ('owner','admin')").first();return Number(r.n)>0}
async function getSession(req,env){const token=cookieToken(req);if(!token)return null;const now=Math.floor(Date.now()/1000);return await env.DB.prepare("SELECT u.id,u.email,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(await hash(token),now).first()}
async function newSession(id,env){const token=b64(crypto.getRandomValues(new Uint8Array(32))),now=Math.floor(Date.now()/1000);await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(await hash(token),id,now+SESSION_SECONDS,now).run();return token}
async function settings(DB){const rows=await DB.prepare("SELECT key,value FROM settings").all(),out={...DEFAULT_SETTINGS};for(const r of rows.results||[])out[r.key]=r.value;return out}
function originOK(req){const origin=req.headers.get("Origin");return !!origin&&origin===new URL(req.url).origin}
async function handle(req,env){
 if(!env.DB)return fail("D1 database binding DB is not configured. Follow the setup guide.",503);
 const u=new URL(req.url),p=u.pathname.replace(/^\/api\/?/,"").split("/").filter(Boolean),m=req.method;
 if(m!=="GET"){if(!originOK(req))return fail("Cross-origin request blocked.",403);if(!(req.headers.get("content-type")||"").toLowerCase().includes("application/json"))return fail("JSON content type required.",415)}
 if(p[0]==="presence"&&m==="POST"){
  const now=Math.floor(Date.now()/1000),visitor=await getSession(req,env);
  if(visitor){const key="u:"+visitor.id;await env.DB.prepare("INSERT INTO visitor_presence(presence_key,user_id,guest_label,last_seen) VALUES(?,?,NULL,?) ON CONFLICT(presence_key) DO UPDATE SET user_id=excluded.user_id,guest_label=NULL,last_seen=excluded.last_seen").bind(key,visitor.id,now).run();await env.DB.prepare("DELETE FROM visitor_presence WHERE last_seen<?").bind(now-120).run();return json({ok:true});}
  let token=visitorToken(req),isNew=!/^[A-Za-z0-9_-]{30,80}$/.test(token);if(isNew)token=b64(crypto.getRandomValues(new Uint8Array(32)));
  const visitorHash=await hash(token),key="g:"+visitorHash,label="Guest "+visitorHash.slice(0,5).toUpperCase();
  await env.DB.prepare("INSERT INTO visitor_presence(presence_key,user_id,guest_label,last_seen) VALUES(?,NULL,?,?) ON CONFLICT(presence_key) DO UPDATE SET last_seen=excluded.last_seen").bind(key,label,now).run();await env.DB.prepare("DELETE FROM visitor_presence WHERE last_seen<?").bind(now-120).run();
  return json({ok:true},200,isNew?{"set-cookie":VISITOR_COOKIE+"="+token+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000"}:{});
 }
 if(p[0]==="auth"&&p[1]==="status"&&m==="GET")return json({configured:await adminsExist(env.DB)});
 if(p[0]==="auth"&&p[1]==="owner-otp"&&m==="POST"){
  if(await adminsExist(env.DB))return fail("Initial setup is already complete.",409);
  if(!env.OWNER_EMAIL||!env.GOOGLE_APPS_SCRIPT_URL||!env.GOOGLE_APPS_SCRIPT_TOKEN||!env.SESSION_SECRET)return fail("Owner email verification is not configured. Set OWNER_EMAIL, GOOGLE_APPS_SCRIPT_URL, GOOGLE_APPS_SCRIPT_TOKEN and SESSION_SECRET.",503);
  const d=await readBody(req),email=String(d?.email||"").trim().toLowerCase();
  if(!emailOK(email)||email!==env.OWNER_EMAIL.toLowerCase())return fail("ইমেইলটি Owner-এর নির্ধারিত ইমেইলের সঙ্গে মিলছে না।",403);
  const now=Math.floor(Date.now()/1000),recent=await env.DB.prepare("SELECT created_at FROM owner_setup_otps ORDER BY created_at DESC LIMIT 1").first();
  if(recent&&now-Number(recent.created_at)<60)return fail("নতুন কোড পাঠানোর আগে ১ মিনিট অপেক্ষা করুন।",429);
  const random=new Uint32Array(1);crypto.getRandomValues(random);const code=String(100000+(random[0]%900000));
  const codeHash=await hash(email+":"+code+":"+env.SESSION_SECRET);
  await env.DB.prepare("DELETE FROM owner_setup_otps").run();
  await env.DB.prepare("INSERT INTO owner_setup_otps(email,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,0,?)").bind(email,codeHash,now+600,now).run();
   let sent;try{sent=await fetch(env.GOOGLE_APPS_SCRIPT_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:env.GOOGLE_APPS_SCRIPT_TOKEN,to:email,code,expiresInMinutes:10})});}catch(e){await env.DB.prepare("DELETE FROM owner_setup_otps").run();console.error("Google Apps Script request failed",e);return fail("Gmail service-এ সংযোগ করা যায়নি। Apps Script deployment পরীক্ষা করুন।",502)}
   let delivery={};try{delivery=await sent.json()}catch{}
   if(!sent.ok||delivery.ok!==true){await env.DB.prepare("DELETE FROM owner_setup_otps").run();console.error("Owner OTP email failed",sent.status,delivery.error||"invalid response");return fail("Gmail দিয়ে verification code পাঠানো যায়নি। Apps Script configuration পরীক্ষা করুন।",502)}
  return json({ok:true,message:"ইমেইলে verification code পাঠানো হয়েছে।"});
 }
 if(p[0]==="auth"&&p[1]==="setup"&&m==="POST"){
  if(await adminsExist(env.DB))return fail("Initial setup is already complete.",409);
  if(!env.SESSION_SECRET)return fail("Cloudflare SESSION_SECRET is not configured.",503);
  const d=await readBody(req),email=String(d?.email||"").trim().toLowerCase(),otp=String(d?.code||"").trim();
  if(!emailOK(email)||email!==String(env.OWNER_EMAIL||"").toLowerCase()||!passwordOK(d?.password)||!textOK(d?.username,30)||!/^[a-zA-Z0-9_]{3,30}$/.test(d.username)||!/^\d{6}$/.test(otp))return fail("সঠিক Owner email, ৬ সংখ্যার কোড, username এবং অন্তত ৮ অক্ষরের password দিন।");
  const now=Math.floor(Date.now()/1000),record=await env.DB.prepare("SELECT * FROM owner_setup_otps WHERE email=?").bind(email).first();
  if(!record||Number(record.expires_at)<now||Number(record.attempts)>=5)return fail("কোডের মেয়াদ শেষ বা চেষ্টা সীমা অতিক্রম হয়েছে। নতুন কোড নিন।",403);
  const expected=await hash(email+":"+otp+":"+env.SESSION_SECRET);
  if(expected!==record.code_hash){await env.DB.prepare("UPDATE owner_setup_otps SET attempts=attempts+1 WHERE email=?").bind(email).run();return fail("Verification code সঠিক নয়।",403)}
  const id=crypto.randomUUID();
  try {
   await env.DB.batch([
    env.DB.prepare("INSERT INTO users(id,email,username,password_hash,role,email_verified,created_at) VALUES(?,?,?,?,'owner',1,?)").bind(id,email,String(d.username).toLowerCase(),await makePassword(d.password),Date.now()),
    env.DB.prepare("UPDATE videos SET owner_id=? WHERE owner_id IS NULL").bind(id),
    env.DB.prepare("UPDATE categories SET owner_id=? WHERE owner_id IS NULL").bind(id),
    env.DB.prepare("DELETE FROM owner_setup_otps").bind()
   ]);
  } catch(e) {
   if(await adminsExist(env.DB))return fail("Initial setup is already complete.",409);
   console.error("Owner bootstrap failed",e);
   return fail("DB_ERROR: "+String(e?.message||e).slice(0,240),409);
  }
  const token=await newSession(id,env);return json({ok:true},201,{"set-cookie":cookie(token)});
 }
 if(p[0]==="auth"&&p[1]==="login"&&m==="POST"){
  if(!env.SESSION_SECRET)return fail("Cloudflare SESSION_SECRET is not configured.",503);
  const d=await readBody(req);if(!emailOK(d?.email)||typeof d?.password!=="string")return fail("Email এবং password প্রয়োজন।");
  const ip=req.headers.get("CF-Connecting-IP")||"unknown",ipHash=await hash(ip+env.SESSION_SECRET),now=Math.floor(Date.now()/1000);
  await env.DB.prepare("DELETE FROM login_attempts WHERE attempted_at<?").bind(now-900).run();
  const tries=await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE ip_hash=? AND attempted_at>?").bind(ipHash,now-900).first();if(Number(tries.n)>=8)return fail("অনেকবার চেষ্টা হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।",429);
  const user=await env.DB.prepare("SELECT id,email,username,password_hash,role,email_verified FROM users WHERE email=?").bind(d.email.toLowerCase()).first();
  if(!user||user.email_verified===0||!await verifyPassword(d.password,user.password_hash)){await env.DB.prepare("INSERT INTO login_attempts(ip_hash,attempted_at) VALUES(?,?)").bind(ipHash,now).run();return fail("Email অথবা password সঠিক নয়।",401)}
  await env.DB.prepare("DELETE FROM login_attempts WHERE ip_hash=?").bind(ipHash).run();await env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(now).run();
  const token=await newSession(user.id,env);return json({ok:true},200,{"set-cookie":cookie(token)});
 }
 if(p[0]==="auth"&&p[1]==="me"&&m==="GET"){const u=await getSession(req,env);return json(u?{authenticated:true,user:u}:{authenticated:false})}
 if(p[0]==="auth"&&p[1]==="logout"&&m==="POST"){const t=cookieToken(req);if(t)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hash(t)).run();return json({ok:true},200,{"set-cookie":clearCookie()})}
 if(p[0]==="videos"&&m==="GET"){const r=await env.DB.prepare("SELECT id,title,category,youtube_id,thumbnail_url,description,featured,published,created_at FROM videos WHERE published=1 ORDER BY featured DESC,sort_order ASC,created_at DESC").all();return json(r.results||[])}
 if(p[0]==="categories"&&m==="GET"){const r=await env.DB.prepare("SELECT id,name,sort_order FROM categories ORDER BY sort_order,name").all();return json(r.results||[])}
 if(p[0]==="settings"&&m==="GET")return json(await settings(env.DB));
 if(p[0]==="analytics"&&p[1]==="event"&&p.length===2&&m==="POST"){const d=await readBody(req),allowed=new Set(["home","browse","references","articles","books","admin"]);if(!allowed.has(d?.tab))return fail("Invalid analytics tab.",400);await env.DB.prepare("INSERT INTO analytics_events(tab,created_at) VALUES(?,?)").bind(d.tab,Math.floor(Date.now()/1000)).run();return json({ok:true},201)}
 const user=await getSession(req,env);if(!user||!["owner","admin"].includes(user.role))return fail("Admin login required.",401);

 if(p[0]==="builder"){
  if(!user||user.role!=="owner")return fail("শুধু Owner Website Builder ব্যবহার করতে পারবেন।",403);
  if(p.length===2&&p[1]==="style"&&m==="PUT"){
   const d=await readBody(req),cfg=d?.config;
   if(!cfg||typeof cfg!=="object"||Array.isArray(cfg)||Object.keys(cfg).length>100)return fail("Style configuration অবৈধ অথবা ১০০টি element সীমা অতিক্রম করেছে।",400);
   for(const item of Object.values(cfg)){
    const s=item?.style,sh=s?.shadow;
    if(typeof item?.selector!=="string"||!item.selector.length||item.selector.length>500||typeof item.text!=="string"||item.text.length>2000||typeof item.replaceText!=="boolean"||!s||!Number.isFinite(s.fontSize)||s.fontSize<8||s.fontSize>96||!/^#[0-9a-f]{6}$/i.test(s.color||"")||!/^#[0-9a-f]{6}$/i.test(s.background||"")||!sh||!/^#[0-9a-f]{6}$/i.test(sh.color||"")||![sh.x,sh.y,sh.blur].every(Number.isFinite)||Math.abs(sh.x)>20||Math.abs(sh.y)>20||sh.blur<0||sh.blur>30)return fail("এক বা একাধিক style value সঠিক নয়।",400);
   }
   const encoded=JSON.stringify(cfg);
   if(new TextEncoder().encode(encoded).length>25000)return fail("Style configuration 25 KB সীমা অতিক্রম করেছে।",413);
   await env.DB.prepare("INSERT INTO settings(key,value) VALUES('visual_editor_config',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(encoded).run();
   const row=await env.DB.prepare("SELECT value FROM settings WHERE key='visual_editor_config'").first();
   if(row?.value!==encoded)return fail("D1 read-back verification ব্যর্থ হয়েছে।",500);
   return json({ok:true,saved:true,bytes:new TextEncoder().encode(encoded).length,config:JSON.parse(row.value)});
  }

  if(p.length===2&&p[1]==="state"&&m==="GET"){
   const row=await env.DB.prepare("SELECT draft_json,revision,updated_at,published_at FROM site_builder_documents WHERE id='primary'").first();
   return json({document:row?JSON.parse(row.draft_json):BUILDER_DEFAULT,revision:Number(row?.revision||0),updatedAt:row?.updated_at||null,publishedAt:row?.published_at||null,publishEnabled:false});
  }
  if(p.length===2&&p[1]==="draft"&&m==="PUT"){
   const d=await readBuilderBody(req);if(!d||!Number.isInteger(d.baseRevision)||d.baseRevision<0||!validateBuilderDocument(d.document))return fail("Draft document বা revision সঠিক নয়।",400);
   const encoded=JSON.stringify(d.document),now=Math.floor(Date.now()/1000);
   if(new TextEncoder().encode(encoded).length>200000)return fail("Draft 200 KB সীমা অতিক্রম করেছে।",413);
   const current=await env.DB.prepare("SELECT revision FROM site_builder_documents WHERE id='primary'").first();
   if(!current){
    if(d.baseRevision!==0)return fail("Draft অন্য জায়গায় পরিবর্তিত হয়েছে। Reload করে আবার চেষ্টা করুন।",409);
    try{await env.DB.batch([
     env.DB.prepare("INSERT INTO site_builder_documents(id,draft_json,published_json,revision,updated_at,published_at) VALUES('primary',?,NULL,1,?,NULL)").bind(encoded,now),
     env.DB.prepare("INSERT INTO site_builder_revisions(document_id,revision,snapshot_json,created_at,actor_id,summary) VALUES('primary',1,?,?,?,'Initial draft save')").bind(encoded,now,user.id)
    ])}catch{return fail("Draft তৈরি করা যায়নি; আবার Load করে চেষ্টা করুন।",409)}
    return json({ok:true,revision:1,updatedAt:now});
   }
   if(Number(current.revision)!==d.baseRevision)return fail("Draft অন্য জায়গায় পরিবর্তিত হয়েছে। Reload করে আবার চেষ্টা করুন।",409);
   const result=await env.DB.batch([
    env.DB.prepare("UPDATE site_builder_documents SET draft_json=?,revision=revision+1,updated_at=? WHERE id='primary' AND revision=?").bind(encoded,now,d.baseRevision),
    env.DB.prepare("INSERT INTO site_builder_revisions(document_id,revision,snapshot_json,created_at,actor_id,summary) SELECT 'primary',revision,draft_json,?,?, 'Draft auto-save' FROM site_builder_documents WHERE id='primary' AND revision=? AND changes()=1").bind(now,user.id,d.baseRevision+1),
    env.DB.prepare("DELETE FROM site_builder_revisions WHERE document_id='primary' AND created_at<?").bind(now-2592000)
   ]);
   if(!result?.[0]?.meta?.changes)return fail("Draft conflict হয়েছে। সর্বশেষ সংস্করণ Reload করুন।",409);
   return json({ok:true,revision:d.baseRevision+1,updatedAt:now});
  }
  if(p.length===2&&p[1]==="history"&&m==="GET"){
   const rows=await env.DB.prepare("SELECT revision,created_at,summary FROM site_builder_revisions WHERE document_id='primary' AND created_at>=? ORDER BY revision DESC LIMIT 500").bind(Math.floor(Date.now()/1000)-2592000).all();
   return json({revisions:rows.results||[],retentionDays:30});
  }
  return fail("Builder API route not found.",404);
 }
 if(p[0]==="admin"&&p[1]==="active-users"&&m==="GET"){
  if(user.role!=="owner")return fail("শুধু Owner সক্রিয় ব্যবহারকারীদের তালিকা দেখতে পারবেন।",403);
  const now=Math.floor(Date.now()/1000);await env.DB.prepare("DELETE FROM visitor_presence WHERE last_seen<?").bind(now-120).run();
  const rows=await env.DB.prepare("SELECT u.id,u.username,u.email,u.role,p.guest_label,p.last_seen FROM visitor_presence p LEFT JOIN users u ON u.id=p.user_id WHERE p.last_seen>=? ORDER BY CASE WHEN u.role IN ('owner','admin') THEN 0 WHEN u.id IS NOT NULL THEN 1 ELSE 2 END,p.last_seen DESC").bind(now-90).all();
  const result={admins:[],members:[],guests:[]};for(const row of rows.results||[]){if(row.role==="owner"||row.role==="admin")result.admins.push({id:row.id,name:row.username||row.email,email:row.email,role:row.role,last_seen:Number(row.last_seen)});else if(row.id)result.members.push({id:row.id,name:row.username||row.email,email:row.email,role:"user",last_seen:Number(row.last_seen)});else result.guests.push({name:row.guest_label||"Guest",role:"guest",last_seen:Number(row.last_seen)});}
  return json({updated_at:now,active_window_seconds:90,total:result.admins.length+result.members.length+result.guests.length,...result});
 }
 if(p[0]==="admin"&&p[1]==="presence"&&m==="POST"){const now=Math.floor(Date.now()/1000);await env.DB.prepare("INSERT INTO admin_presence(user_id,last_seen) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen=excluded.last_seen").bind(user.id,now).run();await env.DB.prepare("DELETE FROM admin_presence WHERE last_seen<?").bind(now-120).run();return json({ok:true})}
 if(p[0]==="admin"&&p[1]==="analytics"&&m==="GET"){const now=Math.floor(Date.now()/1000);await env.DB.prepare("DELETE FROM admin_presence WHERE last_seen<?").bind(now-120).run();const [online,admins,posts,tabs]=await Promise.all([env.DB.prepare("SELECT COUNT(*) AS n FROM admin_presence p JOIN users u ON u.id=p.user_id WHERE u.role IN ('owner','admin') AND p.last_seen>=?").bind(now-90).first(),env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role IN ('owner','admin')").first(),env.DB.prepare("SELECT u.id,u.email,u.role,u.created_at,COUNT(v.id) AS post_count FROM users u LEFT JOIN videos v ON v.owner_id=u.id WHERE u.role IN ('owner','admin') GROUP BY u.id ORDER BY post_count DESC,u.created_at ASC").all(),env.DB.prepare("SELECT tab,COUNT(*) AS view_count FROM analytics_events GROUP BY tab ORDER BY view_count DESC").all()]);const labels={home:"মূল পৃষ্ঠা",browse:"ভিডিও",references:"রেফারেন্স",articles:"আর্টিকেল",books:"বইপত্র",admin:"এডমিন"};const tabRows=(tabs.results||[]).map(x=>({label:labels[x.tab]||x.tab,view_count:Number(x.view_count)}));return json({online_count:Number(online.n),admin_count:Number(admins.n),total_posts:(posts.results||[]).reduce((n,x)=>n+Number(x.post_count),0),total_tab_views:tabRows.reduce((n,x)=>n+x.view_count,0),admins:(posts.results||[]).map(x=>({email:x.email,role:x.role,created_at:x.created_at,post_count:Number(x.post_count)})),tabs:tabRows})}

 if(p[0]==="admin"&&p[1]==="videos"&&p.length===2&&m==="GET"){const r=await env.DB.prepare("SELECT * FROM videos WHERE (?='owner' OR owner_id=?) ORDER BY created_at DESC").bind(user.role,user.id).all();return json(r.results||[])}
 if(p[0]==="admin"&&p[1]==="videos"&&p.length===2&&m==="POST"){const d=await readBody(req),id=yt(d?.youtube_id);if(!textOK(d?.title,120)||!textOK(d?.category,50)||!id)return fail("Title, category ও সঠিক YouTube ID প্রয়োজন।");const cat=await env.DB.prepare("SELECT id FROM categories WHERE name=? AND (?='owner' OR owner_id=?)").bind(d.category.trim(),user.role,user.id).first();if(!cat)return fail("এই ক্যাটাগরি আপনার নিয়ন্ত্রণে নেই। নিজের ক্যাটাগরি তৈরি করুন।",403);const vid=crypto.randomUUID(),now=Date.now();await env.DB.prepare("INSERT INTO videos(id,title,category,youtube_id,thumbnail_url,description,featured,published,owner_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(vid,d.title.trim(),d.category.trim(),id,String(d.thumbnail_url||"").slice(0,1000),String(d.description||"").slice(0,1000),d.featured?1:0,d.published===false?0:1,user.id,now,now).run();return json({ok:true,id:vid},201)}
 if(p[0]==="admin"&&p[1]==="videos"&&p.length===3&&m==="PUT"){const d=await readBody(req),id=yt(d?.youtube_id);if(!textOK(d?.title,120)||!textOK(d?.category,50)||!id)return fail("Title, category ও সঠিক YouTube ID প্রয়োজন।");const cat=await env.DB.prepare("SELECT id FROM categories WHERE name=? AND (?='owner' OR owner_id=?)").bind(d.category.trim(),user.role,user.id).first();if(!cat)return fail("এই ক্যাটাগরি আপনার নিয়ন্ত্রণে নেই।",403);const r=await env.DB.prepare("UPDATE videos SET title=?,category=?,youtube_id=?,thumbnail_url=?,description=?,featured=?,published=?,updated_at=? WHERE id=? AND (?='owner' OR owner_id=?)").bind(d.title.trim(),d.category.trim(),id,String(d.thumbnail_url||"").slice(0,1000),String(d.description||"").slice(0,1000),d.featured?1:0,d.published===false?0:1,Date.now(),p[2],user.role,user.id).run();return r.meta.changes?json({ok:true}):fail("ভিডিও পাওয়া যায়নি।",404)}
 if(p[0]==="admin"&&p[1]==="videos"&&p.length===3&&m==="DELETE"){const r=await env.DB.prepare("DELETE FROM videos WHERE id=? AND (?='owner' OR owner_id=?)").bind(p[2],user.role,user.id).run();return r.meta.changes?json({ok:true}):fail("ভিডিও পাওয়া যায়নি অথবা এটি আপনার নয়।",404)}
 if(p[0]==="admin"&&p[1]==="categories"&&p.length===2&&m==="GET"){const r=await env.DB.prepare("SELECT id,name,sort_order FROM categories WHERE (?='owner' OR owner_id=?) ORDER BY sort_order,name").bind(user.role,user.id).all();return json(r.results||[])}
 if(p[0]==="admin"&&p[1]==="categories"&&p.length===2&&m==="POST"){const d=await readBody(req);if(!textOK(d?.name,50))return fail("ক্যাটাগরির নাম প্রয়োজন।");const id=crypto.randomUUID();try{await env.DB.prepare("INSERT INTO categories(id,name,owner_id,sort_order) VALUES(?,?,?,?)").bind(id,d.name.trim(),user.id,Date.now()).run()}catch{return fail("এই ক্যাটাগরি আগে থেকেই আছে।",409)}return json({ok:true,id},201)}
 if(p[0]==="admin"&&p[1]==="categories"&&p.length===3&&m==="PUT"){const d=await readBody(req);if(!textOK(d?.name,50))return fail("ক্যাটাগরির নাম প্রয়োজন।");const old=await env.DB.prepare("SELECT name FROM categories WHERE id=? AND (?='owner' OR owner_id=?)").bind(p[2],user.role,user.id).first();if(!old)return fail("ক্যাটাগরি পাওয়া যায়নি অথবা এটি আপনার নয়।",404);try{await env.DB.batch([env.DB.prepare("UPDATE categories SET name=? WHERE id=?").bind(d.name.trim(),p[2]),env.DB.prepare("UPDATE videos SET category=? WHERE category=? AND (?='owner' OR owner_id=?)").bind(d.name.trim(),old.name,user.role,user.id)]);}catch{return fail("এই নামে অন্য ক্যাটাগরি আছে।",409)}return json({ok:true})}
 if(p[0]==="admin"&&p[1]==="categories"&&p.length===3&&m==="DELETE"){const n=await env.DB.prepare("SELECT COUNT(*) AS n FROM videos WHERE category=(SELECT name FROM categories WHERE id=? AND (?='owner' OR owner_id=?)) AND (?='owner' OR owner_id=?)").bind(p[2],user.role,user.id,user.role,user.id).first();if(Number(n.n)>0)return fail("এই ক্যাটাগরিতে ভিডিও আছে। আগে ভিডিওগুলো অন্য ক্যাটাগরিতে সরান।",409);const r=await env.DB.prepare("DELETE FROM categories WHERE id=? AND (?='owner' OR owner_id=?)").bind(p[2],user.role,user.id).run();return r.meta.changes?json({ok:true}):fail("ক্যাটাগরি পাওয়া যায়নি অথবা এটি আপনার নয়।",404)}
 if(p[0]==="admin"&&p[1]==="settings"&&m==="PUT"){if(user.role!=="owner")return fail("শুধু Owner ওয়েবসাইটের সেটিংস পরিবর্তন করতে পারবেন।",403);const d=await readBody(req),keys=["site_name","hero_eyebrow","hero_title","hero_description","library_eyebrow","library_title","footer_text","hero_image","accent_color","show_hero","show_library","visual_editor_config"],stmts=[];for(const k of keys){const maxLength=k==="visual_editor_config"?25000:1000;if(typeof d?.[k]!=="string"||d[k].length>maxLength)continue;if(k==="hero_image"&&d[k]&&!/^https:\/\//i.test(d[k]))return fail("Hero image অবশ্যই HTTPS URL হতে হবে।");if(k==="accent_color"&&!/^#[0-9a-f]{6}$/i.test(d[k]))return fail("Accent color সঠিক নয়।");if(k==="visual_editor_config"){if(d[k].length>25000)return fail("Visual editor configuration is too large.");let cfg;try{cfg=JSON.parse(d[k]);}catch{return fail("Visual editor data is invalid.");}if(!cfg||typeof cfg!=="object"||Array.isArray(cfg)||Object.keys(cfg).length>100)return fail("Visual editor data is invalid.");for(const item of Object.values(cfg)){const s=item?.style,sh=s?.shadow;if(typeof item?.selector!=="string"||item.selector.length>500||typeof item.text!=="string"||item.text.length>2000||!s||!Number.isFinite(s.fontSize)||s.fontSize<8||s.fontSize>96||!/^#[0-9a-f]{6}$/i.test(s.color||"")||!/^#[0-9a-f]{6}$/i.test(s.background||"")||!sh||!/^#[0-9a-f]{6}$/i.test(sh.color||"")||![sh.x,sh.y,sh.blur].every(Number.isFinite)||Math.abs(sh.x)>20||Math.abs(sh.y)>20||sh.blur<0||sh.blur>30)return fail("Visual editor style values are invalid.");}}stmts.push(env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(k,d[k]))}if(stmts.length)await env.DB.batch(stmts);return json({ok:true})}
 if(p[0]==="admin"&&p[1]==="users"&&p.length===2&&m==="GET"){if(user.role!=="owner")return fail("শুধু Owner account management করতে পারবেন।",403);const r=await env.DB.prepare("SELECT id,email,username,role,email_verified,created_at FROM users ORDER BY created_at").all();return json(r.results||[])}
 if(p[0]==="admin"&&p[1]==="users"&&p.length===2&&m==="POST"){return fail("প্রথমে ব্যবহারকারীকে ওয়েবসাইটে নিবন্ধন ও ইমেইল যাচাই করতে হবে; তারপর Owner তাকে Admin করতে পারবেন।",405)}
 if(p[0]==="admin"&&p[1]==="users"&&p.length===3&&m==="PATCH"){if(user.role!=="owner")return fail("শুধু Owner Role পরিবর্তন করতে পারবেন।",403);const d=await readBody(req);if(!["user","admin"].includes(d?.role))return fail("অনুমোদিত role দিন।");if(p[2]===user.id)return fail("Owner নিজের role পরিবর্তন করতে পারবেন না।",400);const target=await env.DB.prepare("SELECT id,role,email_verified FROM users WHERE id=?").bind(p[2]).first();if(!target)return fail("ব্যবহারকারী পাওয়া যায়নি।",404);if(target.role==="owner")return fail("Owner role পরিবর্তন করা যাবে না।",403);if(target.email_verified!==1)return fail("ইমেইল যাচাই না হওয়া পর্যন্ত role পরিবর্তন করা যাবে না।",403);if(d.role==="user"){await env.DB.batch([env.DB.prepare("UPDATE users SET role='user' WHERE id=?").bind(p[2]),env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(p[2])]);}else{await env.DB.prepare("UPDATE users SET role='admin' WHERE id=?").bind(p[2]).run()}return json({ok:true})}
 if(p[0]==="admin"&&p[1]==="users"&&p.length===3&&m==="DELETE"){if(user.role!=="owner")return fail("শুধু Owner Admin সরাতে পারবেন।",403);if(p[2]===user.id)return fail("নিজের Owner account নিজে মুছতে পারবেন না।",400);const target=await env.DB.prepare("SELECT role FROM users WHERE id=?").bind(p[2]).first();if(!target||target.role==="owner")return fail("Owner account সরানো যাবে না।",403);await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(p[2]).run();const r=await env.DB.prepare("UPDATE users SET role='user' WHERE id=?").bind(p[2]).run();return r.meta.changes?json({ok:true}):fail("Admin পাওয়া যায়নি。",404)}
 return fail("API route not found.",404)
}
export async function onRequest({request,env}){try{return await handle(request,env)}catch(e){console.error("FRAME API error",e);return fail("Server error. Check D1 migration and bindings.",500)}}