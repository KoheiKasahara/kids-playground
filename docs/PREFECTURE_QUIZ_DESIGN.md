# 「都道府県クイズ」基本設計

## 1. 文書の位置づけ

この文書は、既存コードを調査した時点の「都道府県クイズ」実装設計です。
実装担当はこの設計を出発点とし、実装上の理由で変更した箇所があれば、コードと一致するよう本書も更新します。

## 2. 目的と対象

47都道府県を同等に扱い、幼児から小学校低学年の子どもが、繰り返し遊びながら次の3点を結び付けて覚えられる10問クイズを追加します。

- 都道府県の名前
- 都道府県の輪郭
- 地方内および日本全体での位置

難易度、一部都道府県だけの初心者モード、県ごとのランク付けは設けません。全47都道府県からランダムに出題し、1ゲーム内の正解は重複させません。スコア競争より、正しい名前と形を何度も見て覚える体験を優先します。

最優先端末はスマートフォン縦向きです。320px程度の幅、iPhone SE相当の低い縦画面、一般的なスマートフォン、タブレット、タブレット横向きでも主要操作を見失わないことを受け入れ条件とします。

## 3. 既存リポジトリ調査結果

### 3.1 アプリとルーティング

- React 19 + TypeScript 6 + Vite 8の静的Webアプリで、バックエンドや外部APIはありません。
- `src/main.tsx`は`HashRouter`を使い、GitHub Pagesで直接再読込しても404にならない構成です。
- 全ルートは`src/app/routes.tsx`の`RouteObject[]`に集約されています。
- ホームのゲーム一覧は`src/pages/Home.tsx`の`games`配列から描画されます。
- 既存クイズは開始、むずかしさ選択、プレイ、結果を別URLにしています。ただし本クイズは要求上むずかしさを持たないため、モード選択から直接プレイへ進みます。

### 3.2 4択と出題

- `src/games/quiz-core/questionGenerator.ts`の`generateQuizQuestions<T extends { id: string }>`が、Fisher–Yatesシャッフル、正解のゲーム内重複防止、正解1件＋誤答3件、選択肢の再シャッフルを共通化しています。
- 乱数関数を注入できるため、シード付き乱数で決定的にテストできます。
- `QUESTION_COUNT = 10`、`CHOICE_COUNT = 4`は`src/games/quiz-core/types.ts`にあります。
- 国旗クイズとはたらくくるまクイズの固有問題生成器は、この共通生成器への薄いラッパーです。
- モード1とモード2はこの共通生成器をそのまま利用できます。モード3は4択ではないため、共通の`pickRandom`で正解10件だけを重複なく選び、回答候補は正解が属する地方の都道府県から導出します。

### 3.3 プレイ状態、正誤、結果

- 既存プレイ画面は`useReducer`で`index`、`selectedId`、`correctCount`を管理し、初回回答後は選択肢を無効化します。
- 回答後は正解を緑＋`◯`、選んだ誤答を赤＋`✕`、文言でも結果を示します。
- 10問後は`location.state`に正解数と問題数を渡して結果へ遷移し、stateなしの結果URL直打ちは開始画面へ戻します。
- `src/components/QuizResultOverlay.tsx`は画面下部に`position: fixed`で被さる共通結果パネルです。通常フローを押し下げず、`role="status"`と`aria-live="polite"`を持ちます。
- 呼び出し元は回答前からビューポート条件だけで下部余白を確保し、回答前後で問題や選択肢を動かさない規約です。

### 3.4 共通UIとレスポンシブ

- `BigButton`は標準64px以上のタップ領域、`ProgressBar`は進捗表示を提供します。
- `src/styles/tokens.css`に色、文字、余白、64pxのタップ下限、セーフエリアがあります。
- 各画面は`100dvh`内にセーフエリアを含め、低い縦画面と`max-height: 560px`の横画面を個別に調整しています。
- 画像選択は2×2、低い横画面では4列化する既存パターンがあります。
- `prefers-reduced-motion`はグローバルCSSと結果オーバーレイで尊重されています。

### 3.5 音声と効果音

- TTSまたは`SpeechSynthesis`による問題文・答えの読み上げは、現行コードにはありません。
- `src/utils/quizSound.ts`はWeb Audio APIで正解音、不正解ブザー、パネル音を合成し、音声ファイルなしでオフライン動作します。
- 本クイズは既存の`playCorrectSound()`を再利用します。不正解時は強い「ブブー」を避けるUX方針のため、既存の`playIncorrectSound()`は呼ばず、視覚表示と`role="status"`で「おしい！」と正解を伝えます。
- TTSは既存基盤がないため今回新設しません。将来アプリ全体の読み上げ設定を導入するときに、共通ユーティリティとして追加します。

### 3.6 PWA、素材、テスト、CI

- `vite-plugin-pwa`のWorkboxが、ビルドされたJS/CSS/HTMLとSVG、PNG、WebP等をprecacheします。
- `registerType: 'prompt'`のため、遊んでいる途中にService Worker更新で強制再読込されません。
- 地図データを`src`から静的importしてJSバンドルへ含めれば、現行`globPatterns`を変えずにオフライン利用できます。
- Vitest + React Testing Library + jsdomのUnit / Component Testがあります。PlaywrightなどのE2E基盤はありません。
- CIはNode 22で`lint`、全テスト、Pages向けビルドを実行します。通常ビルドはローカル品質ゲートとして別途実行します。

