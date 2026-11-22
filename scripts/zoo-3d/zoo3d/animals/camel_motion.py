# zebra から作成した camel の土台。形・色・骨・動きを個別仕様に合わせて書き換える。
# giraffe から作成した zebra の土台。形・色・骨・動きを個別仕様に合わせて書き換える。
"""ラクダのモーション。

- 歩き: 同じ側の前後の脚がほぼ一緒に出る側対歩（`pace`）。体を左右へゆらし、首を前後にゆったりふる。
- 走り: 後ろ足2本→前足2本の順に着くギャロップ。
- 食べる: Mesh2Motion の馬「Eating」（CC0）をリターゲットし、首を下げて地面の草を食べる。
- 伏せ・睡眠: Mesh2Motion の馬「Sleep」の姿勢をリターゲットし、脚をたたんで座りこむ。
- もぐもぐ: 首をのばして、口を横にずらしながらゆっくりかむ（反すう）。
- ぶおー: 頭を上げて口を開け、低い声で鳴く。
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
NECK = ['neck_1', 'neck_2']
CFG = Q.Config(neck=NECK, tail=['tail_1', 'tail_2', 'tail_3'], front_pole=Vector((0, -1, 0.1)),
               hind_pole=Vector((0, 1, 0.1)), toe=(0.12, 0.1, 0.12, 0.1), ear_axis=Vector((0, 1, 0)), jaw='jaw')

# 馬（Mesh2Motion horse）→ ラクダの骨の対応（首は2本どうし）。
BODY_MAP: RT.Mapping = {
    'hips': ('bone', 'hips'), 'spine_1': ('bone', 'spine_1'), 'spine_2': ('blend', 'spine_2', 'spine_3', 0.5),
    'neck_1': ('bone', 'spine_5'), 'neck_2': ('bone', 'spine_6'),
    'head': ('bone', 'head'), 'tail_1': ('bone', 'tail_1'), 'tail_2': ('bone', 'tail_2'), 'tail_3': ('bone', 'tail_3'),
    'ear_l': ('bone', 'ear_1_l'), 'ear_r': ('bone', 'ear_1_r'),
}
LEG_MAP: RT.Mapping = {}
for s in ('l', 'r'):
    LEG_MAP.update({
        f'front_leg_upper_{s}': ('bone', f'front_leg_upper_{s}'), f'front_leg_lower_{s}': ('bone', f'front_leg_lower_{s}'),
        f'front_leg_foot_{s}': ('bone', f'front_leg_ankle_{s}'), f'back_leg_upper_{s}': ('bone', f'back_leg_lower_{s}'),
        f'back_leg_lower_{s}': ('bone', f'back_leg_ankle_{s}'), f'back_leg_foot_{s}': ('bone', f'back_leg_foot_{s}'),
    })
NECK_BONES = ['neck_1', 'neck_2', 'head']

_cache: dict = {}


def source(name: str) -> RT.SourceClip:
    if name not in _cache:
        _cache[name] = RT.load_source(os.path.abspath(os.path.join(VENDOR, name)))
    return _cache[name]


def phases_pace():
    return {'back_l': 0.0, 'front_l': 0.1, 'back_r': 0.5, 'front_r': 0.6}


def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    return Q.locomotion(rig, CFG, name, period=1.3, stride=0.86, duty=0.62, turn=turn_deg, phases=Q.GAITS['pace'],
                        lift=(0.12, 0.1), pitch=(32, 28), crouch=0.06 + abs(turn_deg) / 30 * 0.02, bob=0.012,
                        roll=3.5, sway=0.025, neck_pump=4, neck_pitch=0, head_level=0.7, tail_amp=12, tail_lift=2)


def run(rig: RigModel) -> Clip:
    return Q.locomotion(rig, CFG, 'Run', period=0.7, stride=1.55, duty=0.32, turn=0, phases=Q.GAITS['gallop'],
                        lift=(0.2, 0.17), pitch=(55, 45), crouch=0.09, bob=0.025, roll=1.5, sway=0.01, neck_pump=7,
                        neck_pitch=4, head_level=0.6, tail_amp=8, tail_lift=25, spine_flex=4, bob_freq=1)


def turn(rig: RigModel, direction: int) -> Clip:
    return Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=1.4, stride=0.0, duty=0.7,
                        turn=70 * direction, phases=Q.GAITS['pace'], lift=(0.1, 0.09), pitch=(25, 20),
                        crouch=0.05, bob=0.008, roll=2, sway=0.012, neck_pump=2, neck_pitch=0, head_level=0.7,
                        tail_amp=8, tail_lift=2)


def _splay(t: float, steps: list[tuple[str, float, float, float]]) -> tuple[dict, dict]:
    """前脚を一歩ずつ左右へ開く（足を持ち上げてから置くので、接地中は滑らない）。"""
    offsets, rots = {}, {}
    for key, t0, t1, sign in steps:
        k = keys(t, [(t0, 0), (t1, 1)]) if sign > 0 else 1 - keys(t, [(t0, 0), (t1, 1)])
        lift = math.sin(math.pi * min(1, max(0, (t - t0) / (t1 - t0)))) * 0.12
        side = 1 if key.endswith('_l') else -1
        offsets[key] = offsets.get(key, Vector()) + Vector((0.26 * side * k, -0.05 * k, lift))
    return offsets, rots


def eat(rig: RigModel) -> Clip:
    """U 字の首をまっすぐ前へのばしながら頭を地面へ下ろし、草をはむ（首を下へ折りたたまない）。"""
    lg, ra = Q.standing(rig, CFG)
    period = 4.0

    def pose_at(t: float, bend: float) -> Pose:
        p = Pose(rig)
        k = keys(t, [(0.2, 0), (1.0, 1), (3.1, 1), (3.9, 0)])
        chew = window(t, 1.1, 3.0, 0.1) * math.sin(2 * math.pi * 2.5 * t)
        p.move('hips', (0, 0, -0.03 * k))
        p.rot('spine_2', X, 5 * k)
        # 首の先（上向き）を前へ倒して首の根元とそろえ、根元の角度で頭の高さを決める
        p.rot('neck_1', X, bend * k)
        p.rot('neck_2', X, 85 * k)
        p.rot('head', X, 5 * k)
        p.rot('jaw', Z, 8 * chew)
        Q.tail_wave(p, CFG, t, 1.1, 10, 4)
        Q.eyes(p, 1 - 0.5 * window(t, 1.3, 3.0, 0.15))
        return p

    def mouth_height(bend: float) -> float:
        p = pose_at(2.0, bend)
        A.plant_feet(p, p.posed(), lg, ra)
        return (p.posed()['head'] @ Vector((0, rig.length['head'], 0))).z

    lo, hi = 0.0, 80.0
    for _ in range(18):
        mid = (lo + hi) / 2
        if mouth_height(mid) > 0.12:
            lo = mid
        else:
            hi = mid
    bend = (lo + hi) / 2

    def sample(t: float) -> Pose:
        p = pose_at(t, bend)
        A.plant_feet(p, p.posed(), lg, ra)
        return p

    p = sample(2.0)
    tip = p.posed()['head'] @ Vector((0, rig.length['head'], 0))
    return Clip('Eat', period, False, sample, {'kind': 'eat', 'food': {'bone': 'head', 'grab': 1.2, 'release': 2.9,
                                                                       'reach': round(-tip.y, 3)}})


def _sleep_pose(rig: RigModel) -> Pose:
    src = source('horse-sleep.glb')
    mapping = dict(BODY_MAP)
    mapping.update(LEG_MAP)
    p = Q.retargeted(rig, src, mapping, 0.0, hips_scale=rig.head('hips').z / 1.305)
    # 体のいちばん低い骨が地面すれすれになるよう、腰の高さをそろえる
    leg_bones = [b for b in rig.order if '_leg_' in b]
    clearance = Q.ground_clearance(p, leg_bones + ['spine_1', 'spine_2'])
    p.move('hips', (0, 0, 0.05 - clearance))
    return p


def lie_down(rig: RigModel, reverse: bool = False) -> Clip:
    lying = _sleep_pose(rig)
    period = 2.6

    def sample(t: float) -> Pose:
        if reverse:
            t = period - t
        k = keys(t, [(0.1, 0), (period - 0.2, 1)])
        p = Q.blend(Pose(rig), lying, k)
        Q.eyes(p, 1 - 0.4 * k)
        return p

    return Clip('GetUp' if reverse else 'LieDown', period, False, sample,
                {'kind': 'sleep', 'source': 'Mesh2Motion horse/Sleep (CC0)'})


def sleep(rig: RigModel) -> Clip:
    lying = _sleep_pose(rig)
    period = 4.0

    def sample(t: float) -> Pose:
        c = t / period
        p = Q.blend(lying, lying, 0)
        breath = math.sin(2 * math.pi * c)
        p.move('hips', (0, 0, 0.012 * breath))
        p.rot('spine_1', X, -1.2 * breath)
        p.rot('head', X, 2 * breath)
        twitch = window(t, 2.4, 2.8, 0.1) * math.sin(2 * math.pi * 5 * t)
        Q.ears(p, CFG, 20 * twitch)
        Q.eyes(p, 0.06)
        return p

    return Clip('Sleep', period, True, sample, {'kind': 'sleep', 'source': 'Mesh2Motion horse/Sleep (CC0)'})


def chew(rig: RigModel) -> Clip:
    """首をのばして、口を横にずらしながらゆっくりかむ（反すう）。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.6

    def sample(t: float) -> Pose:
        p = Pose(rig)
        k = keys(t, [(0.1, 0), (0.6, 1), (3.0, 1), (3.5, 0)])
        chomp = window(t, 0.6, 3.0, 0.2)
        side = math.sin(2 * math.pi * 1.6 * t)
        p.rot('neck_1', X, -6 * k)
        p.rot('neck_2', X, -10 * k)
        p.rot('head', X, -8 * k)
        p.rot('jaw', X, 8 * chomp * (0.5 + 0.5 * math.sin(2 * math.pi * 3.2 * t)))
        p.rot('jaw', Z, 14 * chomp * side)
        p.rot('head', Z, 4 * chomp * side)
        Q.ears(p, CFG, 15 * chomp * math.sin(2 * math.pi * 0.8 * t))
        Q.eyes(p, 1 - 0.55 * chomp)
        Q.tail_wave(p, CFG, t, 1.0, 10, 2)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Chew', period, False, sample, {'kind': 'special', 'sound': 'munch', 'callStart': 0.8,
                                                'callEnd': 2.8})


