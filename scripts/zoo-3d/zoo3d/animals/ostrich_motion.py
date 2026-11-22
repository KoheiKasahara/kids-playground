# flamingo から作成した ostrich の土台。形・色・骨・動きを個別仕様に合わせて書き換える。
"""ダチョウのモーション（二足・鳥）。

- 歩き: 太い脚で大またに歩く（`biped_walk`）。一歩ごとに首を前へ突き出す。
- 走り: 体を前へ倒し、首をのばして大きな歩幅で走る（鳥でいちばん速い）。
- 食べる: 首を下げて、地面の葉っぱをついばむ。
- ねる: 脚をたたんで座りこみ、首を前へのばして頭を下げる。
- ダンス: 白い羽を広げて左右に交互にふり、体と首をくねらせる（求愛のダンス）。
- みはり: 首をぐーんと上へのばして、あたりをきょろきょろ見回す。
"""

from __future__ import annotations

import math

from mathutils import Matrix, Vector  # type: ignore[import-not-found]

from .. import anim as A
from .. import bodyplan as Q
from ..anim import X, Y, Z, Clip, Pose, RigModel, keys, window

NECK = ['neck_1', 'neck_2', 'neck_3']
CFG = Q.Config(neck=NECK, tail=['tail_1'], front_pole=Vector((0, 1, 0.1)), hind_pole=Vector((0, 1, 0.1)),
               toe=(0.17, 0.02, 0.17, 0.02), ears=('wing_l', 'wing_r'), ear_axis=Vector((0, 0, -1)),
               plan='biped')


def spread(p: Pose, k: float, flap: float = 0.0) -> None:
    """翼（白い羽）を横へ広げて持ち上げる（k=1 で全開）。"""
    p.rot('wing_l', Z, -70 * k).rot('wing_l', Y, -(30 + flap) * k)
    p.rot('wing_r', Z, 70 * k).rot('wing_r', Y, (30 + flap) * k)


def _with_extra(clip: Clip, extra) -> Clip:
    base = clip.sample

    def sample(t: float) -> Pose:
        p = base(t)
        extra(p, t)
        return p

    out = Clip(clip.name, clip.duration, clip.loop, sample, clip.meta)
    out.gait = clip.gait
    return out


def head_bob(p: Pose, t: float, period: float, amount: float) -> None:
    """一歩ごとに首を前へ突き出して戻す。"""
    c = (t / period) % 0.5 * 2
    push = math.sin(math.pi * c) ** 2
    p.rot('neck_1', X, 6 * amount * push)
    p.rot('neck_3', X, -10 * amount * push)
    p.rot('head', X, 4 * amount * push)


def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    period = 1.0
    clip = Q.locomotion(rig, CFG, name, period=period, stride=0.9, duty=0.6, turn=turn_deg,
                        phases=Q.GAITS['biped_walk'], lift=(0.16, 0.16), pitch=(30, 30),
                        crouch=0.05 + abs(turn_deg) / 30 * 0.015, bob=0.015, roll=3.0, sway=0.02, neck_pump=0,
                        neck_pitch=0, head_level=0.0, tail_amp=6, tail_lift=0)
    return _with_extra(clip, lambda p, t: head_bob(p, t, period, 0.8))


def run(rig: RigModel) -> Clip:
    period = 0.5
    clip = Q.locomotion(rig, CFG, 'Run', period=period, stride=1.9, duty=0.36, turn=0, phases=Q.GAITS['biped_walk'],
                        lift=(0.26, 0.26), pitch=(40, 40), crouch=0.1, bob=0.03, roll=2, sway=0.01, neck_pump=0,
                        neck_pitch=0, head_level=0.0, tail_amp=4, tail_lift=0)

    def extra(p: Pose, t: float) -> None:
        p.rot('spine_1', X, 14)
        p.rot('neck_1', X, 24).rot('neck_2', X, -6).rot('neck_3', X, -10)
        spread(p, 0.3, 10 * math.sin(2 * math.pi * 2 * t / period))

    return _with_extra(clip, extra)


def turn(rig: RigModel, direction: int) -> Clip:
    period = 1.0
    clip = Q.locomotion(rig, CFG, 'TurnLeft' if direction > 0 else 'TurnRight', period=period, stride=0.0, duty=0.65,
                        turn=80 * direction, phases=Q.GAITS['biped_walk'], lift=(0.12, 0.12), pitch=(20, 20),
                        crouch=0.05, bob=0.008, roll=2, sway=0.012, neck_pump=0, neck_pitch=0, head_level=0.0,
                        tail_amp=4, tail_lift=0)
    return _with_extra(clip, lambda p, t: head_bob(p, t, period, 0.5))


def idle_extra(p: Pose, t: float) -> None:
    # 首をかしげて、大きな目できょろきょろ
    p.rot('head', Y, 16 * window(t, 0.6, 1.4, 0.2))
    p.rot('neck_3', Z, 30 * window(t, 2.0, 2.8, 0.2) - 30 * window(t, 3.0, 3.8, 0.2))


