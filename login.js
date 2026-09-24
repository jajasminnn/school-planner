(()=>{
'use strict';
const $=s=>document.querySelector(s);
try{
  const t=localStorage.getItem('school-planner-theme')||JSON.parse(localStorage.getItem('school-planner-v2')||'null')?.settings?.theme;
  const dark=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.classList.toggle('dark',dark);
}catch{}

const params=new URLSearchParams(location.search);
// Only ever return to the planner itself (optionally a view like app.html#tasks), never an outside URL.
const next=/^app\.html(#[a-z]+)?$/.test(params.get('next')||'')?params.get('next'):'app.html';
const firebaseServices=window.schoolPlannerFirebase||{};
const auth=firebaseServices.auth||null;

function authMessage(text,isError=true){
  const e=$('#authMessage');
  if(e){e.textContent=text||'';e.classList.toggle('error',!!isError);e.classList.toggle('success',!isError);}
}
function authErrorMessage(err){
  const code=err?.code||'unknown-error';
  const map={
    'auth/invalid-email':'Please enter a valid email address.',
    'auth/invalid-credential':'The email or password is incorrect.',
    'auth/wrong-password':'The email or password is incorrect.',
    'auth/user-not-found':'The email or password is incorrect.',
    'auth/email-already-in-use':'That email already has an account. Try Log in.',
    'auth/weak-password':'That password is too weak. Use at least 8 characters.',
    'auth/operation-not-allowed':'This sign-in method is not enabled in Firebase Authentication.',
    'auth/unauthorized-domain':'This website domain is not authorized in Firebase Authentication.',
    'auth/popup-blocked':'The Google sign-in popup was blocked. Allow popups and try again.',
    'auth/popup-closed-by-user':'The Google sign-in window was closed before completing sign-in.',
    'auth/cancelled-popup-request':'Another Google sign-in window is already open.',
    'auth/network-request-failed':'The connection to Firebase failed. Check your internet connection.',
    'auth/account-exists-with-different-credential':'This email already uses another sign-in method. Log in with that method first.'
  };
  return {code,message:map[code]||err?.message||'Sign-in could not be completed.'};
}
function setAuthMode(mode){
  const register=mode==='register';
  document.querySelectorAll('.auth-tab').forEach(b=>b.classList.toggle('active',b.dataset.authMode===mode));
  const wrap=$('#authConfirmWrap'), pass=$('#authPassword'), submit=$('#emailAuthSubmit'), forgot=$('#authForgot');
  if(wrap)wrap.hidden=!register;
  if(pass)pass.autocomplete=register?'new-password':'current-password';
  if(submit)submit.textContent=register?'Create account':'Log in';
  if(forgot)forgot.hidden=register;
  authMessage('');
}
async function signInWithGoogle(){
  if(!auth){authMessage('Firebase could not be initialized.');return;}
  authMessage('Opening Google sign-in…',false);
  try{
    const provider=new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    await auth.signInWithPopup(provider);
    location.replace(next);
  }catch(err){
    console.error('Google sign-in failed:',err);
    if(err?.code==='auth/popup-blocked'){
      try{
        const provider=new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({prompt:'select_account'});
        await auth.signInWithRedirect(provider);
        return;
      }catch(redirectErr){
        console.error('Google redirect sign-in failed:',redirectErr);
        const r=authErrorMessage(redirectErr);
        authMessage('Error '+r.code+': '+r.message);
        return;
      }
    }
    const info=authErrorMessage(err);
    authMessage('Error '+info.code+': '+info.message);
  }
}
async function handleEmailAuth(e){
  e.preventDefault();
  if(!auth){authMessage('Firebase could not be initialized.');return;}
  const register=!$('#authConfirmWrap')?.hidden;
  const email=$('#authEmail')?.value.trim()||'';
  const password=$('#authPassword')?.value||'';
  const password2=$('#authPassword2')?.value||'';
  if(!email){authMessage('Please enter your email address.');return;}
  if(password.length<8){authMessage('Password must be at least 8 characters.');return;}
  if(register&&password!==password2){authMessage("Passwords don't match.");return;}
  const submit=$('#emailAuthSubmit');
  if(submit)submit.disabled=true;
  authMessage(register?'Creating your account…':'Signing you in…',false);
  try{
    if(register)await auth.createUserWithEmailAndPassword(email,password);
    else await auth.signInWithEmailAndPassword(email,password);
    location.replace(next);
  }catch(err){
    console.error('Email/password sign-in failed:',err);
    const info=authErrorMessage(err);
    authMessage('Error '+info.code+': '+info.message);
  }finally{
    if(submit)submit.disabled=false;
  }
}
async function sendPasswordReset(){
  if(!auth){authMessage('Firebase could not be initialized.');return;}
  const email=$('#authEmail')?.value.trim()||'';
  if(!email){authMessage('Enter your email first, then click Forgot password.');$('#authEmail')?.focus();return;}
  try{
    await auth.sendPasswordResetEmail(email);
    authMessage('If an account exists for that email, a password-reset email has been sent.',false);
  }catch(err){
    console.error('Password reset failed:',err);
    const info=authErrorMessage(err);
    authMessage('Error '+info.code+': '+info.message);
  }
}

document.querySelectorAll('.auth-tab').forEach(b=>b.addEventListener('click',()=>setAuthMode(b.dataset.authMode)));
$('#googleAuthBtn')?.addEventListener('click',signInWithGoogle);
$('#emailAuthForm')?.addEventListener('submit',handleEmailAuth);
$('#authForgot')?.addEventListener('click',sendPasswordReset);
if(params.get('mode')==='register')setAuthMode('register');

if(!auth){
  authMessage('Firebase could not be initialized.');
}else{
  auth.onAuthStateChanged(user=>{ if(user) location.replace(next); });
}
})();
