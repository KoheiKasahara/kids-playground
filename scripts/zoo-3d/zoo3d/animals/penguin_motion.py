"""ペンギンのモーション（二足・鳥）。

- 歩き: 左右の足を小さく交互に出す。体を左右へ大きく傾けて、よちよち歩く（`biped_walk`、`roll` を大きく）。
- 走り: 同じ足の順で速く短い歩幅。ひれを横へ広げてバランスを取る。
- 食べる: 体を前へ倒して、くちばしで魚をくわえ（beak_tip で運ぶ）、上を向いてごくん。
- ねる: おなかを下にしてねそべる。脚は体といっしょに後ろへ向ける。
- ぱたぱた: ひれを大きくはばたかせ、くちばしを上げて鳴く。
- ぴょんぴょん: 両足をそろえて、その場で3回はねる。
"""

from __future__ import annotations

import math

from mathutils import Matrix, Vector  # type: ignore[import-not-found]

from .. import anim as A
from .. import bodyplan as Q
from ..anim import X, Y, Z, Clip, Pose, RigModel, keys, window

# ひれは「耳」の枠を使い、待機中のぴくっとした動きと喜ぶときの動きに使う（外へ開くのが正）
CFG = Q.Config(neck=['neck'], tail=['tail_1'], front_pole=Vector((0, -1, 0.2)), hind_pole=Vector((0, -1, 0.2)),
               toe=(0.11, 0.035, 0.11, 0.035), ears=('wing_l', 'wing_r'), ear_axis=Vector((0, -1, 0)), plan='biped')


def flippers(p: Pose, angle: float, fold: float = 0.0) -> None:
    """ひれを外へ開く（angle 度）。fold は前後へのひねり（+ で前へ）。"""
    p.rot('wing_l', Y, -angle).rot('wing_r', Y, angle)
    if fold:
        p.rot('wing_l', X, -fold).rot('wing_r', X, -fold)


def _with_extra(clip: Clip, extra) -> Clip:
    """歩容クリップに、足の IK を変えない上半身の動き（ひれ）を足す。"""
    base = clip.sample

    def sample(t: float) -> Pose:
        p = base(t)
        extra(p, t)
        return p

    out = Clip(clip.name, clip.duration, clip.loop, sample, clip.meta)
    out.gait = clip.gait
    return out


def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    period = 0.66
    clip = Q.locomotion(rig, CFG, name, period=period, stride=0.24, duty=0.62, turn=turn_deg,
                        phases=Q.GAITS['biped_walk'], lift=(0.035, 0.035), pitch=(14, 14),
                        crouch=0.025 + abs(turn_deg) / 30 * 0.01, bob=0.01, roll=9.0, sway=0.022, neck_pump=2,
                        neck_pitch=-3, head_level=0.4, tail_amp=14, tail_lift=0)

    def extra(p: Pose, t: float) -> None:
        # 体の傾きと逆のひれを少し開いて、バランスを取る
        c = t / period
        flippers(p, 10)
        p.rot('wing_l', Y, -8 * max(0.0, math.cos(2 * math.pi * c)))
        p.rot('wing_r', Y, 8 * max(0.0, -math.cos(2 * math.pi * c)))

    return _with_extra(clip, extra)


def run(rig: RigModel) -> Clip:
    period = 0.4
    clip = Q.locomotion(rig, CFG, 'Run', period=period, stride=0.32, duty=0.5, turn=0, phases=Q.GAITS['biped_walk'],
                        lift=(0.045, 0.045), pitch=(20, 20), crouch=0.045, bob=0.012, roll=7.0, sway=0.015,
                        neck_pump=3, neck_pitch=8, head_level=0.4, tail_amp=10, tail_lift=0, spine_flex=0)

    def extra(p: Pose, t: float) -> None:
        p.rot('spine_1', X, 12)  # 前のめり（足の IK を変えないよう、腰より上で傾ける）
        p.rot('neck', X, -10)
        flippers(p, 42 + 6 * math.sin(2 * math.pi * 2 * t / period), fold=-10)

    return _with_extra(clip, extra)


