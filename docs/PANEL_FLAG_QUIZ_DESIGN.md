# 「パネルめくりこっきクイズ」基本設計

## 1. 目的と対象

既存の「こっきクイズ」に3つ目のモードとして追加する、パネルめくり形式の4択クイズです。
国旗画像の上に4×4＝16枚のパネルを重ねて隠し、「もう1まい めくる！」ボタンで少しずつパネルをめくりながら、正解と思う国名を4択から選びます。
少ない枚数で当てるほど得点が高くなるため、「早く分かった方が嬉しい」という得点のフィードバックを通じて、国旗の特徴（色や模様）に注目する遊び方を促すことがねらいです。

対象・技術方針は既存2モード（こっき→なまえ／なまえ→こっき）と同じで、対象は`docs/DESIGN.md`・`MINIGAME_DEVELOPMENT_GUIDELINES.md`に準じます。バックエンドや外部APIは使わず、新しい静的素材も追加しません（既存の`public/flags/*.svg`をそのまま使います）。

## 2. 既存モードとの関係

こっきクイズは`src/games/flag-quiz/types.ts`の`QuizMode`で3モードを表します。

| 内部名 (`QuizMode`) | 表示 (`MODE_LABEL`) | 出題形式 |
| --- | --- | --- |
| `flagToName` | こっき → なまえ | 国旗を見て国名を4択から選ぶ |
| `nameToFlag` | なまえ → こっき | 国名を見て国旗を4択から選ぶ |
| `panelFlag` | パネルめくり | 16枚のパネルで隠れた国旗を少しずつめくりながら国名を4択から選ぶ |

`panelFlag`は出題対象の国データ（`countriesForLevel`）、むずかしさ選択画面（`FlagQuizLevelSelect`）、結果画面（`FlagQuizResult`）を既存2モードとそのまま共有します。むずかしさ選択・結果画面は「意味・制約・変更理由が一致する」ため`QuizMode`を拡張するだけで自然に対応でき、`MINIGAME_DEVELOPMENT_GUIDELINES.md` §2の「共通化は複数ゲームで意味と変更理由が一致する最小単位に限定する」に沿っています。

一方、プレイ画面（`FlagQuizPlay.tsx`）は`mode === 'flagToName' ? A : B`という二分岐の実装であり、パネル形式は状態管理（開いたパネル枚数・得点）も表示もこの2モードと大きく異なるため、既存コンポーネントには手を入れず`PanelFlagQuizPlay.tsx`として分離しました。`FlagQuizPlay`の`mode` propの型は`Exclude<QuizMode, 'panelFlag'>`に絞り込み、`panelFlag`を誤って渡すとコンパイルエラーになるようにしています。

## 3. 画面とURL

| 画面 | URL | 実装 |
| --- | --- | --- |
| 開始・モード選択 | `/games/flag-quiz` | `FlagQuizStart.tsx`（既存、ボタン追加のみ） |
| パネルめくり むずかしさ選択 | `/games/flag-quiz/panel-flag` | `FlagQuizLevelSelect mode="panelFlag"`（既存を再利用） |
| パネルめくり プレイ | `/games/flag-quiz/panel-flag/:level/play` | `PanelFlagQuizPlay.tsx`（新規） |
| パネルめくり 結果 | `/games/flag-quiz/panel-flag/:level/result` | `FlagQuizResult mode="panelFlag"`（既存を再利用） |

`:level`は`easy`/`normal`/`hard`です。不正な値は`isQuizLevel`の型ガードにより、`MODE_PATH.panelFlag`（`panel-flag`）を使ってパネルめくりモードのむずかしさ選択画面へ`replace`で戻します（既存`FlagQuizPlay`と同じ方式）。結果URLは正解数などの遷移stateに依存するため、stateなしの直接アクセスは`FlagQuizResult`内の`isResultState`チェックによりこっきクイズの開始画面（`/games/flag-quiz`）へ戻します。

画面遷移は次のとおりです（既存2モードと同型）。

```text
ホーム → こっきクイズ開始（3モード） → むずかしさ選択 → 10問プレイ → 結果
                                          ↑                       │
                                          └──── べつのむずかしさ ──┘
```

## 4. 画面仕様

### 4.1 開始（`FlagQuizStart.tsx`）

既存の2ボタン（「🚩 こっきを みて こたえる」「🔎 なまえを みて こたえる」）の見た目・順序をそのまま維持し、3つ目のボタン「🧩 パネルを めくって こたえる」を追加しました。「もどる」は最後のまま変わりません。

### 4.2 むずかしさ選択（`FlagQuizLevelSelect.tsx`、既存を再利用）

