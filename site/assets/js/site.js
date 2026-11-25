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
  oracle: ['Oracle', 'the same AI, given the ground-truth position of every object'],
};
const REFERENCE = 'oracle';
const SPEEDS = [10, 20, 50, 100, 500, 1500]; // times real time; the videos themselves are 10x
// 500x plays its own copy of each video (every 50th frame of the 10x one) at normal speed, which stays smooth; 1500x plays that copy 3 times as fast
const FAST = 500, FAST_STEP = 50, fastSrc = src => src.replace(/\.mp4$/, '-500x.mp4');
// Hugging Face answers every request for a file with a redirect to a signed CDN address (about a
// second each time, and it is never cached). direct() asks once, remembers the CDN address until
// shortly before it expires, and falls back to the plain address on any failure.
const DIRECT = new Map();
function direct(url) {
  if (!/^https:\/\/huggingface\.co\//.test(url)) return Promise.resolve(url);
  const hit = DIRECT.get(url); if (hit && hit.until > Date.now()) return hit.p;
  const p = fetch(url, { method: 'HEAD' }).then(r => {
    if (!r.ok || !r.url || r.url === url) throw new Error('no redirect');
    const exp = +(new URL(r.url).searchParams.get('Expires') || 0) * 1000;
    DIRECT.set(url, { p: Promise.resolve(r.url), until: exp ? exp - 5 * 60 * 1000 : Date.now() + 10 * 60 * 1000 });
    return r.url;
  }).catch(() => { DIRECT.delete(url); return url; });
  DIRECT.set(url, { p, until: Date.now() + 10 * 60 * 1000 });
  return p;
}
// Plays `url` in `v` through its CDN address; if that address fails (for example once it expires),
// goes back to the plain address at the same moment.
function setVideoSrc(v, url) {
  v.dataset.src = url;
  direct(url).then(u => {
    if (v.dataset.src !== url) return; v.src = u;
    if (u === url) return;
    v.addEventListener('error', () => {
      if (v.dataset.src !== url) return;
      const t = v.currentTime, playing = !v.paused; DIRECT.delete(url); v.src = url;
      v.addEventListener('loadedmetadata', () => { v.currentTime = t; if (playing) v.play().catch(() => {}); }, { once: true });
    }, { once: true });
  });
}

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const cap = s => s[0].toUpperCase() + s.slice(1);
const typeOf = task => task.split('-')[0];
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const nice = task => { const [type, size, level] = task.split('-'); return `${cap(type)} · ${cap(size)} · Level ${level[1]}`; };
const short = task => { const [, size, level] = task.split('-'); return `${cap(size)} · Level ${level[1]}`; };

/* One place for the outcome words and for how hours read */
const WORDS = { fin: 'Completed', not: 'Not completed', soon: 'Coming soon', pending: 'Result to come' };
const statusWord = finished => (finished ? WORDS.fin : WORDS.not);
const statusChip = (finished, cls = '') => `<span class="chip ${finished ? 'fin' : 'not'}${cls ? ` ${cls}` : ''}">${statusWord(finished)}</span>`;
// Under 1 h in minutes, under 10 h in hours and minutes, then hours: '41 min', '3 h 45 min', '23.6 h'.
// The spaces do not break, so a time never splits across two lines.
const fmtHours = h => {
  if (h == null || !isFinite(h)) return '';
  const m = Math.round(h * 60);
  if (m < 60) return `${Math.max(1, m)}\u00a0min`;
  if (m < 600) return m % 60 ? `${Math.floor(m / 60)}\u00a0h\u00a0${m % 60}\u00a0min` : `${m / 60}\u00a0h`;
  return `${(Math.round(h * 10) / 10).toLocaleString('en-US')}\u00a0h`;
};
const workText = h => (h == null ? '' : `${fmtHours(h)}\u00a0of\u00a0work`);

const D = { tasks: [], facts: {}, sets: [], runs: {}, outcomes: null, media: null };
const F = { status: 'all', team: 'all', job: 'all' };
const teamName = key => (TEAMS[key] || [key])[0];
const run = (set, task) => D.runs[set][task]; // undefined when the run has no video yet
const outcome = (set, task) => D.outcomes && D.outcomes[set] && D.outcomes[set][task];
const done = (set, task) => { const o = outcome(set, task); return o ? !!o.completed : null; };
const facts = task => { const f = D.facts[task]; return f ? `${f.arms}\u00a0arms · ${f.workload}\u00a0${UNIT[f.unit] || f.unit}` : ''; };
const poster = (set, task, view) => `${mediaUrl(D.media.posters)}${set}/${task}-${view}.webp`;
// ?videos=URL reads the run videos from another host in a local preview (folders <team>/<run>/<camera>.mp4).
const VIDEO_HOST = new URLSearchParams(location.search).get('videos');
const video = (set, task, view) => `${VIDEO_HOST ? `${VIDEO_HOST.replace(/\/?$/, '/')}${set}/` : D.media.sets.find(s => s.key === set).base}${run(set, task).folder}/${view}.mp4`;
const stateText = (set, task) => {
  if (!run(set, task)) return null;
  const o = outcome(set, task); if (!o) return WORDS.pending;
  return statusWord(o.completed) + (o.hours != null ? `, ${workText(o.hours)}` : '');
};
const stateHTML = (set, task) => {
  const o = outcome(set, task); if (!o) return `<span>${WORDS.pending}</span>`;
  return statusChip(!!o.completed, 'flat') + (o.hours != null ? `<span>${workText(o.hours)}</span>` : '');
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
  cite.addEventListener('click', e => { if (outside(cite, e)) cite.close(); });
}

/* ---------- entrances ----------
   An element with data-reveal plays its entrance once, the first time it comes into view.
   Call reveal(box) after rendering new elements into box. Children of a [data-stagger] parent
   are numbered (--i) so they enter one after another. */
const motionOK = () => document.documentElement.classList.contains('reveal');
let revealer = null;
function reveal(scope = document) {
  const items = [...scope.querySelectorAll('[data-reveal]:not(.is-in)')];
  if (scope !== document && scope.matches('[data-reveal]:not(.is-in)')) items.unshift(scope);
  if (!items.length) return;
  if (!motionOK() || !('IntersectionObserver' in window)) { items.forEach(e => e.classList.add('is-in', 'rv-done')); return; }
  [scope, ...scope.querySelectorAll('[data-stagger]')].filter(g => g.matches && g.matches('[data-stagger]')).forEach(g =>
    [...g.querySelectorAll(':scope > [data-reveal]')].forEach((e, i) => { if (!e.style.getPropertyValue('--i')) e.style.setProperty('--i', i); }));
  revealer = revealer || new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in'); revealer.unobserve(en.target);
  }), { rootMargin: '0px 0px -40px 0px' });
  items.forEach(e => revealer.observe(e));
}
// Once its entrance has played an element drops the animation, so showing its tab again does not replay it.
document.addEventListener('animationend', e => {
  if (!e.pseudoElement && /^rv-/.test(e.animationName) && e.target.classList && e.target.classList.contains('is-in')) e.target.classList.add('rv-done');
});
// An exit: ease-in with a slight upward drift; resolves when it has played (at once without motion).
const leave = e => new Promise(done => {
  if (!motionOK()) { done(); return; }
  e.classList.add('is-leaving'); e.addEventListener('animationend', () => done(), { once: true }); setTimeout(done, 400);
});

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
/* The contents beside Results: the section read now is the one crossing a band 30% to 40% down the
   window, and at the end of the page it is the last one. */
function tocSpy() {
  const toc = $('toc'), links = [...toc.querySelectorAll('a')], parts = links.map(a => document.querySelector(a.getAttribute('href')));
  const live = new Set(); let on = -1;
  const mark = i => {
    if (i === on) return; on = i;
    links.forEach((a, k) => { a.classList.toggle('on', k === i); if (k === i) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    // In the row of contents on narrow screens the current link stays in view.
    if (toc.scrollWidth > toc.clientWidth + 1) { const a = links[i]; toc.scrollTo({ left: Math.max(0, a.offsetLeft - (toc.clientWidth - a.offsetWidth) / 2), behavior: motionOK() ? 'smooth' : 'auto' }); }
  };
  const pick = () => {
    if (current !== 'results') return;
    const h = document.documentElement.scrollHeight;
    if (h > innerHeight + 4 && scrollY + innerHeight >= h - 4) { mark(links.length - 1); return; }
    let last = -1; parts.forEach((p, i) => { if (live.has(p)) last = i; });
    if (last >= 0) mark(last);
  };
  const io = new IntersectionObserver(entries => { entries.forEach(e => (e.isIntersecting ? live.add(e.target) : live.delete(e.target))); pick(); }, { rootMargin: '-30% 0px -60% 0px' });
  parts.forEach(p => p && io.observe(p));
  addEventListener('scroll', pick, { passive: true });
  links.forEach((a, i) => a.addEventListener('click', () => mark(i)));
  mark(0);
  // On narrow screens the row of contents slides away while reading down and returns on the way up.
  let lastY = scrollY;
  addEventListener('scroll', () => { const y = scrollY; if (Math.abs(y - lastY) < 8) return; toc.classList.toggle('tuck', y > lastY && y > 300); lastY = y; }, { passive: true });
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

/* ---------- the hero film ----------
   The whole film plays large and silent in the hero once the page has loaded and while it is on
   screen. A white bar (play, a progress bar to drag, the time, full screen) shows on hover and on
   focus, and stays while paused. With reduced motion the poster shows until someone presses play. */
function film() {
  const f = D.media.film, box = $('film'); if (!f || !f.film) return;
  const base = mediaUrl(f.base), at = u => /^https?:/.test(u) ? u : base + u, bar = $('film-bar'), seek = $('fb-seek'), time = $('fb-time'), play = $('fb-play');
  const total = f.film.seconds || 0;
  box.querySelector('.film-poster').src = base + f.film.poster;
  const v = el('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'metadata';
  v.setAttribute('aria-label', 'The RoboTeam film, silent'); v.poster = base + f.film.poster;
  v.addEventListener('playing', () => v.classList.add('ready'), { once: true });
  box.querySelector('.film-poster').after(v); bar.hidden = false;
  let dragging = false, wanted = motionOK();
  // the film's CDN address is asked for once the page has loaded; play waits for the file if it is not there yet
  const load = () => { if (v.dataset.src) return; setVideoSrc(v, at(f.film.video)); v.addEventListener('loadedmetadata', () => { if (wanted) v.play().catch(() => {}); }, { once: true }); };
  const show = () => {
    const d = v.duration || total, t = v.currentTime || 0;
    if (!dragging) seek.value = d ? Math.round(t / d * 1000) : 0;
    seek.style.setProperty('--p', `${seek.value / 10}%`);
    time.textContent = `${clock(t)} / ${clock(d)}`;
  };
  const state = () => { box.classList.toggle('paused', v.paused); play.setAttribute('aria-label', v.paused ? 'Play the film' : 'Pause the film'); };
  v.addEventListener('timeupdate', show); v.addEventListener('loadedmetadata', show);
  v.addEventListener('play', state); v.addEventListener('pause', state); state();
  play.addEventListener('click', () => { wanted = v.paused; if (v.paused) { load(); v.play().catch(() => {}); } else v.pause(); });
  seek.addEventListener('input', () => {
    dragging = true; load();
    const d = v.duration || total; v.currentTime = seek.value / 1000 * d; show();
  });
  seek.addEventListener('change', () => { dragging = false; show(); });
  $('fb-full').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else (box.requestFullscreen ? box.requestFullscreen() : v.webkitEnterFullscreen && v.webkitEnterFullscreen());
  });
  v.addEventListener('click', () => play.click());
  // Start only after the page has loaded, and only while the film is on screen.
  const watch = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting && wanted) { load(); v.play().catch(() => {}); }
    else if (!e.isIntersecting && !v.paused) v.pause();
  }), { threshold: .25 });
  const later = () => { direct(at(f.film.video)); watch.observe(box); };
  if (document.readyState === 'complete') setTimeout(later, 200); else addEventListener('load', () => setTimeout(later, 200), { once: true });
}

function clips() {
  const c = D.media.clips; if (!c) return;
  const base = mediaUrl(c.base), byKey = Object.fromEntries(c.items.map(i => [i.key, i]));
  const speedTag = clip => `<span class="chip speed">${clip.speed.toLocaleString('en-US')}× real time</span>`;
  document.querySelectorAll('.job[data-clip]').forEach(job => {
    const clip = byKey[job.dataset.clip]; if (!clip) return;
    const frame = job.querySelector('.clip'); frame.append(clipVideo(base + clip.video, base + clip.poster, clip.caption)); frame.insertAdjacentHTML('beforeend', speedTag(clip));
    job.querySelector('.job-text').insertAdjacentHTML('afterbegin', `<p class="clip-of"><span class="model">${teamName(clip.set)}</span> · ${short(clip.task)}</p>`);
    if (run(clip.set, clip.task)) {
      const open = () => openRun(clip.set, clip.task);
      frame.classList.add('opens'); frame.title = 'Open the whole run'; frame.tabIndex = 0; frame.setAttribute('role', 'button');
      frame.setAttribute('aria-label', `Open the whole run: ${cap(typeOf(clip.task))} · ${short(clip.task)}`);
      frame.addEventListener('click', open);
      frame.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    }
  });
}

