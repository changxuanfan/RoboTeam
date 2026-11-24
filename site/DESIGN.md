# RoboTeam project page: design

The project page is `site/index.html` with `assets/` and `data/`, deployed to GitHub Pages by
`.github/workflows/site.yml` on pushes to `main` that touch `site/`.

## Audience and promise

The page is a demo, not a paper. A visitor should see AI teams controlling many robot arms
within seconds, then be able to watch any run of any model, and read in plain words how the
benchmark works and what came out. It is written for readers outside computer science.

## Page structure

One long page. A sticky bar links to the sections and marks the one in view. Tabs and filters
appear only inside a section, where they switch between choices of the same thing.

| Section | Content | Data |
| --- | --- | --- |
| Hero | One sentence, links, and the film as a silent 30 s loop. A button opens the long film when `media.json` lists one | `media.json` |
| The four jobs | Per task type: a clip of one run at 300 times real time, which opens that run; what the job is, its team sizes and what the levels change | `media.json`, static text |
| How it works | See, decide, act, and the clock that never stops | static |
| Results | Three numbers, then the board: one row per model, one square per task, grouped by task type and team size. The Oracle is a reference card under the six models | results |
| All videos | Every run, grouped by team, with three filters: result (All, Complete, Incomplete), team and job | `media.json`, results |
| Get started | The first commands, the citation and links | static |

A square or a card opens the player: the run's three camera views on one clock. Any view can
be made the large one. The videos are ten times real time, and the speed buttons (10, 20, 50,
100 times) only change the playback rate. A row of buttons switches to another team's run of
the same task.

A run without a video is shown as a hatched square and listed as "Coming soon". No reason is
given on the page.

No result is written in the HTML. Until the results load, the board shows squares without
outcomes.

## Media

`data/media.json` (schema `roboteam.site-media-index.v2`) says where everything is:

- `sets`: one per video set, in page order. `base` is the set's published folder and `runs`
  gives each task's folder (`<task>-yes` or `<task>-no`) and length. A run's files are
  `front.mp4`, `side.mp4` and `top.mp4`. The videos are in the Hugging Face dataset
  `RoboTeam-Bench/RoboTeam-Videos`.
- `posters`, `clips`, `film`: folders on the media repository's Pages site (`RoboTeam-media`).
  A poster is `<set>/<task>-<view>.webp`, for the front and top views.

Clips and the film play only while they are on screen, and no video is fetched before it is
needed.

## Results data

Results are not kept in this repository. The page fetches `results.json` from the media
repository (`MEDIA` in `assets/js/site.js`):

```json
{"schema": "roboteam.site-results.v1",
 "conditions": [{"key": "adaptive", "label": "Adaptive", "group": "Agent systems · gpt-6.1-sol, Codex",
                 "completed": 0, "within": {"3": 0, "6": 0, "12": 0, "24": 0},
                 "median_hours": 0.0, "median_input_tokens_m": 0.0, "atomic_failure": 0.0}],
 "outcomes": {"gpt-6.1-sol": {"mosaic-large-l3": {"completed": false, "hours": 24.0}}}}
```

`outcomes` is keyed by video set and task; `hours` is optional. The three numbers come from
the `adaptive` condition.

## Visual style

- Light by default, with a Theme button for dark (stored under the `localStorage` key
  `roboteam-theme`).
- Fonts: Space Grotesk (display), IBM Plex Sans (body), JetBrains Mono (labels and data).
- One color per task type: light theme Transport `#3b7fc4`, Mosaic `#3f9440`, Relay `#d65b3c`,
  Dial `#b98a12`; dark theme `#8fc1ec`, `#9fdc8c`, `#ff9f87`, `#f2d46b`.
- Motion respects `prefers-reduced-motion`; controls work from the keyboard.

## Media pipeline

- `scripts/site/site_media.py`: `posters` (one WebP per run and view; the last frame of a
  completed run, otherwise a later frame) and `clips` (the short clips, cut as a spec file
  says, with their true playback speed).
- `scripts/site/site_data.py`: `tasks` (writes `data/tasks.json` from the release and the
  public tasks) and `media` (writes `data/media.json` from the published video folder and a
  checkout of the media repository).

## Files

```text
site/
  index.html
  assets/css/site.css  assets/js/site.js
  assets/img/          favicon, social image
  data/tasks.json      36 public task facts
  data/media.json      where every video, poster, clip and the film is
  DESIGN.md            this file
```

## Links

`#task=<task>` opens one run of that task, from the first video set unless `&set=<set>` names
another. The task guide's gallery links this way.

## Caching

GitHub Pages lets browsers keep files for ten minutes. `index.html` links the stylesheet and
the script with a `?v=` tag; change it whenever either file changes, so a returning visitor
never gets new HTML with an old stylesheet.

## Local preview

Preview with `python3 -m http.server -d site 8791`. To read posters, clips, the film and
`results.json` from a local checkout of the media repository, serve that checkout on another
port with cross-origin requests allowed and open the page with `?media=http://localhost:PORT/`.
