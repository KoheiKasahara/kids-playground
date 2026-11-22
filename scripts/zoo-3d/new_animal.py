#!/usr/bin/env python3
"""新しい動物の生成スクリプト一式を、体型の近い既存の動物から作る（Blender 不要）。

    python3 scripts/zoo-3d/new_animal.py panda --like lion

- scripts/zoo-3d/zoo3d/animals/<id>.py と <id>_motion.py を、--like の動物からコピーする。
  形・色・骨・モーションはコピー元のままなので、docs/3d-zoo/animal-production.md の
  「動物ごとの個別仕様」に沿って書き換える（コピー元の成功した構造をそのまま土台にするため）。
- ゲームへの登録に必要な箇所を一覧で表示する。

--like の目安: 四足で首が短い → lion（たてがみ・あごの例）/ 首が長い → giraffe（リターゲットの例）/
鼻など特殊な部位 → elephant。二足・鳥は bodyplan.py の plan='biped' と selftest.py の骨格を参照する。
"""

from __future__ import annotations

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ANIMALS = os.path.join(HERE, 'zoo3d', 'animals')
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('animal', help='英小文字の動物ID（例: panda）。GLB・JSON・骨格名に使う')
    ap.add_argument('--like', required=True, help='体型の近い既存の動物ID（例: lion）')
    ap.add_argument('--force', action='store_true', help='既存のファイルを上書きする')
    args = ap.parse_args()
    animal = args.animal
    if not re.fullmatch(r'[a-z][a-z0-9_]*', animal):
        print('動物IDは英小文字・数字・_ で書いてください（例: panda, red_panda）', file=sys.stderr)
        return 2
    created = []
    for suffix in ('', '_motion'):
        src = os.path.join(ANIMALS, f'{args.like}{suffix}.py')
        dst = os.path.join(ANIMALS, f'{animal}{suffix}.py')
        if not os.path.exists(src):
            print(f'コピー元がありません: {src}', file=sys.stderr)
            return 2
        if os.path.exists(dst) and not args.force:
            print(f'すでにあります（上書きは --force）: {dst}', file=sys.stderr)
            return 2
        text = open(src, encoding='utf-8').read()
        text = re.sub(r"^NAME = '[a-z0-9_]+'", f"NAME = '{animal}'", text, flags=re.M)
        header = f'# {args.like} から作成した {animal} の土台。形・色・骨・動きを個別仕様に合わせて書き換える。\n'
        with open(dst, 'w', encoding='utf-8') as f:
            f.write(header + text)
        created.append(os.path.relpath(dst, ROOT))
    print('作成しました:')
    for c in created:
        print(f'  {c}')
    print(f'''
次の手順（詳しくは docs/3d-zoo/animal-production.md）:
  1. {created[0]} の形・色・骨格、{created[1]} の歩容・固有アクションを書き換える
  2. scripts/zoo-3d/build.sh {animal}            # GLB・JSON・.blend を生成（足の滑り量を確認）
  3. QA_DIR=/tmp/zoo3d-qa/{animal} scripts/zoo-3d/build.sh {animal} と render_clip.py で見た目と動きを確認
  4. ゲームへ登録:
     - src/games/zoo-3d/species.ts      … SPECIES に定義を追加し、SPECIES_ORDER に加える
     - src/games/zoo-3d/zooMap.ts       … エリア（柵・木・岩）を追加し、ほかのエリアと重ならない位置に置く
     - src/games/zoo-3d/effects.ts      … 新しいエサの形が必要なら createFood に追加
     - src/games/zoo-3d/sounds.ts       … 鳴き声が必要なら追加し、src/test/audio/gameSoundSamples.ts に登録
     - docs/credits.md                   … 出典（Mesh2Motion を使ったらその旨）
  5. npm run test:game -- src/games/zoo-3d で整合を確認し、npm run verify
''')
    return 0


if __name__ == '__main__':
    sys.exit(main())
