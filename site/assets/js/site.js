/* RoboTeam project page.
   Data: data/tasks.json (the 36 tasks), data/media.json (where every video, poster, clip and
   the film is) and results.json from the media repository (who completed what). No result is
   written in the HTML.
   Local preview: ?media=URL reads posters, clips, the film and results.json from another copy of
   the media repository, for example one served from this computer. */
'use strict';

const MEDIA = 'https://changxuanfan.github.io/RoboTeam-media/';
const override = new URLSearchParams(location.search).get('media');
const mediaUrl = url => (override && url.startsWith(MEDIA) ? override.replace(/\/?$/, '/') + url.slice(MEDIA.length) : url);
const RESULTS_URL = mediaUrl(MEDIA + 'results.json');

const TYPES = [['transport', 'Transport'], ['mosaic', 'Mosaic'], ['relay', 'Relay'], ['dial', 'Dial']];
const SIZES = ['small', 'medium', 'large'];
const UNIT = { targets: 'items', cells: 'cubes', timbers: 'timbers', dials: 'dials' };
const TEAMS = {
  'gpt-6.1-sol': ['gpt-6.1-sol', 'in Codex'],
  'opus-5.5': ['opus-5.5', 'in Claude Code'],
  'kimi-k3.1-pro': ['kimi-k3.1-pro', 'in Codex'],
  'qwen3.8-flash': ['qwen3.8-flash', 'in Codex'],
  'deepseek-v4.1-flash': ['deepseek-v4.1-flash', 'in Codex'],
  'glm-5.3-flash': ['glm-5.3-flash', 'in Codex'],
  oracle: ['Oracle', 'gpt-6.1-sol, told where every object is'],
};
const REFERENCE = 'oracle';
const SPEEDS = [10, 20, 50, 100]; // times real time; the videos themselves are 10x

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const cap = s => s[0].toUpperCase() + s.slice(1);
const typeOf = task => task.split('-')[0];
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const nice = task => { const [type, size, level] = task.split('-'); return `${cap(type)} · ${cap(size)} · Level ${level[1]}`; };
const short = task => { const [, size, level] = task.split('-'); return `${cap(size)} · Level ${level[1]}`; };

const D = { tasks: [], facts: {}, sets: [], runs: {}, outcomes: null, media: null };
const F = { status: 'all', team: 'all', job: 'all' };
const teamName = key => (TEAMS[key] || [key])[0];
const run = (set, task) => D.runs[set][task]; // undefined when the run has no video yet
const outcome = (set, task) => D.outcomes && D.outcomes[set] && D.outcomes[set][task];
const done = (set, task) => { const o = outcome(set, task); return o ? !!o.completed : null; };
const facts = task => { const f = D.facts[task]; return f ? `${f.arms} arms · ${f.workload} ${UNIT[f.unit] || f.unit}` : ''; };
const poster = (set, task, view) => `${mediaUrl(D.media.posters)}${set}/${task}-${view}.webp`;
const video = (set, task, view) => `${D.media.sets.find(s => s.key === set).base}${run(set, task).folder}/${view}.mp4`;
const stateText = (set, task) => {
  if (!run(set, task)) return null;
  const o = outcome(set, task); if (!o) return 'Result to come';
  return (o.completed ? 'Finished the job' : 'Did not finish') + (o.hours != null ? ` · ${o.hours} h of work` : '');
};

/* ---------- theme, copy buttons, citation ---------- */
function chrome() {
  const root = document.documentElement, button = $('theme');
  const sync = () => { const dark = root.dataset.theme === 'dark'; button.setAttribute('aria-pressed', dark); button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); };
  button.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('roboteam-theme', root.dataset.theme); } catch { /* storage may be blocked */ }
    sync();
  });
  sync();
  document.querySelectorAll('.copy').forEach(b => b.addEventListener('click', async () => {
    const text = $(b.dataset.copy).textContent;
    try { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; } catch { getSelection().selectAllChildren($(b.dataset.copy)); }
    setTimeout(() => { b.textContent = 'Copy'; }, 1600);
  }));
  const cite = $('cite');
  document.querySelectorAll('[data-cite]').forEach(b => b.addEventListener('click', () => cite.showModal()));
  $('cite-close').addEventListener('click', () => cite.close());
  cite.addEventListener('click', e => { if (e.target === cite) cite.close(); });
}

/* ---------- three pages: Overview, Results, Videos ----------
   #overview, #results and #videos open a page; the id of anything inside a page (#new,
   #f-vision, ...) opens that page and scrolls to it; #task=<task>[&set=<set>] opens a run. */
