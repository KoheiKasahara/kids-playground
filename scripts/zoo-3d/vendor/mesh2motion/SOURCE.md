# Mesh2Motion のモーション（CC0）

3Dどうぶつえんの動物のモーションの一部は、
[Mesh2Motion](https://github.com/Mesh2Motion/mesh2motion-app) が配布する CC0 のアニメーションを
リターゲットして作っています（`scripts/zoo-3d/zoo3d/retarget.py`）。

- 取得元: https://github.com/Mesh2Motion/mesh2motion-app （コミット `017169ae6f7574d8fa75d893c38c2776386ca40b`、2026-11-21 取得）
- ライセンス: 3Dモデル・リグ・アニメーションは CC0 1.0（同梱の `LICENSE-CC0.md`）。アプリのコードは MIT で、本リポジトリには含めていません。
- 加工: 配布 GLB は `EXT_meshopt_compression` で圧縮されているため、Blender 4.5 で読めるよう
  `npx @gltf-transform/cli@4.5.1 copy <元> <先>` で展開しただけのものを置いています。動き自体は変更していません。

| ファイル | 元のファイル | 使い道 |
| --- | --- | --- |
| `horse-eating.glb` | `static/assets/horse/animations/eating.glb` | キリン・シマウマ・ヒツジ・シカ・ヤギ・ウマの「首を下げて食べる」 |
| `horse-sleep.glb` | `static/assets/horse/animations/sleep.glb` | キリン・シマウマ・ラクダ・ヒツジ・シカ・ヤギ・アルパカ・ウマの伏せ・睡眠の姿勢 |
| `fox-howl.glb` | `static/assets/fox/animations/howl.glb` | ライオン・トラの「吠える」、キツネの「コーン」、オオカミの「アオーン」（座って頭を上げる） |
| `fox-sleep.glb` | `static/assets/fox/animations/sleep.glb` | キツネ・オオカミの丸まって眠る姿勢（ライオンは手続き的な伏せを採用） |
| `fox-sit.glb` | `static/assets/fox/animations/sit.glb` | パンダの「てをふる」、ニホンザルの「ぱちぱち」「ぽりぽり」、ゴリラの「ドシン」、クマの「おねだり」、チーターの「みはり」の座り姿勢 |