/* ---------- Results: three numbers, then the board and its switch ---------- */
function numbers(results) {
  const best = results.conditions.find(c => c.key === 'adaptive'); if (!best) return;
  [['big-done', String(best.completed)], ['big-hours', `${best.median_hours.toFixed(1)}\u00a0h`], ['big-fail', `${Math.round(best.atomic_failure * 100)}%`]].forEach(([id, v]) => {
    const e = $(id); if (!e || e.textContent === v) return;
    e.textContent = v; if (motionOK()) e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' });
  });
}

// The switch above the board shows one slice of the 36 tasks, one team size or one level: the other
// squares dim, and each team's count is for that slice.
const SLICE = { mode: 'all', size: 'small', level: '1' };
const inSlice = task => { const [, size, level] = task.split('-'); return SLICE.mode === 'all' || (SLICE.mode === 'size' ? size === SLICE.size : level === `l${SLICE.level}`); };
const rowName = set => TEAMS[set] || [set, ''];

function boardRow(set) {
  const [label, setup] = rowName(set), reference = set === REFERENCE;
  const row = el('div', 'row'); row.dataset.model = set;
  const who = el('button', 'who', `<b${reference ? '' : ' class="model"'}>${label}</b><small>${setup}</small>`); who.type = 'button';
  who.title = 'Show these videos'; who.addEventListener('click', () => { F.team = set; F.status = 'all'; F.job = 'all'; library(); if (location.hash === '#videos') route(); else location.hash = 'videos'; });
  row.append(who, el('div', 'score', '<b>–</b><span>of\u00a036</span>'));
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
        const on = () => { tip(c, set, task); const b = $('board'); b.classList.add('col-hot'); b.querySelectorAll(`.cell[data-task="${task}"]`).forEach(x => x.classList.add('col-on')); };
        const off = () => { hideTip(); const b = $('board'); b.classList.remove('col-hot'); b.querySelectorAll('.col-on').forEach(x => x.classList.remove('col-on')); };
        c.addEventListener('mouseenter', on); c.addEventListener('focus', on);
        c.addEventListener('mouseleave', off); c.addEventListener('blur', off);
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
  b.append(el('div', 'cols', '<span class="kicker">Cameras only</span><span class="kicker">Completed</span>' +
    TYPES.map(([k, n]) => `<div class="ch t-${k}"><span><i></i>${n}</span><small>${SIZES.map(s => `<span data-size="${s}">${cap(s)}</span>`).join('')}</small></div>`).join('')));
  D.sets.filter(s => s !== REFERENCE).forEach(s => b.append(boardRow(s)));
  if (D.sets.includes(REFERENCE)) { const o = el('div', 'oracle'); o.append(boardRow(REFERENCE)); b.append(o); }
  boardSlice(false);
}
function boardSlice(animate = true) {
  const b = $('board'), of = SLICE.mode === 'all' ? 36 : 12;
  b.dataset.slice = SLICE.mode;
  b.querySelectorAll('.cell').forEach(c => c.classList.toggle('out', !inSlice(c.dataset.task)));
  b.querySelectorAll('.ch small span').forEach(s => s.classList.toggle('on', SLICE.mode === 'size' && s.dataset.size === SLICE.size));
  b.querySelectorAll('.row').forEach(row => {
    const set = row.dataset.model, n = D.outcomes ? D.tasks.filter(t => inSlice(t) && done(set, t)).length : '–', s = row.querySelector('.score');
    if (s.dataset.v === `${n}/${of}`) return;
    s.dataset.v = `${n}/${of}`; s.innerHTML = `<b>${n}</b><span>of\u00a0${of}</span>`;
    if (animate && motionOK()) s.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' });
  });
}
function boardControls() {
  const ctl = $('board-ctl'); if (!ctl) return;
  ctl.addEventListener('click', e => {
    const btn = e.target.closest('button[data-v]'); if (!btn) return;
    const group = btn.parentElement; SLICE[group.dataset.key] = btn.dataset.v;
    group.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === btn));
    ctl.dataset.mode = SLICE.mode; boardSlice();
  });
}

// The note over a square: the run's front camera, the task, and how the run ended.
function tip(anchor, set, task) {
  const has = !!run(set, task), [label] = rowName(set);
  showNote((has ? `<img alt="" src="${poster(set, task, 'front')}">` : '') +
    `<div class="tip-body"><b>${nice(task)}</b><small>${set === REFERENCE ? label : mname(label)} · ${facts(task)}</small>` +
    `<div class="tip-state">${has ? stateHTML(set, task) : `<span class="soon">${WORDS.soon}</span>`}</div></div>`, anchor, `run-tip t-${typeOf(task)}`);
}

/* ---------- all videos ---------- */
// Four, three or two cards in a row, in step with .vgrid in site.css
const COLS = () => (innerWidth >= 1000 ? 4 : innerWidth >= 600 ? 3 : 2);
const mouseOK = matchMedia('(hover: hover) and (pointer: fine)');
const stillMQ = matchMedia('(prefers-reduced-motion: reduce)');
const teamHTML = set => (set === REFERENCE ? teamName(set) : `<span class="model">${teamName(set)}</span>`);

function runCard(set, task, { mark = true, type = true, team = false } = {}) {
  const r = run(set, task), finished = done(set, task), o = outcome(set, task), job = cap(typeOf(task));
  const work = o && o.hours != null ? workText(o.hours) : '', f = D.facts[task];
  // On a narrow card the size of the job and the time of work each get a line of their own
  const size = f ? `${f.arms}\u00a0arms<span class="wl"> · ${f.workload}\u00a0${UNIT[f.unit] || f.unit}</span>` : '';
  const card = el('button', `card run t-${typeOf(task)}`); card.type = 'button';
  card.dataset.set = set; card.dataset.task = task;
  card.setAttribute('aria-label', [teamName(set), nice(task), finished === null ? '' : statusWord(finished), work, `${clock(r.seconds)} of video`].filter(Boolean).join(', '));
  card.innerHTML = `<div class="thumb"><img alt="" loading="lazy" decoding="async" src="${poster(set, task, 'front')}">` +
    (mark && finished !== null ? statusChip(finished, 'mark') : '') + `<span class="chip len">${clock(r.seconds)}</span></div>` +
    `<b><i></i><span>${type ? `<span class="tj">${job} · </span>` : ''}${short(task)}</span></b>` +
    `<small>${type ? `<span class="mj">${job} · </span>` : ''}${team ? `${teamHTML(set)} · ` : ''}${size}${work ? `<span class="wk"><span class="sep"> · </span>${work}</span>` : ''}</small>`;
  card.addEventListener('pointerenter', e => peekLater(card, set, task, e));
  card.addEventListener('pointerleave', () => peekStop(card));
  card.addEventListener('click', () => openRun(set, task));
  return card;
}
/* ---------- Overview: the results at a glance, and the two cards that lead on ---------- */
// Plays a container's entrance once, when it first comes into view: its .an children start
// hidden, animate while it has .play, and stay still once it has .played.
const playOnce = (() => {
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const n = e.target; io.unobserve(n); n.classList.add('play');
    setTimeout(() => n.classList.replace('play', 'played'), +n.dataset.playMs || 2000);
  }), { rootMargin: '0px 0px -40px 0px' }) : null;
  return (n, ms) => {
    if (n.classList.contains('play') || n.classList.contains('played')) return;
    if (!motionOK() || !io) { n.classList.add('played'); return; }
    n.classList.add('pl'); n.dataset.playMs = ms; io.observe(n);
  };
})();
function statBest(n) {
  const s = $('stat-best'); if (!s || s.textContent === String(n)) return;
  s.textContent = n;
  if (motionOK()) s.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'linear' });
}
const GLANCE = [['gpt-6.1-sol', 'vio'], ['opus-5.5', 's1'], [REFERENCE, 'ref']];
function glance() {
  const box = $('glance-rows'); if (!box) return;
  const known = !!D.outcomes, count = set => D.tasks.filter(t => done(set, t)).length;
  const head = `<div class="tz-head" aria-hidden="true"><span></span><span class="tz-strip">${TYPES.map(([k, n]) => `<span class="t-${k}"><i></i>${n}</span>`).join('')}</span><span></span></div>`;
  const row = ([set, tone], r) => {
    const who = `<b${set === REFERENCE ? '' : ' class="model"'}>${teamName(set)}</b><small>${TEAMS[set][1]}</small>`;
    let k = 0;
    const cells = TYPES.map(([type]) => `<span class="tz-grp">${SIZES.flatMap(size => [1, 2, 3].map(l => `${type}-${size}-l${l}`)).map(task =>
      `<button type="button" class="tz-cell${done(set, task) ? ' d' : ''}" style="--k:${k++}" data-set="${set}" data-task="${task}" aria-label="${teamName(set)}, ${nice(task)}: ${stateText(set, task) || WORDS.soon}"></button>`).join('')}</span>`).join('');
    return `<div class="tz-row ${tone}" style="--r:${r}"><div class="tz-who">${who}</div><div class="tz-strip">${cells}</div><div class="tz-n"><b class="an rise">${known ? count(set) : '–'}</b><span>of 36</span></div></div>`;
  };
  box.innerHTML = head + GLANCE.filter(([s]) => D.runs[s]).map(row).join('') + '<p class="tz-foot">Each square is one of the 36 tasks, grouped by job. Point at a square to see the run.</p>';
  const best = GLANCE[0][0];
  if (known) $('glance-lede').innerHTML = `From cameras alone, <span class="model">${teamName(best)}</span> completed ${count(best)} of 36 tasks. Given the ground-truth position of every object, the same AI completed ${count(REFERENCE) === 36 ? 'all 36' : `${count(REFERENCE)} of 36`}.`;
  if (!box.dataset.bound) {
    box.dataset.bound = '1';
    const cell = e => e.target.closest('.tz-cell');
    const on = e => { const c = cell(e); if (c) tip(c, c.dataset.set, c.dataset.task); };
    box.addEventListener('mouseover', on); box.addEventListener('focusin', on);
    box.addEventListener('mouseout', e => { if (cell(e)) hideTip(); }); box.addEventListener('focusout', hideTip);
    box.addEventListener('click', e => { const c = cell(e); if (!c) return; if (run(c.dataset.set, c.dataset.task)) openRun(c.dataset.set, c.dataset.task); else tip(c, c.dataset.set, c.dataset.task); });
  }
  playOnce(box, 2300);
}
const MOSAIC = [['gpt-6.1-sol', 'transport-large-l3'], ['opus-5.5', 'mosaic-large-l1'], ['gpt-6.1-sol', 'relay-large-l1'], ['gpt-6.1-sol', 'dial-large-l3']];
function nextThumbs() {
  const b = $('go-board');
  if (b) b.innerHTML = D.sets.map(set => `<span class="mb-row${set === REFERENCE ? ' ref' : ''}">${TYPES.map(([type]) =>
    `<span class="t-${type}">${D.tasks.filter(t => typeOf(t) === type).map(t => `<i${done(set, t) ? ' class="d"' : ''}></i>`).join('')}</span>`).join('')}</span>`).join('');
  const m = $('go-mosaic');
  if (m && !m.childElementCount) m.innerHTML = MOSAIC.filter(([s, t]) => D.runs[s] && run(s, t)).map(([s, t]) => `<img alt="" loading="lazy" src="${poster(s, t, 'front')}">`).join('');
}
// Step 1 of the walk-through: the run-start picture and the one that came back after the first call take turns while it is in view.
function howCamera() {
  const fig = $('how-cam'); if (!fig || !motionOK()) return;
  let timer = 0, on = false;
  const flip = () => { const now = fig.classList.toggle('new'); timer = setTimeout(flip, now ? 3600 : 2400); };
  new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting && !on) { on = true; timer = setTimeout(flip, 1300); }
    else if (!e.isIntersecting && on) { on = false; clearTimeout(timer); }
  }), { threshold: 0.6 }).observe(fig);
}

/* Under a mouse, after a short pause, a card plays a muted preview of its front camera inside its
   picture, until the pointer leaves: the 500x copy, which shows the whole run in a few seconds and is
   small. Never on touch screens or with reduced motion, and the file is only fetched then. */
const PEEK = { card: null, v: null, timer: 0 };
function peekLater(card, set, task, e) {
  clearTimeout(PEEK.timer);
  if (e.pointerType !== 'mouse' || !mouseOK.matches || stillMQ.matches) return;
  direct(fastSrc(video(set, task, 'front'))); // start asking for its address now
  PEEK.timer = setTimeout(() => peekStart(card, set, task), 250);
}
function peekStart(card, set, task) {
  peekStop();
  const thumb = card.querySelector('.thumb');
  const v = el('video', 'peek'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.disablePictureInPicture = true; v.loop = true;
  v.setAttribute('aria-hidden', 'true'); setVideoSrc(v, fastSrc(video(set, task, 'front')));
  v.addEventListener('playing', () => v.classList.add('on'), { once: true });
  v.addEventListener('loadeddata', () => { if (PEEK.v === v) v.play().catch(() => {}); }, { once: true });
  thumb.insertBefore(v, thumb.querySelector('.chip'));
  PEEK.card = card; PEEK.v = v; v.play().catch(() => {});
}
function peekStop(card) {
  clearTimeout(PEEK.timer);
  if (!PEEK.v || (card && card !== PEEK.card)) return;
  const v = PEEK.v; PEEK.card = PEEK.v = null; v.classList.remove('on');
  setTimeout(() => { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); }, 200);
}

