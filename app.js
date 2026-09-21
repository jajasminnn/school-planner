(()=>{
'use strict';
const KEY='school-planner-v2';
const OLD={calendar:'school-planner-calendar',tasks:'school-planner-tasks',notes:'school-planner-notes'};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const state={view:'dashboard',calendar:{events:[],showTasks:true},tasks:{tasks:[],meta:{subjects:[]}},notes:{notes:[],subjects:{}},settings:{theme:'light',subjects:[]},calCursor:new Date(),calMode:'month',selectedSubject:null,selectedNote:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const iso=d=>{d=new Date(d);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const parse=s=>new Date(s+'T00:00:00');
const today=()=>iso(new Date());
const fmtDate=s=>s?parse(s).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'No date';
const fmtLong=s=>s?parse(s).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}):'';
let cloudUser=null;
let cloudLoaded=false;
let cloudSaveTimer=null;
const firebaseServices=window.schoolPlannerFirebase||{};
const auth=firebaseServices.auth||null;
const db=firebaseServices.db||null;
const cloudRef=()=>cloudUser&&db?db.collection('users').doc(cloudUser.uid).collection('planner').doc('main'):null;
const plannerPayload=()=>({calendar:state.calendar,tasks:state.tasks,notes:state.notes,settings:state.settings,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
function setSaveStatus(text){const e=$('#saveIndicator');if(e)e.innerHTML=`<i></i><span>${esc(text)}</span>`}
function save(){
  const payload={calendar:state.calendar,tasks:state.tasks,notes:state.notes,settings:state.settings};
  localStorage.setItem(KEY,JSON.stringify(payload));
  setSaveStatus(cloudUser&&cloudLoaded?'Saving…':'Saved on this device');
  clearTimeout(save.t);
  save.t=setTimeout(()=>setSaveStatus(cloudUser&&cloudLoaded?'Saved to cloud':'Saved on this device'),900);
  if(cloudUser&&cloudLoaded&&db){
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer=setTimeout(()=>saveToCloud(),500);
  }
}
async function saveToCloud(){
  const ref=cloudRef();
  if(!ref||!cloudLoaded)return;
  try{
    await ref.set(plannerPayload());
    setSaveStatus('Saved to cloud');
  }catch(err){
    console.error('Cloud save failed:',err);
    setSaveStatus('Saved on this device');
    toast('Cloud save failed — your local copy is safe.');
  }
}
function loadLocal(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x){Object.assign(state,x);state.calendar??={events:[]};state.tasks??={tasks:[],meta:{}};state.notes??={notes:[],subjects:{}};state.settings??={}}else migrate()}catch{migrate()} if(!Array.isArray(state.settings.subjects))state.settings.subjects=[]; if(!state.settings.subjects.length)state.settings.subjects=Array.from({length:8},(_,i)=>({id:'s'+(i+1),name:`Subject ${i+1}`})); syncSubjects();}
async function loadCloudForUser(user){
  cloudUser=user; cloudLoaded=false;
  updateAuthUI(user);
  setSaveStatus('Loading cloud data…');
  try{
    const snap=await cloudRef().get();
    if(snap.exists){
      const x=snap.data()||{};
      if(x.calendar)state.calendar=x.calendar;
      if(x.tasks)state.tasks=x.tasks;
      if(x.notes)state.notes=x.notes;
      if(x.settings)state.settings=x.settings;
      if(!Array.isArray(state.settings.subjects))state.settings.subjects=[];
      if(!state.settings.subjects.length)state.settings.subjects=Array.from({length:8},(_,i)=>({id:'s'+(i+1),name:`Subject ${i+1}`}));
      syncSubjects();
      localStorage.setItem(KEY,JSON.stringify({calendar:state.calendar,tasks:state.tasks,notes:state.notes,settings:state.settings}));
      setSaveStatus('Synced from cloud');
    }else{
      syncSubjects();
      cloudLoaded=true;
      await saveToCloud();
      setSaveStatus('Saved to cloud');
    }
    cloudLoaded=true;
    render();
  }catch(err){
    console.error('Cloud load failed:',err);
    cloudLoaded=false;
    setSaveStatus('Saved on this device');
    toast('Firebase is connected, but Firestore access needs its security rules.');
    render();
  }
}
function updateAuthUI(user){
  const btn=$('#authButton'), name=$('#workspaceName'), email=$('#workspaceEmail'), avatar=$('#userAvatar');
  if(!btn)return;
  if(user){
    const display=user.displayName||user.email?.split('@')[0]||'My Workspace';
    name.textContent=display;
    email.textContent=user.email||'Signed in';
    avatar.textContent=(display.trim()[0]||'J').toUpperCase();
    btn.textContent='Sign out';
    btn.title='Sign out';
    btn.setAttribute('aria-label','Sign out');
  }else{
    name.textContent='My Workspace';
    email.textContent='Sign in to sync';
    avatar.textContent='J';
    btn.textContent='Sign in';
    btn.title='Sign in';
    btn.setAttribute('aria-label','Sign in');
  }
}
function authMessage(text,isError=true){
  const e=$('#authMessage');
  if(e){e.textContent=text||'';e.classList.toggle('error',!!isError);e.classList.toggle('success',!isError);}
}
function setAuthMode(mode){
  const register=mode==='register';
  $$('.auth-tab').forEach(b=>b.classList.toggle('active',b.dataset.authMode===mode));
  const wrap=$('#authConfirmWrap'), pass=$('#authPassword'), submit=$('#emailAuthSubmit'), forgot=$('#authForgot');
  if(wrap)wrap.hidden=!register;
  if(pass)pass.autocomplete=register?'new-password':'current-password';
  if(submit)submit.textContent=register?'Create account':'Log in';
  if(forgot)forgot.hidden=register;
  authMessage('');
}
function openAuthModal(){
  const modal=$('#authModal');
  if(!modal)return;
  setAuthMode('login');
  authMessage('');
  modal.hidden=false;
  document.body.classList.add('auth-open');
  setTimeout(()=>$('#authEmail')?.focus(),30);
}
function closeAuthModal(){
  const modal=$('#authModal');
  if(modal)modal.hidden=true;
  document.body.classList.remove('auth-open');
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
  return {code,message:map[code]||err?.message||'Google sign-in could not be completed.'};
}
async function signInWithGoogle(){
  if(!auth){authMessage('Firebase could not be initialized.');return;}
  authMessage('Opening Google sign-in…',false);
  try{
    const provider=new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    await auth.signInWithPopup(provider);
    closeAuthModal();
  }catch(err){
    console.error('Google sign-in failed:',err);
    const info=authErrorMessage(err);
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
    closeAuthModal();
    toast(register?'Account created.':'Signed in successfully.');
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
async function handleAuthClick(){
  if(!auth){toast('Firebase could not be initialized.');return;}
  if(auth.currentUser){
    try{
      await auth.signOut();
      cloudUser=null;cloudLoaded=false;
      setSaveStatus('Saved on this device');
      updateAuthUI(null);
      toast('Signed out.');
    }catch(err){console.error(err);toast('Could not sign out.');}
    return;
  }
  openAuthModal();
}
function setupFirebaseAuth(){
  updateAuthUI(auth?.currentUser||null);
  $('#authButton')?.addEventListener('click',handleAuthClick);
  $('#authClose')?.addEventListener('click',closeAuthModal);
  $('#authModal')?.addEventListener('click',e=>{if(e.target.id==='authModal')closeAuthModal();});
  $$('.auth-tab').forEach(b=>b.addEventListener('click',()=>setAuthMode(b.dataset.authMode)));
  $('#googleAuthBtn')?.addEventListener('click',signInWithGoogle);
  $('#emailAuthForm')?.addEventListener('submit',handleEmailAuth);
  $('#authForgot')?.addEventListener('click',sendPasswordReset);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAuthModal();});
  if(!auth){setSaveStatus('Firebase unavailable');return;}
  auth.onAuthStateChanged(user=>{
    if(user)loadCloudForUser(user);
    else{cloudUser=null;cloudLoaded=false;updateAuthUI(null);setSaveStatus('Saved on this device');}
  });
}
function migrate(){let old={}; try{for(const [k,v] of Object.entries(OLD)){const x=JSON.parse(localStorage.getItem(v)||'null'); if(x)old[k]=x}}catch{}; if(old.calendar)state.calendar=old.calendar; if(old.tasks){state.tasks=old.tasks;state.settings.subjects=(old.tasks.meta?.subjects||[]).map(x=>({id:x.id,name:x.name||''}))}; if(old.notes){state.notes={notes:old.notes.notes||[],subjects:{}}; (old.notes.folders||[]).forEach(f=>{state.notes.subjects[f.id]={id:f.id,name:f.name,body:''}})}; if(!state.settings.subjects?.length){state.settings.subjects=Array.from({length:8},(_,i)=>({id:'s'+(i+1),name:`Subject ${i+1}`}))}}
// Firebase-aware startup uses loadLocal() first, then replaces it with the signed-in user's cloud copy when available.
function syncSubjects(){state.tasks.meta=state.tasks.meta||{};state.tasks.meta.subjects=state.settings.subjects.map(s=>({id:s.id,name:s.name}));state.notes.subjects=state.notes.subjects||{};state.settings.subjects.forEach(s=>{if(!state.notes.subjects[s.id])state.notes.subjects[s.id]={id:s.id,name:s.name,body:'',notes:[]};state.notes.subjects[s.id].name=s.name});}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1800)}
function openModal(title,body,actions=''){const root=$('#modalRoot');root.innerHTML=`<div class="modal-backdrop" id="backdrop"><div class="modal"><div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-close>×</button></div><div class="modal-body">${body}</div>${actions?`<div class="modal-foot">${actions}</div>`:''}</div></div>`;$('#backdrop').addEventListener('click',e=>{if(e.target.id==='backdrop'||e.target.closest('[data-close]'))root.innerHTML=''})}
function setView(v){state.view=v; $$('.nav-item[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v)); $$('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+v));const meta={dashboard:['Overview','Dashboard'],calendar:['Plan','Calendar'],tasks:['Stay on top','Tasks'],subjects:['Study space','My Subjects'],notes:['Write & remember','Notes'],settings:['Personalize','Settings']}[v];$('#eyebrow').textContent=meta[0];$('#pageTitle').textContent=meta[1]; if(innerWidth<761)closeMobile(); render();}
function render(){renderBadge();({dashboard:renderDashboard,calendar:renderCalendar,tasks:renderTasks,subjects:renderSubjects,notes:renderNotes,settings:renderSettings}[state.view])()}
function renderBadge(){const n=state.tasks.tasks.filter(t=>t.status!=='Done'&&t.due&&t.due<today()).length;const b=$('#overdueBadge');b.hidden=!n;b.textContent=n}
function taskSubject(id){return state.settings.subjects.find(s=>s.id===id)?.name||'No subject'}
function taskDays(t){if(t.status==='Done')return['Completed','success'];if(!t.due)return['No due date',''];let d=Math.round((parse(t.due)-parse(today()))/86400000);if(d<0)return[`Overdue ${-d}d`,'danger'];if(d===0)return['Due today','warn'];if(d<=3)return[`Due in ${d}d`,'warn'];return[`Due in ${d}d`,'']}
function renderDashboard(){const root=$('#view-dashboard'), now=new Date(), open=state.tasks.tasks.filter(t=>t.status!=='Done'), due=open.filter(t=>t.due).sort((a,b)=>a.due.localeCompare(b.due)), events=state.calendar.events.filter(e=>e.date>=today()).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).slice(0,5), done=state.tasks.tasks.filter(t=>t.status==='Done').length;root.innerHTML=`<div class="hero"><div><div class="eyebrow">${fmtLong(today())}</div><h2>Plan less. Study smarter. ✨</h2><p>Your school life in one calm place — schedules, deadlines, subjects and lesson notes.</p></div><div class="hero-date">${now.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</div></div><div class="grid stats-grid section-gap"><div class="stat"><span class="label">Open tasks</span><div class="num">${open.length}</div><div class="sub">${done} completed overall</div></div><div class="stat"><span class="label">Due this week</span><div class="num">${due.filter(t=>(parse(t.due)-parse(today()))/86400000<=7).length}</div><div class="sub">Keep the next 7 days visible</div></div><div class="stat"><span class="label">Subjects</span><div class="num">${state.settings.subjects.filter(s=>s.name.trim()).length}</div><div class="sub">Each has its own notebook</div></div><div class="stat"><span class="label">Upcoming events</span><div class="num">${state.calendar.events.filter(e=>e.date>=today()).length}</div><div class="sub">Classes, exams and plans</div></div></div><div class="grid dashboard-grid"><div class="card"><div class="card-head"><h2>Upcoming deadlines</h2><button class="ghost" data-go="tasks">View tasks</button></div><div class="card-body"><div class="mini-list">${due.slice(0,6).map(t=>{const [x,c]=taskDays(t);return `<div class="list-row"><i class="dot"></i><div class="row-main"><b>${esc(t.task||'Untitled task')}</b><span>${esc(taskSubject(t.subject))} · ${fmtDate(t.due)}</span></div><span class="pill ${c}">${x}</span></div>`}).join('')||'<div class="empty">No upcoming deadlines. Enjoy the breathing room! 🌿</div>'}</div></div></div><div class="card"><div class="card-head"><h2>Next on your calendar</h2><button class="ghost" data-go="calendar">Open calendar</button></div><div class="card-body"><div class="mini-list">${events.map(e=>`<div class="list-row"><i class="dot" style="background:${esc(e.color||'#367e83')}"></i><div class="row-main"><b>${esc(e.title)}</b><span>${fmtDate(e.date)}${e.start?' · '+e.start:''}</span></div></div>`).join('')||'<div class="empty">No events yet. Add your first class or study plan.</div>'}</div></div></div></div><div class="section-gap card"><div class="card-head"><h2>Your subjects</h2><button class="ghost" data-go="subjects">Manage subjects</button></div><div class="card-body"><div class="subject-grid">${state.settings.subjects.slice(0,4).map((s,i)=>subjectCard(s,i)).join('')}</div></div></div>`}
function subjectCard(s,i){const count=state.tasks.tasks.filter(t=>t.subject===s.id&&t.status!=='Done').length;return `<div class="subject-card" data-subject="${s.id}" style="--subject-color:${['#367e83','#5d7cc5','#c77b30','#9a609b','#3b9270','#c45b64','#71829b','#aa8b32'][i%8]}"><div class="subject-icon">${i+1}</div><h3>${esc(s.name||'Unnamed subject')}</h3><p>Open your lesson notebook</p><span class="count">${count} open task${count===1?'':'s'}</span></div>`}
function eventOccursOn(e, key){
 const r=e.repeat||'none';
 if(!e.date || key<e.date) return false;
 if(r==='none') return key===e.date;
 const a=parse(e.date), b=parse(key), diff=Math.round((b-a)/86400000);
 if(diff<0) return false;
 if(r==='daily') return true;
 if(r==='weekly') return diff%7===0;
 if(r==='biweekly') return diff%14===0;
 if(r==='monthly') return a.getDate()===b.getDate();
 if(r==='yearly') return a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
 return false;
}
function calendarItems(key){
 const out=[];
 state.calendar.events.forEach(e=>{if(eventOccursOn(e,key))out.push({kind:'event',e})});
 if(state.calendar.showTasks!==false){
   state.tasks.tasks.forEach(t=>{if(t.due===key&&t.status!=='Done')out.push({kind:'task',t})});
 }
 return out;
}
function eventLabel(e){return `${e.start?e.start+' ':''}${e.repeat&&e.repeat!=='none'?'↻ ':''}${e.title}`}
function renderCalendar(){
 const root=$('#view-calendar'), mode=state.calMode||'month';
 const cursor=new Date(state.calCursor); cursor.setHours(0,0,0,0);
 let start, count=0, title='';
 if(mode==='week'){
   start=new Date(cursor); start.setDate(start.getDate()-start.getDay()); count=7;
   const end=new Date(start); end.setDate(end.getDate()+6);
   title=`${start.toLocaleDateString(undefined,{month:'short',day:'numeric'})} – ${end.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`;
 }else if(mode==='agenda'){
   start=new Date(cursor); count=30; title='Next 30 days';
 }else{
   const first=new Date(cursor.getFullYear(),cursor.getMonth(),1);
   start=new Date(first); start.setDate(1-first.getDay());
   const last=new Date(cursor.getFullYear(),cursor.getMonth()+1,0);
   count=Math.ceil((first.getDay()+last.getDate())/7)*7;
   title=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});
 }
 const q=(root.dataset.q||'').toLowerCase().trim();
 const matches=it=>!q||((it.kind==='task'?`${it.t.task} ${taskSubject(it.t.subject)} ${it.t.notes||''}`:`${it.e.title} ${it.e.notes||''}`).toLowerCase().includes(q));
 const modes=['month','week','agenda'];
 let body='';
 if(mode==='agenda'){
   let rows='';
   for(let i=0;i<count;i++){
     const d=new Date(start); d.setDate(start.getDate()+i); const k=iso(d);
     const items=calendarItems(k).filter(matches); if(!items.length) continue;
     rows+=`<div class="agenda-day"><div class="agenda-date ${k===today()?'today':''}">${d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</div>${items.map(it=>it.kind==='task'?`<div class="list-row calendar-item" data-calendar-task="1"><i class="dot" style="background:transparent;border:2px dashed var(--muted)"></i><div class="row-main"><b>📌 ${esc(it.t.task||'Untitled task')}</b><span>Task deadline${it.t.time?' · '+esc(it.t.time):''}</span></div></div>`:`<div class="list-row calendar-item" data-event="${it.e.id}" data-event-date="${k}"><i class="dot" style="background:${esc(it.e.color||'#367e83')}"></i><div class="row-main"><b>${esc(it.e.title)}</b><span>${it.e.start?esc(it.e.start)+(it.e.end?' – '+esc(it.e.end):''):'All day'}${it.e.repeat&&it.e.repeat!=='none'?' · repeats':''}${it.e.notes?' · '+esc(it.e.notes):''}</span></div><button class="ghost" data-event="${it.e.id}">Edit</button></div>`).join('')}</div>`;
   }
   body=`<div class="agenda">${rows||'<div class="empty">Nothing scheduled in this range.</div>'}</div>`;
 }else{
   const cells=[];
   for(let i=0;i<count;i++){
     const d=new Date(start); d.setDate(start.getDate()+i); const k=iso(d), items=calendarItems(k).filter(matches), muted=mode==='month'&&d.getMonth()!==cursor.getMonth();
     cells.push(`<div class="day ${muted?'muted':''} ${k===today()?'today':''}" data-day="${k}" tabindex="0" role="button"><div class="day-num">${d.getDate()}</div>${items.slice(0,mode==='week'?8:4).map(it=>it.kind==='task'?`<button class="event task-event" data-calendar-task="1">📌 ${esc(it.t.task||'Untitled')}</button>`:`<button class="event" data-event="${it.e.id}" data-event-date="${k}" style="border-left-color:${esc(it.e.color||'#367e83')}">${esc(eventLabel(it.e))}</button>`).join('')}${items.length>(mode==='week'?8:4)?`<span class="pill">+${items.length-(mode==='week'?8:4)} more</span>`:''}</div>`);
   }
   body=`<div class="calendar-wrap"><div class="calendar-head">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="dow">${x}</div>`).join('')}</div><div class="calendar-grid ${mode==='week'?'week-grid':''}">${cells.join('')}</div></div>`;
 }
 root.innerHTML=`<div class="toolbar calendar-toolbar"><div class="seg">${modes.map(x=>`<button class="${mode===x?'active':''}" data-cal="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div><button class="ghost" data-calstep="-1">‹</button><button class="ghost" data-caltoday>Today</button><button class="ghost" data-calstep="1">›</button><div class="calendar-title"><b>${esc(title)}</b></div><input class="input calendar-search" id="calendarSearch" value="${esc(q)}" placeholder="Search events…"><label class="calendar-check"><input type="checkbox" id="calendarShowTasks" ${state.calendar.showTasks!==false?'checked':''}> Task deadlines</label><button class="primary" data-add-event>+ Add event</button></div><div class="card calendar-card">${body}</div>`;
}
function renderAgenda(){ state.calMode='agenda'; renderCalendar(); }
function eventModal(ev=null,date=today()){
 openModal(ev?'Edit event':'Add event',`<div class="form-grid"><div class="field full"><label>Event title</label><input class="input" id="fTitle" value="${esc(ev?.title||'')}" placeholder="e.g. HCI class"></div><div class="field"><label>Date</label><input class="input" id="fDate" type="date" value="${ev?.date||date}"></div><div class="field"><label>Color</label><input class="input" id="fColor" type="color" value="${ev?.color||'#367e83'}"></div><div class="field"><label>Start time</label><input class="input" id="fStart" type="time" value="${ev?.start||''}"></div><div class="field"><label>End time</label><input class="input" id="fEnd" type="time" value="${ev?.end||''}"></div><div class="field full"><label>Repeat</label><select class="select" id="fRepeat"><option value="none" ${!ev?.repeat||ev?.repeat==='none'?'selected':''}>Does not repeat</option><option value="daily" ${ev?.repeat==='daily'?'selected':''}>Every day</option><option value="weekly" ${ev?.repeat==='weekly'?'selected':''}>Every week</option><option value="biweekly" ${ev?.repeat==='biweekly'?'selected':''}>Every other week</option><option value="monthly" ${ev?.repeat==='monthly'?'selected':''}>Every month</option><option value="yearly" ${ev?.repeat==='yearly'?'selected':''}>Every year</option></select></div><div class="field full"><label>Notes</label><textarea class="textarea" id="fNotes" rows="4" placeholder="Room, reminders, links…">${esc(ev?.notes||'')}</textarea></div></div>`,`${ev?'<button class="danger" id="deleteEvent">Delete</button>':''}<span style="flex:1"></span><button class="ghost" data-close>Cancel</button><button class="primary" id="saveEvent">${ev?'Save changes':'Save event'}</button>`);
 $('#saveEvent').onclick=()=>{const x={id:ev?.id||uid('e'),title:$('#fTitle').value.trim(),date:$('#fDate').value,start:$('#fStart').value,end:$('#fEnd').value,repeat:$('#fRepeat').value,notes:$('#fNotes').value.trim(),color:$('#fColor').value};if(!x.title||!x.date)return toast('Add a title and date first.');if(ev)Object.assign(ev,x);else state.calendar.events.push(x);save();$('#modalRoot').innerHTML='';render()};
 if(ev)$('#deleteEvent').onclick=()=>{state.calendar.events=state.calendar.events.filter(x=>x.id!==ev.id);save();$('#modalRoot').innerHTML='';render();toast('Event deleted')};
}
function renderTasks(){
 const root=$('#view-tasks');
 const q=(root.dataset.q||'').toLowerCase();
 const status=root.dataset.status||'';
 const pri=root.dataset.pri||'';
 const active=state.settings.subjects.some(s=>s.id===root.dataset.sheet)?root.dataset.sheet:'all';
 const base=state.tasks.tasks.filter(t=>(active==='all'||t.subject===active)&&(!q||(`${t.task} ${taskSubject(t.subject)} ${t.notes||''} ${t.resources||''} ${t.submission||''}`).toLowerCase().includes(q))&&(!status||t.status===status)&&(!pri||t.priority===pri)).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
 const subjectTabs=[`<button class="sheet-tab ${active==='all'?'active':''}" data-task-sheet="all">All tasks <span>${state.tasks.tasks.length}</span></button>`,...state.settings.subjects.map(s=>`<button class="sheet-tab ${active===s.id?'active':''}" data-task-sheet="${s.id}">${esc(s.name||'Unnamed subject')} <span>${state.tasks.tasks.filter(t=>t.subject===s.id).length}</span></button>`)].join('');
 root.innerHTML=`
 <div class="task-page-head"><div><div class="eyebrow">Task tracker</div><h2>Organized like a spreadsheet, easier to use</h2><p>Each subject has its own sheet, so you can track requirements without mixing everything together.</p></div><button class="primary" data-add-task>+ Add task</button></div>
 <div class="task-sheet-tabs" role="tablist">${subjectTabs}</div>
 <div class="toolbar task-tools"><input class="input" id="taskSearch" value="${esc(q)}" placeholder="Search this sheet…"><select class="select" id="taskStatus"><option value="">All statuses</option>${['Not Started','In Progress','Done'].map(x=>`<option ${status===x?'selected':''}>${x}</option>`).join('')}</select><select class="select" id="taskPriority"><option value="">All priorities</option>${['High','Medium','Low'].map(x=>`<option ${pri===x?'selected':''}>${x}</option>`).join('')}</select><span class="grow"></span><span class="pill">${base.length} shown</span><button class="ghost" data-clear-done>Clear completed</button></div>
 <div class="card task-sheet-card"><div class="sheet-caption"><div><b>${active==='all'?'All Subjects':esc(taskSubject(active))}</b><span>Click a task name or edit button to update details.</span></div><span class="pill">Auto-saved</span></div>
 <div class="sheet-scroll"><table class="task-sheet"><thead><tr><th>Subject & Tasks</th><th>TYPE</th><th>DATE ASSIGNED</th><th>DUE DATE</th><th>PRIORITY</th><th>PROGRESS / STATUS</th><th>DAYS LEFT</th><th>NOTES / LINK</th><th>TYPE OF SUBMISSION</th><th>NOTES AND RESOURCES</th><th class="actions-col"></th></tr></thead><tbody>${base.map(taskRow).join('')||`<tr><td colspan="11"><div class="empty">No tasks in this sheet yet. Click <b>+ Add task</b> to create one.</div></td></tr>`}</tbody></table></div></div>`;
}
function taskRow(t){
 const [days,dc]=taskDays(t);
 const subject=taskSubject(t.subject);
 const link=t.link?`<a class="sheet-link" href="${esc(t.link)}" target="_blank" rel="noopener">Open link ↗</a>`:'<span class="muted-cell">—</span>';
 return `<tr class="${t.status==='Done'?'row-done':''}">
 <td><div class="sheet-task"><input class="task-check" type="checkbox" data-taskdone="${t.id}" ${t.status==='Done'?'checked':''}><div><b>${esc(t.task||'Untitled task')}</b><span>${esc(subject)}</span><button class="mobile-details" data-row-details="${t.id}">View details</button></div></div><div class="row-details" id="details-${t.id}"><b>${esc(t.task||'Untitled task')}</b><div>Subject: ${esc(subject)}</div><div>Type: ${esc(t.type||'Assignment')}</div><div>Assigned: ${fmtDate(t.assigned||'')}</div><div>Due: ${fmtDate(t.due||'')}</div><div>Status: ${esc(t.status||'Not Started')}</div><div>Submission: ${esc(t.submission||'—')}</div><div>Notes: ${esc(t.notes||'—')}</div><div>Resources: ${esc(t.resources||'—')}</div>${t.link?`<a class="sheet-link" href="${esc(t.link)}" target="_blank" rel="noopener">Open link ↗</a>`:''}</div></td>
 <td><span class="cell-pill">${esc(t.type||'Assignment')}</span></td>
 <td>${fmtDate(t.assigned||'')}</td>
 <td><b>${fmtDate(t.due||'')}</b></td>
 <td><span class="priority ${String(t.priority||'Medium').toLowerCase()}">${esc(t.priority||'Medium')}</span></td>
 <td><select class="sheet-status" data-row-status="${t.id}">${['Not Started','In Progress','Done'].map(x=>`<option ${t.status===x?'selected':''}>${x}</option>`).join('')}</select></td>
 <td><span class="pill ${dc}">${days}</span></td>
 <td>${link}</td>
 <td>${esc(t.submission||'—')}</td>
 <td><div class="resource-cell">${esc(t.resources||'—')}</div></td>
 <td><button class="more-btn" data-edit-task="${t.id}" aria-label="Edit task">•••</button></td>
 </tr>`;
}
function taskCard(t){const [due,dc]=taskDays(t);return `<article class="task-card"><div class="task-top"><input class="task-check" type="checkbox" data-taskdone="${t.id}" ${t.status==='Done'?'checked':''}><div class="task-title ${t.status==='Done'?'done':''}">${esc(t.task||'Untitled task')}</div><button class="more-btn" data-edit-task="${t.id}">•••</button></div><div class="task-meta"><span class="pill">${esc(taskSubject(t.subject))}</span><span class="pill">${esc(t.type||'Task')}</span><span class="pill ${dc}">${due}</span><span class="pill">${esc(t.priority||'Medium')}</span></div><div class="task-foot"><span>${t.due?fmtDate(t.due):'No deadline'}</span><span>${t.status||'Not Started'}</span></div></article>`}
function taskModal(t=null){
 openModal(t?'Edit task':'Add task',`<div class="form-grid">
 <div class="field full"><label>Task / Requirement</label><input class="input" id="tfTask" value="${esc(t?.task||'')}" placeholder="e.g. Submit HCI wireframe"></div>
 <div class="field"><label>Subject</label><select class="select" id="tfSub">${state.settings.subjects.map(s=>`<option value="${s.id}" ${s.id===(t?.subject||state.settings.subjects[0]?.id)?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
 <div class="field"><label>Type</label><select class="select" id="tfType">${['Activity','Quiz','Assignment','Laboratory','Exam','Project','Presentation','Other'].map(x=>`<option ${x===(t?.type||'Assignment')?'selected':''}>${x}</option>`).join('')}</select></div>
 <div class="field"><label>Date assigned</label><input class="input" id="tfAssigned" type="date" value="${t?.assigned||today()}"></div>
 <div class="field"><label>Due date</label><input class="input" id="tfDue" type="date" value="${t?.due||''}"></div>
 <div class="field"><label>Priority</label><select class="select" id="tfPri">${['High','Medium','Low'].map(x=>`<option ${x===(t?.priority||'Medium')?'selected':''}>${x}</option>`).join('')}</select></div>
 <div class="field"><label>Progress / Status</label><select class="select" id="tfStatus">${['Not Started','In Progress','Done'].map(x=>`<option ${x===(t?.status||'Not Started')?'selected':''}>${x}</option>`).join('')}</select></div>
 <div class="field"><label>Type of submission</label><input class="input" id="tfSubmission" value="${esc(t?.submission||'')}" placeholder="e.g. PDF, handwritten, online"></div>
 <div class="field full"><label>Notes / Link (optional)</label><input class="input" id="tfLink" value="${esc(t?.link||'')}" placeholder="Optional Google Drive, LMS, GitHub or reference link"></div>
 <div class="field full"><label>Notes / instructions</label><textarea class="textarea" id="tfNotes" rows="3" placeholder="Teacher instructions, reminders, requirements…">${esc(t?.notes||'')}</textarea></div>
 <div class="field full"><label>Notes and resources</label><textarea class="textarea" id="tfResources" rows="3" placeholder="Files, reviewers, materials, links or things to bring…">${esc(t?.resources||'')}</textarea></div>
 </div>`,`${t?'<button class="danger" id="deleteTask">Delete</button>':''}<span style="flex:1"></span><button class="ghost" data-close>Cancel</button><button class="primary" id="saveTask">Save task</button>`);
 $('#saveTask').onclick=()=>{const x={id:t?.id||uid('t'),task:$('#tfTask').value.trim(),subject:$('#tfSub').value,type:$('#tfType').value,assigned:$('#tfAssigned').value||today(),due:$('#tfDue').value,priority:$('#tfPri').value,status:$('#tfStatus').value,link:$('#tfLink').value.trim(),submission:$('#tfSubmission').value.trim(),notes:$('#tfNotes').value.trim(),resources:$('#tfResources').value.trim()};if(!x.task)return toast('Give the task a name.');if(t)Object.assign(t,x);else state.tasks.tasks.push(x);save();$('#modalRoot').innerHTML='';render()};
 if(t)$('#deleteTask').onclick=()=>{state.tasks.tasks=state.tasks.tasks.filter(x=>x.id!==t.id);save();$('#modalRoot').innerHTML='';render();toast('Task deleted')};
}
function renderSubjects(){const root=$('#view-subjects');if(state.selectedSubject){renderNotebook();return}root.innerHTML=`<div class="toolbar"><div><b>8 subject notebooks</b><div style="color:var(--muted);font-size:11px">Keep lesson discussions, reviewers and important notes organized by subject.</div></div><span class="grow"></span><button class="primary" data-manage-subjects>Manage subjects</button></div><div class="subject-grid">${state.settings.subjects.map((s,i)=>subjectCard(s,i)).join('')}</div>`}
function renderNotebook(){const s=state.settings.subjects.find(x=>x.id===state.selectedSubject);if(!s){state.selectedSubject=null;return renderSubjects()}const nb=state.notes.subjects[s.id]||{id:s.id,name:s.name,body:'',notes:[]};state.notes.subjects[s.id]=nb;const notes=nb.notes||[];if(!state.selectedNote&&notes.length)state.selectedNote=notes[0].id;const n=notes.find(x=>x.id===state.selectedNote);$('#view-subjects').innerHTML=`<div class="toolbar"><button class="ghost" data-back-subjects>← All subjects</button><span class="grow"></span><button class="primary" data-new-lesson>+ New lesson</button></div><div class="card notebook"><aside class="notebook-side"><div class="eyebrow">Notebook</div><h2 style="margin:4px 0 12px;font-size:18px">${esc(s.name)}</h2><input class="input" id="lessonSearch" placeholder="Search lessons…"><div id="lessonList">${notes.map(x=>`<div class="note-item ${x.id===state.selectedNote?'active':''}" data-lesson="${x.id}"><b>${esc(x.title||'Untitled lesson')}</b><span>${esc((x.body||'').replace(/\s+/g,' ').slice(0,65))}</span></div>`).join('')||'<div class="empty">No lessons yet.</div>'}</div></aside><div class="notebook-main">${n?`<div class="notebook-top"><span class="pill">Lesson note</span><button class="danger" data-delete-lesson>Delete</button></div><input class="note-editor-title" id="lessonTitle" value="${esc(n.title||'')}" placeholder="Lesson title"><div style="color:var(--muted);font-size:11px;margin:5px 0 12px">${n.updated?'Last edited '+new Date(n.updated).toLocaleString():''}</div><textarea class="note-editor" id="lessonBody" placeholder="Write your lesson discussion here…\n\nYou can include key concepts, examples, questions, formulas and reminders.">${esc(n.body||'')}</textarea>`:`<div class="empty" style="margin-top:120px">Choose a lesson or click <b>+ New lesson</b> to start taking notes.</div>`}</div></div>`}
function newLesson(){const s=state.settings.subjects.find(x=>x.id===state.selectedSubject);const nb=state.notes.subjects[s.id]||{id:s.id,name:s.name,notes:[]};nb.notes??=[];const n={id:uid('n'),title:'New lesson',body:'',updated:Date.now()};nb.notes.unshift(n);state.notes.subjects[s.id]=nb;state.selectedNote=n.id;save();renderNotebook();setTimeout(()=>$('#lessonTitle')?.focus(),0)}
function renderNotes(){const root=$('#view-notes');root.innerHTML=`<div class="hero"><div><div class="eyebrow">Quick notes</div><h2>One place for the things you don't want to forget.</h2><p>Use subject notebooks for lessons. Use general notes here for reminders, ideas, checklists and anything that doesn't belong to one class.</p></div><button class="primary" data-new-general>+ New note</button></div><div class="card section-gap"><div class="card-head"><h2>General notes</h2><span class="pill">${state.notes.general?.length||0} notes</span></div><div class="card-body"><div class="task-grid">${(state.notes.general||[]).map(n=>`<div class="task-card" data-general="${n.id}"><div class="task-title">${esc(n.title||'Untitled')}</div><div style="font-size:11px;color:var(--muted);margin-top:8px">${esc((n.body||'').replace(/\s+/g,' ').slice(0,130))}</div></div>`).join('')||'<div class="empty" style="grid-column:1/-1">No general notes yet.</div>'}</div></div></div>`}
function generalModal(n=null){openModal(n?'Edit note':'New note',`<div class="field"><label>Title</label><input class="input" id="gnTitle" value="${esc(n?.title||'')}" placeholder="e.g. Things to remember"><label style="margin-top:10px">Note</label><textarea class="textarea" id="gnBody" rows="12" placeholder="Write anything…">${esc(n?.body||'')}</textarea></div>`,`${n?'<button class="danger" id="deleteGeneral">Delete</button>':''}<span style="flex:1"></span><button class="ghost" data-close>Cancel</button><button class="primary" id="saveGeneral">Save</button>`);$('#saveGeneral').onclick=()=>{state.notes.general??=[];const x={id:n?.id||uid('g'),title:$('#gnTitle').value.trim(),body:$('#gnBody').value,updated:Date.now()};if(!x.title)return toast('Add a title.');if(n)Object.assign(n,x);else state.notes.general.push(x);save();$('#modalRoot').innerHTML='';render()};if(n)$('#deleteGeneral').onclick=()=>{state.notes.general=state.notes.general.filter(x=>x.id!==n.id);save();$('#modalRoot').innerHTML='';render()}}
function renderSettings(){const root=$('#view-settings');root.innerHTML=`<div class="settings-grid"><div class="card settings-card"><h2>Subjects</h2><p>Rename your 8 subject spaces. Changes update your task and notebook labels too.</p>${state.settings.subjects.map((s,i)=>`<div class="subject-edit"><span class="pill">${i+1}</span><input class="input" data-subedit="${s.id}" value="${esc(s.name)}" placeholder="Subject name"></div>`).join('')}<button class="primary" style="margin-top:15px" data-save-subjects>Save subjects</button></div><div class="card settings-card"><h2>Appearance</h2><p>Choose a comfortable look for long study sessions.</p><div class="toolbar"><button class="ghost" data-theme="light">☀ Light</button><button class="ghost" data-theme="dark">☾ Dark</button><button class="ghost" data-theme="system">◐ System</button></div><h2 style="margin-top:25px">Backup</h2><p>Download your planner data or restore it on another device.</p><button class="primary" data-backup>Download backup</button><label class="ghost" style="display:inline-block;margin-left:6px">Restore<input id="restoreFile" type="file" accept="application/json" hidden></label></div></div>`}
function downloadBackup(){const blob=new Blob([JSON.stringify({calendar:state.calendar,tasks:state.tasks,notes:state.notes,settings:state.settings},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='school-planner-backup.json';a.click();URL.revokeObjectURL(a.href)}
function applyTheme(t){if(t==='system')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.body.classList.toggle('dark',t==='dark');state.settings.theme=state.settings.theme==='system'?'system':state.settings.theme;}
function closeMobile(){$('#sidebar').classList.remove('mobile-open');$('#scrim').classList.remove('show')}
function wire(){ $$('.nav-item[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('#sideCollapse').onclick=()=>$('#sidebar').classList.toggle('collapsed');$('#mobileMenu').onclick=()=>{$('#sidebar').classList.add('mobile-open');$('#scrim').classList.add('show')};$('#scrim').onclick=closeMobile;$('#quickAdd').onclick=()=>quickAdd();$('#globalSearchBtn').onclick=()=>quickSearch();$('#themeToggle').onclick=()=>{state.settings.theme=document.body.classList.contains('dark')?'light':'dark';document.body.classList.toggle('dark',state.settings.theme==='dark');save()};document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();quickSearch()}});}
function quickAdd(){openModal('What do you want to add?','<div class="grid" style="grid-template-columns:1fr 1fr"><button class="card" style="padding:25px;border:1px solid var(--line)" id="qaTask"><b>✓ Task</b><div style="color:var(--muted);font-size:11px;margin-top:5px">Add a deadline or school requirement</div></button><button class="card" style="padding:25px;border:1px solid var(--line)" id="qaEvent"><b>▦ Event</b><div style="color:var(--muted);font-size:11px;margin-top:5px">Add a class, exam or plan</div></button></div>');$('#qaTask').onclick=()=>taskModal();$('#qaEvent').onclick=()=>eventModal()}
function quickSearch(){openModal('Search your planner','<input class="input" id="globalQ" style="width:100%" placeholder="Search tasks, events and notes…"><div id="globalResults" style="margin-top:12px"></div>');const q=$('#globalQ');q.focus();q.oninput=()=>{const x=q.value.toLowerCase().trim();const r=[];state.tasks.tasks.forEach(t=>{if((t.task+' '+taskSubject(t.subject)+' '+(t.notes||'')).toLowerCase().includes(x))r.push(`<div class="list-row"><div class="row-main"><b>${esc(t.task)}</b><span>Task · ${esc(taskSubject(t.subject))}</span></div></div>`)});state.calendar.events.forEach(e=>{if((e.title+' '+(e.notes||'')).toLowerCase().includes(x))r.push(`<div class="list-row"><div class="row-main"><b>${esc(e.title)}</b><span>Event · ${fmtDate(e.date)}</span></div></div>`)});$('#globalResults').innerHTML=r.slice(0,12).join('')||'<div class="empty">No matches.</div>'}}

document.addEventListener('click',e=>{const sheet=e.target.closest('[data-task-sheet]');if(sheet){$('#view-tasks').dataset.sheet=sheet.dataset.taskSheet;renderTasks();return}const detail=e.target.closest('[data-row-details]');if(detail){const d=$('#details-'+detail.dataset.rowDetails);if(d)d.classList.toggle('show');return}const go=e.target.closest('[data-go]');if(go)return setView(go.dataset.go);const sub=e.target.closest('[data-subject]');if(sub){state.selectedSubject=sub.dataset.subject;state.selectedNote=null;setView('subjects');renderNotebook();return}if(e.target.closest('[data-calendar-task]')){setView('tasks');return}if(e.target.closest('[data-add-event]'))return eventModal();const day=e.target.closest('[data-day]');if(day&&!e.target.closest('[data-event]'))return eventModal(null,day.dataset.day);const ev=e.target.closest('[data-event]');if(ev){const x=state.calendar.events.find(a=>a.id===ev.dataset.event);if(x)eventModal(x);return}const cs=e.target.closest('[data-cal]');if(cs){state.calMode=cs.dataset.cal;renderCalendar();return}if(e.target.closest('[data-calstep]')){const n=+e.target.closest('[data-calstep]').dataset.calstep;if(state.calMode==='week')state.calCursor.setDate(state.calCursor.getDate()+n*7);else if(state.calMode==='agenda')state.calCursor.setDate(state.calCursor.getDate()+n*30);else state.calCursor=new Date(state.calCursor.getFullYear(),state.calCursor.getMonth()+n,1);renderCalendar();return}if(e.target.closest('[data-caltoday]')){state.calCursor=new Date();renderCalendar();return}if(e.target.closest('[data-add-task]'))return taskModal();const edit=e.target.closest('[data-edit-task]');if(edit){const t=state.tasks.tasks.find(x=>x.id===edit.dataset.editTask);if(t)taskModal(t);return}const done=e.target.closest('[data-taskdone]');if(done){const t=state.tasks.tasks.find(x=>x.id===done.dataset.taskdone);if(t){t.status=done.checked?'Done':'Not Started';save();render()};return}if(e.target.closest('[data-clear-done]')){state.tasks.tasks=state.tasks.tasks.filter(t=>t.status!=='Done');save();render();toast('Completed tasks cleared');return}if(e.target.closest('[data-manage-subjects]'))return setView('settings');if(e.target.closest('[data-back-subjects]')){state.selectedSubject=null;setView('subjects');return}if(e.target.closest('[data-new-lesson]'))return newLesson();const lesson=e.target.closest('[data-lesson]');if(lesson){state.selectedNote=lesson.dataset.lesson;renderNotebook();return}if(e.target.closest('[data-delete-lesson]')){const s=state.notes.subjects[state.selectedSubject];s.notes=s.notes.filter(n=>n.id!==state.selectedNote);state.selectedNote=s.notes[0]?.id||null;save();renderNotebook();return}if(e.target.closest('[data-new-general]'))return generalModal();const gen=e.target.closest('[data-general]');if(gen){const n=(state.notes.general||[]).find(x=>x.id===gen.dataset.general);if(n)generalModal(n);return}if(e.target.closest('[data-save-subjects]')){ $$('[data-subedit]').forEach(i=>{const s=state.settings.subjects.find(x=>x.id===i.dataset.subedit);if(s)s.name=i.value.trim()||s.name});syncSubjects();save();render();toast('Subjects updated');return}const th=e.target.closest('[data-theme]');if(th){state.settings.theme=th.dataset.theme;document.body.classList.toggle('dark',th.dataset.theme==='dark'||(th.dataset.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches));save();return}if(e.target.closest('[data-backup]'))return downloadBackup()});
document.addEventListener('input',e=>{if(e.target.id==='calendarSearch'){const r=$('#view-calendar');r.dataset.q=e.target.value;renderCalendar();return}if(e.target.id==='taskSearch'){const r=$('#view-tasks');r.dataset.q=e.target.value;renderTasks()}if(e.target.id==='lessonTitle'||e.target.id==='lessonBody'){const s=state.notes.subjects[state.selectedSubject],n=s?.notes?.find(x=>x.id===state.selectedNote);if(n){n.title=$('#lessonTitle').value;n.body=$('#lessonBody').value;n.updated=Date.now();save();}}});
document.addEventListener('change',e=>{if(e.target.id==='calendarShowTasks'){state.calendar.showTasks=e.target.checked;save();renderCalendar();return}const rs=e.target.closest('[data-row-status]');if(rs){const t=state.tasks.tasks.find(x=>x.id===rs.dataset.rowStatus);if(t){t.status=rs.value;save();renderTasks();}return}if(e.target.id==='taskStatus'){const r=$('#view-tasks');r.dataset.status=e.target.value;renderTasks()}if(e.target.id==='taskPriority'){const r=$('#view-tasks');r.dataset.pri=e.target.value;renderTasks()}if(e.target.id==='restoreFile'&&e.target.files[0]){const fr=new FileReader();fr.onload=()=>{try{const x=JSON.parse(fr.result);Object.assign(state,x);syncSubjects();save();render();toast('Backup restored')}catch{toast('That backup file is not valid.')}};fr.readAsText(e.target.files[0])}});
loadLocal();wire();setupFirebaseAuth();const theme=state.settings.theme==='dark'||(state.settings.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.body.classList.toggle('dark',theme);setView('dashboard');
})();
