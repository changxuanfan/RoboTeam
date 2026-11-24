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


/* ---------- charts: what is new and what we learned ---------- */
const FINDINGS_URL = mediaUrl(MEDIA + 'findings.json');
const NS = 'http://www.w3.org/2000/svg';
const svg = (w, h, body, label) => `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${body}</svg>`;
const txt = (x, y, s, cls = '', anchor = 'start', extra = '') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}" ${extra}>${s}</text>`;
const fmt1 = n => (Math.round(n * 10) / 10).toString();

function chartCompare(F) {
  const W = 640, H = 380, L = 46, R = 24, T = 18, B = 44;
  const lx = m => Math.log10(m), x0 = lx(0.06), x1 = lx(2400);
  const X = m => L + (lx(m) - x0) / (x1 - x0) * (W - L - R), Y = a => T + (1 - a / 17) * (H - T - B);
  let g = '';
  [[0.1, '6 s'], [1, '1 min'], [10, '10 min'], [60, '1 h'], [240, '4 h'], [1440, '24 h']].forEach(([m, l]) => { g += `<line class="grid" x1="${X(m)}" x2="${X(m)}" y1="${T}" y2="${H - B}"/>` + txt(X(m), H - B + 18, l, '', 'middle'); });
  [0, 4, 8, 12, 16].forEach(a => { g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(a)}" y2="${Y(a)}"/>` + txt(L - 8, Y(a) + 4, a, '', 'end'); });
  g += txt(L - 8, T - 4, 'ARMS', '', 'end') + txt(W - R, H - 6, 'HOW LONG A RUN LASTS →', '', 'end');
  const place = { ReflexBench: [0, -13, 'middle'], EmbodiedBench: [-7, 17, 'end'], VLABench: [7, 17, 'start'], RoboTwin: [10, 4, 'start'], RoboFactory: [0, -13, 'middle'], RoCoBench: [0, -13, 'middle'],
    RobotWorld: [-9, 17, 'end'], RoboColiseum: [0, -13, 'middle'], PARTNR: [9, 17, 'start'], 'Embodied First Exam': [0, 20, 'middle'], RoboTeam: [-16, 5, 'end'] };
  const nudge = { EmbodiedBench: 0.86, VLABench: 1.16 };
  F.benchmarks.rows.forEach(([name, arms, , real, vision, minutes, , group]) => {
    const cx = X(minutes * (nudge[name] || 1)), cy = Y(arms), ours = group === 'ours', r = ours ? 8 : 5.5;
    const cls = ours ? 'c-ink' : group === 'agent' ? 'c-dim' : 'c-line';
    if (real !== 'no') g += `<circle cx="${cx}" cy="${cy}" r="${r + 5}" class="${cls}" fill="none" stroke-width="1.6" ${real === 'partly' ? 'stroke-dasharray="2 3"' : ''} style="fill:none"/>`;
    g += `<circle cx="${cx}" cy="${cy}" r="${r}" class="${cls}${vision === 'yes' ? '' : ' hollow'}" stroke-width="2"/>`;
    const [dx, dy, an] = place[name] || [8, 4, 'start'];
    g += txt(cx + dx, cy + dy, name, ours ? 'big' : 'ink2', an, ours ? 'style="font-size:17px"' : '');
  });
  const box = $('chart-compare');
  box.insertAdjacentHTML('beforeend', '<div class="scroll-x">' + svg(W, H, g, 'Benchmarks by number of arms and run length; RoboTeam is the only one with 16 arms and runs of up to 24 hours') + '</div>' +
    `<div class="keyrow"><span>● cameras only</span><span>○ given object positions, fully or partly</span><span>◎ the world never pauses</span><span><i style="--c:var(--dim)"></i>AI agents</span><span><i style="--c:var(--line2)"></i>trained policies</span></div>` +
    `<p class="src">From the paper's comparison table. ${F.benchmarks.left_out}</p>`);
}

function panelHead(box, title, say, cap) { box.innerHTML = `<figcaption class="panel-cap">${cap}</figcaption><h3>${title}</h3>${say ? `<p class="say">${say}</p>` : ''}`; }

function chartProgress(F) {
  const box = $('f-progress');
  panelHead(box, 'Every run, step by step.', 'Each line is one run. It rises when an arm finishes a step, such as one cube placed. A circle ends a finished job, a cross one that ran out of time or was given up. Point at a line to see the run; click to watch it.', 'Progress over time');
  const seg = el('div', 'seg'); const keyed = { both: 'Both', 'gpt-6.1-sol': 'gpt-6.1-sol', 'opus-5.5': 'opus-5.5' };
  let pick = 'both';
  Object.entries(keyed).forEach(([k, n]) => { const b = el('button', '', n); b.type = 'button'; b.setAttribute('aria-pressed', k === pick); b.onclick = () => { pick = k; seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); }; seg.append(b); });
  const grid = el('div', 'small-multiples');
  const info = el('p', 'src', '&nbsp;');
  box.append(seg, grid, info);
  const W = 300, H = 210, L = 34, R = 8, T = 10, B = 26;
  function draw() {
    grid.innerHTML = '';
    TYPES.forEach(([type, typeName]) => {
      const runs = F.timelines.filter(r => typeOf(r.task) === type && (pick === 'both' || r.set === pick));
      const top = Math.max(...F.timelines.filter(r => typeOf(r.task) === type).map(r => r.steps), 1);
      const X = h => L + Math.min(h, 24) / 24 * (W - L - R), Y = v => T + (1 - v / top) * (H - T - B);
      let g = '';
      [0, 6, 12, 18, 24].forEach(h => { g += `<line class="grid" x1="${X(h)}" x2="${X(h)}" y1="${T}" y2="${H - B}"/>` + txt(X(h), H - B + 15, h + ' h', '', 'middle'); });
      g += txt(L - 6, Y(top) + 4, top, '', 'end') + txt(L - 6, Y(0) + 4, 0, '', 'end');
      runs.forEach((r, i) => {
        let d = `M${X(0)} ${Y(0)}`; let last = 0;
        r.points.forEach(([h, v]) => { d += `H${X(h).toFixed(1)}V${Y(v).toFixed(1)}`; last = h; });
        const ex = X(r.hours), ey = Y(r.steps);
        const end = r.done ? `<circle cx="${ex}" cy="${ey}" r="3.4" class="c-${type} hollow" stroke-width="1.6"/>` : `<path d="M${ex - 3.5} ${ey - 3.5}l7 7m0-7l-7 7" class="c-${type}" stroke-width="1.6" fill="none"/>`;
        g += `<g data-i="${F.timelines.indexOf(r)}"><path d="${d}" class="line c-${type}" style="fill:none;${r.set === 'opus-5.5' && pick === 'both' ? 'stroke-dasharray:4 2' : ''}"/>${end}<path d="${d}" class="hit"/></g>`;
      });
      const fig = el('div'); fig.innerHTML = `<div class="keyrow" style="margin-bottom:4px"><span><i style="--c:var(--${type})"></i>${typeName}</span><span>steps, 0 to ${top}</span></div>` + svg(W, H, g, `${typeName}: progress of each run`);
      const s = fig.querySelector('svg');
      s.addEventListener('pointerover', e => { const gEl = e.target.closest('g[data-i]'); if (!gEl) return; const r = F.timelines[+gEl.dataset.i];
        s.classList.add('dimmed'); gEl.querySelector('.line').classList.add('hot');
        info.innerHTML = `<b>${nice(r.task)}</b> · ${teamName(r.set)} · ${r.steps} steps in ${fmt1(r.hours)} h · ${r.done ? 'finished' : 'not finished'}`; });
      s.addEventListener('pointerout', e => { const gEl = e.target.closest('g[data-i]'); if (gEl) gEl.querySelector('.line').classList.remove('hot'); s.classList.remove('dimmed'); });
      s.addEventListener('click', e => { const gEl = e.target.closest('g[data-i]'); if (!gEl) return; const r = F.timelines[+gEl.dataset.i]; if (run(r.set, r.task)) openRun(r.set, r.task); });
      grid.append(fig);
    });
    if (pick === 'both') info.innerHTML = 'Solid lines: gpt-6.1-sol. Dashed lines: opus-5.5. Both with the adaptive agent system.';
  }
  draw();
}

