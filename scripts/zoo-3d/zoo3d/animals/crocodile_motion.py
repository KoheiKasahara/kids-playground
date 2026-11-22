"""ワニのモーション。

- 歩き: 後ろ足→同じ側の前足の順に着く4拍子。ひじ・ひざを外へ張り出し、体を左右にくねらせ、尾を大きくふる。
- 走り: 同じ順で速く小走り（体を持ち上げる「ハイウォーク」）。
- 食べる: 頭を少し横へかしげて、口を何度もぱくぱく。
- ねる: おなかを地面につけて、あごものせる。
- ぱくっ: 口を大きく開けて、勢いよく閉じる。
- ひなたぼっこ: おなかを地面につけ、口を開けたまま目を閉じてのんびり。
"""

from __future__ import annotations

import math

from mathutils import Vector  # type: ignore[import-not-found]

from .. import anim as A
from .. import bodyplan as Q
from ..anim import X, Z, Clip, Pose, RigModel, keys, window

TAIL = ['tail_1', 'tail_2', 'tail_3', 'tail_4']
# 耳はないので、待機中のぴくっとした動きは尾の先に割り当てる（左右で打ち消すので喜ぶ動きには使わない）
CFG = Q.Config(neck=['neck'], tail=TAIL, front_pole=Vector((1, 0.4, 0.3)), hind_pole=Vector((1, -0.4, 0.3)),
               toe=(0.08, 0.03, 0.11, 0.035), ears=('tail_4', 'tail_4'), ear_axis=Vector((0, 0, 1)),
               jaw='jaw', pole_mirror=True)


def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    return Q.locomotion(rig, CFG, name, period=0.95, stride=0.36, duty=0.66, turn=turn_deg,
                        phases=Q.GAITS['lateral_walk'], lift=(0.05, 0.05), pitch=(15, 15),
                        crouch=0.025 + abs(turn_deg) / 30 * 0.08, bob=0.006, roll=4.0, sway=0.015, neck_pump=0,
                        neck_pitch=0, head_level=0.0, tail_amp=22, tail_lift=0)


def run(rig: RigModel) -> Clip:
    return Q.locomotion(rig, CFG, 'Run', period=0.48, stride=0.4, duty=0.52, turn=0, phases=Q.GAITS['lateral_walk'],
                        lift=(0.06, 0.06), pitch=(20, 20), crouch=0.005, bob=0.008, roll=5.0, sway=0.015,
                        neck_pump=0, neck_pitch=-3, head_level=0.0, tail_amp=28, tail_lift=0)


def turn(rig: RigModel, direction: int) -> Clip:
    return Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=0.8, stride=0.0, duty=0.62,
                        turn=34 * direction, phases=Q.GAITS['lateral_walk'], lift=(0.04, 0.04), pitch=(12, 12),
                        crouch=0.045, bob=0.004, roll=3, sway=0.01, neck_pump=0, neck_pitch=0, head_level=0.0,
                        tail_amp=18, tail_lift=0)


def idle_extra(p: Pose, t: float) -> None:
    # 口を少しだけ開けて、ときどき「ぱくっ」
    p.rot('jaw', X, 4 + 14 * window(t, 2.0, 2.4, 0.08))


def eat(rig: RigModel) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 3.2

    def sample(t: float) -> Pose:
        p = Pose(rig)
        down = keys(t, [(0, 0), (0.5, 1), (2.7, 1), (3.1, 0)])
        snap = window(t, 0.6, 2.6, 0.1) * (0.5 + 0.5 * math.sin(2 * math.pi * 3 * t))
        p.rot('neck', X, 8 * down)
        p.rot('head', X, 6 * down)
        p.rot('head', Vector((0, 1, 0)), 16 * down)
        p.rot('jaw', X, 26 * snap)
        Q.tail_wave(p, CFG, t, 1.4, 10, 0)
        Q.eyes(p, 1 - 0.5 * window(t, 1.0, 2.4, 0.15))
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    p = sample(1.0)
    tip = p.posed()['head'] @ Vector((0, rig.length['head'], 0))
    return Clip('Eat', period, False, sample, {'kind': 'eat', 'food': {'bone': 'head', 'grab': 0.8, 'release': 2.5,
                                                                       'reach': round(-tip.y * 0.85, 3)}})


