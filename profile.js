const $=s=>document.querySelector(s);
let selectedAvatar=null,removeExistingAvatar=false;
function setStatus(message,error=false){const el=$("#profileStatus");el.textContent=message;el.classList.toggle("error",error)}
function showAvatar(src){const box=$("#avatarPreview");box.innerHTML=src?'<img alt="Profile picture preview">':'<span id="avatarInitial">U</span>';if(src)box.querySelector("img").src=src;$("#removeAvatar").hidden=!src}
function fileToDataURL(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("ছবিটি পড়া যায়নি।"));reader.readAsDataURL(file)})}
async function loadProfile(){
 const res=await fetch("/api/profile",{credentials:"same-origin"});if(res.status===401){location.href="/";return}const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"প্রোফাইল লোড করা যায়নি।");
 const p=data.profile||{};$("#fullName").value=p.full_name||"";$("#bio").value=p.bio||"";$("#dateOfBirth").value=p.date_of_birth||"";$("#gender").value=p.gender||"";$("#location").value=p.location||"";if(p.avatar_url)showAvatar(p.avatar_url);else $("#removeAvatar").hidden=true;
}
$("#avatarInput").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setStatus("শুধু JPG, PNG অথবা WebP ছবি ব্যবহার করুন।",true);e.target.value="";return}if(file.size>2*1024*1024){setStatus("Profile picture সর্বোচ্চ 2 MB হতে পারবে।",true);e.target.value="";return}try{selectedAvatar=await fileToDataURL(file);removeExistingAvatar=false;showAvatar(selectedAvatar);setStatus("ছবি নির্বাচন করা হয়েছে। Save profile চাপলে সংরক্ষিত হবে।")}catch(err){setStatus(err.message,true)}});
$("#removeAvatar").addEventListener("click",()=>{selectedAvatar=null;removeExistingAvatar=true;showAvatar("");$("#avatarInput").value="";setStatus("ছবি সরানো হবে। Save profile চাপলে পরিবর্তন কার্যকর হবে।")});
$("#profileForm").addEventListener("submit",async e=>{e.preventDefault();const button=$("#saveProfile");button.disabled=true;button.textContent="Saving…";setStatus("");
 try{const payload={full_name:$("#fullName").value.trim(),bio:$("#bio").value.trim(),date_of_birth:$("#dateOfBirth").value,gender:$("#gender").value,location:$("#location").value.trim()};if(selectedAvatar)payload.avatar_data_url=selectedAvatar;if(removeExistingAvatar)payload.remove_avatar=true;
 const res=await fetch("/api/profile",{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"প্রোফাইল সংরক্ষণ করা যায়নি।");
 selectedAvatar=null;removeExistingAvatar=false;setStatus("Your profile has been saved successfully.");if(data.profile?.avatar_url)showAvatar(data.profile.avatar_url);else showAvatar("");
 }catch(err){setStatus(err.message,true)}finally{button.disabled=false;button.textContent="Save profile"}
});
loadProfile().catch(e=>setStatus(e.message,true));
