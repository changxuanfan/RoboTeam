"""Build the Chinese project page, site/zh/index.html, from the English one.

The English page (site/index.html) is the source. This script translates its fixed text and the
attributes people read (alt, title, aria-label, placeholder, the description) with the table in
site/data/i18n/zh-CN.json, points its relative paths one folder up, marks the page as zh-CN, and
puts the table into the page so site.js can translate the text it writes. Terms follow
docs/i18n/glossary.md. Run it after any change to the English page or the table:

    python3 -m scripts.site.build_zh          # write site/zh/index.html
    python3 -m scripts.site.build_zh --check  # fail if it is out of date
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parents[2] / 'site'
SOURCE, TABLE, OUT = SITE / 'index.html', SITE / 'data/i18n/zh-CN.json', SITE / 'zh/index.html'
BASE = 'https://changxuanfan.github.io/RoboTeam/'
READ_ATTRS = ('alt', 'title', 'aria-label', 'placeholder')  # the same list as I18N_ATTRS in site.js
SKIP_TAGS = ('script', 'style', 'code', 'pre')
DESCRIPTION = (
    'RoboTeam: Benchmarking Vision-Based Multi-Agent Control of Many Robot Arms in Real Time。'
    'AI agent 团队实时操控 4 到 16 条机械臂，看世界只能靠相机。36 个任务，附代码、论文和每一次运行的录像。'
)
OG_DESCRIPTION = 'AI agent 团队实时操控 4 到 16 条机械臂，看世界只能靠相机。36 个任务，每一次运行全程录像。'
SWITCH_EN = (
    '<span class="lang-switch"><b aria-current="true">EN</b><a href="zh/" hreflang="zh-CN" lang="zh-CN" '
    'data-lang="zh-CN" aria-label="中文">中</a></span>'
)
SWITCH_ZH = (
    '<span class="lang-switch"><a href="../" hreflang="en" lang="en" data-lang="en" aria-label="English">EN</a>'
    '<b aria-current="true" lang="zh-CN">中</b></span>'
)


class Translator:
    def __init__(self, table: dict):
        self.text = table['text']
        self.patterns = [(re.compile(p), re.sub(r'\$(\d)', r'\\\1', r)) for p, r in table['patterns']]

    def __call__(self, s: str) -> str:
        m = re.fullmatch(r'(\s*)(.*?)(\s*)', s, re.S)
        lead, core, tail = m.groups()
        if not core:
            return s
        plain = core.replace('\u00a0', ' ')  # matched with plain spaces
        t = self.text.get(plain)
        if t is None:
            t = plain
            for rx, rep in self.patterns:
                t = rx.sub(rep, t)
        if t == plain:
            return s
        t = re.sub(r'(\d) (?=\S)', '\\1\u00a0', t)  # a number keeps its unit on its line
        lead = '' if re.match(r'[，。：；、？！）]', t) else lead  # no space next to Chinese punctuation
        tail = '' if re.search(r'[，。：；、？！（]$', t) else tail
        return lead + t + tail


def relative(url: str) -> bool:
    return not re.match(r'([a-z][a-z0-9+.-]*:|#|/|\.\./)', url)


def rewrite_tag(tag: str, tr: Translator) -> str:
    def attr(m):
        name, value = m.group(1), m.group(3)
        if name in READ_ATTRS:
            new = tr(html.unescape(value))
            if new != html.unescape(value):
                value = html.escape(new, quote=True)
        elif name in ('href', 'src') and relative(value):
            value = '../' + value
        elif name == 'srcset':
            value = ', '.join(
                ('../' + p) if relative(p) else p for p in (x.strip() for x in value.split(','))
            )
        return f'{name}={m.group(2)}{value}{m.group(2)}'

    return re.sub(r'([a-zA-Z-]+)=(["\'])(.*?)\2', attr, tag)


def build(source: str, table: dict) -> str:
    tr = Translator(table)
    for old, new in (
        ('<html lang="en"', '<html lang="zh-CN" data-root="../"'),
        (f'<link rel="canonical" href="{BASE}">', f'<link rel="canonical" href="{BASE}zh/">'),
        (SWITCH_EN, SWITCH_ZH),
    ):
        if source.count(old) != 1:
            raise SystemExit(f'build_zh: expected exactly one {old!r} in site/index.html')
        source = source.replace(old, new)
    # the Chinese cut of the film: its posters sit in film/zh/ of the media repository
    source = source.replace('RoboTeam-media/film/roboteam-', 'RoboTeam-media/film/zh/roboteam-')
    source = re.sub(
        r'(<meta name="description" content=")[^"]*',
        lambda m: m.group(1) + html.escape(DESCRIPTION),
        source,
        count=1,
    )
    source = re.sub(
        r'(<meta property="og:description" content=")[^"]*',
        lambda m: m.group(1) + html.escape(OG_DESCRIPTION),
        source,
        count=1,
    )

    out, skip, kicker = [], None, False
    for part in re.split(r'(<[^>]+>)', source):
        if part.startswith('<'):
            kicker = not part.startswith('</') and bool(re.search(r'class="[^"]*\bkicker\b', part))
            name = re.match(r'</?([a-zA-Z0-9]+)', part)
            name = name.group(1).lower() if name else ''
            if skip and part.lower().startswith(f'</{skip}'):
                skip = None
            elif not skip and name in SKIP_TAGS and not part.startswith('</'):
                skip = name
            out.append(part if part.startswith('<!') or part.startswith('</') else rewrite_tag(part, tr))
        elif skip or kicker or not part.strip():  # kickers stay English (docs/i18n/glossary.md)
            out.append(part)
        else:
            new = tr(html.unescape(part))
            out.append(part if new == html.unescape(part) else html.escape(new, quote=False))
    page = ''.join(out)
    blob = json.dumps(table, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    script = re.search(r'<script src="\.\./assets/js/site\.js[^"]*" defer></script>', page)
    if not script:
        raise SystemExit('build_zh: site.js script tag not found')
    head = (
        '<!-- Built by scripts/site/build_zh.py from site/index.html. Do not edit by hand. -->\n'
        f'<script type="application/json" id="i18n">{blob}</script>\n'
    )
    return page[: script.start()] + head + page[script.start() :]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--check', action='store_true', help='fail if site/zh/index.html is out of date')
    args = ap.parse_args(argv)
    page = build(SOURCE.read_text(encoding='utf-8'), json.loads(TABLE.read_text(encoding='utf-8')))
    if args.check:
        if not OUT.exists() or OUT.read_text(encoding='utf-8') != page:
            print('site/zh/index.html is out of date: run python3 -m scripts.site.build_zh', file=sys.stderr)
            return 1
        return 0
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(page, encoding='utf-8')
    print(f'wrote {OUT.relative_to(SITE.parent)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
