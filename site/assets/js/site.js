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

/* ---------- theme and section links ---------- */
function chrome() {
  const root = document.documentElement, button = $('theme');
  const sync = () => { const dark = root.dataset.theme === 'dark'; button.setAttribute('aria-pressed', dark); button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); };
  button.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('roboteam-theme', root.dataset.theme); } catch { /* storage may be blocked */ }
    sync();
  });
  sync();
  const links = [...document.querySelectorAll('#nav a')];
  const sections = links.map(a => document.querySelector(a.getAttribute('href')));
  const spy = () => {
    let current = -1;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top < 140) current = i; });
    links.forEach((a, i) => a.classList.toggle('on', i === current));
  };
  addEventListener('scroll', spy, { passive: true }); spy();
  document.querySelectorAll('.copy').forEach(b => b.addEventListener('click', async () => {
    const text = $(b.dataset.copy).textContent;
    try { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; } catch { getSelection().selectAllChildren($(b.dataset.copy)); }
    setTimeout(() => { b.textContent = 'Copy'; }, 1600);
  }));
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
  who.title = 'Show these videos'; who.addEventListener('click', () => { F.team = set; F.status = 'all'; F.job = 'all'; library(); $('videos').scrollIntoView(); });
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

/* ---------- start ---------- */
async function load(url) { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); }

async function start() {
  chrome(); playerControls();
  const [tasks, media] = await Promise.all([load('data/tasks.json'), load('data/media.json')]);
  D.media = media; D.sets = media.sets.map(s => s.key);
  D.tasks = TYPES.flatMap(([type]) => SIZES.flatMap(size => [1, 2, 3].map(level => `${type}-${size}-l${level}`)));
  tasks.tasks.forEach(t => { D.facts[t.id] = t; });
  media.sets.forEach(s => { D.runs[s.key] = s.runs; });
  film(); clips(); board(); library();
  try {
    const results = await load(RESULTS_URL);
    D.outcomes = results.outcomes; numbers(results); board(); library();
  } catch { /* the board and the library stay without results */ }
  // #task=<task>[&set=<set>] opens one run; the task guide's gallery links here.
  const link = new URLSearchParams(location.hash.slice(1)), task = link.get('task'), set = link.get('set') || D.sets[0];
  if (task && D.runs[set] && run(set, task)) openRun(set, task);
}

start();
