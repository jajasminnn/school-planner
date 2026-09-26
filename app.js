(()=>{
'use strict';
const KEY='school-planner-v2';
const OLD={calendar:'school-planner-calendar',tasks:'school-planner-tasks',notes:'school-planner-notes'};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const state={view:'dashboard',calendar:{events:[],showTasks:true},tasks:{tasks:[],meta:{subjects:[]}},notes:{notes:[],subjects:{}},settings:{theme:'light',subjects:[],accent:'#367e83'},calCursor:new Date(),calMode:'month',selectedSubject:null,selectedNote:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const iso=d=>{d=new Date(d);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const parse=s=>new Date(s+'T00:00:00');
const TASK_TYPES=['Activity','Quiz','Assignment','Laboratory','Exam','Project','Presentation','Other'];
const PRIORITIES=['High','Medium','Low'];
const STATUSES=['Not Started','In Progress','Done'];
const SUBMISSION_TYPES=['Google Forms','G-Drive','G-Classroom','E-mabini Portal','Padlet'];
const SUBJECT_COLORS=['#367e83','#5d7cc5','#c77b30','#9a609b','#3b9270','#c45b64','#71829b','#aa8b32'];
function subjectColor(id){const i=state.settings.subjects.findIndex(s=>s.id===id);return i>-1?SUBJECT_COLORS[i%8]:'#367e83'}
const today=()=>iso(new Date());
const fmtDate=s=>s?parse(s).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'No date';
const fmtLong=s=>s?parse(s).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}):'';
const fmtTime=t=>{if(!t)return '';const [H,M]=t.split(':').map(Number);if(isNaN(H))return '';const ap=H>=12?'PM':'AM';let h=H%12;if(h===0)h=12;return h+':'+String(M).padStart(2,'0')+' '+ap};
function tintColor(hex,a){const h=(hex||'#367e83').replace('#','');const n=parseInt(h,16)||0x367e83,r=(n>>16)&255,g=(n>>8)&255,b=n&255;return `rgba(${r},${g},${b},${a})`}
function applyAccentColor(hex){hex=/^#[0-9a-fA-F]{6}$/.test(hex||'')?hex:'#367e83';document.body.style.setProperty('--accent',hex);document.body.style.setProperty('--accent-soft',tintColor(hex,.14))}
function to12(t){if(!t)return {h:'',m:'',ap:'AM'};const [H,M]=t.split(':').map(Number);const ap=H>=12?'PM':'AM';let h=H%12;if(h===0)h=12;return {h:String(h),m:String(M).padStart(2,'0'),ap}}
function to24(h,m,ap){h=parseInt(h||'12',10);if(isNaN(h)||h<1)h=12;if(h>12)h=12;m=parseInt(m||'0',10);if(isNaN(m)||m<0)m=0;if(m>59)m=59;if(ap==='PM'&&h<12)h+=12;if(ap==='AM'&&h===12)h=0;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')}
/* ---- Clock time picker: one reusable component for the event form's Start time and End time ----
   Only the UI changes. Values are still stored as the same "HH:MM" 24-hour strings ('' = no time),
   converted with to12()/to24() exactly like the old hh:mm AM/PM inputs. */
const CLOCK_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const fmtClock=v=>{if(!v)return '';const p=to12(v);return `${p.h}:${p.m} ${p.ap}`};
const shiftTime=(v,mins)=>{const [H,M]=v.split(':').map(Number);const t=((H*60+M+mins)%1440+1440)%1440;return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0')};
const nextFullHour=()=>String((new Date().getHours()+1)%24).padStart(2,'0')+':00';
function clockFieldHtml(id,value,label,tooltip=''){
  return `<button type="button" class="clock-field ${value?'':'is-empty'}" id="${id}" data-value="${esc(value||'')}" data-label="${esc(label)}"${tooltip?` title="${esc(tooltip)}"`:''} aria-haspopup="dialog" aria-expanded="false" aria-label="${esc(label)}: ${value?fmtClock(value):'not set'}">${CLOCK_ICON}<span class="clock-field-text">${value?fmtClock(value):'Set time'}</span><svg class="clock-field-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`;
}
function readClockField(id){return $('#'+id)?.dataset.value||''}
function setClockField(el,value){
  el.dataset.value=value||'';el.classList.toggle('is-empty',!value);
  el.querySelector('.clock-field-text').textContent=value?fmtClock(value):'Set time';
  el.setAttribute('aria-label',`${el.dataset.label}: ${value?fmtClock(value):'not set'}`);
}
// suggest(): the time to start from when the field is empty (e.g. End time = Start time + 1 hour).
function bindClockField(el,{suggest}={}){el.addEventListener('click',()=>openTimePicker(el,{suggest}))}
let closeTimePicker=()=>{};
function openTimePicker(field,{suggest}={}){
  closeTimePicker();
  const label=field.dataset.label||'Time',had=field.dataset.value;
  const p=to12(had||(suggest&&suggest())||'09:00');
  let hour=+p.h,minute=+p.m,ap=p.ap,mode='hour',angle=null,drag=null;
  const layer=document.createElement('div');layer.className='tp-layer';
  layer.innerHTML=`<div class="tp" role="dialog" aria-modal="true" aria-label="Choose ${esc(label.toLowerCase())}">
    <div class="tp-display"><button type="button" class="tp-step" data-step="-1">−</button><button type="button" class="tp-part" data-part="hour"></button><span class="tp-colon" aria-hidden="true">:</span><button type="button" class="tp-part" data-part="minute"></button><span class="tp-period" aria-hidden="true"></span><button type="button" class="tp-step" data-step="1">+</button></div>
    <p class="tp-hint" id="tpHint"></p>
    <div class="tp-clock" tabindex="0" role="slider" aria-describedby="tpHint"><div class="tp-ticks" aria-hidden="true">${Array.from({length:60},(_,i)=>i%5?`<i style="--a:${i*6}deg"></i>`:'').join('')}</div><div class="tp-nums" aria-hidden="true"></div><div class="tp-hand" aria-hidden="true"><i></i></div><div class="tp-center" aria-hidden="true"></div></div>
    <div class="seg tp-ampm" role="radiogroup" aria-label="AM or PM"><button type="button" role="radio" data-ap="AM">AM</button><button type="button" role="radio" data-ap="PM">PM</button></div>
    <div class="tp-foot">${had?'<button type="button" class="tp-clear" data-tp-clear>Clear time</button>':''}<span class="grow"></span><button type="button" class="ghost" data-tp-cancel>Cancel</button><button type="button" class="primary" data-tp-done>Done</button></div>
  </div>`;
  document.body.appendChild(layer);
  const tp=layer.querySelector('.tp'),clock=tp.querySelector('.tp-clock'),nums=tp.querySelector('.tp-nums'),hand=tp.querySelector('.tp-hand');
  const pad=n=>String(n).padStart(2,'0');
  function update(){
    const hp=tp.querySelector('[data-part="hour"]'),mp=tp.querySelector('[data-part="minute"]');
    hp.textContent=hour;mp.textContent=pad(minute);tp.querySelector('.tp-period').textContent=ap;
    hp.classList.toggle('is-active',mode==='hour');mp.classList.toggle('is-active',mode==='minute');
    hp.setAttribute('aria-pressed',String(mode==='hour'));mp.setAttribute('aria-pressed',String(mode==='minute'));
    hp.setAttribute('aria-label',`Hour, ${hour}. Change hour`);mp.setAttribute('aria-label',`Minutes, ${pad(minute)}. Change minutes`);
    nums.querySelectorAll('.tp-num').forEach(n=>n.classList.toggle('is-selected',mode==='hour'?+n.dataset.v===hour:+n.dataset.v===minute));
    // Rotate the hand the short way round (e.g. 55 → 00 moves forward, not all the way back).
    const target=mode==='hour'?(hour%12)*30:minute*6;
    angle=angle==null?target:target+360*Math.round((angle-target)/360);
    hand.style.setProperty('--angle',angle+'deg');
    hand.classList.toggle('off-number',mode==='minute'&&minute%5!==0);
    clock.setAttribute('aria-label',mode==='hour'?'Hour':'Minutes');
    clock.setAttribute('aria-valuemin',mode==='hour'?'1':'0');clock.setAttribute('aria-valuemax',mode==='hour'?'12':'59');
    clock.setAttribute('aria-valuenow',String(mode==='hour'?hour:minute));
    clock.setAttribute('aria-valuetext',`${hour}:${pad(minute)} ${ap}`);
    tp.querySelector('#tpHint').textContent=mode==='hour'?'Tap the hour, or type it':'Tap between numbers for exact minutes';
    clock.classList.toggle('is-minute',mode==='minute');
    const unit=mode==='hour'?'hour':'minute';
    tp.querySelector('[data-step="-1"]').setAttribute('aria-label',`One ${unit} earlier`);tp.querySelector('[data-step="1"]').setAttribute('aria-label',`One ${unit} later`);
    tp.querySelectorAll('.tp-ampm button').forEach(b=>{const on=b.dataset.ap===ap;b.classList.toggle('active',on);b.setAttribute('aria-checked',String(on))});
  }
  function setMode(m){
    mode=m;
    const vals=mode==='hour'?[12,1,2,3,4,5,6,7,8,9,10,11]:[0,5,10,15,20,25,30,35,40,45,50,55];
    nums.innerHTML=vals.map((v,i)=>`<span class="tp-num" data-v="${v}" style="--a:${i*30}deg">${mode==='hour'?v:pad(v)}</span>`).join('');
    nums.classList.remove('is-entering');void nums.offsetWidth;nums.classList.add('is-entering');
    update();
  }
  function pick(e,snap){
    const r=clock.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
    const deg=(Math.atan2(dx,-dy)*180/Math.PI+360)%360;
    if(mode==='hour')hour=Math.round(deg/30)%12||12;
    else{
      let m=Math.round(deg/6)%60;
      // A tap on a number (00, 05 … 55) picks that number; a tap anywhere else picks the exact minute.
      if(snap){const near=Math.round(m/5)*5%60,a=near*6*Math.PI/180,R=r.width/2-26;
        if(Math.hypot(dx-R*Math.sin(a),dy+R*Math.cos(a))<=14)m=near}
      minute=m;
    }
    update();
  }
  function step(n){if(mode==='hour')hour=((hour-1+n)%12+12)%12+1;else minute=((minute+n)%60+60)%60;update()}
  // Typing: hour "6" or "1","1"; minutes "2","3" → :23. Digits typed within ~1s of each other combine.
  let typed='',typedAt=0;
  function typeDigit(d){
    if(Date.now()-typedAt>1200)typed='';typedAt=Date.now();typed+=d;
    if(mode==='hour'){
      if(typed.length===1){if(d==='0'){typed='';return}hour=+d;update();if(d!=='1'){typed='';setMode('minute')}return}
      const n=+typed;hour=n>=10&&n<=12?n:(+d||hour);typed='';update();setMode('minute');
    }else{
      if(typed.length===1){minute=+d;update();return}
      const n=+typed;minute=n<=59?n:+d;typed='';update();
    }
  }
  tp.addEventListener('keydown',e=>{if(/^[0-9]$/.test(e.key)&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();typeDigit(e.key)}});
  tp.querySelectorAll('.tp-step').forEach(b=>b.onclick=()=>step(+b.dataset.step));
  // Tap a number to pick it, tap between numbers for an exact minute, or drag round the face.
  clock.addEventListener('pointerdown',e=>{e.preventDefault();clock.focus();try{clock.setPointerCapture(e.pointerId)}catch{}drag={x:e.clientX,y:e.clientY,moved:false};clock.classList.add('is-dragging');pick(e,false)});
  clock.addEventListener('pointermove',e=>{if(!drag)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6)drag.moved=true;pick(e,false)});
  const endDrag=(e,apply)=>{if(!drag)return;if(apply)pick(e,!drag.moved);drag=null;clock.classList.remove('is-dragging');if(apply&&mode==='hour')setTimeout(()=>{if(layer.isConnected)setMode('minute')},180)};
  clock.addEventListener('pointerup',e=>endDrag(e,true));
  clock.addEventListener('pointercancel',e=>endDrag(e,false));
  clock.addEventListener('keydown',e=>{
    const by={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1,PageUp:5,PageDown:-5}[e.key];
    if(by){e.preventDefault();step(mode==='hour'?Math.sign(by):by);return}
    if(e.key==='Enter'||e.key===' '){e.preventDefault();if(mode==='hour')setMode('minute');else tp.querySelector('[data-tp-done]').focus()}
  });
  tp.querySelectorAll('.tp-part').forEach(b=>b.onclick=()=>{setMode(b.dataset.part);clock.focus()});
  tp.querySelectorAll('.tp-ampm button').forEach(b=>b.onclick=()=>{ap=b.dataset.ap;update()});
  function close(value){
    // value undefined = cancel (leave the field unchanged); '' = cleared; 'HH:MM' = confirmed.
    if(value!==undefined){setClockField(field,value);field.dispatchEvent(new Event('change',{bubbles:true}))}
    layer.remove();field.setAttribute('aria-expanded','false');
    removeEventListener('resize',place);document.removeEventListener('keydown',onKey,true);
    closeTimePicker=()=>{};field.focus();
  }
  closeTimePicker=()=>close();
  tp.querySelector('[data-tp-done]').onclick=()=>close(to24(hour,minute,ap));
  tp.querySelector('[data-tp-cancel]').onclick=()=>close();
  tp.querySelector('[data-tp-clear]')?.addEventListener('click',()=>close(''));
  // Clicking outside only cancels the unconfirmed choice; nothing is saved until Done.
  layer.addEventListener('click',e=>{if(e.target===layer)close()});
  function onKey(e){
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return}
    if(e.key==='Tab'){const f=[...tp.querySelectorAll('button,[tabindex="0"]')];const i=f.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus()}}
  }
  document.addEventListener('keydown',onKey,true);
  // Desktop: a compact popover next to the field. Phones: a centred sheet.
  function place(){
    const small=innerWidth<600;layer.classList.toggle('is-sheet',small);
    if(small){tp.style.left=tp.style.top='';return}
    const r=field.getBoundingClientRect(),w=tp.offsetWidth,h=tp.offsetHeight;
    let top=r.bottom+8;if(top+h>innerHeight-12)top=r.top-h-8;if(top<12)top=Math.max(12,(innerHeight-h)/2);
    tp.style.left=Math.min(Math.max(12,r.left),innerWidth-w-12)+'px';tp.style.top=top+'px';
  }
  addEventListener('resize',place);
  field.setAttribute('aria-expanded','true');
  setMode('hour');place();clock.focus();
}
function autoGrow(el){if(!el)return;el.style.height='auto';el.style.height=el.scrollHeight+'px'}
/* ---- Notebook: rich text editor + local file attachments (IndexedDB) ---- */
const FILES_DB='school-planner-files',FILES_STORE='attachments';
let currentGeneralNote=null;
function openFilesDB(){return new Promise((res,rej)=>{if(!('indexedDB' in window))return rej(new Error('no indexeddb'));const r=indexedDB.open(FILES_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(FILES_STORE))r.result.createObjectStore(FILES_STORE,{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function putFileBlob(id,blob,name,type){const db=await openFilesDB();return new Promise((res,rej)=>{const tx=db.transaction(FILES_STORE,'readwrite');tx.objectStore(FILES_STORE).put({id,blob,name,type});tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
async function getFileBlob(id){const db=await openFilesDB();return new Promise((res,rej)=>{const tx=db.transaction(FILES_STORE,'readonly');const rq=tx.objectStore(FILES_STORE).get(id);rq.onsuccess=()=>res(rq.result);rq.onerror=()=>rej(rq.error)})}
async function deleteFileBlob(id){try{const db=await openFilesDB();await new Promise((res,rej)=>{const tx=db.transaction(FILES_STORE,'readwrite');tx.objectStore(FILES_STORE).delete(id);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}catch{}}
function humanSize(n){if(!n&&n!==0)return '';if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(0)+' KB';return (n/1048576).toFixed(1)+' MB'}
function fileKind(type,name){type=type||'';name=(name||'').toLowerCase();if(type.startsWith('image/'))return 'image';if(type==='application/pdf'||name.endsWith('.pdf'))return 'pdf';if(/\.(docx?|rtf)$/.test(name)||type.includes('word'))return 'doc';if(/\.(pptx?|key)$/.test(name)||type.includes('presentation'))return 'ppt';if(/\.(xlsx?|csv)$/.test(name)||type.includes('sheet'))return 'sheet';if(/\.(zip|rar|7z)$/.test(name))return 'zip';return 'file'}
const FILE_ICONS={image:'🖼️',pdf:'📕',doc:'📄',ppt:'📊',sheet:'📈',zip:'🗜️',file:'📎'};
function stripHtml(html){const d=document.createElement('div');d.innerHTML=html||'';return d.textContent||''}
function relTime(ts){if(!ts)return '';const s=Math.round((Date.now()-ts)/1000);if(s<45)return 'just now';if(s<3600)return Math.round(s/60)+'m ago';if(s<86400)return Math.round(s/3600)+'h ago';if(s<604800)return Math.round(s/86400)+'d ago';return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric'})}
function editorToolbarHtml(idp){return `<div class="editor-toolbar" data-target="${idp}Body"><button type="button" data-cmd="bold" title="Bold"><b>B</b></button><button type="button" data-cmd="italic" title="Italic"><i>I</i></button><button type="button" data-cmd="underline" title="Underline"><u>U</u></button><button type="button" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button><span class="tb-sep"></span><button type="button" data-cmd="formatBlock" data-val="H2" title="Heading">H2</button><button type="button" data-cmd="formatBlock" data-val="H3" title="Subheading">H3</button><button type="button" data-cmd="formatBlock" data-val="P" title="Paragraph">¶</button><span class="tb-sep"></span><button type="button" data-cmd="insertUnorderedList" title="Bullet list">☰</button><button type="button" data-cmd="insertOrderedList" title="Numbered list">1.</button><button type="button" data-cmd="formatBlock" data-val="BLOCKQUOTE" title="Quote">❝</button><span class="tb-sep"></span><button type="button" data-cmd="createLink" title="Add link">🔗</button><button type="button" data-cmd="removeFormat" title="Clear formatting">Tx</button></div>`}
function attachmentsHtml(note,prefix){const list=note.attachments||[];return `<div class="attach-panel" data-attach-owner="${prefix}"><div class="attach-head"><span>📎 Attachments${list.length?' ('+list.length+')':''}</span><label class="ghost attach-add">+ Add file<input type="file" multiple hidden class="attach-input" data-attach-target="${prefix}"></label></div><div class="attach-list">${list.map(a=>`<div class="attach-chip" data-attach-id="${a.id}"><span class="attach-icon">${FILE_ICONS[fileKind(a.type,a.name)]}</span><span class="attach-name" title="${esc(a.name)}">${esc(a.name)}</span><span class="attach-size">${humanSize(a.size)}</span><button type="button" class="attach-open" data-attach-open="${a.id}" title="Open">↗</button><button type="button" class="attach-remove" data-attach-remove="${a.id}" title="Remove">✕</button></div>`).join('')||'<div class="attach-empty">No files attached yet. Lecture slides, PDFs and images stay saved on this device.</div>'}</div></div>`}
function refreshAttachPanel(prefix,note){const panel=document.querySelector(`.attach-panel[data-attach-owner="${prefix}"]`);if(panel)panel.outerHTML=attachmentsHtml(note,prefix)}
function resolveNote(prefix){if(prefix==='lesson'){const s=state.notes.subjects[state.selectedSubject];return (s&&s.notes&&s.notes.find(x=>x.id===state.selectedNote))||null}if(prefix==='gn')return currentGeneralNote;return null}
let cloudUser=null;
let cloudLoaded=false;
let cloudSaveTimer=null;
let authSeq=0;
const firebaseServices=window.schoolPlannerFirebase||{};
const auth=firebaseServices.auth||null;
const db=firebaseServices.db||null;
// Planner data created before per-account storage belongs to this account only.
const LEGACY_OWNER_EMAIL='jsmntmsqt@gmail.com';
const THEME_KEY='school-planner-theme';
const GUEST_KEY=KEY+':guest';
const isLegacyOwner=user=>(user?.email||'').toLowerCase()===LEGACY_OWNER_EMAIL;
const localKey=()=>cloudUser?KEY+':'+cloudUser.uid:GUEST_KEY;
const cloudRef=()=>cloudUser&&db?db.collection('users').doc(cloudUser.uid).collection('planner').doc('main'):null;
const plannerPayload=()=>({owner:cloudUser.uid,calendar:state.calendar,tasks:state.tasks,notes:state.notes,settings:state.settings,savedAt:state.savedAt||0,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
// Set on every edit and cleared once the cloud has it. If the page is refreshed or closed before the upload
// finishes, the next load sees this and keeps this device's newer copy instead of the older cloud one.
const unsyncedKey=()=>localKey()+':unsynced';
function markUnsynced(on){try{on?localStorage.setItem(unsyncedKey(),'1'):localStorage.removeItem(unsyncedKey())}catch{}}
function hasUnsynced(){try{return localStorage.getItem(unsyncedKey())==='1'}catch{return false}}
// The sidebar indicator, mirrored next to "Last edited" in whichever lesson or note editor is open.
function setSaveStatus(text){const e=$('#saveIndicator');if(e)e.innerHTML=`<i></i><span>${esc(text)}</span>`;document.querySelectorAll('.note-save-status').forEach(x=>x.textContent=text)}
function readLocal(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function writeLocal(){
  try{localStorage.setItem(localKey(),JSON.stringify({calendar:state.calendar,tasks:state.tasks,notes:state.notes,settings:state.settings,savedAt:state.savedAt||0}));localStorage.setItem(THEME_KEY,state.settings.theme||'light')}
  catch{if(!writeLocal.warned){writeLocal.warned=true;toast('This browser’s storage is full, so recent edits may not be kept here. Remove large pictures from your notes.')}}
}
function save(){
  state.savedAt=Date.now();
  if(cloudUser)markUnsynced(true);
  writeLocal();
  if(cloudUser&&cloudLoaded&&db){
    // Offline, the upload waits until the connection is back; the local copy is already written.
    setSaveStatus(navigator.onLine?'Saving…':'Offline · saved on this device');
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer=setTimeout(()=>{cloudSaveTimer=null;saveToCloud()},500);
  }else setSaveStatus('Saved on this device');
}
let cloudSavesInFlight=0;
async function saveToCloud(){
  const ref=cloudRef();
  if(!ref||!cloudLoaded)return false;
  cloudSavesInFlight++;
  try{
    await ref.set(plannerPayload());
    // Only say "Saved" once no newer edit is still waiting or uploading.
    if(cloudSavesInFlight===1&&!cloudSaveTimer){markUnsynced(false);setSaveStatus('Saved to cloud')}
    return true;
  }catch(err){
    console.error('Cloud save failed:',err);
    setSaveStatus('Saved on this device');
    // The whole planner is one cloud record, capped at 1 MB; pictures in notes are what usually fill it.
    toast(err?.code==='invalid-argument'&&/size|bytes/i.test(err.message||'')
      ?'Your planner is too big to sync (pictures take the most room). It’s still saved on this device.'
      :'Cloud save failed — your local copy is safe.');
    return false;
  }finally{cloudSavesInFlight--}
}
// Explicit Save buttons: write locally and upload right away instead of waiting for the autosave debounce.
// Resolves true when the cloud copy is up to date (or there is no cloud to save to).
async function saveNow(){
  save();
  if(!(cloudUser&&cloudLoaded&&db))return true;
  clearTimeout(cloudSaveTimer);cloudSaveTimer=null;
  return saveToCloud();
}
// Hiding or closing the tab: upload a pending autosave now instead of waiting out the typing pause,
// so the last few keystrokes still reach the cloud.
function flushCloudSave(){if(cloudSaveTimer){clearTimeout(cloudSaveTimer);cloudSaveTimer=null;saveToCloud()}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushCloudSave()});
addEventListener('pagehide',flushCloudSave);
/* ---- Pictures in notes ----
 The planner syncs to the cloud as one record capped at 1 MB, which a few pictures fill. So each picture gets
 its own record (users/{uid}/planner/img-<id>, which the existing Firestore rules already allow) and a copy
 in this browser's IndexedDB. A note's stored text keeps only <img data-img="<id>">; the picture is filled
 in when the note is shown (hydrateImages). */
const IMG_MAX_SIDE=1200,IMG_QUALITY=.82,IMG_TARGET=700*1024,IMG_CLOUD_MAX=1000*1000,IMG_PREFIX='img-';
const imgCache=new Map();// id -> data URL, for this page
const imgRef=id=>cloudUser&&db?db.collection('users').doc(cloudUser.uid).collection('planner').doc(IMG_PREFIX+id):null;
const readDataUrl=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(f)});
// At most 1200px on the longest side, as JPEG, stepping down until it is comfortably under the cloud limit.
async function shrinkDataUrl(src){
 const type=src.slice(5,src.indexOf(';'));
 // Small GIFs and SVGs stay as they are so animations and sharp vector lines survive.
 if((type==='image/gif'||type==='image/svg+xml')&&src.length<400*1024)return src;
 const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('unreadable image'));i.src=src});
 let small='';
 for(const [side,q] of [[IMG_MAX_SIDE,IMG_QUALITY],[1000,.7],[800,.6]]){
  const scale=Math.min(1,side/Math.max(img.naturalWidth,img.naturalHeight));
  const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);// JPEG has no transparency
  ctx.drawImage(img,0,0,w,h);
  small=c.toDataURL('image/jpeg',q);
  // A picture that was already small can come out bigger as JPEG; keep the original then.
  if(scale===1&&src.length<=small.length&&src.length<=IMG_TARGET)return src;
  if(small.length<=IMG_TARGET)break;
 }
 return small;
}
const pendingKey=()=>localKey()+':pending-images';
function pendingImages(){try{return JSON.parse(localStorage.getItem(pendingKey())||'[]')}catch{return[]}}
function setPending(id,on){const ids=new Set(pendingImages());on?ids.add(id):ids.delete(id);try{ids.size?localStorage.setItem(pendingKey(),JSON.stringify([...ids])):localStorage.removeItem(pendingKey())}catch{}}
async function uploadImage(id,src){
 if(!cloudUser)return;
 if(src.length>IMG_CLOUD_MAX){setPending(id,false);return toast('One picture is too big to sync, so it stays on this device only.')}
 const ref=imgRef(id);
 if(!ref||!cloudLoaded)return setPending(id,true);// uploaded once the cloud is ready (flushPendingImages)
 setPending(id,true);
 try{await ref.set({owner:cloudUser.uid,kind:'image',data:src,createdAt:firebase.firestore.FieldValue.serverTimestamp()});setPending(id,false)}
 catch(err){console.error('Picture upload failed:',err)}
}
async function flushPendingImages(){for(const id of pendingImages()){const src=await loadImageSrc(id,false);if(src)await uploadImage(id,src);else setPending(id,false)}}
addEventListener('online',()=>{if(cloudLoaded)flushPendingImages()});
// Gives a picture its id right away (so the note's text never has to hold it) and saves it in the background:
// on this device first, then shrunk if it wasn't already, then to the cloud. onSmall gets the shrunk version.
function adoptImage(src,alreadyShrunk=false,onSmall){
 const id=uid('');imgCache.set(id,src);
 putFileBlob(IMG_PREFIX+id,src,'','image').catch(()=>{});
 (alreadyShrunk?Promise.resolve(src):shrinkDataUrl(src)).then(small=>{
  if(small!==src){imgCache.set(id,small);putFileBlob(IMG_PREFIX+id,small,'','image').catch(()=>{});onSmall?.(small)}
  uploadImage(id,small);
 }).catch(()=>uploadImage(id,src));
 return id;
}
async function loadImageSrc(id,fromCloud=true){
 if(imgCache.has(id))return imgCache.get(id);
 try{const rec=await getFileBlob(IMG_PREFIX+id);if(rec?.blob){imgCache.set(id,rec.blob);return rec.blob}}catch{}
 const ref=fromCloud&&imgRef(id);if(!ref)return null;
 try{
  const snap=await ref.get(),src=snap.exists?snap.data().data:null;
  if(src){imgCache.set(id,src);putFileBlob(IMG_PREFIX+id,src,'','image').catch(()=>{})}
  return src;
 }catch{return null}
}
function hydrateImages(root){
 root?.querySelectorAll('img[data-img]:not([src])').forEach(async img=>{
  const src=await loadImageSrc(img.dataset.img);
  if(src)img.src=src;else{img.alt='Picture not available on this device yet';img.classList.add('img-missing')}
 });
}
// A note's text as stored: pictures keep only their id. A picture still held in the text itself (pasted as
// part of a larger block, or added before pictures had their own records) is given one here.
function editorBodyHtml(editor){
 editor.querySelectorAll('img[src^="data:"]:not([data-img])').forEach(img=>{img.dataset.img=adoptImage(img.src,false,small=>{if(img.isConnected)img.src=small})});
 const c=editor.cloneNode(true);c.querySelectorAll('img[data-img]').forEach(i=>i.removeAttribute('src'));return c.innerHTML;
}
// Moves pictures out of every saved note's text. Returns true if any note changed.
function moveInlineImages(){
 let changed=false;
 const fix=n=>{if(!n?.body?.includes('src="data:'))return;const d=document.createElement('div');d.innerHTML=n.body;n.body=editorBodyHtml(d);changed=true};
 Object.values(state.notes.subjects||{}).forEach(s=>(s.notes||[]).forEach(fix));
 (state.notes.general||[]).forEach(fix);
 return changed;
}
// Replace the whole planner with `data` (or a blank planner when data is empty).
function applyData(data){
  const theme=state.settings?.theme||readLocal(THEME_KEY)||'light';
  state.calendar={events:[],showTasks:true};
  state.tasks={tasks:[],meta:{subjects:[]}};
  state.notes={notes:[],subjects:{}};
  state.settings={theme,subjects:[],accent:'#367e83'};
  state.selectedSubject=null;state.selectedNote=null;
  state.savedAt=data?.savedAt||0;
  if(data){
    if(data.calendar)state.calendar=data.calendar;
    if(data.tasks)state.tasks=data.tasks;
    if(data.notes)state.notes=data.notes;
    if(data.settings)state.settings=data.settings;
  }
  state.calendar.events??=[];state.tasks.tasks??=[];state.notes.subjects??={};
  if(!Array.isArray(state.settings.subjects))state.settings.subjects=[];
  if(!state.settings.subjects.length)state.settings.subjects=Array.from({length:8},(_,i)=>({id:'s'+(i+1),name:`Subject ${i+1}`}));
  if(!state.settings.accent)state.settings.accent='#367e83';
  syncSubjects();
}
function refreshUI(){
  applyTheme(state.settings.theme||'light');
  applyAccentColor(state.settings.accent);
  render();
}
// Data saved on this device before accounts had separate storage (only ever offered to the legacy owner).
function legacyLocalData(){
  const x=readLocal(KEY);
  if(x)return x;
  applyData(null);migrate();
  return {calendar:state.calendar,tasks:state.tasks,notes:state.notes,settings:state.settings};
}
async function loadCloudForUser(user){
  const seq=++authSeq;
  cloudUser=user; cloudLoaded=false;
  updateAuthUI(user);
  applyData(readLocal(localKey()));
  refreshUI();
  setSaveStatus('Loading cloud data…');
  try{
    const snap=await cloudRef().get();
    if(seq!==authSeq)return;
    const owner=isLegacyOwner(user);
    let needsWrite=false,keptLocal=false;
    if(snap.exists){
      const x=snap.data()||{};
      if(x.owner===user.uid||(!x.owner&&owner)){
        // Edits made on this device that never reached the cloud (the page was refreshed or closed
        // mid-upload, or the upload failed) are newer than the cloud copy: keep them and upload them.
        const local=readLocal(localKey());
        keptLocal=!!local&&hasUnsynced()&&(local.savedAt||0)>(x.savedAt||0);
        applyData(keptLocal?local:x);
        needsWrite=!x.owner||keptLocal;
        if(!keptLocal)markUnsynced(false);
      }else{
        // Old bug copied another account's planner into this one. Start this account fresh.
        applyData(null);
        needsWrite=true;
      }
    }else{
      if(owner)applyData(readLocal(localKey())||legacyLocalData());
      needsWrite=true;
    }
    cloudLoaded=true;
    // Pictures still inside notes' text are what pushes the planner over the cloud limit: move them out.
    if(moveInlineImages()){state.savedAt=Date.now();markUnsynced(true);needsWrite=true}
    writeLocal();
    const uploaded=needsWrite?await saveToCloud():true;
    flushPendingImages();
    if(seq!==authSeq)return;
    if(owner)try{localStorage.removeItem(KEY)}catch{}
    setSaveStatus(!uploaded?'Saved on this device':snap.exists&&!keptLocal?'Synced from cloud':'Saved to cloud');
    if(keptLocal&&uploaded)toast('Restored your latest edits from this device.');
    refreshUI();
  }catch(err){
    if(seq!==authSeq)return;
    console.error('Cloud load failed:',err);
    cloudLoaded=false;
    setSaveStatus('Saved on this device');
    toast('Firebase is connected, but Firestore access needs its security rules.');
    refreshUI();
  }
}
/* ---- Auth gate: the planner is only rendered for a signed-in user ---- */
const SESSION_HINT='jasync-session';
const VIEWS=['dashboard','calendar','tasks','subjects','notes','settings'];
let appOpen=false, leaving=false;
function openApp(){
  if(appOpen)return;
  appOpen=true;
  try{localStorage.setItem(SESSION_HINT,'1')}catch{}
  const v=location.hash.slice(1);
  setView(VIEWS.includes(v)?v:'dashboard');
  document.body.classList.remove('auth-pending');
}
// Hide and wipe the planner, then send the visitor to the public landing page.
// keepDestination remembers the page they tried to open so login can return them there.
function leaveApp(keepDestination,page='index.html'){
  if(leaving)return;
  leaving=true;appOpen=false;
  ++authSeq;
  cloudUser=null;cloudLoaded=false;
  clearTimeout(cloudSaveTimer);cloudSaveTimer=null;
  document.body.classList.add('auth-pending');
  applyData(null);
  $$('.view').forEach(v=>v.innerHTML='');
  $('#modalRoot').innerHTML='';
  try{localStorage.removeItem(SESSION_HINT)}catch{}
  const dest=VIEWS.includes(location.hash.slice(1))?'app.html'+location.hash:'app.html';
  location.replace(keepDestination?page+(page.includes('?')?'&':'?')+'next='+encodeURIComponent(dest):page);
}
// 30 days after signing in on this browser (see session.js): save anything pending, sign out,
// and send the user to the login page with a short explanation.
let expiring=false;
async function expireSession(user){
  if(expiring)return;
  expiring=true;
  if(cloudSaveTimer){clearTimeout(cloudSaveTimer);cloudSaveTimer=null;await saveToCloud();}
  await window.jasyncSession.endIfExpired(auth,user);
  leaveApp(true,'login.html?expired=1');
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
async function handleAuthClick(){
  if(!auth){toast('Firebase could not be initialized.');return;}
  if(auth.currentUser){
    try{
      if(cloudSaveTimer){clearTimeout(cloudSaveTimer);cloudSaveTimer=null;await saveToCloud();}
      const uid=auth.currentUser.uid;
      await auth.signOut();
      window.jasyncSession?.clear(uid);
      leaveApp(false);
    }catch(err){console.error(err);toast('Could not sign out.');}
    return;
  }
  location.href='login.html';
}
function setupFirebaseAuth(){
  updateAuthUI(auth?.currentUser||null);
  $('#authButton')?.addEventListener('click',handleAuthClick);
  if(!auth){leaveApp(true);return;}
  setSaveStatus('Loading…');
  auth.onAuthStateChanged(user=>{
    if(!user){if(expiring)return;return leaveApp(true);}
    // Check the 30-day limit before loading or showing anything.
    if(window.jasyncSession?.isExpired(user))return expireSession(user);
    if(user.uid!==cloudUser?.uid){loadCloudForUser(user);openApp();}
  });
  // A tab left open can cross the 30-day mark; check again whenever the user comes back to it.
  document.addEventListener('visibilitychange',()=>{const u=auth.currentUser;if(!document.hidden&&u&&window.jasyncSession?.isExpired(u))expireSession(u)});
  // Back/Forward can restore this page from the browser's page cache; re-check who is signed in.
  addEventListener('pageshow',e=>{if(e.persisted&&!auth.currentUser){leaving=false;leaveApp(false);}});
}
function migrate(){let old={}; try{for(const [k,v] of Object.entries(OLD)){const x=JSON.parse(localStorage.getItem(v)||'null'); if(x)old[k]=x}}catch{}; if(old.calendar)state.calendar=old.calendar; if(old.tasks){state.tasks=old.tasks;state.settings.subjects=(old.tasks.meta?.subjects||[]).map(x=>({id:x.id,name:x.name||''}))}; if(old.notes){state.notes={notes:old.notes.notes||[],subjects:{}}; (old.notes.folders||[]).forEach(f=>{state.notes.subjects[f.id]={id:f.id,name:f.name,body:''}})}; if(!state.settings.subjects?.length){state.settings.subjects=Array.from({length:8},(_,i)=>({id:'s'+(i+1),name:`Subject ${i+1}`}))}}
// Startup shows a blank planner, then loads the signed-in account's own data (or the guest planner when signed out).
function syncSubjects(){state.tasks.meta=state.tasks.meta||{};state.tasks.meta.subjects=state.settings.subjects.map(s=>({id:s.id,name:s.name}));state.notes.subjects=state.notes.subjects||{};state.settings.subjects.forEach(s=>{if(!state.notes.subjects[s.id])state.notes.subjects[s.id]={id:s.id,name:s.name,body:'',notes:[]};state.notes.subjects[s.id].name=s.name});}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1800)}
function openModal(title,body,actions=''){const root=$('#modalRoot');root.innerHTML=`<div class="modal-backdrop" id="backdrop"><div class="modal"><div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-close>×</button></div><div class="modal-body">${body}</div>${actions?`<div class="modal-foot">${actions}</div>`:''}</div></div>`;$('#backdrop').addEventListener('click',e=>{if(e.target.id==='backdrop'||e.target.closest('[data-close]'))root.innerHTML=''})}
function setView(v){state.view=v; $$('.nav-item[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v)); $$('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+v));const meta={dashboard:['Overview','Dashboard'],calendar:['Plan','Calendar'],tasks:['Stay on top','Tasks'],subjects:['Study space','My Subjects'],notes:['Write & remember','Notes'],settings:['Personalize','Settings']}[v];$('#eyebrow').textContent=meta[0];$('#pageTitle').textContent=meta[1]; if(innerWidth<761)closeMobile(); render();}
function render(){renderBadge();({dashboard:renderDashboard,calendar:renderCalendar,tasks:renderTasks,subjects:renderSubjects,notes:renderNotes,settings:renderSettings}[state.view])()}
function renderBadge(){const n=state.tasks.tasks.filter(t=>t.status!=='Done'&&t.due&&t.due<today()).length;const b=$('#overdueBadge');b.hidden=!n;b.textContent=n}
function taskSubject(id){return state.settings.subjects.find(s=>s.id===id)?.name||'No subject'}
function taskDays(t){if(t.status==='Done')return['Completed','success'];if(!t.due)return['No due date',''];let d=Math.round((parse(t.due)-parse(today()))/86400000);if(d<0)return[`Overdue ${-d}d`,'danger'];if(d===0){if(t.time){const due=new Date(t.due+'T'+t.time);if(due<new Date())return['Past deadline','danger'];return[`Due today · ${fmtTime(t.time)}`,'warn']}return['Due today','warn']}if(d<=3)return[`Due in ${d}d`,'warn'];return[`Due in ${d}d`,'']}
function renderDashboard(){const root=$('#view-dashboard'), now=new Date(), open=state.tasks.tasks.filter(t=>t.status!=='Done'), due=open.filter(t=>t.due).sort((a,b)=>(a.due+(a.time||'24:00')).localeCompare(b.due+(b.time||'24:00'))), events=state.calendar.events.filter(e=>e.date>=today()).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).slice(0,5), done=state.tasks.tasks.filter(t=>t.status==='Done').length;root.innerHTML=`<div class="hero"><div><div class="eyebrow">${fmtLong(today())}</div><h2>Your acads. All synced. ✨</h2><p>Your school life in one calm place — schedules, deadlines, subjects and lesson notes.</p></div><div class="hero-date">${now.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</div></div><div class="grid stats-grid section-gap"><div class="stat"><span class="label">Open tasks</span><div class="num">${open.length}</div><div class="sub">${done} completed overall</div></div><div class="stat"><span class="label">Due this week</span><div class="num">${due.filter(t=>(parse(t.due)-parse(today()))/86400000<=7).length}</div><div class="sub">Keep the next 7 days visible</div></div><div class="stat"><span class="label">Subjects</span><div class="num">${state.settings.subjects.filter(s=>s.name.trim()).length}</div><div class="sub">Each has its own notebook</div></div><div class="stat"><span class="label">Upcoming events</span><div class="num">${state.calendar.events.filter(e=>e.date>=today()).length}</div><div class="sub">Classes, exams and plans</div></div></div><div class="grid dashboard-grid"><div class="card"><div class="card-head"><h2>Upcoming deadlines</h2><button class="ghost" data-go="tasks">View tasks</button></div><div class="card-body"><div class="mini-list">${due.slice(0,6).map(t=>{const [x,c]=taskDays(t);return `<div class="list-row"><i class="dot"></i><div class="row-main"><b>${esc(t.task||'Untitled task')}</b><span>${esc(taskSubject(t.subject))} · ${fmtDate(t.due)}${t.time?' · '+fmtTime(t.time):''}</span></div><span class="pill ${c}">${x}</span></div>`}).join('')||'<div class="empty">No upcoming deadlines. Enjoy the breathing room! 🌿</div>'}</div></div></div><div class="card"><div class="card-head"><h2>Next on your calendar</h2><button class="ghost" data-go="calendar">Open calendar</button></div><div class="card-body"><div class="mini-list">${events.map(e=>`<div class="list-row"><i class="dot" style="background:${esc(e.color||'#367e83')}"></i><div class="row-main"><b>${esc(e.title)}</b><span>${fmtDate(e.date)}${e.start?' · '+fmtTime(e.start):''}</span></div></div>`).join('')||'<div class="empty">No events yet. Add your first class or study plan.</div>'}</div></div></div></div><div class="section-gap card"><div class="card-head"><h2>Your subjects</h2><button class="ghost" data-go="subjects">Manage subjects</button></div><div class="card-body"><div class="subject-grid">${state.settings.subjects.slice(0,4).map((s,i)=>subjectCard(s,i)).join('')}</div></div></div>`}
// info (optional, from subjectInfo) swaps the generic line for the lesson count and last edit (My Subjects overview).
function subjectCard(s,i,info){const count=state.tasks.tasks.filter(t=>t.subject===s.id&&t.status!=='Done').length;return `<div class="subject-card" data-subject="${s.id}"${info?` role="button" tabindex="0" aria-label="Open ${esc(s.name||'Unnamed subject')} notebook"`:''} style="--subject-color:${SUBJECT_COLORS[i%8]}"><div class="subject-icon">${i+1}</div><h3>${esc(s.name||'Unnamed subject')}</h3><p>${info?info.text:'Open your lesson notebook'}</p><span class="count">${count} open task${count===1?'':'s'}</span></div>`}
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
function eventLabel(e){return `${e.start?fmtTime(e.start)+' ':''}${e.repeat&&e.repeat!=='none'?'↻ ':''}${e.title}`}
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
     rows+=`<div class="agenda-day"><div class="agenda-date ${k===today()?'today':''}">${d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</div>${items.map(it=>it.kind==='task'?`<div class="list-row calendar-item" data-calendar-task="1"><i class="dot" style="background:transparent;border:2px dashed var(--muted)"></i><div class="row-main"><b>📌 ${esc(it.t.task||'Untitled task')}</b><span>Task deadline${it.t.time?' · '+esc(fmtTime(it.t.time)):''}</span></div></div>`:`<div class="list-row calendar-item" data-event="${it.e.id}" data-event-date="${k}"><i class="dot" style="background:${esc(it.e.color||'#367e83')}"></i><div class="row-main"><b>${esc(it.e.title)}</b><span>${it.e.start?esc(fmtTime(it.e.start))+(it.e.end?' – '+esc(fmtTime(it.e.end)):''):'All day'}${it.e.subject?' · '+esc(taskSubject(it.e.subject)):''}${it.e.repeat&&it.e.repeat!=='none'?' · repeats':''}${it.e.notes?' · '+esc(it.e.notes):''}</span></div><button class="ghost" data-event="${it.e.id}">Edit</button></div>`).join('')}</div>`;
   }
   body=`<div class="agenda">${rows||'<div class="empty">Nothing scheduled in this range.</div>'}</div>`;
 }else{
   const cells=[];
   for(let i=0;i<count;i++){
     const d=new Date(start); d.setDate(start.getDate()+i); const k=iso(d), items=calendarItems(k).filter(matches), muted=mode==='month'&&d.getMonth()!==cursor.getMonth();
     cells.push(`<div class="day ${muted?'muted':''} ${k===today()?'today':''}" data-day="${k}" tabindex="0" role="button"><div class="day-num">${d.getDate()}</div>${items.slice(0,mode==='week'?8:4).map(it=>it.kind==='task'?`<button class="event task-event" data-calendar-task="1">📌 ${esc(it.t.task||'Untitled')}</button>`:`<button class="event" data-event="${it.e.id}" data-event-date="${k}" style="background:${tintColor(it.e.color,.22)};border-left-color:${esc(it.e.color||'#367e83')}" title="${esc(eventLabel(it.e))}${it.e.subject?' • '+esc(taskSubject(it.e.subject)):''}">${esc(eventLabel(it.e))}</button>`).join('')}${items.length>(mode==='week'?8:4)?`<span class="pill">+${items.length-(mode==='week'?8:4)} more</span>`:''}</div>`);
   }
   body=`<div class="calendar-wrap"><div class="calendar-head">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="dow">${x}</div>`).join('')}</div><div class="calendar-grid ${mode==='week'?'week-grid':''}">${cells.join('')}</div></div>`;
 }
 root.innerHTML=`<div class="toolbar calendar-toolbar"><div class="seg">${modes.map(x=>`<button class="${mode===x?'active':''}" data-cal="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div><button class="ghost" data-calstep="-1">‹</button><button class="ghost" data-caltoday>Today</button><button class="ghost" data-calstep="1">›</button><div class="calendar-title"><b>${esc(title)}</b></div><input class="input calendar-search" id="calendarSearch" value="${esc(q)}" placeholder="Search events…"><label class="calendar-check"><input type="checkbox" id="calendarShowTasks" ${state.calendar.showTasks!==false?'checked':''}> Task deadlines</label><button class="ghost" data-export-cal title="Add your schedule to Google, Apple or Outlook calendar">⇩ Export</button><button class="primary" data-add-event>+ Add event</button></div><div class="card calendar-card">${body}</div>`;
}
function renderAgenda(){ state.calMode='agenda'; renderCalendar(); }
function eventModal(ev=null,date=today()){
 const initialMode=ev&&ev.subject&&taskSubject(ev.subject)===ev.title?'subject':'custom';
 openModal(ev?'Edit event':'Add event',`<div class="form-grid"><div class="field full"><label>Event title</label><div class="seg title-mode-seg" style="margin-bottom:8px"><button type="button" class="${initialMode==='subject'?'active':''}" data-title-mode="subject">Choose a subject</button><button type="button" class="${initialMode==='custom'?'active':''}" data-title-mode="custom">Customize</button></div><select class="select" id="fTitleSubject" ${initialMode==='subject'?'':'hidden'}><option value="">Choose subject…</option>${state.settings.subjects.map(s=>`<option value="${s.id}" ${s.id===ev?.subject?'selected':''}>${esc(s.name||'Unnamed subject')}</option>`).join('')}</select><input class="input" id="fTitle" ${initialMode==='custom'?'':'hidden'} value="${esc(ev?.title||'')}" placeholder="e.g. HCI class, Study session"></div><div class="field"><label>Date</label><input class="input" id="fDate" type="date" value="${ev?.date||date}"></div><div class="field"><label>Color</label><input class="input" id="fColor" type="color" value="${ev?.color||(ev?.subject?subjectColor(ev.subject):'#367e83')}"><div class="color-swatches">${SUBJECT_COLORS.map(c=>`<button type="button" class="swatch" data-color="${c}" style="background:${c}" aria-label="Use color ${c}" title="${c}"></button>`).join('')}</div></div><div class="field"><label for="fStart">Start time</label>${clockFieldHtml('fStart',ev?.start||'','Start time')}</div><div class="field"><label for="fEnd">End time</label>${clockFieldHtml('fEnd',ev?.end||'','End time')}</div><div class="field full"><label>Repeat</label><select class="select" id="fRepeat"><option value="none" ${!ev?.repeat||ev?.repeat==='none'?'selected':''}>Does not repeat</option><option value="daily" ${ev?.repeat==='daily'?'selected':''}>Every day</option><option value="weekly" ${ev?.repeat==='weekly'?'selected':''}>Every week</option><option value="biweekly" ${ev?.repeat==='biweekly'?'selected':''}>Every other week</option><option value="monthly" ${ev?.repeat==='monthly'?'selected':''}>Every month</option><option value="yearly" ${ev?.repeat==='yearly'?'selected':''}>Every year</option></select></div><div class="field full"><label>Notes</label><textarea class="textarea" id="fNotes" rows="4" placeholder="Room, reminders, links…">${esc(ev?.notes||'')}</textarea></div></div>`,`${ev?'<button class="danger" id="deleteEvent">Delete</button><button class="ghost" id="icsEvent" title="Download this event for your phone or computer calendar">Add to my calendar</button>':''}<span style="flex:1"></span><button class="ghost" data-close>Cancel</button><button class="primary" id="saveEvent">${ev?'Save changes':'Save event'}</button>`);
 // Empty Start time opens at the next full hour; empty End time opens one hour after the start.
 bindClockField($('#fStart'),{suggest:nextFullHour});
 bindClockField($('#fEnd'),{suggest:()=>shiftTime(readClockField('fStart')||nextFullHour(),60)});
 let titleMode=initialMode;
 $$('.title-mode-seg button').forEach(b=>b.onclick=()=>{
   titleMode=b.dataset.titleMode;
   $$('.title-mode-seg button').forEach(x=>x.classList.toggle('active',x===b));
   $('#fTitleSubject').hidden=titleMode!=='subject';
   $('#fTitle').hidden=titleMode!=='custom';
   (titleMode==='subject'?$('#fTitleSubject'):$('#fTitle')).focus();
 });
 $('#fTitleSubject').onchange=()=>{const id=$('#fTitleSubject').value;if(id)$('#fColor').value=subjectColor(id)};
 $$('.color-swatches .swatch').forEach(b=>{
   if(b.dataset.color.toLowerCase()===$('#fColor').value.toLowerCase())b.classList.add('active');
   b.onclick=()=>{$('#fColor').value=b.dataset.color;$$('.color-swatches .swatch').forEach(x=>x.classList.toggle('active',x===b))};
 });
 $('#saveEvent').onclick=()=>{
   let title,subject;
   if(titleMode==='subject'){
     subject=$('#fTitleSubject').value;
     if(!subject)return toast('Choose a subject first.');
     title=taskSubject(subject);
   }else{
     title=$('#fTitle').value.trim();
     subject=ev?.subject||'';
   }
   const st=readClockField('fStart'), en=readClockField('fEnd');
   if(st&&en&&en<st)return toast('End time must be after the start time.');
   const x={id:ev?.id||uid('e'),title,subject,date:$('#fDate').value,start:st,end:en,repeat:$('#fRepeat').value,notes:$('#fNotes').value.trim(),color:$('#fColor').value};
   if(!x.title||!x.date)return toast('Add a title and date first.');
   if(ev)Object.assign(ev,x);else state.calendar.events.push(x);
   save();$('#modalRoot').innerHTML='';render();
 };
 if(ev)$('#deleteEvent').onclick=()=>{state.calendar.events=state.calendar.events.filter(x=>x.id!==ev.id);save();$('#modalRoot').innerHTML='';render();toast('Event deleted')};
 if(ev)$('#icsEvent').onclick=()=>{downloadIcs([icsEvent(ev)],icsFileName(ev.title));toast('Calendar file downloaded')};
}
/* ---- Export to the device calendar (.ics, works with Google, Apple and Outlook calendars) ----
   Times are written as "floating" local times, so a 9:00 AM class stays 9:00 AM in the device's time zone.
   Each item keeps a stable UID, so apps that support it update an event on re-import instead of duplicating it. */
const ICS_REPEAT={daily:'FREQ=DAILY',weekly:'FREQ=WEEKLY',biweekly:'FREQ=WEEKLY;INTERVAL=2',monthly:'FREQ=MONTHLY',yearly:'FREQ=YEARLY'};
const icsText=s=>String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
const icsDate=d=>d.replace(/-/g,'');
const icsDateTime=(d,t)=>icsDate(d)+'T'+t.replace(':','')+'00';
function icsNextDay(d){const x=parse(d);x.setDate(x.getDate()+1);return iso(x)}
// Lines longer than 75 bytes must be folded; count UTF-8 bytes so emoji and accented letters are never split.
function icsFold(line){
 const enc=new TextEncoder();let out='',cur='',size=0;
 for(const ch of line){const n=enc.encode(ch).length;if(size+n>(out?74:75)){out+=(out?'\r\n ':'')+cur;cur='';size=0}cur+=ch;size+=n}
 return out+(out?'\r\n ':'')+cur;
}
function icsEvent(e){
 const lines=[`UID:${e.id}@jasync`,`SUMMARY:${icsText(e.title)}`];
 if(e.start){
   lines.push(`DTSTART:${icsDateTime(e.date,e.start)}`);
   // No usable end time: default to one hour, like the calendar's own time picker.
   const end=e.end&&e.end>e.start?e.end:shiftTime(e.start,60);
   lines.push(end>e.start?`DTEND:${icsDateTime(e.date,end)}`:`DTEND:${icsDateTime(icsNextDay(e.date),end)}`);
 }else lines.push(`DTSTART;VALUE=DATE:${icsDate(e.date)}`,`DTEND;VALUE=DATE:${icsDate(icsNextDay(e.date))}`);
 if(ICS_REPEAT[e.repeat])lines.push('RRULE:'+ICS_REPEAT[e.repeat]);
 const desc=[e.subject&&taskSubject(e.subject)!==e.title?'Subject: '+taskSubject(e.subject):'',e.notes].filter(Boolean).join('\n');
 if(desc)lines.push('DESCRIPTION:'+icsText(desc));
 return lines;
}
function icsTask(t){
 const lines=[`UID:${t.id}@jasync-task`,`SUMMARY:${icsText('📌 '+(t.task||'Untitled task')+(t.subject?' – '+taskSubject(t.subject):''))}`];
 // A deadline is a moment, not a block of time: timed deadlines get no end.
 if(t.time)lines.push(`DTSTART:${icsDateTime(t.due,t.time)}`);
 else lines.push(`DTSTART;VALUE=DATE:${icsDate(t.due)}`,`DTEND;VALUE=DATE:${icsDate(icsNextDay(t.due))}`);
 lines.push('DESCRIPTION:'+icsText(['Task deadline from JASync',t.priority?'Priority: '+t.priority:'',t.notes].filter(Boolean).join('\n')));
 return lines;
}
function icsFileName(title){return (String(title||'event').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'event')+'.ics'}
function downloadIcs(items,name){
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//JASync//School Planner//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:JASync',
   ...items.flatMap(x=>['BEGIN:VEVENT','DTSTAMP:'+stamp,...x,'END:VEVENT']),'END:VCALENDAR'];
 const blob=new Blob([lines.map(icsFold).join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}),a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function exportCalendarModal(){
 const events=state.calendar.events.filter(e=>e.title&&e.date);
 const tasks=state.tasks.tasks.filter(t=>t.due&&t.status!=='Done');
 openModal('Export to your device calendar',`<p class="export-lead">Download your schedule as a calendar file, then open it on your phone or computer to add it to Google Calendar, Apple Calendar or Outlook.</p><div class="export-summary"><div><b>${events.length}</b><span>event${events.length===1?'':'s'}</span></div><div><b>${tasks.length}</b><span>open task deadline${tasks.length===1?'':'s'}</span></div></div><label class="calendar-check export-check"><input type="checkbox" id="icsTasks" ${tasks.length?'checked':'disabled'}> Include task deadlines</label><details class="export-help"><summary>How do I add it to my calendar?</summary><ul><li><b>iPhone / iPad:</b> open the downloaded file and tap <i>Add All</i>.</li><li><b>Android / Google Calendar:</b> on a computer, open Google Calendar → Settings → Import &amp; export, then choose the file.</li><li><b>Outlook:</b> open the file, or go to Add calendar → Upload from file.</li></ul><p>This is a one-time copy. After changing your schedule, export again to update it; Apple Calendar and Outlook update existing events, Google Calendar may add a second copy.</p></details>`,`<span style="flex:1"></span><button class="ghost" data-close>Cancel</button><button class="primary" id="icsDownload" ${events.length||tasks.length?'':'disabled'}>Download .ics file</button>`);
 $('#icsDownload').onclick=()=>{
   const items=[...events.map(icsEvent),...($('#icsTasks').checked?tasks.map(icsTask):[])];
   if(!items.length)return toast('Nothing to export yet.');
   downloadIcs(items,'jasync-calendar.ics');
   $('#modalRoot').innerHTML='';toast(`Exported ${items.length} item${items.length===1?'':'s'}`);
 };
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
 <div class="card task-sheet-card"><div class="sheet-caption"><div><b>${active==='all'?'All Subjects':esc(taskSubject(active))}</b><span>Type straight into any cell, just like a spreadsheet — it saves automatically.</span></div><span class="pill">Auto-saved</span></div>
 <div class="sheet-scroll"><table class="task-sheet"><thead><tr><th>Subject & Tasks</th><th>TYPE</th><th>DATE ASSIGNED</th><th>DUE DATE</th><th>DEADLINE</th><th>PRIORITY</th><th>PROGRESS / STATUS</th><th>DAYS LEFT</th><th>NOTES / LINK</th><th>TYPE OF SUBMISSION</th><th>NOTES AND RESOURCES</th><th class="actions-col"></th></tr></thead><tbody>${base.map(taskRow).join('')||`<tr><td colspan="12"><div class="empty">No tasks in this sheet yet. Click <b>+ Add task</b> to create one.</div></td></tr>`}</tbody></table></div></div>`;
 root.querySelectorAll('.task-name').forEach(autoGrow);
}
function submissionCellHtml(t,forceOther){
 const known=SUBMISSION_TYPES.includes(t.submission);
 const showOther=!!forceOther||(!!t.submission&&!known);
 const selVal=showOther?'Other':(known?t.submission:'');
 return `<div class="submission-cell"><select class="cell-select" data-field="submission"><option value="" ${selVal===''?'selected':''}>Choose…</option>${SUBMISSION_TYPES.map(x=>`<option ${selVal===x?'selected':''}>${x}</option>`).join('')}<option value="Other" ${selVal==='Other'?'selected':''}>Other</option></select>${showOther?`<input class="cell-input" data-field="submissionOther" value="${esc(t.submission)}" placeholder="Type submission method">`:''}</div>`;
}
function taskRow(t){
 const [days,dc]=taskDays(t);
 const isUrl=/^https?:\/\//i.test(t.link||'');
 return `<tr class="${t.status==='Done'?'row-done':''}" data-task-id="${t.id}">
 <td><div class="sheet-task"><input class="task-check" type="checkbox" data-taskdone="${t.id}" ${t.status==='Done'?'checked':''}><div class="sheet-task-main"><select class="cell-select" data-field="subject">${state.settings.subjects.map(s=>`<option value="${s.id}" ${s.id===t.subject?'selected':''}>${esc(s.name||'Unnamed subject')}</option>`).join('')}</select><textarea class="cell-input task-name" data-field="task" rows="1" placeholder="Task or requirement — paste full instructions here">${esc(t.task)}</textarea></div></div><div class="row-details" id="details-${t.id}"><label>Teacher instructions / notes</label><textarea class="cell-textarea" data-field="notes" rows="3" placeholder="Instructions, reminders, requirements…">${esc(t.notes||'')}</textarea></div></td>
 <td><select class="cell-select" data-field="type">${TASK_TYPES.map(x=>`<option ${x===(t.type||'Activity')?'selected':''}>${x}</option>`).join('')}</select></td>
 <td><input class="cell-input" type="date" data-field="assigned" value="${esc(t.assigned||'')}"></td>
 <td><input class="cell-input" type="date" data-field="due" value="${esc(t.due||'')}"></td>
 <td>${clockFieldHtml('tf-'+t.id,t.time||'','Deadline time','Edit deadline time')}</td>
 <td><select class="cell-select priority ${String(t.priority||'Medium').toLowerCase()}" data-field="priority">${PRIORITIES.map(x=>`<option ${x===(t.priority||'Medium')?'selected':''}>${x}</option>`).join('')}</select></td>
 <td><select class="sheet-status" data-field="status">${STATUSES.map(x=>`<option ${t.status===x?'selected':''}>${x}</option>`).join('')}</select></td>
 <td><span class="pill ${dc}">${days}</span></td>
 <td><div class="link-cell"><input class="cell-input" data-field="link" value="${esc(t.link)}" placeholder="Paste link or note">${isUrl?`<a class="sheet-link-btn" href="${esc(t.link)}" target="_blank" rel="noopener" title="Open link">↗</a>`:''}</div></td>
 <td>${submissionCellHtml(t)}</td>
 <td><input class="cell-input" data-field="resources" value="${esc(t.resources)}" placeholder="Books, sites, reminders"></td>
 <td class="act"><button class="more-btn" data-row-details="${t.id}" title="More notes" aria-label="More notes">•••</button><button class="more-btn" data-del-task="${t.id}" title="Delete task" aria-label="Delete task">✕</button></td>
 </tr>`;
}
function addTaskRow(){
 setView('tasks');
 const root=$('#view-tasks');
 const sheet=root.dataset.sheet||'all';
 const subject=state.settings.subjects.some(s=>s.id===sheet)?sheet:(state.settings.subjects[0]?.id||'');
 const t={id:uid('t'),subject,task:'',type:'Activity',assigned:today(),due:'',time:'',priority:'Medium',status:'Not Started',link:'',submission:'',notes:'',resources:''};
 state.tasks.tasks.push(t);
 root.dataset.q='';root.dataset.status='';root.dataset.pri='';
 save();
 renderTasks();
 const input=document.querySelector(`tr[data-task-id="${t.id}"] input[data-field="task"]`);
 if(input){input.scrollIntoView({block:'center'});input.focus()}
}
function taskCard(t){const [due,dc]=taskDays(t);return `<article class="task-card"><div class="task-top"><input class="task-check" type="checkbox" data-taskdone="${t.id}" ${t.status==='Done'?'checked':''}><div class="task-title ${t.status==='Done'?'done':''}">${esc(t.task||'Untitled task')}</div><button class="more-btn" data-edit-task="${t.id}">•••</button></div><div class="task-meta"><span class="pill">${esc(taskSubject(t.subject))}</span><span class="pill">${esc(t.type||'Task')}</span><span class="pill ${dc}">${due}</span><span class="pill">${esc(t.priority||'Medium')}</span></div><div class="task-foot"><span>${t.due?fmtDate(t.due):'No deadline'}</span><span>${t.status||'Not Started'}</span></div></article>`}
// Shared List | Grid switcher (Notes and My Subjects). attr is the data attribute the click handler listens for.
function viewSwitchHtml(attr,current,label){
 const btn=(v,icon,name)=>`<button type="button" class="${current===v?'active':''}" ${attr}="${v}" aria-pressed="${current===v}" title="${name} view" aria-label="${name} view"><span aria-hidden="true">${icon}</span><b>${name}</b></button>`;
 return `<div class="seg view-seg" role="group" aria-label="${label}">${btn('list','☷','List')}${btn('grid','▦','Grid')}</div>`;
}
// My Subjects overview: the same subjects shown as a Grid (default, the familiar cards) or a List,
// with search and sort. The view is remembered for this browser session.
const SUBJECTS_VIEW_KEY='jasync-subjects-view';
function subjectsView(){let v='';try{v=sessionStorage.getItem(SUBJECTS_VIEW_KEY)||''}catch{}return v==='list'?'list':'grid'}
function subjectInfo(s){
 const lessons=state.notes.subjects[s.id]?.notes||[];
 const edited=lessons.reduce((m,n)=>Math.max(m,n.updated||0),0);
 const openTasks=state.tasks.tasks.filter(t=>t.subject===s.id&&t.status!=='Done').length;
 const text=lessons.length?`${lessons.length} lesson${lessons.length===1?'':'s'} · Edited ${relTime(edited)}`:'No lessons yet';
 return {lessons:lessons.length,edited,openTasks,text};
}
function renderSubjects(){
 const root=$('#view-subjects');if(state.selectedSubject){renderNotebook();return}
 const view=subjectsView(),sort=root.dataset.ssort||'order',q=(root.dataset.sq||'').toLowerCase().trim();
 const all=state.settings.subjects.map((s,i)=>({s,i,info:subjectInfo(s)}));
 const name=x=>x.s.name||'Unnamed subject';
 const visible=all.filter(x=>!q||name(x).toLowerCase().includes(q));
 const order={order:(a,b)=>a.i-b.i,az:(a,b)=>name(a).localeCompare(name(b),undefined,{sensitivity:'base'}),za:(a,b)=>name(b).localeCompare(name(a),undefined,{sensitivity:'base'}),recent:(a,b)=>b.info.edited-a.info.edited||a.i-b.i}[sort]||((a,b)=>a.i-b.i);
 const list=visible.sort(order);
 let body;
 if(!list.length)body=`<div class="notes-empty"><div class="notes-empty-icon" aria-hidden="true">🔎</div><h3>No subjects found</h3><p>Try a different search term.</p></div>`;
 else if(view==='list')body=`<div class="note-list subject-list notes-view">${list.map(({s,i,info})=>`<div class="note-row subject-row" data-subject="${s.id}" role="button" tabindex="0" aria-label="Open ${esc(name({s}))} notebook" style="--subject-color:${SUBJECT_COLORS[i%8]}"><span class="subject-row-badge" aria-hidden="true">${i+1}</span><div class="note-row-main"><div class="note-row-title">${esc(name({s}))}</div><div class="note-row-meta"><small>${info.text}</small></div></div><span class="pill">${info.openTasks} open task${info.openTasks===1?'':'s'}</span><span class="subject-row-go" aria-hidden="true">›</span></div>`).join('')}</div>`;
 else body=`<div class="subject-grid notes-view">${list.map(({s,i,info})=>subjectCard(s,i,info)).join('')}</div>`;
 const count=state.settings.subjects.length;
 root.innerHTML=`<div class="toolbar"><div><b>${count} subject notebook${count===1?'':'s'}</b><div style="color:var(--muted);font-size:11px">Keep lesson discussions, reviewers and important notes organized by subject.</div></div><span class="grow"></span><button class="primary" data-manage-subjects>Manage subjects</button></div><div class="toolbar subjects-controls"><input class="input" id="subjectsSearch" value="${esc(q)}" placeholder="Search subjects…" aria-label="Search subjects"><select class="select" id="subjectsSort" aria-label="Sort subjects"><option value="order" ${sort==='order'?'selected':''}>Your order</option><option value="az" ${sort==='az'?'selected':''}>A–Z</option><option value="za" ${sort==='za'?'selected':''}>Z–A</option><option value="recent" ${sort==='recent'?'selected':''}>Recently edited</option></select>${viewSwitchHtml('data-subjects-view',view,'Subjects view')}<span class="grow"></span><span class="pill">${list.length} subject${list.length===1?'':'s'}</span></div>${body}`;
}
function renderNotebook(){
 const s=state.settings.subjects.find(x=>x.id===state.selectedSubject);
 if(!s){state.selectedSubject=null;return renderSubjects()}
 const nb=state.notes.subjects[s.id]||{id:s.id,name:s.name,body:'',notes:[]};
 state.notes.subjects[s.id]=nb;
 const allNotes=nb.notes||[];
 // null = nothing chosen yet, so open the first lesson; '' = the lesson was closed on purpose (Close button).
 if(state.selectedNote==null&&allNotes.length)state.selectedNote=allNotes[0].id;
 const n=allNotes.find(x=>x.id===state.selectedNote);
 const root=$('#view-subjects');
 const lsort=root.dataset.lsort||'newest';
 const q=(root.dataset.lquery||'').toLowerCase().trim();
 const visible=allNotes.filter(x=>!q||((x.title||'')+' '+stripHtml(x.body)).toLowerCase().includes(q));
 const sorted=[...visible].sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||(lsort==='oldest'?1:-1)*((a.updated||0)-(b.updated||0)));
 const pinnedCount=sorted.filter(x=>x.pinned).length;
 const listHtml=sorted.length?sorted.map((x,i)=>`${i===0&&x.pinned?'<div class="list-divider">Pinned</div>':''}${pinnedCount>0&&i===pinnedCount&&!x.pinned?'<div class="list-divider">Other lessons</div>':''}<div class="note-item ${x.id===state.selectedNote?'active':''}" data-lesson="${x.id}" tabindex="0" role="button"><div class="note-item-row"><b>${esc(x.title||'Untitled lesson')}</b><button type="button" class="pin-btn ${x.pinned?'active':''}" data-pin-lesson="${x.id}" title="${x.pinned?'Unpin':'Pin note'}">${x.pinned?'★':'☆'}</button></div><small>${relTime(x.updated)}${(x.attachments||[]).length?' · 📎 '+x.attachments.length:''}</small></div>`).join(''):`<div class="empty">${q?'No lessons match your search.':'No lessons yet.'}</div>`;
 root.innerHTML=`<div class="toolbar"><button class="ghost" data-back-subjects>← All subjects</button><span class="grow"></span><button class="primary" data-new-lesson>+ New lesson</button></div><div class="card notebook"><aside class="notebook-side"><div class="eyebrow">Notebook</div><h2 style="margin:4px 0 12px;font-size:18px">${esc(s.name)}</h2><input class="input" id="lessonSearch" value="${esc(q)}" placeholder="Search this notebook…"><select class="select" id="lessonSort" style="margin-top:8px;width:100%"><option value="newest" ${lsort==='newest'?'selected':''}>Newest first</option><option value="oldest" ${lsort==='oldest'?'selected':''}>Oldest first</option></select><div id="lessonList">${listHtml}</div></aside><div class="notebook-main">${n?`<div class="notebook-top"><span class="pill">Lesson note</span><span class="grow"></span></div><div class="lesson-head"><input class="note-editor-title" id="lessonTitle" value="${esc(n.title||'')}" placeholder="Lesson title" aria-label="Lesson title"><div class="lesson-meta"><span class="note-edited">${n.updated?'Last edited '+relTime(n.updated):''}</span><span class="note-save-status" role="status"></span></div><div class="lesson-actions"><button type="button" class="lesson-action lesson-pin ${n.pinned?'active':''}" id="lessonPin" aria-pressed="${n.pinned?'true':'false'}" title="${n.pinned?'Unpin lesson':'Pin lesson'}">${pinLabelHtml(n.pinned)}</button><button type="button" class="lesson-action lesson-delete" data-delete-lesson aria-label="Delete lesson" title="Delete lesson">${TRASH_ICON}</button></div></div>${editorToolbarHtml('lesson')}<div class="note-editor" id="lessonBody" contenteditable="true" data-placeholder="Write your lesson discussion here… key concepts, examples, questions, formulas and reminders.">${n.body||''}</div>${attachmentsHtml(n,'lesson')}<div class="lesson-foot"><button type="button" class="ghost" data-close-lesson>Close</button><button type="button" class="primary save-note-btn" data-save-lesson title="Save (Ctrl+S)">Save</button></div>`:`<div class="empty" style="margin-top:120px">${allNotes.length?'Choose a lesson from the list to read or edit it.':'Click <b>+ New lesson</b> to start taking notes.'}</div>`}</div></div>`;
 hydrateImages($('#lessonBody'));
}
function newLesson(){const s=state.settings.subjects.find(x=>x.id===state.selectedSubject);const nb=state.notes.subjects[s.id]||{id:s.id,name:s.name,notes:[]};nb.notes??=[];const n={id:uid('n'),title:'New lesson',body:'',pinned:false,attachments:[],created:Date.now(),updated:Date.now()};nb.notes.unshift(n);state.notes.subjects[s.id]=nb;state.selectedNote=n.id;const root=$('#view-subjects');if(root)root.dataset.lquery='';save();renderNotebook();setTimeout(()=>$('#lessonTitle')?.focus(),0)}
function markEditedNow(){document.querySelectorAll('.note-edited').forEach(x=>x.textContent='Last edited just now')}
async function saveLesson(){
  const s=state.notes.subjects[state.selectedSubject],n=s?.notes?.find(x=>x.id===state.selectedNote);
  const btn=$('[data-save-lesson]');if(!n||!btn||btn.disabled)return;
  // Take the editor's current contents in case the last keystroke has not fired an input event yet.
  const title=$('#lessonTitle'),body=$('#lessonBody');if(title)n.title=title.value;if(body)n.body=editorBodyHtml(body);
  n.updated=Date.now();
  btn.disabled=true;btn.textContent='Saving…';
  const ok=await saveNow();
  renderNotebook();
  const again=$('[data-save-lesson]');
  if(again&&ok){again.textContent='✓ Saved';again.classList.add('is-saved');setTimeout(()=>{if(again.isConnected){again.textContent='Save';again.classList.remove('is-saved')}},1600)}
  if(ok)toast('Lesson saved');
}
/* ---- Shared Pin / Delete pieces for lesson notes and general notes ---- */
const TRASH_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
const pinLabelHtml=pinned=>`<span aria-hidden="true">${pinned?'★':'☆'}</span>${pinned?'Pinned':'Pin'}`;
const deleteDetail=(n,fallback)=>{const files=(n.attachments||[]).length;return `“${esc(n.title||fallback)}”${files?` and its ${files} attached file${files>1?'s':''}`:''} will be permanently removed.`};
// Deleting is permanent, so ask first. Focus starts on Cancel; Escape, × and the backdrop also cancel.
function confirmDelete({title,detail,confirmLabel,onConfirm,onCancel}){
  openModal(title,
    `<p class="confirm-text">This action cannot be undone.</p><p class="confirm-detail">${detail}</p>`,
    `<button type="button" class="ghost" data-close>Cancel</button><button type="button" class="danger-solid" id="confirmDelete">${confirmLabel}</button>`);
  const root=$('#modalRoot'),modal=root.querySelector('.modal'),backdrop=$('#backdrop');
  modal.classList.add('modal-confirm');modal.setAttribute('role','alertdialog');modal.setAttribute('aria-modal','true');
  modal.querySelector('.modal-head h2').id='confirmDeleteTitle';modal.setAttribute('aria-labelledby','confirmDeleteTitle');
  modal.querySelector('.modal-head [data-close]').setAttribute('aria-label','Cancel');
  let settled=false;
  const finish=()=>{settled=true;document.removeEventListener('keydown',onKey)};
  const onKey=e=>{if(!modal.isConnected)return finish();if(e.key==='Escape'){e.preventDefault();finish();root.innerHTML='';onCancel?.()}};
  document.addEventListener('keydown',onKey);
  // openModal already clears the dialog for Cancel, × and the backdrop; this adds the cancel callback.
  backdrop.addEventListener('click',e=>{if(!settled&&(e.target===backdrop||e.target.closest('[data-close]'))){finish();setTimeout(()=>onCancel?.(),0)}});
  $('#confirmDelete').onclick=()=>{finish();root.innerHTML='';onConfirm()};
  setTimeout(()=>modal.querySelector('.modal-foot [data-close]')?.focus(),0);
}
function confirmDeleteLesson(){
  const s=state.notes.subjects[state.selectedSubject],n=s?.notes?.find(x=>x.id===state.selectedNote);if(!n)return;
  const opener=$('[data-delete-lesson]');
  confirmDelete({
    title:'Delete this lesson?',detail:deleteDetail(n,'Untitled lesson'),confirmLabel:'Delete lesson',
    onCancel:()=>opener?.focus(),
    onConfirm:()=>{
      s.notes=s.notes.filter(x=>x.id!==n.id);
      if(state.selectedNote===n.id)state.selectedNote=s.notes[0]?.id||null;
      (n.attachments||[]).forEach(a=>deleteFileBlob(a.id));
      save();renderNotebook();toast('Lesson deleted');
    }
  });
}
// Notes can be shown as a List (default) or a Grid. Both views draw the same general notes after the same
// search and sort; only the layout differs. The chosen view is remembered for this browser session.
const NOTES_VIEW_KEY='jasync-notes-view';
function notesView(){let v='';try{v=sessionStorage.getItem(NOTES_VIEW_KEY)||''}catch{}return v==='grid'?'grid':'list'}
function renderNotes(){
 const root=$('#view-notes');
 const sort=root.dataset.sort||'newest';
 const q=(root.dataset.q||'').toLowerCase().trim();
 const view=notesView();
 const all=[...(state.notes.general||[])];
 const visible=all.filter(n=>!q||((n.title||'')+' '+stripHtml(n.body)).toLowerCase().includes(q));
 const byTitle=(a,b)=>(a.title||'Untitled').localeCompare(b.title||'Untitled',undefined,{sensitivity:'base'});
 const order={newest:(a,b)=>(b.updated||0)-(a.updated||0),oldest:(a,b)=>(a.updated||0)-(b.updated||0),az:byTitle,za:(a,b)=>byTitle(b,a)}[sort]||((a,b)=>(b.updated||0)-(a.updated||0));
 // Pinned notes always come first, in every view and sort order.
 const list=visible.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||order(a,b));
 const docIcon='<svg class="note-doc-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';
 const pinBtn=n=>`<button type="button" class="pin-btn ${n.pinned?'active':''}" data-pin-general="${n.id}" title="${n.pinned?'Unpin note':'Pin note'}" aria-label="${n.pinned?'Unpin':'Pin'} ${esc(n.title||'Untitled')}" aria-pressed="${n.pinned?'true':'false'}">${n.pinned?'★':'☆'}</button>`;
 const meta=n=>`<small>Edited ${relTime(n.updated)}</small>${n.pinned?'<span class="note-pinned-badge">📌 Pinned</span>':''}${(n.attachments||[]).length?`<small>📎 ${n.attachments.length}</small>`:''}`;
 const open=n=>`data-general="${n.id}" role="button" tabindex="0" aria-label="Open note ${esc(n.title||'Untitled')}"`;
 let body;
 if(!all.length)body=`<div class="notes-empty"><div class="notes-empty-icon" aria-hidden="true">📝</div><h3>No notes yet</h3><p>Start capturing your lessons, ideas, and study notes here.</p><button type="button" class="primary" data-new-general>Create your first note</button></div>`;
 else if(!list.length)body=`<div class="notes-empty"><div class="notes-empty-icon" aria-hidden="true">🔎</div><h3>No notes found</h3><p>Try a different search term.</p></div>`;
 else if(view==='grid')body=`<div class="task-grid note-grid notes-view">${list.map(n=>`<div class="task-card note-card ${n.pinned?'pinned':''}" ${open(n)}><div class="note-card-top"><div class="task-title">${docIcon}${esc(n.title||'Untitled')}</div>${pinBtn(n)}</div><div class="note-card-foot">${meta(n)}</div></div>`).join('')}</div>`;
 else body=`<div class="note-list notes-view">${list.map(n=>`<div class="note-row ${n.pinned?'pinned':''}" ${open(n)}><span class="note-row-icon">${docIcon}</span><div class="note-row-main"><div class="note-row-title">${esc(n.title||'Untitled')}</div><div class="note-row-meta">${meta(n)}</div></div>${pinBtn(n)}</div>`).join('')}</div>`;
 root.innerHTML=`<div class="hero"><div><div class="eyebrow">Quick notes</div><h2>One place for the things you don't want to forget.</h2><p>Use subject notebooks for lessons. Use general notes here for reminders, ideas, checklists and anything that doesn't belong to one class.</p></div><button class="primary" data-new-general>+ New note</button></div><div class="card section-gap"><div class="card-head notes-head"><h2>General notes</h2><div class="notes-controls"><input class="input" id="notesSearch" value="${esc(q)}" placeholder="Search notes…" aria-label="Search notes"><select class="select" id="notesSort" aria-label="Sort notes"><option value="newest" ${sort==='newest'?'selected':''}>Newest first</option><option value="oldest" ${sort==='oldest'?'selected':''}>Oldest first</option><option value="az" ${sort==='az'?'selected':''}>A–Z</option><option value="za" ${sort==='za'?'selected':''}>Z–A</option></select>${viewSwitchHtml('data-notes-view',view,'Notes view')}<span class="pill">${list.length} note${list.length===1?'':'s'}</span></div></div><div class="card-body">${body}</div></div>`;
}
function finalizeGeneralNote(){
 const n=currentGeneralNote; if(!n)return;
 const empty=!(n.title||'').trim()&&!stripHtml(n.body||'').trim()&&!/<img/i.test(n.body||'')&&!(n.attachments||[]).length;
 if(empty){state.notes.general=(state.notes.general||[]).filter(x=>x.id!==n.id);save()}
 currentGeneralNote=null;
 render();
}
function generalModal(n=null){
 const isNew=!n;
 if(isNew){state.notes.general??=[];n={id:uid('g'),title:'',body:'',pinned:false,attachments:[],created:Date.now(),updated:Date.now()};state.notes.general.push(n);save()}
 currentGeneralNote=n;
 openModal(isNew?'New note':'Edit note',
  `<div class="field"><div class="lesson-head"><input class="note-editor-title" id="gnTitle" value="${esc(n.title||'')}" placeholder="Note title" aria-label="Note title"><div class="lesson-meta"><span class="note-edited">${n.updated?'Last edited '+relTime(n.updated):''}</span><span class="note-save-status" role="status"></span></div><div class="lesson-actions"><button type="button" class="lesson-action lesson-pin ${n.pinned?'active':''}" id="gnPin" aria-pressed="${n.pinned?'true':'false'}" title="${n.pinned?'Unpin note':'Pin note'}">${pinLabelHtml(n.pinned)}</button><button type="button" class="lesson-action lesson-delete" id="deleteGeneral" aria-label="Delete note" title="Delete note">${TRASH_ICON}</button></div></div>${editorToolbarHtml('gn')}<div class="note-editor" id="gnBody" contenteditable="true" data-placeholder="Write anything… reminders, checklists, ideas.">${n.body||''}</div>${attachmentsHtml(n,'gn')}</div>`,
  `<button class="ghost" data-close>Close</button><button class="primary save-note-btn" id="saveGeneral" title="Save (Ctrl+S)">Save</button>`
 );
 $('#saveGeneral').onclick=async e=>{
  const btn=e.currentTarget,title=$('#gnTitle'),body=$('#gnBody');
  if(title)n.title=title.value;if(body)n.body=editorBodyHtml(body);
  const empty=!(n.title||'').trim()&&!stripHtml(n.body||'').trim()&&!/<img/i.test(n.body||'')&&!(n.attachments||[]).length;
  btn.disabled=true;btn.textContent='Saving…';
  n.updated=Date.now();
  finalizeGeneralNote();
  const ok=await saveNow();
  $('#modalRoot').innerHTML='';
  if(empty)toast('Empty note discarded');else if(ok)toast('Note saved');
 };
 const pinBtn=$('#gnPin');
 pinBtn.onclick=()=>{n.pinned=!n.pinned;n.updated=Date.now();save();pinBtn.classList.toggle('active',n.pinned);pinBtn.title=n.pinned?'Unpin note':'Pin note';pinBtn.setAttribute('aria-pressed',String(n.pinned));pinBtn.innerHTML=pinLabelHtml(n.pinned)};
 // The confirmation replaces this popup; Cancel reopens the note (it is autosaved, so nothing is lost).
 $('#deleteGeneral').onclick=()=>confirmDelete({
  title:'Delete this note?',detail:deleteDetail(n,'Untitled note'),confirmLabel:'Delete note',
  onCancel:()=>{generalModal(n);setTimeout(()=>$('#deleteGeneral')?.focus(),0)},
  onConfirm:()=>{
   state.notes.general=(state.notes.general||[]).filter(x=>x.id!==n.id);
   (n.attachments||[]).forEach(a=>deleteFileBlob(a.id));
   save();
   currentGeneralNote=null;
   render();
   toast('Note deleted');
  }
 });
 $('#modalRoot .modal').classList.add('note-modal');
 hydrateImages($('#gnBody'));
 $('#backdrop').addEventListener('click',e=>{if(e.target.id==='backdrop'||e.target.closest('[data-close]'))finalizeGeneralNote()});
 setTimeout(()=>$('#gnTitle')?.focus(),0);
}
function renderSettings(){const root=$('#view-settings');const accent=state.settings.accent||'#367e83';root.innerHTML=`<div class="settings-grid"><div class="card settings-card"><h2>Subjects</h2><p>Rename your 8 subject spaces. Changes update your task and notebook labels too.</p>${state.settings.subjects.map((s,i)=>`<div class="subject-edit"><span class="pill">${i+1}</span><input class="input" data-subedit="${s.id}" value="${esc(s.name)}" placeholder="Subject name"></div>`).join('')}<button class="primary" style="margin-top:15px" data-save-subjects>Save subjects</button></div><div class="card settings-card"><h2>Appearance</h2><p>Choose a comfortable look for long study sessions.</p><div class="toolbar"><button class="ghost" data-theme="light">☀ Light</button><button class="ghost" data-theme="dark">☾ Dark</button><button class="ghost" data-theme="system">◐ System</button></div><h2 style="margin-top:25px">Accent color</h2><p>Pick the color used for buttons, highlights and active tabs across the app.</p><div style="display:flex;align-items:center;gap:10px"><input type="color" id="accentColor" value="${accent}" aria-label="Custom accent color"><div class="color-swatches" style="margin-top:0">${SUBJECT_COLORS.map(c=>`<button type="button" class="swatch ${c.toLowerCase()===accent.toLowerCase()?'active':''}" data-accent-swatch="${c}" style="background:${c}" aria-label="Use accent color ${c}" title="${c}"></button>`).join('')}</div></div><h2 style="margin-top:25px">Backup</h2><p>Download your planner data or restore it on another device.</p><button class="primary" data-backup>Download backup</button><label class="ghost" style="display:inline-block;margin-left:6px">Restore<input id="restoreFile" type="file" accept="application/json" hidden></label></div></div>`}
function downloadBackup(){const blob=new Blob([JSON.stringify({calendar:state.calendar,tasks:state.tasks,notes:state.notes,settings:state.settings},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='school-planner-backup.json';a.click();URL.revokeObjectURL(a.href)}
function applyTheme(t){if(t==='system')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.body.classList.toggle('dark',t==='dark');state.settings.theme=state.settings.theme==='system'?'system':state.settings.theme;}
function closeMobile(){$('#sidebar').classList.remove('mobile-open');$('#scrim').classList.remove('show')}
// Collapsed/expanded is a per-device preference, so it lives in localStorage rather than the synced planner.
const SIDEBAR_KEY='jasync-sidebar-collapsed';
function setSidebarCollapsed(collapsed){$('#sidebar').classList.toggle('collapsed',collapsed);const btn=$('#sideCollapse'),label=collapsed?'Expand sidebar':'Collapse sidebar';btn.setAttribute('aria-label',label);btn.classList.toggle('is-collapsed',collapsed);btn.setAttribute('aria-expanded',String(!collapsed))}
function toggleSidebar(){const collapsed=!$('#sidebar').classList.contains('collapsed');setSidebarCollapsed(collapsed);try{localStorage.setItem(SIDEBAR_KEY,collapsed?'1':'0')}catch{}}
function restoreSidebar(){let saved=null;try{saved=localStorage.getItem(SIDEBAR_KEY)}catch{}if(saved==='1')setSidebarCollapsed(true)}
// Tooltips: the toggle always shows its action; nav items, and sign out, show their name only while the sidebar is an icon rail.
function sidebarTooltips(){
  const tip=document.createElement('div');tip.className='side-tip';tip.setAttribute('aria-hidden','true');document.body.appendChild(tip);
  const sidebar=$('#sidebar'),toggle=$('#sideCollapse');
  const label=el=>el.matches('.nav-item')?el.querySelector('b').textContent:el.getAttribute('aria-label');
  const show=el=>{if(innerWidth<761||(el!==toggle&&!sidebar.classList.contains('collapsed')))return;tip.textContent=label(el);const r=el.getBoundingClientRect();tip.style.left=(r.right+10)+'px';tip.style.top=(r.top+r.height/2)+'px';tip.classList.add('show')};
  const hide=()=>tip.classList.remove('show');
  [toggle,...sidebar.querySelectorAll('.nav-item,#authButton')].forEach(el=>{el.addEventListener('mouseenter',()=>show(el));el.addEventListener('mouseleave',hide);el.addEventListener('focus',()=>{if(el.matches(':focus-visible'))show(el)});el.addEventListener('blur',hide);el.addEventListener('click',hide)});
  // After toggling, re-show the tooltip with the new action once the button has moved into place.
  toggle.addEventListener('click',()=>setTimeout(()=>{if(toggle.matches(':hover,:focus-visible'))show(toggle)},240));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
}
function wire(){ $$('.nav-item[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('#sideCollapse').onclick=toggleSidebar;restoreSidebar();sidebarTooltips();$('#mobileMenu').onclick=()=>{$('#sidebar').classList.add('mobile-open');$('#scrim').classList.add('show')};$('#scrim').onclick=closeMobile;$('#quickAdd').onclick=()=>quickAdd();$('#globalSearchBtn').onclick=()=>quickSearch();$('#themeToggle').onclick=()=>{state.settings.theme=document.body.classList.contains('dark')?'light':'dark';document.body.classList.toggle('dark',state.settings.theme==='dark');save()};document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('[data-general][role="button"],[data-subject][role="button"]')){e.preventDefault();e.target.click();return}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();quickSearch()}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){const b=$('#saveGeneral')||$('#view-subjects.active [data-save-lesson]');if(b){e.preventDefault();b.click()}}});}
function quickAdd(){openModal('What do you want to add?','<div class="grid" style="grid-template-columns:1fr 1fr"><button class="card" style="padding:25px;border:1px solid var(--line)" id="qaTask"><b>✓ Task</b><div style="color:var(--muted);font-size:11px;margin-top:5px">Add a deadline or school requirement</div></button><button class="card" style="padding:25px;border:1px solid var(--line)" id="qaEvent"><b>▦ Event</b><div style="color:var(--muted);font-size:11px;margin-top:5px">Add a class, exam or plan</div></button></div>');$('#qaTask').onclick=()=>{$('#modalRoot').innerHTML='';addTaskRow()};$('#qaEvent').onclick=()=>eventModal()}
function quickSearch(){openModal('Search your planner','<input class="input" id="globalQ" style="width:100%" placeholder="Search tasks, events and notes…"><div id="globalResults" style="margin-top:12px"></div>');const q=$('#globalQ');q.focus();q.oninput=()=>{const x=q.value.toLowerCase().trim();const r=[];state.tasks.tasks.forEach(t=>{if((t.task+' '+taskSubject(t.subject)+' '+(t.notes||'')).toLowerCase().includes(x))r.push(`<div class="list-row"><div class="row-main"><b>${esc(t.task)}</b><span>Task · ${esc(taskSubject(t.subject))}</span></div></div>`)});state.calendar.events.forEach(e=>{if((e.title+' '+(e.notes||'')).toLowerCase().includes(x))r.push(`<div class="list-row"><div class="row-main"><b>${esc(e.title)}</b><span>Event · ${fmtDate(e.date)}</span></div></div>`)});$('#globalResults').innerHTML=r.slice(0,12).join('')||'<div class="empty">No matches.</div>'}}

document.addEventListener('mousedown',e=>{if(e.target.closest('.editor-toolbar button[data-cmd]'))e.preventDefault()});
// Images pasted or dropped into a lesson or note show as small thumbnails; clicking one opens it full size
// on top of everything (including the note popup). Escape, × or a click outside the image closes it.
function openImageViewer(src,alt,returnFocus){
 const v=document.createElement('div');v.className='image-viewer';
 v.setAttribute('role','dialog');v.setAttribute('aria-modal','true');v.setAttribute('aria-label','Image preview');
 v.innerHTML='<button type="button" class="image-viewer-close" aria-label="Close image">×</button><img alt="">';
 const img=v.querySelector('img');img.src=src;img.alt=alt||'';
 const close=()=>{document.removeEventListener('keydown',onKey,true);v.remove();returnFocus?.focus({preventScroll:true})};
 // Capture Escape first so it closes only the preview, not the note underneath.
 const onKey=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}};
 document.addEventListener('keydown',onKey,true);
 v.addEventListener('click',e=>{if(e.target!==img)close()});
 document.body.appendChild(v);v.querySelector('.image-viewer-close').focus();
}
document.addEventListener('click',e=>{const img=e.target.closest('.note-editor img');if(img&&img.src)openImageViewer(img.src,img.alt,img.closest('.note-editor'))});
// Pasted and dropped pictures are shrunk, given their own record (see adoptImage) and put in at the caret.
async function insertImages(editor,files){
 for(const f of files){
  try{
   const src=await shrinkDataUrl(await readDataUrl(f));
   const id=adoptImage(src,true);
   editor.focus();
   document.execCommand('insertHTML',false,`<img data-img="${id}" src="${src}" alt="${esc(f.name||'')}">`);
  }catch{toast(`Couldn't add “${f.name||'image'}” — try a JPG or PNG.`)}
 }
 editor.dispatchEvent(new Event('input',{bubbles:true}));
}
const editorOf=e=>(e.target.nodeType===1?e.target:e.target.parentElement)?.closest('.note-editor');
const imageFiles=list=>[...(list||[])].filter(f=>f.type.startsWith('image/'));
// Pasting a picture on its own (a screenshot, "Copy image"). Pastes that also carry text, like a block
// copied from Word, keep the browser's normal behaviour.
document.addEventListener('paste',e=>{
 const editor=editorOf(e);if(!editor)return;
 const files=imageFiles(e.clipboardData?.files);
 if(!files.length||e.clipboardData.getData('text/plain').trim())return;
 e.preventDefault();insertImages(editor,files);
});
// Dropping files: pictures go in where they were dropped. Other files would make the browser leave the
// planner to open them, so point to the attachments instead.
document.addEventListener('dragover',e=>{if(editorOf(e)&&e.dataTransfer?.types.includes('Files'))e.preventDefault()});
document.addEventListener('drop',e=>{
 const editor=editorOf(e);if(!editor||!e.dataTransfer?.files.length)return;
 e.preventDefault();
 const files=imageFiles(e.dataTransfer.files);
 if(!files.length)return toast('Only pictures can go in the text — use “+ Add file” below for other files.');
 let r=document.caretRangeFromPoint?.(e.clientX,e.clientY);
 if(!r&&document.caretPositionFromPoint){const p=document.caretPositionFromPoint(e.clientX,e.clientY);if(p){r=document.createRange();r.setStart(p.offsetNode,p.offset)}}
 editor.focus();
 if(r&&editor.contains(r.startContainer)){const s=getSelection();s.removeAllRanges();s.addRange(r)}
 insertImages(editor,files);
});
document.addEventListener('click',e=>{
const pinLesson=e.target.closest('[data-pin-lesson]');
if(pinLesson){const s=state.notes.subjects[state.selectedSubject];const n=s&&s.notes&&s.notes.find(x=>x.id===pinLesson.dataset.pinLesson);if(n){n.pinned=!n.pinned;save();renderNotebook()}return}
const pinGeneral=e.target.closest('[data-pin-general]');
if(pinGeneral){const n=(state.notes.general||[]).find(x=>x.id===pinGeneral.dataset.pinGeneral);if(n){n.pinned=!n.pinned;save();renderNotes()}return}
const lessonPinBtn=e.target.closest('#lessonPin');
if(lessonPinBtn){const s=state.notes.subjects[state.selectedSubject];const n=s&&s.notes&&s.notes.find(x=>x.id===state.selectedNote);if(n){n.pinned=!n.pinned;save();renderNotebook()}return}
const tbBtn=e.target.closest('.editor-toolbar button[data-cmd]');
if(tbBtn){
 const toolbar=tbBtn.closest('.editor-toolbar');
 const editor=document.getElementById(toolbar.dataset.target);
 if(editor){
  editor.focus();
  const cmd=tbBtn.dataset.cmd;
  if(cmd==='createLink'){const url=prompt('Link URL (include https://)','https://');if(url)document.execCommand('createLink',false,url)}
  else if(cmd==='formatBlock')document.execCommand('formatBlock',false,'<'+tbBtn.dataset.val+'>');
  else document.execCommand(cmd,false,null);
  editor.dispatchEvent(new Event('input',{bubbles:true}));
 }
 return;
}
const attOpen=e.target.closest('[data-attach-open]');
if(attOpen){
 getFileBlob(attOpen.dataset.attachOpen).then(rec=>{
  if(!rec)return toast('File not found on this device.');
  const url=URL.createObjectURL(rec.blob);
  window.open(url,'_blank');
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 });
 return;
}
const attRemove=e.target.closest('[data-attach-remove]');
if(attRemove){
 const panel=attRemove.closest('.attach-panel');
 const prefix=panel&&panel.dataset.attachOwner;
 const note=resolveNote(prefix);
 const id=attRemove.dataset.attachRemove;
 if(note){
  note.attachments=(note.attachments||[]).filter(a=>a.id!==id);
  note.updated=Date.now();
  save();
  deleteFileBlob(id);
  refreshAttachPanel(prefix,note);
 }
 return;
}
// Task deadline time: the same clock picker as the event form (rows re-render, so this is delegated).
const taskTime=e.target.closest('tr[data-task-id] .clock-field');
if(taskTime){openTimePicker(taskTime,{suggest:()=>'23:59'});return}
const accSwatch=e.target.closest('[data-accent-swatch]');
if(accSwatch){state.settings.accent=accSwatch.dataset.accentSwatch;applyAccentColor(state.settings.accent);save();renderSettings();return}
const sheet=e.target.closest('[data-task-sheet]');if(sheet){$('#view-tasks').dataset.sheet=sheet.dataset.taskSheet;renderTasks();return}const detail=e.target.closest('[data-row-details]');if(detail){const d=$('#details-'+detail.dataset.rowDetails);if(d)d.classList.toggle('show');return}const go=e.target.closest('[data-go]');if(go)return setView(go.dataset.go);const sub=e.target.closest('[data-subject]');if(sub){state.selectedSubject=sub.dataset.subject;state.selectedNote=null;setView('subjects');renderNotebook();return}if(e.target.closest('[data-calendar-task]')){setView('tasks');return}if(e.target.closest('[data-add-event]'))return eventModal();if(e.target.closest('[data-export-cal]'))return exportCalendarModal();const day=e.target.closest('[data-day]');if(day&&!e.target.closest('[data-event]'))return eventModal(null,day.dataset.day);const ev=e.target.closest('[data-event]');if(ev){const x=state.calendar.events.find(a=>a.id===ev.dataset.event);if(x)eventModal(x);return}const cs=e.target.closest('[data-cal]');if(cs){state.calMode=cs.dataset.cal;renderCalendar();return}if(e.target.closest('[data-calstep]')){const n=+e.target.closest('[data-calstep]').dataset.calstep;if(state.calMode==='week')state.calCursor.setDate(state.calCursor.getDate()+n*7);else if(state.calMode==='agenda')state.calCursor.setDate(state.calCursor.getDate()+n*30);else state.calCursor=new Date(state.calCursor.getFullYear(),state.calCursor.getMonth()+n,1);renderCalendar();return}if(e.target.closest('[data-caltoday]')){state.calCursor=new Date();renderCalendar();return}if(e.target.closest('[data-add-task]'))return addTaskRow();const delTask=e.target.closest('[data-del-task]');if(delTask){const id=delTask.dataset.delTask,t=state.tasks.tasks.find(x=>x.id===id);if(!t)return;confirmDelete({title:'Delete this task?',detail:`“${esc(t.task||'Untitled task')}” will be permanently removed.`,confirmLabel:'Delete task',onCancel:()=>$(`[data-del-task="${id}"]`)?.focus(),onConfirm:()=>{state.tasks.tasks=state.tasks.tasks.filter(x=>x.id!==id);save();renderTasks();toast((t.task?`"${t.task}"`:'Task')+' deleted')}});return}const done=e.target.closest('[data-taskdone]');if(done){const t=state.tasks.tasks.find(x=>x.id===done.dataset.taskdone);if(t){t.status=done.checked?'Done':'Not Started';save();render()};return}if(e.target.closest('[data-clear-done]')){state.tasks.tasks=state.tasks.tasks.filter(t=>t.status!=='Done');save();render();toast('Completed tasks cleared');return}if(e.target.closest('[data-manage-subjects]'))return setView('settings');if(e.target.closest('[data-back-subjects]')){state.selectedSubject=null;setView('subjects');return}if(e.target.closest('[data-new-lesson]'))return newLesson();const lesson=e.target.closest('[data-lesson]');if(lesson){state.selectedNote=lesson.dataset.lesson;renderNotebook();return}if(e.target.closest('[data-save-lesson]'))return saveLesson();if(e.target.closest('[data-close-lesson]')){state.selectedNote='';renderNotebook();return}if(e.target.closest('[data-delete-lesson]'))return confirmDeleteLesson();const subjectsViewBtn=e.target.closest('[data-subjects-view]');if(subjectsViewBtn){try{sessionStorage.setItem(SUBJECTS_VIEW_KEY,subjectsViewBtn.dataset.subjectsView)}catch{}renderSubjects();$(`[data-subjects-view="${subjectsViewBtn.dataset.subjectsView}"]`)?.focus();return}const notesViewBtn=e.target.closest('[data-notes-view]');if(notesViewBtn){try{sessionStorage.setItem(NOTES_VIEW_KEY,notesViewBtn.dataset.notesView)}catch{}renderNotes();$(`[data-notes-view="${notesViewBtn.dataset.notesView}"]`)?.focus();return}if(e.target.closest('[data-new-general]'))return generalModal();const gen=e.target.closest('[data-general]');if(gen){const n=(state.notes.general||[]).find(x=>x.id===gen.dataset.general);if(n)generalModal(n);return}if(e.target.closest('[data-save-subjects]')){ $$('[data-subedit]').forEach(i=>{const s=state.settings.subjects.find(x=>x.id===i.dataset.subedit);if(s)s.name=i.value.trim()||s.name});syncSubjects();save();render();toast('Subjects updated');return}const th=e.target.closest('[data-theme]');if(th){state.settings.theme=th.dataset.theme;document.body.classList.toggle('dark',th.dataset.theme==='dark'||(th.dataset.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches));save();return}if(e.target.closest('[data-backup]'))return downloadBackup()});
document.addEventListener('input',e=>{if((e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')&&e.target.dataset.field){const tr=e.target.closest('tr[data-task-id]');if(tr){const t=state.tasks.tasks.find(x=>x.id===tr.dataset.taskId);if(t){const f=e.target.dataset.field;if(f==='submissionOther')t.submission=e.target.value;else t[f]=e.target.value;save()}if(e.target.classList.contains('task-name'))autoGrow(e.target)}return}if(e.target.id==='calendarSearch'){const r=$('#view-calendar');r.dataset.q=e.target.value;renderCalendar();return}if(e.target.id==='taskSearch'){const r=$('#view-tasks');r.dataset.q=e.target.value;renderTasks()}if(e.target.id==='lessonSearch'){$('#view-subjects').dataset.lquery=e.target.value;renderNotebook();const si=$('#lessonSearch');if(si){si.focus();si.setSelectionRange(si.value.length,si.value.length)}return}if(e.target.id==='subjectsSearch'){$('#view-subjects').dataset.sq=e.target.value;renderSubjects();const si=$('#subjectsSearch');if(si){si.focus();si.setSelectionRange(si.value.length,si.value.length)}return}if(e.target.id==='notesSearch'){$('#view-notes').dataset.q=e.target.value;renderNotes();const ni=$('#notesSearch');if(ni){ni.focus();ni.setSelectionRange(ni.value.length,ni.value.length)}return}if(e.target.id==='lessonTitle'||e.target.id==='lessonBody'){const s=state.notes.subjects[state.selectedSubject],n=s?.notes?.find(x=>x.id===state.selectedNote);if(n){if(e.target.id==='lessonTitle')n.title=e.target.value;else n.body=editorBodyHtml(e.target);n.updated=Date.now();markEditedNow();save();}return}if(e.target.id==='gnTitle'||e.target.id==='gnBody'){const n=currentGeneralNote;if(n){if(e.target.id==='gnTitle')n.title=e.target.value;else n.body=editorBodyHtml(e.target);n.updated=Date.now();markEditedNow();save();}return}});
document.addEventListener('change',e=>{
// Deadline time chosen in the clock picker: store it ("HH:MM") and refresh the row's deadline status.
const taskTimeField=e.target.closest?.('tr[data-task-id] .clock-field');
if(taskTimeField){const id=taskTimeField.closest('tr[data-task-id]').dataset.taskId,t=state.tasks.tasks.find(x=>x.id===id);if(t){t.time=taskTimeField.dataset.value;save();setTimeout(()=>{renderTasks();$('#tf-'+id)?.focus()},0)}return}
const attachInput=e.target.closest('.attach-input');
if(attachInput){
 const prefix=attachInput.dataset.attachTarget;
 const note=resolveNote(prefix);
 const files=note&&attachInput.files?[...attachInput.files]:[];
 attachInput.value='';
 if(note&&files.length){
  Promise.all(files.map(f=>{const id=uid('att');return putFileBlob(id,f,f.name,f.type).then(()=>({id,name:f.name,type:f.type,size:f.size,addedAt:Date.now()}))}))
  .then(metas=>{
   note.attachments=note.attachments||[];
   metas.forEach(m=>note.attachments.push(m));
   note.updated=Date.now();
   save();
   refreshAttachPanel(prefix,note);
  })
  .catch(()=>toast('Could not save the attached file on this device.'));
 }
 return;
}
if(e.target.id==='accentColor'){state.settings.accent=e.target.value;applyAccentColor(state.settings.accent);save();return}if(e.target.id==='subjectsSort'){$('#view-subjects').dataset.ssort=e.target.value;renderSubjects();return}if(e.target.id==='notesSort'){$('#view-notes').dataset.sort=e.target.value;renderNotes();return}if(e.target.id==='lessonSort'){$('#view-subjects').dataset.lsort=e.target.value;renderNotebook();return}if(e.target.id==='calendarShowTasks'){state.calendar.showTasks=e.target.checked;save();renderCalendar();return}const fieldCell=e.target.closest('[data-field]');if(fieldCell&&(fieldCell.tagName==='SELECT'||fieldCell.type==='date')){const tr=fieldCell.closest('tr[data-task-id]');if(tr){const t=state.tasks.tasks.find(x=>x.id===tr.dataset.taskId);if(t){const f=fieldCell.dataset.field;if(f==='submission'){const val=fieldCell.value;if(val==='Other')t.submission=t.submission&&!SUBMISSION_TYPES.includes(t.submission)?t.submission:'';else t.submission=val;save();const cell=tr.querySelector('.submission-cell');if(cell){cell.outerHTML=submissionCellHtml(t,val==='Other');if(val==='Other'){const oi=tr.querySelector('[data-field="submissionOther"]');if(oi)oi.focus()}}return}t[f]=fieldCell.value;save();renderTasks()}}return}if(e.target.id==='taskStatus'){const r=$('#view-tasks');r.dataset.status=e.target.value;renderTasks()}if(e.target.id==='taskPriority'){const r=$('#view-tasks');r.dataset.pri=e.target.value;renderTasks()}if(e.target.id==='restoreFile'&&e.target.files[0]){const fr=new FileReader();fr.onload=()=>{try{const x=JSON.parse(fr.result);Object.assign(state,x);if(!state.settings.accent)state.settings.accent='#367e83';syncSubjects();applyAccentColor(state.settings.accent);save();render();toast('Backup restored')}catch{toast('That backup file is not valid.')}};fr.readAsText(e.target.files[0])}});
applyData(null);wire();const theme=state.settings.theme==='dark'||(state.settings.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.body.classList.toggle('dark',theme);applyAccentColor(state.settings.accent);setupFirebaseAuth();
})();
