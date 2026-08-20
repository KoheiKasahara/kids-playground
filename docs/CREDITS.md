# クレジット / ライセンス表記

## 世界地図 (world-atlas / countries-50m.json)

世界地図の国境は [world-atlas](https://github.com/topojson/world-atlas) npmパッケージ
**2.0.2** の [`countries-50m.json`](https://unpkg.com/world-atlas@2.0.2/countries-50m.json) を、ビルド時に静的importしてバンドルしています。実行時のCDN・地図API通信は行いません。

- 原典: Natural Earth の 1:50m Cultural Vectors（Admin 0 Countries）
- データ配布: world-atlas / Mike Bostock
- world-atlas のライセンス: ISC License
- Natural Earth の利用条件: [Public Domain](https://www.naturalearthdata.com/about/terms-of-use/)
- 本アプリでの加工: TopoJSONを一度GeoJSON Featureへ展開し、Web Mercator投影・SVGパス化、国別bboxによる表示範囲調整と旅行ルート描画を行います。国境データ自体は変更していません。

## 3D地球儀レンダリング (three-globe)

「ちきゅうぎ」（`src/games/earth-globe/`）の3D地球儀・国ポリゴン描画には
[three-globe](https://github.com/vasturiano/three-globe) npmパッケージ（**2.45.2**）を使用しています。
three.js上に国境ポリゴンを球面表示するためのライブラリで、npm経由でビルド時にバンドルし、実行時のCDN通信は行いません。
表示する国境データは前述の world-atlas、国旗は flag-icons、国名は既存105か国の国マスタを優先し、
不足分を i18n-iso-countries の日本語名から生成しています。three-globe自体は地形データを持ちません。

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

「こっきピンボール」（`src/games/flag-pinball/`）は、この105か国のうち73か国を選んで
再利用しています。残る北マケドニア（`mk.svg`）とブルガリア（`bg.svg`）の2か国は105か国の
マスターに含まれておらず、同じ`flag-icons@7.5.0`の配布物から個別に追加しています（あわせて75か国）。

「こっきドミノ」（`src/games/domino-flag/`）は、この105か国のうち26か国を選んで
再利用していますが、北マケドニア（`mk.svg`）だけは105か国のマスターに含まれておらず、
同じ`flag-icons@7.5.0`の`flags/4x3/mk.svg`から追加しています（こっきピンボールと共通の
ファイルを再利用しており、こっきドミノ専用ではなくなりました）。

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

`public/flags/` には、`src/games/flag-quiz/data/countries.ts` の105か国に加えて、
「ちきゅうぎ」で使用する国を含む以下234ファイルのSVGを収録しています。

```
ad ae af ag ai al am ao ar as at au aw ax az ba bb bd
be bf bg bh bi bj bl bm bn bo br bs bt bw by bz ca cd
cf cg ch ci ck cl cm cn co cr cu cv cw cy cz de dj dk
dm do dz ec ee eg eh er es et fi fj fk fm fo fr ga gb
gd ge gg gh gl gm gn gq gr gs gt gu gw gy hk hm hn hr
ht hu id ie il im in io iq ir is it je jm jo jp ke kg
kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu
lv ly ma mc md me mf mg mh mk ml mm mn mo mp mr ms mt
mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz
om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa ro rs
ru rw sa sb sc sd se sg sh si sk sl sm sn so sr ss st
sv sx sy sz tc td tf tg th tj tl tm tn to tr tt tw tz
ua ug us uy uz va vc ve vg vi vn vu wf ws ye za zm zw
```
