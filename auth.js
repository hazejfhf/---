// auth.js — منطق صفحات الدخول والتسجيل والحساب (جديد بالكامل). بيعتمد على window.FBAuth من firebase-db.js
(function () {
  'use strict';
  var LS = window.localStorage;
  var A = window.AC = {};

  A.$ = function (id) { return document.getElementById(id); };
  A.user = function () { try { return JSON.parse(LS.getItem('current_user')) || null; } catch (e) { return null; } };
  A.saveLocal = function (u) { LS.setItem('current_user', JSON.stringify(u)); };

  // ننتظر Firebase Auth يجهز (أقصى 8 ثواني)
  A.ready = function () {
    return new Promise(function (res) {
      var t0 = Date.now();
      (function poll() {
        if (window.FBAuth && window.FBAuth.ready) { window.FBAuth.ready.then(function () { res(window.FBAuth); }); return; }
        if (Date.now() - t0 > 8000) { res(null); return; }
        setTimeout(poll, 100);
      })();
    });
  };

  A.toast = function (msg, bad) {
    var t = A.$('ac-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ac-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
    clearTimeout(A._tt); A._tt = setTimeout(function () { t.className = ''; }, 2600);
  };

  A.copy = function (text) {
    text = String(text);
    var done = function () { A.toast('تم النسخ'); };
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { fb(); }); } else fb();
    function fb() { var ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove(); }
  };

  // ── التحقق من المدخلات ──
  A.cleanName = function (v) { return String(v || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60); };
  A.phoneOk = function (v) { return /^01[0125]\d{8}$/.test(String(v || '').trim()); };
  A.digits = function (v) { return String(v || '').replace(/\D/g, '').slice(0, 11); };
  // كلمة سر قوية: 8 خانات على الأقل + حروف + أرقام (للتسجيل وتغيير كلمة السر فقط، مش للدخول)
  A.passRules = function (v) {
    v = typeof v === 'string' ? v : '';
    return { len: v.length >= 8, letter: /[A-Za-z]/.test(v) && !/[^\x21-\x7E]/.test(v), digit: /\d/.test(v), mix: /[a-z\u0621-\u064A]/.test(v) && /[A-Z]/.test(v) || /[^A-Za-z0-9\u0621-\u064A]/.test(v) };
  };
  A.passOk = function (v) { var r = A.passRules(v); return typeof v === 'string' && v.length <= 64 && r.len && r.letter && r.digit; };
  A.passMsg = 'كلمة السر ضعيفة: لازم 8 خانات على الأقل، حروف إنجليزي وأرقام (من غير عربي)';
  // عدّاد القوة تحت خانة كلمة السر
  A.meter = function (inputId) {
    var inp = A.$(inputId); if (!inp) return;
    var host = inp.closest('.ac-pw') || inp;
    var m = document.createElement('div'); m.className = 'pw-meter';
    m.innerHTML = '<div class="pw-bar"><i></i></div><div class="pw-txt"></div>' +
      '<ul class="pw-rules"><li data-r="len">8 خانات على الأقل</li><li data-r="letter">حروف إنجليزي (a-z) بدون عربي</li><li data-r="digit">أرقام (0-9)</li></ul>';
    host.insertAdjacentElement('afterend', m);
    var bar = m.querySelector('i'), txt = m.querySelector('.pw-txt');
    function upd() {
      var v = inp.value, r = A.passRules(v), score = 0;
      if (r.len) score++; if (r.letter) score++; if (r.digit) score++; if (r.mix) score++; if (v.length >= 12) score++;
      if (!v) score = 0;
      var lv = [['', '#e6e2d8', 0], ['ضعيفة جداً', '#c7254e', 20], ['ضعيفة', '#e0603a', 40], ['متوسطة', '#e3b23c', 60], ['قوية', '#5fae4f', 80], ['قوية جداً', '#1a7f4b', 100]][Math.min(score, 5)];
      if (v && !A.passOk(v) && score > 2) lv = ['ضعيفة', '#e0603a', 40];
      bar.style.width = lv[2] + '%'; bar.style.background = lv[1]; txt.textContent = v ? 'قوة كلمة السر: ' + lv[0] : ''; txt.style.color = lv[1];
      Array.prototype.forEach.call(m.querySelectorAll('li'), function (li) { li.classList.toggle('ok', !!r[li.dataset.r]); });
    }
    inp.addEventListener('input', upd); upd();
  };

  // يمنع الحروف العربية (وأي حرف غير ASCII) في خانات كلمة السر
  A.noArabic = function (ids) { ids.forEach(function (id) { var e = A.$(id); if (!e) return; e.addEventListener('input', function () { var c = this.value.replace(/[^\x21-\x7E]/g, ''); if (c !== this.value) { this.value = c; A.toast('كلمة السر بالإنجليزي وأرقام فقط', true); } }); }); };
  // كلمة سر عشوائية قوية (حروف إنجليزي + أرقام)
  A.genPass = function () { var L = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789', a = new Uint32Array(12); crypto.getRandomValues(a); var o = ''; for (var i = 0; i < 12; i++) o += (i % 3 === 2 ? D : L).charAt(a[i] % (i % 3 === 2 ? D.length : L.length)); return o; };

  A.setErr = function (id, msg) { var e = A.$(id); if (!e) return; e.textContent = msg || ''; e.style.display = msg ? 'block' : 'none'; };
  A.busy = function (btn, on, txt) { if (!btn) return; if (on) { btn.dataset.t = btn.textContent; btn.textContent = txt || 'جاري التحميل...'; btn.disabled = true; } else { btn.textContent = btn.dataset.t || btn.textContent; btn.disabled = false; } };

  // ── قفل مؤقت بعد 5 محاولات دخول فاشلة (طبقة إضافية؛ الحماية الحقيقية على Firebase) ──
  A.lockLeft = function () { var t = +LS.getItem('ac_lock_until') || 0; return Date.now() < t ? Math.ceil((t - Date.now()) / 60000) : 0; };
  A.failed = function () { var n = (+LS.getItem('ac_fail') || 0) + 1; LS.setItem('ac_fail', n); if (n >= 5) { LS.setItem('ac_lock_until', Date.now() + 5 * 60000); LS.setItem('ac_fail', 0); } };
  A.okLogin = function () { LS.setItem('ac_fail', 0); };

  // وجهة الرجوع بعد الدخول: صفحة محلية .html فقط (منع open-redirect)
  A.redirectTarget = function () {
    var r = new URLSearchParams(location.search).get('redirect') || '';
    return /^[a-z0-9_-]+\.html$/i.test(r) && r !== 'login.html' ? r : 'index.html';
  };

  A.eye = function (btn) {
    var i = btn.previousElementSibling; if (!i) return;
    var show = i.type === 'password'; i.type = show ? 'text' : 'password'; btn.textContent = show ? 'إخفاء' : 'إظهار';
  };
})();
