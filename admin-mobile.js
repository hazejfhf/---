/* يكتب عنوان العمود (data-label) على كل خانة تلقائياً بعد أي رسم للجدول، عشان يظهر كارت منظم على الموبايل */
(function () {
  function label(table) {
    var ths = table.querySelectorAll('thead th');
    if (!ths.length) return;
    var names = Array.prototype.map.call(ths, function (t) { return t.textContent.trim(); });
    table.querySelectorAll('tbody tr').forEach(function (tr) {
      var i = 0;
      Array.prototype.forEach.call(tr.children, function (td) {
        if (td.tagName !== 'TD') return;
        if (td.colSpan > 1) { td.setAttribute('data-label', ''); return; }
        if (!td.hasAttribute('data-label')) td.setAttribute('data-label', names[i] || '');
        i++;
      });
    });
  }
  function run() { document.querySelectorAll('.settings-box table').forEach(label); }
  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(run, 30); }
  function init() {
    document.querySelectorAll('.settings-box table tbody').forEach(function (tb) {
      new MutationObserver(schedule).observe(tb, { childList: true });
    });
    run();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
