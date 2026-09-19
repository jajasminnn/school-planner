/* App shell: left panel, routing between Calendar / Tasks / Notes, loading and status. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var VIEWS = ['calendar', 'tasks', 'notes'];
  var TITLES = { calendar: 'Calendar', tasks: 'Tasks', notes: 'Notes' };
  var started = false;

  App.view = '';
  App.go = function (view, arg) { location.hash = '#' + view + (arg ? '/' + arg : ''); };

  function setStatus(t) { var s = $('saveStatus'); if (s) s.textContent = t; }

  function parseHash() {
    var p = (location.hash || '').replace(/^#/, '').split('/');
    return { view: VIEWS.indexOf(p[0]) > -1 ? p[0] : 'calendar', arg: p[1] || '' };
  }

  function updateBadge() {
    var n = TasksView.overdueCount();
    var b = $('taskBadge');
    b.hidden = n === 0;
    b.textContent = n;
    b.title = n + ' overdue task' + (n === 1 ? '' : 's');
  }

  function route() {
    if (!started) return;
    var r = parseHash();
    App.view = r.view;
    VIEWS.forEach(function (v) { $('view-' + v).hidden = v !== r.view; });
    if (r.view === 'calendar') CalendarView.show();
    if (r.view === 'tasks') TasksView.show();
    if (r.view === 'notes') NotesView.show(r.arg);
    NotesView.renderSidebar();
    var onFolder = !!document.querySelector('#folderList a.on');
    document.querySelectorAll('.snav > a[data-v]').forEach(function (a) {
      a.classList.toggle('on', a.dataset.v === r.view && !(r.view === 'notes' && onFolder));
    });
    $('mobTitle').textContent = TITLES[r.view];
    document.title = TITLES[r.view] + ' – School Planner';
    document.body.classList.remove('menu');
    window.scrollTo(0, 0);
  }

  function wireShell() {
    $('menuBtn').onclick = function () { document.body.classList.toggle('menu'); };
    $('scrim').onclick = function () { document.body.classList.remove('menu'); };
    $('themeBtn').onclick = App.toggleTheme;
    $('newFolder').onclick = function () { NotesView.newFolder(); };

    if (App.auth.cloud) {
      $('bkBtn').hidden = true; $('rsBtn').hidden = true;
      $('logoutBtn').hidden = false;
      $('logoutBtn').onclick = async function () {
        try { await App.auth.signOut(); } catch (e) { /* ignore */ }
        location.href = 'login.html';
      };
      App.auth.ready().then(function () {
        var u = App.auth.user();
        if (u) $('who').textContent = '👤 ' + u.email;
      }).catch(function () {});
    } else {
      $('who').textContent = '💾 Saved on this device';
      $('bkBtn').onclick = App.backupLocal;
      $('rsBtn').onclick = function () { $('rsFile').click(); };
      $('rsFile').addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        if (f) App.restoreLocal(f);
        e.target.value = '';
      });
    }
  }

  async function start() {
    wireShell();
    var data;
    try {
      data = await Promise.all([App.load('calendar'), App.load('tasks'), App.load('notes')]);
    } catch (e) {
      if (e && e.message === 'Please log in.') return; // being sent to the login page
      $('loading').hidden = true;
      $('loadErr').hidden = false;
      $('loadErr').textContent = (e && e.message) || 'Could not load your data. Refresh the page to try again.';
      return;
    }
    TasksView.init(data[1], setStatus, updateBadge);
    CalendarView.init(data[0], setStatus, TasksView.getTasks);
    NotesView.init(data[2], setStatus);
    $('loading').hidden = true;
    started = true;
    updateBadge();
    setStatus(App.auth.cloud ? 'All changes saved' : 'Saved on this device');
    window.addEventListener('hashchange', route);
    route();
  }

  start();
})();
