window.SoccerBrand={logo(slot,name,url){
 const target=document.getElementById(slot);if(!target)return;
 const key=String(name)+'|'+String(url);if(target.getAttribute('data-logo-key')===key)return;target.setAttribute('data-logo-key',key);
 const initials=String(name||'Team').trim().split(/\s+/).slice(0,2).map(v=>v[0]).join('').toUpperCase();
 target.textContent=initials;target.setAttribute('aria-label',String(name||'Team')+' logo');
 let source;if(/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(String(url))&&String(url).length<=400000)source=url;else try{const safe=new URL(url);if(safe.protocol!=='https:')return;source=safe.href}catch{return}
 const img=document.createElement('img');img.alt=String(name||'Team')+' logo';img.referrerPolicy='no-referrer';img.onerror=()=>{target.textContent=initials};img.src=source;target.textContent='';target.append(img);
}};
