# tiger から作成した fox の土台。形・色・骨・動きを個別仕様に合わせて書き換える。
# lion から作成した tiger の土台。形・色・骨・動きを個別仕様に合わせて書き換える。
"""キツネのモーション。

- 歩き: 後ろ足→同じ側の前足の順に着く4拍子。大きなしっぽを水平にのばして軽やかに歩く。
- 走り: 対角の脚がそろって着く速足（トロット）。キツネらしく、とことこ長い距離を走る。
- 食べる: 頭を下げて、地面のえさをくわえて食べる。
- ねる: Mesh2Motion のキツネ「Sleep」（CC0）をそのまま写し、しっぽを体に巻いて丸くなる。
- ぴょーん: 耳をすませてから高く跳び上がり、鼻から地面へ飛びこむ（雪の下のネズミをとる狩り）。
- コーン: Mesh2Motion のキツネ「Howl」（CC0）を写し、座って空へ向かって鳴く。
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
               toe=(0.09, 0.02, 0.11, 0.1), ear_axis=Vector((1, 0, 0)), ear_mirror=False)

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
    return Q.locomotion(rig, CFG, name, period=0.7, stride=0.42, duty=0.62, turn=turn_deg, phases=lateral(),
                        lift=(0.06, 0.06), pitch=(30, 26), crouch=0.03 + abs(turn_deg) / 30 * 0.012, bob=0.006,
                        roll=2.0, sway=0.006, neck_pump=2, neck_pitch=4, head_level=0.6, tail_amp=8, tail_lift=-12)


def run(rig: RigModel) -> Clip:
    # 対角の脚がそろって着くトロット
    trot = {'back_l': 0.0, 'front_r': 0.02, 'back_r': 0.5, 'front_l': 0.52}
    return Q.locomotion(rig, CFG, 'Run', period=0.4, stride=0.62, duty=0.42, turn=0, phases=trot,
                        lift=(0.08, 0.08), pitch=(40, 35), crouch=0.04, bob=0.012, roll=1.5, sway=0.005,
                        neck_pump=3, neck_pitch=6, head_level=0.7, tail_amp=6, tail_lift=-10, ear_back=10)


def turn(rig: RigModel, direction: int) -> Clip:
    return Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=0.75, stride=0.0, duty=0.66,
                        turn=80 * direction, phases=lateral(), lift=(0.05, 0.05), pitch=(20, 18), crouch=0.025,
                        bob=0.004, roll=1.5, sway=0.006, neck_pump=2, neck_pitch=0, head_level=0.6, tail_amp=8,
                        tail_lift=-10)


def idle_extra(p: Pose, t: float) -> None:
    # 首をかしげて耳をすませ、しっぽをゆらす
    p.rot('head', Vector((0, 1, 0)), 18 * window(t, 1.6, 2.6, 0.25))
    p.rot('tail_1', X, -10)


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
        p.rot('head', X, 18 * down - 6 * chew)
        Q.ears(p, CFG, -6 * down)
        Q.tail_wave(p, CFG, t, 1.0, 16, 4)
        Q.eyes(p, 1 - 0.5 * window(t, 1.2, 2.6, 0.15))
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    p = sample(1.0)
    tip = p.posed()['head'] @ Vector((0, rig.length['head'], 0))
    return Clip('Eat', period, False, sample, {'kind': 'eat', 'food': {'bone': 'head', 'grab': 0.9, 'release': 2.6,
                                                                       'reach': round(-tip.y, 3)}})


def howl(rig: RigModel) -> Clip:
    """座って頭を上げ、空へ向かって「コーン」と鳴く（キツネの Howl をそのまま写す）。"""
    src = source('fox-howl.glb')
    lg, ra = Q.standing(rig, CFG)
    period = src.duration
    scale = rig.head('hips').z / FOX_HIPS_Z
    call0, call1 = period * 0.3, period * 0.72

    def sample(t: float) -> Pose:
        p = Q.retargeted(rig, src, BODY_MAP, t, hips_scale=scale)
        k = keys(t, [(0, 0), (0.25, 1), (period - 0.25, 1), (period, 0)])
        p = Q.blend(Pose(rig), p, k)
        call = window(t, call0, call1, 0.2)
        p.rot('head', Y, 5 * call * math.sin(2 * math.pi * 6 * t))
        Q.ears(p, CFG, -15 * call)
        Q.eyes(p, 1 - 0.55 * call)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Howl', period, False, sample, {'kind': 'special', 'sound': 'kon', 'callStart': round(call0, 3),
                                                'callEnd': round(call1, 3), 'source': 'Mesh2Motion fox/Howl (CC0)'})


def _sleep_pose(rig: RigModel) -> Pose:
    """キツネの Sleep の丸まった姿勢を写し、いちばん低い骨が地面すれすれになるよう腰の高さをそろえる。"""
    src = source('fox-sleep.glb')
    mapping = dict(BODY_MAP)
    mapping.update(LEG_MAP)
    p = Q.retargeted(rig, src, mapping, 0.0, hips_scale=rig.head('hips').z / FOX_HIPS_Z)
    leg_bones = [b for b in rig.order if '_leg_' in b]
    clearance = Q.ground_clearance(p, leg_bones + ['spine_1', 'spine_2'])
    p.move('hips', (0, 0, 0.03 - clearance))
    return p


def lie_down(rig: RigModel, reverse: bool = False) -> Clip:
    lying = _sleep_pose(rig)
    period = 1.8

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
    period = 4.0

    def sample(t: float) -> Pose:
        c = t / period
        p = Q.blend(lying, lying, 0)
        breath = math.sin(2 * math.pi * c)
        p.move('hips', (0, 0, 0.006 * breath))
        p.rot('spine_1', X, -1.5 * breath)
        twitch = window(t, 2.6, 2.9, 0.08) * math.sin(2 * math.pi * 6 * t)
        Q.ears(p, CFG, 15 * twitch)
        Q.eyes(p, 0.06)
        return p

    return Clip('Sleep', period, True, sample, {'kind': 'sleep', 'source': 'Mesh2Motion fox/Sleep (CC0)'})


def pounce(rig: RigModel) -> Clip:
    """耳をすませてから高く跳び上がり、鼻から地面へ飛びこむ（雪の下のネズミをとる狩り）。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.4
    t0, t1 = 1.4, 2.1

    def sample(t: float) -> Pose:
        p = Pose(rig)
        listen = window(t, 0.2, 1.4, 0.2)
        crouch = window(t, 1.0, 1.45, 0.15)
        s = min(1.0, max(0.0, (t - t0) / (t1 - t0)))
        air = math.sin(math.pi * s) * 0.38 if t0 <= t <= t1 else 0.0
        dive = keys(t, [(t0 + 0.2, 0), (t1, 1), (2.7, 1), (3.2, 0)])
        p.move('hips', (0, 0, air - 0.05 * crouch))
        # 空中で体を前へ倒し、鼻先から着地する
        p.rot('hips', X, -25 * (1 - s) * (air > 0) + 35 * dive)
        p.rot('neck', X, -10 * listen + 20 * dive)
        p.rot('head', Vector((0, 1, 0)), 20 * listen * math.sin(2 * math.pi * 0.8 * t))
        p.rot('head', X, 15 * dive)
        Q.ears(p, CFG, -15 * listen)
        Q.tail_wave(p, CFG, t, 0.5, 10, -20 * (air > 0) + 25 * dive)
        Q.eyes(p, 1 - 0.6 * dive)
        tuck = min(1.0, air / 0.15)
        offsets = {k: Vector((0, 0, air + 0.08 * tuck)) for k in lg}
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra, offsets)
        return p

    return Clip('Pounce', period, False, sample, {'kind': 'special'})


def happy_extra(p: Pose, t: float) -> None:
    p.rot('tail_1', X, -15 * window(t, 0.1, 1.4, 0.2))


def clips(rig: RigModel) -> list[Clip]:
    return [Q.idle(rig, CFG, extra=idle_extra), walk(rig), walk(rig, 28, 'WalkLeft'), walk(rig, -28, 'WalkRight'), run(rig),
            turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True), howl(rig),
            pounce(rig), Q.happy(rig, CFG, extra=happy_extra), Q.blink_clip(rig)]
