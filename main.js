// Below Threshold, by Team PhASE: entry point for Qollab.
// The app is a TypeScript + React site (complete source in below-threshold-source.zip). This page
// shows the live deployment in a frame, with direct links in case the frame cannot load.

(function () {
  var SITE = 'https://bbfutaba.github.io/below-threshold/';
  var LINKS = [
    ['Open in a new tab', SITE],
    ['Pitch and film', SITE + 'film'],
    ["Shor's algorithm", SITE + 'learn/shor'],
    ['Play the decoder', SITE + 'play'],
  ];

  var css = document.createElement('style');
  css.textContent = [
    '.bt-wrap { display: flex; flex-direction: column; height: 100vh; }',
    '.bt-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; padding: 10px 16px;',
    '  background: var(--bar); border-bottom: 1px solid var(--border); }',
    '.bt-title { font-weight: 700; margin-right: auto; }',
    '.bt-title span { color: var(--muted); font-weight: 400; }',
    '.bt-bar a { color: var(--link); text-decoration: none; white-space: nowrap; }',
    '.bt-bar a:hover { text-decoration: underline; }',
    '.bt-frame { flex: 1; width: 100%; border: 0; background: var(--bg); }',
  ].join('\n');
  document.head.appendChild(css);

  var wrap = document.createElement('div');
  wrap.className = 'bt-wrap';

  var bar = document.createElement('div');
  bar.className = 'bt-bar';
  var title = document.createElement('div');
  title.className = 'bt-title';
  title.innerHTML = 'Below Threshold <span>· Team PhASE</span>';
  bar.appendChild(title);
  LINKS.forEach(function (l) {
    var a = document.createElement('a');
    a.href = l[1];
    a.textContent = l[0];
    a.target = '_blank';
    a.rel = 'noopener';
    bar.appendChild(a);
  });

  var frame = document.createElement('iframe');
  frame.className = 'bt-frame';
  frame.src = SITE;
  frame.title = 'Below Threshold, live app';
  frame.allow = 'fullscreen; autoplay; clipboard-write';
  frame.setAttribute('allowfullscreen', '');

  wrap.appendChild(bar);
  wrap.appendChild(frame);
  document.body.appendChild(wrap);
})();