/* ---------- the team index ----------
   A tile per team: its score and its 36 tasks as squares, one block per job (rows: team sizes,
   columns: levels), as on the board. A tile goes to that team's videos further down. */
const square = (set, task) => `<i class="${done(set, task) ? 'done' : ''}${run(set, task) ? '' : ' none'}"></i>`;
const strip = set => `<span class="strip" aria-hidden="true">${TYPES.map(([type]) => `<span class="blk t-${type}">${SIZES.map(size => [1, 2, 3].map(l => square(set, `${type}-${size}-l${l}`)).join('')).join('')}</span>`).join('')}</span>`;
const JUMPS = { scored: null };
function jumps() {
  const box = $('jumps'); box.innerHTML = ''; JUMPS.scored = !!D.outcomes;
  D.sets.forEach(set => {
    const n = D.outcomes ? D.tasks.filter(t => done(set, t)).length : null;
    const a = el('a', `jump${set === REFERENCE ? ' ref' : ''}`); a.href = `#team-${set}`; a.dataset.set = set; a.setAttribute('data-reveal', '');
    a.setAttribute('aria-label', `${teamName(set)}${n === null ? '' : `, ${n} of 36 tasks completed`}. Go to its videos`);
    a.innerHTML = `<span class="jump-name">${teamHTML(set)}</span>${strip(set)}` +
      (n === null ? '' : `<span class="jump-score"><b>${n}</b> of 36</span>`);
    a.addEventListener('click', e => { e.preventDefault(); jumpTo(set); });
    box.append(a);
  });
  const key = el('div', 'jump-key', `<p>One square per task</p><span><i class="done"></i>${WORDS.fin}</span><span><i></i>${WORDS.not}</span><span><i class="none"></i>${WORDS.soon}</span>`);
  key.setAttribute('data-reveal', ''); box.append(key);
  reveal(box);
}
function jumpTo(set) {
  const hidden = F.team !== 'all' && F.team !== set;
  if (hidden) F.team = 'all';
  if (hidden || !OPEN.has(set)) { OPEN.add(set); library({ fade: true, scroll: false }); }
  if (!$(`team-${set}`)) { F.status = F.job = 'all'; library({ fade: true, scroll: false }); }
  const t = $(`team-${set}`); if (t) t.scrollIntoView({ block: 'start', behavior: stillMQ.matches ? 'auto' : 'smooth' });
}

/* ---------- the filter bar: Result, Job and Team ----------
   Wide screens show every choice. Narrow ones show Result, and Team and Job each open a sheet.
   The bar sticks under the tabs; on narrow screens it slides away while reading down. */
const OPEN = new Set(['gpt-6.1-sol', 'opus-5.5']); // shown in full; the other teams start with one row
const RESULT = [['all', 'All'], ['yes', WORDS.fin], ['no', WORDS.not]];
const OPTIONS = {
  team: () => [['all', 'All teams']].concat(D.sets.map(s => [s, teamHTML(s)])),
  job: () => [['all', 'All jobs']].concat(TYPES.map(([k, n]) => [k, `<i></i>${n}`, `t-${k}`])),
};
const passes = (set, task, f = F) => !!run(set, task) && (f.team === 'all' || f.team === set) && (f.job === 'all' || typeOf(task) === f.job) && (f.status === 'all' || done(set, task) === (f.status === 'yes'));
const tally = (over = {}) => { const f = { ...F, ...over }; return D.sets.reduce((n, s) => n + D.tasks.filter(t => passes(s, t, f)).length, 0); };
function setFilter(key, value) { if (F[key] === value) return; F[key] = value; library({ fade: true }); }
function clearFilters() { F.status = F.team = F.job = 'all'; library({ fade: true }); }
function chipButtons(box, key, pick = v => setFilter(key, v)) {
  box.innerHTML = '';
  OPTIONS[key]().forEach(([value, html, cls]) => {
    const b = el('button', `chip${cls ? ` ${cls}` : ''}`, `${html}<small></small>`); b.type = 'button'; b.dataset.v = value;
    b.addEventListener('click', () => pick(value)); box.append(b);
  });
}
function syncChips(box, key) {
  box.querySelectorAll('button').forEach(b => {
    const n = tally({ [key]: b.dataset.v }), on = F[key] === b.dataset.v;
    b.setAttribute('aria-pressed', on); b.disabled = !on && n === 0; b.querySelector('small').textContent = n;
  });
}
function syncBar() {
  const seg = $('filter-status'); seg.hidden = !D.outcomes;
  seg.querySelectorAll('button').forEach(b => { b.setAttribute('aria-pressed', F.status === b.dataset.v); b.querySelector('small').textContent = tally({ status: b.dataset.v }); });
  syncChips($('filter-job'), 'job'); syncChips($('filter-team'), 'team');
  if ($('fsheet').open) syncChips($('fsheet-chips'), SHEET.key);
  ['team', 'job'].forEach(key => $(`open-${key}`).setAttribute('aria-pressed', F[key] !== 'all'));
  const box = $('jumps'); box.dataset.job = F.job; box.dataset.status = F.status;
  box.querySelectorAll('.jump').forEach(a => a.classList.toggle('dim', F.team !== 'all' && F.team !== a.dataset.set));
}
// A click on the dimmed page around a dialog closes it; a click on its own padding does not.
const outside = (dlg, e) => { const r = dlg.getBoundingClientRect(); return e.target === dlg && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom); };
const SHEET = { key: null };
function openSheet(key) {
  const s = $('fsheet'), box = $('fsheet-chips'); SHEET.key = key;
  $('fsheet-title').textContent = key === 'team' ? 'Team' : 'Job';
  chipButtons(box, key, v => { setFilter(key, v); setTimeout(closeSheet, 180); });
  syncChips(box, key); s.showModal();
}
function closeSheet() {
  const s = $('fsheet'); if (!s.open || s.classList.contains('is-leaving')) return;
  leave(s).then(() => { s.classList.remove('is-leaving'); s.close(); });
}
function stickyBar() {
  const root = document.documentElement, bar = $('filters'), mark = $('vbar-mark'), rail = $('rail');
  // The bar's own height is set in site.css (--bar-h): measured here it would read 0 while its tab is hidden.
  const sizes = () => root.style.setProperty('--rail-h', `${rail.offsetHeight}px`);
  if ('ResizeObserver' in window) new ResizeObserver(sizes).observe(rail);
  sizes();
  const narrow = matchMedia('(max-width: 999px)'); let lastY = scrollY;
  const spy = () => {
    const y = scrollY, stuck = current === 'videos' && mark.getBoundingClientRect().top < rail.offsetHeight + 1;
    bar.classList.toggle('stuck', stuck); root.classList.toggle('bar-stuck', stuck);
    if (!stuck) { bar.classList.remove('tuck'); root.classList.remove('bar-tuck'); lastY = y; return; }
    if (Math.abs(y - lastY) < 8) return;
    const tuck = narrow.matches && !stillMQ.matches && y > lastY && !$('fsheet').open;
    bar.classList.toggle('tuck', tuck); root.classList.toggle('bar-tuck', tuck); lastY = y;
  };
  addEventListener('scroll', spy, { passive: true }); spy();
}
function filterBar() {
  if (filterBar.ready) return; filterBar.ready = true;
  const seg = $('filter-status');
  seg.innerHTML = RESULT.map(([v, w]) => `<button type="button" data-v="${v}">${v === 'all' ? '' : `<i class="${v === 'yes' ? 'done' : ''}"></i>`}${w}<small></small></button>`).join('');
  seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => setFilter('status', b.dataset.v)));
  chipButtons($('filter-job'), 'job'); chipButtons($('filter-team'), 'team');
  ['team', 'job'].forEach(key => $(`open-${key}`).addEventListener('click', () => openSheet(key)));
  const s = $('fsheet');
  $('fsheet-close').addEventListener('click', closeSheet);
  s.addEventListener('click', e => { if (outside(s, e)) closeSheet(); });
  s.addEventListener('cancel', e => { e.preventDefault(); closeSheet(); });
  stickyBar();
  // The number of cards in a row changes at 600 and 1000 px; fold the rows again
  ['(min-width: 600px)', '(min-width: 1000px)'].forEach(q => matchMedia(q).addEventListener('change', () => library({ fade: true, scroll: false })));
}

function library({ fade = false, scroll = true } = {}) {
  filterBar(); peekStop();
  if (JUMPS.scored !== !!D.outcomes) jumps();
  const box = $('library'), cols = COLS(); box.innerHTML = ''; let shown = 0;
  D.sets.forEach(set => {
    if (F.team !== 'all' && F.team !== set) return;
    const tasks = D.tasks.filter(t => F.job === 'all' || typeOf(t) === F.job);
    const list = tasks.filter(t => passes(set, t));
    const soon = F.status === 'yes' ? [] : tasks.filter(t => !run(set, t));
    if (!list.length && !soon.length) return;
    shown += list.length;
    const ref = set === REFERENCE, fold = F.team === 'all' && !OPEN.has(set) && list.length > cols;
    const section = el('section', `team${ref ? ' ref' : ''}${fold ? ' folded' : ''}`); section.id = `team-${set}`;
    const finished = D.outcomes ? D.tasks.filter(t => done(set, t)).length : null;
    const sub = (TEAMS[set] || [])[1];
    const head = el('div', 'team-head', `<h3>${teamHTML(set)}</h3>` +
      `<span class="team-sub">${sub ? `${sub} · ` : ''}${list.length}\u00a0${list.length === 1 ? 'video' : 'videos'}</span>` +
      (finished === null ? '' : `<span class="team-score"><b>${finished}</b> of 36 completed</span>`));
    head.setAttribute('data-reveal', '');
    const grid = el('div', 'vgrid');
    list.forEach((task, i) => {
      const card = runCard(set, task, { type: F.job === 'all' });
      card.setAttribute('data-reveal', ''); card.style.setProperty('--i', i % cols); grid.append(card);
    });
    if (soon.length) grid.append(el('div', 'rest', `<b><span class="soon">${WORDS.soon}</span>${soon.length} more ${soon.length === 1 ? 'video' : 'videos'}</b><ul>${soon.map(t => `<li class="t-${typeOf(t)}"><i></i>${F.job === 'all' ? `${cap(typeOf(t))} · ` : ''}${short(t)}</li>`).join('')}</ul>`));
    section.append(head, grid);
    if (fold) {
      const row = el('div', 'more-row'), more = el('button', 'btn more', `Show all ${list.length} videos<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg>`);
      more.type = 'button'; more.setAttribute('aria-label', `Show all ${list.length} videos of ${teamName(set)}`);
      more.addEventListener('click', () => {
        OPEN.add(set); section.classList.remove('folded'); row.remove();
        const next = grid.children[cols]; if (next) next.focus({ preventScroll: true });
      });
      row.append(more); section.append(row);
    }
    box.append(section);
  });
  if (!box.children.length) {
    const empty = el('p', 'empty', 'No video matches these filters. <button class="link-btn" type="button">Clear filters</button>');
    empty.querySelector('button').addEventListener('click', clearFilters); box.append(empty);
  }
  countLine(shown); syncBar();
  if (!fade) { reveal(box); return; }
  // A filter change cross-fades the list in place; nothing slides in again.
  box.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-in', 'rv-done'));
  if (motionOK()) { box.classList.remove('xfade'); void box.offsetWidth; box.classList.add('xfade'); }
  if (scroll && $('filters').classList.contains('stuck')) scrollTo({ top: $('count').getBoundingClientRect().top + scrollY - $('rail').offsetHeight - $('filters').offsetHeight - 8, behavior: 'instant' });
}
function countLine(shown) {
  const total = tally({ status: 'all', team: 'all', job: 'all' }), on = F.status !== 'all' || F.team !== 'all' || F.job !== 'all';
  const names = [F.status !== 'all' && statusWord(F.status === 'yes'), F.team !== 'all' && teamHTML(F.team), F.job !== 'all' && cap(F.job)].filter(Boolean);
  $('count').innerHTML = on
    ? `<span><b>${shown}</b> of ${total} videos</span><span class="count-on">${names.join(' · ')}</span><button class="link-btn" type="button">Clear filters</button>`
    : `<span>All <b>${total}</b> videos</span>`;
  const clear = $('count').querySelector('button'); if (clear) clear.addEventListener('click', clearFilters);
}
/* ---------- the player: three cameras on one clock ---------- */
const P = { videos: [], sets: { slow: [], fast: [] }, main: 0, speed: 10, fast: false, swap: 0, set: null, task: null, timer: null, opener: null };

