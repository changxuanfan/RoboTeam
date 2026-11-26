"""The Chinese documents (README.zh-CN.md and docs/zh-CN/) follow docs/i18n/style.md: each names its
English source and the commit it was translated from, keeps the English anchors and code exactly,
keeps every number of the English, and links only to files that exist."""

import re
import unittest
from collections import Counter
from pathlib import Path

from scripts.dev.check_runtime import documentation_links

ROOT = Path(__file__).resolve().parents[2]
ZH = sorted((ROOT / 'docs/zh-CN').rglob('*.md'))
PAIRS = [(ROOT / 'README.zh-CN.md', ROOT / 'README.md')] + [(p, ROOT / 'docs' / p.relative_to(ROOT / 'docs/zh-CN')) for p in ZH]


def code_blocks(text):
    return re.findall(r'^```.*?^```', text, flags=re.S | re.M)


def slug(heading):
    return re.sub(r'\s', '-', re.sub(r'[^\w\- ]', '', heading.strip().lower()))


def numbers(text):
    text = re.sub(r'```.*?```|`[^`]*`|\]\([^)]*\)|<[^>]+>', ' ', text, flags=re.S)
    return Counter(re.findall(r'\d+(?:\.\d+)?', re.sub(r'(?<=\d),(?=\d{3})', '', text)))


class ChineseDocumentTests(unittest.TestCase):
    def test_every_document_has_its_english_source(self):
        self.assertTrue(ZH, 'docs/zh-CN is empty')
        for chinese, english in PAIRS:
            with self.subTest(document=str(chinese.relative_to(ROOT))):
                self.assertTrue(english.exists())

    def test_header_names_the_english_and_the_commit(self):
        for chinese, english in PAIRS[1:]:
            with self.subTest(document=str(chinese.relative_to(ROOT))):
                first, second = chinese.read_text(encoding='utf-8').split('\n')[:2]
                target = re.match(r'\[English\]\(([^)]+)\) \| 简体中文$', first)
                self.assertIsNotNone(target, first)
                self.assertEqual((chinese.parent / target.group(1)).resolve(), english.resolve())
                self.assertRegex(second, r'^> 本文译自英文版（commit [0-9a-f]{7,}），内容以英文版为准。$')

    def test_code_is_copied_exactly(self):
        for chinese, english in PAIRS:
            with self.subTest(document=str(chinese.relative_to(ROOT))):
                self.assertEqual(code_blocks(chinese.read_text(encoding='utf-8')), code_blocks(english.read_text(encoding='utf-8')))

    def test_english_anchors_still_work(self):
        for chinese, english in PAIRS:
            text = chinese.read_text(encoding='utf-8')
            anchors = set(re.findall(r'<a id="([^"]+)"></a>', text))
            source = re.sub(r'^```.*?^```', '', english.read_text(encoding='utf-8'), flags=re.S | re.M)
            for heading in re.findall(r'^#{2,4} (.+)$', source, flags=re.M):
                with self.subTest(document=str(chinese.relative_to(ROOT)), heading=heading):
                    self.assertIn(slug(heading), anchors)

    def test_every_number_of_the_english_is_kept(self):
        for chinese, english in PAIRS:
            with self.subTest(document=str(chinese.relative_to(ROOT))):
                missing = numbers(english.read_text(encoding='utf-8')) - numbers(chinese.read_text(encoding='utf-8'))
                self.assertFalse(missing, f'numbers of the English not in the Chinese: {dict(missing)}')

    def test_links_resolve(self):
        self.assertEqual(documentation_links(ROOT, [c for c, _ in PAIRS]), [])


if __name__ == '__main__':
    unittest.main()
