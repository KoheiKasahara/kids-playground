"""カンガルーのモーション（二足・跳ね）。

- 歩き: 両足をそろえて小さく跳ねる（`biped_hop`）。着地で体を沈め、空中で伸びる。尾は跳ねに合わせて上下にふる。
- 走り: 同じ跳ねを大きく速く。体を前へ倒し、前足をたたむ。
- 食べる: 体を前へ倒して前足を地面につき、草をはむ。
- ねる: 尾と後ろ足で座りこみ、頭を下げて目を閉じる。
- ボクシング: 尾で体を支えて背をのばし、前足で「ぽこぽこ」とパンチ。
- ジャンプ: その場で大きく跳び上がる。
"""

from __future__ import annotations

import math

from mathutils import Matrix, Vector  # type: ignore[import-not-found]

from .. import anim as A
from .. import bodyplan as Q
from ..anim import X, Y, Z, Clip, Pose, RigModel, keys, window

CFG = Q.Config(neck=['neck'], tail=['tail_1', 'tail_2', 'tail_3'], front_pole=Vector((0, -1, 0.2)),
               hind_pole=Vector((0, -1, 0.2)), toe=(0.25, 0.035, 0.25, 0.035), ear_axis=Vector((-1, 0, 0)),
               ear_mirror=False, plan='biped')
TAIL = ['tail_1', 'tail_2', 'tail_3']


def arms(p: Pose, fold: float, spread: float = 0.0) -> None:
    """前足をたたむ（fold 度、+ で胸へ寄せる）・開く。"""
    for side, sx in (('l', 1), ('r', -1)):
        p.rot(f'arm_{side}', X, -fold * 0.5).rot(f'arm_2_{side}', X, -fold)
        if spread:
            p.rot(f'arm_{side}', Y, -spread * sx)


def tail_pump(p: Pose, amount: float) -> None:
    """尾を上（+）・下（-）へふる。"""
    p.rot_chain(TAIL, -X, amount, [1.0, 0.6, 0.4])


def _with_extra(clip: Clip, extra) -> Clip:
    base = clip.sample

    def sample(t: float) -> Pose:
        p = base(t)
        extra(p, t)
        return p

    out = Clip(clip.name, clip.duration, clip.loop, sample, clip.meta)
    out.gait = clip.gait
    return out


def hop(rig: RigModel, name: str, period: float, stride: float, duty: float, lift: float, turn_deg: float,
        lean: float, bob: float) -> Clip:
    clip = Q.locomotion(rig, CFG, name, period=period, stride=stride, duty=duty, turn=turn_deg,
                        phases=Q.GAITS['biped_hop'], lift=(lift, lift), pitch=(30, 30),
                        crouch=0.03 + abs(turn_deg) / 30 * 0.01, bob=-bob, roll=0.0, sway=0.0, neck_pump=5,
                        neck_pitch=0, head_level=0.8, tail_amp=0, tail_lift=0, spine_flex=4, bob_freq=1)

    def extra(p: Pose, t: float) -> None:
        c = t / period
        flight = -math.cos(2 * math.pi * c)  # 空中の中ほどで +1、着地で -1
        p.rot('spine_1', X, lean)
        p.rot('neck', X, -lean * 0.8)
        tail_pump(p, 12 * flight + 4)
        arms(p, 35 + 10 * flight)

    return _with_extra(clip, extra)


def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    return hop(rig, name, period=0.6, stride=0.36, duty=0.5, lift=0.07, turn_deg=turn_deg, lean=6, bob=0.04)


def run(rig: RigModel) -> Clip:
    return hop(rig, 'Run', period=0.48, stride=1.0, duty=0.34, lift=0.14, turn_deg=0, lean=18, bob=0.07)


def turn(rig: RigModel, direction: int) -> Clip:
    return hop(rig, 'TurnLeft' if direction > 0 else 'TurnRight', period=0.7, stride=0.0, duty=0.55, lift=0.05,
               turn_deg=80 * direction, lean=4, bob=0.03)


def idle_extra(p: Pose, t: float) -> None:
    arms(p, 30)
    tail_pump(p, 3 * math.sin(2 * math.pi * 0.25 * t))
    # 耳を片方ずつくるっと回す
    p.rot('ear_l', Z, -30 * window(t, 1.5, 2.1, 0.15))
    p.rot('ear_r', Z, 30 * window(t, 2.6, 3.2, 0.15))


