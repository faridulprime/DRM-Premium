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
async function makePasswordForRegistrationCheck(password,stored){const salt=String(stored||"").split(".")[0];if(!salt)return "";return salt+"."+await passwordHash(password,salt)}
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
async function sendVerificationEmail(env,{to,code,type="user-registration",expiresInMinutes=10,expiresAt,reason}){
 const response=await fetch(env.GOOGLE_APPS_SCRIPT_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:env.GOOGLE_APPS_SCRIPT_TOKEN,type,to,code,expiresInMinutes,expiresAt,reason})});
 let result={};try{result=await response.json()}catch{}
 if(!response.ok||result.ok!==true)throw new Error("Google Apps Script mailer failed with status "+response.status);
 return {provider:"google-apps-script"};
}
async function handle(req,env){
 if(!env.DB)return fail("D1 database binding DB is not configured. Follow the setup guide.",503);
 const u=new URL(req.url),p=u.pathname.replace(/^\/api\/?/,"").split("/").filter(Boolean),m=req.method;
 if(m!=="GET"){if(!originOK(req))return fail("Cross-origin request blocked.",403);if(!(req.headers.get("content-type")||"").toLowerCase().includes("application/json"))return fail("JSON content type required.",415)}
 if(p[0]==="presence"&&m==="POST"){
  const now=Math.floor(Date.now()/1000),visitor=await getSession(req,env);
  if(visitor){const hourStart=Math.floor(now/3600)*3600;await env.DB.prepare("INSERT INTO user_activity_hours(user_id,hour_start,last_seen) VALUES(?,?,?) ON CONFLICT(user_id,hour_start) DO UPDATE SET last_seen=excluded.last_seen").bind(visitor.id,hourStart,now).run();await env.DB.prepare("DELETE FROM user_activity_hours WHERE hour_start<?").bind(now-7776000).run();const key="u:"+visitor.id;await env.DB.prepare("INSERT INTO visitor_presence(presence_key,user_id,guest_label,last_seen) VALUES(?,?,NULL,?) ON CONFLICT(presence_key) DO UPDATE SET user_id=excluded.user_id,guest_label=NULL,last_seen=excluded.last_seen").bind(key,visitor.id,now).run();await env.DB.prepare("DELETE FROM visitor_presence WHERE last_seen<?").bind(now-120).run();return json({ok:true});}
  let token=visitorToken(req),isNew=!/^[A-Za-z0-9_-]{30,80}$/.test(token);if(isNew)token=b64(crypto.getRandomValues(new Uint8Array(32)));
  const visitorHash=await hash(token),key="g:"+visitorHash,label="Guest "+visitorHash.slice(0,5).toUpperCase();
  await env.DB.prepare("INSERT INTO visitor_presence(presence_key,user_id,guest_label,last_seen) VALUES(?,NULL,?,?) ON CONFLICT(presence_key) DO UPDATE SET last_seen=excluded.last_seen").bind(key,label,now).run();await env.DB.prepare("DELETE FROM visitor_presence WHERE last_seen<?").bind(now-120).run();
  return json({ok:true},200,isNew?{"set-cookie":VISITOR_COOKIE+"="+token+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000"}:{});
 }
 if(p[0]==="auth"&&p[1]==="register-otp"&&m==="POST"){
  if(!env.SESSION_SECRET||!env.OWNER_EMAIL||(!env.GOOGLE_APPS_SCRIPT_URL||!env.GOOGLE_APPS_SCRIPT_TOKEN))return fail("Account registration email service is not configured. Configure the Google Apps Script mailer.",503);
  const d=await readBody(req),email=String(d?.email||"").trim().toLowerCase(),username=String(d?.username||"").trim(),password=d?.password;
  if(!emailOK(email)||!/^[a-zA-Z0-9_]{3,30}$/.test(username)||!passwordOK(password))return fail("সঠিক ইমেইল, ৩–৩০ অক্ষরের username এবং অন্তত ৮ অক্ষরের password দিন।",400);
  if(email===String(env.OWNER_EMAIL).trim().toLowerCase())return fail("এই ইমেইলটি সংরক্ষিত Owner অ্যাকাউন্টের জন্য নির্ধারিত।",409);
  const existing=await env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE OR username=? COLLATE NOCASE").bind(email,username).first();
  if(existing)return fail("এই ইমেইল অথবা Username দিয়ে ইতিমধ্যে অ্যাকাউন্ট রয়েছে।",409);
  const now=Math.floor(Date.now()/1000),ip=req.headers.get("CF-Connecting-IP")||"unknown",ipHash=await hash(ip+env.SESSION_SECRET);
  await env.DB.prepare("DELETE FROM user_registration_otps WHERE created_at<?").bind(now-900).run();
  const recent=await env.DB.prepare("SELECT created_at FROM user_registration_otps WHERE email=?").bind(email).first();
  if(recent&&now-Number(recent.created_at)<60)return fail("নতুন কোড পাঠানোর আগে ১ মিনিট অপেক্ষা করুন।",429);
  const tries=await env.DB.prepare("SELECT COUNT(*) AS n FROM user_registration_otps WHERE ip_hash=? AND created_at>?").bind(ipHash,now-900).first();
  if(Number(tries?.n||0)>=5)return fail("এই নেটওয়ার্ক থেকে অনেকবার কোড চাওয়া হয়েছে। ১৫ মিনিট পরে চেষ্টা করুন।",429);
  const random=new Uint32Array(1);crypto.getRandomValues(random);const code=String(100000+(random[0]%900000));
  const codeHash=await hash(email+":"+code+":"+env.SESSION_SECRET),passwordHashValue=await makePassword(password);
  await env.DB.prepare("INSERT INTO user_registration_otps(email,username,password_hash,code_hash,ip_hash,expires_at,attempts,created_at) VALUES(?,?,?,?,?,?,0,?) ON CONFLICT(email) DO UPDATE SET username=excluded.username,password_hash=excluded.password_hash,code_hash=excluded.code_hash,ip_hash=excluded.ip_hash,expires_at=excluded.expires_at,attempts=0,created_at=excluded.created_at").bind(email,username,passwordHashValue,codeHash,ipHash,now+600,now).run();
  try{await sendVerificationEmail(env,{to:email,code,type:"user-registration",expiresInMinutes:10});}catch(e){await env.DB.prepare("DELETE FROM user_registration_otps WHERE email=?").bind(email).run();console.error("Registration email failed",String(e?.message||e));return fail("Verification email পাঠানো যায়নি। Email service configuration পরীক্ষা করুন।",502)}
  return json({ok:true,message:"ইমেইলে ৬ সংখ্যার verification code পাঠানো হয়েছে। ১০ মিনিটের মধ্যে কোডটি দিন।"});
 }
 if(p[0]==="auth"&&p[1]==="register-verify"&&m==="POST"){
  if(!env.SESSION_SECRET)return fail("Session service is not configured.",503);
  const d=await readBody(req),email=String(d?.email||"").trim().toLowerCase(),username=String(d?.username||"").trim(),password=d?.password,code=String(d?.code||"").trim();
  if(!emailOK(email)||!/^[a-zA-Z0-9_]{3,30}$/.test(username)||!passwordOK(password)||!/^[0-9]{6}$/.test(code))return fail("ইমেইল, username, password অথবা verification code সঠিক নয়।",400);
  const now=Math.floor(Date.now()/1000),pending=await env.DB.prepare("SELECT * FROM user_registration_otps WHERE email=?").bind(email).first();
  if(!pending||Number(pending.expires_at)<now)return fail("কোডের মেয়াদ শেষ হয়েছে। নতুন কোড নিন।",403);
  if(Number(pending.attempts)>=5)return fail("ভুল কোড দেওয়ার সর্বোচ্চ চেষ্টা শেষ। নতুন কোড নিন।",403);
  if(pending.username!==username||pending.password_hash!==await makePasswordForRegistrationCheck(password,pending.password_hash))return fail("Registration তথ্য পরিবর্তিত হয়েছে। নতুন verification code নিন।",400);
  const expected=await hash(email+":"+code+":"+env.SESSION_SECRET);
  if(expected!==pending.code_hash){await env.DB.prepare("UPDATE user_registration_otps SET attempts=attempts+1 WHERE email=?").bind(email).run();return fail("Verification code সঠিক নয়।",403)}
  const duplicate=await env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE OR username=? COLLATE NOCASE").bind(email,username).first();
  if(duplicate){await env.DB.prepare("DELETE FROM user_registration_otps WHERE email=?").bind(email).run();return fail("এই ইমেইল অথবা Username ইতিমধ্যে ব্যবহৃত হয়েছে।",409)}
  const id=crypto.randomUUID();
  try{await env.DB.prepare("INSERT INTO users(id,email,username,password_hash,role,email_verified,created_at) VALUES(?,?,?,?,'user',1,?)").bind(id,email,username.toLowerCase(),pending.password_hash,now).run();}
  catch(e){console.error("Public user registration failed",e);return fail("অ্যাকাউন্ট তৈরি করা যায়নি। ইমেইল বা Username আগে থেকেই ব্যবহৃত হতে পারে।",409)}
  await env.DB.prepare("DELETE FROM user_registration_otps WHERE email=?").bind(email).run();
  const token=await newSession(id,env);return json({ok:true,user:{id,email,username,role:"user"},message:"অ্যাকাউন্ট তৈরি হয়েছে।"},201,{"set-cookie":cookie(token)});
 }
 if(p[0]==="auth"&&p[1]==="status"&&m==="GET")return json({configured:await adminsExist(env.DB)});
 if(p[0]==="auth"&&p[1]==="owner-otp"&&m==="POST"){
  if(await adminsExist(env.DB))return fail("Initial setup is already complete.",409);
  if(!env.OWNER_EMAIL||!env.SESSION_SECRET||(!env.GOOGLE_APPS_SCRIPT_URL||!env.GOOGLE_APPS_SCRIPT_TOKEN))return fail("Owner email verification is not configured. Set OWNER_EMAIL, SESSION_SECRET and the Google Apps Script mailer.",503);
  const d=await readBody(req),email=String(d?.email||"").trim().toLowerCase();
  if(!emailOK(email)||email!==env.OWNER_EMAIL.toLowerCase())return fail("ইমেইলটি Owner-এর নির্ধারিত ইমেইলের সঙ্গে মিলছে না।",403);
  const now=Math.floor(Date.now()/1000),recent=await env.DB.prepare("SELECT created_at FROM owner_setup_otps ORDER BY created_at DESC LIMIT 1").first();
  if(recent&&now-Number(recent.created_at)<60)return fail("নতুন কোড পাঠানোর আগে ১ মিনিট অপেক্ষা করুন।",429);
  const random=new Uint32Array(1);crypto.getRandomValues(random);const code=String(100000+(random[0]%900000));
  const codeHash=await hash(email+":"+code+":"+env.SESSION_SECRET);
  await env.DB.prepare("DELETE FROM owner_setup_otps").run();
  await env.DB.prepare("INSERT INTO owner_setup_otps(email,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,0,?)").bind(email,codeHash,now+600,now).run();
   try{await sendVerificationEmail(env,{to:email,code,type:"owner-verification",expiresInMinutes:10});}catch(e){await env.DB.prepare("DELETE FROM owner_setup_otps").run();console.error("Owner OTP email failed",String(e?.message||e));return fail("Verification email পাঠানো যায়নি। Email service configuration পরীক্ষা করুন।",502)}
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
  const restriction=await env.DB.prepare("SELECT restriction_type,expires_at,reason FROM user_restrictions WHERE user_id=? AND (expires_at IS NULL OR expires_at>?)").bind(user.id,now).first();
  if(restriction){const until=restriction.expires_at?new Date(Number(restriction.expires_at)*1000).toISOString():"";return fail(restriction.restriction_type==="ban"?"এই অ্যাকাউন্ট স্থায়ীভাবে নিষিদ্ধ করা হয়েছে।":("এই অ্যাকাউন্ট সাময়িকভাবে স্থগিত। পুনরায় চেষ্টা করুন: "+until),403)}
  await env.DB.prepare("DELETE FROM login_attempts WHERE ip_hash=?").bind(ipHash).run();await env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(now).run();
  const token=await newSession(user.id,env);return json({ok:true},200,{"set-cookie":cookie(token)});
 }
 if(p[0]==="auth"&&p[1]==="access-state"&&m==="GET"){const u=await getSession(req,env);if(!u)return json({authenticated:false,restricted:false});const now=Math.floor(Date.now()/1000),r=await env.DB.prepare("SELECT restriction_type,expires_at,reason,created_at FROM user_restrictions WHERE user_id=? AND (expires_at IS NULL OR expires_at>?)").bind(u.id,now).first();return json({authenticated:true,restricted:!!r,user:u,restriction:r?{type:r.restriction_type,expiresAt:r.expires_at,reason:r.reason,createdAt:r.created_at}:null})}
 if(p[0]==="auth"&&p[1]==="me"&&m==="GET"){const u=await getSession(req,env);return json(u?{authenticated:true,user:u}:{authenticated:false})}
 if(p[0]==="auth"&&p[1]==="logout"&&m==="POST"){const t=cookieToken(req);if(t)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hash(t)).run();return json({ok:true},200,{"set-cookie":clearCookie()})}
 const sessionUser=await getSession(req,env);if(sessionUser){const now=Math.floor(Date.now()/1000),restriction=await env.DB.prepare("SELECT restriction_type,expires_at,reason,created_at FROM user_restrictions WHERE user_id=? AND (expires_at IS NULL OR expires_at>?)").bind(sessionUser.id,now).first();if(restriction&&!(p[0]==="auth"&&p[1]==="access-state"))return json({error:"Account access is restricted.",restricted:true,restriction:{type:restriction.restriction_type,expiresAt:restriction.expires_at,reason:restriction.reason,createdAt:restriction.created_at}},423)}

 if(p[0]==="videos"&&m==="GET"){const r=await env.DB.prepare("SELECT id,title,category,youtube_id,thumbnail_url,description,featured,published,created_at FROM videos WHERE published=1 ORDER BY featured DESC,sort_order ASC,created_at DESC").all();return json(r.results||[])}
 if(p[0]==="categories"&&m==="GET"){const r=await env.DB.prepare("SELECT id,name,sort_order FROM categories ORDER BY sort_order,name").all();return json(r.results||[])}
 if(p[0]==="settings"&&m==="GET")return json(await settings(env.DB));
 if(p[0]==="analytics"&&p[1]==="event"&&p.length===2&&m==="POST"){const d=await readBody(req),allowed=new Set(["home","browse","references","articles","books","admin","overview","videos","categories","site","admins"]);if(!allowed.has(d?.tab))return fail("Invalid analytics tab.",400);await env.DB.prepare("INSERT INTO analytics_events(tab,created_at) VALUES(?,?)").bind(d.tab,Math.floor(Date.now()/1000)).run();return json({ok:true},201)}
 if(p[0]==="profile"){
  const session=await getSession(req,env);if(!session)return fail("Login required.",401);
  if(p.length===1&&m==="GET"){
   const profile=await env.DB.prepare("SELECT full_name,bio,date_of_birth,gender,location,avatar_key,created_at,updated_at FROM user_profiles WHERE user_id=?").bind(session.id).first();
   return json({profile:profile?{...profile,avatar_url:profile.avatar_key?"/api/profile/avatar?v="+profile.updated_at:null}:{full_name:"",bio:"",date_of_birth:"",gender:"",location:"",avatar_url:null}});
  }
  if(p.length===2&&p[1]==="avatar"&&m==="GET"){
   if(!env.PROFILE_ASSETS)return fail("Profile image storage is not configured.",503);
   const profile=await env.DB.prepare("SELECT avatar_key FROM user_profiles WHERE user_id=?").bind(session.id).first();
   if(!profile?.avatar_key)return fail("Profile image not found.",404);
   const object=await env.PROFILE_ASSETS.getWithMetadata(profile.avatar_key,"text");if(!object?.value)return fail("Profile image not found.",404);
   let binary;try{binary=atob(object.value)}catch{return fail("Stored profile image is invalid.",500)}
   const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
   return new Response(bytes,{headers:{"content-type":object.metadata?.contentType||"image/webp","cache-control":"private, max-age=300","x-content-type-options":"nosniff"}});
  }
  if(p.length===1&&m==="PUT"){
   const length=Number(req.headers.get("content-length")||0);if(length>2900000)return fail("Profile payload is too large.",413);
   let d;try{const raw=await req.text();if(new TextEncoder().encode(raw).length>2900000)return fail("Profile payload is too large.",413);d=JSON.parse(raw)}catch{return fail("Invalid profile data.",400)}
   const fullName=String(d?.full_name||"").trim(),bio=String(d?.bio||"").trim(),dob=String(d?.date_of_birth||""),gender=String(d?.gender||""),location=String(d?.location||"").trim();
   if(!fullName||fullName.length>100)return fail("Full name ১–১০০ অক্ষরের মধ্যে দিন।",400);
   if(bio.length>500||location.length>120)return fail("Bio অথবা Location নির্ধারিত সীমা অতিক্রম করেছে।",400);
   if(dob&&!/^\d{4}-\d{2}-\d{2}$/.test(dob))return fail("Date of birth সঠিক নয়।",400);
   if(gender&&!["female","male","non_binary","prefer_not_to_say"].includes(gender))return fail("Gender option সঠিক নয়।",400);
   const now=Math.floor(Date.now()/1000),existing=await env.DB.prepare("SELECT avatar_key,created_at FROM user_profiles WHERE user_id=?").bind(session.id).first();
   let avatarKey=existing?.avatar_key||null;
   if((d?.remove_avatar===true||d?.avatar_data_url)&&!env.PROFILE_ASSETS)return fail("Profile image storage is not configured. Configure the PROFILE_ASSETS R2 binding.",503);
   if(d?.remove_avatar===true)avatarKey=null;
   if(d?.avatar_data_url){
    const match=String(d.avatar_data_url).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    if(!match)return fail("Profile picture হিসেবে JPEG, PNG অথবা WebP ফাইল দিন।",400);
    let binary;try{binary=atob(match[2])}catch{return fail("Profile picture data invalid.",400)}
    if(binary.length>2*1024*1024)return fail("Profile picture সর্বোচ্চ 2 MB হতে পারবে।",413);
    if(binary.length===0)return fail("Profile picture খালি।",400);
    const key="profiles/"+session.id+"/avatar";
    await env.PROFILE_ASSETS.put(key,match[2],{metadata:{contentType:match[1]}});
    avatarKey=key;
   }
   await env.DB.prepare("INSERT INTO user_profiles(user_id,full_name,bio,date_of_birth,gender,location,avatar_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,bio=excluded.bio,date_of_birth=excluded.date_of_birth,gender=excluded.gender,location=excluded.location,avatar_key=excluded.avatar_key,updated_at=excluded.updated_at").bind(session.id,fullName,bio,dob,gender,location,avatarKey,existing?.created_at||now,now).run();
   if(existing?.avatar_key&&avatarKey!==existing.avatar_key)await env.PROFILE_ASSETS.delete(existing.avatar_key).catch(()=>{});
   return json({ok:true,profile:{full_name:fullName,bio,date_of_birth:dob,gender,location,avatar_url:avatarKey?"/api/profile/avatar?v="+now:null}});
  }
  return fail("Profile route not found.",404);
 }
 const user=await getSession(req,env);if(!user||!["owner","admin"].includes(user.role))return fail("Admin login required.",401);

 // DUGA foundation health probe: authenticated Owner only; read-only and table-independent.
 if(p[0]==="governance"){
  if(user.role!=="owner")return fail("শুধু Owner Governance API ব্যবহার করতে পারবেন।",403);
  if(p.length===2&&p[1]==="health"){
   if(m!=="GET")return fail("Method not allowed.",405);
   const expected={
    duga_assignments:{columns:["id","scope_type","scope_id","role_id","subject_type","user_id","principal_id","status","assigned_by_user_id","created_at","revoked_at"],indexes:["uq_duga_assignment_human_active","uq_duga_assignment_ai_active","idx_duga_assignments_subject"],triggers:[]},
    duga_change_requests:{columns:["id","title","summary","rationale","status","risk_level","affected_systems_json","affected_paths_json","rollback_plan","requested_by_type","requested_by_user_id","requested_by_principal_id","source_branch","base_commit_sha","policy_commit_sha","implementer_type","implementer_user_id","implementer_principal_id","implementation_commit_sha","state_version","created_at","updated_at"],indexes:["idx_duga_changes_status_updated","idx_duga_changes_created"],triggers:[]},
    duga_reviews:{columns:["id","change_request_id","review_type","reviewer_type","reviewer_user_id","reviewer_principal_id","decision","reviewed_commit_sha","evidence_json","created_at"],indexes:["idx_duga_reviews_change_time"],triggers:["duga_review_no_implementer_self_audit"]},
    duga_approvals:{columns:["id","change_request_id","approver_user_id","approver_role","decision","approved_commit_sha","rationale","created_at"],indexes:["idx_duga_approvals_change_time"],triggers:[]},
    duga_validation_runs:{columns:["id","change_request_id","commit_sha","status","validator","validator_version","results_json","started_at","completed_at","created_at"],indexes:["idx_duga_validation_change_time","idx_duga_validation_status"],triggers:[]},
    duga_audit_events:{columns:["id","aggregate_type","aggregate_id","event_type","actor_type","actor_user_id","actor_principal_id","actor_system_id","payload_json","policy_commit_sha","created_at"],indexes:["idx_duga_audit_aggregate_time","idx_duga_audit_actor_time","idx_duga_audit_time"],triggers:["duga_audit_no_update","duga_audit_no_delete"]},
    duga_analysis_findings:{columns:["id","analyzer_version","repository_commit_sha","file_path","symbol","classification","confidence","evidence_json","status","created_at","reviewed_at","reviewed_by_user_id"],indexes:["idx_duga_findings_status_time","idx_duga_findings_file_commit"],triggers:[]},
    duga_jobs:{columns:["id","job_type","status","input_json","result_json","attempts","available_at","lease_expires_at","created_at","updated_at"],indexes:["idx_duga_jobs_queue"],triggers:[]}
   };
   let probe,objects;try{
    probe=await env.DB.prepare("SELECT 1 AS ok").first();
    if(Number(probe?.ok)!==1)return fail("Governance database probe failed.",503);
    objects=await env.DB.prepare("SELECT type,name,tbl_name FROM sqlite_master WHERE name LIKE 'duga_%' OR name LIKE 'idx_duga_%' OR name LIKE 'uq_duga_%'").all();
   }catch{return fail("Governance database/schema probe failed.",503)}
   const rows=objects.results||[],tableNames=new Set(rows.filter(x=>x.type==="table").map(x=>x.name));
   const schemaTables=Object.keys(expected).filter(name=>tableNames.has(name));
   const missing={tables:[],columns:[],indexes:[],triggers:[]};
   for(const [table,spec] of Object.entries(expected)){
    if(!tableNames.has(table)){missing.tables.push(table);continue}
    let info;try{info=await env.DB.prepare("PRAGMA table_info("+table+")").all()}catch{return fail("Governance schema inspection failed.",503)}
    const cols=new Set((info.results||[]).map(x=>x.name));
    for(const col of spec.columns)if(!cols.has(col))missing.columns.push(table+"."+col);
    const tableObjects=new Set(rows.filter(x=>x.tbl_name===table).map(x=>x.name));
    for(const name of spec.indexes)if(!tableObjects.has(name))missing.indexes.push(name);
    for(const name of spec.triggers)if(!rows.some(x=>x.type==="trigger"&&x.name===name))missing.triggers.push(name);
   }
   const expectedCount=Object.keys(expected).length;
   const complete=missing.tables.length===0&&missing.columns.length===0&&missing.indexes.length===0&&missing.triggers.length===0;
   const absent=schemaTables.length===0;
   const schemaStatus=complete?"ready":absent?"not_installed":"partial";
   return json({ok:true,service:"DUGA",database:"reachable",schema:schemaStatus,schemaTables,expectedSchemaTables:expectedCount,missing,access:"owner"});
  }
  return fail("Governance route not found.",404);
 }

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
 if(p[0]==="admin"&&p[1]==="users"&&p.length===4&&p[3]==="avatar"&&m==="GET"){
  if(!env.PROFILE_ASSETS)return fail("Profile image storage is not configured.",503);
  const target=await env.DB.prepare("SELECT up.avatar_key FROM users u LEFT JOIN user_profiles up ON up.user_id=u.id WHERE u.id=?").bind(p[2]).first();
  if(!target?.avatar_key)return fail("Profile image not found.",404);
  const object=await env.PROFILE_ASSETS.getWithMetadata(target.avatar_key,"text");if(!object?.value)return fail("Profile image not found.",404);
  let binary;try{binary=atob(object.value)}catch{return fail("Stored profile image is invalid.",500)}
  const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
  return new Response(bytes,{headers:{"content-type":object.metadata?.contentType||"image/webp","cache-control":"private, max-age=300","x-content-type-options":"nosniff"}});
 }
 if(p[0]==="admin"&&p[1]==="active-users"&&m==="GET"){
  if(user.role!=="owner")return fail("শুধু Owner সক্রিয় ব্যবহারকারীদের তালিকা দেখতে পারবেন।",403);
  const now=Math.floor(Date.now()/1000);await env.DB.prepare("DELETE FROM visitor_presence WHERE last_seen<?").bind(now-120).run();
  const rows=await env.DB.prepare("SELECT u.id,u.username,u.email,u.role,up.full_name,up.avatar_key,up.updated_at AS profile_updated_at,p.guest_label,p.last_seen FROM visitor_presence p LEFT JOIN users u ON u.id=p.user_id LEFT JOIN user_profiles up ON up.user_id=u.id WHERE p.last_seen>=? ORDER BY CASE WHEN u.role IN ('owner','admin') THEN 0 WHEN u.id IS NOT NULL THEN 1 ELSE 2 END,p.last_seen DESC").bind(now-90).all();
  const result={admins:[],members:[],guests:[]};for(const row of rows.results||[]){const displayName=String(row.full_name||"").trim()||row.username||row.email,avatar_url=row.avatar_key?"/api/admin/users/"+encodeURIComponent(row.id)+"/avatar?v="+Number(row.profile_updated_at||0):null;if(row.role==="owner"||row.role==="admin")result.admins.push({id:row.id,name:displayName,email:row.email,role:row.role,avatar_url,last_seen:Number(row.last_seen)});else if(row.id)result.members.push({id:row.id,name:displayName,email:row.email,role:"user",avatar_url,last_seen:Number(row.last_seen)});else result.guests.push({name:row.guest_label||"Guest",role:"guest",last_seen:Number(row.last_seen)});}
  return json({updated_at:now,active_window_seconds:90,total:result.admins.length+result.members.length+result.guests.length,...result});
 }
 if(p[0]==="admin"&&p[1]==="presence"&&m==="POST"){const now=Math.floor(Date.now()/1000);await env.DB.prepare("INSERT INTO admin_presence(user_id,last_seen) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen=excluded.last_seen").bind(user.id,now).run();await env.DB.prepare("DELETE FROM admin_presence WHERE last_seen<?").bind(now-120).run();return json({ok:true})}
 if(p[0]==="admin"&&p[1]==="analytics"&&m==="GET"){const now=Math.floor(Date.now()/1000);await env.DB.prepare("DELETE FROM admin_presence WHERE last_seen<?").bind(now-120).run();const [online,admins,posts,tabs]=await Promise.all([env.DB.prepare("SELECT COUNT(*) AS n FROM admin_presence p JOIN users u ON u.id=p.user_id WHERE u.role IN ('owner','admin') AND p.last_seen>=?").bind(now-90).first(),env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role IN ('owner','admin')").first(),env.DB.prepare("SELECT u.id,u.email,u.role,u.created_at,COUNT(v.id) AS post_count FROM users u LEFT JOIN videos v ON v.owner_id=u.id WHERE u.role IN ('owner','admin') GROUP BY u.id ORDER BY post_count DESC,u.created_at ASC").all(),env.DB.prepare("SELECT tab,COUNT(*) AS view_count FROM analytics_events GROUP BY tab ORDER BY view_count DESC").all()]);const labels={home:"মূল পৃষ্ঠা",browse:"ভিডিও",references:"রেফারেন্স",articles:"আর্টিকেল",books:"বইপত্র",admin:"এডমিন",overview:"Overview",videos:"Admin Videos",categories:"Categories",site:"Website Settings",admins:"Users & Admins"};const tabRows=(tabs.results||[]).map(x=>({label:labels[x.tab]||x.tab,view_count:Number(x.view_count)}));return json({online_count:Number(online.n),admin_count:Number(admins.n),total_posts:(posts.results||[]).reduce((n,x)=>n+Number(x.post_count),0),total_tab_views:tabRows.reduce((n,x)=>n+x.view_count,0),admins:(posts.results||[]).map(x=>({email:x.email,role:x.role,created_at:x.created_at,post_count:Number(x.post_count)})),tabs:tabRows})}

 if(p[0]==="admin"&&p[1]==="videos"&&p.length===2&&m==="GET"){const r=await env.DB.prepare("SELECT * FROM videos WHERE (?='owner' OR owner_id=?) ORDER BY created_at DESC").bind(user.role,user.id).all();return json(r.results||[])}
 if(p[0]==="admin"&&p[1]==="videos"&&p.length===2&&m==="POST"){const d=await readBody(req),id=yt(d?.youtube_id);if(!textOK(d?.title,120)||!textOK(d?.category,50)||!id)return fail("Title, category ও সঠিক YouTube ID প্রয়োজন।");const cat=await env.DB.prepare("SELECT id FROM categories WHERE name=? AND (?='owner' OR owner_id=?)").bind(d.category.trim(),user.role,user.id).first();if(!cat)return fail("এই ক্যাটাগরি আপনার নিয়ন্ত্রণে নেই। নিজের ক্যাটাগরি তৈরি করুন।",403);const vid=crypto.randomUUID(),now=Date.now();await env.DB.prepare("INSERT INTO videos(id,title,category,youtube_id,thumbnail_url,description,featured,published,owner_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(vid,d.title.trim(),d.category.trim(),id,String(d.thumbnail_url||"").slice(0,1000),String(d.description||"").slice(0,1000),d.featured?1:0,d.published===false?0:1,user.id,now,now).run();return json({ok:true,id:vid},201)}
 if(p[0]==="admin"&&p[1]==="videos"&&p.length===3&&m==="PUT"){const d=await readBody(req),id=yt(d?.youtube_id);if(!textOK(d?.title,120)||!textOK(d?.category,50)||!id)return fail("Title, category ও সঠিক YouTube ID প্রয়োজন।");const cat=await env.DB.prepare("SELECT id FROM categories WHERE name=? AND (?='owner' OR owner_id=?)").bind(d.category.trim(),user.role,user.id).first();if(!cat)return fail("এই ক্যাটাগরি আপনার নিয়ন্ত্রণে নেই।",403);const r=await env.DB.prepare("UPDATE videos SET title=?,category=?,youtube_id=?,thumbnail_url=?,description=?,featured=?,published=?,updated_at=? WHERE id=? AND (?='owner' OR owner_id=?)").bind(d.title.trim(),d.category.trim(),id,String(d.thumbnail_url||"").slice(0,1000),String(d.description||"").slice(0,1000),d.featured?1:0,d.published===false?0:1,Date.now(),p[2],user.role,user.id).run();return r.meta.changes?json({ok:true}):fail("ভিডিও পাওয়া যায়নি।",404)}
 if(p[0]==="admin"&&p[1]==="videos"&&p.length===3&&m==="DELETE"){const r=await env.DB.prepare("DELETE FROM videos WHERE id=? AND (?='owner' OR owner_id=?)").bind(p[2],user.role,user.id).run();return r.meta.changes?json({ok:true}):fail("ভিডিও পাওয়া যায়নি অথবা এটি আপনার নয়।",404)}
 if(p[0]==="admin"&&p[1]==="categories"&&p.length===2&&m==="GET"){const r=await env.DB.prepare("SELECT id,name,sort_order FROM categories WHERE (?='owner' OR owner_id=?) ORDER BY sort_order,name").bind(user.role,user.id).all();return json(r.results||[])}
 if(p[0]==="admin"&&p[1]==="categories"&&p.length===2&&m==="POST"){const d=await readBody(req);if(!textOK(d?.name,50))return fail("ক্যাটাগরির নাম প্রয়োজন।");const id=crypto.randomUUID();try{await env.DB.prepare("INSERT INTO categories(id,name,owner_id,sort_order) VALUES(?,?,?,?)").bind(id,d.name.trim(),user.id,Date.now()).run()}catch{return fail("এই ক্যাটাগরি আগে থেকেই আছে।",409)}return json({ok:true,id},201)}
 if(p[0]==="admin"&&p[1]==="categories"&&p.length===3&&m==="PUT"){const d=await readBody(req);if(!textOK(d?.name,50))return fail("ক্যাটাগরির নাম প্রয়োজন।");const old=await env.DB.prepare("SELECT name FROM categories WHERE id=? AND (?='owner' OR owner_id=?)").bind(p[2],user.role,user.id).first();if(!old)return fail("ক্যাটাগরি পাওয়া যায়নি অথবা এটি আপনার নয়।",404);try{await env.DB.batch([env.DB.prepare("UPDATE categories SET name=? WHERE id=?").bind(d.name.trim(),p[2]),env.DB.prepare("UPDATE videos SET category=? WHERE category=? AND (?='owner' OR owner_id=?)").bind(d.name.trim(),old.name,user.role,user.id)]);}catch{return fail("এই নামে অন্য ক্যাটাগরি আছে।",409)}return json({ok:true})}
 if(p[0]==="admin"&&p[1]==="categories"&&p.length===3&&m==="DELETE"){const n=await env.DB.prepare("SELECT COUNT(*) AS n FROM videos WHERE category=(SELECT name FROM categories WHERE id=? AND (?='owner' OR owner_id=?)) AND (?='owner' OR owner_id=?)").bind(p[2],user.role,user.id,user.role,user.id).first();if(Number(n.n)>0)return fail("এই ক্যাটাগরিতে ভিডিও আছে। আগে ভিডিওগুলো অন্য ক্যাটাগরিতে সরান।",409);const r=await env.DB.prepare("DELETE FROM categories WHERE id=? AND (?='owner' OR owner_id=?)").bind(p[2],user.role,user.id).run();return r.meta.changes?json({ok:true}):fail("ক্যাটাগরি পাওয়া যায়নি অথবা এটি আপনার নয়।",404)}
 if(p[0]==="admin"&&p[1]==="settings"&&m==="PUT"){if(user.role!=="owner")return fail("শুধু Owner ওয়েবসাইটের সেটিংস পরিবর্তন করতে পারবেন।",403);const d=await readBody(req),keys=["site_name","hero_eyebrow","hero_title","hero_description","library_eyebrow","library_title","footer_text","hero_image","accent_color","show_hero","show_library","visual_editor_config"],stmts=[];for(const k of keys){const maxLength=k==="visual_editor_config"?25000:1000;if(typeof d?.[k]!=="string"||d[k].length>maxLength)continue;if(k==="hero_image"&&d[k]&&!/^https:\/\//i.test(d[k]))return fail("Hero image অবশ্যই HTTPS URL হতে হবে।");if(k==="accent_color"&&!/^#[0-9a-f]{6}$/i.test(d[k]))return fail("Accent color সঠিক নয়।");if(k==="visual_editor_config"){if(d[k].length>25000)return fail("Visual editor configuration is too large.");let cfg;try{cfg=JSON.parse(d[k]);}catch{return fail("Visual editor data is invalid.");}if(!cfg||typeof cfg!=="object"||Array.isArray(cfg)||Object.keys(cfg).length>100)return fail("Visual editor data is invalid.");for(const item of Object.values(cfg)){const s=item?.style,sh=s?.shadow;if(typeof item?.selector!=="string"||item.selector.length>500||typeof item.text!=="string"||item.text.length>2000||!s||!Number.isFinite(s.fontSize)||s.fontSize<8||s.fontSize>96||!/^#[0-9a-f]{6}$/i.test(s.color||"")||!/^#[0-9a-f]{6}$/i.test(s.background||"")||!sh||!/^#[0-9a-f]{6}$/i.test(sh.color||"")||![sh.x,sh.y,sh.blur].every(Number.isFinite)||Math.abs(sh.x)>20||Math.abs(sh.y)>20||sh.blur<0||sh.blur>30)return fail("Visual editor style values are invalid.");}}stmts.push(env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(k,d[k]))}if(stmts.length)await env.DB.batch(stmts);return json({ok:true})}
 if(p[0]==="admin"&&p[1]==="users"&&p.length===2&&m==="GET"){if(user.role!=="owner")return fail("শুধু Owner account management করতে পারবেন।",403);const r=await env.DB.prepare("SELECT u.id,u.email,u.username,u.role,u.email_verified,u.created_at,up.full_name AS name,up.avatar_key,up.updated_at AS profile_updated_at,r.restriction_type,r.expires_at AS restriction_expires_at,r.reason AS restriction_reason FROM users u LEFT JOIN user_profiles up ON up.user_id=u.id LEFT JOIN user_restrictions r ON r.user_id=u.id ORDER BY u.created_at").all();return json((r.results||[]).map(row=>{const {avatar_key,profile_updated_at,...safe}=row;return {...safe,avatar_url:avatar_key?"/api/admin/users/"+encodeURIComponent(row.id)+"/avatar?v="+Number(profile_updated_at||0):null}}))}
 if(p[0]==="admin"&&p[1]==="users"&&p.length===4&&p[3]==="activity"&&m==="GET"){if(user.role!=="owner")return fail("শুধু Owner activity history দেখতে পারবেন।",403);const target=await env.DB.prepare("SELECT id,role FROM users WHERE id=?").bind(p[2]).first();if(!target)return fail("ব্যবহারকারী পাওয়া যায়নি।",404);const rows=await env.DB.prepare("SELECT hour_start,last_seen FROM user_activity_hours WHERE user_id=? AND hour_start>=? ORDER BY hour_start DESC LIMIT 2160").bind(p[2],Math.floor(Date.now()/1000)-7776000).all();return json({hours:rows.results||[],window_days:90})}
 if(p[0]==="admin"&&p[1]==="users"&&p.length===2&&m==="POST"){return fail("প্রথমে ব্যবহারকারীকে ওয়েবসাইটে নিবন্ধন ও ইমেইল যাচাই করতে হবে; তারপর Owner তাকে Admin করতে পারবেন।",405)}
 if(p[0]==="admin"&&p[1]==="users"&&p.length===3&&m==="PATCH"){if(user.role!=="owner")return fail("শুধু Owner account management করতে পারবেন।",403);const d=await readBody(req);if(["suspend_24h","ban_permanent","restore_access"].includes(d?.action)){if(p[2]===user.id)return fail("নিজের Owner account সীমাবদ্ধ করা যাবে না।",400);const target=await env.DB.prepare("SELECT id,role FROM users WHERE id=?").bind(p[2]).first();if(!target||target.role==="owner")return fail("এই account সুরক্ষিত; পরিবর্তন করা যাবে না।",403);if(d.action==="restore_access"){await env.DB.prepare("DELETE FROM user_restrictions WHERE user_id=?").bind(p[2]).run();return json({ok:true,restored:true})}const now=Math.floor(Date.now()/1000),type=d.action==="ban_permanent"?"ban":"suspend",expires=type==="suspend"?now+86400:null,reason=String(d.reason||"").trim().slice(0,500);await env.DB.prepare("INSERT INTO user_restrictions(user_id,restriction_type,expires_at,reason,created_at,created_by) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET restriction_type=excluded.restriction_type,expires_at=excluded.expires_at,reason=excluded.reason,created_at=excluded.created_at,created_by=excluded.created_by").bind(p[2],type,expires,reason,now,user.id).run();if(type==="suspend"){const recipient=await env.DB.prepare("SELECT email FROM users WHERE id=?").bind(p[2]).first();try{await sendVerificationEmail(env,{to:recipient.email,type:"account-suspended",expiresAt:expires,reason})}catch(e){console.error("Suspension notice email failed",String(e?.message||e));return json({ok:true,restriction:type,expiresAt:expires,emailNotification:"failed"})}}return json({ok:true,restriction:type,expiresAt:expires,emailNotification:type==="suspend"?"sent":"not_applicable"})}if(d?.action==="revoke_sessions"){if(p[2]===user.id)return fail("নিজের Owner session এখান থেকে বাতিল করা যাবে না।",400);const target=await env.DB.prepare("SELECT id,role FROM users WHERE id=?").bind(p[2]).first();if(!target||target.role==="owner")return fail("এই account-এর session পরিবর্তন করা যাবে না।",403);const result=await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(p[2]).run();return json({ok:true,revokedSessions:Number(result.meta.changes||0)})}if(!["user","admin"].includes(d?.role))return fail("অনুমোদিত role দিন।");if(p[2]===user.id)return fail("Owner নিজের role পরিবর্তন করতে পারবেন না।",400);const target=await env.DB.prepare("SELECT id,role,email_verified FROM users WHERE id=?").bind(p[2]).first();if(!target)return fail("ব্যবহারকারী পাওয়া যায়নি।",404);if(target.role==="owner")return fail("Owner role পরিবর্তন করা যাবে না।",403);if(target.email_verified!==1)return fail("ইমেইল যাচাই না হওয়া পর্যন্ত role পরিবর্তন করা যাবে না।",403);if(d.role==="user"){await env.DB.batch([env.DB.prepare("UPDATE users SET role='user' WHERE id=?").bind(p[2]),env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(p[2])]);}else{await env.DB.prepare("UPDATE users SET role='admin' WHERE id=?").bind(p[2]).run()}return json({ok:true})}
 if(p[0]==="admin"&&p[1]==="users"&&p.length===3&&m==="DELETE"){if(user.role!=="owner")return fail("শুধু Owner Admin সরাতে পারবেন।",403);if(p[2]===user.id)return fail("নিজের Owner account নিজে মুছতে পারবেন না।",400);const target=await env.DB.prepare("SELECT role FROM users WHERE id=?").bind(p[2]).first();if(!target||target.role==="owner")return fail("Owner account সরানো যাবে না।",403);await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(p[2]).run();const r=await env.DB.prepare("UPDATE users SET role='user' WHERE id=?").bind(p[2]).run();return r.meta.changes?json({ok:true}):fail("Admin পাওয়া যায়নি。",404)}
 return fail("API route not found.",404)
}
export async function onRequest({request,env}){try{return await handle(request,env)}catch(e){console.error("FRAME API error",e);return fail("Server error. Check D1 migration and bindings.",500)}}