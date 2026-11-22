"""ウサギのモーション。

- 歩き: 後ろ足2本・前足2本がそろって着く小さな跳ね（`bound`）。1回の跳ねで背中を丸めて伸ばす。
- 走り: 同じ順で大きく速く跳ねる。耳を後ろへ倒す。
- 待機: 鼻をひくひく、耳を左右べつべつに回す。
- 食べる: 頭を下げて、にんじんを小刻みにかじる。
- ねる: 足を体の下へしまって丸くなり（香箱座り）、耳を背中へ倒す。
- たっち: 後ろ足で立ち上がって、前足をそろえ、鼻をひくひくさせてまわりを見る。
- ぴょーん: うれしいときのジャンプ（空中で体をひねる）。
"""

from __future__ import annotations

import math

from mathutils import Matrix, Vector  # type: ignore[import-not-found]

from .. import anim as A
from .. import bodyplan as Q
from ..anim import X, Y, Z, Clip, Pose, RigModel, keys, window
from .rabbit import S

CFG = Q.Config(neck=['neck'], tail=['tail_1'], front_pole=Vector((0, 1, 0.2)), hind_pole=Vector((0, -1, 0.2)),
               toe=(0.065 * S, 0.023 * S, 0.21 * S, 0.03 * S), ear_axis=Vector((-1, 0, 0)), ear_mirror=False)
EAR_TIPS = ('ear_2_l', 'ear_2_r')


def ear_tips(p: Pose, angle: float) -> None:
    for name in EAR_TIPS:
        p.rot(name, -X, angle)


def _with_extra(clip: Clip, extra) -> Clip:
    base = clip.sample

    def sample(t: float) -> Pose:
        p = base(t)
        extra(p, t)
        return p

    out = Clip(clip.name, clip.duration, clip.loop, sample, clip.meta)
    out.gait = clip.gait
    return out


def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    period = 0.5
    clip = Q.locomotion(rig, CFG, name, period=period, stride=0.26, duty=0.52, turn=turn_deg,
                        phases=Q.GAITS['bound'], lift=(0.05 * S, 0.06 * S), pitch=(20, 25),
                        crouch=0.02 * S + abs(turn_deg) / 30 * 0.006, bob=0.018 * S, roll=0.5, sway=0.0,
                        neck_pump=4, neck_pitch=0, head_level=0.7, tail_amp=6, tail_lift=8, spine_flex=7,
                        bob_freq=1)

    def extra(p: Pose, t: float) -> None:
        ear_tips(p, 10 * math.sin(2 * math.pi * (t / period - 0.2)))

    return _with_extra(clip, extra)


def run(rig: RigModel) -> Clip:
    period = 0.36
    clip = Q.locomotion(rig, CFG, 'Run', period=period, stride=0.6, duty=0.3, turn=0, phases=Q.GAITS['bound'],
                        lift=(0.09 * S, 0.1 * S), pitch=(35, 40), crouch=0.03 * S, bob=0.03 * S, roll=0.5,
                        sway=0.0, neck_pump=6, neck_pitch=4, head_level=0.6, tail_amp=4, tail_lift=15,
                        ear_back=35, spine_flex=14, bob_freq=1)

    def extra(p: Pose, t: float) -> None:
        ear_tips(p, 15 + 10 * math.sin(2 * math.pi * (t / period - 0.2)))

    return _with_extra(clip, extra)


def turn(rig: RigModel, direction: int) -> Clip:
    return Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=0.7, stride=0.0, duty=0.55,
                        turn=80 * direction, phases=Q.GAITS['bound'], lift=(0.04 * S, 0.05 * S), pitch=(15, 15),
                        crouch=0.02 * S, bob=0.01 * S, roll=0.5, sway=0.0, neck_pump=2, neck_pitch=0, head_level=0.7,
                        tail_amp=4, tail_lift=6, spine_flex=4, bob_freq=1)


def sniff(p: Pose, t: float, amount: float = 1.0) -> None:
    """鼻をひくひく（頭を小刻みに上下させる）。"""
    p.rot('head', X, 1.8 * amount * math.sin(2 * math.pi * 7 * t))


def idle_extra(p: Pose, t: float) -> None:
    sniff(p, t, window(t, 0.2, 1.6, 0.1) + window(t, 2.8, 3.8, 0.1))
    # 耳を左右べつべつに外へ回す
    p.rot('ear_l', Z, -25 * window(t, 1.6, 2.4, 0.2))
    p.rot('ear_r', Z, 25 * window(t, 2.2, 3.0, 0.2))
    ear_tips(p, 8 * math.sin(2 * math.pi * 0.5 * t))


def eat(rig: RigModel) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 3.4

    def sample(t: float) -> Pose:
        p = Pose(rig)
        down = keys(t, [(0, 0), (0.5, 1), (2.8, 1), (3.3, 0)])
        nibble = window(t, 0.6, 2.7, 0.1) * math.sin(2 * math.pi * 6 * t)
        p.move('hips', (0, 0, -0.012 * S * down))
        p.rot('spine_2', X, 8 * down)
        p.rot('neck', X, 22 * down)
        p.rot('head', X, 18 * down + 4 * nibble)
        Q.ears(p, CFG, 18 * down)
        ear_tips(p, 10 * down)
        Q.eyes(p, 1 - 0.4 * window(t, 1.0, 2.6, 0.15))
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    p = sample(1.0)
    tip = p.posed()['head'] @ Vector((0, rig.length['head'], 0))
    return Clip('Eat', period, False, sample, {'kind': 'eat', 'food': {'bone': 'head', 'grab': 0.6, 'release': 2.6,
                                                                       'reach': round(-tip.y, 3)}})


