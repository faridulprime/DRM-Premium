(()=>{"use strict";
const ROOT="#dumcHomeCategories",TOGGLE="#visualEditorToggle";
let owner=false,editing=false,current=null,dialog=null,input=null,status=null,saveButton=null,observer=null;
const editSvg='<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m10.9 2.4 2.7 2.7M3 13l2.9-.6 7.6-7.6a1.45 1.45 0 0 0-2.1-2.1l-7.6 7.6L3 13Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function root(){return document.querySelector(ROOT)}
function getToggle(){return document.querySelector(TOGGLE)}
function notify(message){
 let toast=document.querySelector(".dulm-toast");
 if(!toast){toast=document.createElement("div");toast.className="dulm-toast";toast.setAttribute("role","status");toast.setAttribute("aria-live","polite");document.body.append(toast)}
 toast.textContent=message;toast.classList.add("is-visible");
 clearTimeout(toast._hideTimer);toast._hideTimer=setTimeout(()=>toast.classList.remove("is-visible"),2300);
}
function buildDialog(){
 if(dialog)return;
 dialog=document.createElement("dialog");dialog.className="dulm-rename-dialog";dialog.setAttribute("aria-labelledby","dulmRenameTitle");
 dialog.innerHTML='<form class="dulm-rename-form" novalidate><header class="dulm-rename-head"><div><span class="dulm-rename-kicker">DULM · FOLDER MANAGER</span><h2 id="dulmRenameTitle">Rename Folder</h2></div></header><label class="dulm-rename-field" for="dulmRenameInput"><span>Folder name</span><input id="dulmRenameInput" name="folderName" type="text" maxlength="100" autocomplete="off" spellcheck="false" required></label><p class="dulm-rename-status" id="dulmRenameStatus" role="status" aria-live="polite"></p><div class="dulm-rename-actions"><button type="button" class="dulm-cancel" data-dulm-cancel>Cancel</button><button type="submit" class="dulm-save" data-dulm-save>Save</button></div></form>';
 document.body.append(dialog);
 const form=dialog.querySelector("form");input=dialog.querySelector("#dulmRenameInput");status=dialog.querySelector("#dulmRenameStatus");saveButton=dialog.querySelector("[data-dulm-save]");
 form.addEventListener("submit",e=>{e.preventDefault();saveRename()});
 dialog.querySelector("[data-dulm-cancel]").addEventListener("click",()=>dialog.close());
 dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
 dialog.addEventListener("close",()=>{current=null;if(status)status.textContent="";if(saveButton){saveButton.disabled=false;saveButton.textContent="Save";}});
}
function itemId(item){return item.dataset.folderId||item.dataset.categoryFolder||("YEAR_"+(item.dataset.year||""))}
function decorateItem(item,index){
 const id=itemId(item);if(!id||id==="YEAR_")return;
 item.dataset.folderId=id;
 item.dataset.dulmItem=String(index+1);
 let row=item.parentElement?.classList.contains("dulm-folder-row")?item.parentElement:null;
 if(!row){
  row=document.createElement("div");row.className="dulm-folder-row";
  item.parentNode.insertBefore(row,item);row.append(item);
 }
 let edit=row.querySelector("[data-dulm-edit-folder]");
 if(!edit){
  edit=document.createElement("button");edit.type="button";edit.className="dulm-folder-edit";edit.innerHTML=editSvg;
  edit.setAttribute("aria-label","Rename folder");edit.title="Rename folder";row.append(edit);
 }
 edit.dataset.dulmEditFolder=id;
 edit.dataset.folderLabel=item.dataset.folderLabel||item.querySelector("span")?.textContent?.trim()||"";
 edit.hidden=!(owner&&editing);
}
function manage(rootNode=document){
 const host=root();
 if(!host)return;
 const panels=host.querySelectorAll(".dufn-tab-wrap .dufn-panel");
 panels.forEach(panel=>{
  panel.dataset.dulmManaged="true";panel.dataset.dulmList="true";panel.dataset.dusb="true";panel.setAttribute("role","region");
  panel.querySelectorAll(".dufn-folder").forEach(decorateItem);
  if(window.DUSB?.refresh)window.DUSB.refresh(panel);
 });
}
function applyMode(){
 const active=owner&&editing,toggle=getToggle();
 document.body.classList.toggle("dulm-editing",active);
 if(toggle){toggle.classList.toggle("dulm-editing",active);toggle.setAttribute("aria-pressed",active?"true":"false");toggle.title=active?"Exit Folder Editing Mode":"Edit folder names";toggle.setAttribute("aria-label",active?"Exit Folder Editing Mode":"Edit folder names");}
 manage();
}
function setOwner(value){
 owner=value===true;
 if(!owner)editing=false;
 applyMode();
}
function toggleMode(){
 if(!owner){notify("Folder Editing শুধু Owner ব্যবহার করতে পারবেন।");return}
 editing=!editing;applyMode();
 notify(editing?"Folder Editing Mode চালু হয়েছে।":"Folder Editing Mode বন্ধ হয়েছে।");
}
function openRename(button){
 if(!owner||!editing)return;
 const id=button.dataset.dulmEditFolder;if(!id)return;
 buildDialog();current={id,button};
 input.value=button.dataset.folderLabel||"";
 status.textContent="";saveButton.disabled=false;saveButton.textContent="Save";
 dialog.showModal();requestAnimationFrame(()=>{input.focus({preventScroll:true});input.select()});
}
async function saveRename(){
 if(!current||saveButton.disabled)return;
 const name=input.value.normalize("NFC").trim();
 if(!name||name.length>100||Array.from(name).some(ch=>ch.charCodeAt(0)<32||ch.charCodeAt(0)===127)){
  status.textContent="Folder name ১–১০০ অক্ষরের মধ্যে দিন।";input.focus();return;
 }
 if(name===current.button.dataset.folderLabel){dialog.close();return}
 saveButton.disabled=true;saveButton.textContent="Saving…";status.textContent="Saving folder name…";
 try{
  const response=await fetch("/api/admin/dufs/folder-name-overrides",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify({folder_id:current.id,name})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok!==true)throw new Error(data.error||"Folder name সংরক্ষণ করা যায়নি।");
  const overrides=window.DUFSFolderNameOverrides||window.DUMCFolderNameOverrides||{};
  overrides[current.id]=data.name||name;window.DUFSFolderNameOverrides=overrides;window.DUMCFolderNameOverrides=overrides;
  if(typeof window.DUFSRefresh==="function")window.DUFSRefresh();else if(typeof window.DUMCRefresh==="function")window.DUMCRefresh();
  dialog.close();notify("Folder name successfully saved.");
 }catch(error){status.textContent=error?.message||"Save ব্যর্থ হয়েছে।";saveButton.disabled=false;saveButton.textContent="Save";}
}
function start(){
 const host=root(),toggle=getToggle();if(!host)return;
 owner=toggle?.dataset.owner==="true";
 buildDialog();manage();
 if(toggle)toggle.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();toggleMode()});
 host.addEventListener("click",e=>{
  const button=e.target.closest("[data-dulm-edit-folder]");
  if(!button)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openRename(button);
 },true);
 observer=new MutationObserver(records=>{
  let changed=false;
  for(const record of records)if(record.addedNodes.length||record.removedNodes.length){changed=true;break}
  if(changed)manage(host);
 });
 observer.observe(host,{childList:true,subtree:true});
 applyMode();
 window.DULM={version:"1.1.0",setOwner,refresh:()=>manage(host),toggleEditMode:toggleMode,get editing(){return owner&&editing}};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();