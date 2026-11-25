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
function tocSpy() {
  const links = [...document.querySelectorAll('#toc a')], parts = links.map(a => document.querySelector(a.getAttribute('href')));
  const spy = () => {
    if (current !== 'results') return;
    let on = 0; parts.forEach((p, i) => { if (p.getBoundingClientRect().top < 160) on = i; });
    links.forEach((a, i) => a.classList.toggle('on', i === on));
  };
  addEventListener('scroll', spy, { passive: true }); spy();
  // On narrow screens the row of contents slides away while reading down and returns on the way up.
  const toc = $('toc'); let lastY = scrollY;
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
  const row = el('div', 'row'); row.dataset.model = set;
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
  const cols = el('div', 'cols', '<span></span><span></span>' + TYPES.map(([k, n]) => `<div class="ch t-${k}">${n}<small><span>Small</span><span>Medium</span><span>Large</span></small></div>`).join(''));
  b.append(el('div', 'band', 'From camera images alone'), cols);
  D.sets.filter(s => s !== REFERENCE).forEach(s => b.append(boardRow(s)));
  if (D.sets.includes(REFERENCE)) { const o = el('div', 'oracle'); o.append(boardRow(REFERENCE)); b.append(o); }
}

function tip(anchor, set, task) {
  const t = $('tip'), has = !!run(set, task); t.className = `tip t-${typeOf(task)}`;
  t.innerHTML = (has ? `<img alt="" src="${poster(set, task, 'front')}">` : '') +
    `<div class="tip-body"><div><b>${nice(task)}</b><small>${teamName(set)} · ${facts(task)}</small></div>` +
    `<div class="tip-state">${has ? stateHTML(set, task) : `<span class="soon">${WORDS.soon}</span>`}</div></div>`;
  t.hidden = false;
  const a = anchor.getBoundingClientRect(), w = 236, h = t.offsetHeight;
  let y = a.top - h - 10; if (y < 8) y = a.bottom + 10;
  t.style.left = `${Math.min(Math.max(8, a.left + a.width / 2 - w / 2), innerWidth - w - 8)}px`; t.style.top = `${y}px`;
}
function hideTip() { $('tip').hidden = true; }
addEventListener('scroll', hideTip, { passive: true });

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