def _loaf(p: Pose, k: float) -> dict:
    """足を体の下へしまって丸くなる。"""
    p.move('hips', (0, 0, -0.07 * S * k))
    p.rot('hips', X, 4 * k)
    p.rot('neck', X, 10 * k)
    p.rot('head', X, 6 * k)
    Q.ears(p, CFG, 70 * k)
    ear_tips(p, 15 * k)
    return {'front_l': Vector((0, 0.02 * S * k, 0)), 'front_r': Vector((0, 0.02 * S * k, 0))}


def lie_down(rig: RigModel, reverse: bool = False) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 1.2

    def sample(t: float) -> Pose:
        if reverse:
            t = period - t
        k = keys(t, [(0.05, 0), (1.1, 1)])
        p = Pose(rig)
        offsets = _loaf(p, k)
        Q.eyes(p, 1 - 0.4 * k)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets)
        return p

    return Clip('GetUp' if reverse else 'LieDown', period, False, sample, {'kind': 'sleep'})


def sleep(rig: RigModel) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 3.0

    def sample(t: float) -> Pose:
        c = t / period
        p = Pose(rig)
        offsets = _loaf(p, 1)
        breath = math.sin(2 * math.pi * c)
        p.move('hips', (0, 0, 0.004 * S * breath))
        p.rot('spine_1', X, -2 * breath)
        p.rot('head', X, 2 * breath)
        sniff(p, t, 0.4 * window(t, 1.6, 2.2, 0.1))
        Q.eyes(p, 0.06)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets)
        return p

    return Clip('Sleep', period, True, sample, {'kind': 'sleep'})


def stand(rig: RigModel) -> Clip:
    """後ろ足で立ち上がり、前足をそろえて鼻をひくひく。まわりをきょろきょろ見る。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.4

    def sample(t: float) -> Pose:
        p = Pose(rig)
        up = keys(t, [(0.1, 0), (0.6, 1), (2.7, 1), (3.2, 0)])
        look = window(t, 0.8, 2.6, 0.2)
        p.move('hips', (0, 0.02 * S * up, 0.02 * S * up))
        p.rot('hips', X, -58 * up)
        p.rot('spine_2', X, 8 * up)
        p.rot('neck', X, 30 * up)
        p.rot('head', X, 14 * up)
        p.rot('head', Z, 28 * look * math.sin(2 * math.pi * 0.6 * (t - 0.8)))
        sniff(p, t, look)
        Q.ears(p, CFG, -12 * up)
        Q.eyes(p, 1.0)
        posed = p.posed()
        for key in ('back_l', 'back_r'):
            leg = lg[key]
            A.leg_ik(p, posed, leg.upper, leg.lower, leg.foot, ra[key], leg.pole)
        # 前足は胸の前でそろえる
        for side in ('l', 'r'):
            p.rot(f'front_leg_upper_{side}', X, -25 * up)
            p.rot(f'front_leg_lower_{side}', X, 70 * up)
            p.rot(f'front_leg_foot_{side}', X, 40 * up)
        return p

    return Clip('Stand', period, False, sample, {'kind': 'special', 'sound': 'sniff', 'callStart': 0.9,
                                                 'callEnd': 2.4})


def binky(rig: RigModel) -> Clip:
    """うれしくて、空中で体をひねるジャンプを2回。"""
    lg, ra = Q.standing(rig, CFG)
    period = 2.4
    jumps = [(0.45, 0.95, 1), (1.35, 1.85, -1)]

    def sample(t: float) -> Pose:
        p = Pose(rig)
        air, twist, squat = 0.0, 0.0, 0.0
        for t0, t1, d in jumps:
            if t0 <= t <= t1:
                s = (t - t0) / (t1 - t0)
                air = math.sin(math.pi * s) * 0.2 * S
                twist = d * math.sin(math.pi * s)
            squat += window(t, t0 - 0.2, t0 + 0.02, 0.08) + window(t, t1 - 0.02, t1 + 0.16, 0.06)
        joy = window(t, 0.2, 2.2, 0.2)
        p.move('hips', (0, 0, air - 0.03 * S * squat))
        p.rot('hips', Z, 30 * twist)
        p.rot('hips', Y, 20 * twist)
        p.rot('spine_1', X, -10 * abs(twist))
        p.rot('head', Z, -18 * twist)
        Q.ears(p, CFG, 30 * abs(twist))
        ear_tips(p, 25 * abs(twist))
        Q.eyes(p, 1 - 0.7 * joy)
        offsets = {k: Vector((0, 0, air)) for k in lg}
        rots = {k: Matrix.Rotation(math.radians(30 * twist), 3, 'Z') for k in lg}
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets, rots)
        # 空中では後ろ足を後ろへ蹴り出す
        kick = min(1.0, air / (0.1 * S))
        for side in ('l', 'r'):
            p.rot(f'back_leg_foot_{side}', X, -35 * kick)
        return p

    return Clip('Binky', period, False, sample, {'kind': 'special'})


def happy_extra(p: Pose, t: float) -> None:
    ear_tips(p, 15 * math.sin(2 * math.pi * 3 * t) * window(t, 0.1, 1.4, 0.2))


def clips(rig: RigModel) -> list[Clip]:
    return [Q.idle(rig, CFG, extra=idle_extra), walk(rig), walk(rig, 30, 'WalkLeft'), walk(rig, -30, 'WalkRight'),
            run(rig), turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True),
            stand(rig), binky(rig), Q.happy(rig, CFG, extra=happy_extra), Q.blink_clip(rig)]
