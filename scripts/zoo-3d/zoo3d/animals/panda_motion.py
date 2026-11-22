# lion_motion から作成した panda の土台を、パンダの個別仕様に書き換えたもの。
"""パンダのモーション。

- 歩き: 後ろ足→同じ側の前足の順に着く4拍子。腰を左右に大きく揺らす、のっしのっし歩き。
- 走り: 後ろ足でけって前足で着く、背中をしならせたギャロップ（ずんぐりした体で小さめの歩幅）。
- 食べる: 地面の竹を右前足でつかみ、座って両前足で口へ運んでもぐもぐ。竹は hold_r の骨に付いて動く。
- てをふる: Mesh2Motion のキツネ「Sit」（CC0）をリターゲットして座り、右前足を顔の横でふる。
- ころりん: 伏せてから背中を下にころんと転がり、手足をぱたぱた。
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
               toe=(0.13, 0.07, 0.12, 0.07), ear_axis=Vector((1, 0, 0)), ear_mirror=False)

# キツネ（Mesh2Motion fox）→ パンダの骨の対応（体幹・首・頭・耳・尾。足は IK で置く）
BODY_MAP: RT.Mapping = {
    'hips': ('bone', 'hips'), 'spine_1': ('bone', 'spine_1'), 'spine_2': ('blend', 'spine_2', 'spine_3', 0.5),
    'neck': ('blend', 'spine_4', 'spine_5', 0.5), 'head': ('bone', 'head'),
    'ear_l': ('bone', 'ear_1_l'), 'ear_r': ('bone', 'ear_1_r'), 'tail_1': ('bone', 'tail_1'),
}
FOX_HIPS_Z = 0.98
HOLD_POLE = Vector((0, 0.4, -1))  # 物を持つときは、ひじを下へ向ける

_cache: dict = {}


def source(name: str) -> RT.SourceClip:
    if name not in _cache:
        _cache[name] = RT.load_source(os.path.abspath(os.path.join(VENDOR, name)))
    return _cache[name]


def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    return Q.locomotion(rig, CFG, name, period=1.25, stride=0.58, duty=0.66, turn=turn_deg,
                        phases=Q.GAITS['lateral_walk'], lift=(0.09, 0.08), pitch=(28, 22),
                        crouch=0.055 + abs(turn_deg) / 30 * 0.015, bob=0.01, roll=5.0, sway=0.022, neck_pump=3,
                        neck_pitch=6, head_level=0.5, tail_amp=6, tail_lift=0)


def run(rig: RigModel) -> Clip:
    return Q.locomotion(rig, CFG, 'Run', period=0.62, stride=1.0, duty=0.38, turn=0, phases=Q.GAITS['gallop'],
                        lift=(0.14, 0.12), pitch=(45, 35), crouch=0.06, bob=0.02, roll=3, sway=0.01, neck_pump=5,
                        neck_pitch=3, head_level=0.6, tail_amp=4, tail_lift=10, ear_back=-8, spine_flex=7,
                        bob_freq=1)


def turn(rig: RigModel, direction: int) -> Clip:
    return Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=1.3, stride=0.0, duty=0.68,
                        turn=75 * direction, phases=Q.GAITS['lateral_walk'], lift=(0.08, 0.07), pitch=(22, 18),
                        crouch=0.03, bob=0.006, roll=3, sway=0.012, neck_pump=2, neck_pitch=3, head_level=0.5,
                        tail_amp=4, tail_lift=0)


def idle_extra(p: Pose, t: float) -> None:
    # ときどき首をかしげる
    p.rot('head', Y, 14 * window(t, 1.6, 2.8, 0.3))


def _hold_target(rig: RigModel, posed: dict, side: float, lift: float = 0.0) -> Vector:
    """口の少し下・前に両前足を寄せる位置（side=+1 左, -1 右）。"""
    head = posed['head']
    mouth = head @ Vector((0, rig.length['head'] * 0.85, -0.09))
    return mouth + Vector((0.07 * side, -0.05, -0.08 + lift))


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
        p.move('hips', (0, 0.06 * sit, -0.2 * sit))
        p.rot('hips', X, -38 * sit)
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
                target = target + Vector((0, -0.16, 0.05)) * reach
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
                                                                       'release': release,
                                                                       'reach': round(-paw.y, 3)}})


def wave(rig: RigModel) -> Clip:
    """座って右前足をふる（キツネの Sit をリターゲットした座り姿勢）。"""
    src = source('fox-sit.glb')
    lg, ra = Q.standing(rig, CFG)
    period = 3.2
    scale = rig.head('hips').z / FOX_HIPS_Z

    def sample(t: float) -> Pose:
        k = keys(t, [(0, 0), (0.6, 1), (period - 0.6, 1), (period, 0)])
        st = min(src.duration, t * src.duration / 0.6) if t < 0.6 else src.duration
        target = Q.retargeted(rig, src, BODY_MAP, st, hips_scale=scale)
        p = Q.blend(Pose(rig), target, k)
        hello = window(t, 0.7, period - 0.5, 0.2)
        p.rot('head', Y, 10 * hello)
        p.rot('head', Z, 6 * hello * math.sin(2 * math.pi * 1.2 * t))
        Q.ears(p, CFG, -8 * hello)
        Q.eyes(p, 1 - 0.6 * hello)
        posed = p.posed()
        for key in ('back_l', 'back_r', 'front_l'):
            leg = lg[key]
            A.leg_ik(p, posed, leg.upper, leg.lower, leg.foot, ra[key], leg.pole)
        leg = lg['front_r']
        # 顔の横・頭より少し高い位置で、左右にふる
        up = _hold_target(rig, posed, -1.0) + Vector((-0.28, -0.05, 0.24))
        up += Vector((0.09 * math.sin(2 * math.pi * 2.4 * t), 0, 0.03 * math.cos(2 * math.pi * 2.4 * t))) * hello
        target = ra['front_r'].lerp(up, hello)
        A.leg_ik(p, posed, leg.upper, leg.lower, leg.foot, target, leg.pole.lerp(HOLD_POLE, hello),
                 Matrix.Rotation(math.radians(-80 * hello), 3, 'X'))
        return p

    return Clip('Wave', period, False, sample, {'kind': 'special', 'sound': 'squeak', 'callStart': 0.8,
                                                'callEnd': 2.4, 'source': 'Mesh2Motion fox/Sit (CC0)'})


def _lying(p: Pose, k: float, hind_k: float, front_k: float) -> tuple[dict, dict, dict]:
    """伏せ。前足を前へ出してあごをのせ、後ろ足は体の下へ折りたたむ。"""
    p.move('hips', (0, 0.03 * k, -0.3 * k))
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


def roll(rig: RigModel) -> Clip:
    """伏せてから背中を下にころんと転がり、手足をぱたぱた。"""
    lg, ra = Q.standing(rig, CFG)
    period = 4.4

    def sample(t: float) -> Pose:
        k = keys(t, [(0, 0), (0.9, 1), (3.6, 1), (4.35, 0)])
        over = keys(t, [(0.9, 0), (1.6, 1), (2.9, 1), (3.5, 0)])
        wiggle = window(t, 1.6, 2.9, 0.15)
        p = Pose(rig)
        offsets, rots, poles = _lying(p, k, k, k)
        posed = p.posed()
        A.plant_feet(p, posed, _legs_with(lg, poles, k, k), ra, offsets, rots)
        p.move('hips', (0.05 * over, 0, 0.06 * over))
        p.rot('hips', Y, -140 * over + 12 * wiggle * math.sin(2 * math.pi * 2 * t))
        for side, ph in (('l', 0), ('r', 1.6)):
            p.rot(f'front_leg_upper_{side}', X, -30 * over + 25 * wiggle * math.sin(2 * math.pi * 3 * t + ph))
            p.rot(f'back_leg_upper_{side}', X, 30 * over - 20 * wiggle * math.sin(2 * math.pi * 3 * t + ph + 1))
        p.rot('neck', Y, 30 * over)
        p.rot('head', X, -12 * over)
        Q.eyes(p, 1 - 0.75 * wiggle)
        return p

    return Clip('Roll', period, False, sample, {'kind': 'special'})


def clips(rig: RigModel) -> list[Clip]:
    return [Q.idle(rig, CFG, extra=idle_extra), walk(rig), walk(rig, 26, 'WalkLeft'), walk(rig, -26, 'WalkRight'),
            run(rig), turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True),
            wave(rig), roll(rig), Q.happy(rig, CFG), Q.blink_clip(rig)]