def turn(rig: RigModel, direction: int) -> Clip:
    clip = Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=0.9, stride=0.0, duty=0.66,
                        turn=90 * direction, phases=Q.GAITS['biped_walk'], lift=(0.03, 0.03), pitch=(10, 10),
                        crouch=0.02, bob=0.008, roll=7, sway=0.015, neck_pump=2, neck_pitch=0, head_level=0.4,
                        tail_amp=10, tail_lift=0)
    return _with_extra(clip, lambda p, t: flippers(p, 14))


def idle_extra(p: Pose, t: float) -> None:
    flippers(p, 8)
    # 首をかしげて、ひれを2回ぱたぱた
    p.rot('head', Y, 12 * window(t, 1.6, 2.7, 0.3))
    flap = window(t, 3.0, 3.6, 0.08) * max(0.0, math.sin(2 * math.pi * 3.3 * (t - 3.0)))
    flippers(p, 30 * flap)


def eat(rig: RigModel) -> Clip:
    """体を前へ倒して魚をくわえ、上を向いてごくんと飲みこむ。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.2
    grab, release = 0.85, 2.3

    def sample(t: float) -> Pose:
        p = Pose(rig)
        down = keys(t, [(0, 0), (0.75, 1), (1.05, 1), (1.6, 0)])
        up = keys(t, [(1.4, 0), (1.9, 1), (2.6, 1), (3.1, 0)])
        gulp = window(t, 2.0, 2.5, 0.08) * math.sin(2 * math.pi * 6 * t)
        p.move('hips', (0, 0, -0.02 * down))
        p.rot('hips', X, 42 * down - 8 * up)
        p.rot('spine_1', X, 10 * down)
        p.rot('neck', X, 22 * down - 26 * up)
        p.rot('head', X, 10 * down - 30 * up + 3 * gulp)
        flippers(p, 18 * down + 26 * up)
        Q.eyes(p, 1 - 0.75 * window(t, 2.0, 2.7, 0.12))
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    p = sample(grab)
    tip = p.posed()['beak_tip'].translation
    return Clip('Eat', period, False, sample, {'kind': 'eat', 'food': {'bone': 'beak_tip', 'hold': True, 'grab': grab,
                                                                       'release': release, 'holdOffset': -0.02,
                                                                       'reach': round(-tip.y, 3)}})


def _lying(p: Pose, k: float) -> None:
    """おなかを下にしてねそべる（足元を支点に体を前へ倒す）。"""
    p.move('hips', (0, -0.16 * k, -0.14 * k))
    p.rot('hips', X, 78 * k)
    p.rot('neck', X, -40 * k)
    p.rot('head', X, -18 * k)
    flippers(p, 25 * k, fold=-20 * k)


def _legs_blend(rig: RigModel, p: Pose, lg: dict, ra: dict, k: float) -> Pose:
    """立っているときは足を地面に固定し、ねそべるにつれて体といっしょに後ろへ向ける。"""
    planted = Q.blend(p, p, 0)
    A.plant_feet(planted, planted.posed(), lg, ra)
    free = Q.blend(p, p, 0)
    for side in ('l', 'r'):
        free.rot(f'leg_upper_{side}', X, -60).rot(f'leg_lower_{side}', X, 20).rot(f'leg_foot_{side}', X, 50)
    return Q.blend(planted, free, keys(k, [(0.35, 0), (0.9, 1)]))


def lie_down(rig: RigModel, reverse: bool = False) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 1.6

    def sample(t: float) -> Pose:
        if reverse:
            t = period - t
        k = keys(t, [(0.1, 0), (1.5, 1)])
        p = Pose(rig)
        _lying(p, k)
        Q.eyes(p, 1 - 0.4 * k)
        return _legs_blend(rig, p, lg, ra, k)

    return Clip('GetUp' if reverse else 'LieDown', period, False, sample, {'kind': 'sleep'})


def sleep(rig: RigModel) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 4.0

    def sample(t: float) -> Pose:
        c = t / period
        p = Pose(rig)
        _lying(p, 1)
        breath = math.sin(2 * math.pi * c)
        p.move('hips', (0, 0, 0.006 * breath))
        p.rot('spine_1', X, -2 * breath)
        p.rot('head', Z, 18)
        p.rot('head', X, 8 + 2 * breath)
        Q.eyes(p, 0.06)
        return _legs_blend(rig, p, lg, ra, 1)

    return Clip('Sleep', period, True, sample, {'kind': 'sleep'})


def flap(rig: RigModel) -> Clip:
    """ひれを大きくはばたかせ、くちばしを空へ向けて鳴く。"""
    lg, ra = Q.standing(rig, CFG)
    period = 2.8
    call0, call1 = 1.0, 2.0

    def sample(t: float) -> Pose:
        p = Pose(rig)
        k = keys(t, [(0, 0), (0.35, 1), (period - 0.35, 1), (period, 0)])
        beat = 0.5 + 0.5 * math.sin(2 * math.pi * 4 * t)
        call = window(t, call0, call1, 0.15)
        p.move('hips', (0, 0, 0.012 * k * beat))
        p.rot('hips', X, -6 * k)
        p.rot('neck', X, -20 * call)
        p.rot('head', X, -28 * call)
        p.rot('head', Y, 6 * call * math.sin(2 * math.pi * 5 * t))
        flippers(p, k * (25 + 55 * beat))
        Q.eyes(p, 1 - 0.7 * call)
        Q.tail_wave(p, CFG, t, 0.3, 18 * k, 0)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Flap', period, False, sample, {'kind': 'special', 'sound': 'honk', 'callStart': call0,
                                                'callEnd': call1})


def hop(rig: RigModel) -> Clip:
    """両足をそろえて、その場で3回ぴょんとはねる。"""
    lg, ra = Q.standing(rig, CFG)
    period = 2.6
    hops = [(0.4, 0.85), (1.0, 1.45), (1.6, 2.05)]

    def sample(t: float) -> Pose:
        p = Pose(rig)
        air = 0.0
        squat = 0.0
        for t0, t1 in hops:
            if t0 <= t <= t1:
                air = math.sin(math.pi * (t - t0) / (t1 - t0)) * 0.12
            squat += window(t, t0 - 0.18, t0 + 0.02, 0.08) + window(t, t1 - 0.02, t1 + 0.14, 0.06)
        joy = window(t, 0.2, 2.3, 0.25)
        p.move('hips', (0, 0, air - 0.03 * squat))
        p.rot('hips', X, 5 * squat - 4 * (air > 0))
        p.rot('head', X, -10 * joy)
        flippers(p, 15 + 45 * min(1.0, air / 0.06))
        Q.eyes(p, 1 - 0.65 * joy)
        offsets = {k: Vector((0, 0, air)) for k in lg}
        rots = {k: Matrix.Rotation(math.radians(-20 * min(1.0, air / 0.05)), 3, 'X') for k in lg}
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets, rots)
        return p

    return Clip('Hop', period, False, sample, {'kind': 'special'})


def happy_extra(p: Pose, t: float) -> None:
    flippers(p, 30 + 25 * math.sin(2 * math.pi * 4 * t) * window(t, 0.1, 1.4, 0.2))


def clips(rig: RigModel) -> list[Clip]:
    return [Q.idle(rig, CFG, extra=idle_extra), walk(rig), walk(rig, 30, 'WalkLeft'), walk(rig, -30, 'WalkRight'),
            run(rig), turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True),
            flap(rig), hop(rig), Q.happy(rig, CFG, extra=happy_extra), Q.blink_clip(rig)]