def eat(rig: RigModel) -> Clip:
    """首を下げて頭を地面へ。くちばしを左右にふって、水の中のエビをすくう。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.8

    def sample(t: float) -> Pose:
        p = Pose(rig)
        down = keys(t, [(0, 0), (0.8, 1), (3.0, 1), (3.7, 0)])
        sweep = window(t, 0.9, 2.9, 0.2) * math.sin(2 * math.pi * 1.5 * t)
        peck = window(t, 0.9, 2.9, 0.15) * max(0.0, math.sin(2 * math.pi * 2 * t))
        p.move('hips', (0, 0.02 * down, -0.05 * down))
        p.rot('hips', X, 25 * down)
        p.rot('neck_1', X, 50 * down).rot('neck_2', X, 30 * down).rot('neck_3', X, 20 * down + 8 * peck)
        p.rot('head', X, 25 * down + 10 * peck)
        p.rot('neck_3', Z, 10 * sweep)
        spread(p, 0.08 * down)
        Q.eyes(p, 1 - 0.4 * window(t, 1.2, 2.8, 0.15))
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    p = sample(1.5)
    tip = p.posed()['head'] @ Vector((0, rig.length['head'], 0))
    return Clip('Eat', period, False, sample, {'kind': 'eat', 'food': {'bone': 'head', 'grab': 1.0, 'release': 2.8,
                                                                       'reach': round(-tip.y, 3)}})


def _sit(p: Pose, k: float) -> None:
    """脚をたたんで座りこみ、首を前へのばして頭を下げる。"""
    p.move('hips', (0, 0.06 * k, -0.62 * k))
    p.rot('hips', X, 6 * k)
    p.rot('neck_1', X, 30 * k).rot('neck_2', X, 20 * k).rot('neck_3', X, 10 * k)
    p.rot('head', X, 20 * k)
    spread(p, 0.1 * k)


def lie_down(rig: RigModel, reverse: bool = False) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 1.8

    def sample(t: float) -> Pose:
        if reverse:
            t = period - t
        k = keys(t, [(0.05, 0), (1.7, 1)])
        p = Pose(rig)
        _sit(p, k)
        Q.eyes(p, 1 - 0.4 * k)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('GetUp' if reverse else 'LieDown', period, False, sample, {'kind': 'sleep'})


def sleep(rig: RigModel) -> Clip:
    lg, ra = Q.standing(rig, CFG)
    period = 4.0

    def sample(t: float) -> Pose:
        c = t / period
        p = Pose(rig)
        _sit(p, 1)
        breath = math.sin(2 * math.pi * c)
        p.move('hips', (0, 0, 0.008 * breath))
        p.rot('spine_1', X, -1.5 * breath)
        p.rot('head', X, 4 * breath)
        Q.eyes(p, 0.06)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Sleep', period, True, sample, {'kind': 'sleep'})


def dance(rig: RigModel) -> Clip:
    """白い羽を広げて左右に交互にふり、体と首をくねらせる（求愛のダンス）。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.4

    def sample(t: float) -> Pose:
        p = Pose(rig)
        k = keys(t, [(0.1, 0), (0.6, 1), (2.8, 1), (3.3, 0)])
        w = math.sin(2 * math.pi * 1.4 * t)
        p.move('hips', (0, 0, -0.12 * k))
        p.rot('hips', Y, 8 * k * w)
        p.rot('neck_1', Z, 25 * k * w).rot('neck_2', Z, -30 * k * w).rot('neck_3', Z, 20 * k * w)
        p.rot('neck_1', X, 10 * k)
        p.rot('wing_l', Z, -(50 + 25 * w) * k).rot('wing_l', Y, -(30 + 20 * w) * k)
        p.rot('wing_r', Z, (50 - 25 * w) * k).rot('wing_r', Y, (30 - 20 * w) * k)
        Q.eyes(p, 1 - 0.5 * k)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Dance', period, False, sample, {'kind': 'special', 'sound': 'honk', 'callStart': 0.8,
                                                 'callEnd': 2.4})


def lookout(rig: RigModel) -> Clip:
    """首をぐーんと上へのばして、あたりをきょろきょろ見回す。"""
    lg, ra = Q.standing(rig, CFG)
    period = 3.4

    def sample(t: float) -> Pose:
        p = Pose(rig)
        up = keys(t, [(0.1, 0), (0.7, 1), (2.7, 1), (3.3, 0)])
        look = window(t, 0.8, 2.6, 0.2)
        p.move('hips', (0, 0, 0.03 * up))
        p.rot('neck_1', X, -14 * up).rot('neck_2', X, 10 * up).rot('neck_3', X, -8 * up)
        p.rot('head', X, 6 * up)
        p.rot('neck_3', Z, 45 * look * math.sin(2 * math.pi * 0.6 * (t - 0.8)))
        p.rot('head', Z, 25 * look * math.sin(2 * math.pi * 0.6 * (t - 0.9)))
        Q.eyes(p, 1.0)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Lookout', period, False, sample, {'kind': 'special'})


def happy_extra(p: Pose, t: float) -> None:
    spread(p, 0.4 * window(t, 0.1, 1.4, 0.2), 15 * math.sin(2 * math.pi * 3 * t))


def clips(rig: RigModel) -> list[Clip]:
    return [Q.idle(rig, CFG, extra=idle_extra), walk(rig), walk(rig, 26, 'WalkLeft'), walk(rig, -26, 'WalkRight'),
            run(rig), turn(rig, 1), turn(rig, -1), eat(rig), lie_down(rig), sleep(rig), lie_down(rig, reverse=True),
            dance(rig), lookout(rig), Q.happy(rig, CFG, extra=happy_extra), Q.blink_clip(rig)]
