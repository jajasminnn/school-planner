(()=>{
'use strict';
// Public landing page. Signed-in visitors skip straight to the planner.
const params=new URLSearchParams(location.search);
// Page the visitor tried to open before signing in (only the planner itself is allowed).
const next=/^app\.html(#[a-z]+)?$/.test(params.get('next')||'')?params.get('next'):'';

// Carry the remembered destination through to the login page.
document.querySelectorAll('[data-auth]').forEach(a=>{
  const q=new URLSearchParams();
  if(a.dataset.auth==='register')q.set('mode','register');
  if(next)q.set('next',next);
  const s=q.toString();
  a.href='login.html'+(s?'?'+s:'');
});

function showLanding(){document.body.classList.remove('auth-pending')}
const auth=window.schoolPlannerFirebase?.auth||null;
if(!auth){showLanding();return;}
// Never leave a returning visitor stuck on the splash if Firebase is slow.
const fallback=setTimeout(showLanding,4000);
auth.onAuthStateChanged(async user=>{
  clearTimeout(fallback);
  // Signed in on this browser for more than 30 days: sign out and stay on the landing page.
  if(user&&window.jasyncSession&&await window.jasyncSession.endIfExpired(auth,user))user=null;
  if(user)location.replace(next||'app.html');
  else{
    try{localStorage.removeItem('jasync-session')}catch{}
    showLanding();
  }
});
})();