const VIEWS = ['overview', 'results', 'videos'];
let current = null;
const shown = {};
function showView(name) {
  if (current === name) return;
  current = name;
  VIEWS.forEach(v => { $(v).hidden = v !== name; });
  document.querySelectorAll('#nav a').forEach(a => { const on = a.dataset.view === name; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.title = name === 'overview' ? 'RoboTeam — AI teams running a factory hall of robot arms' : `${cap(name)} · RoboTeam`;
  if (!shown[name]) { shown[name] = true; (onFirstShow[name] || (() => {}))(); }
  drawCharts(name);
}
const onFirstShow = {};
function route() {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash.startsWith('task=')) {
    const link = new URLSearchParams(hash), task = link.get('task'), set = link.get('set') || D.sets[0];
    showView('videos');
    if (task && D.runs[set] && run(set, task)) openRun(set, task);
    return;
  }
  if (!hash || VIEWS.includes(hash)) { showView(hash || 'overview'); scrollTo({ top: 0, behavior: 'instant' }); return; }
  const target = document.getElementById(hash), view = target && target.closest('.page');
  showView(view ? view.id : 'overview');
  if (target) setTimeout(() => target.scrollIntoView({ block: 'start', behavior: 'instant' }), 0);
}
function tocSpy() {
  const links = [...document.querySelectorAll('#toc a')], parts = links.map(a => document.querySelector(a.getAttribute('href')));
  const spy = () => {
    if (current !== 'results') return;
    let on = 0; parts.forEach((p, i) => { if (p.getBoundingClientRect().top < 160) on = i; });
    links.forEach((a, i) => a.classList.toggle('on', i === on));
  };
  addEventListener('scroll', spy, { passive: true }); spy();
}

/* ---------- clips that play only while they are on screen ---------- */
const onScreen = new IntersectionObserver(entries => entries.forEach(e => {
  const v = e.target;
  if (e.isIntersecting) v.play().catch(() => {}); else v.pause();
}), { threshold: 0.35 });

function clipVideo(src, posterUrl, label) {
  const v = el('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
  v.src = src; if (posterUrl) v.poster = posterUrl; v.setAttribute('aria-label', label);
  onScreen.observe(v); return v;
}

function film() {
  const f = D.media.film, box = $('film'); if (!f || !f.loop) return;
  // The 720p file is sharp enough unless the box is wider than about 1400 device pixels.
  const base = mediaUrl(f.base), wide = box.clientWidth * (devicePixelRatio || 1) > 1400;
  const v = clipVideo(base + (wide || !f.loop.small ? f.loop.video : f.loop.small), '', 'The RoboTeam film');
  v.preload = 'auto'; v.addEventListener('playing', () => v.classList.add('ready'), { once: true });
  if (override) box.querySelector('.film-poster').src = base + f.loop.poster;
  box.append(v);
  if (f.film) {
    const b = $('watch-film'); b.hidden = false;
    if (f.film.seconds) b.querySelector('span').textContent = `Watch the film · ${clock(f.film.seconds)}`;
    b.addEventListener('click', () => openFilm(base + f.film.video, base + f.film.poster));
  }
}

function clips() {
  const c = D.media.clips; if (!c) return;
  const base = mediaUrl(c.base), byKey = Object.fromEntries(c.items.map(i => [i.key, i]));
  const speedTag = clip => `<span class="speed">${clip.speed.toLocaleString('en-US')}× real time</span>`;
  document.querySelectorAll('.job[data-clip]').forEach(job => {
    const clip = byKey[job.dataset.clip]; if (!clip) return;
    const frame = job.querySelector('.clip'); frame.append(clipVideo(base + clip.video, base + clip.poster, clip.caption)); frame.insertAdjacentHTML('beforeend', speedTag(clip));
    frame.insertAdjacentHTML('beforeend', `<span class="shown">${teamName(clip.set)} · ${short(clip.task)}</span>`);
    if (run(clip.set, clip.task)) { frame.classList.add('opens'); frame.title = 'Open the whole run'; frame.addEventListener('click', () => openRun(clip.set, clip.task)); }
  });
}

/* ---------- results: three numbers and the board of squares ---------- */
function numbers(results) {
  const best = results.conditions.find(c => c.key === 'adaptive'); if (!best) return;
  const items = [
    ['transport', `${best.completed} / 36`, 'jobs finished by the best team'],
    ['relay', `${best.median_hours.toFixed(1)} h`, 'of work for a typical job'],
    ['dial', `${Math.round(best.atomic_failure * 100)}%`, 'of its steps fail at least once and are tried again'],
  ];
  $('big').innerHTML = items.map(([type, big, small]) => `<div class="t-${type}"><b>${big}</b><span>${small}</span></div>`).join('');
}

function boardRow(set) {
  const [label, setup] = TEAMS[set] || [set, ''], reference = set === REFERENCE;
  const row = el('div', 'row');
  const who = el('button', 'who', `<b>${label}${reference ? '<span class="tag">Reference</span>' : ''}</b><small>${setup}</small>`); who.type = 'button';
  who.title = 'Show these videos'; who.addEventListener('click', () => { F.team = set; F.status = 'all'; F.job = 'all'; library(); if (location.hash === '#videos') route(); else location.hash = 'videos'; });
  const count = D.tasks.filter(t => done(set, t)).length;
  row.append(who, el('div', 'score', `<b>${D.outcomes ? count : '–'}</b><span>/36</span>`));
  const groups = el('div', 'groups');
  TYPES.forEach(([type, typeName]) => {
    const g = el('div', `grp t-${type}`); g.dataset.name = typeName;
    SIZES.forEach(size => {
      const tri = el('div', 'tri');
      [1, 2, 3].forEach(level => {
        const task = `${type}-${size}-l${level}`, has = !!run(set, task), finished = done(set, task);
        const c = el('button', `cell${finished ? ' done' : ''}${has ? '' : ' none'}`); c.type = 'button';
        c.dataset.set = set; c.dataset.task = task;
        c.setAttribute('aria-label', `${label}, ${nice(task)}: ${stateText(set, task) || 'video coming soon'}`);
        c.addEventListener('mouseenter', () => tip(c, set, task)); c.addEventListener('focus', () => tip(c, set, task));
        c.addEventListener('mouseleave', hideTip); c.addEventListener('blur', hideTip);
        c.addEventListener('click', () => (has ? openRun(set, task) : tip(c, set, task)));
        tri.append(c);
      });
      g.append(tri);
    });
    groups.append(g);
  });
  row.append(groups); return row;
}

function board() {
  const b = $('board'); b.innerHTML = '';
  const cols = el('div', 'cols', '<span></span><span></span>' + TYPES.map(([k, n]) => `<div class="ch t-${k}">${n}<small><span>Small</span><span>Medium</span><span>Large</span></small></div>`).join(''));
  b.append(el('div', 'band', 'From camera images alone'), cols);
  D.sets.filter(s => s !== REFERENCE).forEach(s => b.append(boardRow(s)));
  if (D.sets.includes(REFERENCE)) { const o = el('div', 'oracle'); o.append(boardRow(REFERENCE)); b.append(o); }
}

function tip(anchor, set, task) {
  const t = $('tip'), has = !!run(set, task); t.className = `tip t-${typeOf(task)}`;
  t.innerHTML = (has ? `<img alt="" src="${poster(set, task, 'front')}">` : '') +
    `<div class="tip-body"><div><b>${nice(task)}</b><small>${teamName(set)} · ${facts(task)}</small></div>` +
    `<div class="tip-state">${has ? `<i class="${done(set, task) ? 'done' : ''}"></i><span>${stateText(set, task)}</span>` : '<span class="soon">Coming soon</span>'}</div></div>`;
  t.hidden = false;
  const a = anchor.getBoundingClientRect(), w = 236, h = t.offsetHeight;
  let y = a.top - h - 10; if (y < 8) y = a.bottom + 10;
  t.style.left = `${Math.min(Math.max(8, a.left + a.width / 2 - w / 2), innerWidth - w - 8)}px`; t.style.top = `${y}px`;
}
function hideTip() { $('tip').hidden = true; }
addEventListener('scroll', hideTip, { passive: true });

/* ---------- all videos ---------- */
function chipRow(id, key, options) {
  const box = $(id); box.innerHTML = '';
  options.forEach(([value, html, cls]) => {
    const b = el('button', `chip ${cls || ''}`, html); b.type = 'button'; b.setAttribute('aria-pressed', F[key] === value);
    b.addEventListener('click', () => { F[key] = value; library(); }); box.append(b);
  });
}

function library() {
  const pass = (set, task) => (F.team === 'all' || F.team === set) && (F.job === 'all' || typeOf(task) === F.job);
  const wanted = (set, task) => F.status === 'all' || done(set, task) === (F.status === 'yes');
  const tally = status => D.sets.reduce((n, s) => n + D.tasks.filter(t => run(s, t) && pass(s, t) && (status === 'all' || done(s, t) === (status === 'yes'))).length, 0);
  chipRow('filter-status', 'status', [['all', `All <small>${tally('all')}</small>`], ['yes', `<i class="sq done" style="--c:var(--ink)"></i>Complete <small>${tally('yes')}</small>`], ['no', `<i class="sq" style="--c:var(--ink)"></i>Incomplete <small>${tally('no')}</small>`]]);
  chipRow('filter-team', 'team', [['all', 'All teams']].concat(D.sets.map(s => [s, teamName(s)])));
  chipRow('filter-job', 'job', [['all', 'All jobs']].concat(TYPES.map(([k, n]) => [k, `<i></i>${n}`, `t-${k}`])));
  const box = $('library'); box.innerHTML = ''; let shown = 0;
  D.sets.forEach(set => {
    if (F.team !== 'all' && F.team !== set) return;
    const tasks = D.tasks.filter(t => pass(set, t));
    const list = tasks.filter(t => run(set, t) && wanted(set, t));
    const soon = F.status === 'yes' ? [] : tasks.filter(t => !run(set, t));
    if (!list.length && !soon.length) return;
    shown += list.length;
    const section = el('section', 'team'); section.id = `team-${set}`;
    const minutes = Math.round(list.reduce((n, t) => n + run(set, t).seconds, 0) / 60);
    const finished = D.outcomes ? D.tasks.filter(t => done(set, t)).length : null;
    section.append(el('div', 'team-head', `<h3>${teamName(set)}${set === REFERENCE ? '<span class="tag">Reference</span>' : ''}</h3><span>${list.length} ${list.length === 1 ? 'video' : 'videos'}${list.length ? ` · ${minutes} min` : ''}</span>${finished !== null ? `<b>${finished} of 36 finished</b>` : ''}`));
    const grid = el('div', 'grid');
    list.forEach(task => {
      const r = run(set, task), finished = done(set, task), o = outcome(set, task);
      const card = el('button', `card t-${typeOf(task)}`); card.type = 'button';
      card.innerHTML = `<div class="thumb"><img alt="" loading="lazy" src="${poster(set, task, 'front')}"><img class="alt" alt="" data-src="${poster(set, task, 'top')}">` +
        (F.status === 'all' && finished !== null ? `<span class="mark${finished ? ' done' : ''}">${finished ? 'Complete' : 'Incomplete'}</span>` : '') +
        `<span class="len">${clock(r.seconds)}</span></div><b><i></i>${F.job === 'all' ? `${cap(typeOf(task))} · ` : ''}${short(task)}</b><small>${facts(task)}${o && o.hours != null ? ` · ${o.hours} h` : ''}</small>`;
      card.addEventListener('pointerenter', () => { const alt = card.querySelector('.alt'); if (alt && !alt.src) alt.src = alt.dataset.src; }, { once: true });
      card.addEventListener('click', () => openRun(set, task)); grid.append(card);
    });
    if (soon.length) grid.append(el('div', 'rest', `<b><span class="soon">Coming soon</span>${soon.length} more ${soon.length === 1 ? 'video' : 'videos'}</b><ul>${soon.map(t => `<li class="t-${typeOf(t)}"><i></i>${F.job === 'all' ? `${cap(typeOf(t))} · ` : ''}${short(t)}</li>`).join('')}</ul>`));
    section.append(grid); box.append(section);
  });
  if (!box.children.length) box.append(el('p', 'empty', 'No run matches these filters.'));
  $('count').textContent = `${shown} ${shown === 1 ? 'video' : 'videos'} shown`;
}

/* ---------- the player: three cameras on one clock ---------- */
const P = { videos: [], main: 0, speed: 10, set: null, task: null, timer: null };

function playerVideos() { return P.videos.filter(v => v.isConnected); }
function eachVideo(f) { playerVideos().forEach(f); }
function setSpeed(times) {
  P.speed = times; eachVideo(v => { v.playbackRate = times / 10; });
  document.querySelectorAll('#player-views .speed').forEach(s => { s.textContent = `${times}× real time`; });
  document.querySelectorAll('#player-speed .chip').forEach(b => b.setAttribute('aria-pressed', +b.dataset.speed === times));
}
function tick() {
  const m = P.videos[P.main]; if (!m) return;
  if (m.duration) { $('player-seek').value = Math.round(1000 * m.currentTime / m.duration); $('player-time').textContent = `${clock(m.currentTime)} / ${clock(m.duration)}`; }
  $('player-play').classList.toggle('playing', !m.paused);
  eachVideo(v => { if (v !== m && Math.abs(v.currentTime - m.currentTime) > 0.25) v.currentTime = m.currentTime; });
}
function togglePlay() {
  const m = P.videos[P.main]; if (!m) return;
  if (m.paused) eachVideo(v => v.play().catch(() => {})); else eachVideo(v => v.pause());
}
function buildViews(sources) {
  const box = $('player-views'); box.innerHTML = ''; box.classList.toggle('single', sources.length === 1); P.videos = []; P.main = 0;
  sources.forEach(([label, src, posterUrl], i) => {
    const frame = el('button', `view${i === 0 ? ' main' : ''}`); frame.type = 'button';
    const v = el('video'); v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = src; if (posterUrl) v.poster = posterUrl;
    v.addEventListener('ended', () => eachVideo(x => x.pause()));
    frame.append(v, el('span', 'view-tag', label), el('span', 'speed', ''));
    frame.addEventListener('click', () => {
      if (i === P.main) return togglePlay();
      document.querySelectorAll('#player-views .view').forEach((f, j) => f.classList.toggle('main', j === i)); P.main = i;
    });
    box.append(frame); P.videos.push(v);
  });
}
function showPlayer() {
  const p = $('player'); if (!p.open) p.showModal();
  clearInterval(P.timer); P.timer = setInterval(tick, 200);
  eachVideo(v => v.play().catch(() => {}));
}

function openRun(set, task) {
  hideTip(); P.set = set; P.task = task;
  const finished = done(set, task), o = outcome(set, task), r = run(set, task), p = $('player');
  p.className = `player t-${typeOf(task)}`;
  $('player-title').innerHTML = `<i></i>${nice(task)}` + (finished !== null ? ` <span class="state${finished ? ' done' : ''}">${finished ? 'Finished' : 'Not finished'}</span>` : '');
  $('player-sub').textContent = `${teamName(set)} · ${facts(task)}${o && o.hours != null ? ` · ${o.hours} hours of work` : ''} · ${clock(r.seconds)} of video`;
  buildViews(D.media.views.map(view => [view, video(set, task, view), view === 'side' ? '' : poster(set, task, view)]));
  $('player-speed').hidden = false; $('player-compare').hidden = false;
  $('player-speed').innerHTML = SPEEDS.map(s => `<button class="chip" type="button" data-speed="${s}">${s}×</button>`).join('');
  $('player-speed').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
  $('player-compare').innerHTML = D.sets.map(s => `<button class="chip" type="button" data-set="${s}" aria-pressed="${s === set}" ${run(s, task) ? '' : 'disabled title="Video coming soon"'}><i class="sq${done(s, task) ? ' done' : ''}"></i>${teamName(s)}</button>`).join('');
  $('player-compare').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { if (!b.disabled && b.dataset.set !== P.set) openRun(b.dataset.set, task); }));
  setSpeed(P.speed); showPlayer();
  document.querySelectorAll('.cell.cur').forEach(c => c.classList.remove('cur'));
  document.querySelectorAll(`.cell[data-set="${set}"][data-task="${task}"]`).forEach(c => c.classList.add('cur'));
}