## 4. モード、URL、画面遷移

### 4.1 モード

| 内部名 | 表示 | 問題 | 回答 |
| --- | --- | --- | --- |
| `shapeToName` | かたち → なまえ | 都道府県の輪郭 | ひらがなの県名4択 |
| `nameToShape` | なまえ → かたち | ひらがなの県名 | 輪郭4択 |
| `nameToMap` | なまえ → ちず | ひらがなの県名 | 拡大した地方地図上の県 |

### 4.2 URL

```text
/games/prefecture-quiz
/games/prefecture-quiz/shape-to-name/play
/games/prefecture-quiz/shape-to-name/result
/games/prefecture-quiz/name-to-shape/play
/games/prefecture-quiz/name-to-shape/result
/games/prefecture-quiz/name-to-map/play
/games/prefecture-quiz/name-to-map/result
```

むずかしさを設けないため、`:level`とむずかしさ選択URLは作りません。モード値はルート定義側で固定し、未知URLは既存の`*`ルートからホームへ戻します。結果URLに正しいstateがなければ`/games/prefecture-quiz`へ`replace`で戻します。

```text
ホーム → モード選択 → 10問プレイ → 結果
             ↑              │
             └ 別のクイズ ──┘
```

結果画面は、同じモードでもう一度、別モード、ホームの3経路を持ちます。「べつの むずかしさ」は表示しません。

## 5. 画面・操作仕様

### 5.1 ホームと開始画面

- ホームに`🗾 とどうふけんクイズ`のカードを追加します。
- 開始画面はタイトル、「ぜんぶで 10もん あるよ」、3モード、ホームへ戻る操作を表示します。
- 低い横画面は4ボタンを2列×2行にします。

### 5.2 共通プレイ枠

- ヘッダーは「やめる」、`現在 / 10`、`ProgressBar`を表示します。むずかしさラベルは表示しません。
- 画面文言、問題、選択肢、地図は回答前後で同じ領域を占めます。
- 回答後は再回答を禁止し、正解箇所と選んだ誤答を色＋記号で示します。
- 共通`QuizResultOverlay`に正誤、正しいひらがな名、次の操作を表示します。
- 不正解文言だけ任意指定できる後方互換prop（例:`wrongLabel`、既定値は現行の「ざんねん！」）を`QuizResultOverlay`へ追加し、本クイズでは「おしい！」を渡します。既存ゲームの表示は変えません。
- 最終問では「つぎのもんだい」を「けっかを みる」に変えます。

### 5.3 モード1: 県の形 → 県の名前

- 見出しは「この かたちは なーんだ？」です。
- 輪郭SVGを中央の固定ステージ内に、各県の縦横比を保って最大化します。
- 県名4択は`BigButton`を使い、正解1件と他県3件を重複なしで表示します。
- 正解位置は問題ごとにシャッフルします。
- 県名は`nameHiragana`をそのまま表示し、「県」だけを別途足しません。

### 5.4 モード2: 県の名前 → 県の形

- 見出しは「{nameHiragana} は どれ？」です。
- 輪郭4択を基本2列×2行にし、それぞれをネイティブ`button`にします。
- 各ボタンは県ごとに独立した`viewBox`で輪郭を最大化します。北海道と香川県を並べても実面積比では縮小せず、形の認識を優先します。
- 回答前のボタンには県名を表示せず、アクセシブルネームも「1ばんめの かたち」のような位置ベースにして答えを漏らしません。
- 回答後は正解輪郭を緑＋`◯`、選んだ誤答を赤＋`✕`で示し、オーバーレイに正しい県名を表示します。

### 5.5 モード3: 県の名前 → 地図上の場所

- 見出しは「{nameHiragana} は どこ？」です。
- 日本全図を回答面にはせず、対象県が属する地方だけを固定ステージいっぱいに表示します。
- 同じ地方の全都道府県を個別SVG pathとして表示し、境界線を十分なコントラストで描きます。
- 各県pathはクリック・タッチに加え、`role="button"`、`tabIndex={0}`、Enter / Spaceで回答可能にします。回答前のアクセシブルネームは位置ベース、回答後は県名を含めます。
- **地図の下に、同じ地方の全都道府県ぶんの数字ボタン列（`PrefectureNumberPad`）を常設します。** 京都府など小さい県はスマホで地図を正確にタップしづらいため、地図タップと数字ボタンの両方から確実に回答できるようにし、子どもが「押せるか」ではなく「分かっているか」で答えられるようにします。
  - 番号は地方内の都道府県を都道府県コード順に並べたときの`index+1`で固定します（`data/regions.ts`の`numberedPrefecturesForRegion` / `prefectureNumberInRegion`）。ハードコードした番号表は持たず、問題が変わっても同じ地方なら同じ番号になります。
  - 主図上の各県、および沖縄専用insetには、その固定番号を表す番号バッジ（円+数字、`pointer-events: none`）を常時重ねて表示します（`PrefectureMap`の`numbered`prop）。バッジの座標は`map/labelPlacement.ts`の純粋関数`labelPositionsFor`が計算し、県ごとのif文・座標ハードコードは行いません（主要polygonのbbox中心をアンカーにし、細長い/小さい県は外向きにずらし、重なる組は反復して押し離し、最後にviewBox内へクランプします）。
  - 地図タップも数字ボタンも同じ回答処理（`select(id)`）を呼び、正誤判定・効果音・オーバーレイに差を出しません。
  - 数字ボタンのアクセシブルネームは、回答前は「◯ばん」、回答後は「◯ばん ○○けん」のように県名を含めます（地図pathの「◯ばんめ の ばしょを えらぶ」とは別の文言にして混同を避けます）。
  - 回答後は数字ボタン・地図pathの両方をロックします。数字ボタンは正解=緑、選んだ誤答=赤、その他=灰色で示し、正解ボタンには`◯`、選んだ誤答には`✕`を絶対配置で重ねます（回答前後でボタンの寸法・位置は変わりません）。地図側の番号バッジも数字は消さず、正解県のバッジに緑の輪郭、選んだ誤答のバッジに赤の輪郭を付けます。
  - 320px実測で東京・大阪・香川・京都を含む全県について、地図タップと数字ボタンのどちらでも回答できることを確認します。
