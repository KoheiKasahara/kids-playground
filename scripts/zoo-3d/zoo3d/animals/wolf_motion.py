# fox から作成した wolf の土台。形・色・骨・動きを個別仕様に合わせて書き換えたもの。
"""オオカミのモーション。

- 歩き: 後ろ足→同じ側の前足の順に着く4拍子。頭を低めに前へ出し、しっぽを下げぎみにして、とことこ歩く。
- 走り: 対角の脚がそろって着く速足（トロット）。長い距離を走るオオカミらしい、上下の少ない走り。
- 食べる: 頭を下げて、地面のおにくをくわえてかむ。
- ねる: Mesh2Motion のキツネ「Sleep」（CC0）を写し、しっぽを体に巻いて丸くなる。
- アオーン: Mesh2Motion のキツネ「Howl」（CC0）を写し、座って空へ向かって遠ぼえする。
- あそぼう: 前足をのばして胸を地面へ下げ、おしりを上げてしっぽをふる「あそぼうのおじぎ」。ぴょんと2回はねる。
"""

from __future__ import annotations

import math
import os

from mathutils import Vector  # type: ignore[import-not-found]

from .. import anim as A
from .. import bodyplan as Q
from .. import retarget as RT
from ..anim import X, Y, Clip, Pose, RigModel, keys, window

VENDOR = os.path.join(os.path.dirname(__file__), '..', '..', 'vendor', 'mesh2motion')
TAIL = ['tail_1', 'tail_2', 'tail_3', 'tail_4']
# キツネより 1.35 倍大きい
K = 1.75 / 1.3
CFG = Q.Config(neck=['neck'], tail=TAIL, front_pole=Vector((0, 1, 0.2)), hind_pole=Vector((0, -1, 0.2)),
               toe=(0.09 * K, 0.02 * K, 0.11 * K, 0.1 * K), ear_axis=Vector((1, 0, 0)), ear_mirror=False)

# キツネ（Mesh2Motion fox）→ オオカミの骨の対応（キツネと同じ骨格）
BODY_MAP: RT.Mapping = {
    'hips': ('bone', 'hips'), 'spine_1': ('bone', 'spine_1'), 'spine_2': ('blend', 'spine_2', 'spine_3', 0.5),
    'neck': ('blend', 'spine_4', 'spine_5', 0.5), 'head': ('bone', 'head'),
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
    return Q.locomotion(rig, CFG, name, period=0.8, stride=0.42 * K, duty=0.62, turn=turn_deg, phases=lateral(),
                        lift=(0.06 * K, 0.06 * K), pitch=(30, 26), crouch=(0.03 + abs(turn_deg) / 30 * 0.012) * K,
                        bob=0.006 * K, roll=2.0, sway=0.006 * K, neck_pump=2, neck_pitch=8, head_level=0.6, tail_amp=6,
                        tail_lift=8)


def run(rig: RigModel) -> Clip:
    # 対角の脚がそろって着くトロット（長い距離を走るときの走り方）
    trot = {'back_l': 0.0, 'front_r': 0.02, 'back_r': 0.5, 'front_l': 0.52}
    return Q.locomotion(rig, CFG, 'Run', period=0.46, stride=0.62 * K, duty=0.42, turn=0, phases=trot,
                        lift=(0.08 * K, 0.08 * K), pitch=(40, 35), crouch=0.04 * K, bob=0.01 * K, roll=1.5,
                        sway=0.005 * K, neck_pump=3, neck_pitch=10, head_level=0.7, tail_amp=5, tail_lift=-4, ear_back=12)


def turn(rig: RigModel, direction: int) -> Clip:
    return Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=0.85, stride=0.0, duty=0.66,
                        turn=75 * direction, phases=lateral(), lift=(0.05 * K, 0.05 * K), pitch=(20, 18),
                        crouch=0.025 * K, bob=0.004 * K, roll=1.5, sway=0.006 * K, neck_pump=2, neck_pitch=0,
                        head_level=0.6, tail_amp=6, tail_lift=6)


def idle_extra(p: Pose, t: float) -> None:
    # まわりのにおいをかいで、耳をぴくっと動かす
    sniff = window(t, 1.4, 2.6, 0.25)
    p.rot('neck', X, 10 * sniff)
    p.rot('head', X, 8 * sniff + 3 * sniff * math.sin(2 * math.pi * 4 * t))
    p.rot('tail_1', X, 8)


def eat(rig: RigModel) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 3.8

    def sample(t: float) -> Pose:
        p = Pose(rig)
        down = keys(t, [(0, 0), (0.7, 1), (3.0, 1), (3.6, 0)])
        chew = window(t, 0.9, 2.9, 0.1) * (0.5 + 0.5 * math.sin(2 * math.pi * 2.5 * t))
        p.move('hips', (0, 0, -0.03 * K * down))
        p.rot('spine_2', X, 8 * down)
        p.rot('neck', X, 32 * down)
        p.rot('head', X, 16 * down - 8 * chew)
        Q.ears(p, CFG, -4 * down)
        Q.tail_wave(p, CFG, t, 1.2, 10, 6)
        Q.eyes(p, 1 - 0.5 * window(t, 1.2, 2.8, 0.15))
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    p = sample(1.0)
    tip = p.posed()['head'] @ Vector((0, rig.length['head'], 0))
    return Clip('Eat', period, False, sample, {'kind': 'eat', 'food': {'bone': 'head', 'grab': 0.9, 'release': 2.8,
                                                                       'reach': round(-tip.y, 3)}})


