# monkey から作成した gorilla の土台。形・色・骨・動きを個別仕様に合わせて書き換える。
# panda から作成した monkey の土台。形・色・骨・動きを個別仕様に合わせて書き換える。
# lion_motion から作成した panda の土台を、パンダの個別仕様に書き換えたもの。
"""ゴリラのモーション。

- 歩き: こぶしを地面について歩く（ナックルウォーク）。後ろ足→同じ側の前足の順に着く4拍子で、大きな肩をゆらす。
- 走り: こぶしと足で地面をけるギャロップ。
- 食べる: 地面の葉っぱを右手でつかみ、座って両手で口へ運ぶ（hold_r で運ぶ）。
- ドンドコ: 後ろ足で立ち上がり、両手で胸を交互にたたく（ドラミング）。
- ドシン: 座ったまま両手のこぶしで地面をたたく。
"""

from __future__ import annotations

import math
import os

from mathutils import Matrix, Vector  # type: ignore[import-not-found]

from .. import anim as A
from .. import bodyplan as Q
from .. import retarget as RT
from ..anim import X, Y, Z, Clip, Pose, RigModel, keys, window

VENDOR = os.path.join(os.path.dirname(__file__), '..', '..', 'vendor', 'mesh2motion')
CFG = Q.Config(neck=['neck'], tail=['tail_1'], front_pole=Vector((0, 1, 0.2)), hind_pole=Vector((0, -1, 0.2)),
               toe=(0.07, 0.07, 0.14, 0.05), ear_axis=Vector((1, 0, 0)), ear_mirror=False)

# キツネ（Mesh2Motion fox）→ パンダの骨の対応（体幹・首・頭・耳・尾。足は IK で置く）
BODY_MAP: RT.Mapping = {
    'hips': ('bone', 'hips'), 'spine_1': ('bone', 'spine_1'), 'spine_2': ('blend', 'spine_2', 'spine_3', 0.5),
    'neck': ('blend', 'spine_4', 'spine_5', 0.5), 'head': ('bone', 'head'),
    'ear_l': ('bone', 'ear_1_l'), 'ear_r': ('bone', 'ear_1_r'), 'tail_1': ('bone', 'tail_1'),
}
FOX_HIPS_Z = 0.98
TAIL = ['tail_1']
S = 1.45  # 座る・食べる・伏せるの移動量の係数（腰の高さがサルの約1.1倍）
HOLD_POLE = Vector((0, 0.4, -1))  # 物を持つときは、ひじを下へ向ける

_cache: dict = {}


def source(name: str) -> RT.SourceClip:
    if name not in _cache:
        _cache[name] = RT.load_source(os.path.abspath(os.path.join(VENDOR, name)))
    return _cache[name]


def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    return Q.locomotion(rig, CFG, name, period=1.15, stride=0.56, duty=0.66, turn=turn_deg,
                        phases=Q.GAITS['lateral_walk'], lift=(0.09, 0.08), pitch=(20, 25),
                        crouch=0.05 + abs(turn_deg) / 30 * 0.02, bob=0.012, roll=4.5, sway=0.02, neck_pump=2,
                        neck_pitch=-4, head_level=0.7, tail_amp=0, tail_lift=0)


def run(rig: RigModel) -> Clip:
    return Q.locomotion(rig, CFG, 'Run', period=0.6, stride=1.0, duty=0.4, turn=0, phases=Q.GAITS['gallop'],
                        lift=(0.13, 0.11), pitch=(35, 35), crouch=0.06, bob=0.02, roll=2.5, sway=0.01, neck_pump=4,
                        neck_pitch=-4, head_level=0.7, tail_amp=0, tail_lift=0, spine_flex=6, bob_freq=1)


def turn(rig: RigModel, direction: int) -> Clip:
    return Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=1.1, stride=0.0, duty=0.7,
                        turn=70 * direction, phases=Q.GAITS['lateral_walk'], lift=(0.07, 0.06), pitch=(15, 15),
                        crouch=0.05, bob=0.006, roll=3, sway=0.012, neck_pump=2, neck_pitch=-4, head_level=0.6,
                        tail_amp=0, tail_lift=0)


def idle_extra(p: Pose, t: float) -> None:
    # ゆっくり見回す
    p.rot('head', Z, 20 * window(t, 0.5, 1.6, 0.3) - 20 * window(t, 2.2, 3.3, 0.3))


def _hold_target(rig: RigModel, posed: dict, side: float, lift: float = 0.0) -> Vector:
    """口の少し下・前に両前足を寄せる位置（side=+1 左, -1 右）。"""
    head = posed['head']
    mouth = head @ Vector((0, rig.length['head'] * 0.85, -0.06 * S))
    return mouth + Vector((0.05 * S * side, -0.04 * S, -0.06 * S + lift))


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
        p.move('hips', (0, 0.04 * S * sit, -0.16 * S * sit))
        p.rot('hips', X, -50 * sit)
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
                target = target + Vector((0, -0.1 * S, 0.03 * S)) * reach
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