`mode="panelFlag"`を渡すと、選択中のモードラベルとして`パネルめくり`が表示される以外は既存2モードと同じ挙動です。

### 4.3 プレイ（`PanelFlagQuizPlay.tsx`、新規）

- ヘッダーに「やめる」（固定表示）、現在のむずかしさラベル、`現在 / 10`、進捗バーを表示する（既存`FlagQuizPlay`と同じ構成）。
- 本体上部に`PanelFlag`コンポーネントで、16枚のパネルに覆われた国旗を表示する。
- その下に見出し「この くにの なまえは？」、「🧩 もう1まい めくる！」ボタンと「あと Nまい」の残り枚数表示、4択の国名ボタン（`BigButton`）を表示する。
- 「もう1まい めくる！」を押すたびに開いているパネルが1枚増える。時間経過による自動オープンは実装しない（子どもが自分のペースでめくれるようにするため）。
- 回答後は全選択肢と「もう1まい めくる！」を無効化し、正解のボタンには緑系の枠と`◯`、選んだ誤答のボタンには赤系の枠と`✕`を付ける（既存`choiceVariant`/`choiceMark`と同じロジック）。
- 回答と同時に残り全パネルを開き、国旗全体を表示する（`PanelFlag`の`revealAll`プロパティ）。
- 画面下部の固定領域（共通コンポーネント`src/components/QuizResultOverlay.tsx`）に、正誤メッセージ（「🎉 せいかい！」/「ざんねん！」）、正解の国名（「こたえ: {国名}」）、得点の詳細（正解時は「{N}まいで わかった！ {M}てん」、不正解時は「0てん」）、次の操作ボタンを表示する。背景を暗くするモーダルにはせず、画面を暗転させずに下から迫り上がるオーバーレイとして表示する。国旗・見出し・選択肢など他の要素の位置やサイズは回答前後で一切変えない（`.page`の下部余白はビューポートの幅・高さだけで決め、回答したかどうかには依存させない）。
- 最終問（10問目）の次操作ボタンは「けっかを みる」に変わる。

### 4.4 結果（`FlagQuizResult.tsx`、既存を拡張して再利用）

既存の結果画面に、得点制のモードでだけ「とくてん: {score} / {maxScore}てん」の行を追加しました。`ResultState`に任意の`score`/`maxScore`フィールドを足し、`isResultState`はこれらが無い既存stateもそのまま受理します（flagToName/nameToFlagは今までどおり`score`を渡さないため、表示・挙動は変わりません）。「もういちど」「べつの むずかしさ」「べつの クイズ」「ホームへ」の4経路は既存どおり`MODE_PATH[mode]`を使って組み立てるため、`panelFlag`でも自然に動作します。

## 5. パネル仕様（`PanelFlag.tsx`）

- `PANEL_COUNT = 16`、`PANEL_COLUMNS = 4`（4列×4行）を定数としてコンポーネントから`export`し、テストからも参照できるようにしています。
- 国旗画像は1枚だけを表示し、画像自体の分割生成は一切行いません。画像の上にCSS Gridで16個の`<span>`をオーバーレイし、開いたパネルは`opacity: 0`＋わずかな`scale`/`rotateY`で透明にすることで、下の国旗の対応するマスが見える仕組みです。
- 各パネル要素には`data-testid="panel-<index>"`と、開閉が判別できる`data-open="true"/"false"`属性を付与し、テストから状態を直接検証できます。
- パネルは正誤判定に関わらない装飾要素のため、各パネルに`aria-hidden="true"`を付けてスクリーンリーダーの読み上げを妨げないようにしています（国旗画像自体も既存`FlagImage`と同じく`alt=""`）。
- 開くアニメーションは`opacity`と`transform`（`scale`・`rotateY`）のみの軽量な変化（250ms）に留め、派手な演出は避けています。`prefers-reduced-motion: reduce`は`src/styles/global.css`の共通ルールで全アニメーション・トランジション時間を強制的に短縮する形で既に対応済みのため、`PanelFlag.module.css`側での個別対応は不要です。

## 6. 状態管理と「開いているパネル」の導出（`PanelFlagQuizPlay.tsx`）

もんだいごとの「パネルを開ける順番」（`openOrder`、0〜15をシャッフルした配列）は、`questions`と同じく`useState`の遅延初期化で問題数ぶんまとめて1回だけ生成します（`shuffle`は`quiz-core`由来）。これにより`useReducer`のreducer自体は乱数に依存しない純粋な状態遷移だけを行います。

`useReducer`が管理する状態は次のとおりです。