def howl(rig: RigModel) -> Clip:
    """座って頭を高く上げ、空へ向かって「アオーン」と遠ぼえする（キツネの Howl を写す）。"""
    src = source('fox-howl.glb')
    lg, ra = Q.standing(rig, CFG)
    period = src.duration
    scale = rig.head('hips').z / FOX_HIPS_Z
    call0, call1 = period * 0.3, period * 0.75

    def sample(t: float) -> Pose:
        p = Q.retargeted(rig, src, BODY_MAP, t, hips_scale=scale)
        k = keys(t, [(0, 0), (0.25, 1), (period - 0.25, 1), (period, 0)])
        p = Q.blend(Pose(rig), p, k)
        call = window(t, call0, call1, 0.25)
        # 遠ぼえのあいだ、さらに頭を空へ向ける
        p.rot('neck', X, -10 * call)
        p.rot('head', X, -8 * call)
        Q.ears(p, CFG, -10 * call)
        Q.eyes(p, 1 - 0.6 * call)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Howl', period, False, sample, {'kind': 'special', 'sound': 'howl', 'callStart': round(call0, 3),
                                                'callEnd': round(call1, 3), 'source': 'Mesh2Motion fox/Howl (CC0)'})


def play(rig: RigModel) -> Clip:
    """前足をのばして胸を下げ、おしりを上げてしっぽをふる「あそぼう」のおじぎ。そのあと、ぴょんと2回はねる。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.6
    reach = 0.09 * K

    def sample(t: float) -> Pose:
        p = Pose(rig)
        bow = keys(t, [(0, 0), (0.45, 1), (1.6, 1), (1.9, 0.35), (2.9, 0.35), (3.4, 0)])
        # 1.9〜2.9 秒に、前足でぴょんと2回はねる
        hop = max(0.0, math.sin(2 * math.pi * (t - 1.9))) if 1.9 <= t <= 2.9 else 0.0
        p.rot('hips', X, 16 * bow - 6 * hop)
        p.move('hips', (0, 0, -0.012 * K * bow))
        p.rot('spine_1', X, 4 * bow)
        p.rot('neck', X, -24 * bow)
        p.rot('head', X, -10 * bow)
        p.rot('head', Y, 10 * window(t, 0.5, 1.6, 0.2) * math.sin(2 * math.pi * 1.2 * t))
        Q.ears(p, CFG, -12 * bow)
        Q.tail_wave(p, CFG, t, 0.32, 26 * max(bow, 0.5), 22)
        offsets = {}
        for k in lg:
            if k.startswith('front'):
                offsets[k] = Vector((0, -reach * bow, 0.07 * K * hop))
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets)
        return p

    return Clip('Play', period, False, sample, {'kind': 'special', 'sound': 'yip', 'callStart': 1.9, 'callEnd': 2.6})


def _sleep_pose(rig: RigModel) -> Pose:
    """キツネの Sleep の丸まった姿勢を写し、いちばん低い骨が地面すれすれになるよう腰の高さをそろえる。"""
    src = source('fox-sleep.glb')
    mapping = dict(BODY_MAP)
    mapping.update(LEG_MAP)
    p = Q.retargeted(rig, src, mapping, 0.0, hips_scale=rig.head('hips').z / FOX_HIPS_Z)
    leg_bones = [b for b in rig.order if '_leg_' in b]
    clearance = Q.ground_clearance(p, leg_bones + ['spine_1', 'spine_2'])
    p.move('hips', (0, 0, 0.04 - clearance))
    return p


def lie_down(rig: RigModel, reverse: bool = False) -> Clip:
    lying = _sleep_pose(rig)
    period = 2.0

    def sample(t: float) -> Pose:
        if reverse:
            t = period - t
        k = keys(t, [(0.1, 0), (period - 0.15, 1)])
        p = Q.blend(Pose(rig), lying, k)
        Q.eyes(p, 1 - 0.4 * k)
        return p

    return Clip('GetUp' if reverse else 'LieDown', period, False, sample,
                {'kind': 'sleep', 'source': 'Mesh2Motion fox/Sleep (CC0)'})


def sleep(rig: RigModel) -> Clip:
    lying = _sleep_pose(rig)
    period = 4.4

    def sample(t: float) -> Pose:
        c = t / period
        p = Q.blend(lying, lying, 0)
        breath = math.sin(2 * math.pi * c)
        p.move('hips', (0, 0, 0.007 * breath))
        p.rot('spine_1', X, -1.5 * breath)
        twitch = window(t, 2.8, 3.1, 0.08) * math.sin(2 * math.pi * 6 * t)
        Q.ears(p, CFG, 12 * twitch)
        Q.eyes(p, 0.06)
        return p

    return Clip('Sleep', period, True, sample, {'kind': 'sleep', 'source': 'Mesh2Motion fox/Sleep (CC0)'})


def happy_extra(p: Pose, t: float) -> None:
    p.rot('tail_1', X, -18 * window(t, 0.1, 1.4, 0.2))


def clips(rig: RigModel) -> list[Clip]:
    return [Q.idle(rig, CFG, extra=idle_extra), walk(rig), walk(rig, 26, 'WalkLeft'), walk(rig, -26, 'WalkRight'), run(rig),
            turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True), howl(rig),
            play(rig), Q.happy(rig, CFG, extra=happy_extra), Q.blink_clip(rig)]
