# zebra から作成した sheep の土台。形・色・骨・動きを個別仕様に合わせて書き換える。
# giraffe から作成した zebra の土台。形・色・骨・動きを個別仕様に合わせて書き換える。
"""ヒツジのモーション。

- 歩き: 後ろ足→同じ側の前足の順に着く4拍子。細い脚でちょこちょこ歩く。
- 走り: 後ろ足2本→前足2本の順に着く小さなギャロップ。
- 食べる: Mesh2Motion の馬「Eating」（CC0）をリターゲットし、首を下げて地面の草を食べる。
- 伏せ・睡眠: Mesh2Motion の馬「Sleep」の姿勢をリターゲットし、脚をたたんで座りこむ。
- メェー: 頭を上げて口を開け、ふるえる声で鳴く。
- ぴょこん: 4本の脚をそろえたまま、その場でまっすぐ上へはねる（子ヒツジの遊び）。
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
CFG = Q.Config(neck=NECK, tail=['tail_1'], front_pole=Vector((0, -1, 0.1)),
               hind_pole=Vector((0, 1, 0.1)), toe=(0.08, 0.06, 0.08, 0.06), ear_axis=Vector((0, 1, 0)))

# 馬（Mesh2Motion horse）→ ヒツジの骨の対応（首は2本どうし）。
BODY_MAP: RT.Mapping = {
    'hips': ('bone', 'hips'), 'spine_1': ('bone', 'spine_1'), 'spine_2': ('blend', 'spine_2', 'spine_3', 0.5),
    'neck_1': ('bone', 'spine_5'), 'neck_2': ('bone', 'spine_6'),
    'head': ('bone', 'head'), 'tail_1': ('bone', 'tail_1'),
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
    return Q.locomotion(rig, CFG, name, period=0.8, stride=0.4, duty=0.62, turn=turn_deg,
                        phases=Q.GAITS['lateral_walk'], lift=(0.07, 0.06), pitch=(30, 25),
                        crouch=0.04 + abs(turn_deg) / 30 * 0.015, bob=0.01, roll=2.5, sway=0.01, neck_pump=4,
                        neck_pitch=0, head_level=0.6, tail_amp=14, tail_lift=0)


def run(rig: RigModel) -> Clip:
    return Q.locomotion(rig, CFG, 'Run', period=0.45, stride=0.8, duty=0.34, turn=0, phases=Q.GAITS['gallop'],
                        lift=(0.11, 0.1), pitch=(45, 38), crouch=0.05, bob=0.02, roll=1.5, sway=0.008, neck_pump=6,
                        neck_pitch=4, head_level=0.6, tail_amp=10, tail_lift=10, spine_flex=5, bob_freq=1)


def turn(rig: RigModel, direction: int) -> Clip:
    return Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=0.9, stride=0.0, duty=0.68,
                        turn=75 * direction, phases=Q.GAITS['lateral_walk'], lift=(0.06, 0.05), pitch=(22, 18),
                        crouch=0.04, bob=0.006, roll=1.5, sway=0.008, neck_pump=2, neck_pitch=0, head_level=0.6,
                        tail_amp=10, tail_lift=0)


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
    """首を下げて地面の草を食べる（馬の Eating をリターゲット）。"""
    src = source('horse-eating.glb')
    lg, ra = Q.standing(rig, CFG)
    period = 4.2
    down, up = 1.0, 3.3

    def pose_at(t: float, extra: float) -> Pose:
        k = keys(t, [(0.2, 0), (down, 1), (up, 1), (period - 0.1, 0)])
        st = min(src.duration, max(0.0, (t - 0.2) * 0.9))
        target = Q.retargeted(rig, src, BODY_MAP, st)
        p = Q.blend(Pose(rig), target, k)
        # 首の付け根を前へ倒して、長い首でも頭が地面まで届くようにする（首は C の字に折らない）
        p.rot('neck_1', X, extra * k)
        p.rot('neck_2', X, -0.25 * extra * k)
        p.move('hips', (0, -0.02 * k, -0.06 * k))
        p.rot('spine_2', X, 6 * k)
        Q.tail_wave(p, CFG, t, 1.1, 10, 4)
        Q.eyes(p, 1 - 0.5 * window(t, 1.3, 3.0, 0.15))
        return p

    def splay(t: float):
        return {}, {}

    def mouth_height(extra: float) -> float:
        p = pose_at(2.0, extra)
        posed = p.posed()
        offsets, _ = splay(2.0)
        A.plant_feet(p, posed, lg, ra, offsets)
        tip = p.posed()['head'] @ Vector((0, rig.length['head'], 0))
        return tip.z

    # 口の先が地面すれすれ（0.1m）に来るよう、首の付け根を倒す角度を二分探索で決める
    lo, hi = -20.0, 90.0
    for _ in range(18):
        mid = (lo + hi) / 2
        if mouth_height(mid) > 0.1:
            lo = mid
        else:
            hi = mid
    strength = (lo + hi) / 2

    def sample(t: float) -> Pose:
        p = pose_at(t, strength)
        posed = p.posed()
        offsets, _ = splay(t)
        A.plant_feet(p, posed, lg, ra, offsets)
        return p

    p = sample(2.0)
    tip = p.posed()['head'] @ Vector((0, rig.length['head'], 0))
    reach = round(-tip.y, 3)
    return Clip('Eat', period, False, sample, {'kind': 'eat', 'source': 'Mesh2Motion horse/Eating (CC0)',
                                               'food': {'bone': 'head', 'grab': 1.2, 'release': 2.9, 'reach': reach}})


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


def baa(rig: RigModel) -> Clip:
    """頭を上げて口を開け、ふるえる声で「メェー」。"""
    lg, ra = Q.standing(rig, CFG)
    period = 2.6
    call0, call1 = 0.7, 1.9

    def sample(t: float) -> Pose:
        p = Pose(rig)
        up = keys(t, [(0.1, 0), (0.6, 1), (2.0, 1), (2.5, 0)])
        call = window(t, call0, call1, 0.15)
        p.rot('neck_1', X, -10 * up)
        p.rot('neck_2', X, -10 * up)
        p.rot('head', X, -18 * up - 6 * call)
        p.rot('head', Y, 4 * call * math.sin(2 * math.pi * 7 * t))
        Q.ears(p, CFG, 20 * call * math.sin(2 * math.pi * 3 * t))
        Q.eyes(p, 1 - 0.6 * call)
        Q.tail_wave(p, CFG, t, 0.3, 20 * up, 0)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Baa', period, False, sample, {'kind': 'special', 'sound': 'baa', 'callStart': call0,
                                               'callEnd': call1})


def pronk(rig: RigModel) -> Clip:
    """4本の脚をそろえたまま、その場でまっすぐ上へ2回はねる。"""
    lg, ra = Q.standing(rig, CFG)
    period = 2.2
    hops = [(0.45, 0.85), (1.1, 1.5)]

    def sample(t: float) -> Pose:
        p = Pose(rig)
        air, squat = 0.0, 0.0
        for t0, t1 in hops:
            if t0 <= t <= t1:
                air = math.sin(math.pi * (t - t0) / (t1 - t0)) * 0.2
            squat += window(t, t0 - 0.18, t0 + 0.02, 0.08) + window(t, t1 - 0.02, t1 + 0.15, 0.06)
        joy = window(t, 0.2, 2.0, 0.2)
        p.move('hips', (0, 0, air - 0.035 * squat))
        p.rot('spine_1', X, -4 * min(1.0, air / 0.1))
        p.rot('head', X, -8 * joy)
        Q.ears(p, CFG, 25 * min(1.0, air / 0.1))
        Q.eyes(p, 1 - 0.65 * joy)
        Q.tail_wave(p, CFG, t, 0.25, 22 * joy, 0)
        offsets = {k: Vector((0, 0, air)) for k in lg}
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets)
        return p

    return Clip('Pronk', period, False, sample, {'kind': 'special'})


def clips(rig: RigModel) -> list[Clip]:
    return [Q.idle(rig, CFG), walk(rig), walk(rig, 28, 'WalkLeft'), walk(rig, -28, 'WalkRight'), run(rig),
            turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True),
            baa(rig), pronk(rig), Q.happy(rig, CFG), Q.blink_clip(rig)]
