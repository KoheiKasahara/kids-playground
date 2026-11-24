---
name: zoo-animal-creator
description: 「3Dどうぶつえんに〇〇を追加して」のように、kids-playground の 3Dどうぶつえん（src/games/zoo-3d）へ新しい動物を足すときに使う。動物の特徴を調べ、Blender のスクリプトで造形・骨格・待機／歩き／走り・固有アクションを作り、GLB を出力してゲームへ登録し、多方向の画像・動き・足滑り・既存の動物との比較・モバイル表示・既存ゲームへの影響を検証する。既存の動物の見た目や動きを作り直すときにも使う。
---

# zoo-animal-creator — 3Dどうぶつえんに動物を追加する

このスキルは、ゾウ・キリン・ライオン・パンダを作ったのと同じ方式・同じ品質で、新しい動物を追加します。
**仕様と手順の正は [docs/3d-zoo/animal-production.md](../../../docs/3d-zoo/animal-production.md)** です。必ず最初に全文を読み、その「標準仕様」と「動物ごとの個別仕様」に従ってください。
リポジトリ共通の作業規則は `AGENTS.md`（`docs/architecture.md`・`docs/development-guidelines.md`・`docs/setup.md`）に従います。

## 守ること

- 手作業のモデリングや外部の3Dモデルは使わない。形・骨格・動きは `scripts/zoo-3d/` の Python で生成し、スクリプト・`.blend`・GLB・モーション情報 JSON をコミットする。
- 外部素材は Mesh2Motion（CC0）のモーションだけを例外とし、`scripts/zoo-3d/vendor/mesh2motion/SOURCE.md` と `docs/credits.md` に出典を書く。
- すべての動物に同じ骨格・同じ動きを当てはめない。体型（四足の柱・蹄・趾行・蹠行、二足・鳥、特殊な部位）に合わせ、動物らしい特徴と動きを残す。
- 共通クリップ名（`Idle` `Walk` `WalkLeft` `WalkRight` `Run` `TurnLeft` `TurnRight` `Eat` `LieDown` `Sleep` `GetUp` `Happy` `Blink`）は変えない。固有アクションは 1〜2 種類。
- 品質の合格（ガイド 7 章）を満たすまで、作る → 生成 → 見る → 直す をくり返す。低品質な仮モデルで完成扱いにしない。
- 既存の動物・既存のゲームを壊さない。ほかの動物の生成物は、作り直す依頼がない限り変更しない。

## 手順

作業前に Blender を用意する（クラウドでもローカルでも同じ）。

```bash
scripts/zoo-3d/setup-blender.sh          # 固定版 Blender のパスを表示（初回は取得）
# Workbench の QA 描画に EGL が要る環境では: apt-get install -y libegl1 libgl1-mesa-dri
BLENDER=$(scripts/zoo-3d/setup-blender.sh)
"$BLENDER" -b --factory-startup --python scripts/zoo-3d/selftest.py   # 体型ごとの歩容の自己診断（PASSED を確認）
```

1. **動物の特徴を調査する**
   - 体型、大きさ（既存の動物との比）、一目で分かる特徴（1〜3つ）、色、歩き方（どの脚の順に着くか・接地の長さ・歩幅の印象）、食べ物と食べ方、子どもが喜ぶ固有アクション（1〜2）、鳴き声を整理する。
   - ガイド 5 章の個別仕様表に、その動物の行を先に書く（作る前に「何を作るか」を決める）。
2. **既存モデルと制作スクリプトを確認する**
   - 体型の近い動物の `scripts/zoo-3d/zoo3d/animals/<id>.py` と `<id>_motion.py`、`zoo3d/bodyplan.py`・`anim.py`・`creature.py` を読む。
   - 土台を作る: `python3 scripts/zoo-3d/new_animal.py <新しいID> --like <近い動物>`
     （首の短い四足 → `lion`、長い首 → `giraffe`、前足を使う四足 → `panda`、特殊な部位 → `elephant`、二足・鳥 → `panda` を土台に `plan='biped'` へ。`selftest.py` の二足の骨格を参照）。
3. **Blender で 3D モデルを制作する**（`<id>.py`）
   - SDF の部位（楕円体・テーパー付きカプセル）で体型を作り、なめらかに合成する。模様・目・頬・爪は「形」で付け、面の塗り分けで作らない（ガイド 3.2）。
   - 6方向の静止画で確認する:
     `"$BLENDER" -b --factory-startup --python scripts/zoo-3d/build_animal.py -- --animal <id> --no-export --qa /tmp/zoo3d-qa/<id> --qa-clips Walk`
     （`/tmp/zoo3d-qa/<id>/<id>-model-sheet.png` を開いて見る）