function playerVideos() { return P.videos.filter(v => v.isConnected); }
function allVideos() { return [...P.sets.slow, ...P.sets.fast]; }
function eachVideo(f) { playerVideos().forEach(f); }
// Each view holds its 10x video and its 500x copy, both loaded when the player opens (the copy is small).
// A change of speed across 500x seeks the other copy to the same moment and shows it only once it is
// there, so the picture never goes blank; the hidden copy stays loaded for the way back.
function setSpeed(times) {
  const fast = times >= FAST; P.speed = times;
  P.sets.slow.forEach(v => { v.defaultPlaybackRate = v.playbackRate = Math.min(times, 160) / 10; });
  P.sets.fast.forEach(v => { v.defaultPlaybackRate = v.playbackRate = fast ? times / FAST : 1; });
  if (fast !== P.fast && P.sets.fast.length) {
    const from = P.videos, to = fast ? P.sets.fast : P.sets.slow, m = from[P.main], token = ++P.swap;
    const at = m && m.duration ? m.currentTime / m.duration : 0, playing = !!m && !m.paused;
    P.fast = fast; P.videos = to; let left = to.length;
    const show = () => {
      if (token !== P.swap || left < 0) return; left = -1;
      $('player-views').classList.toggle('fast', fast); from.forEach(v => v.pause());
      if (playing) to.forEach(v => v.play().catch(() => {}));
    };
    const place = v => { v.addEventListener('seeked', () => { if (--left === 0) show(); }, { once: true }); v.currentTime = at * v.duration; };
    to.forEach(v => { if (v.readyState >= 1 && v.duration) place(v); else v.addEventListener('loadedmetadata', () => place(v), { once: true }); });
    setTimeout(show, 5000); // never wait longer than this for a slow copy
  }
  document.querySelectorAll('#player-views .speed').forEach(s => { s.textContent = `${times}× real time`; });
  document.querySelectorAll('#player-speed .chip').forEach(b => b.setAttribute('aria-pressed', +b.dataset.speed === times));
}
function tick() {
  const m = P.videos[P.main]; if (!m) return;
  if (m.duration) {
    const seek = $('player-seek'), at = m.currentTime / m.duration;
    seek.value = Math.round(1000 * at); seek.style.setProperty('--p', `${(100 * at).toFixed(2)}%`);
    const k = P.fast ? FAST_STEP : 1; // the time of the 10x video, whichever copy plays
    $('player-time').textContent = `${clock(m.currentTime * k)} / ${clock(m.duration * k)}`;
  }
  eachVideo(v => { if (v !== m && !v.seeking && Math.abs(v.currentTime - m.currentTime) > 0.25) v.currentTime = m.currentTime; });
}
// The button shows pause only once the main view really plays, never while it is still loading.
function playIcon(on) { const b = $('player-play'); b.classList.toggle('playing', on); b.setAttribute('aria-label', on ? 'Pause' : 'Play'); }
function togglePlay() {
  const m = P.videos[P.main]; if (!m) return;
  if (m.paused || m.ended) { if (m.ended) eachVideo(v => { v.currentTime = 0; }); eachVideo(v => v.play().catch(() => {})); } else eachVideo(v => v.pause());
}
function seekBy(s) {
  const m = P.videos[P.main]; if (!m || !m.duration) return;
  const t = Math.min(m.duration - 0.05, Math.max(0, m.currentTime + s / (P.fast ? FAST_STEP : 1))); eachVideo(v => { v.currentTime = t; }); tick();
}
function viewLabels() {
  const single = P.videos.length === 1;
  $('player-views').querySelectorAll('.view').forEach((f, j) => {
    const name = f.querySelector('.view-tag').textContent;
    f.setAttribute('aria-label', single ? 'Play or pause' : j === P.main ? `${cap(name)} camera: play or pause` : `Show the ${name} camera large`);
  });
}
function buildViews(sources) {
  const box = $('player-views'); box.innerHTML = ''; box.classList.toggle('single', sources.length === 1); box.classList.remove('fast');
  P.sets = { slow: [], fast: [] }; P.videos = P.sets.slow; P.main = 0; P.fast = false; P.swap++;
  const seek = $('player-seek'); seek.value = 0; seek.style.setProperty('--p', '0%'); $('player-time').textContent = '0:00';
  sources.forEach(([label, src, posterUrl, quick], i) => {
    const frame = el('button', `view loading${i === 0 ? ' main' : ''}`); frame.type = 'button';
    const make = (url, cls) => {
      const v = el('video', cls); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.disablePictureInPicture = true;
      setVideoSrc(v, url);
      // Each view shimmers until it can play; the play button follows the main view.
      v.addEventListener('canplay', () => frame.classList.remove('loading'), { once: true });
      v.addEventListener('playing', () => { if (P.videos[P.main] === v) playIcon(true); });
      v.addEventListener('pause', () => { if (P.videos[P.main] === v) playIcon(false); });
      v.addEventListener('ended', () => { if (!P.videos.includes(v)) return; eachVideo(x => x.pause()); if (P.videos[P.main] === v) playIcon(false); });
      return v;
    };
    const v = make(src, ''); if (posterUrl) v.poster = posterUrl;
    frame.append(v); P.sets.slow.push(v);
    if (quick) { const q = make(quick, 'alt'); frame.append(q); P.sets.fast.push(q); }
    frame.append(el('span', 'chip view-tag', label), el('span', 'chip speed', ''));
    frame.addEventListener('click', () => {
      if (i === P.main) return togglePlay();
      box.querySelectorAll('.view').forEach((f, j) => f.classList.toggle('main', j === i)); P.main = i;
      const c = P.videos[i]; playIcon(!c.paused && c.readyState > 2); viewLabels();
    });
    box.append(frame);
  });
  viewLabels(); playIcon(false);
}
function showPlayer() {
  const p = $('player');
  if (!p.open) { P.opener = document.activeElement; p.showModal(); p.focus({ preventScroll: true }); }
  clearInterval(P.timer); P.timer = setInterval(tick, 200);
  eachVideo(v => v.play().catch(() => {}));
}

function openRun(set, task) {
  hideTip(); peekStop(); P.set = set; P.task = task;
  const finished = done(set, task), o = outcome(set, task), r = run(set, task), p = $('player');
  p.className = `player t-${typeOf(task)}`;
  $('player-title').innerHTML = `<i></i>${nice(task)}` + (finished !== null ? ` ${statusChip(finished, 'flat')}` : '');
  $('player-sub').innerHTML = [teamHTML(set), facts(task), o && o.hours != null ? workText(o.hours) : '', `${clock(r.seconds)} of video`].filter(Boolean).join(' · ');
  buildViews(D.media.views.map(view => [view, video(set, task, view), view === 'side' ? '' : poster(set, task, view), fastSrc(video(set, task, view))]));
  $('player-speed').hidden = false; $('player-compare').hidden = false;
  $('player-speed').innerHTML = SPEEDS.map(s => `<button class="chip" type="button" data-speed="${s}">${s}×</button>`).join('');
  $('player-speed').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
  $('player-compare').innerHTML = D.sets.map(s => {
    const f = done(s, task);
    return `<button class="chip" type="button" data-set="${s}" aria-pressed="${s === set}" ${run(s, task) ? '' : `disabled title="${WORDS.soon}"`}>${f === null ? '' : `<i class="st${f ? ' done' : ''}"></i>`}${teamHTML(s)}</button>`;
  }).join('');
  $('player-compare').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { if (!b.disabled && b.dataset.set !== P.set) openRun(b.dataset.set, task); }));
  setSpeed(P.speed); showPlayer();
  document.querySelectorAll('.cell.cur').forEach(c => c.classList.remove('cur'));
  document.querySelectorAll(`.cell[data-set="${set}"][data-task="${task}"]`).forEach(c => c.classList.add('cur'));
}

function openFilm(src, posterUrl) {
  hideTip(); peekStop();
  const p = $('player'); p.className = 'player';
  $('player-title').textContent = 'RoboTeam'; $('player-sub').textContent = 'The film';
  buildViews([['film', src, posterUrl]]);
  $('player-speed').hidden = true; $('player-compare').hidden = true;
  P.videos[0].defaultPlaybackRate = P.videos[0].playbackRate = 1; showPlayer();
}

function toggleFull() {
  const box = $('player-in'); // a dialog cannot go full screen itself, so its inner box does
  if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
  if (document.fullscreenEnabled && box.requestFullscreen) { box.requestFullscreen().catch(() => {}); return; }
  const m = P.videos[P.main]; if (m && m.webkitEnterFullscreen) m.webkitEnterFullscreen(); // iPhone: the video alone
}
function playerControls() {
  const p = $('player'), seek = $('player-seek'), full = $('player-full');
  const close = () => {
    if (!p.open || p.classList.contains('is-leaving')) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    clearInterval(P.timer); allVideos().forEach(v => v.pause());
    leave(p).then(() => {
      allVideos().forEach(v => { v.removeAttribute('src'); v.load(); }); $('player-views').innerHTML = '';
      p.classList.remove('is-leaving'); if (p.open) p.close();
      document.querySelectorAll('.cell.cur').forEach(c => c.classList.remove('cur'));
      // Back to the card (or square) that opened the player
      const back = P.opener; P.opener = null;
      if (back && back.isConnected && back !== document.body) back.focus({ preventScroll: true });
    });
  };
  $('player-close').addEventListener('click', close);
  p.addEventListener('click', e => { if (outside(p, e)) close(); });
  p.addEventListener('cancel', e => { e.preventDefault(); close(); });
  $('player-play').addEventListener('click', togglePlay);
  seek.addEventListener('input', () => {
    const m = P.videos[P.main]; seek.style.setProperty('--p', `${seek.value / 10}%`);
    if (m && m.duration) eachVideo(v => { v.currentTime = m.duration * seek.value / 1000; });
  });
  full.hidden = !(document.fullscreenEnabled || 'webkitEnterFullscreen' in HTMLVideoElement.prototype);
  full.addEventListener('click', toggleFull);
  document.addEventListener('fullscreenchange', () => {
    const on = document.fullscreenElement === $('player-in'); full.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen'); full.title = on ? 'Leave full screen' : 'Full screen';
  });
  // Space plays or pauses, F is full screen, the arrow keys go 5 s back or on, Esc closes.
  p.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const onControl = e.target !== p && e.target.closest('button, a');
    if (e.key === ' ' && !onControl) { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); seekBy(e.key === 'ArrowLeft' ? -5 : 5); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFull(); }
  });
}

/* ---------- charts: bars in HTML, lines and points in SVG drawn at the width they are shown ---------- */
const FINDINGS_URL = mediaUrl(MEDIA + 'findings.json');
let FD = null;
const svg = (w, h, body, label) => `<svg class="chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${body}</svg>`;
const txt = (x, y, s, cls = '', anchor = 'start', extra = '') => `<text x="${x.toFixed ? x.toFixed(1) : x}" y="${y}" class="${cls}" text-anchor="${anchor}" ${extra}>${s}</text>`;
const fmt1 = n => (Math.round(n * 10) / 10).toString();
const pct = v => (v < 1 ? fmt1(v) : Math.round(v)) + '%';
const widthOf = box => Math.max(280, Math.floor(box.clientWidth));
const mname = m => `<span class="model">${m}</span>`;
function setText(id, kicker, claim, say, key) {
  $(id).querySelector('.f-text').innerHTML = `<p class="kicker">${kicker}</p><h3>${claim}</h3>` +
    (key ? `<p class="key"><b>${key[0]}</b><span>${key[1]}</span></p>` : '') + `<p class="say">${say}</p>`;
}

/* Tooltips are notes: violet-tinted, with a stem to what they describe. Chart parts carry data-tip,
   an index into TIPS; a bar's note points at the end of the bar. */
const TIPS = [];
const tipAt = html => `data-tip="${TIPS.push(html) - 1}"`;
const tipLines = (title, rows, extra = '', source = '') => `<b>${title}</b>${rows.map(([k, v]) => `<div class="tl"><span>${k}</span><span>${v}</span></div>`).join('')}${extra}${source ? `<p class="ts">${source}</p>` : ''}`;
let tipTimer = 0;
function showNote(html, anchor, cls = '') {
  const t = $('tip'); clearTimeout(tipTimer);
  const fresh = t.hidden || !t.classList.contains('show');
  t.className = `tip${cls ? ` ${cls}` : ''}`; t.innerHTML = html; t.hidden = false;
  placeNote(t, anchor);
  if (fresh) void t.offsetWidth;
  t.classList.add('show');
}
function placeNote(t, anchor) {
  const r = anchor.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight;
  const bars = [document.querySelector('.rail'), innerWidth <= 1100 ? $('toc') : null].filter(Boolean);
  const minTop = Math.max(0, ...bars.map(b => b.getBoundingClientRect().bottom)) + 8;
  const end = anchor.classList && anchor.classList.contains('anchor');
  const ax = end ? r.right - Math.min(10, r.width / 2) : r.left + r.width / 2;
  const left = Math.round(Math.min(Math.max(8, ax - w / 2), innerWidth - w - 8));
  let top = r.top - h - 12; const below = top < minTop; if (below) top = r.bottom + 12;
  t.style.left = `${left}px`; t.style.top = `${Math.round(top)}px`;
  t.style.setProperty('--sx', `${Math.round(Math.min(Math.max(14, ax - left), w - 14))}px`);
  t.classList.toggle('below', below);
}
function hideTip() {
  const t = $('tip'); if (t.hidden) return;
  t.classList.remove('show'); clearTimeout(tipTimer);
  tipTimer = setTimeout(() => { if (!t.classList.contains('show')) t.hidden = true; }, 160);
}
addEventListener('scroll', hideTip, { passive: true });
function bindTips(root) {
  root.querySelectorAll('svg.chart').forEach(svgEl => {
    if (svgEl.dataset.tips) return; svgEl.dataset.tips = '1';
    svgEl.addEventListener('pointerover', e => { const g = e.target.closest('[data-tip]'); if (!g) return;
      showNote(TIPS[+g.dataset.tip], g.querySelector('.anchor') || g.querySelector('circle') || g, 'chart-tip');
      svgEl.classList.add('focus'); svgEl.querySelectorAll('.hot').forEach(x => x.classList.remove('hot')); g.classList.add('hot'); });
    svgEl.addEventListener('pointerleave', () => { hideTip(); svgEl.classList.remove('focus'); svgEl.querySelectorAll('.hot').forEach(x => x.classList.remove('hot')); });
  });
  root.querySelectorAll('[data-tip]').forEach(row => {
    if (row.closest('svg') || row.dataset.bound) return; row.dataset.bound = '1';
    const show = () => showNote(TIPS[+row.dataset.tip], (row.dataset.anchor && row.querySelector(row.dataset.anchor)) || row.querySelector('.anchor') || row, 'chart-tip');
    row.addEventListener('pointerenter', show); row.addEventListener('pointerleave', hideTip);
  });
}
const yesNo = v => (v === 'yes' ? 'Yes' : v === 'partly' ? 'Partly' : 'No');
const runLength = (minutes, approx) => { const t = minutes >= 60 ? `${Math.round(minutes / 60)} h` : minutes >= 1 ? `${Math.round(minutes)} min` : `${Math.round(minutes * 60)} s`; return (approx ? `${approx} ` : '') + t; };

