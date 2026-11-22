# panda から作成した red_panda の土台。形・色・骨・動きを個別仕様に合わせて書き換える。
# lion_motion から作成した panda の土台を、パンダの個別仕様に書き換えたもの。
"""レッサーパンダのモーション。

- 歩き: 後ろ足→同じ側の前足の順に着く4拍子。ふさふさのしっぽを水平にのばして、ゆらしながら歩く。
- 走り: 背中を丸めたギャロップ。
- 食べる: 地面の竹を右前足でつかみ、座って両前足で口へ運ぶ（hold_r で運ぶ）。
- たっち: 後ろ足で立ち上がり、前足を大きく広げる（いかくのポーズ。とてもかわいい）。
- かおあらい: 座って両前足で顔をこする。
"""

from __future__ import annotations

import math

from mathutils import Matrix, Vector  # type: ignore[import-not-found]

from .. import anim as A
from .. import bodyplan as Q
from ..anim import X, Y, Z, Clip, Pose, RigModel, keys, window

K = 0.75  # パンダに対する体の大きさ（座る・伏せるの移動量に掛ける）

CFG = Q.Config(neck=['neck'], tail=['tail_1', 'tail_2', 'tail_3'], front_pole=Vector((0, 1, 0.2)), hind_pole=Vector((0, -1, 0.2)),
               toe=(0.09, 0.03, 0.09, 0.03), ear_axis=Vector((1, 0, 0)), ear_mirror=False)

HOLD_POLE = Vector((0, 0.4, -1))  # 物を持つときは、ひじを下へ向ける


def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    return Q.locomotion(rig, CFG, name, period=0.8, stride=0.4, duty=0.64, turn=turn_deg,
                        phases=Q.GAITS['lateral_walk'], lift=(0.06, 0.055), pitch=(25, 22),
                        crouch=0.035 + abs(turn_deg) / 30 * 0.012, bob=0.008, roll=3.0, sway=0.01, neck_pump=3,
                        neck_pitch=2, head_level=0.6, tail_amp=10, tail_lift=-6)


def run(rig: RigModel) -> Clip:
    return Q.locomotion(rig, CFG, 'Run', period=0.42, stride=0.75, duty=0.36, turn=0, phases=Q.GAITS['gallop'],
                        lift=(0.09, 0.08), pitch=(40, 35), crouch=0.04, bob=0.015, roll=2, sway=0.008, neck_pump=5,
                        neck_pitch=3, head_level=0.6, tail_amp=6, tail_lift=-4, spine_flex=9, bob_freq=1)


def turn(rig: RigModel, direction: int) -> Clip:
    return Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=0.85, stride=0.0, duty=0.68,
                        turn=80 * direction, phases=Q.GAITS['lateral_walk'], lift=(0.05, 0.045), pitch=(18, 15),
                        crouch=0.03, bob=0.006, roll=2, sway=0.008, neck_pump=2, neck_pitch=2, head_level=0.6,
                        tail_amp=8, tail_lift=-6)


def idle_extra(p: Pose, t: float) -> None:
    # ときどき首をかしげ、しっぽを水平に保つ
    p.rot('head', Y, 16 * window(t, 1.6, 2.8, 0.3))
    p.rot('tail_1', X, -8)


def _hold_target(rig: RigModel, posed: dict, side: float, lift: float = 0.0) -> Vector:
    """口の少し下・前に両前足を寄せる位置（side=+1 左, -1 右）。"""
    head = posed['head']
    mouth = head @ Vector((0, rig.length['head'] * 0.85, -0.06 * K))
    return mouth + Vector((0.06 * K * side, -0.04 * K, -0.07 * K + lift))


