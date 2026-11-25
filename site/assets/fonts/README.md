# Web fonts

The project page serves its own fonts. It loads nothing from a font service.

| File | Font | Version | Size | Source | License |
| --- | --- | --- | --- | --- | --- |
| `ibm-plex-sans-latin-400-normal.woff2` | IBM Plex Sans Regular, Latin | 3.201 | 22,588 bytes | `@fontsource/ibm-plex-sans` 5.3.0, file `files/ibm-plex-sans-latin-400-normal.woff2`, unchanged | SIL OFL 1.1 ([`OFL-IBMPlexSans.txt`](OFL-IBMPlexSans.txt)) |
| `ibm-plex-sans-latin-500-normal.woff2` | IBM Plex Sans Medium, Latin | 3.201 | 24,184 bytes | `@fontsource/ibm-plex-sans` 5.3.0, file `files/ibm-plex-sans-latin-500-normal.woff2`, unchanged | SIL OFL 1.1 ([`OFL-IBMPlexSans.txt`](OFL-IBMPlexSans.txt)) |
| `ibm-plex-sans-latin-600-normal.woff2` | IBM Plex Sans SemiBold, Latin | 3.201 | 24,252 bytes | `@fontsource/ibm-plex-sans` 5.3.0, file `files/ibm-plex-sans-latin-600-normal.woff2`, unchanged | SIL OFL 1.1 ([`OFL-IBMPlexSans.txt`](OFL-IBMPlexSans.txt)) |
| `space-grotesk-bold.woff2` | Space Grotesk Bold, subset | 2.000 | 17,504 bytes | `benchmark/hall/fonts/SpaceGrotesk-Bold.ttf`, subset with fontTools | SIL OFL 1.1 ([`OFL-SpaceGrotesk.txt`](OFL-SpaceGrotesk.txt)) |
| `jetbrains-mono-medium.woff2` | JetBrains Mono Medium, subset | 2.305 | 13,788 bytes | `benchmark/hall/fonts/JetBrainsMono-Medium.ttf`, subset with fontTools | SIL OFL 1.1 ([`OFL-JetBrainsMono.txt`](OFL-JetBrainsMono.txt)) |

The IBM Plex Sans files come from the npm package `@fontsource/ibm-plex-sans` 5.3.0
(<https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-sans@5.3.0/>). `OFL-IBMPlexSans.txt` is
that package's `LICENSE` file.

The two subsets keep Basic Latin, Latin-1 and the symbols the page shows. They were made with:

```sh
U='U+0020-007E,U+00A0-00FF,U+2009,U+200A,U+202F,U+2010-2015,U+2018-201F,U+2022,U+2026,U+2032,U+2033,U+2190-2199,U+2212,U+2248,U+2713,U+2715'
python3 -m fontTools.subset benchmark/hall/fonts/SpaceGrotesk-Bold.ttf --unicodes="$U" --flavor=woff2 \
  --layout-features='kern,liga,calt,tnum,pnum,lnum,case,ss01' --output-file=site/assets/fonts/space-grotesk-bold.woff2
python3 -m fontTools.subset benchmark/hall/fonts/JetBrainsMono-Medium.ttf --unicodes="$U" --flavor=woff2 \
  --layout-features='kern,tnum,zero' --output-file=site/assets/fonts/jetbrains-mono-medium.woff2
```

`site/assets/css/site.css` declares the faces with weight ranges (Plex SemiBold 600–700,
Space Grotesk 600–700, JetBrains Mono 400–600), so no text is drawn in a synthetic bold. The
arrows, ≈ and ✕ that the Plex Latin files lack are taken from the JetBrains Mono file through
`unicode-range`.