```ts
type PlayState = {
  index: number          // 現在の問題番号
  openedCount: number     // このもんだいでここまでに開いたパネルの枚数（1〜PANEL_COUNT）
  selectedId: string | null
  correctCount: number
  score: number           // ここまでの合計得点
}
```

「開いているパネル」は`openOrder.slice(0, openedCount)`から導出します。シャッフル済みの配列から先頭N件を取り出すだけなので、**重複や16枚超過は構造的に起こりません**（`openedCount`自体もreducerの`reveal`アクションで`PANEL_COUNT`を超えないようガードしています）。

アクションは3種類です。

- `reveal`: 回答済み（`selectedId !== null`）、またはすでに`openedCount >= PANEL_COUNT`のときは何もしない（連打してもボタンがdisabledになり、状態は壊れない）。それ以外は`openedCount`を1増やす。
- `select`: 選択肢を1つ選ぶ。すでに回答済みなら無視。正誤に応じて`correctCount`と`score`を更新する（得点計算は7章）。
- `next`: 次の問題へ進む。`index`を1増やし、`openedCount`を1にリセットする（最初の1枚は自動で開く）。`correctCount`・`score`は引き継ぐ。

もんだい開始時（初期状態および`next`後）は`openedCount = 1`とし、最初の1枚は自動で開きます。時間経過による自動オープンは実装していません。

## 7. スコア（`panelScore.ts`）

```ts
export function scoreForPanels(openedCount: number, correct: boolean): number
```

- 不正解は常に0点。
- 正解は開いたパネルの枚数が少ないほど高得点になります。1枚目で正解＝100点、以降1枚めくるごとに10点ずつ減り、10枚以降は10点で下げ止まります（`Math.max(10, 110 - openedCount * 10)`）。
- `openedCount`が0以下や`PANEL_COUNT`（16）を超える異常値で呼ばれても安全に動くよう、1〜`PANEL_COUNT`の範囲へクランプしてから計算します。

| 開いた枚数 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10以上 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 得点 | 100 | 90 | 80 | 70 | 60 | 50 | 40 | 30 | 20 | 10 |

1ゲームは10問なので、満点は10問×100点＝1000点です（全問1枚目で正解した場合）。純粋関数として`src/games/flag-quiz/panelScore.ts`に切り出しており、UIに依存せず`panelScore.test.ts`で単体テストしています。

## 8. UI・アクセシビリティ

- 選択肢・「もう1まい めくる！」・「やめる」・次の操作ボタンはすべてネイティブ`button`（`BigButton`または既存と同じ要素）を使い、タッチとキーボードの両方に対応する。
- 「もう1まい めくる！」は主操作の一つとして`min-height: var(--tap-target-min)`（64px）以上のタップ領域を確保する。
- 正誤は色だけに頼らず、`◯`/`✕`の記号、文言（「🎉 せいかい！」/「ざんねん！」）、効果音（`playCorrectSound`/`playIncorrectSound`）を併用する。
- 回答結果は`role="status"`と`aria-live="polite"`で通知する（`QuizResultOverlay`）。
- パネル・絵文字などの装飾要素はすべて`aria-hidden="true"`。
- `:focus-visible`は`BigButton`・既存ボタン共通のスタイルをそのまま使うため、フォーカスリングは消えない。
- 結果パネル（`QuizResultOverlay`。実装は`src/components/QuizResultOverlay.tsx`/`.module.css`に共通化されており、`FlagQuizPlay`・`MathQuizPlay`・`WorkingVehicleQuizPlay`も同じコンポーネントを使う）ぶんの下部余白は、回答したかどうかではなくビューポートの幅・高さだけで決める4系統に分かれる。(1) タブレット/PC（`min-width: 640px` かつ `min-height: 600px`）は常時196px相当を確保し、レイアウト（縦積みパネル）も維持する。(2) 背の高いスマホ縦（`max-width: 639px` かつ `min-height: 760px`。iPhone 14/Pro Max、Pixel 7 相当）は結果パネルをコンパクト化し、常時124px程度に減らした分をそのまま国旗の拡大に回す。(3) それ以外の背の低いスマホ縦（iPhone SE/5相当）は余白を確保せず、回答後の結果パネルは選択肢ボタン（disabled）の上にそのまま重ねて表示する。(4) 低い横画面（`@media (orientation: landscape) and (max-height: 560px)`）では、回答前から常時パネル分の余白を確保したうえで、既存`FlagQuizPlay`のflagToNameモードと同じく本体を左（国旗）・右（設問・めくるボタン・選択肢）の2カラムに切り替える。
- 639px以下の縦画面では、結果パネルの中身（`QuizResultOverlay`の`.inner`）を左＝結果テキスト、右＝「つぎのもんだい」ボタンの横並びに変えてコンパクト化し、画面高の25%以下に収める（表示内容は変えない）。
- 回答後に選択肢へ付ける`◯`/`✕`の記号は通常のテキストフローに置かず、絶対配置の`span`（`.choiceMark`）にする。これにより記号の有無で選択肢ボタンの折返し・高さが変わらず、回答前後で選択肢ボタン・国旗・見出し・「もう1まい めくる！」ボタンの位置とサイズが完全に一致する。
- 国旗エリア（`PanelFlag`の`.frame`）は既存`FlagImage`の`.large`と同じ考え方（`height: 100%`＋`aspect-ratio: 4/3`＋`max-height`）で伸縮するため、パネルグリッドは常に国旗画像とぴったり重なる。`max-height`は639px以下の縦画面のみ280pxから330pxへ引き上げ、タブレット/PC・横画面は280pxのまま維持する。