4. **動物に適した骨格を設定する**（`<id>.py` の `bones()`）
   - 標準の骨名と親子関係（ガイド 3.3）。中間の関節は休止姿勢で少し曲げる。必要なら補助の骨（物を持つ・効果の出どころ）を足す。
5. **待機・歩行・走行を制作する**（`<id>_motion.py`）
   - `bodyplan.locomotion` に `GAITS` の位相と、周期・歩幅・接地率・持ち上げ・揺れを与える。`WalkLeft`/`WalkRight` は `Walk` と同じ周期・位相で `turn` だけ変える。`TurnLeft`/`TurnRight` はその場で回る。
   - `Idle`・`Eat`・`LieDown`/`Sleep`/`GetUp`・`Happy`・`Blink` も作る（`bodyplan.idle` / `happy` / `blink_clip` を使える）。
6. **動物固有アクションを 1〜2 種類制作する**
   - その動物らしさが一番伝わる動きにする。鳴き声は `sound`・`callStart`・`callEnd`、効果は `effect` をモーション情報に書く。
   - Mesh2Motion の近いモーションがあれば `retarget.py` で写し、足は IK で置き直す。破綻したら効きを弱めるか手続きの動きにする。
7. **GLB 形式で出力する**
   - `scripts/zoo-3d/build.sh <id>` — GLB・モーション情報 JSON・`.blend` を生成し、glTF Transform で圧縮する。
   - 全歩容の `max slide` と `IK reach error` が **1mm 未満**になるまで直す（超えたら `crouch` を増やす・歩幅を減らす）。
8. **ゲームに動物を登録する**（ガイド 3.7）
   - `src/games/zoo-3d/species.ts`（定義・`SPECIES_ORDER`）、`zooMap.ts`（暮らすエリアの展示場。近い動物の展示場に入れるか、柵の種類・獣舎を決めて重ならない位置に新しく置く）、必要なら `effects.ts`（えさ）・`scenery.ts`（木）・`sounds.ts`（鳴き声）と `src/test/audio/gameSoundSamples.ts`。
   - 食べ物を骨で運ぶなら `Eat` の `food` に `bone` と `hold: true`。
9. **動物の行動 AI を設定する**
   - `species.ts` の `mood`（待機時間と、歩く・走る・食べる・固有アクション・眠る・人を見に来る `curious` の重み。固有アクションは観察して見つけるとスタンプになるので、ほどよく見せる）、`members`（親子の大きさ）、`hit`（タップ判定）、`follow`（追従カメラ）をその動物らしく決める。AI 本体（`behavior.ts`）は共通のまま使う。
10. **複数角度から見た目を検証する**
    - 6方向の静止画、既存の動物との並べた比較: `"$BLENDER" -b --factory-startup --python scripts/zoo-3d/lineup.py -- --out /tmp/zoo3d-lineup`（`--clip Walk --frame 0.3` で同じ位相の比較）。
11. **アニメーションの自然さを確認する**
    - 各クリップのコマ送り: `"$BLENDER" -b assets-src/zoo-3d/<id>.blend --python scripts/zoo-3d/render_clip.py -- --clip <Clip> --view side --frames 8 --out /tmp/zoo3d-clip [--speed <m/s>]`
    - 歩き・走りの動画（`QA_DIR=/tmp/zoo3d-qa scripts/zoo-3d/build.sh <id>`）で、足が地面の格子に対して止まっているか、体・首・尾が歩調と合っているか、関節が潰れていないかを見る。
12. **モバイル性能・既存ゲームへの影響を検証する**
    - `npm run test:game -- src/games/zoo-3d`（モデルの整合・行動 AI・マップ・画面）。
    - 開発サーバーを Playwright の縦 390×844・横 844×390 で開き、そのエリアの俯瞰・その動物の追従・歩くモードで柵の前から見た画面・ずかんを撮る。追従カメラが木に隠れないこと。
    - 三角形数・GLB の容量がガイド 3.10 の目標内か。`npm run verify`、`npm run test:e2e`、`npx playwright test e2e/all-games.smoke.spec.ts --grep zoo-3d`。プレビューでオフライン表示。
    - iPhone 実機で確認できない環境では、その旨を未実施として報告する。

問題が見つかったら該当する手順へ戻って直し、合格するまでくり返す。終わったら、ガイド 5 章の個別仕様表と `docs/credits.md` を更新する。

## 完了の報告

- 追加した動物の個別仕様（体型・特徴・骨格の追加・歩容・食事・固有アクション・Mesh2Motion の利用）。
- 品質の証拠: 6方向画像、既存の動物との比較画像、主要クリップのコマ送り、足滑りの数値、ゲーム画面（縦・横）。
- 実行した検証と結果、未実施の項目と理由（iPhone 実機など）。
- このスキルや制作ガイドで足りなかった点があれば、同じ変更で直す。