- 小さい都府県は地方ごとの表示範囲を詰め、まず見た目そのものを大きくします。かつては関東・近畿・九州の狭い県だけに専用の補助タップ枠を出していましたが、地方ごとに対象が異なり子どもにとって一貫しない導線になるため廃止し、上記の数字ボタン列に統一しました。
- 回答後は正解県を緑＋`◯`で強調し、選んだ誤答は赤＋`✕`で示します。
- 同じ固定ステージ内に小さな日本全図カードを重ね、「にほんでは このへん！」と正解県を強調します。通常フローの高さは変えず、地方内と日本全体の位置を同時に確認できます。
- 日本全図カードは回答後から次へ進むまで表示します。軽いフェードを使い、`prefers-reduced-motion`ではアニメーションなしで即時表示します。

## 6. 正解・不正解UX

- 正解: 「🎉 せいかい！」、正しいひらがな名、既存の正解音、軽い強調アニメーション。
- 不正解: 「おしい！」、正しい県を緑で強調、選択した県を赤＋`✕`、正しいひらがな名。強いブザーは鳴らしません。
- 色だけに依存せず、記号、文、`role="status"`を併用します。
- 次の問題へ自動遷移せず、子どもが答えを見てから大きなボタンで進みます。
- スコアは結果で`正解数 / 10`を示すだけとし、ランキングや県別評価は行いません。

## 7. 都道府県データ

### 7.1 型

```ts
type RegionId =
  | 'hokkaido'
  | 'tohoku'
  | 'kanto'
  | 'chubu'
  | 'kinki'
  | 'chugoku'
  | 'shikoku'
  | 'kyushuOkinawa'

type PrefectureId =
  | '01' | '02' | '03' // ...
  | '45' | '46' | '47'

type Prefecture = {
  /** JIS X 0401の2桁都道府県コード */
  id: PrefectureId
  /** 例: 新潟県 */
  nameKanji: string
  /** 例: にいがたけん */
  nameHiragana: string
  region: RegionId
  /** GeoJSON featureのN03_001と照合する識別子 */
  mapFeatureName: string
}
```

47件を`readonly Prefecture[]`として`data/prefectures.ts`に置きます。問題文はひらがな、クレジットやデータ照合は漢字名を使います。`id`、2種類の名前、`mapFeatureName`は全件一意とし、地図featureと1対1であることをテストします。

将来の県庁所在地・名産・場所・自然・有名なもの・豆知識は、使う機能を追加する時点で次のような任意データを足せる構造にします。今回、空の詳細オブジェクトを47件へ複製しません。

```ts
type PrefectureFacts = {
  capital?: string
  foods?: readonly string[]
  landmarks?: readonly string[]
  nature?: readonly string[]
  famousThings?: readonly string[]
  kidFacts?: readonly string[]
  associationHints?: readonly string[]
}
```

連想クイズ追加時は`Prefecture`の基本情報を維持したまま、`PrefectureId`をキーにした別の詳細データ、または`facts?: PrefectureFacts`を追加します。今回の3モードは詳細情報へ依存させません。

### 7.2 地方区分

既存コードに地方区分はないため、一般的な8地方区分を1か所に定義します。

| ID | 表示名 | 都道府県 |
| --- | --- | --- |
| `hokkaido` | ほっかいどう | 北海道 |
| `tohoku` | とうほく | 青森、岩手、宮城、秋田、山形、福島 |
| `kanto` | かんとう | 茨城、栃木、群馬、埼玉、千葉、東京、神奈川 |
| `chubu` | ちゅうぶ | 新潟、富山、石川、福井、山梨、長野、岐阜、静岡、愛知 |
| `kinki` | きんき | 三重、滋賀、京都、大阪、兵庫、奈良、和歌山 |
| `chugoku` | ちゅうごく | 鳥取、島根、岡山、広島、山口 |
| `shikoku` | しこく | 徳島、香川、愛媛、高知 |
| `kyushuOkinawa` | きゅうしゅう・おきなわ | 福岡、佐賀、長崎、熊本、大分、宮崎、鹿児島、沖縄 |

県の`region`を唯一の所属定義とし、地方ごとの県配列を別途手書きしません。`RegionId`ごとの表示名、順序、地図viewBox / inset設定だけを`data/regions.ts`に置き、所属県は`prefectures.filter()`で導出します。

この区分の目的は操作しやすい拡大表示です。九州・沖縄、東京都・鹿児島県など遠隔離島を含む範囲は、同じ座標データを変形せず、主図と補助insetの複数クロップで表示します。地方所属を分割したり、島を別県として扱ったりしません。

