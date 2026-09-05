# クレジット / ライセンス表記

> この文書は長期的な設計・運用方針を扱う。個別機能の最新仕様は GitHub Issue、現在の詳細挙動・パラメータは実装コードとテストを正とする。ただし本書が扱う出典・ライセンス表記そのものは、素材を差し替えない限り陳腐化しない前提で維持する。

新しい画像・音源を追加、または既存素材を差し替えたときは、このファイルを必ず更新してください。

## 世界地図 (world-atlas / countries-50m.json)

世界地図の国境は [world-atlas](https://github.com/topojson/world-atlas) npmパッケージの [`countries-50m.json`](https://unpkg.com/world-atlas/countries-50m.json) を、ビルド時に静的importしてバンドルしています。実行時のCDN・地図API通信は行いません。

- 原典: Natural Earth の 1:50m Cultural Vectors（Admin 0 Countries）
- データ配布: world-atlas / Mike Bostock
- world-atlas のライセンス: ISC License
- Natural Earth の利用条件: [Public Domain](https://www.naturalearthdata.com/about/terms-of-use/)
- 本アプリでの加工: TopoJSONを一度GeoJSON Featureへ展開し、Web Mercator投影・SVGパス化、国別bboxによる表示範囲調整と旅行ルート描画を行います。国境データ自体は変更していません。

## 3D地球儀レンダリング (three-globe)

「ちきゅうぎ」（`src/games/earth-globe/`）の3D地球儀・国ポリゴン描画には [three-globe](https://github.com/vasturiano/three-globe) npmパッケージを使用しています。three.js上に国境ポリゴンを球面表示するためのライブラリで、npm経由でビルド時にバンドルし、実行時のCDN通信は行いません。表示する国境データは前述の world-atlas、国旗は flag-icons、国名は既存の国マスタを優先し、不足分を i18n-iso-countries の日本語名から生成しています。three-globe自体は地形データを持ちません。

- プロジェクト: three-globe
- リポジトリ: https://github.com/vasturiano/three-globe
- 作者: Vasco Asturiano
- ライセンス: MIT License

### MIT License 全文

```
MIT License

Copyright (c) 2019 Vasco Asturiano

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

（`node_modules/three-globe/LICENSE` の内容をそのまま転記しています。）

## 都道府県地図 (src/games/prefecture-quiz/data/prefectures.json)

都道府県境界は、[smartnews-smri/japan-topography](https://github.com/smartnews-smri/japan-topography) の `data/municipality/geojson/s0001/prefectures.json` を取得して同梱しています。外部通信には使用しません。

- 原典: 「国土数値情報（行政区域データ）」（国土交通省）
- 加工・配布: SmartNews Media Research Institute / smartnews-smri
- 本アプリでの加工: GeoJSONを静的バンドルし、SVGパスとして投影して表示。県の境界・属性は変更していません。

国土数値情報の利用条件に従い、出典を表記しています。詳細は元リポジトリおよび国土数値情報の利用規約を参照してください。

## 国旗画像 (public/flags/*.svg)

このアプリの国旗画像は [flag-icons](https://github.com/lipis/flag-icons)（`flags/4x3/<ISO 3166-1 alpha-2>.svg`）から取得しています。

- プロジェクト: flag-icons
- リポジトリ: https://github.com/lipis/flag-icons
- 作者: Panayiotis Lipiridis
- ライセンス: MIT License

flag-icons 本体はこのプロジェクトの依存関係（`package.json`）には追加せず、必要な国旗SVGファイルのみを `public/flags/` にコピーして同梱しています。一部のゲームでは、収録している国のマスタに含まれない国旗を、同じ配布物から個別に追加して再利用しています。

### MIT License 全文

```
The MIT License (MIT)

Copyright (c) 2013 Panayiotis Lipiridis

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

（`npm pack flag-icons` で取得した配布物に含まれる `LICENSE` ファイルの内容をそのまま転記しています。）

収録している国旗ファイルの一覧は `public/flags/` を、収録国の一覧は `src/games/flag-quiz/data/countries.ts` を正としてください。

## 楽器の音源 (public/audio/)

「ピアノであそぼう」（`src/games/piano-play/`）で使用する楽器の音源は、複数の配布元から取得したサンプルを加工して同梱しています。実行時の外部通信は行いません。

### ピアノ

- 音源名: University of Iowa Musical Instrument Samples (MIS) — Piano
- 配布元: University of Iowa Electronic Music Studios（[公式ページ](https://theremin.music.uiowa.edu/MIS.html)）
- 利用条件: 公式ページの記載により、プロジェクトでの利用に制限なし
- 加工: 元の録音から必要な音域を切り出し、無音区間を除去してMP3へ変換
- 詳細な加工記録: [`public/audio/piano/SOURCE.md`](../public/audio/piano/SOURCE.md)

### バイオリン・トランペット・フルート・木琴

- ライブラリ: [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE)（バイオリン・トランペット・フルート）、[Versilian Studios Chamber Orchestra Library (VCSL)](https://github.com/sgossner/VCSL)（木琴）
- 作者: Versilian Studios / Sam Gossner、Simon Dalzell (Ivy Audio)
- ライセンス: CC0 1.0 Universal
- 加工: 各配布物から必要なアンカー音のみを取得し、MP3へ変換
- 詳細な加工記録: [`public/audio/instruments/CREDITS.md`](../public/audio/instruments/CREDITS.md)、[`public/audio/instruments/SOURCE.md`](../public/audio/instruments/SOURCE.md)

## イラスト画像 (public/images/)

`public/images/working-vehicles/`（はたらくくるまクイズ）、`public/images/vegetables/`（おやさいクイズ）、`public/images/fruits/`（くだものクイズ）のイラストは、いずれも外部の実写・イラスト素材（Wikimedia Commonsなど）を使わず、アプリ向けに用意したオリジナル素材です。オリジナル素材のため、素材単位での出典記載は不要としています。

外部素材を新たに採用する場合は、このセクションに素材ごとの出典・ライセンスを追記してください。
