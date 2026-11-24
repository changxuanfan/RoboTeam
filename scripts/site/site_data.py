"""Generate the project page's data files from the release and encoded media.

tasks:  site/data/tasks.json, the 36 released cases with their public facts (task type, level,
        arms, workload) and the one-line level differences, from the release and each case's
        public policy task.
media:  site/data/media.json, where the page finds its media: every video set with the folder
        and length of each run, the posters, the short clips and the film. VIDEOS is the
        published video folder (<set>/<task>-<yes|no>/<view>.mp4), VIDEOS_URL where it is
        published, and MEDIA_URL the media repository's Pages site, which holds posters/,
        clips/ and film/. MEDIA is a local checkout of that repository.

    .venv/bin/python -m scripts.site.site_data tasks
    .venv/bin/python -m scripts.site.site_data media VIDEOS VIDEOS_URL MEDIA MEDIA_URL
    .venv/bin/python -m scripts.site.site_data task-gallery
"""

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

from roboteam.tasks.config import ROOT

# The published project page; the task gallery links point at it.
PROJECT_PAGE = 'https://changxuanfan.github.io/RoboTeam/'
SITE = ROOT / 'site/data'
# The order of the video sets on the page: the models by tasks completed, then the reference.
SETS = [
    'gpt-6.1-sol',
    'opus-5.5',
    'kimi-k3.1-pro',
    'qwen3.8-flash',
    'deepseek-v4.1-flash',
    'glm-5.3-flash',
    'oracle',
]
VIEWS = ['front', 'side', 'top']

TASK_TYPES = {
    'transport': {
        'name': 'Transport',
        'verb': 'Deliver ordered items to their boards, by handover or staging',
        'unit': 'targets',
        'levels': [
            'Release on the board',
            'Insert blades into fixed blind slots',
            'Insert into a spring-mounted moving board',
        ],
    },
    'mosaic': {
        'name': 'Mosaic',
        'verb': 'Fill every cell of a color pattern with distinct cubes',
        'unit': 'cells',
        'levels': ['Square pockets guide each cube', 'Printed grid lines only', 'No visible grid'],
    },
    'relay': {
        'name': 'Relay',
        'verb': 'Carry long timbers arm to arm and land them over the goal',
        'unit': 'timbers',
        'levels': [
            'Straight timber',
            '63-degree arc timber with a pendant',
            'Deflected timber on passive springs',
        ],
    },
    'dial': {
        'name': 'Dial',
        'verb': 'Turn spring dials and read BEST feedback to crack a hidden code',
        'unit': 'dials',
        'levels': [
            'Fixed dial modules',
            'Lift each module: support and grasp',
            'Lifted modules with an eccentric crank',
        ],
    },
}


def workload(task):
    """The task type's unit of work for one case, from its released task: targets, cells,
    timbers or dials."""
    if task['task_type'] == 'transport':
        return len(task['goals'])
    if task['task_type'] == 'mosaic':
        return task['grid']['rows'] * task['grid']['columns']
    if task['task_type'] == 'relay':
        return len(task['objects'])
    return len(task['dials'])


def tasks():
    import tempfile

    from roboteam.tasks.config import public_task
    from roboteam.tasks.task_types import RELEASE, freeze_public, policy_task

    payload = (ROOT / RELEASE).read_bytes()
    release = json.loads(payload)
    rows = []
    for task_type in TASK_TYPES:
        for record in release['task_types'][task_type]['policy']:
            # The same rule overlay a new policy run receives.
            task = policy_task(record['id'])
            public = public_task(task)
            with tempfile.TemporaryDirectory(prefix='roboteam-site-public-') as temporary:
                for folder in ('public/inputs', 'private/inputs'):
                    (Path(temporary) / folder).mkdir(parents=True)
                freeze_public(task, Path(temporary), public)
            rows.append(
                {
                    'id': public['id'],
                    'task_type': task_type,
                    'size': task['scale']['size'],
                    'level': public['level'],
                    'arms': len(task['arms']),
                    'workload': workload(task),
                    'unit': TASK_TYPES[task_type]['unit'],
                    'level_note': TASK_TYPES[task_type]['levels'][public['level'] - 1],
                    'objective': public['objective'],
                    'rules': public['rules'],
                }
            )
    rows.sort(key=lambda r: (list(TASK_TYPES).index(r['task_type']), r['arms'], r['workload'], r['level']))
    document = {
        'schema': 'roboteam.site-tasks.v1',
        'release_sha256': hashlib.sha256(payload).hexdigest(),
        'task_types': TASK_TYPES,
        'tasks': rows,
    }
    return write(SITE / 'tasks.json', document)


