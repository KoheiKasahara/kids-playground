# 追加楽器サンプルの出典・クレジット

Issue #333 の追加楽器は、公式リポジトリから必要なアンカー音だけを取得し、先頭・末尾の長い無音を安全にトリミングして 44.1kHz / mono / 96kbps CBR MP3 に変換したものです。変換後の全ファイルは 3MiB 未満で、実行時は音源定義の `noteId`（公式アンカー音）に合わせて対象鍵へ移調します。MP3はPWAのprecache対象としてオフラインでも利用でき、lazyなのはAudioBufferのfetch/decodeです。

## ライセンス

- [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) — `LICENSE` の CC0 1.0 Universal
  - バイオリン: `Strings/Solo Violin/Arco Vib`, `LLVln_ArcoVib_*_f.wav`
  - トランペット: `Brass/Trumpet/sus`, `Sum_SHTrumpet_sus_*_v1_rr1.wav`
  - フルート: `Woodwinds/Flute/susNV`, `LDFlute_susNV_*_v1_1.wav`
  - クレジット: Versilian Studios / Sam Gossner、Simon Dalzell (Ivy Audio)
- [Versilian Studios Chamber Orchestra Library (VCSL)](https://github.com/sgossner/VCSL) — `LICENSE` の CC0 1.0 Universal
  - 木琴: `Idiophones/Struck Idiophones/Xylophone/Medium Mallets`, `Xylo_Medium_*_ff_01_far.wav`
  - クレジット: Versilian Studios / Sam Gossner

CC0 の条件に加え、元リポジトリの README にある作者・ライブラリ名もこの文書で保持しています。音源そのものを単体販売する用途ではありません。

## 取得したアンカー

| 楽器 | 同梱アンカー | 配布先 | 出力ファイル |
| --- | --- | --- | --- |
| バイオリン | C4, E4, G4, A4, C5 | VSCO-2-CE | `audio/violin/*.mp3` |
| ラッパ | D4, F4, A4, C5 | VSCO-2-CE | `audio/trumpet/*.mp3` |
| フルート | C4, E4, A4, C5 | VSCO-2-CE | `audio/flute/*.mp3` |
| 木琴 | C4, G4, C5 | VCSL | `audio/xylophone/*.mp3` |

各アンカーの公式ファイル名と URL は `src/games/piano-play/pianoSamples.ts` にも記録しています。WAV 原本は配布物に含めず、リポジトリ容量を抑えています。`ffmpeg volumedetect` で変換後MP3を実測したピークは -8.2〜-7.7 dBFS（木琴）、他は概ね -8.1〜-8.0 dBFS でした。
