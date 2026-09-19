
window.TasksView=(function(){
  'use strict';
  var $=function(id){ return document.getElementById('t-'+id); };
  var esc=App.esc, iso=App.iso;

  var TYPES=['Activity','Quiz','Assignment','Midterm Exam','Final Exam','Final Project'];
  var SUBMISSIONS=['Google Forms','G-Drive','G-Classroom','E-mabini Portal','Padlet'];
  var PRI=['High','Medium','Low'], STS=['Not Started','In Progress','Done'];

  var tasks=[], meta={};
  var active='', sortKey='', sortDir=1, selected=new Set();

  var saver=null, changeHook=null;
  var save=function(){ if(saver) saver.queue(); if(changeHook) changeHook(); };
  function init(data,setStatus,hook){
    saver=App.createSaver('tasks',function(){ return {tasks:tasks,meta:meta}; },setStatus);
    changeHook=hook||null;
    if(data){ tasks=Array.isArray(data.tasks)?data.tasks:[]; meta=data.meta||{}; }
    meta.name=meta.name||''; meta.year=meta.year||''; meta.section=meta.section||'';
    if(!Array.isArray(meta.subjects)) meta.subjects=[];
    if(!Array.isArray(meta.hidden)) meta.hidden=[];
    $('pName').value=meta.name; $('pYear').value=meta.year; $('pSection').value=meta.section;
  }
  [['pName','name'],['pYear','year'],['pSection','section']].forEach(function(p){
    $(p[0]).addEventListener('input',function(e){ meta[p[1]]=e.target.value; save(); });
  });

  /* ---------- helpers ---------- */
  function fmtTime(t){
    if(!t) return '';
    var p=t.split(':'), h=+p[0];
    return ((h%12)||12)+':'+p[1]+' '+(h>=12?'PM':'AM');
  }
  function daysInfo(t){
    if(t.status==='Done') return {text:'Done ✓',c:'d-done'};
    if(!t.due) return {text:'—',c:'d-done'};
    var now=new Date();
    var a=new Date(iso(now)+'T00:00:00'), b=new Date(t.due+'T00:00:00');
    var n=Math.round((b-a)/86400000);
    if(n<0) return {text:'Overdue '+(-n)+'d',c:'d-over'};
    if(n===0){
      if(t.time&&new Date(t.due+'T'+t.time)<now) return {text:'Past deadline',c:'d-over'};
      return {text:'Due today'+(t.time?' '+fmtTime(t.time):''),c:'d-over'};
    }
    if(n<=3) return {text:n+' day'+(n>1?'s':''),c:'d-soon'};
    return {text:n+' days',c:'d-ok'};
  }
  function cls(s){ return String(s).replace(/ /g,''); }
  function opts(list,val,placeholder){
    var h=placeholder!==undefined?'<option value="">'+placeholder+'</option>':'';
    var all=(val&&list.indexOf(val)<0)?list.concat([val]):list;
    return h+all.map(function(o){ return '<option'+(o===val?' selected':'')+'>'+esc(o)+'</option>'; }).join('');
  }
  function subjName(id){ var s=meta.subjects.find(function(x){ return x.id===id; }); return s?s.name:''; }
  function subjOpts(val){
    return '<option value="">Choose subject</option>'+meta.subjects.map(function(s){
      return '<option value="'+s.id+'"'+(s.id===val?' selected':'')+'>'+esc(s.name||'(unnamed)')+'</option>';
    }).join('')+'<option value="__new__">+ Add subject…</option>';
  }

  /* ---------- columns ---------- */
  var COLS=[
    {k:'subject',l:'Subject',w:170,sort:function(t){ return subjName(t.subject).toLowerCase(); },
      html:function(t){ return '<select class="subj" data-f="subject">'+subjOpts(t.subject)+'</select>'; }},
    {k:'task',l:'Tasks',w:230,lock:true,sort:function(t){ return (t.task||'').toLowerCase(); },
      html:function(t){ return '<input data-f="task" value="'+esc(t.task)+'" placeholder="e.g. Problem set 3">'; }},
    {k:'type',l:'Type',w:130,sort:function(t){ return t.type||''; },
      html:function(t){ return '<select data-f="type">'+opts(TYPES,t.type)+'</select>'; }},
    {k:'assigned',l:'Date Assigned',w:125,sort:function(t){ return t.assigned||'9999'; },
      html:function(t){ return '<input type="date" data-f="assigned" value="'+esc(t.assigned)+'">'; }},
    {k:'due',l:'Due Date',w:125,sort:function(t){ return (t.due||'9999')+(t.time||''); },
      html:function(t){ return '<input type="date" data-f="due" value="'+esc(t.due)+'">'; }},
    {k:'time',l:'Time of Deadline',w:110,sort:function(t){ return t.time||'99'; },
      html:function(t){ return '<input type="time" data-f="time" value="'+esc(t.time)+'">'; }},
    {k:'priority',l:'Priority',w:100,sort:function(t){ return PRI.indexOf(t.priority); },
      html:function(t){ return '<select class="pri '+t.priority+'" data-f="priority">'+opts(PRI,t.priority)+'</select>'; }},
    {k:'status',l:'Progress / Status',w:130,sort:function(t){ return STS.indexOf(t.status); },
      html:function(t){ return '<select class="sts '+cls(t.status)+'" data-f="status">'+opts(STS,t.status)+'</select>'; }},
    {k:'days',l:'Days Left',w:130,cls:'days',sort:function(t){ return (t.status==='Done'?'z':'a')+(t.due||'9999')+(t.time||''); },
      html:function(t){ var x=daysInfo(t); return '<span class="'+x.c+'">'+x.text+'</span>'; }},
    {k:'link',l:'Notes / Link',w:180,sort:function(t){ return (t.link||'').toLowerCase(); },
      html:function(t){ return '<input data-f="link" value="'+esc(t.link)+'" placeholder="Paste link or note">'; }},
    {k:'submission',l:'Type of Submission',w:150,sort:function(t){ return t.submission||''; },
      html:function(t){ return '<select data-f="submission">'+opts(SUBMISSIONS,t.submission,'Choose')+'</select>'; }},
    {k:'resources',l:'Notes and Resources',w:200,sort:function(t){ return (t.resources||'').toLowerCase(); },
      html:function(t){ return '<input data-f="resources" value="'+esc(t.resources)+'" placeholder="Books, sites, reminders">'; }}
  ];
  var layout={v:[],ti:0,lefts:[]};

  function renderHead(){
    var v=COLS.filter(function(c){ return meta.hidden.indexOf(c.k)<0; });
    var ti=v.findIndex(function(c){ return c.k==='task'; });
    var lefts=[], left=44;
    v.forEach(function(c,i){ if(i<=ti){ lefts[i]=left; left+=c.w; } });
    layout={v:v,ti:ti,lefts:lefts};
    var widths=[44].concat(v.map(function(c){ return c.w; })).concat([84]);
    $('cg').innerHTML=widths.map(function(w){ return '<col style="width:'+w+'px">'; }).join('');
    $('tbl').style.width=widths.reduce(function(a,b){ return a+b; },0)+'px';
    $('hr').innerHTML='<th class="stk ck" style="left:0"><input type="checkbox" id="t-selAll" aria-label="Select all shown tasks"></th>'+
      v.map(function(c,i){
        var arrow=sortKey===c.k?(sortDir===1?' ▲':' ▼'):'';
        return '<th'+(i<=ti?' class="stk'+(i===ti?' stkl':'')+'" style="left:'+lefts[i]+'px"':'')+'>'+
          '<button class="hl" data-sort="'+c.k+'" title="Sort by '+esc(c.l)+'">'+esc(c.l)+arrow+'</button>'+
          (c.lock?'':'<button class="hx" data-hide="'+c.k+'" title="Remove this column" aria-label="Remove column '+esc(c.l)+'">✕</button>')+'</th>';
      }).join('')+'<th></th>';
    $('restoreCols').hidden=meta.hidden.length===0;
    $('restoreCols').textContent='Restore columns ('+meta.hidden.length+')';
  }

  function rowHtml(t){
    var L=layout, isSel=selected.has(t.id);
    return '<tr data-id="'+t.id+'"'+(isSel?' class="sel"':'')+'>'+
      '<td class="stk ck" style="left:0"><input type="checkbox" data-sel'+(isSel?' checked':'')+' aria-label="Select task"></td>'+
      L.v.map(function(c,i){
        return '<td class="'+(c.cls||'')+(i<=L.ti?' stk':'')+(i===L.ti?' stkl':'')+'"'+(i<=L.ti?' style="left:'+L.lefts[i]+'px"':'')+'>'+c.html(t)+'</td>';
      }).join('')+
      '<td class="act"><button data-dup title="Duplicate task" aria-label="Duplicate task">⧉</button><button data-del title="Delete task" aria-label="Delete task">✕</button></td></tr>';
  }

  /* ---------- filtering & sorting ---------- */
  function visible(){
    var q=$('q').value.trim().toLowerCase(), s=$('fStatus').value, p=$('fPri').value, du=$('fDue').value;
    var today=iso(new Date()), week=iso(new Date(Date.now()+7*86400000));
    var list=tasks.filter(function(t){
      if(active&&t.subject!==active) return false;
      if(s&&t.status!==s) return false;
      if(p&&t.priority!==p) return false;
      if(du==='overdue'&&!(t.status!=='Done'&&t.due&&t.due<today)) return false;
      if(du==='week'&&!(t.status!=='Done'&&t.due&&t.due>=today&&t.due<=week)) return false;
      if(du==='none'&&t.due) return false;
      if(q&&[t.task,t.type,t.link,t.submission,t.resources,subjName(t.subject)].join(' ').toLowerCase().indexOf(q)<0) return false;
      return true;
    });
    if(sortKey){
      var col=COLS.find(function(c){ return c.k===sortKey; });
      if(col){
        list=list.map(function(t,i){ return {t:t,i:i,k:col.sort(t)}; }).sort(function(a,b){
          return (a.k<b.k?-1:a.k>b.k?1:0)*sortDir||a.i-b.i;
        }).map(function(x){ return x.t; });
      }
    }
    return list;
  }

  /* ---------- rendering ---------- */
  function renderStats(){
    var today=iso(new Date());
    var total=tasks.length, done=tasks.filter(function(t){ return t.status==='Done'; }).length;
    var prog=tasks.filter(function(t){ return t.status==='In Progress'; }).length;
    var over=tasks.filter(function(t){ return t.status!=='Done'&&t.due&&t.due<today; }).length;
    var pct=total?Math.round(done/total*100):0;
    $('stats').innerHTML='<div class="tiles">'+[['Total',total],['In progress',prog],['Done',done],['Overdue',over]].map(function(x){
      return '<div class="stat"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>';
    }).join('')+'</div><div class="pbar"><i style="width:'+pct+'%"></i></div><div class="plabel">'+done+' of '+total+' tasks done ('+pct+'%)</div>';
  }
  function renderChips(){
    var open=function(t){ return t.status!=='Done'; };
    var h='<button class="chip'+(active===''?' on':'')+'" data-s="">All <small>'+tasks.filter(open).length+'</small></button>';
    meta.subjects.forEach(function(sb){
      h+='<button class="chip'+(active===sb.id?' on':'')+'" data-s="'+sb.id+'"><span class="cl">'+esc(sb.name||'(unnamed)')+'</span><small>'+
        tasks.filter(function(t){ return t.subject===sb.id&&open(t); }).length+'</small></button>';
    });
    h+='<button class="chip edit" id="t-editSubj">'+(meta.subjects.length?'✎ Edit subjects':'+ Add subject')+'</button>';
    $('noSubj').hidden=meta.subjects.length>0;
    $('chips').innerHTML=h;
  }
  function updateSelUI(){
    var n=selected.size;
    $('delSel').disabled=n===0;
    $('delSel').textContent=n?'Delete selected ('+n+')':'Delete selected';
    var all=$('selAll');
    if(all){
      var vis=visible();
      all.checked=vis.length>0&&vis.every(function(t){ return selected.has(t.id); });
    }
  }
  function renderTable(){
    var list=visible();
    $('body').innerHTML=list.map(rowHtml).join('');
    var empty=$('empty');
    empty.hidden=list.length>0;
    empty.textContent=tasks.length?'No tasks match your filters.':'No tasks yet. Click “Add task” to start.';
    renderStats(); updateSelUI();
  }
  function render(){ renderHead(); renderTable(); renderChips(); }

  /* ---------- deleting ---------- */
  async function removeTasks(ids,message){
    if(!ids.length) return;
    if(!(await App.ask(message))) return;
    var removed=tasks.filter(function(t){ return ids.indexOf(t.id)>-1; });
    tasks=tasks.filter(function(t){ return ids.indexOf(t.id)<0; });
    ids.forEach(function(id){ selected.delete(id); });
    save(); render();
    App.toast(removed.length+' task'+(removed.length>1?'s':'')+' deleted','Undo',function(){
      removed.forEach(function(t){ if(!tasks.some(function(x){ return x.id===t.id; })) tasks.push(t); });
      save(); render();
    });
  }
  $('delSel').onclick=function(){
    var ids=Array.from(selected).filter(function(id){ return tasks.some(function(t){ return t.id===id; }); });
    removeTasks(ids,'Delete '+ids.length+' selected task'+(ids.length>1?'s':'')+'?');
  };
  $('clearDone').onclick=function(){
    var ids=tasks.filter(function(t){ return t.status==='Done'; }).map(function(t){ return t.id; });
    if(!ids.length){ App.toast('No completed tasks to clear.'); return; }
    removeTasks(ids,'Delete all '+ids.length+' completed task'+(ids.length>1?'s':'')+'?');
  };

  /* ---------- table events ---------- */
  function onChange(e){
    var el=e.target, tr=el.closest('tr'); if(!tr) return;
    if(el.hasAttribute('data-sel')){
      if(el.checked) selected.add(tr.dataset.id); else selected.delete(tr.dataset.id);
      tr.classList.toggle('sel',el.checked);
      updateSelUI(); return;
    }
    if(!el.dataset.f) return;
    var t=tasks.find(function(x){ return x.id===tr.dataset.id; }); if(!t) return;
    var f=el.dataset.f;
    if(f==='subject'&&el.value==='__new__'){ el.value=t.subject||''; openSubjPanel(true); return; }
    t[f]=el.value; save();
    if(f==='due'||f==='time'||f==='status'){
      var dc=tr.querySelector('.days');
      if(dc){ var x=daysInfo(t); dc.innerHTML='<span class="'+x.c+'">'+x.text+'</span>'; }
    }
    if(f==='priority') el.className='pri '+t.priority;
    if(f==='status') el.className='sts '+cls(t.status);
    if(f==='due'||f==='status'||f==='subject'){ renderStats(); renderChips(); }
    if(sortKey&&(f===sortKey||(sortKey==='days'&&(f==='due'||f==='status')))&&e.type==='change') renderTable();
  }
  $('body').addEventListener('input',onChange);
  $('body').addEventListener('change',onChange);
  $('body').addEventListener('click',function(e){
    var tr=e.target.closest('tr'); if(!tr) return;
    if(e.target.closest('[data-del]')){
      var t=tasks.find(function(x){ return x.id===tr.dataset.id; });
      removeTasks([tr.dataset.id],'Delete "'+((t&&t.task)||'this task')+'"?');
    }
    if(e.target.closest('[data-dup]')){
      var src=tasks.find(function(x){ return x.id===tr.dataset.id; }); if(!src) return;
      var copy=JSON.parse(JSON.stringify(src));
      copy.id=newId(); copy.task=(src.task||'')+' (copy)'; copy.status='Not Started';
      tasks.splice(tasks.indexOf(src)+1,0,copy);
      save(); render();
    }
  });
  $('hr').addEventListener('click',async function(e){
    var s=e.target.closest('[data-sort]'), h=e.target.closest('[data-hide]');
    if(s){
      var k=s.dataset.sort;
      if(sortKey!==k){ sortKey=k; sortDir=1; }
      else if(sortDir===1) sortDir=-1;
      else { sortKey=''; sortDir=1; }
      renderHead(); renderTable();
    }
    if(h){
      var col=COLS.find(function(c){ return c.k===h.dataset.hide; });
      var ok=await App.ask('Remove the "'+col.l+'" column? Your data stays saved, and you can bring the column back with "Restore columns".','Remove');
      if(!ok) return;
      meta.hidden.push(col.k);
      if(sortKey===col.k) sortKey='';
      save(); render();
    }
  });
  $('hr').addEventListener('change',function(e){
    if(e.target.id!=='t-selAll') return;
    visible().forEach(function(t){ if(e.target.checked) selected.add(t.id); else selected.delete(t.id); });
    $('body').querySelectorAll('[data-sel]').forEach(function(c){
      c.checked=e.target.checked; c.closest('tr').classList.toggle('sel',e.target.checked);
    });
    updateSelUI();
  });
  $('restoreCols').onclick=function(){ meta.hidden=[]; save(); render(); };

  /* ---------- subjects ---------- */
  function renderSubjPanel(){
    $('subjList').innerHTML=meta.subjects.map(function(s){
      return '<div class="subjrow" data-id="'+s.id+'"><input value="'+esc(s.name)+'" placeholder="Subject name" aria-label="Subject name"><button data-rm aria-label="Remove subject" title="Remove">✕</button></div>';
    }).join('');
  }
  $('chips').addEventListener('click',function(e){
    if(e.target.closest('#t-editSubj')){ renderSubjPanel(); $('subjPanel').hidden=false; return; }
    var c=e.target.closest('.chip'); if(!c) return; active=c.dataset.s; render();
  });
  $('subjList').addEventListener('input',function(e){
    var row=e.target.closest('.subjrow'); if(!row) return;
    var s=meta.subjects.find(function(x){ return x.id===row.dataset.id; }); if(!s) return;
    s.name=e.target.value; save(); render();
  });
  $('subjList').addEventListener('click',async function(e){
    var b=e.target.closest('[data-rm]'); if(!b) return;
    var id=b.closest('.subjrow').dataset.id;
    var used=tasks.filter(function(t){ return t.subject===id; }).length;
    var ok=await App.ask(used?'Remove this subject? Its '+used+' task(s) will stay but have no subject.':'Remove this subject?','Remove');
    if(!ok) return;
    meta.subjects=meta.subjects.filter(function(s){ return s.id!==id; });
    tasks.forEach(function(t){ if(t.subject===id) t.subject=''; });
    if(active===id) active='';
    save(); renderSubjPanel(); render();
  });
  $('subjAdd').onclick=function(){
    meta.subjects.push({id:'s'+Date.now(),name:''}); save(); renderSubjPanel(); render();
    var inp=$('subjList').querySelectorAll('input'); if(inp.length) inp[inp.length-1].focus();
  };
  $('subjDone').onclick=function(){
    meta.subjects=meta.subjects.filter(function(s){
      return s.name.trim()||tasks.some(function(x){ return x.subject===s.id; });
    });
    if(!meta.subjects.some(function(s){ return s.id===active; })) active='';
    save(); $('subjPanel').hidden=true; render();
  };
  function openSubjPanel(addNew){
    renderSubjPanel(); $('subjPanel').hidden=false;
    if(addNew) $('subjAdd').click();
  }
  $('noSubjBtn').onclick=function(){ openSubjPanel(true); };

  /* ---------- toolbar ---------- */
  function newId(){ return 't'+Date.now()+Math.random().toString(36).slice(2,6); }
  function newTask(){
    return {id:newId(),subject:active,task:'',type:'Activity',assigned:iso(new Date()),due:'',time:'',priority:'Medium',status:'Not Started',link:'',submission:'',resources:''};
  }
  $('add').onclick=function(){
    $('q').value=''; $('fStatus').value=''; $('fPri').value=''; $('fDue').value=''; sortKey='';
    tasks.push(newTask()); save(); render();
    var inputs=$('body').querySelectorAll('input[data-f="task"]');
    if(inputs.length){ var last=inputs[inputs.length-1]; last.scrollIntoView({block:'nearest'}); last.focus(); }
  };
  ['q','fStatus','fPri','fDue'].forEach(function(id){ $(id).addEventListener('input',renderTable); });
  $('sortDue').onclick=function(){ sortKey='due'; sortDir=1; renderHead(); renderTable(); };

  $('exportCsv').onclick=function(){
    var head=['Subject','Task','Type','Date Assigned','Due Date','Time of Deadline','Priority','Status','Days Left','Notes / Link','Type of Submission','Notes and Resources'];
    var q=function(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; };
    var rows=[head.map(q).join(',')].concat(tasks.map(function(t){
      return [subjName(t.subject),t.task,t.type,t.assigned,t.due,t.time,t.priority,t.status,daysInfo(t).text,t.link,t.submission,t.resources].map(q).join(',');
    }));
    var blob=new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download='school-tasks.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); },1000);
  };
  $('import').onclick=function(){
    App.openImport({app:'tasks',label:'tasks',merge:function(data){
      if(!data||!Array.isArray(data.tasks)) throw new Error('bad');
      var m=data.meta||{};
      if(Array.isArray(m.subjects)) m.subjects.forEach(function(x){
        if(x&&x.id&&!meta.subjects.some(function(y){ return y.id===x.id; })) meta.subjects.push({id:x.id,name:x.name||''});
      });
      ['name','year','section'].forEach(function(k){ if(!meta[k]&&m[k]) meta[k]=m[k]; });
      $('pName').value=meta.name; $('pYear').value=meta.year; $('pSection').value=meta.section;
      var n=0;
      data.tasks.forEach(function(x){
        if(x&&x.id&&!tasks.some(function(y){ return y.id===x.id; })){
          if(x.task===undefined){ x.task=x.subject||''; x.subject=''; }
          tasks.push(x); n++;
        }
      });
      if(n||true){ save(); render(); }
      return n;
    }});
  };

  function overdueCount(){
    var today=iso(new Date());
    return tasks.filter(function(x){ return x.status!=='Done'&&x.due&&x.due<today; }).length;
  }
  return {init:init, show:function(){ render(); }, getTasks:function(){ return tasks; }, overdueCount:overdueCount};
})();
