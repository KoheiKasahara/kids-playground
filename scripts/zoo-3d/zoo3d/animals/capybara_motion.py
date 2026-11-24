# hippo から作成した capybara の土台。形・色・骨・動きを個別仕様に合わせて書き換える。
# panda_motion から作成した hippo の土台を、カバの個別仕様に書き換えたもの。
"""カピバラのモーション。

- 歩き: 後ろ足→同じ側の前足の順に着く4拍子。短い脚でのんびり歩く。
- 走り: 体をはずませる小さなギャロップ。
- 食べる: 頭を下げて、口をもぐもぐ動かしてかじる。
- ねる: 前足を前へ出して、おなかを地面につけて伏せる。
- おふろ: 池のほとりで伏せて、目を閉じてうっとり（鼻を上げて、ゆっくり呼吸）。
- ぶるぶる: 体をふるわせて水をはらう。
"""

from __future__ import annotations

import math

from mathutils import Matrix, Vector  # type: ignore[import-not-found]

from .. import anim as A
from .. import bodyplan as Q
from ..anim import X, Y, Z, Clip, Pose, RigModel, keys, window

CFG = Q.Config(neck=['neck'], tail=['tail_1'], front_pole=Vector((0, 1, 0.2)), hind_pole=Vector((0, -1, 0.2)),
               toe=(0.1, 0.05, 0.1, 0.05), ear_axis=Vector((1, 0, 0)), ear_mirror=False, jaw='jaw')


def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    return Q.locomotion(rig, CFG, name, period=0.95, stride=0.42, duty=0.66, turn=turn_deg,
                        phases=Q.GAITS['lateral_walk'], lift=(0.06, 0.055), pitch=(25, 20),
                        crouch=0.04 + abs(turn_deg) / 30 * 0.012, bob=0.008, roll=2.5, sway=0.012, neck_pump=2,
                        neck_pitch=2, head_level=0.6, tail_amp=0, tail_lift=0)


def run(rig: RigModel) -> Clip:
    return Q.locomotion(rig, CFG, 'Run', period=0.5, stride=0.75, duty=0.4, turn=0, phases=Q.GAITS['gallop'],
                        lift=(0.09, 0.08), pitch=(35, 30), crouch=0.05, bob=0.018, roll=1.5, sway=0.008, neck_pump=4,
                        neck_pitch=2, head_level=0.6, tail_amp=0, tail_lift=0, spine_flex=6, bob_freq=1)


def turn(rig: RigModel, direction: int) -> Clip:
    return Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=1.1, stride=0.0, duty=0.7,
                        turn=70 * direction, phases=Q.GAITS['lateral_walk'], lift=(0.05, 0.045), pitch=(18, 15),
                        crouch=0.035, bob=0.006, roll=2, sway=0.01, neck_pump=2, neck_pitch=2, head_level=0.6,
                        tail_amp=0, tail_lift=0)


def idle_extra(p: Pose, t: float) -> None:
    # 目を細めてのんびり。ときどき口をもぐもぐ、耳をぴくっ
    Q.eyes(p, 0.75 - 0.69 * window(t, 1.4, 1.6, 0.08))
    twitch = window(t, 2.6, 2.9, 0.08) * math.sin(2 * math.pi * 8 * t)
    p.rot('ear_l', X, 25 * twitch)
    p.rot('jaw', X, 5 * window(t, 0.4, 1.2, 0.2) * (0.5 + 0.5 * math.sin(2 * math.pi * 3 * t)))


def eat(rig: RigModel) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 3.6

    def sample(t: float) -> Pose:
        p = Pose(rig)
        down = keys(t, [(0, 0), (0.7, 1), (2.8, 1), (3.4, 0)])
        chew = window(t, 0.8, 2.7, 0.1) * (0.5 + 0.5 * math.sin(2 * math.pi * 2.5 * t))
        p.move('hips', (0, 0, -0.02 * down))
        p.rot('spine_2', X, 6 * down)
        p.rot('neck', X, 26 * down)
        p.rot('head', X, 16 * down - 3 * chew)
        p.rot('jaw', X, 16 * chew)
        Q.ears(p, CFG, -6 * down)
        Q.tail_wave(p, CFG, t, 0.8, 18, 0)
        Q.eyes(p, 1 - 0.5 * window(t, 1.2, 2.6, 0.15))
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    p = sample(1.0)
    tip = p.posed()['jaw'] @ Vector((0, rig.length['jaw'], 0))
    return Clip('Eat', period, False, sample, {'kind': 'eat', 'food': {'bone': 'head', 'grab': 0.9, 'release': 2.6,
                                                                       'reach': round(-tip.y, 3)}})


def relax(rig: RigModel) -> Clip:
    """池のほとりで伏せて、目を閉じてうっとり（お風呂に入っているように）。"""
    lg, ra = Q.standing(rig, CFG)
    period = 5.0

    def sample(t: float) -> Pose:
        k = keys(t, [(0.1, 0), (1.2, 1), (4.0, 1), (4.9, 0)])
        p = Pose(rig)
        offsets, rots, poles = _lying(p, k, k, k)
        bliss = window(t, 1.2, 4.0, 0.3)
        breath = math.sin(2 * math.pi * 0.4 * t)
        p.move('hips', (0, 0, 0.008 * bliss * breath))
        p.rot('neck', X, -14 * bliss)
        p.rot('head', X, -10 * bliss + 2 * breath * bliss)
        Q.eyes(p, 1 - 0.94 * bliss)
        Q.ears(p, CFG, 10 * bliss * math.sin(2 * math.pi * 0.6 * t))
        posed = p.posed()
        A.plant_feet(p, posed, _legs_with(lg, poles, k, k), ra, offsets, rots)
        return p

    return Clip('Relax', period, False, sample, {'kind': 'special', 'sound': 'purr', 'callStart': 1.4,
                                                 'callEnd': 3.6})