def eat(rig: RigModel) -> Clip:
    """地面の竹を右前足でつかみ、座って口へ運んでもぐもぐ食べる。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.8
    grab, release = 0.7, 3.0

    def sample(t: float) -> Pose:
        p = Pose(rig)
        reach = keys(t, [(0, 0), (0.6, 1), (0.95, 0)])
        sit = keys(t, [(0.6, 0), (1.35, 1), (3.0, 1), (3.7, 0)])
        chew = window(t, 1.35, 2.95, 0.15) * math.sin(2 * math.pi * 3 * t)
        p.move('hips', (0, 0.05 * K * sit, -0.17 * K * sit))
        p.rot('hips', X, -45 * sit)
        p.rot('spine_2', X, -8 * sit)
        p.rot('neck', X, 18 * sit + 8 * reach)
        p.rot('head', X, 14 * sit + 10 * reach + 4 * chew)
        Q.ears(p, CFG, -6 * sit)
        Q.tail_wave(p, CFG, t, 1.2, 4, 0)
        Q.eyes(p, 1 - 0.55 * window(t, 1.5, 2.9, 0.15))
        posed = p.posed()
        for key in ('back_l', 'back_r'):
            leg = lg[key]
            A.leg_ik(p, posed, leg.upper, leg.lower, leg.foot, ra[key], leg.pole)
        for key, side in (('front_l', 1.0), ('front_r', -1.0)):
            leg = lg[key]
            rest = ra[key]
            target = rest.copy()
            if key == 'front_r':
                target = target + Vector((0, -0.12 * K, 0.04 * K)) * reach
            if sit > 0:
                mouth = _hold_target(rig, posed, side, 0.02 * chew)
                target = target.lerp(mouth, sit)
            pole = leg.pole.lerp(HOLD_POLE, sit)
            rot = Matrix.Rotation(math.radians(-70 * sit), 3, 'X')
            A.leg_ik(p, posed, leg.upper, leg.lower, leg.foot, target, pole, rot)
        return p

    p = sample(grab)
    paw = p.posed()['hold_r'].translation
    return Clip('Eat', period, False, sample, {'kind': 'eat', 'food': {'bone': 'hold_r', 'hold': True, 'grab': grab,
                                                                       'release': release, 'holdOffset': 0.03,
                                                                       'reach': round(-paw.y, 3)}})


def stand(rig: RigModel) -> Clip:
    """後ろ足で立ち上がり、前足を大きく広げる（いかくのポーズ）。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.2

    def sample(t: float) -> Pose:
        p = Pose(rig)
        up = keys(t, [(0.1, 0), (0.7, 1), (2.5, 1), (3.1, 0)])
        wobble = window(t, 0.8, 2.4, 0.2) * math.sin(2 * math.pi * 1.2 * t)
        p.move('hips', (0, 0.03 * up, -0.02 * up))
        p.rot('hips', X, -70 * up)
        p.rot('spine_2', X, 4 * up)
        p.rot('neck', X, 40 * up)
        p.rot('head', X, 22 * up)
        p.rot('spine_1', Y, 5 * wobble)
        p.rot('tail_1', X, 30 * up)
        Q.ears(p, CFG, -8 * up)
        Q.eyes(p, 1.0)
        posed = p.posed()
        for key in ('back_l', 'back_r'):
            leg = lg[key]
            A.leg_ik(p, posed, leg.upper, leg.lower, leg.foot, ra[key], leg.pole)
        for side, sx in (('l', 1), ('r', -1)):
            # 前足を横へ大きく広げて、ばんざい
            p.rot(f'front_leg_upper_{side}', Y, -70 * up * sx)
            p.rot(f'front_leg_upper_{side}', X, -20 * up)
            p.rot(f'front_leg_lower_{side}', X, 30 * up)
            p.rot(f'front_leg_foot_{side}', X, 50 * up)
        return p

    return Clip('Stand', period, False, sample, {'kind': 'special', 'sound': 'squeak', 'callStart': 0.8,
                                                 'callEnd': 2.2})


def groom(rig: RigModel) -> Clip:
    """座って両前足で顔をこする（かおあらい）。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.4

    def sample(t: float) -> Pose:
        p = Pose(rig)
        sit = keys(t, [(0.1, 0), (0.7, 1), (2.8, 1), (3.3, 0)])
        rub = window(t, 0.8, 2.7, 0.2)
        stroke = math.sin(2 * math.pi * 2.5 * t)
        p.move('hips', (0, 0.05 * K * sit, -0.17 * K * sit))
        p.rot('hips', X, -45 * sit)
        p.rot('neck', X, 18 * sit)
        p.rot('head', X, 18 * sit + 8 * rub * stroke)
        Q.eyes(p, 1 - 0.9 * rub)
        posed = p.posed()
        for key in ('back_l', 'back_r'):
            leg = lg[key]
            A.leg_ik(p, posed, leg.upper, leg.lower, leg.foot, ra[key], leg.pole)
        for key, side in (('front_l', 1.0), ('front_r', -1.0)):
            leg = lg[key]
            face = _hold_target(rig, posed, side, 0.0) + Vector((0, 0, 0.05 * K + 0.025 * K * stroke * side))
            target = ra[key].lerp(face, sit)
            A.leg_ik(p, posed, leg.upper, leg.lower, leg.foot, target, leg.pole.lerp(HOLD_POLE, sit),
                     Matrix.Rotation(math.radians(-80 * sit), 3, 'X'))
        return p

    return Clip('Groom', period, False, sample, {'kind': 'special'})


def _lying(p: Pose, k: float, hind_k: float, front_k: float) -> tuple[dict, dict, dict]:
    """伏せ。前足を前へ出してあごをのせ、後ろ足は体の下へ折りたたむ。"""
    p.move('hips', (0, 0.02 * k, -0.24 * K * k))
    p.rot('hips', X, 4 * (hind_k - front_k))
    p.rot('neck', X, 12 * k)
    p.rot('head', X, 4 * k)
    offsets = {
        'front_l': Vector((0.01 * front_k, -0.16 * K * front_k, -0.01 * front_k)),
        'front_r': Vector((-0.01 * front_k, -0.16 * K * front_k, -0.01 * front_k)),
        'back_l': Vector((0.05 * K * hind_k, -0.08 * K * hind_k, 0.0)),
        'back_r': Vector((-0.05 * K * hind_k, -0.08 * K * hind_k, 0.0)),
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
    return [Q.idle(rig, CFG, extra=idle_extra), walk(rig), walk(rig, 28, 'WalkLeft'), walk(rig, -28, 'WalkRight'),
            run(rig), turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True),
            stand(rig), groom(rig), Q.happy(rig, CFG), Q.blink_clip(rig)]
