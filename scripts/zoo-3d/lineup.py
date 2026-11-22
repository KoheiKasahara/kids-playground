"""全動物を同じシーン・同じ光・同じ縮尺で並べて描き、造形とアートスタイルを比べる（QA 用）。

    blender -b --factory-startup --python scripts/zoo-3d/lineup.py -- --out /tmp/zoo3d-lineup [--clip Walk --frame 0.25]

assets-src/zoo-3d/*.blend から動物を読み込み、横一列に並べて正面斜め・横・上から描く。
--clip を付けると、各動物をそのクリップの同じ位相（--frame は周期に対する割合）の姿勢で並べる。
新しい動物を足したら、既存の動物と並べて大きさ・色味・目の大きさ・輪郭のやわらかさを確かめる。
"""

from __future__ import annotations

import argparse
import glob
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)

import bpy  # type: ignore[import-not-found]  # noqa: E402

from zoo3d import qa  # noqa: E402

ORDER = ['elephant', 'giraffe', 'lion', 'panda']


def load(path: str, offset_x: float) -> tuple[bpy.types.Object, float, float, set]:
    """動物の .blend から骨格とメッシュを読み込む。返り値は (骨格, 本体の幅, 高さ, 読み込んだアクション)。"""
    before = set(bpy.data.actions)
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = [n for n in src.objects]
    arm = None
    meshes = []
    for o in dst.objects:
        if o is None:
            continue
        bpy.context.scene.collection.objects.link(o)
        if o.type == 'ARMATURE':
            arm = o
        elif o.type == 'MESH':
            meshes.append(o)
    arm.location.x = offset_x
    arm.rotation_euler = (0, 0, 0.6)  # 少し斜めを向けて顔と横顔の両方が見えるようにする
    if arm.animation_data:
        for t in arm.animation_data.nla_tracks:
            t.mute = True
    body = max(meshes, key=lambda m: len(m.data.vertices))
    return arm, body.dimensions.x, body.dimensions.z, set(bpy.data.actions) - before


SHOW_AT = 2000


def pose_at_phase(arm: bpy.types.Object, action: bpy.types.Action, phase: float) -> None:
    """場面のフレーム SHOW_AT で、この動物のアクションがちょうど phase（周期の割合）の位置に来るよう NLA に置く。"""
    start, end = action.frame_range
    track = arm.animation_data.nla_tracks.new()
    strip = track.strips.new(action.name, int(SHOW_AT - (start + (end - start) * phase)), action)
    strip.extrapolation = 'HOLD'
    track.mute = False


def main() -> None:
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--clip', default=None)
    ap.add_argument('--frame', type=float, default=0.25)
    ap.add_argument('--animals', default='')
    args = ap.parse_args(argv)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    found = {os.path.splitext(os.path.basename(p))[0]: p for p in glob.glob(os.path.join(ROOT, 'assets-src', 'zoo-3d', '*.blend'))}
    names = [n for n in (args.animals.split(',') if args.animals else ORDER + sorted(set(found) - set(ORDER))) if n in found]
    x = 0.0
    tallest = 0.0
    for name in names:
        arm, w, h, actions = load(found[name], x)
        if args.clip:
            # 同じ名前のアクションは動物ごとに別名（.001 など）で読み込まれるので、この動物の分から選ぶ
            mine = [a for a in actions if a.name.split('.')[0] == args.clip]
            if mine:
                arm.animation_data_create()
                pose_at_phase(arm, mine[0], args.frame)
        x += max(w, 1.6) + 1.2
        tallest = max(tallest, h)
    if args.clip:
        bpy.context.scene.frame_set(SHOW_AT)
    width = x - 1.2
    center = (width / 2 - 0.8, 0, tallest * 0.4)
    os.makedirs(args.out, exist_ok=True)
    qa.setup_scene(resolution=(1600, 640), samples=32)
    cam = qa.camera()
    tag = f'-{args.clip}' if args.clip else ''
    for view, az, el in (('front', 0, 10), ('front34', 25, 18), ('top', 15, 55)):
        qa.aim(cam, center, az, el, width * 1.45 + 5, lens=50)
        qa.render_still(os.path.join(args.out, f'lineup{tag}-{view}.png'))
    print('[lineup] ' + ', '.join(names))


if __name__ == '__main__':
    main()
