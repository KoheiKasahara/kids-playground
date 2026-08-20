# ちきゅうぎ 設計

## 目的

4〜5歳の子どもが、クイズの正解を探すのではなく、地球をさわって回しながら世界の国に興味を持つためのミニゲームです。画面を開くとすぐに地球儀を操作できます。

## データ

- 対応する国の一覧は `src/games/earth-globe/data/globeCountries.ts` の `globeCountries` を使う。
- 国データは `id`、`nameJa`、`flag`、`numericId` を持つ。国旗は `import.meta.env.BASE_URL + country.flag` で表示する。
- 地球の国境データは `src/games/earth-globe/data/worldFeatures.ts` の `worldFeatures` を使う。
- 国の選択状態とズーム段階は `EarthGlobePlay` が持ち、3Dエンジンへ型契約どおり渡す。

## 操作

- 地球本体をドラッグして回す。国をタップすると国旗と国名のカードを表示する。
- 右下の `＋` で近づき、`−` ではなれる。ズームは0〜3の4段階で、範囲外には進まない。
- 右下の `🏠` でズームを0に戻し、選択中の国も解除する。
- 左上の「もどる」でホーム画面へ戻る。国名カードをタップするとカードを閉じる。

## URL

```text
/games/earth-globe
```

開始画面やクイズ結果画面は設けず、URLから直接ビューワーを表示する。重い3D関連モジュールを含むため、ルートでは遅延読み込みを使う。

## レイアウト

全画面の地球描画領域を背面に置き、画面上に操作UIを重ねる。UIレイヤーは通常ポインターイベントを受け取らず、ホームボタン、ズーム操作、国名カードだけがタップを受け取る。縦画面を優先し、ズーム操作は右下、国名カードは左下にコンパクトに配置する。

`100dvh` と safe-area用のデザイントークンを使い、320px程度の狭い画面でも操作ボタンが画面外へ出ないようにする。`prefers-reduced-motion` が有効な場合は画面側の遷移を止め、その状態を3Dエンジンにも渡す。

## 3D実装

- `three`（生のAPI、React Three Fiberは使わない）と `three-globe`（球面上への国ポリゴン描画・大気グロー用、ライセンス等は `docs/CREDITS.md` 参照）を `src/games/earth-globe/three/useGlobeEngine.ts` で組み合わせる。カメラ・レンダラー・`OrbitControls`（回転のみ、`enableZoom=false`）は自前管理し、`domino-flag`（`useDominoEngine.ts`）と同じ「hookがThree.jsのライフサイクルを完結させ、`registerContainer`でDOM要素を受け取る」構成に揃えている。
- 見た目はテクスチャ画像を使わず、海=単色スフィア（`globeMaterial()`）、陸=`worldFeatures`をthree-globeの`polygonsData`へ渡した国ポリゴンのcap色で表現する。国境線は`polygonStrokeColor`、大気は`showAtmosphere`。新規バイナリアセットは追加していない。
- ズームは0〜3の4段階で、カメラ距離（地球半径100基準）を `three/zoomLevels.ts` の `cameraDistanceForZoom` (300 / 230 / 175 / 145) へ短いeaseOutアニメーションで遷移させる。＋/−連打時は実行中のアニメーションを都度キャンセルして目標を繋ぎ直す。
- 国タップは、three-globe 2.x系に `onPolygonClick` 等の組み込みクリックハンドラが無いため、`THREE.Raycaster` を自前で使い、ヒットしたポリゴンMeshの `__data.data.id`（three-globeが`polygonsData`へ渡した元のGeoJSON featureの`id`＝world-atlasのISO numeric）から国を逆引きしている。ポリゴンは中心から地表までの円錐形状のため、画面中心付近では無関係な国の円錐頂点（地球中心）近くを誤って拾うことがあり、海球面と同程度の距離で交差したヒットだけを採用することで除外している。
- 選択中の国は `polygonCapColor` を明るい黄色系へ、`polygonAltitude` をわずかに高くして「浮いて見える」ハイライトにする。
- ドラッグ中にページがスクロールしないよう、canvasに `touch-action: none` を設定している。