function openFilm(src, posterUrl) {
  const p = $('player'); p.className = 'player';
  $('player-title').textContent = 'RoboTeam'; $('player-sub').textContent = 'The film';
  buildViews([['film', src, posterUrl]]);
  $('player-speed').hidden = true; $('player-compare').hidden = true;
  P.videos[0].playbackRate = 1; showPlayer();
}

function playerControls() {
  const p = $('player');
  const close = () => { clearInterval(P.timer); eachVideo(v => { v.pause(); v.removeAttribute('src'); v.load(); }); $('player-views').innerHTML = ''; if (p.open) p.close(); document.querySelectorAll('.cell.cur').forEach(c => c.classList.remove('cur')); };
  $('player-close').addEventListener('click', close);
  p.addEventListener('click', e => { if (e.target === p) close(); });
  p.addEventListener('cancel', e => { e.preventDefault(); close(); });
  $('player-play').addEventListener('click', togglePlay);
  $('player-seek').addEventListener('input', e => { const m = P.videos[P.main]; if (m && m.duration) eachVideo(v => { v.currentTime = m.duration * e.target.value / 1000; }); });
}


/* ---------- charts: drawn at the width they are shown, so text is always 12 px ---------- */
const FINDINGS_URL = mediaUrl(MEDIA + 'findings.json');
let FD = null;
const svg = (w, h, body, label) => `<svg class="chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${body}</svg>`;
const txt = (x, y, s, cls = '', anchor = 'start', extra = '') => `<text x="${x.toFixed ? x.toFixed(1) : x}" y="${y}" class="${cls}" text-anchor="${anchor}" ${extra}>${s}</text>`;
const fmt1 = n => (Math.round(n * 10) / 10).toString();
const pct = v => (v < 1 ? fmt1(v) : Math.round(v)) + '%';
const widthOf = box => Math.max(280, Math.floor(box.clientWidth));
function setText(id, cap, title, say, key) {
  $(id).querySelector('.f-text').innerHTML = `<p class="kicker">${cap}</p><h3>${title}</h3><p class="say">${say}</p>` + (key ? `<div class="key"><b>${key[0]}</b><span>${key[1]}</span></div>` : '');
}

