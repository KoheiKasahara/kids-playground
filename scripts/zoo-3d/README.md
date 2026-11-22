# 3Dどうぶつえんのアセット生成パイプライン

「3Dどうぶつえん」（`src/games/zoo-3d/`）の動物モデルと全モーションを、Blender のヘッドレス実行で生成します。
仕様・品質基準・動物の追加手順は [docs/3d-zoo/animal-production.md](../../docs/3d-zoo/animal-production.md)、
AI エージェント向けの手順は Skill `zoo-animal-creator`（`.agents/skills/zoo-animal-creator/`）を正とします。
生成物はリポジトリにコミット済みなので、日常の開発や CI でこのパイプラインを動かす必要はありません。
動物の形や動きを変えるときだけ実行し、生成物を差し替えます。

## 実行

```bash
scripts/zoo-3d/build.sh                 # 全動物
scripts/zoo-3d/build.sh elephant        # 1種類だけ
QA_DIR=/tmp/zoo3d-qa scripts/zoo-3d/build.sh elephant   # 品質確認の画像・動画・足の滑り量も書き出す
```

- `setup-blender.sh` が固定版の Blender（Linux x86_64）を取得し、SHA-256 を検証します。取得先はリポジトリの外のキャッシュです。
  ほかの OS では同じ版の Blender を入れ、`BLENDER=<実行ファイル>` を指定します。
- 後処理の glTF Transform は `npx` で固定版を実行します（`package.json` には追加しません）。
- Workbench / EEVEE で描く QA には EGL（Mesa）が必要です。GPU のないクラウドでも `libegl1` と `libgl1-mesa-dri` があれば動きます。

## 生成物

| 出力 | 内容 |
| --- | --- |
| `public/models/zoo-3d/<動物>.glb` | ゲームが読むモデル（メッシュ・骨格・全モーション、meshopt 圧縮） |
| `src/games/zoo-3d/models/<動物>.json` | クリップの長さ・ループ・1周あたりの移動量／旋回量・エサの届く距離など |
| `assets-src/zoo-3d/<動物>.blend` | 生成結果を人が Blender で開いて確認・調整するためのソース |

## しくみ

- `zoo3d/sdf.py`: 楕円体・テーパー付きカプセルを滑らかに合成した距離場を Surface Nets でメッシュ化します。
- `zoo3d/meshing.py`: 減面・頂点カラー・目や頬などの小物（デカール）を作ります。
- `zoo3d/rig.py`, `zoo3d/creature.py`: Mesh2Motion の四足テンプレートに合わせた名前の骨格を作り、自動ウェイトで結び付けます。
- `zoo3d/anim.py`: 2本骨の解析 IK と歩容ジェネレーター。接地中の足を地面に固定し、遊脚も地面基準でイーズするので、
  ゲームが JSON の「1周あたりの移動量」に再生速度を合わせれば足は滑りません。ビルド時に滑り量と IK の届かなさを数値で表示します。
- `zoo3d/bodyplan.py`: 体型（四足・二足）ごとに共通する歩き・走り・方向転換・待機・喜ぶ・まばたき・伏せの組み立てと、歩容の位相のひな形（`GAITS`）。
- `zoo3d/retarget.py`: Mesh2Motion（CC0）のモーションを、骨格空間の回転差分で別の動物へ写します（出典は `vendor/mesh2motion/SOURCE.md`）。
- `zoo3d/animals/<動物>.py` が形・色・骨格、`<動物>_motion.py` がモーションを定義します。

## 道具

| スクリプト | 用途 |
| --- | --- |
| `new_animal.py` | 体型の近い動物から、新しい動物の土台（2ファイル）を作る（Blender 不要） |
| `selftest.py` | 四足・二足の棒人形で、歩容が足を滑らせないかを自己診断する |
| `render_clip.py` | 生成済みの `.blend` から任意のクリップを追従カメラで描き、コマ送りのシートにする |
| `lineup.py` | 全動物を同じ光・縮尺で並べて描き、造形とアートスタイルを比べる |

## 動物を足すとき

[docs/3d-zoo/animal-production.md](../../docs/3d-zoo/animal-production.md) の「動物の追加手順」に従います。
共通のクリップ名をそろえれば、`src/games/zoo-3d/models.test.ts` が名前・長さの整合を、`production.test.ts` がガイドの個別仕様の書き漏れを検査します。