def chest_beat(rig: RigModel) -> Clip:
    """後ろ足で立ち上がり、両手で胸を交互にたたく（ドラミング）。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.4
    call0, call1 = 0.9, 2.5

    def sample(t: float) -> Pose:
        p = Pose(rig)
        up = keys(t, [(0.1, 0), (0.8, 1), (2.7, 1), (3.3, 0)])
        drum = window(t, call0, call1, 0.1)
        p.move('hips', (0, 0.06 * up, 0.0))
        p.rot('hips', X, -48 * up)
        p.rot('spine_1', X, -10 * up)
        p.rot('spine_2', X, -6 * up)
        p.rot('neck', X, 40 * up)
        p.rot('head', X, 10 * up - 10 * drum)
        Q.eyes(p, 1 - 0.4 * drum)
        posed = p.posed()
        for key in ('back_l', 'back_r'):
            leg = lg[key]
            A.leg_ik(p, posed, leg.upper, leg.lower, leg.foot, ra[key], leg.pole)
        for key, side, ph in (('front_l', 1.0, 0.0), ('front_r', -1.0, 0.5)):
            leg = lg[key]
            beat = max(0.0, math.sin(2 * math.pi * (3.5 * t + ph)))
            chest = posed['spine_2'] @ Vector((0.12 * side, rig.length['spine_2'] * 0.9, -0.22 - 0.06 * beat))
            target = ra[key].lerp(chest, up)
            A.leg_ik(p, posed, leg.upper, leg.lower, leg.foot, target, leg.pole.lerp(Vector((side, 0.3, -1)), up),
                     Matrix.Rotation(math.radians(-90 * up), 3, 'X'))
        return p

    return Clip('ChestBeat', period, False, sample, {'kind': 'special', 'sound': 'drum', 'callStart': call0,
                                                     'callEnd': call1})


def stomp(rig: RigModel) -> Clip:
    """座ったまま、両手のこぶしで地面を「ドシン」とたたく。"""
    src = source('fox-sit.glb')
    lg, ra = Q.standing(rig, CFG)
    period = 3.0
    scale = rig.head('hips').z / FOX_HIPS_Z
    hits = (1.1, 1.8)

    def sample(t: float) -> Pose:
        k = keys(t, [(0, 0), (0.6, 1), (period - 0.6, 1), (period, 0)])
        st = min(src.duration, t * src.duration / 0.6) if t < 0.6 else src.duration
        p = Q.blend(Pose(rig), Q.retargeted(rig, src, BODY_MAP, st, hips_scale=scale), k)
        raise_ = max(keys(t, [(h - 0.45, 0), (h - 0.12, 1), (h, 0)]) for h in hits)
        p.rot('head', X, -8 * raise_)
        Q.eyes(p, 1 - 0.5 * raise_)
        posed = p.posed()
        for key in ('back_l', 'back_r'):
            leg = lg[key]
            A.leg_ik(p, posed, leg.upper, leg.lower, leg.foot, ra[key], leg.pole)
        for key in ('front_l', 'front_r'):
            leg = lg[key]
            target = ra[key] + Vector((0, -0.05 * k, 0.32 * raise_))
            A.leg_ik(p, posed, leg.upper, leg.lower, leg.foot, target, leg.pole)
        return p

    return Clip('Stomp', period, False, sample, {'kind': 'special', 'sound': 'drum', 'callStart': hits[0] - 0.05,
                                                 'callEnd': hits[1] + 0.2, 'source': 'Mesh2Motion fox/Sit (CC0)'})


def _lying(p: Pose, k: float, hind_k: float, front_k: float) -> tuple[dict, dict, dict]:
    """伏せ。前足を前へ出してあごをのせ、後ろ足は体の下へ折りたたむ。"""
    p.move('hips', (0, 0.02 * S * k, -0.24 * S * k))
    p.rot('hips', X, 4 * (hind_k - front_k))
    p.rot('neck', X, 12 * k)
    p.rot('head', X, 4 * k)
    offsets = {
        'front_l': Vector((0.01 * front_k, -0.16 * S * front_k, -0.01 * front_k)),
        'front_r': Vector((-0.01 * front_k, -0.16 * S * front_k, -0.01 * front_k)),
        'back_l': Vector((0.05 * S * hind_k, -0.08 * S * hind_k, 0.0)),
        'back_r': Vector((-0.05 * S * hind_k, -0.08 * S * hind_k, 0.0)),
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
    return [Q.idle(rig, CFG, extra=idle_extra), walk(rig), walk(rig, 24, 'WalkLeft'), walk(rig, -24, 'WalkRight'),
            run(rig), turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True),
            chest_beat(rig), stomp(rig), Q.happy(rig, CFG), Q.blink_clip(rig)]