def shake(rig: RigModel) -> Clip:
    """体をぶるぶるふるわせて、水をはらう。"""
    lg, ra = Q.standing(rig, CFG)
    period = 2.2

    def sample(t: float) -> Pose:
        p = Pose(rig)
        k = window(t, 0.4, 1.7, 0.15)
        w = math.sin(2 * math.pi * 7 * t)
        p.rot('hips', Y, 9 * k * w)
        p.rot('spine_1', Y, -12 * k * w)
        p.rot('spine_2', Y, 14 * k * w)
        p.rot('neck', Y, -16 * k * w)
        p.rot('head', Y, 18 * k * w)
        Q.ears(p, CFG, 25 * k * w)
        Q.eyes(p, 1 - 0.9 * k)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Shake', period, False, sample, {'kind': 'special'})


def _lying(p: Pose, k: float, hind_k: float, front_k: float) -> tuple[dict, dict, dict]:
    """伏せ。前足を前へ出してあごをのせ、後ろ足は体の下へ折りたたむ。"""
    p.move('hips', (0, 0.02 * k, -0.2 * k))
    p.rot('hips', X, 3 * (hind_k - front_k))
    p.rot('neck', X, 10 * k)
    p.rot('head', X, 4 * k)
    offsets = {
        'front_l': Vector((0.02 * front_k, -0.14 * front_k, -0.01 * front_k)),
        'front_r': Vector((-0.02 * front_k, -0.14 * front_k, -0.01 * front_k)),
        'back_l': Vector((0.08 * hind_k, -0.08 * hind_k, 0.0)),
        'back_r': Vector((-0.08 * hind_k, -0.08 * hind_k, 0.0)),
    }
    rots = {key: Matrix.Rotation(math.radians(-10 * front_k), 3, 'X') for key in ('front_l', 'front_r')}
    rots.update({key: Matrix.Rotation(math.radians(-45 * hind_k), 3, 'X') for key in ('back_l', 'back_r')})
    poles = {'front_l': Vector((0, 0.3, -1)), 'front_r': Vector((0, 0.3, -1)),
             'back_l': Vector((0, -1, 0.6)), 'back_r': Vector((0, -1, 0.6))}
    return offsets, rots, poles


def _legs_with(lg: dict, poles: dict, front_k: float, hind_k: float) -> dict:
    out = {}
    for key, leg in lg.items():
        w = front_k if key.startswith('front') else hind_k
        out[key] = A.LegSpec(leg.upper, leg.lower, leg.foot, leg.phase, leg.lift, leg.pole.lerp(poles[key], w))
    return out


def lie_down(rig: RigModel, reverse: bool = False) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 1.8

    def sample(t: float) -> Pose:
        if reverse:
            t = period - t
        hind_k = keys(t, [(0.0, 0), (1.0, 1)])
        front_k = keys(t, [(0.5, 0), (1.7, 1)])
        p = Pose(rig)
        offsets, rots, poles = _lying(p, 0.5 * (hind_k + front_k), hind_k, front_k)
        Q.eyes(p, 1 - 0.4 * front_k)
        posed = p.posed()
        A.plant_feet(p, posed, _legs_with(lg, poles, front_k, hind_k), ra, offsets, rots)
        return p

    return Clip('GetUp' if reverse else 'LieDown', period, False, sample, {'kind': 'sleep'})


def sleep(rig: RigModel) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 4.0

    def sample(t: float) -> Pose:
        c = t / period
        p = Pose(rig)
        offsets, rots, poles = _lying(p, 1, 1, 1)
        breath = math.sin(2 * math.pi * c)
        p.move('hips', (0, 0, 0.01 * breath))
        p.rot('spine_1', X, -1.5 * breath)
        p.rot('head', Z, 12)
        p.rot('head', X, 3 + 1.5 * breath)
        p.rot('jaw', X, 3 + 2 * breath)
        twitch = window(t, 2.6, 2.9, 0.08) * math.sin(2 * math.pi * 6 * t)
        Q.ears(p, CFG, 15 * twitch)
        Q.eyes(p, 0.06)
        posed = p.posed()
        A.plant_feet(p, posed, _legs_with(lg, poles, 1, 1), ra, offsets, rots)
        return p

    return Clip('Sleep', period, True, sample, {'kind': 'sleep'})


def happy_extra(p: Pose, t: float) -> None:
    p.rot('jaw', X, 14 * window(t, 0.2, 1.3, 0.2))


def clips(rig: RigModel) -> list[Clip]:
    return [Q.idle(rig, CFG, extra=idle_extra), walk(rig), walk(rig, 26, 'WalkLeft'), walk(rig, -26, 'WalkRight'),
            run(rig), turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True),
            relax(rig), shake(rig), Q.happy(rig, CFG, extra=happy_extra), Q.blink_clip(rig)]
