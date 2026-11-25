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

/* One place for the outcome words and for how hours read */
const WORDS = { fin: 'Finished', not: 'Not finished', soon: 'Coming soon', pending: 'Result to come' };
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
const video = (set, task, view) => `${D.media.sets.find(s => s.key === set).base}${run(set, task).folder}/${view}.mp4`;
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
  cite.addEventListener('click', e => { if (e.target === cite) cite.close(); });
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
  }), { rootMargin: '0px 0px -8% 0px' });
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

function film() {
  const f = D.media.film, box = $('film'); if (!f || !f.loop) return;
  // The 720p file is sharp enough unless the box is wider than about 1400 device pixels.
  const base = mediaUrl(f.base), wide = box.clientWidth * (devicePixelRatio || 1) > 1400;
  // The poster is the hall seen from above with the four jobs marked, 6.3 s into the loop; the first play starts there.
  // The loop is fetched only once the page has loaded, so it never slows the page down.
  const poster = box.querySelector('.film-poster');
  if (override) { poster.src = mediaUrl(poster.getAttribute('src')); $('how-camera').src = mediaUrl($('how-camera').getAttribute('src')); }
  const begin = () => {
    const v = el('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('aria-label', 'The RoboTeam film');
    v.src = base + (wide || !f.loop.small ? f.loop.video : f.loop.small);
    v.addEventListener('loadedmetadata', () => { v.currentTime = 6.2; }, { once: true });
    v.addEventListener('playing', () => v.classList.add('ready'), { once: true });
    box.append(v); onScreen.observe(v);
  };
  const later = () => ('requestIdleCallback' in window ? requestIdleCallback(begin, { timeout: 1500 }) : setTimeout(begin, 300));
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
  if (f.film) {
    const b = $('watch-film'); b.hidden = false;
    if (f.film.seconds) b.querySelector('span').textContent = `Watch the film · ${clock(f.film.seconds)}`;
    b.addEventListener('click', () => openFilm(base + f.film.video, base + f.film.poster));
  }
}

function clips() {
  const c = D.media.clips; if (!c) return;
  const base = mediaUrl(c.base), byKey = Object.fromEntries(c.items.map(i => [i.key, i]));
  const speedTag = clip => `<span class="chip speed">${clip.speed.toLocaleString('en-US')}× real time</span>`;
  document.querySelectorAll('.job[data-clip]').forEach(job => {
    const clip = byKey[job.dataset.clip]; if (!clip) return;
    const frame = job.querySelector('.clip'); frame.append(clipVideo(base + clip.video, base + clip.poster, clip.caption)); frame.insertAdjacentHTML('beforeend', speedTag(clip));
    frame.insertAdjacentHTML('beforeend', `<span class="chip shown">${teamName(clip.set)} · ${short(clip.task)}</span>`);
    if (run(clip.set, clip.task)) { frame.classList.add('opens'); frame.title = 'Open the whole run'; frame.addEventListener('click', () => openRun(clip.set, clip.task)); }
  });
}

/* ---------- results: three numbers and the board of squares ---------- */
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
const rowName = set => (set === REFERENCE ? ['Reference', 'The same AI, given the position of every object'] : TEAMS[set] || [set, '']);

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
  b.append(el('div', 'cols', '<span class="kicker">Cameras only</span><span class="kicker">Finished</span>' +
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
function runCard(set, task, { mark = true, type = true, team = false } = {}) {
  const r = run(set, task), finished = done(set, task), o = outcome(set, task);
  const card = el('button', `card t-${typeOf(task)}`); card.type = 'button';
  card.innerHTML = `<div class="thumb"><img alt="" loading="lazy" src="${poster(set, task, 'front')}"><img class="alt" alt="" data-src="${poster(set, task, 'top')}">` +
    (mark && finished !== null ? statusChip(finished, 'mark') : '') +
    `<span class="chip len">${clock(r.seconds)}</span></div><b><i></i>${type ? `${cap(typeOf(task))} · ` : ''}${short(task)}</b>` +
    `<small>${team ? `${teamName(set)} · ` : ''}${facts(task)}${o && o.hours != null ? ` · ${workText(o.hours)}` : ''}</small>`;
  card.addEventListener('pointerenter', () => { const alt = card.querySelector('.alt'); if (alt && !alt.src) alt.src = alt.dataset.src; }, { once: true });
  card.addEventListener('click', () => openRun(set, task));
  return card;
}
const FEATURED = [['gpt-6.1-sol', 'transport-large-l3'], ['opus-5.5', 'mosaic-large-l1'], ['gpt-6.1-sol', 'relay-large-l1'], ['gpt-6.1-sol', 'dial-large-l3'],
  ['opus-5.5', 'transport-large-l2'], ['gpt-6.1-sol', 'mosaic-small-l3'], ['opus-5.5', 'relay-medium-l2'], ['opus-5.5', 'dial-medium-l3']];
function featured() {
  const box = $('featured'); box.innerHTML = '';
  FEATURED.filter(([set, task]) => D.runs[set] && run(set, task)).forEach(([set, task]) => box.append(runCard(set, task, { mark: false, team: true })));
}

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
  chipRow('filter-status', 'status', [['all', `All <small>${tally('all')}</small>`], ['yes', `<i class="sq done"></i>${WORDS.fin} <small>${tally('yes')}</small>`], ['no', `<i class="sq"></i>${WORDS.not} <small>${tally('no')}</small>`]]);
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
      grid.append(runCard(set, task, { mark: F.status === 'all', type: F.job === 'all' }));
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
    frame.append(v, el('span', 'chip view-tag', label), el('span', 'chip speed', ''));
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
  $('player-title').innerHTML = `<i></i>${nice(task)}` + (finished !== null ? ` ${statusChip(finished, 'flat')}` : '');
  $('player-sub').textContent = `${teamName(set)} · ${facts(task)}${o && o.hours != null ? ` · ${workText(o.hours)}` : ''} · ${clock(r.seconds)} of video`;
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

function chartCompare(F, box) {
  const narrow = box.clientWidth < 560, W = narrow ? 560 : widthOf(box), H = 330, L = 40, R = 26, T = 22, B = 44;
  const lx = m => Math.log10(m), x0 = lx(0.06), x1 = lx(2400);
  const X = m => L + (lx(m) - x0) / (x1 - x0) * (W - L - R), Y = a => T + (1 - a / 17) * (H - T - B);
  let g = '';
  [[0.1, '6 s'], [1, '1 min'], [10, '10 min'], [60, '1 h'], [240, '4 h'], [1440, '24 h']].forEach(([m, l]) => { g += `<line class="grid" x1="${X(m)}" x2="${X(m)}" y1="${T}" y2="${H - B}"/>` + txt(X(m), H - B + 18, l, '', 'middle'); });
  [0, 4, 8, 12, 16].forEach(a => { g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(a)}" y2="${Y(a)}"/>` + txt(L - 8, Y(a) + 4, a, '', 'end'); });
  g += txt(L - 8, T - 8, 'Arms', '', 'end') + txt(W - R, H - 6, 'How long a run lasts →', '', 'end');
  const place = { ReflexBench: [0, -13, 'middle'], EmbodiedBench: [-7, 17, 'end'], VLABench: [7, 17, 'start'], RoboTwin: [10, 4, 'start'], RoboFactory: [0, -13, 'middle'], RoCoBench: [0, -13, 'middle'],
    RobotWorld: [-9, 17, 'end'], RoboColiseum: [0, -13, 'middle'], PARTNR: [9, 17, 'start'], 'Embodied First Exam': [0, 22, 'middle'], RoboTeam: [-18, 5, 'end'] };
  const nudge = { EmbodiedBench: 0.86, VLABench: 1.16 };
  F.benchmarks.rows.forEach(([name, arms, multi, real, vision, minutes, approx, group]) => {
    const cx = X(minutes * (nudge[name] || 1)), cy = Y(arms), ours = group === 'ours', r = ours ? 8 : 5.5;
    const cls = ours ? 'c-hi' : group === 'agent' ? 'c-s2' : 'c-s3';
    const tipHtml = tipLines(name, [['Most arms', arms], ['Several agents', yesNo(multi)], ['Never pauses', yesNo(real)], ['Cameras only', yesNo(vision)], ['Run length', runLength(minutes, approx)]],
      `<div class="tl"><span>${group === 'policy' ? 'Tests trained robot policies' : 'Tests AI agents'}</span><span></span></div>`);
    let p = '';
    if (real !== 'no') p += `<circle cx="${cx}" cy="${cy}" r="${r + 5}" class="${cls}" stroke-width="1.6" ${real === 'partly' ? 'stroke-dasharray="2 3"' : ''} style="fill:none"/>`;
    p += `<circle cx="${cx}" cy="${cy}" r="${r}" class="${cls}${vision === 'yes' ? '' : ' hollow'}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="14" style="fill:transparent"/>`;
    const [dx, dy, an] = place[name] || [8, 4, 'start'];
    p += txt(cx + dx, cy + dy, name, ours ? 'big' : 'ink2', an);
    g += `<g class="pt" ${tipAt(tipHtml)}>${p}</g>`;
  });
  box.innerHTML = `<div class="${narrow ? 'scroll-x' : ''}">${svg(W, H, g, 'Benchmarks by number of arms and run length; RoboTeam is the only one with 16 arms and runs of up to 24 hours')}</div>` +
    `<div class="keyrow"><span>● cameras only</span><span>○ given object positions, fully or partly</span><span>◎ the world never pauses</span><span><i style="--c:var(--s2)"></i>AI agents</span><span><i style="--c:var(--s3)"></i>trained policies</span></div>` +
    `<p class="src">From the paper's comparison table; point at a benchmark for details. ${F.benchmarks.left_out}</p>`;
  bindTips(box);
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

// Seeing: the same AI with the position of every object, with cameras, with 128 × 80 pictures, without code.
function chartVision(F, box) {
  const V = Object.fromEntries(F.vision.map(v => [v.key, v])), f = F.vision_facts;
  setText('f-vision', 'Seeing', 'Seeing is the hard part.',
    `Told where every object is, the same AI finishes all ${V.oracle.completed} tasks; from its cameras, ${V.adaptive.completed}. At 128\u00a0×\u00a080 pixels one pixel covers about ${f.pixel_mm}\u00a0mm, more than twice the ${f.tolerance_mm}\u00a0mm it has for placing a cube, and it finishes ${V['low-resolution'].completed}.`,
    [`${V.oracle.completed}\u2009→\u2009${V.adaptive.completed}`, 'tasks finished once it must see for itself']);
  const name = { oracle: 'Given every position', adaptive: 'Cameras, 1280\u00a0×\u00a0800', 'low-resolution': 'Cameras, 128\u00a0×\u00a080', 'robot-tool-only': 'Cameras, no own code' };
  const why = { oracle: 'Reference: the same AI, given the position of every object instead of pictures.', adaptive: 'Sharp camera pictures, and it may write its own code.', 'low-resolution': 'Every picture shrunk to 128 × 80 pixels.', 'robot-tool-only': 'Sharp pictures, but no code of its own: only the robot tool.' };
  const rows = F.vision.map(v => ({ label: name[v.key] || v.label, value: v.completed, text: v.completed,
    fill: v.key === 'oracle' ? 'soft' : v.key === 'adaptive' ? 'vio' : 's2', cls: v.key === 'oracle' ? 'ref' : v.key === 'adaptive' ? 'lead' : '',
    tip: tipLines(name[v.key] || v.label, [['Tasks finished', `${v.completed} of 36`], ['Grasps that fail', pct(v.grasp_fail)]], `<p class="tw">${why[v.key] || ''}</p>`, `${mname('gpt-6.1-sol')}, Adaptive team. ${SOURCE}.`) }));
  box.innerHTML = `<p class="chart-cap kicker">Tasks finished, of 36</p>${barRows(rows, { max: 36 })}${zoomFigure(f)}`;
  zoomDrag(box.querySelector('.zoom'));
}
// The same spot of one camera picture at 1280 × 800 and at 128 × 80, magnified so that one pixel of
// the small picture is 20 px wide; the bar is the room an agent has for placing a cube.
const ZOOM = 2; // CSS px per pixel of the 1280 × 800 picture
function zoomFigure(f) {
  const base = mediaUrl(MEDIA + 'findings/'), bar = (10 * ZOOM * f.tolerance_mm / f.pixel_mm).toFixed(1);
  const view = (file, res, low) => `<div class="zoom-view${low ? ' low' : ''}"><img src="${base}${file}" alt="" draggable="false" loading="lazy" decoding="async">` +
    `<span class="chip view-tag">${res}</span><span class="chip scale"><i style="width:${bar}px"></i>${f.tolerance_mm}\u00a0mm</span></div>`;
  return `<figure class="zoom" data-reveal="up" tabindex="0" aria-label="One camera picture at 1280 by 800 and at 128 by 80 pixels, magnified on the same spot. Drag or use the arrow keys to look around.">` +
    view('camera-full.webp', '1280\u00a0×\u00a0800') + view('camera-128x80.png', '128\u00a0×\u00a080', true) +
    `<figcaption>The same spot in both pictures, magnified. The bar is ${f.tolerance_mm}\u00a0mm. Drag to look around.</figcaption></figure>`;
}
function zoomDrag(fig) {
  let x = 640, y = 381, last = null; // the red cube in front of arm A
  const views = [...fig.querySelectorAll('.zoom-view')];
  const set = () => {
    const r = views[0].getBoundingClientRect(), hw = r.width / (2 * ZOOM), hh = r.height / (2 * ZOOM);
    if (r.width) { x = Math.min(Math.max(x, hw), 1280 - hw); y = Math.min(Math.max(y, hh), 800 - hh); }
    fig.style.setProperty('--zx', x.toFixed(1)); fig.style.setProperty('--zy', y.toFixed(1));
  };
  views.forEach(v => {
    v.addEventListener('pointerdown', e => { if (e.button) return; last = [e.clientX, e.clientY]; v.setPointerCapture(e.pointerId); fig.classList.add('grabbing'); });
    v.addEventListener('pointermove', e => { if (!last) return; x -= (e.clientX - last[0]) / ZOOM; y -= (e.clientY - last[1]) / ZOOM; last = [e.clientX, e.clientY]; set(); });
    const end = () => { last = null; fig.classList.remove('grabbing'); };
    v.addEventListener('pointerup', end); v.addEventListener('pointercancel', end);
  });
  fig.addEventListener('keydown', e => { const d = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[e.key]; if (!d) return; e.preventDefault(); x += d[0]; y += d[1]; set(); });
  set();
}

// Waiting: how each model's agents spend their time.
let sortTime = 'model';
function chartTime(F, box) {
  const t = F.timeline_facts, shares = F.time_shares.rows;
  setText('f-time', 'Waiting', 'The arms mostly wait.', `The world never pauses, yet in one run an arm moves only ${t.arms_moving_pct}% of the time, while an agent is thinking for ${t.thinking_pct}% of it. Faster decisions would shorten tasks more than faster arms.`, [`${t.thinking_pct}%`, 'of one run, an agent is thinking']);
  const rows = shares.map(([m, th, rb, cd]) => ({ label: mname(m), text: `${Math.round(th)}%`, cls: m === 'gpt-6.1-sol' ? 'lead' : '', stack: [[th, 'vio'], [rb, 's2'], [cd, 's3']],
    tip: tipLines(mname(m), [['Thinking', `${fmt1(th)}%`], ['Robot tool', `${fmt1(rb)}%`], ['Own code', `${fmt1(cd)}%`]], '', `Share of agent time, Adaptive team. ${SOURCE}.`) }));
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
  setText('f-failure', 'Retrying', 'Failing and retrying is normal.', `A grasp slips or a handover misses, and the agents see it in the pictures and try again. In a typical Relay task every handover fails at least once, yet ${relayDone} of the 9 Relay tasks are finished.`, [`${P.relay}%`, 'of Relay handovers fail at least once']);
  const steps = f.median_steps_note || {};
  const rows = TYPES.map(([type, name]) => ({ label: `<i class="dot t-${type}"></i>${name}`, value: P[type], text: `${P[type]}%`, fill: type === 'relay' ? 'vio' : 's2', cls: type === 'relay' ? 'lead' : '',
    tip: tipLines(name, [['Steps that fail at least once', `${P[type]}%`]].concat(steps[type] ? [['Steps in a typical task', `about ${steps[type]}`]] : []), '', `Typical task of ${mname(f.set)}, Adaptive team. ${SOURCE}.`) }));
  box.innerHTML = '<p class="chart-cap kicker">Steps that fail at least once</p>' + barRows(rows, { max: 100 });
}

// Team size: tasks finished at each level and at each team size.
function chartLevels(F, box) {
  const lv = F.levels;
  setText('f-levels', 'Team size', 'Bigger teams are harder than harder levels.', `${mname(lv.set)} finishes about as many tasks at every level, but fewer as the team grows. More arms must share the space and the work.`, [`${lv.by_size[0]}\u2009→\u2009${lv.by_size[2]}`, `of ${lv.of} tasks, from small to large teams`]);
  const tasksOf = (kind, i) => D.tasks.filter(t => (kind === 'level' ? t.endsWith(`-l${i + 1}`) : t.split('-')[1] === SIZES[i]));
  const minis = list => `<div class="minis">${list.map(t => `<i class="t-${typeOf(t)}${done(lv.set, t) ? ' done' : ''}"></i>`).join('')}</div>`;
  const block = (title, labels, vals, fill, kind, from) => barRows(vals.map((v, i) => ({ label: labels[i], value: v, text: v, fill,
    tip: tipLines(labels[i], [['Tasks finished', `${v} of ${lv.of}`]], D.outcomes ? `${minis(tasksOf(kind, i))}<p class="tw">Filled squares are finished tasks.</p>` : '', `${mname(lv.set)}, Adaptive team. ${SOURCE}.`) })),
    { max: lv.of, head: `<p class="bar-head">${title}</p>`, from });
  box.innerHTML = `<p class="chart-cap kicker">Tasks finished, of ${lv.of}</p><div class="levels">` +
    block('By level', ['Level 1', 'Level 2', 'Level 3'], lv.by_level, 's2', 'level', 0) + block('By team size', ['Small', 'Medium', 'Large'], lv.by_size, 'vio', 'size', 3) + '</div>';
}

// Team design: the four designs over eight arms, as in the film. Arms are squares, agents are dots.
const DESIGNS = [['single-agent', 'Single agent', 'One agent drives every arm'], ['hierarchical', 'Hierarchical', 'A controller and one worker per arm'],
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
  setText('f-systems', 'Team design', 'Same score, very different bill.', `However the agents are organized, they finish ${Math.min(...fin)} to ${Math.max(...fin)} of the 36 tasks. A single agent takes ${timeX}× the time of a decentralized team, and a hierarchical team reads ${tokX}× the tokens of a single agent.`, [`${tokX}×`, 'the tokens for nearly the same score']);
  const call = { 'single-agent': ['hours', `${timeX}× the time`], hierarchical: ['tokens', `${tokX}× the tokens`] };
  const measure = (key, m, v, vmax, text, i) => {
    const w = 100 * v / vmax, note = call[key] && call[key][0] === m ? call[key][1] : '';
    return `<div class="team-m${note ? ' has-note' : ''}"><span class="ml">${m === 'hours' ? 'Hours' : 'Tokens read'}</span><span class="bt bare"><i class="bf f-${key === 'adaptive' ? 'vio' : 's2'}" data-reveal="grow-x" style="width:${w.toFixed(2)}%"></i>` +
      (note ? `<span class="note stem-up callout" data-reveal="up" style="--i:${i + 0.75};right:${(100 - w).toFixed(2)}%">${note}</span>` : '') + `</span><span class="bv">${text}</span></div>`;
  };
  const rows = DESIGNS.map(([key, name, line], i) => {
    const s = S[key];
    const tip = tipLines(name, [['Tasks finished', `${s.completed} of 36`], ['Finished within 6 hours', s.within_6h], ['Hours, all 36 tasks', fmt1(s.total_hours)], ['Tokens read, all tasks', `${fmt1(s.input_tokens_b)} billion`], ['Agent messages, typical task', s.median_messages]],
      key === 'adaptive' ? '<p class="tw">The team used everywhere else on this page.</p>' : '', `${mname('gpt-6.1-sol')}, all 36 tasks. ${SOURCE}.`);
    return `<div class="team-row${key === 'adaptive' ? ' ours' : ''}" data-reveal="fade" style="--i:${i}" data-anchor=".team-id b" ${tipAt(tip)}>` +
      `<div class="team-id">${teamDrawing(key)}<div><b>${name}</b><small>${line}</small></div></div>` +
      `<div class="team-fin"><span class="ml">Finished</span><b>${s.completed}</b></div>` +
      measure(key, 'hours', s.total_hours, hMax, `${s.total_hours.toFixed(1)}\u00a0h`, i) + measure(key, 'tokens', s.input_tokens_b, tMax, `${s.input_tokens_b.toFixed(1)}\u00a0B`, i) + '</div>';
  }).join('');
  box.innerHTML = `<div class="teams"><div class="teams-head" aria-hidden="true"><span></span><span class="kicker">Finished</span><span class="kicker">Hours, all 36 tasks</span><span class="kicker">Tokens read, all tasks</span></div>${rows}</div>` +
    `<p class="chart-foot">Tokens read: the text a model reads, which sets the cost (B is billions). Each team is ${mname('gpt-6.1-sol')} on all 36 tasks; hours count unfinished tasks up to the cutoff.</p>`;
}

// Explore every run: the steps each run finished over its hours, one small chart per job.
let pickProgress = 'both';
function chartProgress(F, box) {
  setText('f-progress', 'Every run', 'Explore every run.', 'Each line is one run of one task. It climbs each time an arm finishes a step, such as one cube placed; a dot ends a finished run, a cross one that was not finished.', [String(F.timelines.length), `runs of ${mname('gpt-6.1-sol')} and ${mname('opus-5.5')}`]);
  const hint = matchMedia('(hover: none)').matches ? 'Tap a line to watch its run.' : 'Point at a line to see its run; click it to watch.';
  box.innerHTML = `<div class="chart-top"><div class="seg" role="group" aria-label="Show the runs of">` +
    [['both', 'Both'], ['gpt-6.1-sol', mname('gpt-6.1-sol'), 'vio'], ['opus-5.5', mname('opus-5.5'), 's1']].map(([k, n, c]) => `<button type="button" data-v="${k}" aria-pressed="${k === pickProgress}">${c ? `<i class="sw f-${c}"></i>` : ''}${n}</button>`).join('') +
    `</div><p class="run-info">${hint}</p></div><div class="small-multiples" data-stagger data-show="${pickProgress}"></div>`;
  const grid = box.querySelector('.small-multiples'), info = box.querySelector('.run-info');
  const cols = grid.clientWidth >= 960 ? 4 : grid.clientWidth >= 480 ? 2 : 1, gap = 24, W = Math.floor((grid.clientWidth - gap * (cols - 1)) / cols);
  const H = Math.round(Math.min(210, Math.max(160, W * 0.68))), L = 32, R = 8, T = 8, B = 24;
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  TYPES.forEach(([type, typeName]) => {
    const runs = F.timelines.filter(r => typeOf(r.task) === type), most = Math.max(...runs.map(r => r.steps), 1);
    const X = h => L + Math.min(h, 24) / 24 * (W - L - R), Y = v => T + (1 - v / most) * (H - T - B);
    let g = '';
    [0, 6, 12, 18, 24].forEach(h => { g += `<line class="grid" x1="${X(h)}" x2="${X(h)}" y1="${T}" y2="${H - B}"/>` + txt(X(h), H - B + 17, h ? `${h} h` : '0', '', 'middle'); });
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
  chrome(); reveal(); playerControls(); nine(); modelHover(); boardControls();
  const [tasks, media] = await Promise.all([load('data/tasks.json'), load('data/media.json')]);
  D.media = media; D.sets = media.sets.map(s => s.key);
  D.tasks = TYPES.flatMap(([type]) => SIZES.flatMap(size => [1, 2, 3].map(level => `${type}-${size}-l${level}`)));
  tasks.tasks.forEach(t => { D.facts[t.id] = t; });
  media.sets.forEach(s => { D.runs[s.key] = s.runs; });
  film(); clips(); board(); library(); featured(); tocSpy();
  addEventListener('hashchange', route); route();
  findings();
  try {
    const results = await load(RESULTS_URL);
    D.outcomes = results.outcomes; numbers(results); board(); library(); featured(); Object.keys(drawnAt).forEach(k => delete drawnAt[k]); drawCharts(current);
    const best = results.conditions.find(c => c.key === 'adaptive'); if (best) $('stat-best').textContent = `${best.completed} / 36`;
  } catch { /* the board and the library stay without results */ }
}

start();
