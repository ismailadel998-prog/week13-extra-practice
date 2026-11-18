/* Type-ahead student name picker. Matches the FIRST name only, treating
   i/e and o/u as the same and ignoring double letters and c/k/q. */
(function () {
  function key(s) {
    s = String(s || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!s) return '';
    s = s.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/[cq]/g, 'k');
    s = s.replace(/e/g, 'i').replace(/o/g, 'u');   // i/e and o/u sound the same
    return s.replace(/(.)\1+/g, '$1');            // collapse double letters
  }
  function firstName(n) { return n.split(/\s+/)[0]; }

  window.attachNamePicker = function (nameEl, sectionEl, grade) {
    var people = [];
    Object.keys(window.ROSTER || {}).forEach(function (sec) {
      if (sec.charAt(0) !== String(grade)) return;
      window.ROSTER[sec].forEach(function (n) { people.push({ name: n, sec: sec, k: key(firstName(n)), f: firstName(n).toLowerCase() }); });
    });
    var box = document.createElement('div');
    box.className = 'npick';
    nameEl.parentNode.appendChild(box);
    nameEl.placeholder = 'Type the first 3 letters of your first name';
    nameEl.setAttribute('autocomplete', 'off');
    var items = [], active = -1;

    function place() {
      box.style.left = nameEl.style.left;
      box.style.top = 'calc(' + nameEl.style.top + ' + ' + nameEl.offsetHeight + 'px + 2px)';
    }
    function close() { box.style.display = 'none'; active = -1; }
    function pick(p) {
      nameEl.value = p.name; nameEl.dataset.picked = p.name;
      if (sectionEl) { sectionEl.value = p.sec; sectionEl.classList.add('filled'); }
      nameEl.classList.add('filled'); nameEl.classList.remove('missing');
      close();
      nameEl.dispatchEvent(new CustomEvent('picked', { detail: p }));
    }
    function render() {
      var q = nameEl.value.trim().split(/\s+/)[0] || '';
      if (nameEl.dataset.picked && nameEl.value === nameEl.dataset.picked) { close(); return; }
      delete nameEl.dataset.picked;
      if (q.replace(/[^A-Za-z]/g, '').length < 2) { close(); return; }
      var lq = q.toLowerCase(), kq = key(q);
      var exact = people.filter(function (p) { return p.f.indexOf(lq) === 0; });
      var fuzzy = people.filter(function (p) { return p.f.indexOf(lq) !== 0 && p.k.indexOf(kq) === 0; });
      items = exact.concat(fuzzy).slice(0, 12);
      if (!items.length) {
        box.innerHTML = '<div class="npick-none">No name found — check your spelling</div>';
      } else {
        box.innerHTML = items.map(function (p, i) {
          var f = firstName(p.name), rest = p.name.slice(f.length);
          return '<div class="npick-item" data-i="' + i + '"><b>' + f + '</b>' + rest + '<span>' + p.sec + '</span></div>';
        }).join('');
      }
      active = -1; place(); box.style.display = 'block';
    }
    nameEl.addEventListener('input', render);
    nameEl.addEventListener('focus', render);
    nameEl.addEventListener('blur', function () { setTimeout(close, 180); });
    nameEl.addEventListener('keydown', function (e) {
      if (box.style.display !== 'block' || !items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); e.stopImmediatePropagation();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        box.querySelectorAll('.npick-item').forEach(function (el, i) { el.classList.toggle('on', i === active); });
      } else if (e.key === 'Enter') {
        e.preventDefault(); e.stopImmediatePropagation();
        pick(items[active < 0 ? 0 : active]);
      } else if (e.key === 'Escape') close();
    }, true);
    box.addEventListener('mousedown', function (e) {
      var it = e.target.closest('.npick-item'); if (!it) return;
      e.preventDefault(); pick(items[+it.dataset.i]);
    });
    if (sectionEl) { sectionEl.readOnly = true; sectionEl.placeholder = 'auto'; sectionEl.tabIndex = -1; }
    return { pick: function (name, sec) { var p = people.filter(function (x) { return x.name === name && x.sec === sec; })[0]; if (p) pick(p); } };
  };
})();
