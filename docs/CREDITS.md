# クレジット / ライセンス表記

## 世界地図 (world-atlas / countries-50m.json)

世界地図の国境は [world-atlas](https://github.com/topojson/world-atlas) npmパッケージ
**2.0.2** の [`countries-50m.json`](https://unpkg.com/world-atlas@2.0.2/countries-50m.json) を、ビルド時に静的importしてバンドルしています。実行時のCDN・地図API通信は行いません。

- 原典: Natural Earth の 1:50m Cultural Vectors（Admin 0 Countries）
- データ配布: world-atlas / Mike Bostock
- world-atlas のライセンス: ISC License
- Natural Earth の利用条件: [Public Domain](https://www.naturalearthdata.com/about/terms-of-use/)
- 本アプリでの加工: TopoJSONを一度GeoJSON Featureへ展開し、Web Mercator投影・SVGパス化、国別bboxによる表示範囲調整と旅行ルート描画を行います。国境データ自体は変更していません。

## 都道府県地図 (src/games/prefecture-quiz/data/prefectures.json)

都道府県境界は、[smartnews-smri/japan-topography](https://github.com/smartnews-smri/japan-topography) の
`data/municipality/geojson/s0001/prefectures.json` を、コミット
[`b676ea056ac50c271cc7d17f61cc2f1def1279c6`](https://github.com/smartnews-smri/japan-topography/tree/b676ea056ac50c271cc7d17f61cc2f1def1279c6)
から取得して同梱しています。外部通信には使用しません。

- 原典: [「国土数値情報（行政区域データ）」2021年版（国土交通省）](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2021.html)（SmartNews Media Research Instituteによる取得日: 2021年9月28日）
- 加工・配布: SmartNews Media Research Institute / smartnews-smri
- 本アプリでの加工: GeoJSONを静的バンドルし、SVGパスとして投影して表示。県の境界・属性は変更していません。

出典表記: 上記URLの「国土数値情報（行政区域データ）」（国土交通省）を加工して SmartNews Media Research Institute が公開した都道府県GeoJSONをもとに、kids-playground向けにWeb Mercator投影・SVG表示加工。

国土数値情報の利用条件に従い、出典を表記しています。詳細は元リポジトリおよび国土数値情報の利用規約を参照してください。

## 国旗画像 (public/flags/*.svg)

このアプリの国旗画像は [flag-icons](https://github.com/lipis/flag-icons)
（`flags/4x3/<ISO 3166-1 alpha-2>.svg`）から取得しています。

- プロジェクト: flag-icons
- リポジトリ: https://github.com/lipis/flag-icons
- バージョン: 7.5.0 (npm `flag-icons` パッケージから取得)
- 作者: Panayiotis Lipiridis
- ライセンス: MIT License

flag-icons 本体はこのプロジェクトの依存関係（`package.json`）には追加せず、
必要な国旗SVGファイルのみを `public/flags/` にコピーして同梱しています。

「こっきピンボール」（`src/games/flag-pinball/`）でも、新しい国旗SVGを追加せず、
この一覧の中から選んだ20か国分をそのまま再利用しています。

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

（`npm pack flag-icons@7.5.0` で取得した配布物に含まれる `LICENSE` ファイルの内容をそのまま転記しています。）

### 収録している国旗一覧

`public/flags/` には、`src/games/flag-quiz/data/countries.ts` で使用する
以下105か国分のSVGファイルを収録しています。

```
jp kr cn th in ph vn id tr gb fr de it es ch se ru gr nl
us ca mx br ar pe eg za ke ng au nz sg my mm kh np lk pk
mn tw sa ae il ir kp qa kw jo lb kz bd pt be at no dk fi
is ie pl cz hu ro ua hr rs lu mt mc va sk cu pa cr jm do
gt cl co ve ec bo py uy ma tn dz et gh tz ug sn ci cm mg
zw fj pg ws to bs sb vu fm mh
```