/* Hover details: elements carry data-tip, an index into TIPS; one tooltip follows the pointer. */
const TIPS = [];
const tipAt = html => `data-tip="${TIPS.push(html) - 1}"`;
const tipLines = (title, rows, extra = '') => `<b>${title}</b>${rows.map(([k, v]) => `<div class="tl"><span>${k}</span><span>${v}</span></div>`).join('')}${extra}`;
function bindTips(root) {
  const t = $('tip');
  const place = e => { const w = t.offsetWidth, h = t.offsetHeight; let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14; if (y + h > innerHeight - 8) y = e.clientY - h - 14; t.style.left = `${x}px`; t.style.top = `${y}px`; };
  root.querySelectorAll('svg.chart').forEach(svgEl => {
    svgEl.addEventListener('pointerover', e => { const g = e.target.closest('[data-tip]'); if (!g) return;
      t.className = 'tip chart-tip'; t.innerHTML = TIPS[+g.dataset.tip]; t.hidden = false; place(e);
      svgEl.classList.add('focus'); svgEl.querySelectorAll('.hot').forEach(x => x.classList.remove('hot')); g.classList.add('hot'); });
    svgEl.addEventListener('pointermove', e => { if (!t.hidden) place(e); });
    svgEl.addEventListener('pointerleave', () => { t.hidden = true; svgEl.classList.remove('focus'); svgEl.querySelectorAll('.hot').forEach(x => x.classList.remove('hot')); });
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

let pickProgress = 'both';
const modelCls = m => (m === 'gpt-6.1-sol' ? 'c-hi' : m === 'opus-5.5' ? 'c-s1' : 'c-s3');
function chartProgress(F, box) {
  setText('f-progress', 'Every run, step by step', 'Each line is one run of a job.', 'A line rises when an arm finishes a step, such as one cube placed. A circle ends a finished job, a cross one that ran out of time or was given up. Point at a line to see the run; click it to watch.');
  box.innerHTML = '';
  const top = el('div', 'chart-bar');
  const seg = el('div', 'seg');
  [['both', 'Both'], ['gpt-6.1-sol', 'gpt-6.1-sol'], ['opus-5.5', 'opus-5.5']].forEach(([k, n]) => { const b = el('button', '', n); b.type = 'button'; b.setAttribute('aria-pressed', k === pickProgress); b.onclick = () => { pickProgress = k; chartProgress(F, box); }; seg.append(b); });
  top.append(seg, el('div', 'keyrow', ['gpt-6.1-sol', 'opus-5.5'].filter(m => pickProgress === 'both' || pickProgress === m).map(m => `<span><i class="k-line" style="--c:var(--${m === 'gpt-6.1-sol' ? 'hi' : 's1'})"></i>${m}</span>`).join('')));
  const grid = el('div', 'small-multiples'), info = el('p', 'src', 'Both with the adaptive agent system. Point at a line for its run.');
  box.append(top, grid, info);
  const cols = box.clientWidth >= 1060 ? 4 : box.clientWidth >= 520 ? 2 : 1, W = Math.floor((box.clientWidth - 16 * (cols - 1)) / cols), H = Math.round(Math.min(230, W * 0.72)), L = 34, R = 10, T = 10, B = 24;
  TYPES.forEach(([type, typeName]) => {
    const runs = F.timelines.filter(r => typeOf(r.task) === type && (pickProgress === 'both' || r.set === pickProgress));
    const most = Math.max(...F.timelines.filter(r => typeOf(r.task) === type).map(r => r.steps), 1);
    const X = h => L + Math.min(h, 24) / 24 * (W - L - R), Y = v => T + (1 - v / most) * (H - T - B);
    let g = '';
    [0, 6, 12, 18, 24].forEach(h => { g += `<line class="grid" x1="${X(h)}" x2="${X(h)}" y1="${T}" y2="${H - B}"/>` + txt(X(h), H - B + 16, h + ' h', '', 'middle'); });
    g += txt(L - 6, Y(most) + 4, most, '', 'end') + txt(L - 6, Y(0) + 4, 0, '', 'end');
    // gpt-6.1-sol last, so its violet lines sit on top
    runs.slice().sort((a, b) => (a.set === 'gpt-6.1-sol') - (b.set === 'gpt-6.1-sol')).forEach(r => {
      let d = `M${X(0).toFixed(1)} ${Y(0).toFixed(1)}`;
      r.points.forEach(([h, v]) => { d += `H${X(h).toFixed(1)}V${Y(v).toFixed(1)}`; });
      const ex = X(r.hours), ey = Y(r.steps), c = modelCls(r.set);
      const end = r.done ? `<circle cx="${ex}" cy="${ey}" r="3.2" class="${c} hollow" stroke-width="1.5"/>` : `<path d="M${ex - 3} ${ey - 3}l6 6m0-6l-6 6" class="${c}" stroke-width="1.5" style="fill:none"/>`;
      g += `<g data-i="${F.timelines.indexOf(r)}"><path d="${d}" class="line ${c}" style="fill:none"/>${end}<path d="${d}" class="hit"/></g>`;
    });
    const fig = el('div', `t-${type}`); fig.innerHTML = `<p class="mini-head"><i></i>${typeName}<span>steps done, 0 to ${most}</span></p>` + svg(W, H, g, `${typeName}: progress of each run`);
    const s = fig.querySelector('svg');
    s.addEventListener('pointerover', e => { const gEl = e.target.closest('g[data-i]'); if (!gEl) return; const r = F.timelines[+gEl.dataset.i];
      s.classList.add('dimmed'); gEl.querySelector('.line').classList.add('hot');
      info.innerHTML = `<b>${nice(r.task)}</b> · ${teamName(r.set)} · ${r.steps} steps in ${fmtHours(r.hours)} · ${statusWord(r.done).toLowerCase()} · click to watch`; });
    s.addEventListener('pointerout', e => { const gEl = e.target.closest('g[data-i]'); if (gEl) gEl.querySelector('.line').classList.remove('hot'); s.classList.remove('dimmed'); });
    s.addEventListener('click', e => { const gEl = e.target.closest('g[data-i]'); if (!gEl) return; const r = F.timelines[+gEl.dataset.i]; if (run(r.set, r.task)) openRun(r.set, r.task); });
    grid.append(fig);
  });
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
}

function chartVision(F, box) {
  const v0 = F.vision;
  setText('f-vision', 'Vision', 'Seeing is the hard part.', `Told where every object is, the same AI finishes all ${v0[0].completed} jobs. From cameras it finishes ${v0[1].completed}. With blurred pictures or without its own code, it falls to about a third. Drag across the picture to see what 128 × 80 pixels leave.`, [`${v0[0].completed} → ${v0[1].completed}`, 'jobs, when the AI must find objects itself']);
  const W = widthOf(box), rowH = 46, H = v0.length * rowH + 18, BW = W - 96;
  let g = txt(W, 12, 'Grasps that fail', '', 'end');
  v0.forEach((v, i) => {
    const y = 22 + i * rowH, bw = Math.max(4, (BW - 40) * v.completed / 36);
    const why = { oracle: 'Gets the true position of every object instead of pictures.', adaptive: 'Sharp camera pictures, and it may write its own code.', 'low-resolution': 'Every picture shrunk to 128 × 80 pixels.', 'robot-tool-only': 'Sharp pictures, but no code: only the robot tool.' }[v.key] || '';
    g += `<g class="bar-row pt" ${tipAt(tipLines(v.label, [['Jobs finished', `${v.completed} of 36`], ['Grasps that fail', pct(v.grasp_fail)]], `<div class="tl"><span>${why}</span><span></span></div>`))}><rect x="0" y="${y - 8}" width="${W}" height="${rowH - 6}" style="fill:transparent"/>` +
      txt(0, y + 4, v.label, v.key === 'oracle' ? '' : 'ink') + `<rect x="0" y="${y + 12}" width="${BW - 40}" height="10" rx="2" class="track"/><rect x="0" y="${y + 12}" width="${bw}" height="10" rx="2" class="${v.key === 'oracle' ? 'c-soft' : v.key === 'adaptive' ? 'c-hi' : 'c-s2'}"/>` +
      txt(bw + 8, y + 21, v.completed, v.key === 'adaptive' ? 'lab' : 'num') + txt(W, y + 21, pct(v.grasp_fail), 'num', 'end') + '</g>';
  });
  const base = mediaUrl(MEDIA + 'findings/');
  box.innerHTML = svg(W, H, g, 'Tasks completed out of 36 under four vision conditions'); bindTips(box);
  const cmp = el('div', 'compare', `<img src="${base}camera-full.webp" alt="A Transport camera picture at 1280 by 800 pixels" loading="lazy"><img class="low" src="${base}camera-128x80.png" alt="The same picture at 128 by 80 pixels" loading="lazy"><i class="bar"></i><span class="l">1280 × 800</span><span class="r">128 × 80</span>`);
  const move = e => { const r = cmp.getBoundingClientRect(); cmp.style.setProperty('--cut', `${Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100))}%`); };
  cmp.addEventListener('pointerdown', e => { cmp.setPointerCapture(e.pointerId); move(e); }); cmp.addEventListener('pointermove', e => { if (e.buttons) move(e); });
  box.append(cmp, el('p', 'src', `At 128 × 80 one pixel covers about ${F.vision_facts.pixel_mm} mm, more than twice the ${F.vision_facts.tolerance_mm} mm an agent has for placing a cube. In ${F.vision_facts.runs_with_measuring_code} of its 36 runs, gpt-6.1-sol writes its own code to measure positions in pictures.`));
}

let sortTime = 'model';
function chartTime(F, box) {
  const t = F.timeline_facts;
  setText('f-time', 'Where the time goes', 'The arms mostly wait.', 'The world never pauses, but the arms spend most of it standing still while the agents think. Faster decisions would shorten jobs more than faster motion would.', [`${t.thinking_pct}% vs ${t.arms_moving_pct}%`, 'of one run: an agent thinking, an arm moving']);
  const rows = F.time_shares.rows.slice(); if (sortTime === 'think') rows.sort((a, b) => b[1] - a[1]);
  const W = widthOf(box), rowH = 30, H = rows.length * rowH, L = Math.min(150, W * 0.34), BW = W - L - 4; let g = '';
  rows.forEach(([name, th, rb, cd], i) => {
    const y = i * rowH + 6; let x = L;
    const tipHtml = tipLines(name, [['Thinking', `${fmt1(th)}%`], ['Robot tool', `${fmt1(rb)}%`], ['Own code', `${fmt1(cd)}%`]]);
    g += `<g class="pt" data-model="${name}" ${tipAt(tipHtml)}><rect x="0" y="${y - 4}" width="${W}" height="${rowH}" style="fill:transparent"/>` + txt(L - 10, y + 14, name, name === 'gpt-6.1-sol' || name === 'opus-5.5' ? 'ink' : 'ink2', 'end');
    [[th, 'c-hi', 'on-dark'], [rb, 'c-s1', 'on-dark'], [cd, 'c-s3', 'on-light']].forEach(([v, c, tc]) => { const w = BW * v / 100; g += `<rect x="${x}" y="${y + 2}" width="${Math.max(w - 2, 0)}" height="16" class="${c}" rx="2"/>`; if (w > 36) g += txt(x + 6, y + 14, Math.round(v) + '%', tc); x += w; });
    g += '</g>';
  });
  box.innerHTML = '';
  const top = el('div', 'chart-bar'), seg = el('div', 'seg');
  [['model', 'Strongest first'], ['think', 'Most thinking first']].forEach(([k, n]) => { const b = el('button', '', n); b.type = 'button'; b.setAttribute('aria-pressed', k === sortTime); b.onclick = () => { sortTime = k; chartTime(F, box); }; seg.append(b); });
  top.append(el('div', 'keyrow', '<span><i class="k-think"></i>Thinking</span><span><i class="k-robot"></i>Robot tool</span><span><i class="k-code"></i>Own code</span>'), seg);
  box.append(top);
  box.insertAdjacentHTML('beforeend', svg(W, H, g, 'Share of agent time spent thinking, using the robot tool and running code, per model') +
    `<p class="src">Share of agent time with the adaptive system. opus-5.5 thinks least and computes most.</p>`);
  bindTips(box);
}

const SYS_ICON = {
  'single-agent': '<circle cx="60" cy="16" r="9" class="c-s1"/><path d="M60 25 L18 62 M60 25 L39 62 M60 25 L60 62 M60 25 L81 62 M60 25 L102 62" class="axis"/>',
  hierarchical: '<circle cx="60" cy="14" r="8" class="c-s1"/>' + [18, 39, 60, 81, 102].map(x => `<path d="M60 22 L${x} 40" class="axis"/><circle cx="${x}" cy="44" r="5" class="c-s2"/><path d="M${x} 49 L${x} 60" class="axis"/>`).join(''),
  decentralized: [18, 39, 60, 81, 102].map(x => `<circle cx="${x}" cy="40" r="5" class="c-s2"/><path d="M${x} 45 L${x} 60" class="axis"/>`).join('') + '<path d="M23 40 H34 M44 40 H55 M65 40 H76 M86 40 H97 M18 34 Q60 4 102 34" class="axis" style="fill:none"/>',
  adaptive: '<circle cx="60" cy="14" r="8" class="c-s1"/><path d="M60 22 L33 38 M60 22 L87 38 M60 22 L60 60" class="axis"/><circle cx="33" cy="42" r="5" class="c-s2"/><circle cx="87" cy="42" r="5" class="c-s2"/><path d="M33 47 L18 60 M33 47 L39 60 M87 47 L81 60 M87 47 L102 60" class="axis"/>',
};
function chartSystems(F, box) {
  const sp = F.spend, s6 = F.systems.slice(0, 3).map(x => x.within_6h);
  setText('f-systems', 'Team design', 'More agents: faster, but more tokens.', `How the team is organized barely changes how many jobs get done (27 to 29), but it trades time for cost. Within 6 hours the three multi-agent systems finish ${Math.min(...s6)} or ${Math.max(...s6)} jobs, the single agent ${F.systems[3].within_6h}. Spending alone does not buy success: ${sp[1].set} used ${fmt1(sp[1].input_tokens_b)} billion tokens and ${Math.round(sp[1].total_hours)} hours for ${sp[1].completed} job.`, ['1.6×', 'as long for a single agent; up to 1.9× the tokens with an agent per arm']);
  const W = widthOf(box), H = 230, L = 46, R = 16, T = 18, B = 40, xm = 60, ym = 450;
  const X = v => L + v / xm * (W - L - R), Y = v => T + (1 - v / ym) * (H - T - B); let g = '';
  [0, 20, 40, 60].forEach(v => { g += `<line class="grid" x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${H - B}"/>` + txt(X(v), H - B + 16, v + ' B', '', 'middle'); });
  [0, 150, 300, 450].forEach(v => { g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/>` + txt(L - 6, Y(v) + 4, v + ' h', '', 'end'); });
  g += txt(W - R, H - 4, 'Input tokens, all 36 jobs →', '', 'end');
  const off = { adaptive: [-14, 4, 'end'], hierarchical: [0, -13, 'middle'], decentralized: [-12, 18, 'end'], 'single-agent': [12, 4, 'start'] };
  F.systems.forEach(s => {
    const cx = X(s.input_tokens_b), cy = Y(s.total_hours), ours = s.key === 'adaptive';
    const [dx, dy, an] = off[s.key];
    g += `<g class="pt" data-sys="${s.key}" ${tipAt(tipLines(s.label, [['Jobs finished', `${s.completed} of 36`], ['Finished within 6 hours', s.within_6h], ['Hours, all 36 jobs', fmt1(s.total_hours)], ['Input tokens, all jobs', `${fmt1(s.input_tokens_b)} billion`], ['Messages, typical job', s.median_messages]]))}>` +
      (ours ? `<circle cx="${cx}" cy="${cy}" r="10" class="c-hi" stroke-width="1.5" style="fill:none"/>` : '') +
      `<circle cx="${cx}" cy="${cy}" r="${ours ? 5.5 : 5}" class="${ours ? 'c-hi' : 'c-s2'}"/><circle cx="${cx}" cy="${cy}" r="16" style="fill:transparent"/>` + txt(cx + dx, cy + dy, `${s.label} · ${s.completed} done`, ours ? 'lab' : 'num', an) + '</g>';
  });
  const sys = { 'single-agent': ['Single agent', 'One agent drives every arm'], hierarchical: ['Hierarchical', 'A controller and one worker per arm'], decentralized: ['Decentralized', 'One worker per arm, no controller'], adaptive: ['Adaptive', 'A controller that creates helpers when work can be shared'] };
  box.innerHTML = `<div class="sys">${Object.entries(sys).map(([k, [n, d]]) => `<div data-sys="${k}" class="${k === 'adaptive' ? 'on' : ''}"><svg viewBox="0 0 120 66" class="chart" aria-hidden="true">${SYS_ICON[k]}</svg><b>${n}</b><span>${d}</span></div>`).join('')}</div>` +
    `<p class="panel-cap">Hours against input tokens, all 36 jobs</p>` + svg(W, H, g, 'Total hours against total input tokens for the four agent systems of gpt-6.1-sol') + `<p class="src">gpt-6.1-sol on all 36 jobs. Point at a card or a point for details; the ring marks the adaptive system, used everywhere else on this page.</p>`;
  bindTips(box);
  // A card and its point light up together.
  const chart = box.querySelector('svg.chart[role="img"]');
  const light = key => { box.querySelectorAll('[data-sys]').forEach(x => x.classList.toggle('hot', x.dataset.sys === key)); chart.classList.toggle('focus', !!key); };
  box.querySelectorAll('.sys [data-sys]').forEach(c => { c.addEventListener('pointerenter', () => light(c.dataset.sys)); c.addEventListener('pointerleave', () => light(null)); });
  chart.addEventListener('pointerover', e => { const p = e.target.closest('[data-sys]'); if (p) box.querySelectorAll('.sys [data-sys]').forEach(x => x.classList.toggle('hot', x.dataset.sys === p.dataset.sys)); });
  chart.addEventListener('pointerleave', () => box.querySelectorAll('.sys .hot').forEach(x => x.classList.remove('hot')));
}

function chartFailure(F, box) {
  const f = F.failure_by_type;
  setText('f-failure', 'Steps that fail', 'Failing and retrying is normal.', 'A grasp slips, a handover misses, and the agents notice from the pictures and try again. In the median Relay job every handover fails at least once, yet 8 of the 9 Relay jobs are finished. The four weaker models rarely recover.', ['100%', 'of handovers fail at least once in a typical Relay job']);
  const W = widthOf(box), rowH = 28, L = 96, BW = W - L - 48; let g = '';
  const steps = { relay: `about ${f.median_steps_note.relay} steps in a typical job`, mosaic: `about ${f.median_steps_note.mosaic} steps in a typical job` };
  TYPES.forEach(([type, name], i) => { const v = f.median_atomic_failure_pct[type], y = i * rowH + 4, w = BW * v / 100;
    g += `<g class="bar-row pt" ${tipAt(tipLines(name, [['Steps that fail at least once', `${v}%`]], steps[type] ? `<div class="tl"><span>${cap(steps[type])}</span><span></span></div>` : ''))}><rect x="0" y="${y - 4}" width="${W}" height="${rowH}" style="fill:transparent"/>` +
      txt(L - 10, y + 13, name, 'ink', 'end') + `<rect x="${L}" y="${y + 3}" width="${BW}" height="12" rx="2" class="track"/><rect x="${L}" y="${y + 3}" width="${w}" height="12" rx="2" class="c-${type}"/>` + txt(L + w + 8, y + 13, v + '%', 'num') + '</g>'; });
  const LB = Math.min(160, W * 0.36), BW2 = W - LB - 52, H2 = F.grasp_failure.length * 24 + 4; let g2 = '';
  F.grasp_failure.forEach(([m, v], i) => { const y = 4 + i * 24, w = BW2 * v / 100;
    g2 += `<g class="bar-row pt" data-model="${m}" ${tipAt(tipLines(m, [['Grasps that fail', `${fmt1(v)}%`], ['Jobs finished', D.outcomes && D.outcomes[m] ? `${D.tasks.filter(t => done(m, t)).length} of 36` : '–']]))}><rect x="0" y="${y - 4}" width="${W}" height="24" style="fill:transparent"/>` +
      txt(LB - 10, y + 11, m, i < 2 ? 'ink' : 'ink2', 'end') + `<rect x="${LB}" y="${y + 2}" width="${w}" height="10" rx="2" class="${modelCls(m)}"/>` + txt(LB + w + 6, y + 11, Math.round(v) + '%', 'num') + '</g>'; });
  box.innerHTML = `<p class="panel-cap">Steps that fail at least once, median job, gpt-6.1-sol</p>` + svg(W, 4 * rowH + 4, g, 'Median share of steps that fail at least once, by task type') +
    `<p class="panel-cap">Grasps that fail, by model</p>` + svg(W, H2, g2, 'Share of grasps that fail, per model') +
    `<p class="src">A Relay job has about ${f.median_steps_note.relay} steps, a Mosaic job about ${f.median_steps_note.mosaic}. Point at a bar for details.</p>`;
  bindTips(box);
}

function chartLevels(F, box) {
  const lv = F.levels;
  setText('f-levels', 'Team size and level', 'Bigger teams are harder than harder jobs.', 'For gpt-6.1-sol, adding arms costs more than making the job harder. It finishes about the same share at every level, but fewer jobs as the team grows, because more arms must share the space and the work.', [`${lv.by_size[0]} → ${lv.by_size[2]}`, `of ${lv.of} jobs, from small to large teams`]);
  const two = box.clientWidth >= 400, W = two ? Math.floor((box.clientWidth - 28) / 2) : widthOf(box), H = 190, T = 34, B = 28;
  const jobsOf = (kind, i) => D.tasks.filter(t => (kind === 'level' ? t.endsWith(`-l${i + 1}`) : t.split('-')[1] === SIZES[i]));
  const minis = list => `<div class="minis">${list.map(t => `<i class="t-${typeOf(t)}${done(lv.set, t) ? ' done' : ''}" title="${nice(t)}"></i>`).join('')}</div>`;
  const group = (title, labels, vals, cls, kind) => {
    const bw = Math.min(40, (W - 40) / 3 - 24), gap = (W - 3 * bw) / 4; let g = '';
    vals.forEach((v, i) => { const x = gap + i * (bw + gap), h = (H - T - B) * v / lv.of, y = H - B - h, list = jobsOf(kind, i);
      const tipHtml = tipLines(labels[i], [['Jobs finished', `${v} of ${lv.of}`]], D.outcomes ? `${minis(list)}<div class="tl"><span>Filled: finished, by gpt-6.1-sol</span><span></span></div>` : '');
      g += `<g class="pt" ${tipAt(tipHtml)}><rect x="${x - 14}" y="${T - 4}" width="${bw + 28}" height="${H - T - B + 26}" style="fill:transparent"/><line class="axis" x1="${x - 6}" x2="${x + bw + 6}" y1="${T}" y2="${T}" stroke-dasharray="2 3"/><rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="2" class="${cls}"/>` + txt(x + bw / 2, y - 7, `${v}`, cls === 'c-hi' ? 'lab' : 'num', 'middle') + txt(x + bw / 2, H - B + 17, labels[i], 'ink2', 'middle') + '</g>'; });
    g += `<line class="axis" x1="0" x2="${W}" y1="${H - B}" y2="${H - B}"/>`;
    return `<figure class="level-fig"><figcaption class="panel-cap">${title}</figcaption>${svg(W, H, g, `${title}: ${vals.join(', ')} of ${lv.of}`)}</figure>`; };
  box.innerHTML = `<div class="levels" style="grid-template-columns:repeat(${two ? 2 : 1}, minmax(0, 1fr))">${group('By level, 12 jobs each', ['Level 1', 'Level 2', 'Level 3'], lv.by_level, 'c-s2', 'level')}${group('By team size, 12 jobs each', ['Small', 'Medium', 'Large'], lv.by_size, 'c-hi', 'size')}</div><p class="src">Jobs finished out of 12; the dashed line is all 12. Point at a bar to see its twelve jobs.</p>`;
  bindTips(box);
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
  chrome(); reveal(); playerControls(); nine(); modelHover();
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
