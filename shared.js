/*
 * Shared helpers: theme, storage, login, auto-save, navigation, dialogs, toast.
 *
 * Two modes, chosen automatically:
 *  - Local mode  (firebase-config.js is null): no login, data is saved in this browser.
 *  - Cloud mode  (Firebase config filled in): email + password login, data saved to Firestore.
 */
(function () {
  'use strict';

  try {
    var savedTheme = localStorage.getItem('theme');
    if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  } catch (e) { /* ignore */ }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function toggleTheme() {
    var r = document.documentElement;
    var dark = r.dataset.theme === 'dark' || (r.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    r.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', r.dataset.theme); } catch (e) { /* ignore */ }
  }

  /* ---------- mode + Firebase ---------- */
  var CFG = window.FIREBASE_CONFIG;
  var cloud = !!(CFG && CFG.apiKey && CFG.projectId);
  var fb = null;
  var SDK = window.FIREBASE_SDK_BASE || 'https://www.gstatic.com/firebasejs/10.12.2/';

  var ready = (async function () {
    if (!cloud) return;
    var m = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js')
    ]);
    var app = m[0].initializeApp(CFG);
    fb = { A: m[1], F: m[2], auth: m[1].getAuth(app), db: m[2].getFirestore(app) };
    // wait until Firebase has restored any existing login
    await new Promise(function (resolve) {
      var off = null, fired = false;
      off = fb.A.onAuthStateChanged(fb.auth, function () {
        fired = true;
        if (off) off();
        resolve();
      });
      if (fired && off) off();
    });
  })();
  ready.catch(function () { /* handled where it is used */ });

  async function ensure() {
    try { await ready; }
    catch (e) { throw new Error('Could not reach the login service. Check your internet connection and refresh.'); }
    if (cloud && !fb.auth.currentUser) {
      location.href = 'login.html';
      throw new Error('Please log in.');
    }
  }

  function friendly(e) {
    var map = {
      'auth/invalid-credential': 'Wrong email or password.',
      'auth/wrong-password': 'Wrong email or password.',
      'auth/user-not-found': 'Wrong email or password.',
      'auth/invalid-email': 'That email address does not look right.',
      'auth/email-already-in-use': 'An account with that email already exists. Try logging in.',
      'auth/weak-password': 'Password must be at least 8 characters.',
      'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
      'auth/network-request-failed': 'Could not connect. Check your internet connection.',
      'auth/operation-not-allowed': 'Email/password login is not turned on in Firebase yet (see README).',
      'auth/unauthorized-domain': 'This website address is not on your Firebase "Authorized domains" list (see README).'
    };
    return new Error(map[e && e.code] || 'Something went wrong. Please try again.');
  }

  var auth = {
    cloud: cloud,
    ready: function () { return ready; },
    user: function () { return fb && fb.auth.currentUser ? fb.auth.currentUser : null; },
    signIn: async function (email, pw) {
      await ready;
      try { await fb.A.signInWithEmailAndPassword(fb.auth, email, pw); } catch (e) { throw friendly(e); }
    },
    signUp: async function (email, pw) {
      await ready;
      try { await fb.A.createUserWithEmailAndPassword(fb.auth, email, pw); } catch (e) { throw friendly(e); }
    },
    reset: async function (email) {
      await ready;
      try { await fb.A.sendPasswordResetEmail(fb.auth, email); } catch (e) { throw friendly(e); }
    },
    signOut: async function () { await ready; await fb.A.signOut(fb.auth); }
  };

  /* ---------- storage ---------- */
  var LS = 'school-planner-';
  function docRef(app) {
    return fb.F.doc(fb.db, 'users', fb.auth.currentUser.uid, 'data', app);
  }
  async function load(app) {
    await ensure();
    if (!cloud) {
      try { return JSON.parse(localStorage.getItem(LS + app)) || null; } catch (e) { return null; }
    }
    var snap = await fb.F.getDoc(docRef(app));
    if (!snap.exists()) return null;
    return JSON.parse(snap.data().json);
  }
  async function put(app, data) {
    await ensure();
    var json = JSON.stringify(data);
    if (!cloud) { localStorage.setItem(LS + app, json); return; }
    if (json.length > 900000) { var big = new Error('TOO_LARGE'); throw big; }
    await fb.F.setDoc(docRef(app), { json: json, updatedAt: Date.now() });
  }

  function createSaver(app, getData, onStatus) {
    var timer = null, busy = false, again = false;
    var okText = cloud ? 'All changes saved' : 'Saved on this device';
    async function run() {
      if (busy) { again = true; return; }
      busy = true; again = false;
      onStatus('Saving…');
      var failed = false;
      try { await put(app, getData()); onStatus(okText); }
      catch (e) {
        if (e && e.message === 'TOO_LARGE') { onStatus('Too much data to save – delete some notes'); busy = false; return; }
        failed = true; onStatus('Not saved – retrying…');
      }
      busy = false;
      if (failed) setTimeout(run, 5000);
      else if (again) run();
    }
    function queue() {
      clearTimeout(timer);
      onStatus('Unsaved changes…');
      timer = setTimeout(function () { timer = null; run(); }, cloud ? 600 : 100);
    }
    function flush() { if (timer) { clearTimeout(timer); timer = null; run(); } }
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);
    return { queue: queue, flush: flush };
  }

  /* ---------- confirm dialog & toast ---------- */
  function ask(message, okLabel) {
    return new Promise(function (resolve) {
      var d = document.createElement('dialog');
      d.innerHTML = '<div class="dlg"><p style="font-size:1rem">' + esc(message) + '</p>' +
        '<div class="actions"><button data-no>Cancel</button><button class="danger" data-ok>' + esc(okLabel || 'Delete') + '</button></div></div>';
      document.body.appendChild(d);
      var done = false;
      function finish(v) {
        if (done) return;
        done = true;
        try { d.close(); } catch (e) { /* ignore */ }
        d.remove();
        resolve(v);
      }
      d.querySelector('[data-ok]').onclick = function () { finish(true); };
      d.querySelector('[data-no]').onclick = function () { finish(false); };
      d.addEventListener('cancel', function () { finish(false); });
      d.showModal();
      d.querySelector('[data-no]').focus();
    });
  }
  function toast(message, actionLabel, action) {
    var box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = '<span>' + esc(message) + '</span>' + (actionLabel ? '<button>' + esc(actionLabel) + '</button>' : '');
    box.appendChild(t);
    var timer = setTimeout(function () { t.remove(); }, 7000);
    if (actionLabel) {
      t.querySelector('button').onclick = function () { clearTimeout(timer); t.remove(); action(); };
    }
  }

  /* ---------- backup / restore (local mode) ---------- */
  function downloadFile(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function backupLocal() {
    var out = { app: 'school-planner-backup', version: 2 };
    ['calendar', 'tasks', 'notes'].forEach(function (k) {
      try { out[k] = JSON.parse(localStorage.getItem(LS + k)); } catch (e) { out[k] = null; }
    });
    downloadFile('school-planner-backup.json', JSON.stringify(out, null, 2), 'application/json');
  }
  function restoreLocal(file) {
    var r = new FileReader();
    r.onload = async function () {
      try {
        var o = JSON.parse(r.result);
        if (!o || o.app !== 'school-planner-backup') throw new Error('bad');
        var ok = await ask('Replace the calendar, tasks and notes on this device with the ones in this backup?', 'Restore');
        if (!ok) return;
        ['calendar', 'tasks', 'notes'].forEach(function (k) {
          if (o[k]) localStorage.setItem(LS + k, JSON.stringify(o[k]));
        });
        location.reload();
      } catch (err) { toast("That file isn't a School Planner backup."); }
    };
    r.readAsText(file);
  }

  /* ---------- text prompt dialog ---------- */
  function promptText(title, label, value, okLabel) {
    return new Promise(function (resolve) {
      var d = document.createElement('dialog');
      d.innerHTML = '<div class="dlg"><h2>' + esc(title) + '</h2>' +
        '<label>' + esc(label) + '<input type="text" maxlength="80" value="' + esc(value || '') + '"></label>' +
        '<div class="err"></div>' +
        '<div class="actions"><button data-no>Cancel</button><button class="primary" data-ok>' + esc(okLabel || 'Save') + '</button></div></div>';
      document.body.appendChild(d);
      var input = d.querySelector('input'), err = d.querySelector('.err'), done = false;
      function finish(v) {
        if (done) return;
        done = true;
        try { d.close(); } catch (e) { /* ignore */ }
        d.remove();
        resolve(v);
      }
      function submit() {
        var v = input.value.trim();
        if (!v) { err.textContent = 'Type a name first.'; return; }
        finish(v);
      }
      d.querySelector('[data-ok]').onclick = submit;
      d.querySelector('[data-no]').onclick = function () { finish(null); };
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
      d.addEventListener('cancel', function () { finish(null); });
      d.showModal();
      input.focus(); input.select();
    });
  }

  /* ---------- import from the earlier single-file versions (code or backup file) ---------- */
  function decodeCode(text) {
    var t = String(text || '').trim();
    if (t.indexOf('SCHED1:') === 0) t = t.slice(7);
    var bin = atob(t.replace(/\s+/g, ''));
    var bytes = Uint8Array.from(bin, function (c) { return c.charCodeAt(0); });
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  function openImport(cfg) {
    var d = document.createElement('dialog');
    d.innerHTML = '<div class="dlg"><h2>Import ' + esc(cfg.label) + '</h2>' +
      '<p style="color:var(--muted)">Bring in data from the earlier version: paste its copy code, or choose its backup file.</p>' +
      '<label>Copy code<textarea id="impText" rows="4" placeholder="Paste your code here"></textarea></label>' +
      '<label>or backup file<input type="file" id="impFile" accept=".json,application/json"></label>' +
      '<div class="err" id="impMsg"></div>' +
      '<div class="actions"><button data-x>Close</button><button class="primary" data-go>Import</button></div></div>';
    document.body.appendChild(d);
    var msg = d.querySelector('#impMsg');
    function close() { try { d.close(); } catch (e) { /* ignore */ } d.remove(); }
    function apply(obj) {
      if (obj && obj.app && obj.app !== cfg.app) throw new Error('wrong');
      var n = cfg.merge((obj && obj.data) || obj);
      toast('Imported ' + n + ' new item' + (n === 1 ? '' : 's') + '.');
      close();
    }
    d.querySelector('[data-x]').onclick = close;
    d.addEventListener('cancel', function () { d.remove(); });
    d.querySelector('[data-go]').onclick = function () {
      var text = d.querySelector('#impText').value.trim();
      var file = d.querySelector('#impFile').files[0];
      try {
        if (text) { apply(decodeCode(text)); return; }
        if (!file) { msg.textContent = 'Paste a code or choose a file first.'; return; }
        var r = new FileReader();
        r.onload = function () {
          try { apply(JSON.parse(r.result)); } catch (e) { msg.textContent = "That file isn't a valid backup for this page."; }
        };
        r.readAsText(file);
      } catch (e) {
        msg.textContent = "That code isn't valid. Copy it again from the earlier version.";
      }
    };
    d.showModal();
  }

  window.App = { esc: esc, iso: iso, auth: auth, load: load, createSaver: createSaver, ask: ask, prompt: promptText, toast: toast, openImport: openImport, toggleTheme: toggleTheme, backupLocal: backupLocal, restoreLocal: restoreLocal };
})();
