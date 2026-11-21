"""生成済みの .blend から、指定クリップを追従カメラで描画して確認する（QA 用）。

    blender -b assets-src/zoo-3d/elephant.blend --python scripts/zoo-3d/render_clip.py -- \
        --clip Walk --out /tmp/qa --view side --frames 12 [--engine CYCLES]
"""

from __future__ import annotations

import argparse
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # type: ignore[import-not-found]  # noqa: E402
from mathutils import Vector  # type: ignore[import-not-found]  # noqa: E402

from zoo3d import qa  # noqa: E402


def main() -> None:
    argv = sys.argv[sys.argv.index('--') + 1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--clip', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--view', default='side')
    ap.add_argument('--frames', type=int, default=12, help='シートに並べるコマ数（0 なら全フレーム）')
    ap.add_argument('--engine', default='BLENDER_WORKBENCH')
    ap.add_argument('--distance', type=float, default=5.2)
    ap.add_argument('--speed', type=float, default=0.0, help='追従カメラ用の前進速度[m/s]（足の滑りを見る）')
    ap.add_argument('--turn', type=float, default=0.0, help='1秒あたりの旋回量[度]')
    ap.add_argument('--size', default='560x420')
    args = ap.parse_args(argv)

    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    action = bpy.data.actions[args.clip]
    for t in arm.animation_data.nla_tracks:
        t.mute = True
    w, h = (int(v) for v in args.size.split('x'))
    qa.setup_scene(resolution=(w, h), engine=args.engine, samples=12)
    qa.grid_floor()
    cam = qa.camera()
    az, el = qa.VIEWS[args.view]
    n = int(action.frame_end)
    total = n if action.get('zoo3d_loop', False) else n + 1
    picks = list(range(total)) if args.frames <= 0 else [round(i * (n - (0 if action.get('zoo3d_loop') else 0)) / args.frames) for i in range(args.frames)]
    os.makedirs(args.out, exist_ok=True)
    paths = []
    fps = bpy.context.scene.render.fps
    w_rate = math.radians(args.turn)
    for i, f in enumerate(picks):
        t = f / fps
        if abs(w_rate) > 1e-9:
            th = w_rate * t
            r = args.speed / w_rate
            xy = (r * (1 - math.cos(th)), -r * math.sin(th))
        else:
            th, xy = 0.0, (0.0, -args.speed * t)
        frames = [(f, xy, th)]
        target = Vector((xy[0], xy[1] - 0.25, 0.9))
        qa.aim(cam, target, az, el, args.distance, lens=50)
        d = os.path.join(args.out, f'{args.clip}-{args.view}')
        p = qa.render_frames(d, frames, arm, action)[0]
        final = os.path.join(d, f'pick{i:03d}.png')
        os.replace(p, final)
        paths.append(final)
    cols = 4 if len(paths) > 4 else len(paths)
    qa.contact_sheet(paths, os.path.join(args.out, f'{args.clip}-{args.view}-sheet.png'), columns=cols)


if __name__ == '__main__':
    main()
