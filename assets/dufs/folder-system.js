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
const createFolder=({parent_id,name,description="",sort_order}={})=>{
 if(!parent_id)throw new Error("A parent folder is required.");
 const payload={parent_id,name:displayFolderName(name),description};
 if(Number.isInteger(sort_order))payload.sort_order=sort_order;
 return request(ADMIN+"/folders",{method:"POST",body:JSON.stringify(payload)});
};
const updateFolderMetadata=(folderId,changes={})=>{
 if(!folderId)throw new Error("A folder ID is required.");
 if(Object.prototype.hasOwnProperty.call(changes,"name"))throw new Error("Use renameFolder() to preserve the canonical folder display-name override.");
 const payload={};
 if(changes.description!==undefined)payload.description=String(changes.description);
 if(changes.sort_order!==undefined)payload.sort_order=changes.sort_order;
 if(!Object.keys(payload).length)throw new Error("No supported folder metadata changes were supplied.");
 return request(ADMIN+"/folders/"+encodeURIComponent(folderId),{method:"PATCH",body:JSON.stringify(payload)});
};
const archiveFolder=folderId=>{
 if(!folderId)throw new Error("A folder ID is required.");
 return request(ADMIN+"/folders/"+encodeURIComponent(folderId),{method:"DELETE"});
};
const loadMovies=(params={})=>{
 const url=new URL(ADMIN+"/movies",location.origin);
 Object.entries(params).forEach(([key,value])=>{if(value!==undefined&&value!==null&&value!=="")url.searchParams.set(key,String(value))});
 return request(url.pathname+url.search);
};
const loadMovie=videoId=>request(ADMIN+"/movies/"+encodeURIComponent(videoId));
const updateMovie=(videoId,payload)=>request(ADMIN+"/movies/"+encodeURIComponent(videoId),{method:"PUT",body:JSON.stringify(payload)});
const updateMovieFolders=(videoId,assignments)=>request(ADMIN+"/movies/"+encodeURIComponent(videoId)+"/folders",{method:"PUT",body:JSON.stringify({assignments})});
const registerAudio=(videoId,payload)=>request(ADMIN+"/movies/"+encodeURIComponent(videoId)+"/audio",{method:"POST",body:JSON.stringify(payload)});
const removeAudio=(videoId,trackId)=>request(ADMIN+"/movies/"+encodeURIComponent(videoId)+"/audio/"+encodeURIComponent(trackId),{method:"DELETE"});
const registerSubtitle=(videoId,payload)=>request(ADMIN+"/movies/"+encodeURIComponent(videoId)+"/subtitles",{method:"POST",body:JSON.stringify(payload)});
const removeSubtitle=(videoId,subtitleId)=>request(ADMIN+"/movies/"+encodeURIComponent(videoId)+"/subtitles/"+encodeURIComponent(subtitleId),{method:"DELETE"});
const searchFolders=(nodes,query,overrides={})=>{
 const q=String(query??"").trim().toLocaleLowerCase();
 if(!q)return [...(nodes||[])];
 const result=[];
 for(const node of nodes||[]){
  const children=searchFolders(node.children||[],q,overrides);
  const label=displayFolderName(overrides[node.id]||node.name);
  const matches=(label+" "+String(node.description||"")+" "+node.id).toLocaleLowerCase().includes(q);
  if(matches||children.length)result.push({...node,children});
 }
 return result;
};
const buildHierarchy=flatFolders=>{
 const map=new Map((flatFolders||[]).map(folder=>[folder.id,{...folder,children:[]}]));
 const roots=[];
 for(const folder of map.values()){
  if(folder.parent_id&&map.has(folder.parent_id))map.get(folder.parent_id).children.push(folder);
  else if(!folder.parent_id)roots.push(folder);
 }
 const sortTree=nodes=>{nodes.sort((a,b)=>displayFolderName(a.name).localeCompare(displayFolderName(b.name),undefined,{numeric:true,sensitivity:"base"}));nodes.forEach(n=>sortTree(n.children))};
 sortTree(roots);
 return roots;
};
const countFolders=nodes=>flatten(nodes).length;
const getSystemInfo=()=>request(API+"/system");
const api={
 version:VERSION,namespace:"DUFS",displayFolderName,sortFolders,flatten,findFolder,searchFolders,buildHierarchy,countFolders,
 loadTaxonomy,loadOverrides,loadFolderTree,browse,renameFolder,createFolder,updateFolderMetadata,archiveFolder,
 loadMovies,loadMovie,updateMovie,updateMovieFolders,registerAudio,removeAudio,registerSubtitle,removeSubtitle,getSystemInfo,request,
 endpoints:Object.freeze({public:API,admin:ADMIN,taxonomy:TAXONOMY}),
 compatibility:Object.freeze({legacyNamespace:"DUMC",legacyApiSupported:true,legacyDatabaseSchema:"dumc_*"})
};
window.DUFS=Object.freeze(api);
window.DUFSSYSTEM=window.DUFS;
})();