function chartCompare(F, box) {
  const narrow = box.clientWidth < 560, W = narrow ? 560 : widthOf(box), H = 380, L = 40, R = 26, T = 22, B = 44;
  const lx = m => Math.log10(m), x0 = lx(0.06), x1 = lx(2400);
  const X = m => L + (lx(m) - x0) / (x1 - x0) * (W - L - R), Y = a => T + (1 - a / 17) * (H - T - B);
  let g = '';
  [[0.1, '6 s'], [1, '1 min'], [10, '10 min'], [60, '1 h'], [240, '4 h'], [1440, '24 h']].forEach(([m, l]) => { g += `<line class="grid" x1="${X(m)}" x2="${X(m)}" y1="${T}" y2="${H - B}"/>` + txt(X(m), H - B + 18, l, '', 'middle'); });
  [0, 4, 8, 12, 16].forEach(a => { g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(a)}" y2="${Y(a)}"/>` + txt(L - 8, Y(a) + 4, a, '', 'end'); });
  g += txt(L - 8, T - 8, 'ARMS', '', 'end') + txt(W - R, H - 6, 'HOW LONG A RUN LASTS →', '', 'end');
  const place = { ReflexBench: [0, -13, 'middle'], EmbodiedBench: [-7, 17, 'end'], VLABench: [7, 17, 'start'], RoboTwin: [10, 4, 'start'], RoboFactory: [0, -13, 'middle'], RoCoBench: [0, -13, 'middle'],
    RobotWorld: [-9, 17, 'end'], RoboColiseum: [0, -13, 'middle'], PARTNR: [9, 17, 'start'], 'Embodied First Exam': [0, 22, 'middle'], RoboTeam: [-18, 5, 'end'] };
  const nudge = { EmbodiedBench: 0.86, VLABench: 1.16 };
  F.benchmarks.rows.forEach(([name, arms, , real, vision, minutes, , group]) => {
    const cx = X(minutes * (nudge[name] || 1)), cy = Y(arms), ours = group === 'ours', r = ours ? 8 : 5.5;
    const cls = ours ? 'c-ink' : group === 'agent' ? 'c-dim' : 'c-line';
    if (real !== 'no') g += `<circle cx="${cx}" cy="${cy}" r="${r + 5}" class="${cls}" stroke-width="1.6" ${real === 'partly' ? 'stroke-dasharray="2 3"' : ''} style="fill:none"/>`;
    g += `<circle cx="${cx}" cy="${cy}" r="${r}" class="${cls}${vision === 'yes' ? '' : ' hollow'}" stroke-width="2"/>`;
    const [dx, dy, an] = place[name] || [8, 4, 'start'];
    g += txt(cx + dx, cy + dy, name, ours ? 'big' : 'ink2', an);
  });
  box.innerHTML = `<div class="${narrow ? 'scroll-x' : ''}">${svg(W, H, g, 'Benchmarks by number of arms and run length; RoboTeam is the only one with 16 arms and runs of up to 24 hours')}</div>` +
    `<div class="keyrow"><span>● cameras only</span><span>○ given object positions, fully or partly</span><span>◎ the world never pauses</span><span><i style="--c:var(--dim)"></i>AI agents</span><span><i style="--c:var(--line2)"></i>trained policies</span></div>` +
    `<p class="src">From the paper's comparison table. ${F.benchmarks.left_out}</p>`;
}

let pickProgress = 'both';
function chartProgress(F, box) {
  setText('f-progress', 'Every run, step by step', 'Each line is one run of a job.', 'A line rises when an arm finishes a step, such as one cube placed. A circle ends a finished job, a cross one that ran out of time or was given up. Point at a line to see the run; click it to watch.');
  box.innerHTML = '';
  const seg = el('div', 'seg');
  [['both', 'Both'], ['gpt-6.1-sol', 'gpt-6.1-sol'], ['opus-5.5', 'opus-5.5']].forEach(([k, n]) => { const b = el('button', '', n); b.type = 'button'; b.setAttribute('aria-pressed', k === pickProgress); b.onclick = () => { pickProgress = k; chartProgress(F, box); }; seg.append(b); });
  const grid = el('div', 'small-multiples'), info = el('p', 'src', pickProgress === 'both' ? 'Solid lines: gpt-6.1-sol. Dashed lines: opus-5.5. Both with the adaptive agent system.' : '&nbsp;');
  box.append(seg, grid, info);
  const cols = box.clientWidth >= 900 ? 4 : box.clientWidth >= 520 ? 2 : 1, W = Math.floor((box.clientWidth - 16 * (cols - 1)) / cols), H = Math.round(Math.min(230, W * 0.72)), L = 34, R = 10, T = 10, B = 24;
  TYPES.forEach(([type, typeName]) => {
    const runs = F.timelines.filter(r => typeOf(r.task) === type && (pickProgress === 'both' || r.set === pickProgress));
    const top = Math.max(...F.timelines.filter(r => typeOf(r.task) === type).map(r => r.steps), 1);
    const X = h => L + Math.min(h, 24) / 24 * (W - L - R), Y = v => T + (1 - v / top) * (H - T - B);
    let g = '';
    [0, 6, 12, 18, 24].forEach(h => { g += `<line class="grid" x1="${X(h)}" x2="${X(h)}" y1="${T}" y2="${H - B}"/>` + txt(X(h), H - B + 16, h + ' h', '', 'middle'); });
    g += txt(L - 6, Y(top) + 4, top, '', 'end') + txt(L - 6, Y(0) + 4, 0, '', 'end');
    runs.forEach(r => {
      let d = `M${X(0).toFixed(1)} ${Y(0).toFixed(1)}`;
      r.points.forEach(([h, v]) => { d += `H${X(h).toFixed(1)}V${Y(v).toFixed(1)}`; });
      const ex = X(r.hours), ey = Y(r.steps);
      const end = r.done ? `<circle cx="${ex}" cy="${ey}" r="3.4" class="c-${type} hollow" stroke-width="1.6"/>` : `<path d="M${ex - 3.5} ${ey - 3.5}l7 7m0-7l-7 7" class="c-${type}" stroke-width="1.6" style="fill:none"/>`;
      g += `<g data-i="${F.timelines.indexOf(r)}"><path d="${d}" class="line c-${type}" style="fill:none;${r.set === 'opus-5.5' && pickProgress === 'both' ? 'stroke-dasharray:4 2' : ''}"/>${end}<path d="${d}" class="hit"/></g>`;
    });
    const fig = el('div'); fig.innerHTML = `<div class="keyrow" style="margin-bottom:6px"><span><i style="--c:var(--${type})"></i>${typeName}</span><span>steps done, 0 to ${top}</span></div>` + svg(W, H, g, `${typeName}: progress of each run`);
    const s = fig.querySelector('svg');
    s.addEventListener('pointerover', e => { const gEl = e.target.closest('g[data-i]'); if (!gEl) return; const r = F.timelines[+gEl.dataset.i];
      s.classList.add('dimmed'); gEl.querySelector('.line').classList.add('hot');
      info.innerHTML = `<b>${nice(r.task)}</b> · ${teamName(r.set)} · ${r.steps} steps in ${fmt1(r.hours)} h · ${r.done ? 'finished' : 'not finished'} · click to watch`; });
    s.addEventListener('pointerout', e => { const gEl = e.target.closest('g[data-i]'); if (gEl) gEl.querySelector('.line').classList.remove('hot'); s.classList.remove('dimmed'); });
    s.addEventListener('click', e => { const gEl = e.target.closest('g[data-i]'); if (!gEl) return; const r = F.timelines[+gEl.dataset.i]; if (run(r.set, r.task)) openRun(r.set, r.task); });
    grid.append(fig);
  });
}

function chartVision(F, box) {
  const v0 = F.vision;
  setText('f-vision', 'Vision', 'Seeing is the hard part.', `Told where every object is, the same AI finishes all ${v0[0].completed} jobs. From cameras it finishes ${v0[1].completed}. With blurred pictures or without its own code, it falls to about a third. Drag across the picture to see what 128 × 80 pixels leave.`, [`${v0[0].completed} → ${v0[1].completed}`, 'jobs, when the AI must find objects itself']);
  const W = widthOf(box), rowH = 46, H = v0.length * rowH + 18, BW = W - 96;
  let g = txt(W, 12, 'GRASPS THAT FAIL', '', 'end');
  v0.forEach((v, i) => {
    const y = 22 + i * rowH, bw = Math.max(4, (BW - 40) * v.completed / 36);
    g += txt(0, y + 4, v.label, 'ink2') + `<rect x="0" y="${y + 11}" width="${BW - 40}" height="12" rx="6" class="track"/><rect x="0" y="${y + 11}" width="${bw}" height="12" rx="6" class="${i === 0 ? 'c-dim' : 'c-ink'}"/>` +
      txt(bw + 8, y + 22, v.completed, 'lab') + txt(W, y + 22, pct(v.grasp_fail), 'ink', 'end');
  });
  const base = mediaUrl(MEDIA + 'findings/');
  box.innerHTML = svg(W, H, g, 'Tasks completed out of 36 under four vision conditions');
  const cmp = el('div', 'compare', `<img src="${base}camera-full.webp" alt="A Transport camera picture at 1280 by 800 pixels" loading="lazy"><img class="low" src="${base}camera-128x80.png" alt="The same picture at 128 by 80 pixels" loading="lazy"><i class="bar"></i><span class="l">1280 × 800</span><span class="r">128 × 80</span>`);
  const move = e => { const r = cmp.getBoundingClientRect(); cmp.style.setProperty('--cut', `${Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100))}%`); };
  cmp.addEventListener('pointerdown', e => { cmp.setPointerCapture(e.pointerId); move(e); }); cmp.addEventListener('pointermove', e => { if (e.buttons) move(e); });
  box.append(cmp, el('p', 'src', `At 128 × 80 one pixel covers about ${F.vision_facts.pixel_mm} mm, more than twice the ${F.vision_facts.tolerance_mm} mm an agent has for placing a cube. In ${F.vision_facts.runs_with_measuring_code} of its 36 runs, gpt-6.1-sol writes its own code to measure positions in pictures.`));
}

function chartTime(F, box) {
  const t = F.timeline_facts;
  setText('f-time', 'Where the time goes', 'The arms mostly wait.', 'The world never pauses, but the arms spend most of it standing still while the agents think. Faster decisions would shorten jobs more than faster motion would.', [`${t.thinking_pct}% vs ${t.arms_moving_pct}%`, 'of one run: an agent thinking, an arm moving']);
  const W = widthOf(box), rowH = 32, H = F.time_shares.rows.length * rowH, L = Math.min(150, W * 0.34), BW = W - L - 4; let g = '';
  F.time_shares.rows.forEach(([name, th, rb, cd], i) => {
    const y = i * rowH + 6; let x = L;
    g += txt(L - 10, y + 14, name, i < 2 ? 'ink' : 'ink2', 'end');
    [[th, 'c-ink'], [rb, 'c-transport'], [cd, 'c-mosaic']].forEach(([v, c]) => { const w = BW * v / 100; g += `<rect x="${x}" y="${y}" width="${Math.max(w - 1.5, 0)}" height="20" class="${c}" rx="3"/>`; if (w > 34) g += txt(x + 7, y + 14, Math.round(v) + '%', '', 'start', 'style="fill:#fff"'); x += w; });
  });
  box.innerHTML = `<div class="keyrow"><span><i class="k-think"></i>thinking</span><span><i class="k-robot"></i>robot tool</span><span><i class="k-code"></i>own code</span></div>` + svg(W, H, g, 'Share of agent time spent thinking, using the robot tool and running code, per model') +
    `<p class="src">Share of agent time with the adaptive system. opus-5.5 thinks least and computes most.</p>`;
}

const SYS_ICON = {
  'single-agent': '<circle cx="60" cy="16" r="9" class="c-ink"/><path d="M60 25 L18 62 M60 25 L39 62 M60 25 L60 62 M60 25 L81 62 M60 25 L102 62" class="axis"/>',
  hierarchical: '<circle cx="60" cy="14" r="8" class="c-ink"/>' + [18, 39, 60, 81, 102].map(x => `<path d="M60 22 L${x} 40" class="axis"/><circle cx="${x}" cy="44" r="5" class="c-dim"/><path d="M${x} 49 L${x} 60" class="axis"/>`).join(''),
  decentralized: [18, 39, 60, 81, 102].map(x => `<circle cx="${x}" cy="40" r="5" class="c-dim"/><path d="M${x} 45 L${x} 60" class="axis"/>`).join('') + '<path d="M23 40 H34 M44 40 H55 M65 40 H76 M86 40 H97 M18 34 Q60 4 102 34" class="axis" style="fill:none"/>',
  adaptive: '<circle cx="60" cy="14" r="8" class="c-ink"/><path d="M60 22 L33 38 M60 22 L87 38 M60 22 L60 60" class="axis"/><circle cx="33" cy="42" r="5" class="c-dim"/><circle cx="87" cy="42" r="5" class="c-dim"/><path d="M33 47 L18 60 M33 47 L39 60 M87 47 L81 60 M87 47 L102 60" class="axis"/>',
};
function chartSystems(F, box) {
  const sp = F.spend, s6 = F.systems.slice(0, 3).map(x => x.within_6h);
  setText('f-systems', 'Team design', 'More agents: faster, but more tokens.', `How the team is organized barely changes how many jobs get done (27 to 29), but it trades time for cost. Within 6 hours the three multi-agent systems finish ${Math.min(...s6)} or ${Math.max(...s6)} jobs, the single agent ${F.systems[3].within_6h}. Spending alone does not buy success: ${sp[1].set} used ${fmt1(sp[1].input_tokens_b)} billion tokens and ${Math.round(sp[1].total_hours)} hours for ${sp[1].completed} job.`, ['1.6×', 'as long for a single agent; up to 1.9× the tokens with an agent per arm']);
  const W = widthOf(box), H = 280, L = 46, R = 16, T = 22, B = 40, xm = 60, ym = 450;
  const X = v => L + v / xm * (W - L - R), Y = v => T + (1 - v / ym) * (H - T - B); let g = '';
  [0, 20, 40, 60].forEach(v => { g += `<line class="grid" x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${H - B}"/>` + txt(X(v), H - B + 16, v + ' B', '', 'middle'); });
  [0, 100, 200, 300, 400].forEach(v => { g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/>` + txt(L - 6, Y(v) + 4, v + ' h', '', 'end'); });
  g += txt(W - R, H - 4, 'INPUT TOKENS, ALL 36 JOBS →', '', 'end') + txt(L, T - 8, '↑ HOURS, ALL 36 JOBS');
  const off = { adaptive: [-16, 4, 'end'], hierarchical: [0, -14, 'middle'], decentralized: [-12, 18, 'end'], 'single-agent': [12, 4, 'start'] };
  F.systems.forEach(s => {
    const cx = X(s.input_tokens_b), cy = Y(s.total_hours);
    if (s.key === 'adaptive') g += `<circle cx="${cx}" cy="${cy}" r="11" class="c-ink" stroke-width="1.6" style="fill:none"/>`;
    g += `<circle cx="${cx}" cy="${cy}" r="6" class="c-ink"/>`;
    const [dx, dy, an] = off[s.key]; g += txt(cx + dx, cy + dy, `${s.label} · ${s.completed} done`, 'lab', an);
  });
  const sys = { 'single-agent': ['Single agent', 'One agent drives every arm'], hierarchical: ['Hierarchical', 'A controller and one worker per arm'], decentralized: ['Decentralized', 'One worker per arm, no controller'], adaptive: ['Adaptive', 'A controller that creates helpers when work can be shared'] };
  box.innerHTML = `<div class="sys">${Object.entries(sys).map(([k, [n, d]]) => `<div class="${k === 'adaptive' ? 'on' : ''}"><svg viewBox="0 0 120 66" class="chart" aria-hidden="true">${SYS_ICON[k]}</svg><b>${n}</b><span>${d}</span></div>`).join('')}</div>` +
    svg(W, H, g, 'Total hours against total input tokens for the four agent systems of gpt-6.1-sol') + `<p class="src">gpt-6.1-sol, all 36 jobs. The ring marks the adaptive system, the one used everywhere else on this page.</p>`;
}

function chartFailure(F, box) {
  const f = F.failure_by_type;
  setText('f-failure', 'Steps that fail', 'Failing and retrying is normal.', 'A grasp slips, a handover misses, and the agents notice from the pictures and try again. In the median Relay job every handover fails at least once, yet 8 of the 9 Relay jobs are finished. The four weaker models rarely recover.', ['100%', 'of handovers fail at least once in a typical Relay job']);
  const W = widthOf(box), rowH = 32, L = 96, BW = W - L - 48; let g = '';
  TYPES.forEach(([type, name], i) => { const v = f.median_atomic_failure_pct[type], y = i * rowH + 4, w = BW * v / 100;
    g += txt(L - 10, y + 14, name, 'ink', 'end') + `<rect x="${L}" y="${y}" width="${BW}" height="20" rx="4" class="track"/><rect x="${L}" y="${y}" width="${w}" height="20" rx="4" class="c-${type}"/>` + txt(L + w + 8, y + 14, v + '%', 'lab'); });
  const LB = Math.min(160, W * 0.36), BW2 = W - LB - 52, H2 = F.grasp_failure.length * 26 + 26; let g2 = txt(0, 12, 'GRASPS THAT FAIL, BY MODEL');
  F.grasp_failure.forEach(([m, v], i) => { const y = 24 + i * 26, w = BW2 * v / 100;
    g2 += txt(LB - 10, y + 12, m, i < 2 ? 'ink' : 'ink2', 'end') + `<rect x="${LB}" y="${y}" width="${w}" height="16" rx="3" class="${i < 2 ? 'c-ink' : 'c-dim'}"/>` + txt(LB + w + 6, y + 12, Math.round(v) + '%', 'ink2'); });
  box.innerHTML = `<p class="panel-cap">Median share of steps that fail at least once, gpt-6.1-sol</p>` + svg(W, 4 * rowH + 4, g, 'Median share of steps that fail at least once, by task type') + svg(W, H2, g2, 'Share of grasps that fail, per model') +
    `<p class="src">A Relay job has about ${f.median_steps_note.relay} steps, a Mosaic job about ${f.median_steps_note.mosaic}.</p>`;
}

function chartLevels(F, box) {
  const lv = F.levels;
  setText('f-levels', 'Team size and level', 'Bigger teams are harder than harder jobs.', 'For gpt-6.1-sol, adding arms costs more than making the job harder. It finishes about the same share at every level, but fewer jobs as the team grows, because more arms must share the space and the work.', [`${lv.by_size[0]} → ${lv.by_size[2]}`, `of ${lv.of} jobs, from small to large teams`]);
  const two = box.clientWidth >= 520, W = two ? Math.floor((box.clientWidth - 28) / 2) : widthOf(box), H = 200, T = 40, B = 30;
  const group = (title, labels, vals, cls) => {
    const bw = Math.min(64, (W - 40) / 3 - 18), gap = (W - 3 * bw) / 4; let g = txt(0, 12, title);
    vals.forEach((v, i) => { const x = gap + i * (bw + gap), h = (H - T - B) * v / lv.of, y = H - B - h;
      g += `<line class="axis" x1="${x}" x2="${x + bw}" y1="${T}" y2="${T}" stroke-dasharray="3 3"/><rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="5" class="${cls}"/>` + txt(x + bw / 2, y - 7, `${v} of ${lv.of}`, 'lab', 'middle') + txt(x + bw / 2, H - B + 17, labels[i], 'ink2', 'middle'); });
    return svg(W, H, g, `${title}: ${vals.join(', ')} of ${lv.of}`); };
  box.innerHTML = `<div class="levels">${group('BY LEVEL, 12 JOBS EACH', ['Level 1', 'Level 2', 'Level 3'], lv.by_level, 'c-dim')}${group('BY TEAM SIZE, 12 JOBS EACH', ['Small', 'Medium', 'Large'], lv.by_size, 'c-ink')}</div>`;
}

const CHARTS = {
  overview: [['chart-compare', chartCompare, true]],
  results: [['f-progress', chartProgress], ['f-vision', chartVision], ['f-time', chartTime], ['f-systems', chartSystems], ['f-failure', chartFailure], ['f-levels', chartLevels]],
};
const drawnAt = {};
function drawCharts(view) {
  if (!FD || !CHARTS[view]) return;
  CHARTS[view].forEach(([id, draw, direct]) => {
    const box = direct ? $(id).querySelector('.f-chart') : $(id).querySelector('.f-chart');
    const w = Math.floor(box.clientWidth); if (!w || drawnAt[id] === w) return;
    drawnAt[id] = w; draw(FD, box);
  });
}
let resizeTimer;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => drawCharts(current), 150); });
async function findings() {
  try { FD = await load(FINDINGS_URL); drawCharts(current); } catch (e) { console.warn('findings', e); return; }
  // The charts change the height of the page; land again on a section the address points to.
  const id = decodeURIComponent(location.hash.slice(1)), target = id && !VIEWS.includes(id) && document.getElementById(id);
  if (target && target.closest('.page') && !target.closest('.page').hidden) setTimeout(() => target.scrollIntoView({ block: 'start', behavior: 'instant' }), 0);
}

/* ---------- the nine tasks of a job, at their start ---------- */
function nine() {
  const box = $('nine'), base = mediaUrl(MEDIA + 'tasks/');
  document.querySelectorAll('.job .more').forEach(b => b.addEventListener('click', () => {
    const type = b.closest('.job').dataset.type, open = b.getAttribute('aria-expanded') === 'true';
    document.querySelectorAll('.job .more').forEach(x => { x.setAttribute('aria-expanded', 'false'); x.textContent = 'See all nine tasks'; });
    if (open) { box.hidden = true; return; }
    b.setAttribute('aria-expanded', 'true'); b.textContent = 'Hide the nine tasks';
    const name = TYPES.find(t => t[0] === type)[1], rows = [1, 2, 3];
    const cell = (size, level) => { const id = `${type}-${size}-l${level}`, f = D.facts[id] || {};
      return `<img loading="lazy" src="${base}${id}.webp" alt="${nice(id)} at its start" title="${nice(id)}">`; };
    const head = SIZES.map(size => { const f = D.facts[`${type}-${size}-l1`] || {}; return `<div class="chd">${cap(size)}<small>${f.arms} arms · ${f.workload} ${UNIT[f.unit] || ''}</small></div>`; }).join('');
    box.className = `nine t-${type}`;
    box.innerHTML = `<div class="nine-head"><h3>${name}: three team sizes, three levels</h3><span class="src">Each task at its start, as the cameras see it.</span></div>` +
      `<div class="nine-grid"><span class="corner"></span>${head}${rows.map(l => { const f = D.facts[`${type}-small-l${l}`] || {}; return `<div class="rh">Level ${l}<b>${f.level_note || ''}</b></div>` + SIZES.map(size => cell(size, l)).join(''); }).join('')}</div>`;
    box.hidden = false; box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }));
}

/* ---------- start ---------- */
async function load(url) { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); }

async function start() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  chrome(); playerControls(); nine();
  const [tasks, media] = await Promise.all([load('data/tasks.json'), load('data/media.json')]);
  D.media = media; D.sets = media.sets.map(s => s.key);
  D.tasks = TYPES.flatMap(([type]) => SIZES.flatMap(size => [1, 2, 3].map(level => `${type}-${size}-l${level}`)));
  tasks.tasks.forEach(t => { D.facts[t.id] = t; });
  media.sets.forEach(s => { D.runs[s.key] = s.runs; });
  film(); clips(); board(); library(); tocSpy();
  addEventListener('hashchange', route); route();
  findings();
  try {
    const results = await load(RESULTS_URL);
    D.outcomes = results.outcomes; numbers(results); board(); library();
    const best = results.conditions.find(c => c.key === 'adaptive'); if (best) $('stat-best').textContent = `${best.completed} / 36`;
  } catch { /* the board and the library stay without results */ }
}

start();
