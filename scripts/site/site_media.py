"""Make the images and short clips of the project page.

posters: one poster per run and view for the video library: the last frame of a completed
         run, otherwise a frame from later in the run. VIDEOS is the published video folder,
         <set>/<task>-<yes|no>/<view>.mp4.
clips:   the short looping clips of the page (highlights and one per task type), cut from the
         same videos as SPEC says: a JSON list of {key, video, start, length, speed, crop,
         caption}. Run videos are already ten times real time; `speed` multiplies that.
starts:  every released task at its start, drawn as a run draws its images: full-size
         images in IMAGES and the task guide's thumbnails.

Run from the repository root:

    .venv/bin/python -m scripts.site.site_media posters VIDEOS OUT
    .venv/bin/python -m scripts.site.site_media clips SPEC VIDEOS OUT
    .venv/bin/python -m scripts.site.site_media starts IMAGES docs/media/readme/tasks
"""

import argparse
import json
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
FFPROBE = os.environ.get('FFPROBE', 'ffprobe')
POSTER_AT = 0.6  # Later in a run the scene shows real progress.


def starts(atlas, thumbnails, views=('global',)):
    """Every released task at its start, drawn as a run draws its images: `atlas`/<case>-<view>.jpg
    (640 x 400) and `thumbnails`/<case>.jpg (400 x 250) for the task guide."""
    import tempfile

    import mujoco
    import numpy as np
    from PIL import Image

    from roboteam.runtime.run.setup import prepare_case
    from roboteam.runtime.world.pipeline import World
    from roboteam.sim.render.worker import LocalRenderer, _graphics_context
    from roboteam.tasks.task_types import RELEASE, ROOT, read

    atlas, thumbnails = Path(atlas), Path(thumbnails)
    graphics = _graphics_context()
    written = []
    for task_type in read(ROOT / RELEASE)['task_types'].values():
        for case in task_type['policy']:
            with tempfile.TemporaryDirectory(prefix='roboteam-starts-') as temporary:
                run = Path(temporary) / 'run'
                prepare_case(case['id'], run)
                world = World(run, json.loads((run / 'private/inputs/task.json').read_text()))
                renderer = LocalRenderer(mujoco, world.model)
                for view in views:
                    rgb = renderer.frame(mujoco, world, world.model.camera(view).id, 1280, 800)
                    image = Image.fromarray(np.ascontiguousarray(rgb[::-1]))
                    target = atlas / f"{case['id']}-{view}.jpg"
                    image.resize((640, 400), Image.LANCZOS).save(target, quality=84, optimize=True)
                    written.append(str(target))
                    if view == views[0]:
                        image.resize((400, 250), Image.LANCZOS).save(
                            thumbnails / f"{case['id']}.jpg", quality=80, optimize=True
                        )
                renderer.context.free()
    del graphics
    return written


POSTER_VIEWS = ('front', 'top')


def duration(path):
    out = subprocess.run(
        [FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return float(out)


def posters(videos, out, width=480, workers=8):
    """Write OUT/<set>/<task>-<view>.webp for every run folder under VIDEOS."""
    jobs = []
    for run in sorted(Path(videos).glob('*/*-*')):
        if not run.is_dir():
            continue
        task, _, outcome = run.name.rpartition('-')
        for view in POSTER_VIEWS:
            jobs.append((run / f'{view}.mp4', Path(out) / run.parent.name / f'{task}-{view}.webp', outcome == 'yes'))

    def one(job):
        video, poster, completed = job
        if poster.exists():
            return poster
        poster.parent.mkdir(parents=True, exist_ok=True)
        length = duration(video)
        at = max(0.0, length - 0.5) if completed else length * POSTER_AT
        subprocess.run(
            [FFMPEG, '-v', 'error', '-y', '-ss', f'{at:.2f}', '-i', str(video), '-frames:v', '1']
            + ['-vf', f'scale={width}:-2:flags=lanczos', '-c:v', 'libwebp', '-q:v', '72', str(poster)],
            check=True,
        )
        return poster

    with ThreadPoolExecutor(workers) as pool:
        return list(pool.map(one, jobs))


def clips(spec, videos, out, size=(960, 600), crf=24):
    """Cut the page's short clips; returns the spec with each clip's file, poster, length and
    true playback speed."""
    rows = []
    Path(out).mkdir(parents=True, exist_ok=True)
    for clip in json.loads(Path(spec).read_text()):
        source = Path(videos) / (clip['video'] + '.mp4')
        start = clip.get('start', 0)
        length = clip.get('length') or duration(source) - start
        speed = clip.get('speed', 1)
        chain = [f'setpts=PTS/{speed}'] if speed != 1 else []
        if clip.get('crop'):
            chain.append('crop=' + clip['crop'])
        chain += [f'scale={size[0]}:{size[1]}:flags=lanczos', 'fps=30']
        if clip.get('hold'):
            chain.append(f"tpad=stop_mode=clone:stop_duration={clip['hold']}")
        video = Path(out) / f"{clip['key']}.mp4"
        subprocess.run(
            [FFMPEG, '-v', 'error', '-y', '-ss', str(start), '-t', str(length), '-i', str(source)]
            + ['-vf', ','.join(chain), '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf)]
            + ['-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(video)],
            check=True,
        )
        poster = video.with_suffix('.webp')
        shown = duration(video)
        subprocess.run(
            [FFMPEG, '-v', 'error', '-y', '-ss', f'{shown * clip.get("poster_at", 0.5):.2f}', '-i', str(video)]
            + ['-frames:v', '1', '-c:v', 'libwebp', '-q:v', '76', str(poster)],
            check=True,
        )
        rows.append(
            {
                'key': clip['key'],
                'video': video.name,
                'poster': poster.name,
                'seconds': round(shown, 1),
                'speed': 10 * speed,
                'set': clip['video'].split('/')[0],
                'task': clip['video'].split('/')[1].rsplit('-', 1)[0],
                'caption': clip['caption'],
                'size': video.stat().st_size,
            }
        )
    index = Path(out) / 'clips.json'
    index.write_text(json.dumps(rows, indent=1) + '\n')
    return rows


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('posters')
    p.add_argument('videos')
    p.add_argument('out')
    c = sub.add_parser('clips')
    c.add_argument('spec')
    c.add_argument('videos')
    c.add_argument('out')
    t = sub.add_parser('starts')
    t.add_argument('atlas')
    t.add_argument('thumbnails')
    t.add_argument('--views', nargs='+', default=['global'])
    args = parser.parse_args(argv)
    if args.command == 'posters':
        print(len(posters(args.videos, args.out)), 'posters')
    elif args.command == 'clips':
        for row in clips(args.spec, args.videos, args.out):
            print(row['key'], row['seconds'], 's', f"{row['speed']}x", row['size'])
    else:
        print(len(starts(args.atlas, args.thumbnails, args.views)), 'images')


if __name__ == '__main__':
    main()
