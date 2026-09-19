/*
 * Theme: light / dark / automatic mode + accent color.
 * Loaded in <head> so the saved look is applied before the page shows.
 * Saved on this device (localStorage).
 */
(function () {
  'use strict';

  var ACCENTS = [
    { id: 'forest', name: 'Forest', l: '#1e6b4f', d: '#3fb98a' },
    { id: 'ocean',  name: 'Ocean',  l: '#1d5fd1', d: '#6ea0ff' },
    { id: 'grape',  name: 'Grape',  l: '#6d3fd0', d: '#a884ff' },
    { id: 'rose',   name: 'Rose',   l: '#c2306e', d: '#ff7fb0' },
    { id: 'sunset', name: 'Sunset', l: '#d05a1c', d: '#ff9a5c' },
    { id: 'berry',  name: 'Berry',  l: '#b3283a', d: '#ff8a96' },
    { id: 'teal',   name: 'Teal',   l: '#0e7f8f', d: '#4fd0e0' },
    { id: 'slate',  name: 'Slate',  l: '#4b5b75', d: '#9fb2d0' }
  ];
  var MODE_KEY = 'theme', ACCENT_KEY = 'sp-accent';
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  function getMode() { var m = read(MODE_KEY); return m === 'light' || m === 'dark' ? m : 'system'; }
  function getAccent() {
    var a = read(ACCENT_KEY);
    if (/^#[0-9a-fA-F]{6}$/.test(a || '')) return a.toLowerCase();
    return ACCENTS.some(function (x) { return x.id === a; }) ? a : 'forest';
  }
  function isDark() { var m = getMode(); return m === 'dark' || (m === 'system' && !!mq && mq.matches); }

  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function toHex(a) { return '#' + a.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); }
  function lighten(hex, t) { return toHex(rgb(hex).map(function (v) { return v + (255 - v) * t; })); }
  function luminance(hex) { var c = rgb(hex); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }

  function accentColor(dark) {
    var a = getAccent();
    var p = ACCENTS.filter(function (x) { return x.id === a; })[0];
    if (p) return dark ? p.d : p.l;
    return dark ? lighten(a, 0.28) : a;
  }

  function apply() {
    var root = document.documentElement;
    var mode = getMode();
    if (mode === 'system') delete root.dataset.theme; else root.dataset.theme = mode;
    var c = accentColor(isDark());
    root.style.setProperty('--accent', c);
    root.style.setProperty('--accentink', luminance(c) > 0.6 ? '#10201a' : '#ffffff');
  }

  function setMode(m) { write(MODE_KEY, m); apply(); }
  function setAccent(a) { write(ACCENT_KEY, a); apply(); }

  if (mq) {
    var onChange = function () { if (getMode() === 'system') apply(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
  apply();

  /* ---------- picker dialog ---------- */
  function openPicker() {
    var d = document.createElement('dialog');
    d.className = 'themedlg';
    d.innerHTML =
      '<div class="dlg"><h2>Choose your look</h2>' +
      '<div><div class="tlabel">Mode</div><div class="seg" id="tMode">' +
      '<button type="button" data-m="light">☀️ Light</button><button type="button" data-m="dark">🌙 Dark</button><button type="button" data-m="system">💻 Automatic</button></div></div>' +
      '<div><div class="tlabel">Color</div><div class="tswatches" id="tAcc">' +
      ACCENTS.map(function (a) {
        return '<button type="button" class="tsw" data-a="' + a.id + '" title="' + a.name + '"><i style="background:' + a.l + '"></i><span>' + a.name + '</span></button>';
      }).join('') +
      '<label class="tsw tcustom" title="Pick any color"><i id="tCustI"></i><span>Custom</span><input type="color" id="tCust" aria-label="Custom color"></label>' +
      '</div></div>' +
      '<p class="tnote">Your choice is saved on this device.</p>' +
      '<div class="actions"><button class="primary" type="button" data-done>Done</button></div></div>';
    document.body.appendChild(d);

    function mark() {
      var m = getMode(), a = getAccent(), custom = /^#/.test(a);
      d.querySelectorAll('#tMode button').forEach(function (b) { b.classList.toggle('on', b.dataset.m === m); });
      d.querySelectorAll('#tAcc button[data-a]').forEach(function (b) { b.classList.toggle('on', !custom && b.dataset.a === a); });
      var cs = d.querySelector('.tcustom');
      cs.classList.toggle('on', custom);
      d.querySelector('#tCustI').style.background = custom ? a : 'conic-gradient(#e33,#ec3,#3c3,#3cc,#33e,#c3c,#e33)';
      d.querySelector('#tCust').value = custom ? a : '#1d5fd1';
    }
    d.querySelector('#tMode').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; setMode(b.dataset.m); mark();
    });
    d.querySelector('#tAcc').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-a]'); if (!b) return; setAccent(b.dataset.a); mark();
    });
    d.querySelector('#tCust').addEventListener('input', function (e) { setAccent(e.target.value); mark(); });
    function close() { try { d.close(); } catch (e) { /* ignore */ } d.remove(); }
    d.querySelector('[data-done]').onclick = close;
    d.addEventListener('cancel', function () { d.remove(); });
    d.addEventListener('click', function (e) { if (e.target === d) close(); });
    mark();
    d.showModal();
  }

  window.Theme = { ACCENTS: ACCENTS, getMode: getMode, getAccent: getAccent, setMode: setMode, setAccent: setAccent, apply: apply, openPicker: openPicker };
})();
