"""パイプライン自体の自己診断（メッシュなしの棒人形で、体型ごとの歩容が足を滑らせないかを確かめる）。

    blender -b --factory-startup --python scripts/zoo-3d/selftest.py

四足（quadruped）と二足（biped）の骨格を作り、歩き・曲がり歩き・走り・方向転換を生成して、
接地中の足の滑り量と IK の未到達量が 1mm 未満であることを確認する。新しい体型を足したときや、
anim.py / bodyplan.py を変更したときに実行する。失敗すると終了コード 1 を返す。
"""

from __future__ import annotations

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # type: ignore[import-not-found]  # noqa: E402
from mathutils import Vector  # type: ignore[import-not-found]  # noqa: E402

from zoo3d import anim as A  # noqa: E402
from zoo3d import bodyplan as P  # noqa: E402
from zoo3d import qa  # noqa: E402
from zoo3d.rig import BoneSpec, build_armature, with_mirrors  # noqa: E402

TOLERANCE = 0.001


def quadruped_specs():
    x, fy, hy = 0.2, -0.35, 0.35
    return with_mirrors([
        BoneSpec('root', (0, 0, 0), (0, 0.3, 0)),
        BoneSpec('hips', (0, hy, 0.7), (0, 0.0, 0.72), 'root'),
        BoneSpec('spine_1', (0, 0.0, 0.72), (0, -0.2, 0.74), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.2, 0.74), (0, fy, 0.76), 'spine_1', connect=True),
        BoneSpec('neck', (0, fy, 0.76), (0, -0.5, 0.95), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.5, 0.95), (0, -0.75, 0.95), 'neck', connect=True),
        BoneSpec('ear_l', (0.1, -0.55, 1.05), (0.15, -0.55, 1.15), 'head'),
        BoneSpec('eye_l', (0.1, -0.7, 1.0), (0.1, -0.75, 1.0), 'head'),
        BoneSpec('tail_1', (0, hy + 0.05, 0.72), (0, hy + 0.3, 0.6), 'hips'),
        BoneSpec('front_leg_upper_l', (x, fy, 0.66), (x, fy + 0.08, 0.36), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x, fy + 0.08, 0.36), (x, fy, 0.1), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, fy, 0.1), (x, fy - 0.12, 0.03), 'front_leg_lower_l', connect=True),
        BoneSpec('back_leg_upper_l', (x, hy, 0.66), (x, hy - 0.08, 0.36), 'hips'),
        BoneSpec('back_leg_lower_l', (x, hy - 0.08, 0.36), (x, hy, 0.1), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, hy, 0.1), (x, hy - 0.12, 0.03), 'back_leg_lower_l', connect=True),
    ])


def biped_specs():
    x = 0.12
    return with_mirrors([
        BoneSpec('root', (0, 0, 0), (0, 0.3, 0)),
        BoneSpec('hips', (0, 0.05, 0.62), (0, 0.0, 0.8), 'root'),
        BoneSpec('spine_1', (0, 0.0, 0.8), (0, -0.02, 1.0), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.02, 1.0), (0, -0.03, 1.15), 'spine_1', connect=True),
        BoneSpec('neck', (0, -0.03, 1.15), (0, -0.05, 1.25), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.05, 1.25), (0, -0.2, 1.3), 'neck', connect=True),
        BoneSpec('ear_l', (0.08, -0.1, 1.35), (0.1, -0.1, 1.42), 'head'),
        BoneSpec('eye_l', (0.06, -0.18, 1.32), (0.06, -0.22, 1.32), 'head'),
        BoneSpec('tail_1', (0, 0.1, 0.6), (0, 0.25, 0.5), 'hips'),
        BoneSpec('wing_l', (0.15, -0.02, 1.05), (0.3, 0.05, 0.85), 'spine_2'),
        BoneSpec('leg_upper_l', (x, 0.05, 0.6), (x, -0.02, 0.32), 'hips'),
        BoneSpec('leg_lower_l', (x, -0.02, 0.32), (x, 0.05, 0.08), 'leg_upper_l', connect=True),
        BoneSpec('leg_foot_l', (x, 0.05, 0.08), (x, -0.1, 0.02), 'leg_lower_l', connect=True),
    ])


def check(name: str, specs, cfg: P.Config, gaits: list[dict]) -> bool:
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    arm = build_armature(name, specs)
    rig = A.RigModel(arm)
    ok = True
    for g in gaits:
        clip = P.locomotion(rig, cfg, g['name'], **{k: v for k, v in g.items() if k != 'name'})
        r = qa.foot_slide_report(clip, cycles=2, samples_per_cycle=60)
        good = r['max_slide'] < TOLERANCE and r['max_reach_error'] < TOLERANCE
        ok &= good
        print(f'[selftest] {name} {g["name"]}: slide {r["max_slide"] * 1000:.2f} mm, '
              f'reach {r["max_reach_error"] * 1000:.2f} mm {"OK" if good else "NG"}')
    return ok


def gait(name, phases, period, stride, duty, turn=0.0, lift=(0.08, 0.07), crouch=0.04):
    return dict(name=name, period=period, stride=stride, duty=duty, turn=turn, phases=phases, lift=lift,
                pitch=(25, 20), crouch=crouch, bob=0.008, roll=2, sway=0.01, neck_pump=2, neck_pitch=0,
                head_level=0.6, tail_amp=10, tail_lift=0)


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    quad = P.Config(neck=['neck'], tail=['tail_1'], front_pole=Vector((0, 1, 0.2)), hind_pole=Vector((0, -1, 0.2)),
                    toe=(0.12, 0.07, 0.12, 0.07))
    biped = P.Config(neck=['neck'], tail=['tail_1'], front_pole=Vector((0, -1, 0.2)), hind_pole=Vector((0, -1, 0.2)),
                     toe=(0.15, 0.06, 0.15, 0.06), plan='biped')
    ok = check('quadruped', quadruped_specs(), quad, [
        gait('Walk', P.GAITS['lateral_walk'], 1.1, 0.6, 0.62),
        gait('WalkLeft', P.GAITS['lateral_walk'], 1.1, 0.6, 0.62, turn=28, crouch=0.055),
        gait('Run', P.GAITS['gallop'], 0.6, 1.0, 0.35, lift=(0.14, 0.12), crouch=0.06),
        gait('TurnLeft', P.GAITS['lateral_walk'], 1.2, 0.0, 0.68, turn=80),
    ])
    ok &= check('biped', biped_specs(), biped, [
        gait('Walk', P.GAITS['biped_walk'], 0.9, 0.5, 0.62),
        gait('WalkLeft', P.GAITS['biped_walk'], 0.9, 0.5, 0.62, turn=25, crouch=0.05),
        gait('Run', P.GAITS['biped_walk'], 0.5, 0.8, 0.4, lift=(0.1, 0.1), crouch=0.06),
        gait('Hop', P.GAITS['biped_hop'], 0.6, 0.3, 0.5, lift=(0.12, 0.12), crouch=0.05),
        gait('TurnLeft', P.GAITS['biped_walk'], 1.0, 0.0, 0.7, turn=90),
    ])
    print('[selftest] ' + ('PASSED' if ok else 'FAILED'))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
