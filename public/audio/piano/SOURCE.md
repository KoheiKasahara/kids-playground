# ピアノ音源の出典・加工記録

- 音源名: University of Iowa Musical Instrument Samples (MIS) — Piano, `mf` dynamic layer
- 配布元: University of Iowa Electronic Music Studios
- 公式配布ページ: <https://theremin.music.uiowa.edu/MIS.html>
- ピアノ個別ページ: <https://theremin.music.uiowa.edu/MISpiano.html>
- 利用条件の確認日: 2026-08-30
- 利用条件確認先: MIS公式ページの説明（録音はこのWebサイトで自由に利用可能で、プロジェクトでの使用に制限なしと明記）
- クレジット: 公式ページ上で必須表記の指定はない。出典追跡のため、この記録とアプリ内のソースコードに配布元を残す。

## 使用した録音

- 楽器: Steinway & Sons Model B
- 演奏者: Evan Mazunik
- 録音日: 2001-11-05 / 2001-11-27
- 収録形式: 16-bit / 44.1 kHz / stereo
- 使用音域: C4, C#4 (公式名 Db4), D4, D#4 (Eb4), E4, F4, F#4 (Gb4), G4, G#4 (Ab4), A4, A#4 (Bb4), B4, C5
- 元ファイル: `Piano.mf.{C4,Db4,D4,Eb4,E4,F4,Gb4,G4,Ab4,A4,Bb4,B4,C5}.aiff`

## 加工内容

元のAIFFは、自然減衰後に長い無音区間を含む。各音を個別に、末尾の連続無音（-55 dB以下が0.7秒続く部分）のみ除去して、44.1 kHzステレオ・128 kbps CBR MP3に変換した。音程変更、正規化、ベロシティ層の合成は行っていない。

変換後の13音のピークには約12.5 dBの差があったため、再生時に各音をピーク約-6 dBFSへ近づける補正を適用する。補正値は `pianoSamples.ts` に明記し、共通voice gainとmaster gainで単音と和音の出力を抑えている。

再現コマンド（各元ファイルと出力名の組み合わせに対して実行）:

```sh
ffmpeg -i Piano.mf.C4.aiff \
  -af 'silenceremove=stop_periods=1:stop_duration=0.7:stop_threshold=-55dB' \
  -ar 44100 -ac 2 -codec:a libmp3lame -b:a 128k C4.mp3
```

黒鍵のファイル名対応は [`src/games/piano-play/pianoSamples.ts`](../../../src/games/piano-play/pianoSamples.ts) を正とする。
