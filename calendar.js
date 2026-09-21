
window.CalendarView=(function(){
  'use strict';
  var $=function(id){ return document.getElementById('c-'+id); };
  var esc=App.esc, iso=App.iso;
  var COLORS=['#1f5eff','#0e8ea6','#12a375','#6b9a1a','#c99a06','#e0662b','#d63b3b','#c23b8f','#7a4fe0','#3949ab','#8a5a3c','#5b6b82'];
  var DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

  var events=[], tasks=[], showTasks=true;
  var view='month', cursor=new Date(); cursor.setHours(0,0,0,0);
  var query='', selDate=null, editId=null, selColor=COLORS[0];

  var saver=null, getTasks=function(){ return []; };
  var save=function(){ if(saver) saver.queue(); };
  function init(data,setStatus,tasksGetter){
    saver=App.createSaver('calendar',function(){ return {events:events,showTasks:showTasks}; },setStatus);
    getTasks=tasksGetter||getTasks;
    if(data){
      events=Array.isArray(data.events)?data.events:[];
      if(typeof data.showTasks==='boolean') showTasks=data.showTasks;
    }
    $('showTasks').checked=showTasks;
  }

  function parse(key){ return new Date(key+'T00:00:00'); }
  function addDays(dt,n){ var x=new Date(dt); x.setDate(x.getDate()+n); return x; }

  function occurs(e,dt){
    var k=iso(dt);
    if(k<e.date) return false;
    var r=e.repeat||'none';
    if(r==='none') return k===e.date;
    var s=parse(e.date);
    if(r==='daily') return true;
    if(r==='weekly') return s.getDay()===dt.getDay();
    if(r==='monthly') return s.getDate()===dt.getDate();
    if(r==='yearly') return s.getMonth()===dt.getMonth()&&s.getDate()===dt.getDate();
    return false;
  }
  function matches(text){ return !query||String(text||'').toLowerCase().indexOf(query)>-1; }

  function itemsFor(dt){
    var k=iso(dt), out=[];
    events.forEach(function(e){
      if(occurs(e,dt)&&(matches(e.title)||matches(e.notes))) out.push({kind:'event',e:e});
    });
    out.sort(function(a,b){ return (a.e.start||'').localeCompare(b.e.start||''); });
    if(showTasks){
      getTasks().forEach(function(t){
        if(t.due===k&&t.status!=='Done'&&matches(t.task)) out.push({kind:'task',t:t});
      });
    }
    return out;
  }
  function label(it){
    if(it.kind==='task') return '📌 '+(it.t.time?it.t.time+' ':'')+(it.t.task||'Untitled task');
    return (it.e.start?it.e.start+' ':'')+(it.e.repeat&&it.e.repeat!=='none'?'↻ ':'')+it.e.title;
  }
  function chip(it,todayKey,dayKey){
    if(it.kind==='task'){
      var late=dayKey<todayKey?' late':'';
      return '<div class="ev task'+late+'" data-task="1" title="Task deadline – click to open tasks">'+esc(label(it))+'</div>';
    }
    return '<div class="ev" data-id="'+it.e.id+'" style="background:'+safeColor(it.e.color)+';color:'+inkFor(it.e.color)+'">'+esc(label(it))+'</div>';
  }

  function render(){
    var todayKey=iso(new Date());
    document.querySelectorAll('#c-views button').forEach(function(b){ b.classList.toggle('on',b.dataset.v===view); });
    var html='';
    if(view==='agenda'){
      $('title').textContent='Next 30 days';
      var rows='';
      for(var i=0;i<30;i++){
        var dt=addDays(cursor,i), its=itemsFor(dt);
        if(!its.length) continue;
        var key=iso(dt);
        rows+='<div class="agday"><div class="agdate'+(key===todayKey?' today':'')+'" data-date="'+key+'">'+
          dt.getDate()+' '+MONTHS[dt.getMonth()].slice(0,3)+'<small>'+DOW[dt.getDay()]+'</small></div><div class="aglist">'+
          its.map(function(it){
            if(it.kind==='task') return '<div class="ag" data-task="1"><span class="dot" style="background:transparent;border:2px dashed var(--muted)"></span><span>📌 '+esc(it.t.task||'Untitled task')+'</span><small>Task deadline'+(it.t.time?' · '+esc(it.t.time):'')+'</small></div>';
            return '<div class="ag" data-id="'+it.e.id+'" data-date="'+key+'"><span class="dot" style="background:'+safeColor(it.e.color)+'"></span><span>'+esc(it.e.title)+'</span><small>'+
              (it.e.start?esc(it.e.start)+(it.e.end?' – '+esc(it.e.end):''):'All day')+(it.e.repeat&&it.e.repeat!=='none'?' · repeats':'')+'</small></div>';
          }).join('')+'</div></div>';
      }
      html='<div class="agenda">'+(rows||'<div class="empty">Nothing scheduled in the next 30 days.</div>')+'</div>';
    }else{
      var start, count, isWeek=view==='week';
      if(isWeek){
        start=addDays(cursor,-cursor.getDay()); count=7;
        var end=addDays(start,6);
        $('title').textContent=MONTHS[start.getMonth()].slice(0,3)+' '+start.getDate()+' – '+
          (end.getMonth()!==start.getMonth()?MONTHS[end.getMonth()].slice(0,3)+' ':'')+end.getDate()+', '+end.getFullYear();
      }else{
        var first=new Date(cursor.getFullYear(),cursor.getMonth(),1);
        start=addDays(first,-first.getDay());
        var last=new Date(cursor.getFullYear(),cursor.getMonth()+1,0);
        count=Math.ceil((first.getDay()+last.getDate())/7)*7;
        $('title').textContent=MONTHS[cursor.getMonth()]+' '+cursor.getFullYear();
      }
      var cells='';
      for(var j=0;j<count;j++){
        var day=addDays(start,j), k=iso(day), its2=itemsFor(day);
        var off=!isWeek&&day.getMonth()!==cursor.getMonth();
        var max=isWeek?999:3;
        cells+='<div class="day'+(off?' off':'')+(k===todayKey?' today':'')+'" data-date="'+k+'" tabindex="0" role="button" aria-label="'+esc(k)+'">'+
          '<span class="num">'+day.getDate()+'</span>'+
          its2.slice(0,max).map(function(it){ return chip(it,todayKey,k); }).join('')+
          (its2.length>max?'<div class="more">+'+(its2.length-max)+' more</div>':'')+'</div>';
      }
      html='<div class="dow">'+DOW.map(function(x){ return '<div>'+x+'</div>'; }).join('')+'</div><div class="grid'+(isWeek?' week':'')+'">'+cells+'</div>';
    }
    $('cal').innerHTML=html;
  }

  /* ---- event dialog ---- */
  function safeColor(c){ return /^#[0-9a-fA-F]{6}$/.test(c||'')?c:COLORS[0]; }
  function inkFor(c){
    var n=parseInt(safeColor(c).slice(1),16), r=(n>>16)&255, g=(n>>8)&255, b=n&255;
    return (0.299*r+0.587*g+0.114*b)>165?'#1b2333':'#ffffff';
  }
  var colorsBuilt=false;
  function markSel(){
    $('colors').querySelectorAll('button[data-c]').forEach(function(b){ b.classList.toggle('sel',b.dataset.c===selColor); });
    var cust=$('cust'), inp=$('custIn'), isC=COLORS.indexOf(selColor)<0;
    cust.classList.toggle('sel',isC);
    cust.style.background=isC?selColor:'';
    cust.querySelector('span').style.color=isC?inkFor(selColor):'';
    inp.value=safeColor(selColor);
  }
  function renderColors(){
    if(!colorsBuilt){
      $('colors').innerHTML=COLORS.map(function(c){
        return '<button type="button" data-c="'+c+'" style="background:'+c+'" aria-label="Color '+c+'"></button>';
      }).join('')+'<label class="cswatch" id="c-cust" title="Pick any color"><input type="color" id="c-custIn" value="#1f5eff" aria-label="Custom color"><span>+</span></label>';
      colorsBuilt=true;
    }
    markSel();
  }

  function resetForm(dateKey){
    editId=null; selColor=COLORS[0];
    $('fTitle').value=''; $('fDate').value=dateKey||iso(new Date()); $('fRepeat').value='none';
    $('fStart').value=''; $('fEnd').value=''; $('fNotes').value=''; $('evErr').textContent='';
    $('dlgTitle').textContent='Add event'; $('save').textContent='Add event'; $('del').hidden=true;
    renderColors();
  }
  function fillForm(e){
    editId=e.id; selColor=safeColor(e.color);
    $('fTitle').value=e.title; $('fDate').value=e.date; $('fRepeat').value=e.repeat||'none';
    $('fStart').value=e.start||''; $('fEnd').value=e.end||''; $('fNotes').value=e.notes||''; $('evErr').textContent='';
    $('dlgTitle').textContent='Edit event'; $('save').textContent='Save changes'; $('del').hidden=false;
    renderColors();
  }
  function renderDayList(dateKey){
    var its=itemsFor(parse(dateKey)).filter(function(i){ return i.kind==='event'; });
    $('dayList').hidden=false;
    $('dayList').innerHTML=its.length?its.map(function(it){
      return '<div class="item" data-id="'+it.e.id+'"><span class="dot" style="background:'+safeColor(it.e.color)+'"></span><div><div>'+esc(it.e.title)+'</div><small>'+
        (it.e.start?esc(it.e.start)+(it.e.end?' – '+esc(it.e.end):''):'All day')+'</small></div></div>';
    }).join(''):'<small style="color:var(--muted)">Nothing scheduled this day yet.</small>';
  }
  function openDialog(dateKey,id){
    resetForm(dateKey);
    if(dateKey) renderDayList(dateKey); else $('dayList').hidden=true;
    if(id){ var e=events.find(function(x){ return x.id===id; }); if(e) fillForm(e); }
    if(!$('evDlg').open) $('evDlg').showModal();
    $('fTitle').focus();
  }

  $('cal').addEventListener('click',function(e){
    if(e.target.closest('[data-task]')){ App.go('tasks'); return; }
    var evEl=e.target.closest('[data-id]'), dayEl=e.target.closest('[data-date]');
    if(evEl){
      var ev=events.find(function(x){ return x.id===evEl.dataset.id; });
      openDialog((dayEl&&dayEl.dataset.date)||(ev&&ev.date),evEl.dataset.id); return;
    }
    if(dayEl&&view!=='agenda') openDialog(dayEl.dataset.date);
  });
  $('cal').addEventListener('keydown',function(e){
    if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('day')){ e.preventDefault(); openDialog(e.target.dataset.date); }
  });
  $('dayList').addEventListener('click',function(e){
    var it=e.target.closest('.item'); if(!it) return;
    var ev=events.find(function(x){ return x.id===it.dataset.id; }); if(ev) fillForm(ev);
  });
  $('colors').addEventListener('click',function(e){
    var b=e.target.closest('button[data-c]'); if(!b) return; selColor=b.dataset.c; markSel();
  });
  $('colors').addEventListener('input',function(e){
    if(e.target.id==='c-custIn'){ selColor=e.target.value; markSel(); }
  });
  $('save').onclick=function(){
    var title=$('fTitle').value.trim();
    if(!title){ $('evErr').textContent='Give the event a title.'; $('fTitle').focus(); return; }
    if(!$('fDate').value){ $('evErr').textContent='Pick a date.'; return; }
    if($('fStart').value&&$('fEnd').value&&$('fEnd').value<$('fStart').value){ $('evErr').textContent='End time must be after the start time.'; return; }
    var data={title:title,date:$('fDate').value,repeat:$('fRepeat').value,start:$('fStart').value,end:$('fEnd').value,notes:$('fNotes').value,color:selColor};
    if(editId){ Object.assign(events.find(function(x){ return x.id===editId; }),data); }
    else events.push(Object.assign({id:'e'+Date.now()+Math.random().toString(36).slice(2,6)},data));
    save(); render();
    if($('dayList').hidden) $('evDlg').close(); else { renderDayList(data.date); resetForm(data.date); }
  };
  $('del').onclick=async function(){
    var e=events.find(function(x){ return x.id===editId; }); if(!e) return;
    var repeating=e.repeat&&e.repeat!=='none';
    var ok=await App.ask(repeating?'Delete "'+e.title+'" and all of its repeats?':'Delete "'+e.title+'"?');
    if(!ok) return;
    var removed=e;
    events=events.filter(function(x){ return x.id!==editId; });
    save(); render();
    if($('dayList').hidden) $('evDlg').close(); else { renderDayList(removed.date); resetForm(removed.date); }
    App.toast('Event deleted','Undo',function(){ events.push(removed); save(); render(); });
  };
  $('close').onclick=function(){ $('evDlg').close(); };
  $('evDlg').addEventListener('click',function(e){ if(e.target===$('evDlg')) $('evDlg').close(); });

  /* ---- toolbar ---- */
  $('views').addEventListener('click',function(e){ var b=e.target.closest('button'); if(b){ view=b.dataset.v; render(); } });
  function step(n){
    if(view==='month') cursor=new Date(cursor.getFullYear(),cursor.getMonth()+n,1);
    else if(view==='week') cursor=addDays(cursor,7*n);
    else cursor=addDays(cursor,30*n);
    render();
  }
  $('prev').onclick=function(){ step(-1); };
  $('next').onclick=function(){ step(1); };
  $('today').onclick=function(){ cursor=new Date(); cursor.setHours(0,0,0,0); render(); };
  $('q').addEventListener('input',function(){ query=$('q').value.trim().toLowerCase(); render(); });
  $('showTasks').addEventListener('change',function(){ showTasks=$('showTasks').checked; save(); render(); });
  $('addEv').onclick=function(){ openDialog(iso(new Date())); };
  $('import').onclick=function(){
    App.openImport({app:'calendar',label:'calendar events',merge:function(data){
      if(!data||!Array.isArray(data.events)) throw new Error('bad');
      var n=0;
      data.events.forEach(function(x){
        if(x&&x.id&&x.date&&x.title&&!events.some(function(y){ return y.id===x.id; })){ events.push(x); n++; }
      });
      if(n){ save(); render(); }
      return n;
    }});
  };

  return {init:init, show:function(){ render(); }};
})();