def bellow(rig: RigModel) -> Clip:
    """頭を上げて口を開け、低い声で「ぶおー」と鳴く。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.0
    call0, call1 = 0.8, 2.2

    def sample(t: float) -> Pose:
        p = Pose(rig)
        up = keys(t, [(0.1, 0), (0.7, 1), (2.3, 1), (2.9, 0)])
        call = window(t, call0, call1, 0.2)
        p.rot('neck_1', X, -10 * up)
        p.rot('neck_2', X, -18 * up)
        p.rot('head', X, -30 * up)
        p.rot('head', Y, 5 * call * math.sin(2 * math.pi * 4 * t))
        p.rot('jaw', X, 30 * call)
        Q.ears(p, CFG, -20 * up)
        Q.eyes(p, 1 - 0.6 * call)
        Q.tail_wave(p, CFG, t, 0.5, 14 * up, 10 * up)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Bellow', period, False, sample, {'kind': 'special', 'sound': 'yawn', 'callStart': call0,
                                                  'callEnd': call1})


def clips(rig: RigModel) -> list[Clip]:
    return [Q.idle(rig, CFG), walk(rig), walk(rig, 26, 'WalkLeft'), walk(rig, -26, 'WalkRight'), run(rig),
            turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True),
            chew(rig), bellow(rig), Q.happy(rig, CFG), Q.blink_clip(rig)]