## 8. SVG・地図データ

### 8.1 採用データ

SmartNews Media Research Instituteの`japan-topography`が公開する、都道府県GeoJSON簡素化0.1%版を固定コミットから取得してローカル同梱します。

- 配布元: <https://github.com/smartnews-smri/japan-topography>
- 対象ファイル: `data/municipality/geojson/s0001/prefectures.json`（約317KB、47 MultiPolygon）
- 固定コミット: `b676ea056ac50c271cc7d17f61cc2f1def1279c6`（2022-03-07）
- 原典: 国土交通省「国土数値情報（行政区域データ）」
- 原典ページ: <https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2021.html>（データ基準年2021年、SmartNews Media Research Institute取得日2021-09-28）
- 利用規約: <https://nlftp.mlit.go.jp/ksj/other/agreement.html>

このデータは国土数値情報（行政区域）を加工・簡素化したもので、配布元は商用・非商用を問わず無償利用可としつつ、国土交通省指定の出典表記を求めています。実装時に`docs/CREDITS.md`へ、配布元、固定コミット、原典、利用規約、アプリ側の加工内容を記録します。表記例は次の趣旨とします。

> 「国土数値情報（行政区域データ）」（国土交通省）を加工してSmartNews Media Research Instituteが公開した都道府県GeoJSONをもとに、kids-playground向けに投影・表示加工

Geolonia `japanese-prefectures`も調査しましたが、GFDLで、一部離島を省略していることを配布元が明記しているため、地理教材としての正確性とライセンス運用の簡潔さから採用しません。画像生成AIで地図や輪郭を作りません。

### 8.2 管理と描画

- GeoJSONはJSON moduleとして読めるよう`src/games/prefecture-quiz/data/prefectures.json`へ同梱して静的importし、外部fetchやホットリンクを行いません。
- TypeScriptからJSON importするため、必要なら`tsconfig.app.json`に`resolveJsonModule: true`を追加します。
- `N03_001`の漢字県名を`mapFeatureName`と照合し、47 featureをアプリの`PrefectureId`へ正規化します。
- 緯度経度を小さな純粋関数でWeb Mercator相当のSVG座標へ投影し、MultiPolygonを`fill-rule="evenodd"`のpathへ変換します。描画ライブラリや実行時ネットワークは追加しません。
- GeoJSON featureの照合と、主図／insetへ分けたgeometryはモジュール単位でキャッシュします。`d`とboundsは表示する地方・viewBoxに依存するため、各表示サイズに合わせて純粋関数で計算します。
- 同じ47 featureから、対象1県、地方内の県、全国47県をfilterして描画します。47枚の別SVGは作りません。
- 単県と4択は県ごとのboundsから余白付き`viewBox`を作り、各枠へ独立してfitします。
- 地方と全国は共有座標のまま描き、地方ごとのviewBoxで拡大します。
- 遠隔離島は同じpathの別クロップをinset表示します。輪郭点を生成・変形せず、どのinsetを見せるかだけをレイアウトメタデータで管理します。
- SVGは装飾ではなく問題・回答UIです。問題輪郭には答えを漏らさない代替説明、回答後には県名を含む説明を付けます。

## 9. コンポーネントと共通化

### 9.1 再利用する既存コード

- `generateQuizQuestions`、`pickRandom`、`QUESTION_COUNT`、`CHOICE_COUNT`
- `BigButton`、`ProgressBar`、`QuizResultOverlay`
- `playCorrectSound`
- CSSトークン、セーフエリア、`prefers-reduced-motion`規約
- `HashRouter`、結果state検証、PWA更新方式

### 9.2 ゲーム内で共通化するもの

- `PrefectureMap`: 同じpathデータを単県、地方、全国で描画する中核SVG。表示対象、viewBox、選択可否、選択・正解・強調状態をpropsで受けます。
- `PrefectureShape`: `PrefectureMap`の単県表示用の薄いラッパー。問題と4択で同じfit処理を使います。
- `PrefectureQuizPlay`: 3モード共通の10問進行、正解数、回答ロック、結果遷移、オーバーレイを管理します。
- モード固有の問題表示は小さな描画コンポーネントまたは関数へ分け、プレイ状態を複製しません。
- `generateChoiceQuestions`は共通4択生成器の薄いラッパー、`generateMapQuestions`は`pickRandom`と地方導出だけを担当します。

`FlagQuizPlay`など既存ゲームを今回のために汎用プレイ画面へ移す大規模リファクタリングは行いません。既存コードのコピー＆ペーストを避けつつ、変更範囲は都道府県ゲームと小さな後方互換拡張に限定します。

## 10. レスポンシブ方針

- ルート要素は`min-height: 100dvh`、セーフエリア込みpadding、横スクロールなしを維持します。
- 320〜639px縦: 余白と見出しを詰め、地図・輪郭へ残り高を優先配分します。名前4択は1列、形4択は2×2です。
- 背の低い縦画面: ヘッダー、見出し、選択肢gapを縮小します。結果パネルは既存のスマホ横並びを使い、回答後に主要操作が隠れない固定余白をモード別に設定します。
- 640px以上: コンテンツ最大幅を地図モードだけ適度に広げ、形4択は2×2のまま過度に横へ伸ばしません。
- 低い横画面: ヘッダーの下を「問題・輪郭または地図」と「選択肢」の2カラムにし、4択は4列または2×2を実測で選びます。
- タブレット横向き: 最大幅を設け、SVGが画面全幅へ不自然に引き伸ばされないよう中央配置します。
- SVGには`width: 100%`、`height: 100%`、適切な`preserveAspectRatio`を使います。
- 主要検証サイズは320×568、375×667、390×844、768×1024、1024×768です。