/* ---------- What is new: RoboTeam next to the ten other benchmarks of the paper ----------
   Robot arms (0 to 20) against how long one run can last (0 to 30 h), both on plain linear axes.
   The others share one small corner; RoboTeam stands alone, far up and far right. Drawn at the
   width it is shown; the entrance plays once. Pointing at, focusing or tapping a dot shows its
   note, and where dots pile up the note lists every benchmark in the pile. The README draws the
   same chart by the same rules (readme-draft-tools/findings_figures.py, compare()). */
const WN_FAMOUS = ['PARTNR', 'RoboTwin']; // named as well where they fit; never on phones
const WN_FONT = { name: '500 13px "IBM Plex Sans", system-ui, sans-serif', em: '700 13px "IBM Plex Sans", system-ui, sans-serif',
  mono: '500 12px "JetBrains Mono", ui-monospace, monospace' };
const textWidth = (() => { let c = null; return (s, font) => { c = c || document.createElement('canvas').getContext('2d'); c.font = font; return c.measureText(s).width; }; })();
const benches = F => F.benchmarks.rows.map(([name, arms, multi, real, vision, minutes, approx, group]) => ({ name, arms, multi, real, vision, minutes, approx, group, ours: group === 'ours' }));
const armsText = a => `${a} arm${a === 1 ? '' : 's'}`;
const lenText = b => runLength(b.minutes, b.approx).replace(/ /g, ' ');
const benchNote = b => tipLines(b.name, [['Robot arms', b.arms], ['One run lasts', lenText(b)], ['Cameras only', yesNo(b.vision)], ['Never pauses', yesNo(b.real)], ['Several agents', yesNo(b.multi)]]);
const WN_PROPS = [['vision', 'cameras only'], ['real', 'never pauses'], ['multi', 'several agents']];
const propsText = b => WN_PROPS.filter(([k]) => b[k] !== 'no').map(([k, n]) => (b[k] === 'partly' ? `${n} (partly)` : n).replace(/ /g, '\u00a0')).join(' · ');
const pileNote = bs => `<b>${bs.length} benchmarks in this spot</b><div class="wn-nl">${bs.map(b => `<span>${b.name}</span><span>${armsText(b.arms)} · ${lenText(b)}${propsText(b) ? `<small>${propsText(b)}</small>` : ''}</span>`).join('')}</div>`;
const px = v => Math.round(v) + 0.5;
const f1 = v => (Math.round(v * 10) / 10).toString();
let WN_UNITS = [], wnOn = null;
/* Its notes use the page's one note helper, showNote() and hideTip() (with the Results tooltips). */

function chartCompare(F, box) {
  const fig = box.closest('.wn'), rows = benches(F);
  // Labels are placed with measured text widths, so draw again once the fonts are in.
  if (document.fonts && document.fonts.status !== 'loaded' && !fig.dataset.fontWait) {
    fig.dataset.fontWait = '1'; document.fonts.ready.then(() => { delete drawnAt['chart-compare']; drawCharts(current); });
  }
  wnSet(fig, null);
  const W = Math.max(280, Math.floor(box.clientWidth)), compact = W < 440;
  const H = Math.round(compact ? W * 1.12 : Math.min(W * 0.76, 540));
  const r = compact ? 4 : 4.5, UR = compact ? 8 : 9, HALO = 2 * UR, pad = compact ? 9 : 12, lh = 16;
  const L = 36, R = compact ? 16 : 20, T = 38, B = 52;
  const X = h => L + h / 30 * (W - L - R), Y = a => T + (20 - a) / 20 * (H - T - B), y0 = Y(0);
  const others = rows.filter(b => !b.ours), us = rows.find(b => b.ours);
  const most = others.reduce((a, b) => (b.arms > a.arms ? b : a)), far = others.reduce((a, b) => (b.minutes > a.minutes ? b : a));

  // Equal arms and nearly equal run lengths would hide one another: each dot sits at least half a dot
  // right of the one before, so a pile stays countable. The notes give the true values.
  const pts = others.map(b => ({ b, x: X(b.minutes / 60), y: Y(b.arms) })).sort((p, q) => q.b.arms - p.b.arms || p.x - q.x);
  pts.forEach((p, i) => { const q = pts[i - 1]; if (q && q.b.arms === p.b.arms && p.x < q.x + r) p.x = q.x + r; });
  // Dots of one row that touch form a pile: one note, one focus stop.
  const units = [];
  pts.forEach(p => { const u = units[units.length - 1], q = u && u.pts[u.pts.length - 1];
    if (q && q.b.arms === p.b.arms && p.x - q.x <= 2 * r + 2) u.pts.push(p); else units.push({ pts: [p], lab: [] }); });
  const unitOf = p => units.find(u => u.pts.includes(p));
  const UX = X(us.minutes / 60), UY = Y(us.arms), gx = X(0) - r - 3; // gx: the corner's left edge; the arm numbers sit left of it

  // Everything placed so far, so that no text lands on a dot, a line or another text.
  const taken = [], texts = [];
  const bx = (x0, y0_, x1, y1) => ({ x0, y0: y0_, x1, y1 });
  const hits = (a, q) => a.x0 < q.x1 && a.x1 > q.x0 && a.y0 < q.y1 && a.y1 > q.y0;
  const free = (a, also = []) => a.x0 >= 0 && a.x1 <= W && a.y0 >= T - 8 && a.y1 <= y0 - 1 && ![...taken, ...also].some(q => hits(a, q));
  const take = (a, text) => { taken.push(a); if (text) texts.push(a); return a; };
  // A name is never level with another dot close by, where it could pass for that dot's name.
  // (Dots of its own pile do not count: the pile has one note that names them all.)
  const clear = (a, p) => { const own = unitOf(p).pts, cy = (a.y0 + a.y1) / 2;
    return pts.every(q => own.includes(q) || Math.abs(q.y - cy) >= lh / 2 + r - 1 || Math.max(a.x0 - q.x, q.x - a.x1) - r >= 20); };
  pts.forEach(p => take(bx(p.x - r - 1.5, p.y - r - 1.5, p.x + r + 1.5, p.y + r + 1.5)));
  take(bx(UX - HALO, UY - HALO, UX + HALO, UY + HALO)); take(bx(0, T - 8, gx - 3, y0 + 4));

  // RoboTeam's name and chip: left of its dot with the chip below it, or (when that does not fit,
  // as on a phone) the name over the dot and the chip in three parts beside it.
  const nameFont = `700 ${compact ? 19 : 22}px "Space Grotesk", system-ui, sans-serif`, LH = compact ? 24 : 28, nw = textWidth(us.name, nameFont) + 12;
  const right = UX - HALO - 6, chipW = s => textWidth(s, WN_FONT.mono) + 20;
  const facts = [`${us.arms} arms · ${Math.round(us.minutes / 60)} h`, 'cameras only', 'never pauses'];
  const layouts = [{ chips: [facts.join(' · ')] }, { chips: [facts[0], facts.slice(1).join(' · ')] }, { chips: facts, over: true }];
  layouts.forEach(l => { l.name = l.over ? [UX - nw / 2, UY - HALO - 2 - LH] : [right + 6 - nw, UY - LH / 2]; l.top = l.over ? UY - 11 : UY + LH / 2 + 8;
    l.boxes = [bx(l.name[0], l.name[1], l.name[0] + nw, l.name[1] + LH), ...l.chips.map((c, i) => bx(right - chipW(c), l.top + i * 30, right, l.top + 22 + i * 30))]; });
  const lay = layouts.find(l => l.boxes.every(a => free(a))) || layouts[2];
  lay.boxes.forEach(a => take(a, true));

  const placeName = (p, cands, also = []) => {
    const w = textWidth(p.b.name, WN_FONT.name);
    for (const [x, y] of cands) {
      const a = bx(x - 2, y - 2, x + w + 2, y + lh + 2);
      if (free(a, also) && clear(a, p)) { take(a, true); unitOf(p).lab.push({ name: p.b.name, x, y }); return a; }
    }
    return null;
  };
  const beside = p => [p.x + r + 6, p.y - lh / 2], over = p => [p.x - 3, p.y - r - 5 - lh], under = p => [p.x - 3, p.y + r + 5];

  // "6× longer": from the longest run of the others to 24 h, on that benchmark's row. The line starts
  // at its dot, with a tick at each end; the name sits over the dot (or under it).
  const fp = pts.find(p => p.b === far), ny = fp.y;
  const dimW = (em, rest) => textWidth(`${em} `, WN_FONT.em) + textWidth(rest, WN_FONT.name);
  const e6 = `${Math.round(us.minutes / far.minutes)}×`, e4 = `${Math.round(us.arms / most.arms)}×`, w6 = dimW(e6, 'longer'), w4 = dimW(e4, 'the arms');
  const xs = px(fp.x + r + 5), hm = (xs + UX) / 2;
  const line = [bx(xs, ny - 4, UX + 1, ny + 4), bx(xs - 2, ny - 6.5, xs + 2, ny + 6.5), bx(UX - 2, ny - 8, UX + 2, ny + 8)];
  placeName(fp, [over(fp), under(fp)], line);

  // The most arms of the others always has its name; on a phone it sits over the dot, inside the corner.
  const mp = pts.find(p => p.b === most), mostLab = placeName(mp, compact ? [over(mp), beside(mp)] : [beside(mp), over(mp)], line);
  // The corner where every other benchmark sits: 0 to the longest run, 0 to the most arms.
  let ry = Y(most.arms) - r - pad; if (mostLab && mostLab.y1 <= mp.y) ry = Math.min(ry, mostLab.y0 - 4);
  const rg = { x0: gx, y0: ry, x1: X(far.minutes / 60) + r + pad };
  const regionText = 'EVERY OTHER BENCHMARK', rw = textWidth(regionText, WN_FONT.mono) + 1.2 * (regionText.length - 1);
  take(bx(rg.x0, rg.y0 - 21, rg.x0 + rw + 4, rg.y0 - 5), true);

  // The words of "6× longer" sit in a gap in the line, else just under or over it.
  const hb = y => bx(hm - w6 / 2 - 6, y - 8, hm + w6 / 2 + 6, y + 8);
  const hy = [ny, ny + 13, ny - 13].find((y, i) => free(hb(y), i ? line : [])) ?? ny;
  take(hb(hy), true); line.forEach(a => take(a));
  const hPath = (hy === ny ? `M${xs} ${px(ny)}H${f1(hm - w6 / 2 - 7)}M${f1(hm + w6 / 2 + 7)} ${px(ny)}H${px(UX)}` : `M${xs} ${px(ny)}H${px(UX)}`) +
    `M${xs} ${px(ny) - 6}V${px(ny) + 6}M${px(UX)} ${px(ny) - 6}V${px(ny) + 6}`;

  // "4× the arms": from the most arms of the others up to RoboTeam, along 24 h; the words sit in a gap in the line.
  const yb = Y(most.arms), yt = UY + HALO + 4, vb = y => bx(UX - w4 / 2 - 6, y - 10, UX + w4 / 2 + 6, y + 10), vmid = (yb + yt) / 2;
  let vm = vmid;
  for (let k = 0; k <= 40; k++) { const y = vmid + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 3; if (y - 10 > yt + 6 && y + 10 < yb - 6 && free(vb(y))) { vm = y; break; } }
  take(vb(vm), true); take(bx(UX - 6, yt, UX + 6, yb + 1));
  const vPath = `M${px(UX) - 6} ${px(yb)}H${px(UX) + 6}M${px(UX)} ${px(yb)}V${f1(vm + 11)}M${px(UX)} ${f1(vm - 11)}V${f1(yt)}`;

  // The famous two, only where they fit, never on a phone.
  if (!compact) WN_FAMOUS.forEach(n => { const p = pts.find(q => q.b.name === n && q !== fp && q !== mp); if (p) placeName(p, [beside(p), over(p), under(p)]); });

  // Light gridlines at the ticks only, cut where a text or a dimension line crosses them.
  const cuts = [...texts, bx(UX - 1, yt - 2, UX + 1, yb + 8), bx(UX - 1, ny - 8, UX + 1, ny + 8)];
  const segs = (a, b, gaps) => gaps.sort((p, q) => p[0] - q[0]).reduce((ss, [g0, g1]) =>
    ss.flatMap(([s0, s1]) => (g1 <= s0 || g0 >= s1 ? [[s0, s1]] : [[s0, g0], [g1, s1]].filter(([c0, c1]) => c1 - c0 > 2))), [[a, b]]);
  let grid = '';
  [0, 6, 12, 18, 24, 30].forEach(h => { const x = X(h);
    grid += segs(T, y0, cuts.filter(c => c.x0 - 2 < x && x < c.x1 + 2).map(c => [c.y0 - 2, c.y1 + 2])).map(([a, b]) => `M${px(x)} ${f1(a)}V${f1(b)}`).join(''); });
  [4, 8, 12, 16, 20].forEach(a => { const y = Y(a);
    grid += segs(rg.x0, W - R, cuts.filter(c => c.y0 - 2 < y && y < c.y1 + 2).map(c => [c.x0 - 2, c.x1 + 2])).map(([p, q]) => `M${f1(p)} ${px(y)}H${f1(q)}`).join(''); });
  let axes = '';
  [0, 4, 8, 12, 16, 20].forEach(a => { axes += txt(rg.x0 - 7, Y(a) + 4, a, 'tick', 'end'); });
  [0, 6, 12, 18, 24, 30].forEach(h => { axes += txt(X(h), y0 + 20, `${h} h`, 'tick', 'middle'); });
  axes += txt(0, 13, 'Robot arms on one task', 'axis-t') + txt(W - 2, H - 6, 'How long one run can last', 'axis-t', 'end');

  const region = `<g class="an" style="--d:.12s"><rect class="region" x="${f1(rg.x0)}" y="${f1(rg.y0)}" width="${f1(rg.x1 - rg.x0)}" height="${f1(y0 - rg.y0)}" rx="10"/>` +
    txt(rg.x0 + 1, rg.y0 - 9, regionText, 'region-t') + '</g>' + `<line class="base an" x1="${f1(rg.x0)}" x2="${W - R}" y1="${px(y0)}" y2="${px(y0)}"/>`;
  const dims = `<path class="dim an grow-x" style="--d:1.45s" d="${hPath}"/><path class="dim an grow-up" style="--d:1.45s" d="${vPath}"/>` +
    txt(hm, hy + 4.5, `<tspan class="em">${e6}</tspan> longer`, 'dim-t an', 'middle', 'style="--d:1.8s"') +
    txt(UX, vm + 4.5, `<tspan class="em">${e4}</tspan> the arms`, 'dim-t an', 'middle', 'style="--d:1.8s"');

  // The others enter in a short stagger from the corner outwards; RoboTeam lands last with its halo.
  units.sort((a, b) => a.pts[0].x - b.pts[0].x || b.pts[0].y - a.pts[0].y);
  const ring = (xa, xb, cy, rr) => (xa === xb ? `<circle class="ring" cx="${f1(xa)}" cy="${f1(cy)}" r="${rr + 4}"/>`
    : `<rect class="ring" x="${f1(xa - rr - 4)}" y="${f1(cy - rr - 4)}" width="${f1(xb - xa + 2 * rr + 8)}" height="${2 * rr + 8}" rx="${rr + 4}"/>`);
  let dots = '';
  units.forEach((u, k) => {
    const d = 0.3 + k * 0.06, xs_ = u.pts.map(p => p.x), bs = u.pts.map(p => p.b);
    const say = bs.length > 1 ? `${bs.length} benchmarks: ${bs.map(b => `${b.name}, ${armsText(b.arms)}, ${lenText(b)}`).join('; ')}` : `${bs[0].name}: ${armsText(bs[0].arms)}, runs ${lenText(bs[0])}`;
    dots += `<g class="wn-u" data-b="${k}" tabindex="0" role="img" aria-label="${say.replace(/ /g, ' ')}">` +
      u.pts.map((p, j) => `<circle class="dot an pop" style="--d:${(d + j * 0.04).toFixed(2)}s" cx="${f1(p.x)}" cy="${f1(p.y)}" r="${r}"/>`).join('') +
      u.lab.map(l => txt(l.x, l.y + 12, l.name, 'nm an', 'start', `style="--d:${(d + 0.16).toFixed(2)}s"`)).join('') +
      ring(Math.min(...xs_), Math.max(...xs_), u.pts[0].y, r) + '</g>';
  });
  const uk = units.length, t = 1.05;
  dots += `<g class="wn-u us" data-b="${uk}" tabindex="0" role="img" aria-label="${us.name}: ${us.arms} arms, runs ${lenText(us).replace(/ /g, ' ')}, cameras only, never pauses, several agents">` +
    `<circle class="halo an halo" style="--d:${t}s" cx="${f1(UX)}" cy="${f1(UY)}" r="${HALO}"/><circle class="ours an land" style="--d:${t}s" cx="${f1(UX)}" cy="${f1(UY)}" r="${UR}"/>${ring(UX, UX, UY, UR)}</g>`;
  WN_UNITS = [...units.map(u => ({ pts: u.pts.map(p => [p.x, p.y, r]), note: u.pts.length > 1 ? pileNote(u.pts.map(p => p.b)) : benchNote(u.pts[0].b) })),
    { pts: [[UX, UY, HALO]], note: benchNote(us) }];

  const nameAt = lay.over ? `left:${Math.round(lay.name[0])}px` : `right:${Math.round(W - right - 6)}px`;
  const over_ = `<b class="wn-name an rise" data-b="${uk}" aria-hidden="true" style="${nameAt};top:${Math.round(lay.name[1])}px;--d:${t + 0.3}s">${us.name}</b>` +
    `<div class="wn-chips" data-b="${uk}" aria-hidden="true" style="right:${Math.round(W - right)}px;top:${Math.round(lay.top)}px">` +
    lay.chips.map((c, i) => `<span class="chip an rise" style="--d:${(t + 0.38 + i * 0.08).toFixed(2)}s">${c}</span>`).join('') + '</div>';
  const label = `Benchmarks by robot arms and how long one run can last. Every other benchmark has 1 to ${most.arms} arms and runs of at most ${Math.round(far.minutes / 60)} hours; RoboTeam has ${us.arms} arms and runs of up to ${Math.round(us.minutes / 60)} hours.`;
  box.innerHTML = `<div class="wn-plot${compact ? ' compact' : ''}" style="height:${H}px"><svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="group" aria-label="${label}">` +
    `<g class="an"><path class="grid" d="${grid}"/>${axes}</g>${region}${dims}${dots}</svg>${over_}</div>`;
  wnBind(fig); playOnce(fig, 2400);
}

