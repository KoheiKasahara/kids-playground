# クレジット / ライセンス表記

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
