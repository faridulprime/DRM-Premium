(()=>{"use strict";
const VERSION="1.0.0",API="/api/dufs",ADMIN="/api/admin/dufs",TAXONOMY="/assets/dufs/taxonomy.json";
const displayFolderName=value=>{
 const clean=String(value??"").replaceAll("_"," ").trim();
 const label=clean.split(" ").map(part=>part.toLowerCase()==="cinema"?"Movies":part).join(" ");
 if(label.toLowerCase()==="dhallywood")return "Bangla Movies";
 if(label.toUpperCase()==="DUMC")return "DUFS";
 return label;
};
const sortFolders=(items,overrides={})=>[...(items||[])].sort((a,b)=>displayFolderName(overrides[a.id]||a.name).localeCompare(displayFolderName(overrides[b.id]||b.name),undefined,{numeric:true,sensitivity:"base"}));
const flatten=(nodes,out=[])=>{for(const node of nodes||[]){out.push(node);flatten(node.children,out)}return out};
const findFolder=(nodes,id)=>{for(const node of nodes||[]){if(node.id===id)return node;const found=findFolder(node.children,id);if(found)return found}return null};
async function request(path,options={}){
 const response=await fetch(path,{credentials:"same-origin",cache:"no-store",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||"DUFS request failed ("+response.status+")");
 return data;
}
const loadTaxonomy=async()=>{const response=await fetch(TAXONOMY,{cache:"no-cache"});if(!response.ok)throw new Error("DUFS taxonomy could not be loaded.");return response.json()};
const loadOverrides=async()=>{const result=await request(API+"/folder-name-overrides");return result.overrides||{}};
const loadFolderTree=async()=>request(ADMIN+"/folders");
const browse=(params={})=>{const url=new URL(API+"/browse",location.origin);Object.entries(params).forEach(([key,value])=>{if(value!==undefined&&value!==null&&value!=="")url.searchParams.set(key,String(value))});return request(url.pathname+url.search)};
const renameFolder=(folderId,name)=>request(ADMIN+"/folder-name-overrides",{method:"PUT",body:JSON.stringify({folder_id:folderId,name})});
const getSystemInfo=()=>request(API+"/system");
const api={
 version:VERSION,namespace:"DUFS",displayFolderName,sortFolders,flatten,findFolder,
 loadTaxonomy,loadOverrides,loadFolderTree,browse,renameFolder,getSystemInfo,
 endpoints:Object.freeze({public:API,admin:ADMIN,taxonomy:TAXONOMY}),
 compatibility:Object.freeze({legacyNamespace:"DUMC",legacyApiSupported:true,legacyDatabaseSchema:"dumc_*"})
};
window.DUFS=Object.freeze(api);
window.DUFSSYSTEM=window.DUFS;
})();