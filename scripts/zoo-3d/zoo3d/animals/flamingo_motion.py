"""フラミンゴのモーション（二足・鳥）。

- 歩き: 脚を高く上げて、ゆっくり大またで歩く（`biped_walk`）。一歩ごとに首を前後させる（鳥の首ふり）。
- 走り: 翼を少し広げて、速く小走り。
- 食べる: 首を下げて頭を地面へ。くちばしを左右にふって水の中のエビをすくう。
- ねる: 片足で立ち、もう片方の足をたたんで、首を背中へのせる（フラミンゴらしい寝方）。
- はねをひろげる: 翼を大きく広げて先の黒い羽を見せ、首をのばして鳴く。
- マーチ: その場で足ぶみしながら、首を左右にふる（群れの行進ダンス）。
"""

from __future__ import annotations

import math

from mathutils import Matrix, Vector  # type: ignore[import-not-found]

from .. import anim as A
from .. import bodyplan as Q
from ..anim import X, Y, Z, Clip, Pose, RigModel, keys, window

NECK = ['neck_1', 'neck_2', 'neck_3']
CFG = Q.Config(neck=NECK, tail=['tail_1'], front_pole=Vector((0, 1, 0.1)), hind_pole=Vector((0, 1, 0.1)),
               toe=(0.11, 0.015, 0.11, 0.015), ears=('wing_l', 'wing_r'), ear_axis=Vector((0, 0, -1)),
               plan='biped')


def spread(p: Pose, k: float, flap: float = 0.0) -> None:
    """翼を横へ広げて持ち上げる（k=1 で全開）。"""
    p.rot('wing_l', Z, -80 * k).rot('wing_l', Y, -(40 + flap) * k)
    p.rot('wing_r', Z, 80 * k).rot('wing_r', Y, (40 + flap) * k)


def _with_extra(clip: Clip, extra) -> Clip:
    base = clip.sample

    def sample(t: float) -> Pose:
        p = base(t)
        extra(p, t)
        return p

    out = Clip(clip.name, clip.duration, clip.loop, sample, clip.meta)
    out.gait = clip.gait
    return out


def head_bob(p: Pose, t: float, period: float, amount: float) -> None:
    """一歩ごとに首を前へ突き出して戻す。"""
    c = (t / period) % 0.5 * 2
    push = math.sin(math.pi * c) ** 2
    p.rot('neck_1', X, 6 * amount * push)
    p.rot('neck_3', X, -10 * amount * push)
    p.rot('head', X, 4 * amount * push)


def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    period = 1.1
    clip = Q.locomotion(rig, CFG, name, period=period, stride=0.6, duty=0.6, turn=turn_deg,
                        phases=Q.GAITS['biped_walk'], lift=(0.14, 0.14), pitch=(30, 30),
                        crouch=0.04 + abs(turn_deg) / 30 * 0.01, bob=0.01, roll=2.5, sway=0.015, neck_pump=0,
                        neck_pitch=0, head_level=0.0, tail_amp=6, tail_lift=0)
    return _with_extra(clip, lambda p, t: head_bob(p, t, period, 1.0))


def run(rig: RigModel) -> Clip:
    period = 0.6
    clip = Q.locomotion(rig, CFG, 'Run', period=period, stride=1.0, duty=0.42, turn=0, phases=Q.GAITS['biped_walk'],
                        lift=(0.16, 0.16), pitch=(35, 35), crouch=0.06, bob=0.015, roll=2, sway=0.01, neck_pump=0,
                        neck_pitch=0, head_level=0.0, tail_amp=4, tail_lift=0)

    def extra(p: Pose, t: float) -> None:
        p.rot('spine_1', X, 10)
        p.rot('neck_1', X, 14)
        p.rot('neck_3', X, -18)
        spread(p, 0.35, 15 * math.sin(2 * math.pi * 2 * t / period))

    return _with_extra(clip, extra)


def turn(rig: RigModel, direction: int) -> Clip:
    period = 1.0
    clip = Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=period, stride=0.0, duty=0.65,
                        turn=80 * direction, phases=Q.GAITS['biped_walk'], lift=(0.1, 0.1), pitch=(20, 20),
                        crouch=0.03, bob=0.008, roll=2, sway=0.01, neck_pump=0, neck_pitch=0, head_level=0.0,
                        tail_amp=4, tail_lift=0)
    return _with_extra(clip, lambda p, t: head_bob(p, t, period, 0.6))


def idle_extra(p: Pose, t: float) -> None:
    # 首をかしげ、くちばしで羽づくろい
    p.rot('head', Y, 14 * window(t, 0.6, 1.4, 0.2))
    preen = window(t, 2.2, 3.4, 0.25)
    p.rot('neck_1', X, -10 * preen).rot('neck_2', X, 40 * preen).rot('neck_3', X, 30 * preen)
    p.rot('neck_2', Z, 35 * preen).rot('head', X, 20 * preen)