function chartVision(F) {
  const box = $('f-vision');
  panelHead(box, 'Seeing is the hard part.', `Told where every object is, the same AI finishes all 36 jobs. From cameras it finishes 28. Blur the pictures or take away its code, and it falls to about a third.`, 'Vision');
  const W = 460, rowH = 40, L = 0, H = F.vision.length * rowH + 22; let g = txt(W, 12, 'GRASPS THAT FAIL', '', 'end');
  F.vision.forEach((v, i) => {
    const y = 24 + i * rowH, bw = 300 * v.completed / 36;
    g += txt(L, y + 2, v.label, 'ink2') + `<rect x="${L}" y="${y + 8}" width="300" height="12" rx="6" class="track"/><rect x="${L}" y="${y + 8}" width="${bw}" height="12" rx="6" class="${i === 0 ? 'c-dim' : 'c-ink'}"/>` +
      txt(L + bw + 8, y + 19, v.completed, 'lab') + txt(W, y + 19, fmt1(v.grasp_fail) + '%', 'ink', 'end');
  });
  box.insertAdjacentHTML('beforeend', svg(W, H, g, 'Tasks completed out of 36 under four vision conditions'));
  const base = mediaUrl(MEDIA + 'findings/');
  const cmp = el('div', 'compare', `<img src="${base}camera-full.webp" alt="A Transport camera picture at 1280 by 800 pixels" loading="lazy"><img class="low" src="${base}camera-128x80.png" alt="The same picture at 128 by 80 pixels" loading="lazy"><i class="bar"></i><span class="l">1280 × 800</span><span class="r">128 × 80</span>`);
  const move = e => { const r = cmp.getBoundingClientRect(); cmp.style.setProperty('--cut', `${Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100))}%`); };
  cmp.addEventListener('pointerdown', e => { cmp.setPointerCapture(e.pointerId); move(e); }); cmp.addEventListener('pointermove', e => { if (e.buttons) move(e); });
  box.append(cmp, el('p', 'src', `Drag across the picture. At 128 × 80 one pixel covers about ${F.vision_facts.pixel_mm} mm, more than twice the ${F.vision_facts.tolerance_mm} mm an agent has for placing a cube. In ${F.vision_facts.runs_with_measuring_code} of its 36 runs, gpt-6.1-sol writes its own code to measure positions in pictures.`));
}

