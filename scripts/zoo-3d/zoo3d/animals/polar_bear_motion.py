# panda から作成した polar_bear の土台。形・色・骨・動きを個別仕様に合わせて書き換える。
# lion_motion から作成した panda の土台を、パンダの個別仕様に書き換えたもの。
"""シロクマのモーション。

- 歩き: 後ろ足→同じ側の前足の順に着く4拍子。大きな前足でゆったり歩き、首を低く前へ出して左右にふる。
- 走り: 後ろ足でけって前足で着く、背中をしならせたギャロップ。
- 食べる: 頭を下げて、地面の魚をかじる。
- たちあがる: 後ろ足で立ち上がり、前足を持ち上げて鼻をひくひく（遠くのにおいをかぐ）。
- みずあび: 池のほとりで、右の前足で水をばしゃっとたたく（hold_r から水しぶき）。
"""

from __future__ import annotations

import math

from mathutils import Matrix, Vector  # type: ignore[import-not-found]

from .. import anim as A
from .. import bodyplan as Q
from ..anim import X, Y, Z, Clip, Pose, RigModel, keys, window

CFG = Q.Config(neck=['neck'], tail=['tail_1'], front_pole=Vector((0, 1, 0.2)), hind_pole=Vector((0, -1, 0.2)),
               toe=(0.14, 0.07, 0.13, 0.07), ear_axis=Vector((1, 0, 0)), ear_mirror=False)



def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    return Q.locomotion(rig, CFG, name, period=1.25, stride=0.66, duty=0.64, turn=turn_deg,
                        phases=Q.GAITS['lateral_walk'], lift=(0.1, 0.09), pitch=(30, 24),
                        crouch=0.06 + abs(turn_deg) / 30 * 0.015, bob=0.01, roll=4.0, sway=0.02, neck_pump=3,
                        neck_pitch=10, head_level=0.4, tail_amp=6, tail_lift=0)


def run(rig: RigModel) -> Clip:
    return Q.locomotion(rig, CFG, 'Run', period=0.6, stride=1.15, duty=0.38, turn=0, phases=Q.GAITS['gallop'],
                        lift=(0.15, 0.13), pitch=(45, 35), crouch=0.07, bob=0.02, roll=2.5, sway=0.01, neck_pump=6,
                        neck_pitch=6, head_level=0.6, tail_amp=4, tail_lift=10, ear_back=10, spine_flex=8,
                        bob_freq=1)


def turn(rig: RigModel, direction: int) -> Clip:
    return Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=1.3, stride=0.0, duty=0.68,
                        turn=70 * direction, phases=Q.GAITS['lateral_walk'], lift=(0.08, 0.07), pitch=(22, 18),
                        crouch=0.05, bob=0.006, roll=3, sway=0.012, neck_pump=2, neck_pitch=6, head_level=0.5,
                        tail_amp=4, tail_lift=0)


def idle_extra(p: Pose, t: float) -> None:
    # 首を低く左右にふって、においをかぐ
    sway = window(t, 0.4, 3.4, 0.4)
    p.rot('neck', Z, 14 * sway * math.sin(2 * math.pi * 0.5 * t))
    p.rot('head', X, 2 * window(t, 2.0, 2.8, 0.1) * math.sin(2 * math.pi * 6 * t))


def eat(rig: RigModel) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 3.6

    def sample(t: float) -> Pose:
        p = Pose(rig)
        down = keys(t, [(0, 0), (0.7, 1), (2.8, 1), (3.4, 0)])
        chew = window(t, 0.9, 2.7, 0.1) * math.sin(2 * math.pi * 3 * t)
        p.move('hips', (0, 0, -0.03 * down))
        p.rot('spine_2', X, 8 * down)
        p.rot('neck', X, 32 * down)
        p.rot('head', X, 16 * down + 5 * chew)
        Q.ears(p, CFG, -6 * down)
        Q.eyes(p, 1 - 0.5 * window(t, 1.2, 2.6, 0.15))
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    p = sample(1.0)
    tip = p.posed()['head'] @ Vector((0, rig.length['head'], 0))
    return Clip('Eat', period, False, sample, {'kind': 'eat', 'food': {'bone': 'head', 'grab': 0.9, 'release': 2.6,
                                                                       'reach': round(-tip.y, 3)}})


