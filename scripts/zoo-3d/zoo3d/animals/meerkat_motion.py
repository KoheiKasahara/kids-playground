# red_panda_motion から作成した meerkat の土台を、ミーアキャットの個別仕様に書き換えたもの。
"""ミーアキャットのモーション。

- 歩き: 後ろ足→同じ側の前足の順に着く4拍子。細い脚で ちょこちょこ、しっぽを少し立てて歩く。
- 走り: 背中を丸めた すばやいギャロップ。
- 食べる: 地面の虫を右前足でつかみ、座って両前足で口へ運ぶ（hold_r で運ぶ）。
- みはりばん: 後ろ足としっぽで まっすぐ立ち、前足を胸の前にたらして、頭を左右へ向けて見回す。
- ほりほり: 頭を下げ、前足で地面を交互に かいて あなを ほる。
"""

from __future__ import annotations

import math

from mathutils import Matrix, Vector  # type: ignore[import-not-found]

from .. import anim as A
from .. import bodyplan as Q
from ..anim import X, Y, Z, Clip, Pose, RigModel, keys, window

K = 0.6  # パンダに対する体の大きさ（座る・伏せるの移動量に掛ける）

CFG = Q.Config(neck=['neck'], tail=['tail_1', 'tail_2', 'tail_3'], front_pole=Vector((0, 1, 0.2)), hind_pole=Vector((0, -1, 0.2)),
               toe=(0.07, 0.025, 0.07, 0.025), ear_axis=Vector((1, 0, 0)), ear_mirror=False)

HOLD_POLE = Vector((0, 0.4, -1))  # 物を持つときは、ひじを下へ向ける


def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    return Q.locomotion(rig, CFG, name, period=0.55, stride=0.3, duty=0.64, turn=turn_deg,
                        phases=Q.GAITS['lateral_walk'], lift=(0.045, 0.04), pitch=(25, 22),
                        crouch=0.028 + abs(turn_deg) / 30 * 0.01, bob=0.006, roll=2.0, sway=0.006, neck_pump=3,
                        neck_pitch=-4, head_level=0.8, tail_amp=8, tail_lift=-14)


def run(rig: RigModel) -> Clip:
    return Q.locomotion(rig, CFG, 'Run', period=0.32, stride=0.56, duty=0.36, turn=0, phases=Q.GAITS['gallop'],
                        lift=(0.07, 0.06), pitch=(40, 35), crouch=0.032, bob=0.012, roll=2, sway=0.006, neck_pump=5,
                        neck_pitch=3, head_level=0.7, tail_amp=6, tail_lift=-10, spine_flex=10, bob_freq=1)


def turn(rig: RigModel, direction: int) -> Clip:
    return Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=0.6, stride=0.0, duty=0.68,
                        turn=80 * direction, phases=Q.GAITS['lateral_walk'], lift=(0.04, 0.035), pitch=(18, 15),
                        crouch=0.024, bob=0.005, roll=2, sway=0.006, neck_pump=2, neck_pitch=2, head_level=0.7,
                        tail_amp=6, tail_lift=-12)


def idle_extra(p: Pose, t: float) -> None:
    # きょろきょろ まわりを見る
    p.rot('head', Z, 25 * window(t, 0.8, 1.6, 0.2) - 25 * window(t, 2.2, 3.0, 0.2))
    p.rot('tail_1', X, -14)


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


def sentry(rig: RigModel) -> Clip:
    """後ろ足としっぽで まっすぐ立ち、前足を胸の前にたらして、頭を左右へ向けて見回す（みはりばん）。"""
    lg, ra = Q.standing(rig, CFG)
    period = 4.0

    def sample(t: float) -> Pose:
        p = Pose(rig)
        up = keys(t, [(0.1, 0), (0.6, 1), (3.4, 1), (3.9, 0)])
        look = keys(t, [(0.7, 0), (1.2, 1), (1.9, 1), (2.5, -1), (3.1, -1), (3.4, 0)])
        p.move('hips', (0, 0.02 * up, -0.012 * up))
        p.rot('hips', X, -82 * up)
        p.rot('spine_2', X, 6 * up)
        p.rot('neck', X, 52 * up)
        p.rot('head', X, 26 * up)
        p.rot('head', Z, 38 * look * up)
        # しっぽを地面について、体をささえる
        p.rot('tail_1', X, 58 * up)
        p.rot('tail_2', X, -22 * up)
        Q.ears(p, CFG, -6 * up)
        posed = p.posed()
        for key in ('back_l', 'back_r'):
            leg = lg[key]
            A.leg_ik(p, posed, leg.upper, leg.lower, leg.foot, ra[key], leg.pole)
        for side in ('l', 'r'):
            # 前足は胸の前に、だらりとたらす
            # 体を起こした分だけ上の骨を戻して下へ向け、手首から先を前へ曲げて たらす
            p.rot(f'front_leg_upper_{side}', X, 64 * up)
            p.rot(f'front_leg_lower_{side}', X, -30 * up)
            p.rot(f'front_leg_foot_{side}', X, -55 * up)
        return p

    return Clip('Sentry', period, False, sample, {'kind': 'special', 'sound': 'peep', 'callStart': 2.4,
                                                  'callEnd': 2.9})


def dig(rig: RigModel) -> Clip:
    """頭を下げ、前足で地面を交互にかいて あなを ほる。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.2

    def sample(t: float) -> Pose:
        p = Pose(rig)
        k = keys(t, [(0.1, 0), (0.5, 1), (2.7, 1), (3.1, 0)])
        scratch = window(t, 0.6, 2.6, 0.15)
        p.move('hips', (0, 0, -0.01 * k))
        p.rot('hips', X, 10 * k)
        p.rot('neck', X, 18 * k)
        p.rot('head', X, 18 * k + 4 * scratch * math.sin(2 * math.pi * 5 * t))
        p.rot('tail_1', X, -22 * k)
        Q.ears(p, CFG, -6 * k)
        Q.eyes(p, 1 - 0.4 * scratch)
        offsets = {}
        for key, ph in (('front_l', 0.0), ('front_r', math.pi)):
            c = math.sin(2 * math.pi * 3.2 * t + ph)
            # 前へ出して少し持ち上げ、うしろへ かき出す（持ち上げているあいだに前へ戻す）
            offsets[key] = Vector((0, -0.035 * K * c * scratch, 0.03 * K * max(0.0, c) * scratch))
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets)
        return p

    return Clip('Dig', period, False, sample, {'kind': 'special'})


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
            sentry(rig), dig(rig), Q.happy(rig, CFG), Q.blink_clip(rig)]
