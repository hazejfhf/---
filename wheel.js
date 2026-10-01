// wheel.js — عجلة الحظ بتحكم من السيرفر (Firebase)
// - مرة السحب والفترة بين السحبات بتتفحص في قواعد Firestore (spins/<uid> + config/wheel.hours)
//   يعني مسح بيانات المتصفح أو تعديل الوقت/الـ localStorage ما يفيدش.
// - الجائزة بتتحسب من "وقت السيرفر" اللي اتسجل مع السحبة، مش من رقم عشوائي في المتصفح.
// - إعدادات العجلة (الجوائز + الفترة) بتتحفظ في config/wheel وبتتسحب عند فتح الصفحة.
(function () {
  'use strict';
  var LS = localStorage;
  function jget(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var COLORS = ['#f1c40f', '#2ecc71', '#e74c3c', '#3498db', '#9b59b6', '#e67e22', '#1abc9c', '#34495e'];

  var state = { gifts: [], hours: 24, rotation: 0, busy: false };

  function localGifts() { return jget('global_store_gifts_adv', []); }
  function localHours() { var c = jget('store_wheel_config', {}); return parseInt(c.hoursInterval) || 24; }

  // ───────── مزامنة الإعدادات ─────────
  function applyRemote(w) {
    if (!w || !Array.isArray(w.gifts) || !w.gifts.length) return false;
    state.gifts = w.gifts; state.hours = parseInt(w.hours) || 24;
    LS.setItem('global_store_gifts_adv', JSON.stringify(w.gifts));
    var cfg = jget('store_wheel_config', { enabled: true, slots: null }); cfg.hoursInterval = state.hours;
    LS.setItem('store_wheel_config', JSON.stringify(cfg));
    LS.setItem('store_wheel_slots', JSON.stringify(w.gifts.map(function (g, i) {
      return { text: g.text, code: g.code, type: g.type === 'no-luck' ? 'no_luck' : 'discount', color: g.color || COLORS[i % COLORS.length] };
    })));
    if (typeof advancedGiftsList !== 'undefined') { advancedGiftsList.length = 0; w.gifts.forEach(function (g) { advancedGiftsList.push(g); }); }
    return true;
  }

  // الأدمن: رفع الإعدادات الحالية للسيرفر
  window.pushWheelToServer = function () {
    if (!window.FB_saveWheel) return;
    var slots = jget('store_wheel_slots', []);
    var gifts = localGifts().map(function (g, i) { var c = (slots[i] && slots[i].color) || g.color || COLORS[i % COLORS.length]; return Object.assign({}, g, { color: c }); });
    if (!gifts.length) return;
    window.FB_saveWheel(gifts, localHours()).then(function (ok) { if (ok === false && typeof showToast === 'function') showToast('⚠️ تعذر حفظ إعدادات العجلة على السيرفر (سجّل دخول الأدمن)'); });
  };
  ['addNewAdvancedGiftToWheel', 'deleteAdvancedGift'].forEach(function (n) {
    var f = window[n]; if (typeof f !== 'function') return;
    window[n] = function () { var r = f.apply(this, arguments); setTimeout(window.pushWheelToServer, 0); return r; };
  });

  // ───────── رسم العجلة ─────────
  function drawWheel() {
    var wheel = document.getElementById('lucky-wheel-element');
    var g = state.gifts; if (!wheel || !g.length) return;
    var seg = 360 / g.length;
    wheel.style.position = 'relative';
    wheel.style.background = 'conic-gradient(' + g.map(function (x, i) { var c = x.color || COLORS[i % COLORS.length]; return c + ' ' + (i * seg) + 'deg ' + ((i + 1) * seg) + 'deg'; }).join(',') + ')';
    wheel.innerHTML = g.map(function (x, i) {
      var t = String(x.text || '').replace(/[^\u0600-\u06FF\w%\s.+\-]/g, '').trim(); if (t.length > 16) t = t.slice(0, 15) + '…';
      return '<div style="position:absolute;top:50%;left:50%;width:120px;height:22px;margin-top:-11px;transform-origin:0 50%;' +
        'transform:rotate(' + (i * seg + seg / 2 - 90) + 'deg) translateX(34px);text-align:center;font-size:.68rem;font-weight:800;color:#fff;' +
        'text-shadow:0 1px 2px rgba(0,0,0,.55);line-height:22px;white-space:nowrap;pointer-events:none;">' + esc(t) + '</div>';
    }).join('');
  }

  // ───────── الجائزة (تحسب من وقت السيرفر) ─────────
  function prizeIndex(t, ratio) {
    var g = state.gifts, n = g.length, idx = t % n;
    var roll = Math.floor(t / 97) % 100;               // 0..99 من وقت السيرفر
    if (roll >= ratio) {                               // نسبة الفوز الخاصة بالمستخدم
      var nl = []; g.forEach(function (x, i) { if (x.type === 'no-luck') nl.push(i); });
      if (nl.length) return { idx: nl[t % nl.length], forceLose: true };
      return { idx: idx, forceLose: true };
    }
    return { idx: idx, forceLose: false };
  }

  function showPrize(gift, lost) {
    var box = document.getElementById('prize-result-box'), txt = document.getElementById('prize-text'), cp = document.getElementById('prize-coupon-element');
    if (!box) return;
    box.style.display = 'block';
    if (lost || gift.type === 'no-luck') { txt.innerText = gift.type === 'no-luck' ? gift.text : 'حظ أوفر المرة القادمة! 😅'; cp.innerText = 'حظ سعيد المرة القادمة'; cp.style.background = '#95a5a6'; }
    else { txt.innerText = gift.text; cp.innerText = gift.code; cp.style.background = '#f1c40f'; }
  }

  function claim(t, gift, lost) {
    if (lost || gift.type === 'no-luck') return;
    var claimed = jget('user_claimed_coupons', []);
    if (claimed.some(function (c) { return c.spinT === t; })) return;
    var c = Object.assign({}, gift, { expireAt: t + (Number(gift.duration) || 0) * 60000, status: 'active', spinT: t });
    claimed.push(c);
    LS.setItem('user_claimed_coupons', JSON.stringify(claimed));
    if (typeof userClaimedCoupons !== 'undefined') { userClaimedCoupons.length = 0; claimed.forEach(function (x) { userClaimedCoupons.push(x); }); }
    if (typeof renderUserCouponsWallet === 'function') renderUserCouponsWallet();
  }

  function fmtLeft(ms) { var m = Math.ceil(ms / 60000), h = Math.floor(m / 60); return h > 0 ? h + ' ساعة و ' + (m % 60) + ' دقيقة' : m + ' دقيقة'; }

  function setBtn(text, disabled) { var b = document.getElementById('spin-action-btn'); if (b) { b.innerText = text; b.disabled = !!disabled; } }

  var cdTimer = null;
  function cooldownUI(lastT) {
    clearInterval(cdTimer);
    function tick() {
      var left = lastT + state.hours * 3600000 - Date.now();
      if (left <= 0) { clearInterval(cdTimer); setBtn('لف العجلة واربح الآن 🎡', false); return; }
      setBtn('متاح بعد ' + fmtLeft(left) + ' ⏳', true);
    }
    tick(); cdTimer = setInterval(tick, 30000);
  }

  function spinTo(idx, cb) {
    var wheel = document.getElementById('lucky-wheel-element'), seg = 360 / state.gifts.length;
    var jitter = (Math.random() - 0.5) * seg * 0.6;     // شكلي فقط، مش بيغير الجائزة
    var target = (((360 - (idx * seg + seg / 2)) + jitter) % 360 + 360) % 360;
    var delta = (target - (state.rotation % 360) + 360) % 360;
    state.rotation += 360 * 6 + delta;
    wheel.style.transform = 'rotate(' + state.rotation + 'deg)';
    setTimeout(cb, 4100);
  }

  // ───────── زر التدوير ─────────
  window.startLuckyWheelSpin = async function () {
    if (state.busy) return;
    var A = window.FBAuth;
    if (!A || !A.user || !jget('current_user', null)) {
      if (typeof showAlert === 'function') showAlert('🔐', 'سجّل الدخول أولاً', 'عجلة الحظ متاحة للحسابات المسجلة فقط.');
      setTimeout(function () { location.href = 'login.html?redirect=gifts.html'; }, 1400);
      return;
    }
    if (!state.gifts.length) { if (typeof showAlert === 'function') showAlert('⚠️', 'العجلة غير جاهزة', 'لا توجد جوائز حالياً.'); return; }
    state.busy = true; setBtn('جاري التحقق... ⏳', true);
    var t;
    try { t = await window.FB_spin(); }
    catch (e) {
      state.busy = false;
      var last = await window.FB_getSpin();
      var prof = await window.FB_getMyProfile();
      if (prof && (prof.wheelDisabled || prof.isBanned)) { setBtn('غير متاح لحسابك 🚫', true); if (typeof showAlert === 'function') showAlert('🚫', 'غير مسموح', 'لا يمكنك استخدام عجلة الحظ حالياً.'); }
      else if (last && last + state.hours * 3600000 > Date.now()) { cooldownUI(last); if (typeof showAlert === 'function') showAlert('⏰', 'انتظر قليلاً', 'يمكنك تدوير العجلة مرة أخرى بعد <strong>' + fmtLeft(last + state.hours * 3600000 - Date.now()) + '</strong>'); }
      else { setBtn('لف العجلة واربح الآن 🎡', false); if (typeof showAlert === 'function') showAlert('⚠️', 'تعذر السحب', 'حدثت مشكلة في الاتصال، حاول مرة أخرى.'); }
      return;
    }
    var prof2 = await window.FB_getMyProfile();
    var ratio = prof2 && prof2.wheelWinRatio !== undefined ? Number(prof2.wheelWinRatio) : 100;
    var p = prizeIndex(t, isNaN(ratio) ? 100 : ratio), gift = state.gifts[p.idx];
    setBtn('جاري تدوير العجلة... 🎡', true);
    spinTo(p.idx, function () {
      showPrize(gift, p.forceLose); claim(t, gift, p.forceLose);
      LS.setItem('wheel_claimed_t', String(t));
      state.busy = false; cooldownUI(t);
    });
  };

  // ───────── تهيئة صفحة الهدايا ─────────
  async function initGiftsPage() {
    if (!document.getElementById('lucky-wheel-element')) return;
    var A = await new Promise(function (res) { if (window.FBAuth) res(window.FBAuth); else window.addEventListener('fbauth-init', function () { res(window.FBAuth); }, { once: true }); });
    await A.ready;
    var w = window.FB_loadWheel ? await window.FB_loadWheel() : null;
    if (!applyRemote(w)) { state.gifts = localGifts(); state.hours = localHours(); }
    drawWheel();
    if (!A.user || !jget('current_user', null)) { setBtn('سجّل الدخول لتلف العجلة 🔐', false); return; }
    var last = await window.FB_getSpin();
    if (last) {
      // لو السحبة اتسجلت على السيرفر ومتسجلتش جائزتها محلياً (قفل الصفحة/قطع النت) نستردها
      var prof = await window.FB_getMyProfile();
      var ratio = prof && prof.wheelWinRatio !== undefined ? Number(prof.wheelWinRatio) : 100;
      if (last + state.hours * 3600000 > Date.now()) {
        var p = prizeIndex(last, isNaN(ratio) ? 100 : ratio);
        if (state.gifts[p.idx]) { showPrize(state.gifts[p.idx], p.forceLose); claim(last, state.gifts[p.idx], p.forceLose); }
        cooldownUI(last);
      }
    }
    var prof3 = await window.FB_getMyProfile();
    if (prof3 && (prof3.wheelDisabled || prof3.isBanned)) setBtn('غير متاح لحسابك 🚫', true);
  }

  // ───────── الأدمن: سحب الإعدادات من السيرفر بعد الدخول ─────────
  window.addEventListener('fbauth-changed', function () {
    if (window.FBAuth && window.FBAuth.isAdminSession && document.getElementById('admin-wheel-slots-list') && window.FB_loadWheel) {
      window.FB_loadWheel().then(function (w) { if (applyRemote(w) && typeof loadWheelAdminSettings === 'function') loadWheelAdminSettings(); });
    }
  });

  initGiftsPage();
})();