## 11. PWA・オフライン

- GeoJSONを`src`からimportしてJSバンドルに含めるため、実行時ネットワークは不要です。
- JSバンドルは現行Workboxのprecache対象なので、JSON拡張子を`globPatterns`へ追加する必要はありません。
- 地図を`public`の独立JSONへ変更した場合だけ、`json`をprecache対象へ追加し、base相対パスと生成Service Worker内の登録をテストします。
- 新しい画像・音声ファイルは追加しません。Workboxの最大ファイルサイズは引き上げません。
- 通常base `/`とPages base `/kids-playground/`の両方で確認します。

## 12. テスト方針

### 12.1 データ・地図Unit Test

- `prefectures`が47件で、IDが`01`〜`47`、ID・漢字名・ひらがな名・map識別子が一意。
- 全県が有効な`RegionId`を1件だけ持ち、地方別件数が1 / 6 / 7 / 9 / 7 / 5 / 4 / 8、合計47。
- GeoJSONが47 featureで、全`mapFeatureName`と1対1に対応し、余剰・欠落がない。
- 全featureが空でないMultiPolygon、有限座標、空でないSVG pathと正のboundsへ変換できる。
- 県名→形で正しい`PrefectureId`のpathが使われる。
- 地方mapが対象地方の全県だけを含み、対象県pathを選択できる。
- inset対象を含め、全国mapに47県すべてが存在する。
- `numberedPrefecturesForRegion`は8地方すべてで番号が1..nの連番・重複なし・県数と一致し、同じ地方を2回呼んでも同じ対応になる（固定であること）。
- `columnsForCount` / `tightColumnsForCount`が想定どおりの列数を返し、最大9件（中部地方）でも通常時3列3行、tight時2行以内になる。
- `labelPositionsFor`が8地方すべてで全県ぶんの座標を返し、バッジ同士が近すぎず、viewBox内に収まり、同じ入力で同じ出力になる（決定的）。

### 12.2 問題生成Unit Test

- 全47県が出題プールに入り、フィルタやランクがない。
- モード1/2は10問、各4択、正解がちょうど1件、選択肢重複なし、正解問題重複なし。
- 複数seedで正解位置が固定されず、入力配列を破壊しない。
- モード3は10問の正解重複なし、各問の地方候補に正解が1件だけ含まれ、他地方を含まない。

### 12.3 Component Test

- ホームカードと開始画面の3モード。
- モード1の輪郭、県名4択、正解・不正解、「おしい！」、10問完了。
- モード2の県名、名前を漏らさない輪郭4択、SVG対応、2×2構造、10問完了。
- モード3の県名、地方map、個別path回答、正解県強調、日本全図カード、10問完了。
- モード3の数字ボタン列（`PrefectureNumberPad`）が地方の県数ぶんちょうど描画され、番号1〜n（最大9件）にアクセシブルネームが付く。
- モード3で数字ボタンから正解・不正解の両方を選べ、地図pathの正誤表示と一致する。
- モード3で地図タップと数字ボタンが同じ回答処理を使い、回答後は地図path・数字ボタンの両方がロックされる。
- 回答後の全選択肢無効化、二重回答防止、正解数、再挑戦、別モード、ホーム。
- `role="status"`、位置ベースのアクセシブルネーム、Enter / Space回答。
- stateなし結果URLの安全な戻り。
- 回答前後でページルートと固定ステージのclass / 寸法が変わらないこと。

### 12.4 レスポンシブ・操作性・PWA

jsdomは実レイアウトを計測しないため、次は実ブラウザの受け入れ確認項目とします。既存リポジトリにE2E基盤はないので、この機能だけのためにPlaywrightを導入しません。

- 320×568と375×667の縦画面で、問題、回答、次へ、やめるが画面外へ出ない。モード3では地図（最小高さ170px前後）と最大9個の数字ボタン（狭小画面でも1個56px以上、`--pad-columns-tight`で2行以内）が両方収まる。
- 横向き低画面（高さ560px以下）では、モード3の問題文を上段、地図とパッド（数字ボタンは48px以上）を下段2カラムに収める。
- 東京、大阪、香川、佐賀、京都を含む全地方で、見える県をタップでき、透明ヒット領域が隣県へ重ならない。京都のように地図タップが難しい小さい県でも、数字ボタンから確実に回答できる。
- 遠隔離島を含む東京、鹿児島、沖縄が極端に縮まず、insetが県の所属を誤解させない。
- タブレット横向きで地図や輪郭が不自然に引き伸ばされない。
- キーボードフォーカスが見え、モーション低減で演出が止まる。
- `npm run build`後の`dist/sw.js`またはprecache manifestに地図を含むJSチャンクが入り、オフラインで3モードを開始・進行できる。

### 12.5 品質ゲート

```bash
npm run lint
npm test
npm run build
GITHUB_PAGES=true npm run build:pages
```

既存の国旗、はたらくくるま、さんすう、PWAテストを含む全テストを実行します。通常ビルドとPagesビルドでWorkbox警告がないことを確認します。

