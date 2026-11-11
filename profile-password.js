/* Read the link type before the auth client consumes and clears the URL fragment. */
(()=>{
 const fragment=new URLSearchParams(location.hash.slice(1));
 const linkType=fragment.has('access_token')?fragment.get('type'):null;
 let setupToken=linkType==='invite'||linkType==='recovery'?fragment.get('access_token'):null;
 document.addEventListener('DOMContentLoaded',()=>{
  const auth=window.Live?.client?.auth;
  const get=id=>document.getElementById(id);
  const reset=get('profileResetPassword');
  if(!auth){reset.disabled=true;return;}
  const section=get('profilePasswordSection'),details=get('profilePasswordDetails');
  const form=get('profileSetPassword'),password=get('profileNewPassword'),confirmation=get('profileConfirmPassword');
  const status=get('profilePasswordStatus');
  let accountId=null;
  function showPasswordControls(session,recovering){
   const nextId=session?.user?.id??null;
   if(accountId!==nextId){
    password.value=confirmation.value='';
    status.textContent='';
    details.open=false;
   }
   accountId=nextId;
   section.hidden=!accountId;
   if(accountId&&(recovering||(setupToken&&session.access_token===setupToken))){
    setupToken=null;
    details.open=true;
    get('profilePasswordIntro').textContent='Choose a password for your LLS account so you can sign in again.';
   }
  }
  auth.onAuthStateChange((event,session)=>{
   showPasswordControls(session,event==='PASSWORD_RECOVERY');
  });

  reset.addEventListener('click',async()=>{
   const email=get('profileEmail'),message=get('profilePasswordEmailStatus');
   if(!email.reportValidity())return;
   reset.disabled=true;
   try{
    // The project Site URL receives auth links and forwards recovery to My Profile.
    const {error}=await auth.resetPasswordForEmail(email.value.trim());
    if(error)throw error;
    message.textContent='If a reset email can be sent for this address, it will arrive in your inbox.';
   }catch{
    message.textContent='A reset email could not be requested. Try again later.';
   }finally{reset.disabled=false;}
  });

  form.addEventListener('submit',async event=>{
   event.preventDefault();
   if(!accountId)return;
   if(password.value!==confirmation.value){
    status.textContent='The passwords do not match.';
    confirmation.focus();return;
   }
   const button=form.querySelector('button'),savingFor=accountId;
   button.disabled=true;
   try{
    const {error}=await auth.updateUser({password:password.value});
    if(error)throw error;
    if(accountId===savingFor){
     form.reset();
     status.textContent='Password saved. You can use it the next time you sign in.';
    }
   }catch(error){
    if(accountId===savingFor)status.textContent=error.message||'The password could not be saved.';
   }finally{button.disabled=false;}
  });
 });
})();