function chartTime(F) {
  const box = $('f-time');
  panelHead(box, 'The arms mostly wait.', 'The world never pauses, but the arms spend most of it standing still while the agents think. Faster decisions would shorten jobs more than faster motion.', 'Where the time goes');
  const t = F.timeline_facts;
  box.insertAdjacentHTML('beforeend', `<div class="facts2"><div class="fact"><b>${t.thinking_pct}%</b><span>of one run, at least one agent is thinking</span><div class="meter"><i style="width:${t.thinking_pct}%"></i></div></div><div class="fact t-transport"><b>${t.arms_moving_pct}%</b><span>of the same run, at least one arm is moving</span><div class="meter"><i style="width:${t.arms_moving_pct}%"></i></div></div></div>`);
  const W = 460, rowH = 30, H = F.time_shares.rows.length * rowH + 4, L = 140, BW = W - L - 6; let g = '';
  F.time_shares.rows.forEach(([name, th, rb, cd], i) => {
    const y = i * rowH + 6; let x = L;
    g += txt(L - 10, y + 13, name, i < 2 ? 'ink' : 'ink2', 'end');
    [[th, 'c-ink'], [rb, 'c-transport'], [cd, 'c-mosaic']].forEach(([v, c]) => { const w = BW * v / 100; g += `<rect x="${x}" y="${y}" width="${Math.max(w - 1.5, 0)}" height="18" class="${c}" rx="3"/>`; if (w > 30) g += txt(x + 6, y + 13, Math.round(v) + '%', '', 'start', 'style="fill:#fff"'); x += w; });
  });
  box.insertAdjacentHTML('beforeend', `<div class="keyrow"><span><i class="k-think"></i>thinking</span><span><i class="k-robot"></i>robot tool</span><span><i class="k-code"></i>own code</span></div>` + svg(W, H, g, 'Share of agent time spent thinking, using the robot tool and running code, per model') +
    `<p class="src">Share of agent time, adaptive system. opus-5.5 thinks least and computes most.</p>`);
}

