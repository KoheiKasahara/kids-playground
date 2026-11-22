# hippo から作成した rhino の土台。形・色・骨・動きを個別仕様に合わせて書き換える。
# panda_motion から作成した hippo の土台を、カバの個別仕様に書き換えたもの。
"""サイのモーション。

- 歩き: 後ろ足→同じ側の前足の順に着く4拍子。重い体を太い脚で運び、低い頭を左右にゆらす。
- 走り: 頭を下げて走るギャロップ。
- 食べる: 頭を下げて、地面の草を口でむしる。
- ねる: 前足を前へ出して、おなかを地面につけて伏せる。
- ふんっ: 頭を下げて前足で地面をかき、鼻を鳴らす（とっしんの前のポーズ）。
- どろあび: 池のほとりで伏せて体をゆすり、どろを体につける。
"""

from __future__ import annotations

import math

from mathutils import Matrix, Vector  # type: ignore[import-not-found]

from .. import anim as A
from .. import bodyplan as Q
from ..anim import X, Y, Z, Clip, Pose, RigModel, keys, window

CFG = Q.Config(neck=['neck'], tail=['tail_1'], front_pole=Vector((0, 1, 0.2)), hind_pole=Vector((0, -1, 0.2)),
               toe=(0.13, 0.07, 0.13, 0.07), ear_axis=Vector((1, 0, 0)), ear_mirror=False, jaw='jaw')


def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    return Q.locomotion(rig, CFG, name, period=1.2, stride=0.62, duty=0.66, turn=turn_deg,
                        phases=Q.GAITS['lateral_walk'], lift=(0.1, 0.09), pitch=(25, 20),
                        crouch=0.08 + abs(turn_deg) / 30 * 0.02, bob=0.012, roll=3.0, sway=0.016, neck_pump=2.5,
                        neck_pitch=3, head_level=0.5, tail_amp=18, tail_lift=0)


def run(rig: RigModel) -> Clip:
    return Q.locomotion(rig, CFG, 'Run', period=0.6, stride=1.1, duty=0.4, turn=0, phases=Q.GAITS['gallop'],
                        lift=(0.15, 0.13), pitch=(40, 32), crouch=0.09, bob=0.025, roll=2, sway=0.01, neck_pump=5,
                        neck_pitch=8, head_level=0.5, tail_amp=20, tail_lift=20, ear_back=10, spine_flex=4,
                        bob_freq=1)


def turn(rig: RigModel, direction: int) -> Clip:
    return Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=1.3, stride=0.0, duty=0.7,
                        turn=60 * direction, phases=Q.GAITS['lateral_walk'], lift=(0.08, 0.07), pitch=(18, 15),
                        crouch=0.08, bob=0.008, roll=2.5, sway=0.012, neck_pump=2, neck_pitch=3, head_level=0.5,
                        tail_amp=14, tail_lift=0)


def idle_extra(p: Pose, t: float) -> None:
    # 筒のような耳を前後にくるっと回す
    twirl = window(t, 2.2, 2.9, 0.1) * math.sin(2 * math.pi * 5 * t)
    p.rot('ear_l', Z, 35 * twirl).rot('ear_r', Z, 35 * twirl)


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
        p.rot('jaw', X, 10 * chew)
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


def paw(rig: RigModel) -> Clip:
    """頭を下げて前足で地面をかき、鼻を鳴らす。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.2
    scrapes = (0.9, 1.5, 2.1)

    def sample(t: float) -> Pose:
        p = Pose(rig)
        k = keys(t, [(0.1, 0), (0.6, 1), (2.6, 1), (3.1, 0)])
        p.move('hips', (0, 0.02 * k, -0.02 * k))
        p.rot('spine_2', X, 5 * k)
        p.rot('neck', X, 14 * k)
        p.rot('head', X, 10 * k + 4 * window(t, 2.3, 2.7, 0.1) * math.sin(2 * math.pi * 6 * t))
        Q.ears(p, CFG, -15 * k)
        Q.tail_wave(p, CFG, t, 0.4, 25 * k, 20 * k)
        scrape = max(keys(t, [(c - 0.3, 0), (c - 0.1, 1), (c + 0.15, 0)]) for c in scrapes)
        back = sum(window(t, c - 0.1, c + 0.15, 0.08) for c in scrapes)
        offsets = {'front_r': Vector((0, 0.14 * back - 0.06 * scrape, 0.1 * scrape))}
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets)
        return p

    return Clip('Paw', period, False, sample, {'kind': 'special', 'sound': 'snort', 'callStart': 2.2,
                                               'callEnd': 2.8})


def wallow(rig: RigModel) -> Clip:
    """池のほとりで伏せて、体を左右にゆすってどろを体につける。"""
    lg, ra = Q.standing(rig, CFG)
    period = 4.6

    def sample(t: float) -> Pose:
        k = keys(t, [(0.1, 0), (1.2, 1), (3.6, 1), (4.5, 0)])
        p = Pose(rig)
        offsets, rots, poles = _lying(p, k, k, k)
        rub = window(t, 1.2, 3.6, 0.3)
        p.rot('hips', Y, 14 * rub * math.sin(2 * math.pi * 0.9 * t))
        p.rot('spine_2', Y, -10 * rub * math.sin(2 * math.pi * 0.9 * t))
        p.rot('head', Z, 12 * rub * math.sin(2 * math.pi * 0.9 * t + 1))
        Q.eyes(p, 1 - 0.85 * rub)
        Q.tail_wave(p, CFG, t, 0.5, 15 * rub, 0)
        posed = p.posed()
        A.plant_feet(p, posed, _legs_with(lg, poles, k, k), ra, offsets, rots)
        return p

    return Clip('Wallow', period, False, sample, {'kind': 'special', 'sound': 'splash', 'callStart': 1.4,
                                                  'callEnd': 3.4})


def _lying(p: Pose, k: float, hind_k: float, front_k: float) -> tuple[dict, dict, dict]:
    """伏せ。前足を前へ出してあごをのせ、後ろ足は体の下へ折りたたむ。"""
    p.move('hips', (0, 0.03 * k, -0.36 * k))
    p.rot('hips', X, 3 * (hind_k - front_k))
    p.rot('neck', X, 10 * k)
    p.rot('head', X, 4 * k)
    offsets = {
        'front_l': Vector((0.02 * front_k, -0.28 * front_k, -0.02 * front_k)),
        'front_r': Vector((-0.02 * front_k, -0.28 * front_k, -0.02 * front_k)),
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
    return [Q.idle(rig, CFG, extra=idle_extra), walk(rig), walk(rig, 24, 'WalkLeft'), walk(rig, -24, 'WalkRight'),
            run(rig), turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True),
            paw(rig), wallow(rig), Q.happy(rig, CFG, extra=happy_extra), Q.blink_clip(rig)]