## 9. PWA・素材

新しい静的素材（画像・音声）は追加しません。パネルはCSSのオーバーレイのみで表現し、国旗画像は既存の`public/flags/*.svg`をそのまま使います。したがって`vite.config.ts`のWorkbox `globPatterns`の変更や`docs/CREDITS.md`の更新は不要です。効果音は既存の`src/utils/quizSound.ts`（`playCorrectSound`/`playIncorrectSound`）をそのまま流用します。

## 10. テスト

- `panelScore.test.ts`: 不正解は常に0点、正解時の得点が枚数ごとの表（7章）どおりであること、10枚以上は10点で下げ止まること、0以下やPANEL_COUNT超えなど異常値でも安全にクランプすること、10問満点が1000点になること。
- `PanelFlag.test.tsx`: `PANEL_COUNT`（16）枚のパネルが表示されること、`openedPanels`に含まれるindexだけ`data-open="true"`になること、`revealAll`のとき全パネルが開くこと、各パネルが`aria-hidden="true"`であること、国旗画像が1枚だけ表示されること（画像の分割生成をしないことの確認）。
- `PanelFlagQuizPlay.test.tsx`: 開始時に16枚中1枚だけが開いていること、「もう1まい めくる！」で1枚ずつ増えること、開いたパネルのindexが重複しないこと、16枚を超えて開かず上限でボタンがdisabledになること、正解時の得点表示が枚数どおりであること（1/2/4枚のケース）、不正解が0点であること、回答後に16枚すべて開くこと、回答後に選択肢とめくるボタンがdisabledになること、フィードバックが`role="status"`で通知されること、「つぎのもんだい」でパネル状態がリセットされること、10問完走後の結果画面での正解数・得点表示、一部不正解時の正解数、「もういちど」「べつの むずかしさ」での再遷移、不正level・stateなし結果URLの安全な戻り、開始画面からのルーティング。
- `FlagQuizLevelSelect.test.tsx`（既存ファイルに追加）: パネルめくりモードのモードラベル表示と、むずかしさ選択からプレイ画面への遷移。
- 既存の`FlagQuizPlay.test.tsx`・`NameToFlagPlay.test.tsx`・その他全既存テストが変更なしで通ることを確認済みです（`FlagQuizResult`の`score`/`maxScore`はオプショナルであり、既存2モードは今までどおり渡さないため表示・挙動に影響しません）。

## 11. 対象ファイル

```text
src/games/flag-quiz/
├─ types.ts                    # QuizMode に 'panelFlag' を追加
├─ FlagQuizStart.tsx           # パネルめくりモードのボタンを追加
├─ FlagQuizStart.module.css
├─ FlagQuizPlay.tsx            # mode props を Exclude<QuizMode, 'panelFlag'> に限定
├─ FlagQuizResult.tsx          # score/maxScore の任意表示に対応
├─ FlagQuizResult.module.css
├─ FlagQuizLevelSelect.test.tsx # panelFlag のテストを追加
├─ PanelFlag.tsx               # 新規: 16枚パネルのオーバーレイ表示
├─ PanelFlag.module.css
├─ PanelFlag.test.tsx
├─ PanelFlagQuizPlay.tsx       # 新規: パネルめくりのプレイ画面
├─ PanelFlagQuizPlay.module.css
├─ PanelFlagQuizPlay.test.tsx
├─ panelScore.ts               # 新規: 得点計算の純粋関数
└─ panelScore.test.ts
src/app/routes.tsx
docs/PANEL_FLAG_QUIZ_DESIGN.md
docs/DESIGN.md
README.md
```