## 13. 実装対象ファイル（計画）

```text
src/games/prefecture-quiz/
├─ data/
│  ├─ prefectures.ts
│  ├─ prefectures.test.ts
│  ├─ prefectures.json       # 内容はGeoJSON FeatureCollection
│  └─ regions.ts
├─ map/
│  ├─ geometry.ts
│  ├─ geometry.test.ts
│  ├─ PrefectureMap.tsx
│  ├─ PrefectureMap.module.css
│  ├─ PrefectureMap.test.tsx
│  ├─ PrefectureShape.tsx
│  └─ PrefectureShape.module.css
├─ PrefectureQuizStart.tsx
├─ PrefectureQuizStart.module.css
├─ PrefectureQuizPlay.tsx
├─ PrefectureQuizPlay.module.css
├─ PrefectureQuizResult.tsx
├─ PrefectureQuizResult.module.css
├─ PrefectureQuiz.test.tsx
├─ questionGenerator.ts
├─ questionGenerator.test.ts
└─ types.ts

src/app/routes.tsx
src/pages/Home.tsx
src/pages/Home.test.tsx
src/components/QuizResultOverlay.tsx
src/components/QuizResultOverlay.test.tsx
tsconfig.app.json                         # JSON importが必要な場合のみ
docs/CREDITS.md
docs/PREFECTURE_QUIZ_DESIGN.md
README.md
```

ファイル数は実装中に、責務が小さい場合に限って統合して構いません。既存ゲームのプレイ・結果コードは変更せず、`QuizResultOverlay`の後方互換prop以外の共通コード変更は原則不要です。`vite.config.ts`はGeoJSONをバンドルする設計なら変更しません。

## 14. 実装順序と引き継ぎ

1. 47県マスタ、地方区分、GeoJSON同梱、クレジットを追加する。
2. GeoJSON検証、投影、path / bounds生成の純粋関数とUnit Testを作る。
3. 単県・地方・全国を同じデータで描く`PrefectureMap`とテストを作る。
4. 4択とmap問題生成器、データ完全性テストを作る。
5. 開始、3モード共通プレイ、結果、レスポンシブCSSを実装する。
6. `QuizResultOverlay`へ後方互換の「おしい！」指定を追加する。
7. ホーム、ルート、Component Testを統合する。
8. lint、全テスト、通常ビルド、Pagesビルド、実ブラウザの各viewport、オフラインを確認する。
9. 実装と異なる判断を本書へ反映する。

実装担当からレビュー担当への引き継ぎには、実変更ファイル、設計との差分と理由、地図の固定コミットと加工、実行テストと結果、手動viewport確認、未解決事項を含めます。

## 15. 今回実装しないもの

- 難易度、一部県だけの初心者モード、県別ランク
- パネルめくり
- 連想クイズ
- 県庁所在地、名産品、写真を使うクイズ
- プレイ履歴、県別成績、ランキング
- TTS（既存共通基盤がないため）
- 新しいE2Eテスト基盤
- 既存ゲーム全体のプレイ状態・結果画面の大規模共通化

## 16. レビュー時の重点

- 47県マスタ、JISコード、ひらがな、地方、GeoJSON対応に欠落・誤りがないか。
- 3モードが難易度なしで全47県を同等に扱うか。
- 単県、地方、全国が1つの地図データを参照しているか。
- 地方mapで東京・大阪・香川等を実際に選択でき、誤判定を作るヒット領域がないか。
- 320px級、iPhone SE相当、タブレット横向きで主要操作が隠れないか。
- 回答前後のレイアウトシフト、強すぎる不正解演出、答えを漏らすアクセシブルネームがないか。
- PWA・GitHub Pages・既存ゲームに回帰がないか。
- 地図の出典、固定コミット、加工内容、利用規約が`docs/CREDITS.md`に記録されているか。
- 本書と最終コードが一致しているか。

## 17. 実装記録（2026-08-11）

- 実装したURLは設計どおり難易度パラメータなしの7本です。47都道府県から重複なしの10問を出題します。
- `prefectures.json` は SmartNews Media Research Institute の固定コミット
  `b676ea056ac50c271cc7d17f61cc2f1def1279c6` にある
  `data/municipality/geojson/s0001/prefectures.json` をそのまま `src` に同梱しました。
  実行時のネットワーク通信はありません。
- SVG投影・path生成は外部地図ライブラリを使わず `map/geometry.ts` でWeb Mercator相当として実装しています。
  東京都・鹿児島県・沖縄県は全polygonを保持し、主図に加えて遠隔離島を補助insetへ描画します。
  九州・沖縄地方の主図は九州本土のboundsにfitし、沖縄は補助insetへ配置します。元のGeoJSONは変更していません。
- `regions.ts` は県が持つ唯一の`region`から地方候補を導出し、地方名だけを保持します。
  `PrefectureMap.test.tsx` は `PrefectureQuiz.test.tsx` と `geometry.test.ts` に統合しています。
- `regions.ts`には、地方主図から切り離す沖縄専用insetと、関東・近畿・九州の狭い県向け補助タップ枠も明示します。
  補助枠は主図上の番号と対応し、他県のpathに重ならない下部レールに置きます。
- 正解・不正解表示には既存の `QuizResultOverlay` を使い、不正解文言のみ任意の
  `wrongLabel` propで「おしい！」へ切り替えます。TTSは既存アプリにないため追加していません。