def _flat(p: Pose, k: float) -> dict:
    """おなかとあごを地面につける。脚は体の横へ少し広げる。"""
    p.move('hips', (0, 0, -0.09 * k))
    p.rot('neck', X, 3 * k)
    p.rot('head', X, 2 * k)
    return {key: Vector((0.05 * k * (1 if key.endswith('l') else -1), 0, 0)) for key in ('front_l', 'front_r',
                                                                                       'back_l', 'back_r')}


def lie_down(rig: RigModel, reverse: bool = False) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 1.2

    def sample(t: float) -> Pose:
        if reverse:
            t = period - t
        k = keys(t, [(0.05, 0), (1.1, 1)])
        p = Pose(rig)
        offsets = _flat(p, k)
        Q.eyes(p, 1 - 0.4 * k)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets)
        return p

    return Clip('GetUp' if reverse else 'LieDown', period, False, sample, {'kind': 'sleep'})


def sleep(rig: RigModel) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 4.0

    def sample(t: float) -> Pose:
        c = t / period
        p = Pose(rig)
        offsets = _flat(p, 1)
        breath = math.sin(2 * math.pi * c)
        p.move('hips', (0, 0, 0.004 * breath))
        p.rot('spine_1', X, -1 * breath)
        Q.tail_wave(p, CFG, t, 4.0, 5, 0)
        Q.eyes(p, 0.06)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets)
        return p

    return Clip('Sleep', period, True, sample, {'kind': 'sleep'})


def chomp(rig: RigModel) -> Clip:
    """口を大きく開けて、勢いよく「ぱくっ」と閉じる（2回）。"""
    lg, ra = Q.standing(rig, CFG)
    period = 2.6
    snaps = (1.0, 1.9)

    def sample(t: float) -> Pose:
        p = Pose(rig)
        k = keys(t, [(0.1, 0), (0.4, 1), (2.2, 1), (2.5, 0)])
        opening = max(keys(t, [(s - 0.55, 0), (s - 0.1, 1), (s, 0)]) for s in snaps)
        p.rot('neck', X, -6 * k - 8 * opening)
        p.rot('head', X, -10 * opening)
        p.rot('jaw', X, 48 * opening)
        Q.tail_wave(p, CFG, t, 0.6, 20 * k, 0)
        Q.eyes(p, 1.0)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Chomp', period, False, sample, {'kind': 'special', 'sound': 'chomp', 'callStart': snaps[0] - 0.05,
                                                 'callEnd': snaps[1] + 0.2})


def bask(rig: RigModel) -> Clip:
    """おなかを地面につけ、口を開けたまま目を閉じて、ひなたぼっこ。"""
    lg, ra = Q.standing(rig, CFG)
    period = 4.6

    def sample(t: float) -> Pose:
        p = Pose(rig)
        k = keys(t, [(0.1, 0), (0.9, 1), (3.8, 1), (4.5, 0)])
        gape = keys(t, [(0.8, 0), (1.4, 1), (3.5, 1), (4.0, 0)])
        offsets = _flat(p, k)
        p.rot('neck', X, -8 * gape)
        p.rot('head', X, -8 * gape)
        p.rot('jaw', X, 34 * gape)
        Q.eyes(p, 1 - 0.94 * gape)
        Q.tail_wave(p, CFG, t, 2.3, 8 * k, 0)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets)
        return p

    return Clip('Bask', period, False, sample, {'kind': 'special'})


def happy_extra(p: Pose, t: float) -> None:
    p.rot('jaw', X, 16 * window(t, 0.2, 1.3, 0.2))


def clips(rig: RigModel) -> list[Clip]:
    return [Q.idle(rig, CFG, extra=idle_extra), walk(rig), walk(rig, 14, 'WalkLeft'), walk(rig, -14, 'WalkRight'),
            run(rig), turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True),
            chomp(rig), bask(rig), Q.happy(rig, CFG, extra=happy_extra), Q.blink_clip(rig)]