// One dot or pile at a time: it grows a little, the rest dim, and its note opens above it.
function wnSet(fig, k) {
  if (k === wnOn) return; wnOn = k;
  fig.classList.toggle('hl', k != null);
  fig.querySelectorAll('[data-b]').forEach(e => e.classList.toggle('on', k != null && e.dataset.b === String(k)));
  const s = fig.querySelector('svg.chart'); if (s) s.style.cursor = k != null ? 'pointer' : '';
  if (k == null) { hideTip(); return; }
  const g = fig.querySelector(`.wn-u[data-b="${k}"]`);
  if (g && WN_UNITS[k]) showNote(WN_UNITS[k].note, g.querySelector('.ring'), 'chart-tip wn-tip');
}
function wnBind(fig) {
  if (fig.dataset.bound) return; fig.dataset.bound = '1';
  // The unit under the pointer: a dot or a name it touches, else the nearest dot within reach.
  const at = (e, reach) => {
    const g = e.target.closest && e.target.closest('.wn-u'); if (g && fig.contains(g)) return +g.dataset.b;
    const s = fig.querySelector('svg.chart'); if (!s) return null;
    const rc = s.getBoundingClientRect(), k = s.viewBox.baseVal.width / rc.width, x = (e.clientX - rc.left) * k, y = (e.clientY - rc.top) * k;
    let best = null, dist = reach;
    WN_UNITS.forEach((u, i) => u.pts.forEach(([ux, uy, ur]) => { const d = Math.hypot(ux - x, uy - y) - ur; if (d < dist) { dist = d; best = i; } }));
    return best;
  };
  fig.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') wnSet(fig, at(e, 8)); });
  fig.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') wnSet(fig, null); });
  // A tap opens a dot's note, or closes it when it was open before the tap. Focus that a pointer
  // causes is left to the pointer, so the order of focus and pointerup does not matter.
  let downAt = 0, downOn = null;
  fig.addEventListener('pointerdown', () => { downAt = performance.now(); downOn = wnOn; });
  fig.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') return; const k = at(e, 18); wnSet(fig, k === downOn ? null : k); });
  fig.addEventListener('focusin', e => { if (performance.now() - downAt < 800) return; const g = e.target.closest('.wn-u'); if (g) wnSet(fig, +g.dataset.b); });
  fig.addEventListener('focusout', e => { if (!e.relatedTarget || !fig.contains(e.relatedTarget)) wnSet(fig, null); });
  fig.addEventListener('keydown', e => { if (e.key === 'Escape') wnSet(fig, null); });
  document.addEventListener('pointerdown', e => { if (!fig.contains(e.target)) wnSet(fig, null); });
  addEventListener('scroll', () => wnSet(fig, null), { passive: true });
}

/* ---------- Results findings: a claim, one number, at most two sentences and one chart each ---------- */
const SOURCE = 'From the paper';
// A bar chart in HTML: per row a label, a 14 px bar on a track and a right-aligned value, one row
// every 32 px. Rows enter 0.4 s apart; a row's note shows on hover. A row with `stack` splits its bar.
function barRows(rows, { max = 100, head = '', cls = '', from = 0 } = {}) {
  return `<div class="bars${cls ? ` ${cls}` : ''}">${head}${rows.map((r, i) =>
    `<div class="bar-row${r.cls ? ` ${r.cls}` : ''}" data-reveal="fade" style="--i:${from + i}"${r.tip ? ` ${tipAt(r.tip)}` : ''}>` +
    `<span class="bl">${r.label}</span><span class="bt">` +
    (r.stack ? `<span class="stk anchor" data-reveal="grow-x">${r.stack.map(([v, f]) => `<i class="f-${f}" style="flex:${v} 1 0"></i>`).join('')}</span>`
      : `<i class="bf anchor f-${r.fill}" data-reveal="grow-x" style="width:${Math.max(0.6, 100 * r.value / max).toFixed(2)}%"></i>`) +
    `</span><span class="bv">${r.text}</span></div>`).join('')}</div>`;
}

// Seeing: the same AI given every position, with sharp pictures, with 128 × 80 pictures and without code.
// Rows, spot, enlarged pixel and words match the README's figure.
const VISION = [['oracle', 'Oracle: ground-truth positions', 'soft', 'ref'], ['adaptive', 'Sharp pictures and its own code', 'vio', 'lead'],
  ['low-resolution', 'Pictures of 128 × 80', 's2', ''], ['robot-tool-only', 'No code, robot tool only', 's2', '']];