## 18. 実装記録（2026-08-11 追記: なまえ→ちずの回答UI改善）

京都府など小さい県はスマホで地図を正確にタップしづらいため、地図タップは残したまま
「地方内の全都道府県に固定番号を振り、下部の数字ボタンからも確実に回答できる」ように
モード3（名前→地図）の回答UIを改善しました。子どもが「押せるか」ではなく
「分かっているか」で答えられることを目的とします。

- 廃止: 関東・近畿・九州の狭い県だけに出していた補助タップ枠（`REGION_TOUCH_TARGET_IDS`、
  下部の見える四角ヒット領域）。地方ごとに対象県が異なり一貫性がないため、全県共通の
  数字ボタン列に置き換えました。地図上の`mapMarker`テキストも廃止しています。
- 番号の決め方: `data/regions.ts`の`numberedPrefecturesForRegion(region)` /
  `prefectureNumberInRegion(prefecture)`が、地方内の都道府県を**都道府県コード順**に
  並べたときの`index+1`を返します。地方ごとにメモ化し、ハードコードした番号表は
  持ちません。問題が変わっても同じ地方なら同じ番号になります。
- 地図側: `PrefectureMap`に`numbered`prop（既定false）を追加しました。trueのとき、
  主図の各県と沖縄専用insetに番号バッジ（円+数字の`<g>`、`pointer-events: none`）を
  常時表示します。バッジ座標は新規`map/labelPlacement.ts`の`labelPositionsFor`が
  純粋関数として計算します。県ごとのif文・座標ハードコードはせず、
  (1) 県のmain geometryのうち投影後bbox面積が最大のpolygonのbbox中心をアンカーにし
  （離島に引っ張られて海上に出るのを防ぐ）、
  (2) 細長い・小さい県はitems全体の中心から外向きにずらし、
  (3) バッジ同士が近すぎる組を反復して押し離し（アンカーからの移動量は`maxShift`で頭打ち）、
  (4) 最後にviewBoxの内側へpadding付きでクランプします。
  定数（`minDistance`、`maxShift`など）は`LabelPlacementOptions`として外出しし、
  8地方すべての実データでテストが通ることを確認済みです。
  既存のアクセシブルネーム「◯ばんめ の ばしょを えらぶ」の文言・番号値は
  itemsが単一地方のときは地方内の固定番号と一致するため変更していません。
- 数字ボタン: 新規`PrefectureNumberPad.tsx`が地方の県数ぶんのネイティブ`<button>`を
  `role="group"`でまとめて描画します。列数は新規`numberPadLayout.ts`の
  `columnsForCount` / `tightColumnsForCount`（純粋関数）がCSS変数
  `--pad-columns` / `--pad-columns-tight`として渡り、画面サイズに応じて
  メディアクエリ側でどちらを使うか切り替えます。9県（中部）でも通常時3×3、
  縦積みが厳しい画面では2行（5+4）に収まります。
- 地図タップ・数字ボタンのどちらも`PrefectureQuizPlay`の同じ`select(id)`を呼ぶため、
  正誤判定・効果音・オーバーレイの分岐は増やしていません。
- レスポンシブ: `.mapAnswer`（地図+数字パッド+ヒントのラッパー）を導入したことで
  既存の`.body > svg[data-prefecture-map]` / `.body > .question + svg`セレクタが
  モード3に当たらなくなるため、`.mapAnswer > svg[data-prefecture-map]` /
  `.body > .question + .mapAnswer`基準に書き直しました。他2モード用のセレクタ
  （`.body > svg:not([data-prefecture-map])`、`.body > svg:first-child`等）は
  そのまま残り、テストと目視で回帰がないことを確認しています。
  地図は`.mapAnswer`内で`flex: 1 1 auto`とし、`height`（`min(28dvh, 300px)`等）を
  初期高さ、`min-height` / `max-height`を下限・上限として、余った縦スペースを
  地図が吸い上げます。数字パッドとヒントは自然高さのままです。
  このとき`.page`が`min-height: 100dvh`（ハグ・コンテンツ）のままだと、子の
  flex-growが「伸びた`.page`自身」を基準に計算されて収束せずはみ出すため、
  `.page:has(.mapAnswer)`にだけ`height: 100dvh`を与えて実ビューポート基準にしています。
  数字パッドの列数は`PrefectureNumberPad.module.css`が`max-height: 820px`を境に
  `--pad-columns-tight`へ切り替え、「普通の縦持ちスマホ」でも9県が2行に収まります。
  タップ領域は通常64px、iPhone SE相当（幅480px以下かつ高さ620px以下）で56px、
  横向き低画面で48pxを下限とし、収めるためにこれ以上小さくはしません。
  横向き低画面（高さ560px以下）では問題文を上段、地図とパッドを下段2カラムに配置し、
  `:has()`で名前→地図のときだけ問題文を2カラム分にスパンさせています
  （このとき`.mapAnswer`自体がgridになるため、地図の縦flex伸縮は無効化して
  固定高さクランプに戻します）。タブレット以上（768px以上）では数字パッドに
  `max-width: 480px`を設けて中央寄せにし、ボタンが間延びしないようにしています。
