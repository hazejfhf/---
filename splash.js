// splash.js — شاشة تحميل بشعار المتجر + نقاط تحميل، تظهر مع كل صفحة وعند الانتقال بين الصفحات
(function () {
  'use strict';
  if (window.__splash) return; window.__splash = true;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MIN_MS = 700, MAX_MS = 8000, t0 = Date.now(), hideT = null, maxT = null;

  var css =
    '#az-splash{position:fixed;inset:0;z-index:2147483000;background:radial-gradient(circle at 50% 38%,#2a3d66 0,#1b2a4a 55%,#131f38 100%);' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;opacity:1;visibility:visible;transition:opacity .45s ease,visibility .45s;touch-action:manipulation;-webkit-tap-highlight-color:transparent}' +
    '#az-splash.off{opacity:0;visibility:hidden;pointer-events:none}' +
    '#az-splash .sp-logo{position:relative;width:min(56vw,240px);height:min(56vw,240px);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .12s ease-out;will-change:transform}' +
    '#az-splash .sp-ring{position:absolute;inset:-14px;border-radius:50%;border:3px solid rgba(241,198,91,.18);border-top-color:#f1c65b;border-right-color:#f1c65b;animation:sp-spin 1.6s linear infinite}' +
    '#az-splash .sp-glow{position:absolute;inset:6%;border-radius:50%;background:rgba(241,198,91,.22);filter:blur(28px);animation:sp-pulse 2.2s ease-in-out infinite}' +
    '#az-splash img{position:relative;width:100%;height:100%;object-fit:contain;border-radius:28%;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.4);animation:sp-float 2.4s ease-in-out infinite}' +
    '#az-splash .sp-logo.tap img{animation:sp-bounce .5s ease}' +
    '#az-splash .sp-dots{display:flex;gap:12px;direction:ltr}' +
    '#az-splash .sp-dots i{width:13px;height:13px;border-radius:50%;background:#f1c65b;animation:sp-dot 1.1s ease-in-out infinite}' +
    '#az-splash .sp-dots i:nth-child(2){animation-delay:.16s}#az-splash .sp-dots i:nth-child(3){animation-delay:.32s}' +
    '@keyframes sp-spin{to{transform:rotate(360deg)}}' +
    '@keyframes sp-pulse{0%,100%{opacity:.55;transform:scale(.92)}50%{opacity:1;transform:scale(1.08)}}' +
    '@keyframes sp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}' +
    '@keyframes sp-bounce{0%{transform:scale(1)}35%{transform:scale(1.16) rotate(-4deg)}70%{transform:scale(.96) rotate(3deg)}100%{transform:scale(1)}}' +
    '@keyframes sp-dot{0%,80%,100%{transform:scale(.55);opacity:.4}40%{transform:scale(1.15);opacity:1}}' +
    '@media(prefers-reduced-motion:reduce){#az-splash *{animation:none!important}#az-splash .sp-dots i{opacity:.8}}' +
    'html.sp-lock,html.sp-lock body{overflow:hidden!important}';

  var st = document.createElement('style'); st.textContent = css;
  var box = document.createElement('div'); box.id = 'az-splash'; box.setAttribute('role', 'status'); box.setAttribute('aria-label', 'جاري التحميل');
  box.innerHTML = '<div class="sp-logo" id="sp-logo"><span class="sp-glow"></span><span class="sp-ring"></span><img src="logo.png" alt="" draggable="false"></div>' +
    '<div class="sp-dots" aria-hidden="true"><i></i><i></i><i></i></div>';
  var root = document.documentElement;
  root.appendChild(st); root.appendChild(box); root.classList.add('sp-lock');

  // تفاعل: الشعار يميل مع اللمس/الماوس ويعمل نطّة لما تضغط عليه
  var logo = box.querySelector('#sp-logo');
  function tilt(x, y) {
    var r = logo.getBoundingClientRect(), dx = (x - (r.left + r.width / 2)) / innerWidth, dy = (y - (r.top + r.height / 2)) / innerHeight;
    logo.style.transform = 'perspective(600px) rotateY(' + (dx * 26).toFixed(1) + 'deg) rotateX(' + (-dy * 26).toFixed(1) + 'deg)';
  }
  if (!reduce) {
    box.addEventListener('pointermove', function (e) { tilt(e.clientX, e.clientY); });
    box.addEventListener('pointerleave', function () { logo.style.transform = ''; });
  }
  logo.addEventListener('click', function () { logo.classList.remove('tap'); void logo.offsetWidth; logo.classList.add('tap'); });

  function hide() {
    clearTimeout(hideT); clearTimeout(maxT);
    box.classList.add('off'); root.classList.remove('sp-lock'); logo.style.transform = '';
  }
  function show() {
    clearTimeout(hideT); clearTimeout(maxT);
    t0 = Date.now(); box.classList.remove('off'); root.classList.add('sp-lock');
    maxT = setTimeout(hide, MAX_MS);
  }
  function whenReady() {
    var wait = Math.max(0, MIN_MS - (Date.now() - t0));
    hideT = setTimeout(hide, wait);
  }

  maxT = setTimeout(hide, MAX_MS);
  if (document.readyState === 'complete') whenReady(); else window.addEventListener('load', whenReady);
  // رجوع من الكاش (زر الرجوع): نخفيها فوراً
  window.addEventListener('pageshow', function (e) { if (e.persisted) hide(); });

  // عند الضغط على أي رابط داخلي: نظهر الشاشة لحد ما الصفحة الجاية تفتح
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    var h = a.getAttribute('href') || '';
    if (/^(#|javascript:|mailto:|tel:|whatsapp:)/i.test(h)) return;
    var u; try { u = new URL(a.href, location.href); } catch (er) { return; }
    if (u.origin !== location.origin) return;
    if (u.pathname === location.pathname && u.search === location.search) return;
    show();
  }, false);
  // أي انتقال تاني (location.href / replace)
  window.addEventListener('beforeunload', function () { box.classList.remove('off'); });
})();