function chartVision(F, box) {
  const V = Object.fromEntries(F.vision.map(v => [v.key, v])), f = F.vision_facts;
  setText('f-vision', 'Seeing', 'Seeing is the hard part.',
    `Given the ground-truth position of every object, the same AI completes all ${V.oracle.completed} tasks; from its cameras, ${V.adaptive.completed}. At 128 × 80 pixels one pixel covers about ${f.pixel_mm} mm, more than twice the ${f.tolerance_mm} mm it has for placing a cube, and it finishes ${V['low-resolution'].completed}.`,
    [`${V.oracle.completed} → ${V.adaptive.completed}`, 'tasks completed once it must see for itself']);
  const why = { oracle: 'The same AI, given the position of every object instead of pictures.', adaptive: 'Sharp camera pictures, and it may write its own code.', 'low-resolution': 'Every picture shrunk to 128 × 80 pixels.', 'robot-tool-only': 'Sharp pictures, but no code of its own: only the robot tool.' };
  const rows = VISION.filter(([key]) => V[key]).map(([key, label, fill, cls], i) => {
    const v = V[key], tip = tipLines(label, [['Tasks completed', `${v.completed} of 36`], ['Grasps that fail', pct(v.grasp_fail)]], `<p class="tw">${why[key]}</p>`, `${mname('gpt-6.1-sol')}, adaptive system. ${SOURCE}.`);
    return `<div class="vrow${cls ? ` ${cls}` : ''}" data-reveal="fade" style="--i:${i}" ${tipAt(tip)}><span class="vl">${label}</span>` +
      `<span class="bt"><i class="bf anchor f-${fill}" data-reveal="grow-x" style="width:${(100 * v.completed / 36).toFixed(2)}%"></i></span>` +
      `<span class="bv">${v.completed}</span><span class="bv">${pct(v.grasp_fail)}</span></div>`;
  }).join('');
  box.innerHTML = `<div class="vbars"><span class="kicker">Completed</span><span class="kicker vg">Grasps fail</span>${rows}</div>${zoomFigure(f)}`;
  zoomSetup(box.querySelector('.zoom'));
}
// The same spot of one camera picture at 1280 × 800 and at 128 × 80: a board and three red cubes.
// SPOT is the left, top, columns and rows of the spot in pixels of the 128 × 80 picture. The outlined
// pixel (PICK, inside the spot) is shown enlarged under each view: 100 sharp pixels against one colour.
// Dragging moves the picture under both views in whole pixels of the small picture.
const SPOT = [42, 29, 44, 28], PICK = [4, 25], LOUPE = 64, CONE = 18;
function zoomFigure(f) {
  const base = mediaUrl(MEDIA + 'findings/'), bar = (LOUPE * f.tolerance_mm / f.pixel_mm).toFixed(1);
  const view = (file, res, low, words) => `<div class="zv${low ? ' low' : ''}"><p class="kicker">${res}</p>` +
    `<div class="zv-pic"><div class="zoom-view"><img src="${base}${file}" alt="" draggable="false" decoding="async"><span class="zmark"></span></div>` +
    `<svg class="cone" aria-hidden="true"><path/></svg></div>` +
    `<div class="zl"><span class="loupe"><canvas width="${low ? 1 : 10}" height="${low ? 1 : 10}"></canvas><i style="width:${bar}px"></i></span><span class="zw">${words}</span></div></div>`;
  return `<figure class="zoom" data-reveal="up" tabindex="0" aria-label="The same spot of one camera picture, a board and three red cubes, at 1280 by 800 and at 128 by 80 pixels. One pixel of the small picture covers 100 pixels of the sharp one, about ${f.pixel_mm} mm, more than twice the ${f.tolerance_mm} mm a cube may be off. Drag or use the arrow keys to look around.">` +
    view('camera-sharp.webp', '1280 × 800', false, `100 pixels<br>≈ ${f.pixel_mm / 10} mm each`) +
    view('camera-128x80.png', '128 × 80', true, `one pixel<br>≈ ${f.pixel_mm} mm`) +
    `<p class="zkey"><i style="width:${bar}px"></i>${f.tolerance_mm} mm, the most a cube may be off</p>` +
    '<figcaption>Drag either picture, or use the arrow keys, to look around.</figcaption></figure>';
}
function zoomSetup(fig) {
  const [, , cols, rows] = SPOT, views = [...fig.querySelectorAll('.zoom-view')], imgs = views.map(v => v.querySelector('img'));
  const cans = [...fig.querySelectorAll('.loupe canvas')];
  let x = SPOT[0], y = SPOT[1], fx = x, fy = y, s = 0, last = null;
  // Each loupe shows the outlined pixel: the sharp picture box-filtered to 10 × 10 (2560 × 1600 → 1280 × 800), the small one as it is.
  const loupes = () => cans.forEach((c, j) => {
    const img = imgs[j]; if (!img.complete || !img.naturalWidth) return;
    const k = img.naturalWidth / 128, ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = k > c.width; ctx.imageSmoothingQuality = 'low';
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, (x + PICK[0]) * k, (y + PICK[1]) * k, k, k, 0, 0, c.width, c.height);
  });
  const place = () => {
    x = Math.min(Math.max(Math.round(fx), 0), 128 - cols); y = Math.min(Math.max(Math.round(fy), 0), 80 - rows);
    fig.style.setProperty('--zx', x); fig.style.setProperty('--zy', y); loupes();
  };
  // The cone runs from the outlined pixel down to the loupe under the view.
  const layout = () => {
    const w = views[0].getBoundingClientRect().width; if (!w || Math.abs(w / cols - s) < 0.01) return;
    s = w / cols; fig.style.setProperty('--s', `${s.toFixed(3)}px`);
    const top = (PICK[1] + 1) * s, h = (rows - PICK[1] - 1) * s + CONE, wide = Math.max(LOUPE, (PICK[0] + 1) * s);
    fig.querySelectorAll('.cone').forEach(c => {
      c.setAttribute('width', wide); c.setAttribute('height', h.toFixed(1)); c.setAttribute('viewBox', `0 0 ${wide} ${h.toFixed(1)}`); c.style.top = `${top.toFixed(1)}px`;
      c.querySelector('path').setAttribute('d', `M${(PICK[0] * s).toFixed(1)} 0L0 ${h.toFixed(1)}M${((PICK[0] + 1) * s).toFixed(1)} 0L${LOUPE} ${h.toFixed(1)}`);
    });
  };
  views.forEach(v => {
    v.addEventListener('pointerdown', e => { if (e.button) return; last = [e.clientX, e.clientY]; fx = x; fy = y; v.setPointerCapture(e.pointerId); fig.classList.add('grabbing'); });
    v.addEventListener('pointermove', e => { if (!last || !s) return; fx -= (e.clientX - last[0]) / s; fy -= (e.clientY - last[1]) / s; last = [e.clientX, e.clientY]; place(); });
    const end = () => { last = null; fig.classList.remove('grabbing'); };
    v.addEventListener('pointerup', end); v.addEventListener('pointercancel', end);
  });
  fig.addEventListener('keydown', e => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d) return;
    e.preventDefault(); fx = x + d[0]; fy = y + d[1]; place();
  });
  imgs.forEach(i => i.addEventListener('load', loupes));
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(views[0]);
  layout(); place();
}

// Waiting: how each model's agents spend their time.
let sortTime = 'model';
function chartTime(F, box) {
  const t = F.timeline_facts, shares = F.time_shares.rows;
  setText('f-time', 'Waiting', 'The arms mostly wait.', `The world never pauses, yet in one run an arm moves only ${t.arms_moving_pct}% of the time, while an agent is thinking for ${t.thinking_pct}% of it. Faster decisions would shorten tasks more than faster arms.`, [`${t.thinking_pct}%`, 'of one run, an agent is thinking']);
  const rows = shares.map(([m, th, rb, cd]) => ({ label: mname(m), text: `${Math.round(th)}%`, cls: m === 'gpt-6.1-sol' ? 'lead' : '', stack: [[th, 'vio'], [rb, 's2'], [cd, 's3']],
    tip: tipLines(mname(m), [['Thinking', `${fmt1(th)}%`], ['Robot tool', `${fmt1(rb)}%`], ['Own code', `${fmt1(cd)}%`]], '', `Share of agent time, adaptive system. ${SOURCE}.`) }));
  box.innerHTML = `<div class="chart-top"><p class="chart-cap kicker">Share of agent time</p><div class="seg" role="group" aria-label="Order of the rows">` +
    [['model', 'Strongest first'], ['think', 'Most thinking first']].map(([k, n]) => `<button type="button" data-v="${k}" aria-pressed="${k === sortTime}">${n}</button>`).join('') + '</div></div>' +
    '<p class="keyrow"><span><i class="f-vio"></i>Thinking</span><span><i class="f-s2"></i>Robot tool</span><span><i class="f-s3"></i>Own code</span></p>' + barRows(rows, { cls: 'stacked' });
  // A new order moves the rows to their places; they keep the order they were drawn in.
  const order = () => {
    const th = shares.map(r => r[1]), rank = th.map((v, i) => (sortTime === 'think' ? th.filter((w, j) => w > v || (w === v && j < i)).length : i));
    box.querySelectorAll('.bar-row').forEach((row, i) => { row.style.transform = rank[i] === i ? '' : `translateY(${(rank[i] - i) * 32}px)`; });
    box.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === sortTime));
  };
  box.querySelector('.seg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; sortTime = b.dataset.v; order(); });
  order();
}

// Retrying: the share of steps that fail at least once, in a typical task of each job.
function chartFailure(F, box) {
  const f = F.failure_by_type, P = f.median_atomic_failure_pct;
  const relayDone = D.outcomes ? D.tasks.filter(t => typeOf(t) === 'relay' && done(f.set, t)).length : 8;
  setText('f-failure', 'Retrying', 'Failing and retrying is normal.', `A grasp slips or a handover misses, and the agents see it in the pictures and try again. In a typical Relay task every step fails at least once, yet ${relayDone} of the 9 Relay tasks are completed.`, [`${P.relay}%`, 'of steps fail at least once in a typical Relay task']);
  const steps = f.median_steps_note || {};
  const rows = TYPES.map(([type, name]) => ({ label: `<i class="dot t-${type}"></i>${name}`, value: P[type], text: `${P[type]}%`, fill: type === 'relay' ? 'vio' : 's2', cls: type === 'relay' ? 'lead' : '',
    tip: tipLines(name, [['Steps that fail at least once', `${P[type]}%`]].concat(steps[type] ? [['Steps in a typical task', `about ${steps[type]}`]] : []), '', `Typical task of ${mname(f.set)}, adaptive system. ${SOURCE}.`) }));
  box.innerHTML = '<p class="chart-cap kicker">Steps that fail at least once</p>' + barRows(rows, { max: 100 });
}

// Team size: tasks finished at each level and at each team size.
function chartLevels(F, box) {
  const lv = F.levels;
  setText('f-levels', 'Team size', 'Bigger teams are harder than harder levels.', `${mname(lv.set)} completes about as many tasks at every level, but fewer as the team grows. More arms must share the space and the work.`, [`${lv.by_size[0]}\u2009→\u2009${lv.by_size[2]}`, `of ${lv.of} tasks, from small to large teams`]);
  const tasksOf = (kind, i) => D.tasks.filter(t => (kind === 'level' ? t.endsWith(`-l${i + 1}`) : t.split('-')[1] === SIZES[i]));
  const minis = list => `<div class="minis">${list.map(t => `<i class="t-${typeOf(t)}${done(lv.set, t) ? ' done' : ''}"></i>`).join('')}</div>`;
  const block = (title, labels, vals, fill, kind, from) => barRows(vals.map((v, i) => ({ label: labels[i], value: v, text: v, fill,
    tip: tipLines(labels[i], [['Tasks completed', `${v} of ${lv.of}`]], D.outcomes ? `${minis(tasksOf(kind, i))}<p class="tw">Filled squares are completed tasks.</p>` : '', `${mname(lv.set)}, adaptive system. ${SOURCE}.`) })),
    { max: lv.of, head: `<p class="bar-head">${title}</p>`, from });
  box.innerHTML = `<p class="chart-cap kicker">Tasks completed, of ${lv.of}</p><div class="levels">` +
    block('By level', ['Level 1', 'Level 2', 'Level 3'], lv.by_level, 's2', 'level', 0) + block('By team size', ['Small', 'Medium', 'Large'], lv.by_size, 'vio', 'size', 3) + '</div>';
}

// Team design: the four designs over eight arms, as in the film. Arms are squares, agents are dots.
const DESIGNS = [['single-agent', 'Single-agent', 'One agent drives every arm'], ['hierarchical', 'Hierarchical', 'A controller and one worker per arm'],
  ['decentralized', 'Decentralized', 'One worker per arm, no controller'], ['adaptive', 'Adaptive', 'A controller that lends arms to helpers']];
function teamDrawing(kind) {
  const arms = [...Array(8)].map((_, i) => [18 + i * 244 / 7, 112]), top = [140, 22], up = q => [q[0], q[1] - 9];
  const ln = (a, b, c = '') => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"${c ? ` class="${c}"` : ''}/>`;
  const dot = (p, r) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${r}"/>`;
  let lines = '', dots = '';
  if (kind === 'single-agent') { arms.forEach(q => { lines += ln(top, up(q)); }); dots = dot(top, 13); }
  else if (kind === 'hierarchical') { const mids = arms.map(q => [q[0], 66]); mids.forEach((m, i) => { lines += ln(top, m) + ln(m, up(arms[i])); }); dots = dot(top, 12) + mids.map(m => dot(m, 6.5)).join(''); }
  else if (kind === 'decentralized') {
    // A mesh: one worker per arm on two alternating heights, each linked to its neighbours i ± 1 and i ± 2.
    const mids = arms.map((q, i) => [q[0], i % 2 ? 70 : 44]);
    mids.forEach((m, i) => { [1, 2].forEach(d => { if (mids[i + d]) lines += ln(m, mids[i + d]); }); lines += ln(m, up(arms[i])); });
    dots = mids.map(m => dot(m, 6.5)).join('');
  } else {
    // Adaptive: the controller has lent arms 2-3 and 5-7 to two helpers.
    const helpers = [[[75.6, 63], [1, 2]], [[204.4, 63], [4, 5, 6]]], lent = {};
    helpers.forEach(([h, idx]) => { lines += ln(top, h, 'lend'); idx.forEach(i => { lent[i] = h; }); });
    arms.forEach((q, i) => { lines += ln(lent[i] || top, up(q), lent[i] ? 'lend' : ''); });
    dots = dot(top, 12) + helpers.map(([h]) => dot(h, 8)).join('');
  }
  const squares = arms.map(q => `<rect x="${(q[0] - 9).toFixed(1)}" y="${q[1] - 9}" width="18" height="18" rx="4"/>`).join('');
  return `<svg class="team-draw${kind === 'adaptive' ? ' ours' : ''}" viewBox="0 0 280 124" aria-hidden="true"><g class="tl">${lines}</g><g class="tn">${dots}</g><g class="ta">${squares}</g></svg>`;
}
function chartSystems(F, box) {
  const S = Object.fromEntries(F.systems.map(s => [s.key, s])), fin = F.systems.map(s => s.completed);
  const hMax = Math.max(...F.systems.map(s => s.total_hours)), tMax = Math.max(...F.systems.map(s => s.input_tokens_b));
  const timeX = Math.round(S['single-agent'].total_hours / S.decentralized.total_hours), tokX = Math.round(S.hierarchical.input_tokens_b / S['single-agent'].input_tokens_b);
  setText('f-systems', 'Agent systems', 'Same score, very different bill.', `All four agent systems complete ${Math.min(...fin)} to ${Math.max(...fin)} of the 36 tasks. The single-agent system takes ${timeX}× the time of the decentralized system, and the hierarchical system uses ${tokX}× the input tokens of the single-agent system. Input tokens are the text a model reads, which sets the cost.`, [`${tokX}×`, 'the input tokens for nearly the same score']);
  const call = { 'single-agent': ['hours', `${timeX}× the time`], hierarchical: ['tokens', `${tokX}× the tokens`] };
  const measure = (key, m, v, vmax, text, i) => {
    const w = 100 * v / vmax, note = call[key] && call[key][0] === m ? call[key][1] : '';
    return `<div class="team-m${note ? ' has-note' : ''}"><span class="ml">${m === 'hours' ? 'Hours' : 'Input tokens'}</span><span class="bt bare"><i class="bf f-${key === 'adaptive' ? 'vio' : 's2'}" data-reveal="grow-x" style="width:${w.toFixed(2)}%"></i>` +
      (note ? `<span class="note stem-up callout" data-reveal="up" style="--i:${i + 0.75};right:${(100 - w).toFixed(2)}%">${note}</span>` : '') + `</span><span class="bv">${text}</span></div>`;
  };
  const rows = DESIGNS.map(([key, name, line], i) => {
    const s = S[key];
    const tip = tipLines(name, [['Tasks completed', `${s.completed} of 36`], ['Completed within 6 hours', s.within_6h], ['Hours, all 36 tasks', fmt1(s.total_hours)], ['Input tokens, all tasks', `${fmt1(s.input_tokens_b)} billion`], ['Agent messages, typical task', s.median_messages]],
      key === 'adaptive' ? '<p class="tw">The team used everywhere else on this page.</p>' : '', `${mname('gpt-6.1-sol')}, all 36 tasks. ${SOURCE}.`);
    return `<div class="team-row${key === 'adaptive' ? ' ours' : ''}" data-reveal="fade" style="--i:${i}" data-anchor=".team-id b" ${tipAt(tip)}>` +
      `<div class="team-id">${teamDrawing(key)}<div><b>${name}</b><small>${line}</small></div></div>` +
      `<div class="team-fin"><span class="ml">Completed</span><b>${s.completed}</b></div>` +
      measure(key, 'hours', s.total_hours, hMax, `${s.total_hours.toFixed(1)}\u00a0h`, i) + measure(key, 'tokens', s.input_tokens_b, tMax, `${s.input_tokens_b.toFixed(1)}\u00a0B`, i) + '</div>';
  }).join('');
  box.innerHTML = `<div class="teams"><div class="teams-head" aria-hidden="true"><span></span><span class="kicker">Completed</span><span class="kicker">Hours, all 36 tasks</span><span class="kicker">Input tokens, all tasks</span></div>${rows}</div>` +
    `<p class="chart-foot">B is billions. Each system runs ${mname('gpt-6.1-sol')} on all 36 tasks; hours count tasks not completed up to the cutoff.</p>`;
}

