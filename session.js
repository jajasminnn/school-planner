// Sign-in length for JASync.
// Firebase keeps a user signed in on this browser indefinitely (local persistence). JASync limits that to
// 30 days from the moment they actually signed in on this browser; after that they are signed out and
// asked to sign in again. The sign-in time is stored per browser, so each device has its own 30 days.
(()=>{
'use strict';
const MAX_AGE=30*24*60*60*1000;
const key=uid=>'jasync-signin:'+uid;
function read(uid){try{return Number(localStorage.getItem(key(uid)))||0}catch{return 0}}

window.jasyncSession={
  MAX_AGE,
  // Call when the user has just signed in (not when an existing session is restored).
  start(uid){try{localStorage.setItem(key(uid),String(Date.now()))}catch{}},
  clear(uid){try{localStorage.removeItem(key(uid))}catch{}},
  isExpired(user){
    if(!user)return false;
    const signedInAt=read(user.uid);
    // Sessions from before this limit existed have no recorded time: start their 30 days now.
    if(!signedInAt){this.start(user.uid);return false}
    return Date.now()-signedInAt>MAX_AGE;
  },
  // Signs the user out if their 30 days are up. Resolves true when the session has ended.
  async endIfExpired(auth,user){
    if(!this.isExpired(user))return false;
    try{await auth.signOut();this.clear(user.uid)}catch(err){console.error('Could not end expired session:',err)}
    return true;
  }
};
})();
