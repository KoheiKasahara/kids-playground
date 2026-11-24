"""Blender のヘッドレス実行で動物アセットを生成するエントリポイント。

    blender -b --factory-startup --python scripts/zoo-3d/build_animal.py -- --animal elephant [--qa DIR]

生成物:
- public/models/zoo-3d/<animal>.glb       ゲームが読む完成モデル（メッシュ・骨格・全モーション）
- src/games/zoo-3d/models/<animal>.json   モーションの長さ・ループ・1周あたりの移動量など
- assets-src/zoo-3d/<animal>.blend         人が Blender で開いて確認できる生成結果
--qa を付けると、多方向の静止画・モーションの連番と動画・足の滑り量を DIR に書き出す。
"""

from __future__ import annotations

import argparse
import importlib
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)

import bpy  # type: ignore[import-not-found]  # noqa: E402

from zoo3d import anim as A  # noqa: E402
from zoo3d import export as X  # noqa: E402
from zoo3d import qa  # noqa: E402


def main() -> None:
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--animal', required=True)
    parser.add_argument('--qa', help='品質確認用の画像・動画を書き出すディレクトリ')
    parser.add_argument('--qa-clips', default='', help='QA で描画するクリップ名（カンマ区切り、空なら全部）')
    parser.add_argument('--no-export', action='store_true')
    args = parser.parse_args(argv)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    # 焼き込み（anim.FPS）と書き出しのフレームレートをそろえる（Blender の既定は 24fps）
    bpy.context.scene.render.fps = A.FPS
    bpy.context.scene.render.fps_base = 1.0
    shape = importlib.import_module(f'zoo3d.animals.{args.animal}')
    motion = importlib.import_module(f'zoo3d.animals.{args.animal}_motion')
    mesh, arm = shape.build()
    rig = A.RigModel(arm)
    clips = motion.clips(rig)
    actions = [A.bake_clip(arm, c) for c in clips]
    A.stash(arm, actions)
    tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
    print(f'[zoo3d] {args.animal}: {tris} triangles, {len(arm.data.bones)} bones, {len(actions)} clips')

    report = {'animal': args.animal, 'triangles': tris, 'clips': {}}
    for c in clips:
        if getattr(c, 'gait', None) is not None:
            report['clips'][c.name] = qa.foot_slide_report(c)
            r = report['clips'][c.name]
            print(f'[zoo3d] {c.name}: max slide {r["max_slide"] * 1000:.1f} mm, IK reach error '
                  f'{r["max_reach_error"] * 1000:.1f} mm')

    if not args.no_export:
        glb = os.path.join(ROOT, 'public', 'models', 'zoo-3d', f'{args.animal}.glb')
        X.export_glb(mesh, arm, glb)
        X.write_manifest(os.path.join(ROOT, 'src', 'games', 'zoo-3d', 'models', f'{args.animal}.json'), args.animal,
                         f'{args.animal}.glb', mesh, clips, getattr(shape, 'MANIFEST_EXTRA', None))
        blend = os.path.join(ROOT, 'assets-src', 'zoo-3d', f'{args.animal}.blend')
        os.makedirs(os.path.dirname(blend), exist_ok=True)
        bpy.context.preferences.filepaths.save_version = 0  # .blend1 を作らない
        bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
        print(f'[zoo3d] wrote {glb} ({os.path.getsize(glb) / 1024:.0f} KiB)')

    if args.qa:
        os.makedirs(args.qa, exist_ok=True)
        with open(os.path.join(args.qa, f'{args.animal}-metrics.json'), 'w') as f:
            json.dump(report, f, indent=2)
        run_qa(args, shape, mesh, arm, clips, actions)


def run_qa(args, shape, mesh, arm, clips, actions) -> None:
    out = args.qa
    center = (0, -0.25, 0.9)
    qa.setup_scene()
    paths = qa.render_views(os.path.join(out, 'model'), center, 6.2, prefix=args.animal)
    qa.contact_sheet(paths, os.path.join(out, f'{args.animal}-model-sheet.png'))

    qa.setup_scene(engine='BLENDER_WORKBENCH', resolution=(480, 360))
    qa.grid_floor()
    cam = qa.camera()
    wanted = {n for n in args.qa_clips.split(',') if n}
    for clip, action in zip(clips, actions):
        if wanted and clip.name not in wanted:
            continue
        frames_n = int(action.frame_end)
        gait = getattr(clip, 'gait', None)
        cycles = 3 if gait is not None else 1
        seq = []
        for i in range(frames_n * cycles + (0 if clip.loop else 1)):
            f = i % frames_n if clip.loop else min(i, frames_n)
            if gait is not None:
                p, th = gait.body_at(i / A.FPS)
                start = gait.body_at(gait.period * cycles / 2)[0]
                seq.append((f, (p.x - start.x, p.y - start.y), th))
            else:
                seq.append((f, (0, 0), 0.0))
        views = [('side', 90, 8), ('front34', 35, 22)] if gait is None or gait.turn == 0 else [('top', 30, 60)]
        for view, az, el in views:
            dist = 8.5 if gait is not None and gait.stride > 0 else 6.4
            qa.aim(cam, center, az, el, dist, lens=50)
            d = os.path.join(out, 'frames', f'{clip.name}-{view}')
            frame_paths = qa.render_frames(d, seq, arm, action)
            qa.encode_video(d, os.path.join(out, f'{args.animal}-{clip.name}-{view}.mp4'))
            qa.strip_sheet(frame_paths[: frames_n + 1], os.path.join(out, f'{args.animal}-{clip.name}-{view}.png'))


if __name__ == '__main__':
    main()