function chartSystems(F) {
  const box = $('f-systems');
  panelHead(box, 'More agents: faster, but more tokens.', 'How the team is organized barely changes how many jobs get done (27 to 29), but it trades time for cost. Giving every arm its own agent is quick and expensive; one agent alone is cheap and slow.', 'Agent systems');
  const W = 460, H = 270, L = 46, R = 16, T = 14, B = 40, xm = 60, ym = 450;
  const X = v => L + v / xm * (W - L - R), Y = v => T + (1 - v / ym) * (H - T - B); let g = '';
  [0, 20, 40, 60].forEach(v => { g += `<line class="grid" x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${H - B}"/>` + txt(X(v), H - B + 16, v + ' B', '', 'middle'); });
  [0, 100, 200, 300, 400].forEach(v => { g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/>` + txt(L - 6, Y(v) + 4, v + ' h', '', 'end'); });
  g += txt(W - R, H - 4, 'INPUT TOKENS, ALL 36 TASKS →', '', 'end') + txt(L, T - 2, '↑ HOURS, ALL 36 TASKS');
  const off = { adaptive: [-16, 4, 'end'], hierarchical: [0, -14, 'middle'], decentralized: [-12, 18, 'end'], 'single-agent': [12, 4, 'start'] };
  F.systems.forEach(s => {
    const cx = X(s.input_tokens_b), cy = Y(s.total_hours);
    if (s.key === 'adaptive') g += `<circle cx="${cx}" cy="${cy}" r="11" class="c-ink" fill="none" stroke-width="1.6" style="fill:none"/>`;
    g += `<circle cx="${cx}" cy="${cy}" r="6" class="c-ink"/>`;
    const [dx, dy, an] = off[s.key]; g += txt(cx + dx, cy + dy, `${s.label} · ${s.completed} done`, 'lab', an);
  });
  const sp = F.spend;
  box.insertAdjacentHTML('beforeend', svg(W, H, g, 'Total hours against total input tokens for the four agent systems of gpt-6.1-sol') +
    `<p class="src">gpt-6.1-sol, all 36 tasks. Within 6 hours the three multi-agent systems finish ${Math.min(...F.systems.slice(0, 3).map(x => x.within_6h))} or ${Math.max(...F.systems.slice(0, 3).map(x => x.within_6h))} jobs, the single agent ${F.systems[3].within_6h}. Spending alone does not buy success: ${sp[1].set} used ${fmt1(sp[1].input_tokens_b)} billion tokens and ${Math.round(sp[1].total_hours)} hours for ${sp[1].completed} job.</p>`);
}

function chartFailure(F) {
  const box = $('f-failure'); const f = F.failure_by_type;
  panelHead(box, 'Failing and retrying is normal.', `A grasp slips, a handover misses, and the agents notice from the pictures and try again. In the median Relay job every handover fails at least once, yet ${8} of 9 Relay jobs are finished.`, 'Steps that fail at least once');
  const W = 460, rowH = 30, L = 90; let g = '';
  TYPES.forEach(([type, name], i) => { const v = f.median_atomic_failure_pct[type], y = i * rowH + 4, w = (W - L - 46) * v / 100;
    g += txt(L - 10, y + 13, name, 'ink', 'end') + `<rect x="${L}" y="${y}" width="${W - L - 46}" height="18" rx="4" class="track"/><rect x="${L}" y="${y}" width="${w}" height="18" rx="4" class="c-${type}"/>` + txt(L + w + 8, y + 13, v + '%', 'lab'); });
  box.insertAdjacentHTML('beforeend', svg(W, 4 * rowH + 4, g, 'Median share of steps that fail at least once, by task type, gpt-6.1-sol'));
  const H2 = F.grasp_failure.length * 24 + 26; let g2 = txt(0, 12, 'GRASPS THAT FAIL, BY MODEL');
  F.grasp_failure.forEach(([m, v], i) => { const y = 22 + i * 24, w = (W - 150 - 46) * v / 100;
    g2 += txt(140, y + 11, m, i < 2 ? 'ink' : 'ink2', 'end') + `<rect x="150" y="${y}" width="${w}" height="14" rx="3" class="${i < 2 ? 'c-ink' : 'c-dim'}"/>` + txt(150 + w + 6, y + 11, fmt1(v) + '%', 'ink2'); });
  box.insertAdjacentHTML('beforeend', svg(W, H2, g2, 'Share of grasps that fail, per model') + `<p class="src">Top: median over the tasks of each type, gpt-6.1-sol. A Relay job has about ${f.median_steps_note.relay} steps, a Mosaic job about ${f.median_steps_note.mosaic}.</p>`);
}

function chartLevels(F) {
  const box = $('f-levels'), lv = F.levels;
  panelHead(box, 'Bigger teams are harder than harder jobs.', 'For gpt-6.1-sol, adding arms costs more than making the job harder. It finishes about the same share at every level, but fewer jobs as the team grows, because more arms must share the space and the work.', 'Team size and level');
  const W = 300, H = 190, T = 40, B = 30; const group = (title, labels, vals, cls) => {
    let g = txt(0, 12, title); const bw = 56, gap = 34;
    vals.forEach((v, i) => { const x = 24 + i * (bw + gap), h = (H - T - B) * v / lv.of, y = H - B - h;
      g += `<line class="axis" x1="${x}" x2="${x + bw}" y1="${T}" y2="${T}" stroke-dasharray="3 3"/><rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="5" class="${cls}"/>` + txt(x + bw / 2, y - 7, `${v} of ${lv.of}`, 'lab', 'middle') + txt(x + bw / 2, H - B + 16, labels[i], 'ink2', 'middle'); });
    return svg(W, H, g, `${title}: ${vals.join(', ')} of ${lv.of}`); };
  const row = el('div', 'cards'); row.style.gridTemplateColumns = 'repeat(auto-fit,minmax(260px,1fr))';
  row.className = 'levels'; row.innerHTML = `<div>${group('BY LEVEL, 12 TASKS EACH', ['Level 1', 'Level 2', 'Level 3'], lv.by_level, 'c-dim')}</div><div>${group('BY TEAM SIZE, 12 TASKS EACH', ['Small', 'Medium', 'Large'], lv.by_size, 'c-ink')}</div>`;
  box.append(row);
}

async function findings() {
  try {
    const F = await load(FINDINGS_URL);
    chartCompare(F); chartProgress(F); chartVision(F); chartTime(F); chartSystems(F); chartFailure(F); chartLevels(F);
  } catch (e) { console.warn('findings', e); }
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
  film(); clips(); board(); library(); findings();
  try {
    const results = await load(RESULTS_URL);
    D.outcomes = results.outcomes; numbers(results); board(); library();
  } catch { /* the board and the library stay without results */ }
  // #task=<task>[&set=<set>] opens one run; the task guide's gallery links here.
  const link = new URLSearchParams(location.hash.slice(1)), task = link.get('task'), set = link.get('set') || D.sets[0];
  if (task && D.runs[set] && run(set, task)) openRun(set, task);
}

start();
