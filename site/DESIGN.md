# RoboTeam project page: design

The project page is `site/index.html` with `assets/` and `data/`, deployed to GitHub Pages by
`.github/workflows/site.yml` on pushes to `main` that touch `site/`.

## Audience and promise

The page is a demo, not a paper. A visitor should see AI teams controlling many robot arms
within seconds, then be able to watch any run of any model, and read in plain words how the
benchmark works and what came out. It is written for readers outside computer science.

## Page structure

Three pages in one file, switched by a tab bar at the top without reloading. Each page has its
own address, so a link can open any of them, or any section inside them.

| Page | Address | Content, in order |
| --- | --- | --- |
| Overview | `#overview` (the default) | The film as a silent 30 s loop, with a button for the long film; four numbers; the four jobs, each with a 300× clip that opens its run and a button that shows its nine tasks at their start; eight finished runs to watch, with a link to all of them; What is new (how RoboTeam compares with the benchmarks in the paper, and three short points); how a run works, told through one real run of gpt-6.1-sol (what a camera shows, a delegation, a move and a failed grasp with the robot tool's answers) and two rules; links to the other two pages |
| Results | `#results` | Who finished what: three numbers, the board of squares (one row per team, one square per task, the Oracle as a reference card under the six teams); then six findings, each with text on the left and a chart on the right. A list of contents stays beside the page, and becomes a row of links on narrow screens |
| Videos | `#videos` | Every run, grouped by team, with rows of filters above the grid: result (All, Complete, Incomplete), team and job |

Paper, Code and Cite sit at the right of the tab bar; Cite opens the BibTeX. Every page ends
with the same footer: the clone command, the getting-started guide and links.

A square, a card, a progress line or a job clip opens the player: the run's three camera views
on one clock. Any view can be made the large one. The videos are ten times real time, and the
speed buttons (10, 20, 50, 100 times) only change the playback rate. A row of buttons switches
to another team's run of the same task.

A run without a video is shown as a hatched square and listed as "Coming soon". No reason is
given on the page.

No result is written in the HTML. Until the results load, the board shows squares without
outcomes.

Charts are drawn as SVG at the width they are shown and drawn again when the window changes
size, so their text is always 12 px.
Pointing at a mark of any chart shows its details in one shared tooltip; pointing at a square of
the board lights up the same task in every row.

## Media

`data/media.json` (schema `roboteam.site-media-index.v2`) says where everything is:

- `sets`: one per video set, in page order. `base` is the set's published folder and `runs`
  gives each task's folder (`<task>-yes` or `<task>-no`) and length. A run's files are
  `front.mp4`, `side.mp4` and `top.mp4`. The videos are in the Hugging Face dataset
  `RoboTeam-Bench/RoboTeam-Videos`.
- `posters`, `clips`, `film`, and the `tasks` and `findings` folders: on the media repository's Pages site (`RoboTeam-media`).
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

## Findings data

`findings.json` in the media repository holds the numbers of the two chart sections, taken from the
paper and its data tables, and the per-step timelines of the gpt-6.1-sol and opus-5.5 adaptive
runs (schema `roboteam.site-findings.v1`). The camera pictures for the vision chart are in its
`findings/` folder.

## Visual style

- Light by default, with a Theme button for dark (stored under the `localStorage` key
  `roboteam-theme`).
- Fonts: Space Grotesk (headings and big numbers), IBM Plex Sans (text, chart labels),
  JetBrains Mono (only the small capital section labels, code and video times).
- The four task colors mean a task type and nothing else: light theme Transport `#3b7fc4`,
  Mosaic `#3f9440`, Relay `#d65b3c`, Dial `#b98a12`; dark theme `#8fc1ec`, `#9fdc8c`,
  `#ff9f87`, `#f2d46b`.
- In charts, violet (`--hi`, `#6a4fd1`) marks the point the chart makes, and gpt-6.1-sol
  wherever models are compared; light violet (`--hi-soft`) is the Oracle; three slates
  (`--s1` to `--s3`) carry everything else, with opus-5.5 in the darkest. No data is drawn in
  black. The README figures use the same colors.
- Marks are thin: bars 10 to 16 px with 2 px corners, lines 1.5 px (2.5 px when pointed at),
  points 5 px.
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

`#overview`, `#results` and `#videos` open a page. The id of a section opens its page and
scrolls to it, for example `#new`, `#how`, `#scoreboard` or `#f-vision`. `#task=<task>` opens
the Videos page and plays one run of that task, from the first video set unless `&set=<set>`
names another; the task guide's gallery links this way.

## Caching

GitHub Pages lets browsers keep files for ten minutes. `index.html` links the stylesheet and
the script with a `?v=` tag; change it whenever either file changes, so a returning visitor
never gets new HTML with an old stylesheet.

## Local preview

Preview with `python3 -m http.server -d site 8791`. To read posters, clips, the film and
`results.json` from a local checkout of the media repository, serve that checkout on another
port with cross-origin requests allowed and open the page with `?media=http://localhost:PORT/`.