def eat(rig: RigModel) -> Clip:
    """首を下げて頭を地面へ。くちばしを左右にふって、水の中のエビをすくう。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.8

    def sample(t: float) -> Pose:
        p = Pose(rig)
        down = keys(t, [(0, 0), (0.8, 1), (3.0, 1), (3.7, 0)])
        sweep = window(t, 0.9, 2.9, 0.2) * math.sin(2 * math.pi * 1.5 * t)
        p.move('hips', (0, 0.02 * down, -0.04 * down))
        p.rot('hips', X, 22 * down)
        p.rot('neck_1', X, 50 * down).rot('neck_2', X, 25 * down).rot('neck_3', X, 40 * down)
        p.rot('head', X, 55 * down)
        p.rot('neck_3', Z, 25 * sweep)
        spread(p, 0.08 * down)
        Q.eyes(p, 1 - 0.4 * window(t, 1.2, 2.8, 0.15))
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    p = sample(1.5)
    tip = p.posed()['head'] @ Vector((0, rig.length['head'], 0))
    return Clip('Eat', period, False, sample, {'kind': 'eat', 'food': {'bone': 'head', 'grab': 1.0, 'release': 2.8,
                                                                       'reach': round(-tip.y, 3)}})


def _one_leg(p: Pose, rig: RigModel, lg: dict, ra: dict, k: float, tuck: float) -> None:
    """右足だけで立ち、左足をたたむ。tuck で首を背中へのせる。"""
    p.move('hips', (-0.045 * k, 0, -0.02 * k))
    p.rot('hips', Y, 4 * k)
    p.rot('neck_1', X, -55 * tuck).rot('neck_2', X, 70 * tuck).rot('neck_3', X, 70 * tuck)
    p.rot('neck_2', Z, 40 * tuck)
    p.rot('head', X, 30 * tuck).rot('head', Z, 40 * tuck)
    posed = p.posed()
    leg = lg['right']
    A.leg_ik(p, posed, leg.upper, leg.lower, leg.foot, ra['right'], leg.pole)
    left = lg['left']
    target = ra['left'] + Vector((0, 0.02 * k, 0.38 * k))
    A.leg_ik(p, posed, left.upper, left.lower, left.foot, target, left.pole,
             Matrix.Rotation(math.radians(-70 * k), 3, 'X'))


def lie_down(rig: RigModel, reverse: bool = False) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 1.6

    def sample(t: float) -> Pose:
        if reverse:
            t = period - t
        k = keys(t, [(0.05, 0), (0.8, 1)])
        tuck = keys(t, [(0.6, 0), (1.5, 1)])
        p = Pose(rig)
        _one_leg(p, rig, lg, ra, k, tuck)
        Q.eyes(p, 1 - 0.5 * tuck)
        return p

    return Clip('GetUp' if reverse else 'LieDown', period, False, sample, {'kind': 'sleep'})


def sleep(rig: RigModel) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 4.0

    def sample(t: float) -> Pose:
        c = t / period
        p = Pose(rig)
        breath = math.sin(2 * math.pi * c)
        p.rot('spine_1', X, -1.5 * breath)
        _one_leg(p, rig, lg, ra, 1, 1)
        Q.eyes(p, 0.06)
        return p

    return Clip('Sleep', period, True, sample, {'kind': 'sleep'})


def display(rig: RigModel) -> Clip:
    """翼を大きく広げて先の黒い羽を見せ、首をのばして鳴く。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.0
    call0, call1 = 0.8, 2.2

    def sample(t: float) -> Pose:
        p = Pose(rig)
        k = keys(t, [(0.1, 0), (0.6, 1), (2.4, 1), (2.9, 0)])
        call = window(t, call0, call1, 0.15)
        p.rot('neck_1', X, -12 * k).rot('neck_2', X, -14 * k).rot('neck_3', X, 10 * k)
        p.rot('head', X, -20 * call)
        p.rot('head', Z, 12 * call * math.sin(2 * math.pi * 2 * t))
        spread(p, k, 12 * math.sin(2 * math.pi * 2.5 * t) * call)
        Q.eyes(p, 1 - 0.5 * call)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Display', period, False, sample, {'kind': 'special', 'sound': 'honk', 'callStart': call0,
                                                   'callEnd': call1})


def march(rig: RigModel) -> Clip:
    """その場で足ぶみしながら、首を左右にふる（群れの行進ダンス）。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.2
    beat = 0.4

    def sample(t: float) -> Pose:
        p = Pose(rig)
        k = window(t, 0.2, period - 0.2, 0.25)
        n = int(t / beat)
        s = (t % beat) / beat
        lift = math.sin(math.pi * s) * 0.12 * k
        side = 'left' if n % 2 == 0 else 'right'
        p.move('hips', ((0.02 if side == 'right' else -0.02) * k, 0, 0))
        p.rot('neck_3', Z, 30 * k * math.sin(2 * math.pi * t / (2 * beat)))
        p.rot('head', Z, 25 * k * math.sin(2 * math.pi * t / (2 * beat) + 0.5))
        p.rot('neck_1', X, -8 * k)
        spread(p, 0.15 * k)
        Q.eyes(p, 1 - 0.5 * k)
        offsets = {side: Vector((0, 0, lift))}
        rots = {side: Matrix.Rotation(math.radians(-30 * lift / 0.12), 3, 'X')}
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets, rots)
        return p

    return Clip('March', period, False, sample, {'kind': 'special'})


def happy_extra(p: Pose, t: float) -> None:
    spread(p, 0.4 * window(t, 0.1, 1.4, 0.2), 15 * math.sin(2 * math.pi * 3 * t))


def clips(rig: RigModel) -> list[Clip]:
    return [Q.idle(rig, CFG, extra=idle_extra), walk(rig), walk(rig, 26, 'WalkLeft'), walk(rig, -26, 'WalkRight'),
            run(rig), turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True),
            display(rig), march(rig), Q.happy(rig, CFG, extra=happy_extra), Q.blink_clip(rig)]
