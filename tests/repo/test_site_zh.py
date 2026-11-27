"""The Chinese project page (site/zh/) is built from the English one and its text follows the rules
in docs/i18n/style.md: numbers match the English, Chinese and Latin text are spaced, and no English
sentence is left on the page except names and the agents' own words."""

import html
import json
import re
import unittest
from pathlib import Path

from scripts.site import build_zh

ROOT = Path(__file__).resolve().parents[2]
TABLE = json.loads((ROOT / 'site/data/i18n/zh-CN.json').read_text(encoding='utf-8'))
# Where the Chinese says a number the English only implies
NUMBER_NOTES = {
    'on all 36 tasks; hours count tasks not completed up to the cutoff.': ['24'],  # the cutoff is 24 h
    'Three cameras on one clock for every run, at ten times real time, with idle stretches cut.': [
        '10'
    ],  # ten times
}
# English that stays on the Chinese page: the paper's title and what the agents and tools say
ENGLISH_ON_PURPOSE = (
    'RoboTeam: Benchmarking Vision-Based Multi-Agent Control',
    'of Many Robot Arms in Real Time',
    '“Deliver one yellow source C cube into B_slot2, seated released stable, using B/C …”',
    'Grasp stopped outside expected',
)


def numbers(text):
    return sorted(re.findall(r'\d+(?:\.\d+)?', text.replace(',', '')))


class ChinesePageTests(unittest.TestCase):
    def test_built_page_is_current(self):
        built = build_zh.build(build_zh.SOURCE.read_text(encoding='utf-8'), TABLE)
        self.assertEqual(
            built, build_zh.OUT.read_text(encoding='utf-8'), 'run python3 -m scripts.site.build_zh'
        )

    def test_numbers_match_the_english(self):
        for english, chinese in TABLE['text'].items():
            with self.subTest(english=english[:50]):
                self.assertEqual(numbers(chinese), sorted(numbers(english) + NUMBER_NOTES.get(english, [])))

    def test_chinese_and_latin_text_are_spaced(self):
        touching = re.compile(r'[一-鿿][A-Za-z0-9$]|[A-Za-z0-9][一-鿿]')
        values = list(TABLE['text'].values()) + [replacement for _, replacement in TABLE['patterns']]
        for value in values:
            with self.subTest(value=value[:50]):
                self.assertIsNone(touching.search(value))

    def test_patterns_compile_in_both_languages(self):
        for pattern, replacement in TABLE['patterns']:
            re.compile(pattern)  # site.js compiles the same source as a JavaScript RegExp
            self.assertNotRegex(replacement, r'\\\d', 'use $1, as JavaScript does')

    def test_no_english_sentence_left_in_the_page_text(self):
        page = build_zh.OUT.read_text(encoding='utf-8')
        page = re.sub(r'<(script|style|code|pre)\b.*?</\1>', '', page, flags=re.S)
        page = re.sub(r'<(\w+) class="[^"]*\bkicker\b[^"]*">[^<]*</\1>', '', page)
        kept = {k for k, v in TABLE['text'].items() if k == v}
        for text in re.findall(r'>([^<]+)<', page):
            text = html.unescape(text).strip()
            if text in kept or text in ENGLISH_ON_PURPOSE or re.search(r'[一-鿿]', text):
                continue
            with self.subTest(text=text[:60]):
                self.assertNotRegex(
                    text, r'[A-Za-z]+ [a-z]+ [a-z]+', 'an English sentence on the Chinese page'
                )

    def test_both_pages_name_each_other(self):
        english = (ROOT / 'site/index.html').read_text(encoding='utf-8')
        chinese = build_zh.OUT.read_text(encoding='utf-8')
        for page in (english, chinese):
            self.assertIn('hreflang="zh-CN" href="https://changxuanfan.github.io/RoboTeam/zh/"', page)
            self.assertIn('hreflang="en" href="https://changxuanfan.github.io/RoboTeam/"', page)
        self.assertIn('<html lang="zh-CN" data-root="../"', chinese)
        self.assertIn('<link rel="canonical" href="https://changxuanfan.github.io/RoboTeam/zh/">', chinese)
        self.assertNotRegex(chinese, r'(href|src)="(assets|data)/', 'relative paths must point one folder up')


if __name__ == '__main__':
    unittest.main()