// Explore every run: the steps each run finished over its hours, one small chart per job.
let pickProgress = 'both';
function chartProgress(F, box) {
  setText('f-progress', 'Every run', 'Explore every run.', 'Each line is one run of one task. It climbs each time an arm finishes a step, such as one cube placed; a dot ends a completed run, a cross one that was not completed.', [String(F.timelines.length), `runs of ${mname('gpt-6.1-sol')} and ${mname('opus-5.5')}`]);
  const hint = matchMedia('(hover: none)').matches ? 'Tap a line to watch its run.' : 'Point at a line to see its run; click it to watch.';
  box.innerHTML = `<div class="chart-top"><div class="seg" role="group" aria-label="Show the runs of">` +
    [['both', 'Both'], ['gpt-6.1-sol', mname('gpt-6.1-sol'), 'vio'], ['opus-5.5', mname('opus-5.5'), 's1']].map(([k, n, c]) => `<button type="button" data-v="${k}" aria-pressed="${k === pickProgress}">${c ? `<i class="sw f-${c}"></i>` : ''}${n}</button>`).join('') +
    `</div><p class="run-info">${hint}</p></div><div class="small-multiples" data-stagger data-show="${pickProgress}"></div>`;
  const grid = box.querySelector('.small-multiples'), info = box.querySelector('.run-info');
  const cols = grid.clientWidth >= 300 ? 2 : 1, gap = grid.clientWidth >= 600 ? 28 : 14, W = Math.floor((grid.clientWidth - gap * (cols - 1)) / cols);
  const H = Math.round(Math.min(240, Math.max(160, W * 0.5))), L = 32, R = 8, T = 8, B = 24;
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  TYPES.forEach(([type, typeName]) => {
    const runs = F.timelines.filter(r => typeOf(r.task) === type), most = Math.max(...runs.map(r => r.steps), 1);
    const X = h => L + Math.min(h, 24) / 24 * (W - L - R), Y = v => T + (1 - v / most) * (H - T - B);
    let g = '';
    (W < 220 ? [0, 12, 24] : [0, 6, 12, 18, 24]).forEach(h => { g += `<line class="grid" x1="${X(h)}" x2="${X(h)}" y1="${T}" y2="${H - B}"/>` + txt(X(h), H - B + 17, h ? `${h} h` : '0', '', 'middle'); });
    g += `<line class="axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>` + txt(L - 8, Y(most) + 4, most, '', 'end');
    // gpt-6.1-sol last, so its violet lines sit on top
    runs.slice().sort((a, b) => (a.set === 'gpt-6.1-sol') - (b.set === 'gpt-6.1-sol')).forEach(r => {
      let d = `M${X(0).toFixed(1)} ${Y(0).toFixed(1)}`;
      r.points.forEach(([h, v]) => { d += `H${X(h).toFixed(1)}V${Y(v).toFixed(1)}`; });
      const ex = X(r.hours), ey = Y(r.steps), c = r.set === 'gpt-6.1-sol' ? 'c-hi' : 'c-s1';
      const end = r.done ? `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3.4" class="${c} end"/>` : `<path d="M${(ex - 3).toFixed(1)} ${(ey - 3).toFixed(1)}l6 6m0-6l-6 6" class="${c} x"/>`;
      g += `<g data-i="${F.timelines.indexOf(r)}" data-set="${r.set}"><path d="${d}" class="line ${c}"/>${end}<path d="${d}" class="hit"/></g>`;
    });
    const fig = el('figure', `sm t-${type}`); fig.dataset.reveal = 'up';
    fig.innerHTML = `<figcaption class="mini-head"><i></i>${typeName}<span>steps, 0 to ${most}</span></figcaption>` + svg(W, H, g, `${typeName}: the progress of each run`);
    grid.append(fig);
  });
  const clear = () => { grid.querySelectorAll('.hot').forEach(x => x.classList.remove('hot')); grid.querySelectorAll('.dimmed').forEach(x => x.classList.remove('dimmed')); };
  grid.addEventListener('pointerover', e => {
    const gEl = e.target.closest('g[data-i]'); if (!gEl) return;
    const r = F.timelines[+gEl.dataset.i]; clear(); gEl.closest('svg').classList.add('dimmed'); gEl.querySelector('.line').classList.add('hot');
    info.innerHTML = `<b>${nice(r.task)}</b><span>${mname(r.set)} · ${r.steps} steps in ${fmtHours(r.hours)}</span>${statusChip(r.done, 'flat')}`;
  });
  grid.addEventListener('pointerout', e => { const gEl = e.target.closest('g[data-i]'); if (!gEl || gEl.contains(e.relatedTarget)) return; clear(); info.textContent = hint; });
  grid.addEventListener('click', e => { const gEl = e.target.closest('g[data-i]'); if (!gEl) return; const r = F.timelines[+gEl.dataset.i]; if (run(r.set, r.task)) openRun(r.set, r.task); });
  box.querySelector('.seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; pickProgress = b.dataset.v; grid.dataset.show = pickProgress;
    box.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', x === b));
  });
}

const CHARTS = {
  overview: [['chart-compare', chartCompare, true]],
  results: [['f-vision', chartVision, 'fluid'], ['f-time', chartTime, 'fluid'], ['f-failure', chartFailure, 'fluid'], ['f-levels', chartLevels, 'fluid'], ['f-systems', chartSystems, 'fluid'], ['f-progress', chartProgress]],
};
const drawnAt = {};
function drawCharts(view) {
  if (!FD || !CHARTS[view]) return;
  CHARTS[view].forEach(([id, draw, how]) => {
    const box = $(id).querySelector('.f-chart'), w = Math.floor(box.clientWidth), key = how === 'fluid' ? how : w;
    if (!w || drawnAt[id] === key) return;
    // A chart drawn again (a wider window, results arriving) does not play its entrance twice.
    const played = !!box.querySelector('.is-in');
    drawnAt[id] = key; draw(FD, box);
    if (how === true) return;
    bindTips(box);
    if (played || !motionOK()) box.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-in', 'rv-done')); else reveal(box);
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
  const arms = (type, size) => { const a = [1, 2, 3].map(l => (D.facts[`${type}-${size}-l${l}`] || {}).arms).filter(Boolean); const lo = Math.min(...a), hi = Math.max(...a); return lo === hi ? `${lo}` : `${lo}–${hi}`; };
  const fill = type => {
    const name = TYPES.find(t => t[0] === type)[1];
    const head = SIZES.map(size => { const f = D.facts[`${type}-${size}-l1`] || {}; return `<div class="chd">${cap(size)} team<small>${arms(type, size)} arms · ${f.workload} ${UNIT[f.unit] || ''}</small></div>`; }).join('');
    const cell = (size, level) => { const id = `${type}-${size}-l${level}`; return `<img loading="lazy" src="${base}${id}.webp" srcset="${base}${id}.webp 1x, ${base}800/${id}.webp 2x" alt="${nice(id)} at its start" title="${nice(id)}" width="400" height="250">`; };
    box.className = `nine t-${type}`;
    box.innerHTML = `<div class="nine-head"><h3>${name}: three team sizes, three levels</h3><span class="src">Each task at its start, as the cameras see it.</span></div>` +
      `<div class="nine-grid"><span class="corner"></span>${head}${[1, 2, 3].map(l => { const f = D.facts[`${type}-small-l${l}`] || {}; return `<div class="rh">Level ${l}<b>${f.level_note || ''}</b></div>` + SIZES.map(size => cell(size, l)).join(''); }).join('')}</div>`;
  };
  const buttons = [...document.querySelectorAll('.job .more')];
  const set = open => buttons.forEach(x => { const on = x === open; x.setAttribute('aria-expanded', on); x.textContent = on ? 'Hide the nine tasks' : 'See all nine tasks'; });
  buttons.forEach(b => b.addEventListener('click', () => {
    const type = b.closest('.job').dataset.type, open = b.getAttribute('aria-expanded') === 'true';
    if (open) { set(null); leave(box).then(() => { box.hidden = true; box.classList.remove('is-leaving'); }); return; }
    const was = !box.hidden; set(b); fill(type); box.hidden = false;
    if (motionOK()) box.animate(was ? [{ opacity: 0.2 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: was ? 150 : 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
    box.scrollIntoView({ block: 'nearest', behavior: motionOK() ? 'smooth' : 'auto' });
  }));
}

/* ---------- a model's name: point at it and that model stands out in the chart or board ---------- */
function modelHover() {
  let on = null;
  const light = m => {
    if (m === on) return; on = m;
    document.querySelectorAll('.m-hot').forEach(x => x.classList.remove('m-hot'));
    document.querySelectorAll('.model-focus').forEach(x => x.classList.remove('model-focus'));
    if (m) document.querySelectorAll(`[data-model="${CSS.escape(m)}"]`).forEach(x => { x.classList.add('m-hot'); const host = x.closest('svg.chart, .board'); if (host) host.classList.add('model-focus'); });
  };
  document.addEventListener('pointerover', e => {
    const t = e.target.closest('[data-model]');
    // On the board only the name lights a row; the squares light their column instead.
    light(t && (!t.closest('.board') || e.target.closest('.who')) ? t.dataset.model : null);
  });
}

/* ---------- start ---------- */
async function load(url) { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); }

async function start() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  // A local preview (?media=) swaps the published media host in the pictures the page starts with.
  if (override) document.querySelectorAll(`img[src^="${MEDIA}"]`).forEach(i => { i.src = mediaUrl(i.getAttribute('src')); });
  chrome(); reveal(); playerControls(); nine(); modelHover(); boardControls();
  const [tasks, media] = await Promise.all([load('data/tasks.json'), load('data/media.json')]);
  D.media = media; D.sets = media.sets.map(s => s.key);
  D.tasks = TYPES.flatMap(([type]) => SIZES.flatMap(size => [1, 2, 3].map(level => `${type}-${size}-l${level}`)));
  tasks.tasks.forEach(t => { D.facts[t.id] = t; });
  media.sets.forEach(s => { D.runs[s.key] = s.runs; });
  film(); clips(); board(); library(); glance(); nextThumbs(); howCamera(); tocSpy();
  addEventListener('hashchange', route); route();
  findings();
  try {
    const results = await load(RESULTS_URL);
    D.outcomes = results.outcomes; numbers(results); board(); library(); glance(); nextThumbs(); Object.keys(drawnAt).forEach(k => delete drawnAt[k]); drawCharts(current);
    const best = results.conditions.find(c => c.key === 'adaptive'); if (best) statBest(best.completed);
  } catch { /* the board and the library stay without results */ }
}

start();
