/* Notes: folders in the left panel, notes inside each folder. */
window.NotesView = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById('n-' + id); };
  var esc = App.esc;

  var folders = [], notes = [], lastFolder = '';
  var saver = null, curFolder = '', curNote = '', query = '';
  var save = function () { if (saver) saver.queue(); };

  function init(data, setStatus) {
    saver = App.createSaver('notes', function () {
      return { folders: folders, notes: notes, lastFolder: lastFolder };
    }, setStatus);
    if (data) {
      folders = Array.isArray(data.folders) ? data.folders : [];
      notes = Array.isArray(data.notes) ? data.notes : [];
      lastFolder = data.lastFolder || '';
    }
  }

  function newId(p) { return p + Date.now() + Math.random().toString(36).slice(2, 6); }
  function folderById(id) { return folders.find(function (f) { return f.id === id; }) || null; }
  function noteById(id) { return notes.find(function (n) { return n.id === id; }) || null; }
  function notesIn(fid) {
    return notes.filter(function (n) { return n.folderId === fid; })
      .sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
  }
  function fmt(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function snippet(body) { return String(body || '').replace(/\s+/g, ' ').trim().slice(0, 90); }

  /* ---------- sidebar folder list ---------- */
  function renderSidebar() {
    var box = document.getElementById('folderList');
    if (!box) return;
    box.innerHTML = folders.map(function (f) {
      var on = App.view === 'notes' && f.id === curFolder;
      return '<a href="#notes/' + f.id + '" class="' + (on ? 'on' : '') + '" data-folder="' + f.id + '">📁 <span>' +
        esc(f.name) + '</span><em class="cnt">' + notesIn(f.id).length + '</em></a>';
    }).join('');
  }

  /* ---------- view ---------- */
  function show(arg) {
    if (arg && folderById(arg)) curFolder = arg;
    else if (!folderById(curFolder)) curFolder = folderById(lastFolder) ? lastFolder : (folders[0] ? folders[0].id : '');
    var list = notesIn(curFolder);
    if (!list.some(function (n) { return n.id === curNote; })) curNote = list[0] ? list[0].id : '';
    query = ''; $('q').value = '';
    render();
  }

  function render() {
    var has = folders.length > 0;
    $('empty').hidden = has;
    $('layout').hidden = !has;
    $('rename').hidden = !has;
    $('delFolder').hidden = !has;
    $('addNote').hidden = !has;
    var f = folderById(curFolder);
    $('title').textContent = f ? f.name : 'Notes';
    if (has) { renderList(); renderEditor(); }
    renderSidebar();
  }

  function renderList() {
    var q = query;
    var list = notesIn(curFolder).filter(function (n) {
      return !q || ((n.title || '') + ' ' + (n.body || '')).toLowerCase().indexOf(q) > -1;
    });
    $('list').innerHTML = list.length ? list.map(function (n) {
      return '<div class="nitem' + (n.id === curNote ? ' on' : '') + '" data-id="' + n.id + '" tabindex="0" role="button">' +
        '<b>' + esc(n.title || 'Untitled note') + '</b><span>' + esc(snippet(n.body)) + '</span><small>' + esc(fmt(n.updated)) + '</small></div>';
    }).join('') : '<div class="nnone">' + (q ? 'No notes match your search.' : 'No notes in this folder yet.') + '</div>';
  }

  function renderEditor() {
    var n = noteById(curNote);
    $('editor').hidden = !n;
    $('pick').hidden = !!n;
    if (!n) {
      $('pick').textContent = notesIn(curFolder).length
        ? 'Select a note to read or edit it.'
        : 'Click “+ New note” to write your first note in this folder.';
      return;
    }
    $('noteTitle').value = n.title || '';
    $('noteBody').value = n.body || '';
    $('meta').textContent = 'Last edited ' + fmt(n.updated);
    $('move').innerHTML = folders.map(function (f) {
      return '<option value="' + f.id + '"' + (f.id === n.folderId ? ' selected' : '') + '>' + esc(f.name) + '</option>';
    }).join('');
  }

  /* ---------- folders ---------- */
  async function newFolder() {
    var name = await App.prompt('New folder', 'Folder name', '', 'Create folder');
    if (!name) return;
    var f = { id: newId('f'), name: name };
    folders.push(f);
    lastFolder = f.id;
    save();
    App.go('notes', f.id);
    // if we were already on the notes view with the same hash, make sure it refreshes
    show(f.id);
  }

  $('rename').onclick = async function () {
    var f = folderById(curFolder); if (!f) return;
    var name = await App.prompt('Rename folder', 'Folder name', f.name, 'Save');
    if (!name) return;
    f.name = name; save(); render();
  };

  $('delFolder').onclick = async function () {
    var f = folderById(curFolder); if (!f) return;
    var inside = notesIn(f.id);
    var ok = await App.ask('Delete the folder "' + f.name + '"' + (inside.length ? ' and its ' + inside.length + ' note' + (inside.length > 1 ? 's' : '') : '') + '?');
    if (!ok) return;
    var idx = folders.indexOf(f);
    folders = folders.filter(function (x) { return x.id !== f.id; });
    notes = notes.filter(function (n) { return n.folderId !== f.id; });
    if (lastFolder === f.id) lastFolder = '';
    curFolder = ''; curNote = '';
    save();
    var next = folders[0] ? folders[0].id : '';
    if (next) App.go('notes', next); else App.go('notes');
    show(next);
    App.toast('Folder deleted', 'Undo', function () {
      folders.splice(Math.min(idx, folders.length), 0, f);
      inside.forEach(function (n) { notes.push(n); });
      save();
      App.go('notes', f.id);
      show(f.id);
    });
  };

  $('emptyBtn').onclick = newFolder;

  /* ---------- notes ---------- */
  $('addNote').onclick = function () {
    if (!curFolder) return;
    var now = Date.now();
    var n = { id: newId('n'), folderId: curFolder, title: '', body: '', created: now, updated: now };
    notes.push(n);
    curNote = n.id; query = ''; $('q').value = '';
    save(); render();
    $('noteTitle').focus();
  };

  $('list').addEventListener('click', function (e) {
    var it = e.target.closest('.nitem'); if (!it) return;
    curNote = it.dataset.id; renderList(); renderEditor();
  });
  $('list').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var it = e.target.closest('.nitem'); if (!it) return;
    e.preventDefault(); curNote = it.dataset.id; renderList(); renderEditor();
  });
  $('q').addEventListener('input', function () { query = $('q').value.trim().toLowerCase(); renderList(); });

  function edited() {
    var n = noteById(curNote); if (!n) return;
    n.title = $('noteTitle').value;
    n.body = $('noteBody').value;
    n.updated = Date.now();
    $('meta').textContent = 'Last edited ' + fmt(n.updated);
    save(); renderList(); renderSidebar();
  }
  $('noteTitle').addEventListener('input', edited);
  $('noteBody').addEventListener('input', edited);

  $('move').addEventListener('change', function () {
    var n = noteById(curNote); if (!n) return;
    var to = folderById($('move').value); if (!to || to.id === n.folderId) return;
    n.folderId = to.id; n.updated = Date.now();
    var list = notesIn(curFolder);
    curNote = list[0] ? list[0].id : '';
    save(); render();
    App.toast('Moved to "' + to.name + '"');
  });

  $('delNote').onclick = async function () {
    var n = noteById(curNote); if (!n) return;
    var ok = await App.ask('Delete "' + (n.title || 'Untitled note') + '"?');
    if (!ok) return;
    notes = notes.filter(function (x) { return x.id !== n.id; });
    var list = notesIn(curFolder);
    curNote = list[0] ? list[0].id : '';
    save(); render();
    App.toast('Note deleted', 'Undo', function () {
      notes.push(n); curFolder = n.folderId; curNote = n.id; save(); render();
    });
  };

  return { init: init, show: show, renderSidebar: renderSidebar, newFolder: newFolder };
})();