def eat(rig: RigModel) -> Clip:
    """体を前へ倒して前足を地面につき、草をはむ。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.6

    def sample(t: float) -> Pose:
        p = Pose(rig)
        down = keys(t, [(0, 0), (0.7, 1), (2.9, 1), (3.5, 0)])
        chew = window(t, 0.9, 2.8, 0.1) * math.sin(2 * math.pi * 3 * t)
        p.move('hips', (0, -0.02 * down, -0.04 * down))
        p.rot('hips', X, 28 * down)
        p.rot('spine_1', X, 18 * down)
        p.rot('spine_2', X, 8 * down)
        p.rot('neck', X, 6 * down)
        p.rot('head', X, 10 * down + 3 * chew)
        for side in ('l', 'r'):
            p.rot(f'arm_{side}', X, 30 * down).rot(f'arm_2_{side}', X, -10 * down)
        tail_pump(p, -6 * down)
        Q.ears(p, CFG, 10 * down)
        Q.eyes(p, 1 - 0.45 * window(t, 1.1, 2.7, 0.15))
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    p = sample(1.2)
    tip = p.posed()['head'] @ Vector((0, rig.length['head'], 0))
    return Clip('Eat', period, False, sample, {'kind': 'eat', 'food': {'bone': 'head', 'grab': 0.8, 'release': 2.7,
                                                                       'reach': round(-tip.y, 3)}})


def _sit(p: Pose, k: float) -> None:
    p.move('hips', (0, 0.03 * k, -0.11 * k))
    p.rot('hips', X, -8 * k)
    p.rot('spine_1', X, 10 * k)
    p.rot('neck', X, 14 * k)
    p.rot('head', X, 10 * k)
    tail_pump(p, -4 * k)
    arms(p, 40 * k)
    Q.ears(p, CFG, 35 * k)


def lie_down(rig: RigModel, reverse: bool = False) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 1.4

    def sample(t: float) -> Pose:
        if reverse:
            t = period - t
        k = keys(t, [(0.05, 0), (1.3, 1)])
        p = Pose(rig)
        _sit(p, k)
        Q.eyes(p, 1 - 0.4 * k)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('GetUp' if reverse else 'LieDown', period, False, sample, {'kind': 'sleep'})


def sleep(rig: RigModel) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 4.0

    def sample(t: float) -> Pose:
        c = t / period
        p = Pose(rig)
        _sit(p, 1)
        breath = math.sin(2 * math.pi * c)
        p.move('hips', (0, 0, 0.005 * breath))
        p.rot('spine_1', X, -1.5 * breath)
        p.rot('head', X, 8 + 3 * breath)
        twitch = window(t, 2.5, 2.9, 0.08) * math.sin(2 * math.pi * 6 * t)
        p.rot('ear_l', Z, -20 * twitch)
        Q.eyes(p, 0.06)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Sleep', period, True, sample, {'kind': 'sleep'})


def box(rig: RigModel) -> Clip:
    """尾で体を支えて背をのばし、前足でぽこぽこパンチ。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.2
    call0, call1 = 0.8, 2.4

    def sample(t: float) -> Pose:
        p = Pose(rig)
        up = keys(t, [(0.1, 0), (0.6, 1), (2.6, 1), (3.1, 0)])
        punch = window(t, call0, call1, 0.1)
        p.move('hips', (0, 0.0, 0.04 * up))
        p.rot('hips', X, -16 * up)
        p.rot('spine_1', X, -6 * up)
        p.rot('neck', X, 14 * up)
        tail_pump(p, -14 * up)
        Q.ears(p, CFG, -10 * up)
        for side, ph in (('l', 0.0), ('r', 0.5)):
            jab = max(0.0, math.sin(2 * math.pi * (2.5 * t + ph))) * punch
            p.rot(f'arm_{side}', X, -30 * up - 55 * jab).rot(f'arm_2_{side}', X, -70 * up + 65 * jab)
        p.rot('spine_2', Z, 10 * punch * math.sin(2 * math.pi * 2.5 * t))
        Q.eyes(p, 1 - 0.3 * punch)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Box', period, False, sample, {'kind': 'special', 'sound': 'punch', 'callStart': call0,
                                               'callEnd': call1})


def jump(rig: RigModel) -> Clip:
    """しゃがんでから、その場で大きく跳び上がる。"""
    lg, ra = Q.standing(rig, CFG)
    period = 2.0
    t0, t1 = 0.6, 1.3

    def sample(t: float) -> Pose:
        p = Pose(rig)
        air = math.sin(math.pi * (t - t0) / (t1 - t0)) * 0.42 if t0 <= t <= t1 else 0.0
        squat = window(t, 0.15, t0 + 0.02, 0.2) + window(t, t1 - 0.02, t1 + 0.35, 0.12)
        joy = window(t, 0.4, 1.7, 0.2)
        p.move('hips', (0, 0, air - 0.07 * squat))
        p.rot('hips', X, 8 * squat)
        tail_pump(p, 22 * min(1.0, air / 0.2) - 6 * squat)
        arms(p, 30 + 30 * joy)
        Q.ears(p, CFG, 20 * min(1.0, air / 0.2))
        Q.eyes(p, 1 - 0.7 * joy)
        offsets = {k: Vector((0, 0, air)) for k in lg}
        rots = {k: Matrix.Rotation(math.radians(-35 * min(1.0, air / 0.12)), 3, 'X') for k in lg}
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets, rots)
        return p

    return Clip('Jump', period, False, sample, {'kind': 'special', 'sound': 'boing', 'callStart': t0,
                                                'callEnd': t1})


def happy_extra(p: Pose, t: float) -> None:
    arms(p, 30, spread=15 * window(t, 0.1, 1.4, 0.2))
    tail_pump(p, 10 * window(t, 0.1, 1.4, 0.2))


def clips(rig: RigModel) -> list[Clip]:
    return [Q.idle(rig, CFG, extra=idle_extra), walk(rig), walk(rig, 30, 'WalkLeft'), walk(rig, -30, 'WalkRight'),
            run(rig), turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True),
            box(rig), jump(rig), Q.happy(rig, CFG, extra=happy_extra), Q.blink_clip(rig)]
