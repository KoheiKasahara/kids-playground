# tiger_motion から作成した cheetah の土台を、チーターの個別仕様に書き換えたもの。
"""チーターのモーション。

- 歩き: 後ろ足→同じ側の前足の順に着く4拍子。長い脚で大またに、頭を低く水平にたもって歩く。
- 走り: 後ろ足2本でけって前足2本で着く、背中をとても大きくしならせたギャロップ（いちばん足の速い動物）。
- みはり: Mesh2Motion のキツネ「Sit」（CC0）を写して座り、頭を左右へ向けて見回し、小鳥のような声で「チュルル」と鳴く。
- のびー: ネコのように前足を一歩ずつ前へ出し、胸を下げおしりを上げて伸びる（あくびつき）。
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
TAIL = ['tail_1', 'tail_2', 'tail_3', 'tail_4']
CFG = Q.Config(neck=['neck'], tail=TAIL, front_pole=Vector((0, 1, 0.2)), hind_pole=Vector((0, -1, 0.2)),
               toe=(0.13, 0.07, 0.16, 0.15), ear_axis=Vector((1, 0, 0)), ear_mirror=False, jaw='jaw')

# キツネ（Mesh2Motion fox）→ ライオンの骨の対応
BODY_MAP: RT.Mapping = {
    'hips': ('bone', 'hips'), 'spine_1': ('bone', 'spine_1'), 'spine_2': ('blend', 'spine_2', 'spine_3', 0.5),
    'neck': ('blend', 'spine_4', 'spine_5', 0.5), 'head': ('bone', 'head'), 'jaw': ('bone', 'mouth'),
    'ear_l': ('bone', 'ear_1_l'), 'ear_r': ('bone', 'ear_1_r'),
    'tail_1': ('bone', 'tail_1'), 'tail_2': ('bone', 'tail_2'), 'tail_3': ('bone', 'tail_3'), 'tail_4': ('bone', 'tail_4'),
}
LEG_MAP: RT.Mapping = {}
for s in ('l', 'r'):
    LEG_MAP.update({
        f'front_leg_upper_{s}': ('bone', f'front_leg_upper_{s}'), f'front_leg_lower_{s}': ('bone', f'front_leg_lower_{s}'),
        f'front_leg_foot_{s}': ('bone', f'front_leg_foot_{s}'), f'back_leg_upper_{s}': ('bone', f'back_leg_upper_{s}'),
        f'back_leg_lower_{s}': ('bone', f'back_leg_lower_{s}'), f'back_leg_foot_{s}': ('bone', f'back_leg_ankle_{s}'),
    })
FOX_HIPS_Z = 0.98

_cache: dict = {}


def source(name: str) -> RT.SourceClip:
    if name not in _cache:
        _cache[name] = RT.load_source(os.path.abspath(os.path.join(VENDOR, name)))
    return _cache[name]


def lateral():
    return {'back_l': 0.0, 'front_l': 0.25, 'back_r': 0.5, 'front_r': 0.75}


def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    return Q.locomotion(rig, CFG, name, period=1.1, stride=0.78, duty=0.62, turn=turn_deg, phases=lateral(),
                        lift=(0.1, 0.09), pitch=(32, 26), crouch=0.08 + abs(turn_deg) / 30 * 0.02, bob=0.008,
                        roll=3.0, sway=0.01, neck_pump=2.0, neck_pitch=12, head_level=0.85, tail_amp=12, tail_lift=-6)


def run(rig: RigModel) -> Clip:
    return Q.locomotion(rig, CFG, 'Run', period=0.5, stride=1.36, duty=0.3,
                        turn=0, phases={'back_l': 0.0, 'back_r': 0.07, 'front_l': 0.45, 'front_r': 0.52},
                        lift=(0.17, 0.15), pitch=(55, 45), crouch=0.1, bob=0.016, roll=1.2, sway=0.006,
                        neck_pump=4, neck_pitch=4, head_level=0.9, tail_amp=10, tail_lift=6, ear_back=-14,
                        spine_flex=16, bob_freq=1)


def turn(rig: RigModel, direction: int) -> Clip:
    return Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=1.2, stride=0.0, duty=0.68,
                        turn=80 * direction, phases=lateral(), lift=(0.08, 0.07), pitch=(25, 20), crouch=0.05,
                        bob=0.005, roll=2, sway=0.008, neck_pump=2, neck_pitch=0, head_level=0.6, tail_amp=10,
                        tail_lift=6)


def yawn(p: Pose, t: float) -> None:
    w = window(t, 2.0, 2.9, 0.25)
    p.rot('jaw', X, 28 * w)
    p.rot('head', X, -12 * w)
    Q.eyes(p, 1 - 0.8 * w) if w > 0.01 else None


def eat(rig: RigModel) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 3.6

    def sample(t: float) -> Pose:
        p = Pose(rig)
        down = keys(t, [(0, 0), (0.7, 1), (2.8, 1), (3.4, 0)])
        chew = window(t, 0.9, 2.7, 0.1) * (0.5 + 0.5 * math.sin(2 * math.pi * 3 * t))
        p.move('hips', (0, 0, -0.03 * down))
        p.rot('spine_2', X, 8 * down)
        p.rot('neck', X, 30 * down)
        p.rot('head', X, 18 * down - 4 * chew)
        p.rot('jaw', X, 14 * chew)
        Q.ears(p, CFG, -6 * down)
        Q.tail_wave(p, CFG, t, 1.0, 16, 4)
        Q.eyes(p, 1 - 0.5 * window(t, 1.2, 2.6, 0.15))
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    p = sample(1.0)
    tip = p.posed()['jaw'] @ Vector((0, rig.length['jaw'], 0))
    return Clip('Eat', period, False, sample, {'kind': 'eat', 'food': {'bone': 'head', 'grab': 0.9, 'release': 2.6,
                                                                       'reach': round(-tip.y, 3)}})


def lookout(rig: RigModel) -> Clip:
    """座って頭を左右へ向けて見回し、小鳥のような声で「チュルル」と鳴く（キツネの Sit を写す）。"""
    src = source('fox-sit.glb')
    lg, ra = Q.standing(rig, CFG)
    period = 4.2
    scale = rig.head('hips').z / FOX_HIPS_Z

    def sample(t: float) -> Pose:
        k = keys(t, [(0, 0), (0.7, 1), (period - 0.6, 1), (period, 0)])
        st = min(src.duration, t * src.duration / 0.7) if t < 0.7 else src.duration
        target = Q.retargeted(rig, src, BODY_MAP, st, hips_scale=scale)
        p = Q.blend(Pose(rig), target, k)
        look = window(t, 0.8, period - 0.6, 0.3)
        # 右を見て、左を見て、正面で首をのばす
        turn = keys(t, [(0.8, 0), (1.5, 1), (2.2, 1), (2.9, -1), (3.4, 0)])
        p.rot('neck', X, -12 * look)
        p.rot('head', Z, 35 * turn * look)
        chirp = window(t, 3.0, 3.6, 0.1)
        p.rot('jaw', X, 10 * chirp * (0.5 + 0.5 * math.sin(2 * math.pi * 7 * t)))
        Q.ears(p, CFG, -12 * look)
        Q.tail_wave(p, CFG, t, 2.0, 8 * look, 0)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Lookout', period, False, sample, {'kind': 'special', 'sound': 'chirp', 'callStart': 3.0,
                                                   'callEnd': 3.6, 'source': 'Mesh2Motion fox/Sit (CC0)'})


def _lying(p: Pose, k: float, hind_k: float, front_k: float) -> tuple[dict, dict, dict]:
    """スフィンクスのような伏せ。前足を前へ出し、後ろ足は体の下へ折りたたむ。"""
    p.move('hips', (0, 0.03 * k, -0.43 * k))
    p.rot('hips', X, 4 * (hind_k - front_k))
    p.rot('neck', X, 8 * k)
    p.rot('head', X, -4 * k)
    p.rot('tail_1', X, -25 * k)
    p.rot_chain(TAIL[1:], Z, 55 * k, [1, 1.2, 1.4])
    offsets = {
        'front_l': Vector((0.01 * front_k, -0.32 * front_k, -0.02 * front_k)),
        'front_r': Vector((-0.01 * front_k, -0.32 * front_k, -0.02 * front_k)),
        'back_l': Vector((0.06 * hind_k, -0.12 * hind_k, 0.0)),
        'back_r': Vector((-0.06 * hind_k, -0.12 * hind_k, 0.0)),
    }
    rots = {key: Matrix.Rotation(math.radians(-10 * front_k), 3, 'X') for key in ('front_l', 'front_r')}
    rots.update({key: Matrix.Rotation(math.radians(-55 * hind_k), 3, 'X') for key in ('back_l', 'back_r')})
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
        p.rot('neck', X, 10)
        p.rot('head', Z, 25)
        p.rot('head', X, 6 + 1.5 * breath)
        p.rot('tail_4', Z, 15 * math.sin(2 * math.pi * c * 2))
        twitch = window(t, 2.6, 2.9, 0.08) * math.sin(2 * math.pi * 6 * t)
        Q.ears(p, CFG, 15 * twitch)
        Q.eyes(p, 0.06)
        posed = p.posed()
        A.plant_feet(p, posed, _legs_with(lg, poles, 1, 1), ra, offsets, rots)
        return p

    return Clip('Sleep', period, True, sample, {'kind': 'sleep'})


def stretch(rig: RigModel) -> Clip:
    """ネコのような伸び: 前足を一歩ずつ前へ出して胸を下げ、おしりを上げて大あくび。"""
    lg, ra = Q.standing(rig, CFG)
    period = 4.0
    reach = 0.24

    def step(t: float, t0: float, t1: float) -> tuple[float, float]:
        k = keys(t, [(t0, 0), (t1, 1)])
        lift = math.sin(math.pi * min(1, max(0, (t - t0) / (t1 - t0)))) * 0.07
        return k, lift

    def sample(t: float) -> Pose:
        p = Pose(rig)
        bow = keys(t, [(0.5, 0), (1.3, 1), (2.7, 1), (3.3, 0)])
        out_l, lift_l = step(t, 0.0, 0.45)
        out_r, lift_r = step(t, 0.3, 0.75)
        back_l, blift_l = step(t, 3.25, 3.65)
        back_r, blift_r = step(t, 3.5, 3.95)
        fl = out_l * (1 - back_l)
        fr = out_r * (1 - back_r)
        # 胸を下げておしりを上げる（腰の骨を前へ傾け、背中は反らせる）
        p.move('hips', (0, 0.02 * bow, 0.02 * bow))
        p.rot('hips', X, 17 * bow)
        p.rot('spine_1', X, -6 * bow)
        p.rot('spine_2', X, -6 * bow)
        p.rot('neck', X, -16 * bow)
        p.rot('head', X, -8 * bow)
        yawn = window(t, 1.5, 2.6, 0.25)
        p.rot('jaw', X, 30 * yawn)
        p.rot('head', X, -10 * yawn)
        Q.ears(p, CFG, 10 * bow)
        Q.eyes(p, 1 - 0.92 * window(t, 1.3, 2.7, 0.2))
        p.rot('tail_1', X, 30 * bow)
        p.rot_chain(TAIL[1:], X, -12 * bow)
        Q.tail_wave(p, CFG, t, 1.3, 10 * bow, 0)
        offsets = {
            'front_l': Vector((0, -reach * fl, lift_l + blift_l)),
            'front_r': Vector((0, -reach * fr, lift_r + blift_r)),
        }
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets)
        return p

    return Clip('Stretch', period, False, sample, {'kind': 'special'})


def happy_extra(p: Pose, t: float) -> None:
    p.rot('jaw', X, 10 * window(t, 0.2, 1.3, 0.2))


def clips(rig: RigModel) -> list[Clip]:
    return [Q.idle(rig, CFG, extra=yawn), walk(rig), walk(rig, 28, 'WalkLeft'), walk(rig, -28, 'WalkRight'), run(rig),
            turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True), lookout(rig),
            stretch(rig), Q.happy(rig, CFG, extra=happy_extra), Q.blink_clip(rig)]
