/* Builds a digital worksheet: page images with answer boxes placed on top. */
(function () {
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  window.buildSheet = function (root, spec, opts) {
    opts = opts || {};
    var inputs = {};
    var draftKey = 'draft_' + spec.id;
    var draft = {};
    try { draft = JSON.parse(store(draftKey) || '{}'); } catch (e) {}

    spec.pages.forEach(function (pg) {
      var page = document.createElement('div');
      page.className = 'page';
      var img = document.createElement('img');
      img.src = pg.img; img.alt = spec.title + ' page'; img.draggable = false;
      page.appendChild(img);
      pg.fields.forEach(function (f) {
        var el = document.createElement('input');
        el.type = 'text';
        el.className = 'box' + (f.text ? ' text' : '');
        el.autocomplete = 'off'; el.spellcheck = false;
        if (!f.text) el.inputMode = f.inputmode || 'decimal';
        el.setAttribute('aria-label', f.label || f.id);
        el.title = f.label || '';
        el.style.left = (f.r[0] / pg.w * 100) + '%';
        el.style.top = (f.r[1] / pg.h * 100) + '%';
        el.style.width = ((f.r[2] - f.r[0]) / pg.w * 100) + '%';
        el.style.height = ((f.r[3] - f.r[1]) / pg.h * 100) + '%';
        if (f.fs) el.style.fontSize = f.fs + 'cqw';
        if (f.ph) el.placeholder = f.ph;
        el.dataset.id = f.id;
        if (draft[f.id]) el.value = draft[f.id];
        el.addEventListener('input', function () {
          el.classList.toggle('filled', el.value.trim() !== '');
          el.classList.remove('missing');
          var d = {}; Object.keys(inputs).forEach(function (k) { d[k] = inputs[k].value; });
          store(draftKey, JSON.stringify(d));
          if ((f.id === 'name' || f.id === 'section') && opts.onInfo) opts.onInfo(f.id, el.value, spec.id);
          update();
        });
        el.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            var list = Object.keys(inputs).map(function (k) { return inputs[k]; });
            var i = list.indexOf(el); if (list[i + 1]) list[i + 1].focus();
          }
        });
        el.classList.toggle('filled', el.value.trim() !== '');
        inputs[f.id] = el;
        page.appendChild(el);
      });
      root.appendChild(page);
    });

    var picker = null;
    if (window.attachNamePicker && opts.grade) {
      picker = attachNamePicker(inputs.name, inputs.section, opts.grade);
      if (draft.name && draft.section) picker.pick(draft.name, draft.section);
      inputs.name.addEventListener('picked', function (e) {
        var d = {}; Object.keys(inputs).forEach(function (k) { d[k] = inputs[k].value; });
        store(draftKey, JSON.stringify(d));
        if (opts.onPick) opts.onPick(e.detail, spec.id);
      });
    }
    var bar = document.createElement('div');
    bar.className = 'submitbar';
    bar.innerHTML = '<div class="prog"><span class="cnt"></span><div class="bar"><i></i></div></div>' +
      '<button class="btn" type="button">Submit answers ✔</button>';
    root.appendChild(bar);
    var btn = bar.querySelector('.btn');
    var answerIds = Object.keys(inputs).filter(function (k) { return k !== 'name' && k !== 'section' && k !== 'date'; });

    function update() {
      var n = answerIds.filter(function (k) { return inputs[k].value.trim() !== ''; }).length;
      bar.querySelector('.cnt').textContent = n + ' of ' + answerIds.length + ' boxes filled';
      bar.querySelector('i').style.width = (n / answerIds.length * 100) + '%';
    }
    update();

    btn.addEventListener('click', function () {
      var name = inputs.name.value.trim();
      if (name && window.ROSTER && inputs.name.dataset.picked !== name) {
        inputs.name.classList.add('missing'); inputs.name.focus();
        inputs.name.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return showModal('Choose your name', '<p>Type the first letters of your first name, then <b>tap your name</b> in the list.</p>');
      }
      if (!name) {
        inputs.name.classList.add('missing'); inputs.name.focus();
        inputs.name.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return showModal('Write your name', '<p>Please write your name at the top of the sheet first.</p>');
      }
      var empty = answerIds.filter(function (k) { return inputs[k].value.trim() === ''; });
      if (empty.length) {
        empty.forEach(function (k) { inputs[k].classList.add('missing'); });
        if (!window._askedEmpty || window._askedEmpty !== spec.id) {
          window._askedEmpty = spec.id;
          inputs[empty[0]].scrollIntoView({ behavior: 'smooth', block: 'center' });
          return showModal('Some boxes are empty', '<p>' + empty.length + ' box(es) are still empty (marked in red).<br>Fill them in, or press <b>Submit</b> again to send anyway.</p>');
        }
      }
      var answers = {};
      answerIds.forEach(function (k) { answers[k] = inputs[k].value.trim(); });
      var section = inputs.section ? inputs.section.value.trim() : (opts.section || '');
      btn.disabled = true; btn.textContent = 'Sending…';
      fetch(window.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ sheet: spec.id, name: name, section: section, answers: answers })
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (!res.ok) throw new Error(res.error || 'Error');
        root.classList.add('submitted');
        btn.textContent = 'Submitted ✔';
        store(draftKey, '{}');
        var sc = res.total ? '<div class="big">' + res.score + ' / ' + res.total + '</div>' : '';
        showModal('Great job, ' + name.split(' ')[0] + '! 🎉', '<p>Your answers for <b>' + spec.title + '</b> were sent to your teacher.</p>' + sc);
      }).catch(function (err) {
        btn.disabled = false; btn.textContent = 'Submit answers ✔';
        showModal('Not sent', '<p>Something went wrong (' + err.message + '). Check your internet and press Submit again.</p>');
      });
    });
    return { inputs: inputs, picker: function () { return picker; } };
  };

  window.showModal = function (title, html) {
    var m = document.getElementById('modal');
    m.querySelector('h2').textContent = title;
    m.querySelector('.body').innerHTML = html;
    m.classList.add('show');
  };
  document.addEventListener('click', function (e) {
    if (e.target.matches('#modal button') || e.target.id === 'modal') document.getElementById('modal').classList.remove('show');
  });
})();