def stand(rig: RigModel) -> Clip:
    """後ろ足で立ち上がり、前足を持ち上げて鼻をひくひく。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.6

    def sample(t: float) -> Pose:
        p = Pose(rig)
        up = keys(t, [(0.2, 0), (1.0, 1), (2.7, 1), (3.4, 0)])
        sniff = window(t, 1.1, 2.6, 0.15) * math.sin(2 * math.pi * 6 * t)
        p.move('hips', (0, 0.06 * up, -0.06 * up))
        p.rot('hips', X, -62 * up)
        p.rot('spine_1', X, -8 * up)
        p.rot('spine_2', X, 10 * up)
        p.rot('neck', X, 34 * up)
        p.rot('head', X, 18 * up + 2 * sniff)
        p.rot('head', Z, 12 * window(t, 1.2, 2.6, 0.3) * math.sin(2 * math.pi * 0.7 * t))
        Q.ears(p, CFG, -10 * up)
        posed = p.posed()
        for key in ('back_l', 'back_r'):
            leg = lg[key]
            A.leg_ik(p, posed, leg.upper, leg.lower, leg.foot, ra[key], leg.pole)
        for side, ph in (('l', 0.0), ('r', 1.2)):
            p.rot(f'front_leg_upper_{side}', X, -20 * up)
            p.rot(f'front_leg_lower_{side}', X, 45 * up + 8 * up * math.sin(2 * math.pi * 0.8 * t + ph))
            p.rot(f'front_leg_foot_{side}', X, 40 * up)
        return p

    return Clip('Stand', period, False, sample, {'kind': 'special', 'sound': 'growl', 'callStart': 1.1,
                                                 'callEnd': 2.2})


def splash(rig: RigModel) -> Clip:
    """池のほとりで、右の前足を持ち上げて水をばしゃっとたたく（2回）。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.6
    hits = (1.3, 2.4)

    def sample(t: float) -> Pose:
        p = Pose(rig)
        k = keys(t, [(0.1, 0), (0.6, 1), (3.0, 1), (3.5, 0)])
        # 前足を持ち上げてから、水面へたたきつける
        raise_ = max(keys(t, [(h - 0.65, 0), (h - 0.18, 1), (h, 0)]) for h in hits)
        p.move('hips', (0.03 * k, 0.03 * k, -0.02 * k))
        p.rot('spine_2', Z, -6 * k)
        p.rot('neck', X, 18 * k)
        p.rot('head', X, 8 * k)
        Q.eyes(p, 1 - 0.6 * window(t, 1.2, 2.9, 0.2))
        offsets = {'front_r': Vector((0, -0.12 * raise_, 0.28 * raise_))}
        rots = {'front_r': Matrix.Rotation(math.radians(-50 * raise_), 3, 'X')}
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets, rots)
        return p

    return Clip('Splash', period, False, sample, {'kind': 'special', 'effect': 'water', 'bone': 'hold_r',
                                                  'sprayStart': hits[0], 'sprayEnd': hits[1] + 0.4})


def _lying(p: Pose, k: float, hind_k: float, front_k: float) -> tuple[dict, dict, dict]:
    """伏せ。前足を前へ出してあごをのせ、後ろ足は体の下へ折りたたむ。"""
    p.move('hips', (0, 0.03 * k, -0.33 * k))
    p.rot('hips', X, 4 * (hind_k - front_k))
    p.rot('neck', X, 12 * k)
    p.rot('head', X, 4 * k)
    offsets = {
        'front_l': Vector((0.01 * front_k, -0.22 * front_k, -0.02 * front_k)),
        'front_r': Vector((-0.01 * front_k, -0.22 * front_k, -0.02 * front_k)),
        'back_l': Vector((0.07 * hind_k, -0.1 * hind_k, 0.0)),
        'back_r': Vector((-0.07 * hind_k, -0.1 * hind_k, 0.0)),
    }
    rots = {key: Matrix.Rotation(math.radians(-10 * front_k), 3, 'X') for key in ('front_l', 'front_r')}
    rots.update({key: Matrix.Rotation(math.radians(-50 * hind_k), 3, 'X') for key in ('back_l', 'back_r')})
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
        p.move('hips', (0, 0, 0.008 * breath))
        p.rot('spine_1', X, -1.5 * breath)
        p.rot('neck', X, 8)
        p.rot('head', Z, 20)
        p.rot('head', X, 4 + 1.5 * breath)
        twitch = window(t, 2.6, 2.9, 0.08) * math.sin(2 * math.pi * 6 * t)
        Q.ears(p, CFG, 12 * twitch)
        Q.eyes(p, 0.06)
        posed = p.posed()
        A.plant_feet(p, posed, _legs_with(lg, poles, 1, 1), ra, offsets, rots)
        return p

    return Clip('Sleep', period, True, sample, {'kind': 'sleep'})


def clips(rig: RigModel) -> list[Clip]:
    return [Q.idle(rig, CFG, extra=idle_extra), walk(rig), walk(rig, 26, 'WalkLeft'), walk(rig, -26, 'WalkRight'),
            run(rig), turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True),
            stand(rig), splash(rig), Q.happy(rig, CFG), Q.blink_clip(rig)]