def seconds(video):
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(video)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return round(float(out), 1)


def media(videos, videos_url, media, media_url):
    videos, media = Path(videos), Path(media)
    videos_url, media_url = videos_url.rstrip('/') + '/', media_url.rstrip('/') + '/'
    sets = []
    for key in SETS:
        runs = {}
        for folder in sorted((videos / key).iterdir()):
            if not folder.is_dir():
                continue
            missing = [view for view in VIEWS if not (folder / f'{view}.mp4').is_file()]
            if missing:
                raise ValueError(f'{folder} lacks {missing}')
            task, _, outcome = folder.name.rpartition('-')
            if outcome not in ('yes', 'no'):
                raise ValueError(f'{folder} does not end in -yes or -no')
            runs[task] = {'folder': folder.name, 'seconds': seconds(folder / 'front.mp4')}
        sets.append({'key': key, 'base': f'{videos_url}{key}/', 'runs': runs})
    document = {
        'schema': 'roboteam.site-media-index.v2',
        'views': VIEWS,
        'posters': media_url + 'posters/',
        'sets': sets,
    }
    clips = media / 'clips/clips.json'
    if clips.is_file():
        keep = ('key', 'video', 'poster', 'seconds', 'speed', 'set', 'task', 'caption')
        document['clips'] = {
            'base': media_url + 'clips/',
            'items': [{k: clip[k] for k in keep} for clip in json.loads(clips.read_text())],
        }
    film = media / 'film/film.json'
    if film.is_file():
        document['film'] = {'base': media_url + 'film/', **json.loads(film.read_text())}
    return write(SITE / 'media.json', document)


def task_gallery(page=PROJECT_PAGE, guide=ROOT / 'docs/tasks/README.md'):
    """Fill the task guide's gallery block: per task type a 3 x 3 table of task thumbnails."""
    data = json.loads((SITE / 'tasks.json').read_text())
    blocks = []
    for task_type, info in data['task_types'].items():
        rows = [t for t in data['tasks'] if t['task_type'] == task_type]
        key = (lambda t: t['workload']) if task_type == 'dial' else (lambda t: t['arms'])
        scales = sorted({key(t) for t in rows})
        head = ''.join(f'<th>{s} {"dials" if task_type == "dial" else "arms"}</th>' for s in scales)
        body = []
        for level in (1, 2, 3):
            cells = []
            for s in scales:
                t = next(t for t in rows if key(t) == s and t['level'] == level)
                cells.append(
                    f'<td><a href="{page}#task={t["id"]}"><img src="../media/readme/tasks/{t["id"]}.jpg" '
                    f'width="240" alt="{t["id"]}"></a><br><sub>{t["id"]}</sub></td>'
                )
            body.append(f'<tr><th>L{level}</th>{"".join(cells)}</tr>')
        blocks.append(f'<b>{info["name"]}</b>\n\n<table><tr><th></th>{head}</tr>{"".join(body)}</table>\n')
    text = guide.read_text()
    start, end = '<!-- gallery -->', '<!-- /gallery -->'
    before, rest = text.split(start, 1)
    _, after = rest.split(end, 1)
    guide.write_text(before + start + '\n' + '\n'.join(blocks) + end + after)
    return guide


def write(path, document):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, indent=1, ensure_ascii=False) + '\n')
    return path


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('tasks')
    m = sub.add_parser('media')
    m.add_argument('videos')
    m.add_argument('videos_url')
    m.add_argument('media')
    m.add_argument('media_url')
    sub.add_parser('task-gallery')
    args = parser.parse_args(argv)
    if args.command == 'tasks':
        print(tasks())
    elif args.command == 'media':
        print(media(args.videos, args.videos_url, args.media, args.media_url))
    else:
        print(task_gallery())


if __name__ == '__main__':
    main()
