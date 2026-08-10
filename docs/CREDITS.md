# クレジット / ライセンス表記

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
以下100か国分のSVGファイルを収録しています。

```
jp kr cn th in ph vn id tr gb fr de it es ch se ru gr nl
us ca mx br ar pe eg za ke ng au nz sg my mm kh np lk pk
mn tw sa ae il ir kp qa kw jo lb kz bd pt be at no dk fi
is ie pl cz hu ro ua hr rs lu mt mc va sk cu pa cr jm do
gt cl co ve ec bo py uy ma tn dz et gh tz ug sn ci cm mg
zw fj pg ws to
```

## はたらくくるま写真 (public/vehicles/*.webp)

以下の写真はWikimedia Commonsの各ファイルページで作者とライセンスを確認し、配布用に800×600pxのWebPへ加工しています。加工には縮小、中央トリミングまたは余白調整、EXIF除去を含みます。一部の写真はプライバシーと広告性への配慮から、ナンバー、電話番号、企業名を判読できないよう部分的にぼかしています。

CC BY-SAの加工写真は、それぞれ表に示す同じライセンスで配布します。作者・出典の表記は推奨・支持を意味しません。

| ID | Commons原作ファイル | 作者 | ライセンス |
|---|---|---|---|
| `ambulance` | [Krankentransportwagen in Passau.JPG](https://commons.wikimedia.org/wiki/File:Krankentransportwagen_in_Passau.JPG) | High Contrast | [CC BY 3.0 DE](https://creativecommons.org/licenses/by/3.0/de/deed.en) |
| `fire-engine` | [Firefighting trucks and details at Tokyo Fire Museum 5.jpg](https://commons.wikimedia.org/wiki/File:Firefighting_trucks_and_details_at_Tokyo_Fire_Museum_5.jpg) | Syced | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `police-car` | [Guardia di Finanza Alfa Romeo Tonale.jpg](https://commons.wikimedia.org/wiki/File:Guardia_di_Finanza_Alfa_Romeo_Tonale.jpg) | All names i want are taken | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `route-bus` | [Malmö electric bus.jpg](https://commons.wikimedia.org/wiki/File:Malm%C3%B6_electric_bus.jpg) | Barcaviktor25 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `taxi` | [Yellow Taxi.jpg](https://commons.wikimedia.org/wiki/File:Yellow_Taxi.jpg) | Ngô Trung | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `garbage-truck` | [Dustcart (prague).jpg](https://commons.wikimedia.org/wiki/File:Dustcart_(prague).jpg) | 作者情報なし（Commons記載なし） | Public domain |
| `excavator` | [Old excavator.jpg](https://commons.wikimedia.org/wiki/File:Old_excavator.jpg) | Daniel Christensen | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| `bulldozer` | [First Tractor Company - old working model - 01.jpg](https://commons.wikimedia.org/wiki/File:First_Tractor_Company_-_old_working_model_-_01.jpg) | Anna Frodesiak | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `dump-truck` | [Mercedes-Benz Arocs - dump truck version (1).JPG](https://commons.wikimedia.org/wiki/File:Mercedes-Benz_Arocs_-_dump_truck_version_(1).JPG) | High Contrast | [CC BY 3.0 DE](https://creativecommons.org/licenses/by/3.0/de/deed.en) |
| `concrete-mixer` | [コンクリートミキサー車.jpg](https://commons.wikimedia.org/wiki/File:%E3%82%B3%E3%83%B3%E3%82%AF%E3%83%AA%E3%83%BC%E3%83%88%E3%83%9F%E3%82%AD%E3%82%B5%E3%83%BC%E8%BB%8A.jpg) | Syced | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `truck` | [Nufam 2023, Rheinstetten (P1130504).jpg](https://commons.wikimedia.org/wiki/File:Nufam_2023,_Rheinstetten_(P1130504).jpg) | Matti Blume | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)（原作ページの選択可能ライセンス） |
| `tractor` | [Side view of a vintage tractor.JPG](https://commons.wikimedia.org/wiki/File:Side_view_of_a_vintage_tractor.JPG) | High Contrast | [CC BY 3.0 DE](https://creativecommons.org/licenses/by/3.0/de/deed.en) |
| `ladder-truck` | [Volvo FM 460 8x4 Aerial Ladder Platform Fire Truck.jpg](https://commons.wikimedia.org/wiki/File:Volvo_FM_460_8x4_Aerial_Ladder_Platform_Fire_Truck.jpg) | Ethan Llamas | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `mobile-crane` | [Mobile Crane (15754853099).jpg](https://commons.wikimedia.org/wiki/File:Mobile_Crane_(15754853099).jpg) | ozz13x | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |
| `forklift` | [A forklift.jpg](https://commons.wikimedia.org/wiki/File:A_forklift.jpg) | Plenumchamber | Public domain（作者による公開ドメイン化） |
| `road-roller` | [Road roller.png](https://commons.wikimedia.org/wiki/File:Road_roller.png) | Tiia Monto | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `aerial-work-platform` | [Aerial work platform on truck in Russia.jpg](https://commons.wikimedia.org/wiki/File:Aerial_work_platform_on_truck_in_Russia.jpg) | Bernt Rostad | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |
| `tow-truck` | [Tow Truck.jpg](https://commons.wikimedia.org/wiki/File:Tow_Truck.jpg) | Smokinggarden | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `tanker-truck` | [Jelcz662 MSPO2004 PICT0090.jpg](https://commons.wikimedia.org/wiki/File:Jelcz662_MSPO2004_PICT0090.jpg) | Pibwl | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `water-truck` | [Water truck.jpg](https://commons.wikimedia.org/wiki/File:Water_truck.jpg) | mattcatpurple | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) |
| `snowplow` | [Snowplow Car NEXCO.jpg](https://commons.wikimedia.org/wiki/File:Snowplow_Car_NEXCO.jpg) | Cassiopeia sweet | Public domain（作者による公開ドメイン化） |
| `concrete-pump` | [Concrete Pump Truck In Auckland CBD.jpg](https://commons.wikimedia.org/wiki/File:Concrete_Pump_Truck_In_Auckland_CBD.jpg) | Ingolfson | Public domain（作者による公開ドメイン化） |
| `container-truck` | [Transport truck and container.jpg](https://commons.wikimedia.org/wiki/File:Transport_truck_and_container.jpg) | Unknown author | Public domain（U.S. government work） |
| `food-truck` | [Food truck - 4320566611.jpg](https://commons.wikimedia.org/wiki/File:Food_truck_-_4320566611.jpg) | stu_spivack | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) |