- 下部余白（`--feedback`）は既定185pxですが、`QuizResultOverlay`の実高は
  幅640px以上で縦積みレイアウトになる分と「にほんでは このへん！」locatorの分だけ
  超えるため（実測: 1024×768で約224px）、`.page:has(.mapAnswer)`にだけ
  幅640px以上かつ高さ561px以上で240px、iPhone SE相当で150pxへ広げ、
  回答後にオーバーレイが数字パッドへ被らないようにしています。
  回答したかどうかでは値を変えないため、回答前後でレイアウトは動きません。
- 地方地図のfit範囲を2点見直しました（いずれも実ブラウザでの目視で判明した既存の課題）。
  - `localProject`の高さは、廃止した補助タップ枠レール用に空けていた218pxをやめ、
    沖縄専用insetを持つ九州・沖縄地方だけ218px、他7地方はviewBox全高280pxを使います
    （`REGION_MAP_HEIGHT_WITH_INSET` / `REGION_MAP_HEIGHT_FULL`）。各県の描画が
    縦に約28%大きくなり、小さい県とバッジが読みやすくなります。
  - 地方地図のスケール計算に`geometry.ts`の`primaryProjectedBounds`（投影後bbox面積が
    最大のpolygonのboundsだけを返す）を使います。東京都のmain pieceは伊豆諸島を
    選択可能なまま含むため、全polygonのbboxでfitすると関東地方全体が離島の緯度幅に
    引っ張られて極端に小さく描かれていました。描画・ヒット領域は従来どおり
    全polygonを使うため、離島が選べなくなることはありません。
- 実ブラウザ確認: 320×568 / 375×667 / 390×844 / 430×932 / 768×1024 / 1024×768 と
  横向き（667×375）で、9県の中部地方を出題した状態の回答前・回答後それぞれについて、
  縦横のはみ出しがないこと、数字ボタンの実測高さとgap、全要素がビューポート内に
  収まること、オーバーレイが数字パッドに被らないことを確認しました。
  この確認はローカルのChromiumで行い、E2E基盤（Playwright等）はリポジトリへ
  追加していません。

## 19. 実装記録（2026-08-11 追記: 横画面レイアウトの拡張）

横画面（landscape）で問題文と選択肢が画面中央付近に小さくまとまり、左右・下部に
大きな余白ができる問題を修正しました。対象は`PrefectureQuizPlay.module.css`のみで、
縦画面（portrait）向けのCSSは一切変更していません（差分は全て
`@media (orientation: landscape)`系のブロック内に収まっています）。

- `.page`のmax-widthを、横向きだけ`min(92vw, 1100px)`に広げました（縦画面は既存の
  `--content-max-width`(640px)のまま）。
- `.body`を「問題文 約38% / 選択肢 約62%」の2カラムgridにし、なまえ→ちずは
  従来どおり問題文を上段・地図とパッドを下段2カラムに配置します（既存の横向き低画面
  ブロックにあった構造をそのまま踏襲し、対象をタブレット横向きまで広げました）。
- 輪郭SVG・4択カード・文字ボタン・地図・問題文の寸法は、固定pxではなく
  `clamp(下限px, Xdvh, 上限px)`で高さに追従させています。固定ブレークポイントを
  高さごとに何段も用意する代わりに、1本のグリッドでスマホの横向き（低背）から
  タブレットの横向き（高背）まで連続的にカバーします。
- `grid-template-rows`は`auto 1fr`ではなく`auto auto`にし、`.body`へ
  `align-content: center`を付けました。1frの行にすると余った縦スペースが最後の行
  （多くの場合コンテンツの下）だけに溜まり、「横画面なのに中身が上寄りで下が
  大きく空く」問題が起きるためです。行をどちらもcontent-sizedにしておき、
  `align-content: center`で「コンテンツのかたまり」ごと`.body`の縦中央へ寄せることで、
  余白は上下へ均等に配分されます。
- ヘッダー・進捗のクローム縮小（`--feedback`・padding・フォントサイズ）は、内容の
  拡大とは別に`@media (orientation: landscape) and (max-height: 650px)`で行います。
  以前は`max-height: 560px`でクロームとコンテンツ寸法を同時に切り替えていましたが、
  そのままコンテンツ側をdvhベースの連続値にすると、560px超〜650px前後の高さで
  「クロームは大きい（縮小されない）のにコンテンツはdvh計算上すでに大きい」状態が
  重なってはみ出す境界がありました。クロームの縮小幅を650pxまで広げることで、
  この境界を安全な余裕のある位置までずらしています。`--feedback: 54px`
  （`QuizResultOverlay`の横向き1行化と対になる値）だけは、そのファイル側の
  切り替え高さ（560px）に合わせて別ブロックのまま560px以下に限定しています。
- 数値は「実機プリセット（iPhone SE/標準/Pro Max、Android代表機、iPad、iPad Air/Pro）
  で確認 → 動作確認スクリプトで各横向き高さ（320〜1024px、570px前後の境界含む）を
  回答前・回答後の両方で機械的にオーバーフロー検査 → 目視確認」の順で決めました。
  確認はローカルのChromium（Playwright）で行い、E2E基盤はリポジトリへ追加していません。
  320×568のような縦長ビューポートは`orientation: landscape`に一致しない
  （幅と高さが同じ・高さが大きい場合はportrait扱いになる）ため、確認は必ず
  幅>高さの組み合わせで行っています。
- 回答結果オーバーレイ（`QuizResultOverlay`）自体の見た目・しきい値は変更していません。
  `--feedback`の下部予約は既存の値をそのまま使うため、回答前後で問題文・選択肢の
  位置がジャンプすることはありません。
