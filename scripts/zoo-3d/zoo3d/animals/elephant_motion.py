"""ゾウのモーション。

回転の向き（骨格空間）:
- X 軸 +: 前を向いた骨は先が下がる（うなずく）。垂れた鼻は後ろへ振れる（-X で前へ）。
- Z 軸 +: 左（+X）へ向く。左耳は -Z で前へ開き、右耳は +Z で開く。
- Y 軸 +: 上が左へ傾く（左側が下がる）。垂れた鼻・尾は +Y で左へ振れる。

ゾウの常歩は、同じ側の後ろ足→前足の順に着地する側対歩寄りの4拍子で、
接地時間が長く（デューティ比 0.6 以上）、脚は柱のように伸びたまま体を運ぶ。
"""

from __future__ import annotations

import math

from mathutils import Matrix, Vector  # type: ignore[import-not-found]

from .. import anim as A
from ..anim import X, Y, Z, Clip, Gait, LegSpec, Pose, RigModel, blink, keys, smoothstep, window

TRUNK = [f'trunk_{i}' for i in range(1, 8)]
TAIL = ['tail_1', 'tail_2', 'tail_3']
FRONT_POLE = Vector((0, 1, 0.2))  # ひじは後ろへ
HIND_POLE = Vector((0, -1, 0.2))  # ひざは前へ


def legs(lift_front: float, lift_hind: float, pitch_front: float = 30, pitch_hind: float = 22,
         phases=(0.25, 0.0, 0.75, 0.5)) -> dict[str, LegSpec]:
    fl, bl, fr, br = phases
    return {
        'front_l': LegSpec('front_leg_upper_l', 'front_leg_lower_l', 'front_leg_foot_l', fl, lift_front, FRONT_POLE,
                           toe=0.2, toe_drop=0.11, swing_pitch=pitch_front),
        'back_l': LegSpec('back_leg_upper_l', 'back_leg_lower_l', 'back_leg_foot_l', bl, lift_hind, HIND_POLE,
                          toe=0.18, toe_drop=0.11, swing_pitch=pitch_hind),
        'front_r': LegSpec('front_leg_upper_r', 'front_leg_lower_r', 'front_leg_foot_r', fr, lift_front, FRONT_POLE,
                           toe=0.2, toe_drop=0.11, swing_pitch=pitch_front),
        'back_r': LegSpec('back_leg_upper_r', 'back_leg_lower_r', 'back_leg_foot_r', br, lift_hind, HIND_POLE,
                          toe=0.18, toe_drop=0.11, swing_pitch=pitch_hind),
    }


def rest_ankles(rig: RigModel, legs_: dict[str, LegSpec]) -> dict[str, Vector]:
    return {k: rig.head(l.foot) for k, l in legs_.items()}


def ears(p: Pose, spread: float, tip: float = 0.0) -> None:
    """両耳を開く（+）・たたむ（-）。tip は耳先の遅れ（しなり）。"""
    p.rot('ear_l', Z, -spread).rot('ear_r', Z, spread)
    p.rot('ear_tip_l', Z, -tip).rot('ear_tip_r', Z, tip)


def eyes(p: Pose, openness: float) -> None:
    if openness < 0.999:
        s = max(0.06, openness)
        p.set_scale('eye_l', (1, 1, s)).set_scale('eye_r', (1, 1, s))
    else:
        p.set_scale('eye_l', (1, 1, 1)).set_scale('eye_r', (1, 1, 1))


def trunk_wave(p: Pose, t: float, period: float, side_amp: float, fwd_amp: float, lag: float = 0.09,
               fwd_freq: float = 1.0) -> None:
    for i, name in enumerate(TRUNK):
        k = 0.6 + 0.4 * i / (len(TRUNK) - 1)
        p.rot(name, Y, side_amp * k * math.sin(2 * math.pi * (t / period - lag * i)))
        p.rot(name, X, fwd_amp * k * math.sin(2 * math.pi * (fwd_freq * t / period - lag * i)))


def tail_wave(p: Pose, t: float, period: float, amp: float, lift: float = 0.0) -> None:
    p.rot('tail_1', X, lift)
    for i, name in enumerate(TAIL):
        p.rot(name, Z, amp * (0.7 + 0.3 * i) * math.sin(2 * math.pi * (t / period - 0.15 * i)))


# ---------------------------------------------------------------------------
# 歩き・走り・方向転換


def locomotion(rig: RigModel, name: str, period: float, stride: float, duty: float, turn: float, lift_f: float,
               lift_h: float, crouch: float, bob: float, roll: float, sway: float, head_pitch: float,
               trunk_side: float, trunk_fwd: float, trunk_raise: float, ear_spread: float, ear_flap: float,
               tail_amp: float, tail_lift: float, pitch_f: float = 30, pitch_h: float = 22) -> Clip:
    lg = legs(lift_f, lift_h, pitch_f, pitch_h)
    gait = Gait(period=period, stride=stride, duty=duty, legs=lg, turn=turn, rest_ankles=rest_ankles(rig, lg))
    lean = max(-1.0, min(1.0, turn / 90.0))

    def sample(t: float) -> Pose:
        c = t / period
        p = Pose(rig)
        # 体の上下: 後ろ足が真下を通るとき腰が、前足のとき肩が高くなる（脚を突っ張って体を運ぶ）
        hip_up = math.cos(4 * math.pi * c)
        p.move('hips', (-sway * math.cos(2 * math.pi * (c - 0.5)), 0, -crouch + bob * hip_up))
        p.rot('hips', Y, roll * math.cos(2 * math.pi * (c - 0.5)))
        p.rot('hips', Z, -roll * 0.8 * math.cos(2 * math.pi * (c - 0.68)) + lean * 3)
        p.rot('spine_1', X, -bob * 25 * hip_up)  # 肩は腰と逆位相で上下
        p.rot('spine_2', Y, roll * math.cos(2 * math.pi * (c - 0.75)) - roll * math.cos(2 * math.pi * (c - 0.5)))
        p.rot('spine_2', Z, lean * 4)
        # 首と頭: 体の揺れを打ち消しつつ、歩調に合わせて軽くうなずく
        p.rot('neck', X, head_pitch * 0.4 + bob * 30 * hip_up)
        p.rot('head', X, head_pitch * 0.6 + 2.0 * math.cos(4 * math.pi * (c - 0.3)))
        p.rot('neck', Z, lean * 5)
        p.rot('head', Z, lean * 6 + 1.5 * math.sin(2 * math.pi * (c - 0.6)))
        # 鼻: 振り子のように遅れて揺れる。trunk_raise で前へ持ち上げる
        p.rot_chain(TRUNK, X, -trunk_raise, [1.4, 1.2, 1, 1, 0.8, 0.6, 0.5])
        trunk_wave(p, t, period, trunk_side, trunk_fwd, fwd_freq=2.0)
        # 耳: 歩調に合わせてぱたぱた
        flap = math.sin(2 * math.pi * (2 * c - 0.15))
        ears(p, ear_spread + ear_flap * flap, ear_flap * 0.6 * math.sin(2 * math.pi * (2 * c - 0.3)))
        tail_wave(p, t, period, tail_amp, tail_lift)
        posed = p.posed()
        A.place_feet(p, posed, gait, t)
        return p

    meta = {'kind': 'locomotion', 'distancePerCycle': round(stride, 4), 'turnPerCycle': round(turn, 3),
            'speed': round(stride / period, 4), 'duty': duty}
    clip = Clip(name, period, True, sample, meta)
    clip.gait = gait  # QA で足の接地を検査するために保持する
    return clip


def walk(rig: RigModel, turn_deg: float = 0.0, name: str = 'Walk') -> Clip:
    """常歩。turn_deg を付けると、1周期でその角度だけ曲がりながら歩く（ゲームで直進とブレンドする）。"""
    return locomotion(rig, name, period=1.4, stride=0.9, duty=0.66, turn=turn_deg, lift_f=0.15, lift_h=0.12,
                      crouch=0.045 + abs(turn_deg) / 30 * 0.015, bob=0.014, roll=2.5, sway=0.018, head_pitch=2, trunk_side=5, trunk_fwd=3,
                      trunk_raise=0, ear_spread=2, ear_flap=5, tail_amp=10, tail_lift=5)


def run(rig: RigModel) -> Clip:
    return locomotion(rig, 'Run', period=0.72, stride=1.2, duty=0.46, turn=0, lift_f=0.24, lift_h=0.2,
                      crouch=0.07, bob=0.022, roll=2.2, sway=0.025, head_pitch=-6, trunk_side=7, trunk_fwd=6,
                      trunk_raise=35, ear_spread=10, ear_flap=13, tail_amp=14, tail_lift=35, pitch_f=40, pitch_h=30)


def turn(rig: RigModel, direction: int) -> Clip:
    name = 'TurnLeft' if direction > 0 else 'TurnRight'
    return locomotion(rig, name, period=1.5, stride=0.0, duty=0.7, turn=75 * direction, lift_f=0.13, lift_h=0.1,
                      crouch=0.03, bob=0.01, roll=2, sway=0.012, head_pitch=0, trunk_side=6, trunk_fwd=2,
                      trunk_raise=0, ear_spread=4, ear_flap=4, tail_amp=8, tail_lift=5)


# ---------------------------------------------------------------------------
# その場の動き


def standing(rig: RigModel):
    lg = legs(0, 0)
    return lg, rest_ankles(rig, lg)


def idle(rig: RigModel) -> Clip:
    lg, ra = standing(rig)
    period = 4.0

    def sample(t: float) -> Pose:
        c = t / period
        p = Pose(rig)
        breath = math.sin(2 * math.pi * 2 * c)
        p.move('hips', (0.014 * math.sin(2 * math.pi * c), 0, -0.02 + 0.006 * breath))
        p.rot('hips', Y, 1.5 * math.sin(2 * math.pi * c))
        p.rot('spine_1', X, -0.8 * breath)
        p.rot('spine_2', Y, -1.2 * math.sin(2 * math.pi * c))
        # ゆっくり見回す
        p.rot('neck', Z, 4 * math.sin(2 * math.pi * (c + 0.15)))
        p.rot('head', Z, 5 * math.sin(2 * math.pi * (c + 0.1)))
        p.rot('head', X, 2 * math.sin(2 * math.pi * 2 * (c + 0.2)))
        # 鼻: S字にゆらし、途中で一度くるっと持ち上げてにおいをかぐ
        trunk_wave(p, t, period / 2, 4, 2)
        sniff = window(t, 1.4, 2.7, 0.45)
        p.rot_chain(TRUNK, X, -55 * sniff, [0.6, 0.8, 1, 1.2, 1.3, 1.4, 1.4])
        p.rot('trunk_7', X, -20 * sniff * (0.5 + 0.5 * math.sin(2 * math.pi * 3 * t)))
        # 耳: 二度ぱたぱた、もう一度ゆっくり
        flap = 0.0
        for t0, n, amp in ((0.5, 2, 22), (2.9, 1, 16)):
            if t0 <= t <= t0 + 0.5 * n:
                flap = amp * math.sin(math.pi * (t - t0) / 0.5) ** 2
        ears(p, 2 + flap, flap * 0.5)
        tail_wave(p, t, period / 2, 16, 6)
        eyes(p, blink(t, (1.15, 3.35)))
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Idle', period, True, sample, {'kind': 'idle'})


def blink_clip(rig: RigModel) -> Clip:
    def sample(t: float) -> Pose:
        p = Pose(rig)
        eyes(p, blink(t, (0.0,), 0.2))
        return p

    return Clip('Blink', 0.2, False, sample, {'kind': 'overlay', 'bones': ['eye_l', 'eye_r']})


def eat(rig: RigModel) -> Clip:
    """鼻を地面へ伸ばして草をつかみ、口へ運んでもぐもぐ食べる。"""
    lg, ra = standing(rig)
    period = 3.6

    def sample(t: float) -> Pose:
        p = Pose(rig)
        reach = keys(t, [(0, 0), (0.75, 1), (1.15, 1), (1.6, 0)])
        lift = keys(t, [(1.15, 0), (1.75, 1), (2.85, 1), (3.5, 0)])
        grab = keys(t, [(0.75, 0), (1.0, 1), (1.6, 1), (1.8, 0)])
        chew = window(t, 1.8, 2.95, 0.15) * math.sin(2 * math.pi * 3.2 * t)
        p.move('hips', (0, -0.03 * reach, -0.03 * reach - 0.015))
        p.rot('hips', X, 2 * reach)
        p.rot('neck', X, 8 * reach - 6 * lift)
        p.rot('head', X, 10 * reach - 8 * lift + 3 * chew)
        # 伸ばす: 付け根を前へ、先を下へ伸ばす
        p.rot_chain(TRUNK, X, -30 * reach, [1.4, 1.2, 1, 0.6, 0.2, 0, 0])
        p.rot_chain(TRUNK[4:], X, 40 * reach, [1, 1, 1])
        # つかむ: 先を丸める
        p.rot_chain(TRUNK[5:], X, -45 * grab, [1, 1.2])
        # 口へ: 鼻全体を内側（後ろ上）へ巻き上げる
        p.rot_chain(TRUNK, X, 175 * lift, [0.3, 0.7, 1.0, 1.2, 1.3, 1.3, 1.1])
        trunk_wave(p, t, 1.8, 2, 1)
        ears(p, 4 + 10 * abs(chew) + 4 * lift, 4 * chew)
        tail_wave(p, t, 1.2, 14 * (0.4 + 0.6 * lift), 8)
        eyes(p, 1 - 0.55 * window(t, 1.9, 2.9, 0.12))  # おいしくて目を細める
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Eat', period, False, sample, {'kind': 'eat', 'food': {'bone': 'trunk_tip', 'grab': 1.0,
                                                                     'release': 2.0}})


def trumpet(rig: RigModel) -> Clip:
    """鼻を高く上げて「パオーン」と鳴く。片方の前足を上げる。"""
    lg, ra = standing(rig)
    period = 2.8

    def sample(t: float) -> Pose:
        p = Pose(rig)
        ready = keys(t, [(0, 0), (0.35, 1), (0.6, 0)])
        up = keys(t, [(0.35, 0), (0.85, 1), (2.0, 1), (2.65, 0)])
        call = window(t, 0.9, 1.9, 0.12)
        p.move('hips', (0, 0.04 * up, -0.03 * ready - 0.05 * up))
        p.rot('hips', X, -5 * up)
        p.rot('spine_1', X, -3 * up)
        p.rot('neck', X, 4 * ready - 10 * up)
        p.rot('head', X, 6 * ready - 14 * up + 1.5 * call * math.sin(2 * math.pi * 7 * t))
        p.rot_chain(TRUNK, X, 40 * ready, [0.2, 0.5, 1, 1.2, 1.3, 1.2, 1])
        # 付け根から前上へ持ち上げ、先は上へ反らせる
        p.rot_chain(TRUNK, X, -190 * up, [1.6, 1.3, 1.1, 1.0, 0.9, 0.8, 0.6])
        p.rot('trunk_7', X, 10 * call * math.sin(2 * math.pi * 6 * t))
        trunk_wave(p, t, 0.6, 3 * call, 0)
        ears(p, 4 + 34 * up + 8 * call * math.sin(2 * math.pi * 4 * t), 10 * up)
        tail_wave(p, t, 0.7, 18 * up, 30 * up)
        eyes(p, 1 - 0.5 * call)
        posed = p.posed()
        lifted = keys(t, [(0.45, 0), (0.95, 1), (1.95, 1), (2.5, 0)])
        offsets = {'front_l': Vector((0, -0.12 * lifted, 0.3 * lifted))}
        rots = {'front_l': Matrix.Rotation(math.radians(30 * lifted), 3, 'X')}
        A.plant_feet(p, posed, lg, ra, offsets, rots)
        return p

    return Clip('Trumpet', period, False, sample, {'kind': 'special', 'sound': 'trumpet', 'callStart': 0.9,
                                                   'callEnd': 1.9})


def bath(rig: RigModel) -> Clip:
    """鼻で水を吸い、頭の上から背中へシャワーのように吹きかける。"""
    lg, ra = standing(rig)
    period = 4.0

    def sample(t: float) -> Pose:
        p = Pose(rig)
        reach = keys(t, [(0, 0), (0.7, 1), (1.3, 1), (1.8, 0)])
        suck = window(t, 0.7, 1.3, 0.1) * math.sin(2 * math.pi * 4 * t)
        up = keys(t, [(1.3, 0), (2.0, 1), (3.1, 1), (3.8, 0)])
        spray = window(t, 2.0, 3.0, 0.1)
        p.move('hips', (0, 0, -0.03 * reach - 0.02 - 0.015 * up))
        p.rot('neck', X, 8 * reach - 8 * up)
        p.rot('head', X, 10 * reach - 14 * up)
        p.rot_chain(TRUNK, X, -30 * reach, [1.4, 1.2, 1, 0.6, 0.2, 0, 0])
        p.rot_chain(TRUNK[4:], X, 40 * reach, [1, 1, 1])
        p.rot('trunk_7', X, 8 * suck)
        # 頭の上を越えて後ろへ向ける
        p.rot_chain(TRUNK, X, -235 * up, [1.6, 1.4, 1.2, 1.0, 0.8, 0.6, 0.4])
        trunk_wave(p, t, 0.5, 6 * spray, 0)
        p.rot_chain(TRUNK, Z, 12 * spray * math.sin(2 * math.pi * 1.0 * (t - 2.0)), [0.5, 1, 1, 1, 1, 1, 1])
        ears(p, 4 + 12 * spray + 6 * spray * math.sin(2 * math.pi * 5 * t), 6 * spray)
        tail_wave(p, t, 0.6, 20 * spray, 20 * spray)
        eyes(p, 1 - 0.85 * spray)  # 気持ちよくて目をつぶる
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Bath', period, False, sample, {'kind': 'special', 'effect': 'water', 'bone': 'trunk_tip',
                                                'sprayStart': 2.0, 'sprayEnd': 3.0})


def happy(rig: RigModel) -> Clip:
    """うれしい反応: ぴょこっとはずみ、耳をぱたぱた、鼻をくるん。"""
    lg, ra = standing(rig)
    period = 1.6

    def sample(t: float) -> Pose:
        p = Pose(rig)
        squat = keys(t, [(0, 0), (0.2, 1), (0.4, -0.2), (0.6, 0.6), (0.8, -0.1), (1.1, 0)])
        joy = window(t, 0.15, 1.45, 0.2)
        p.move('hips', (0, 0, -0.07 * squat - 0.01))
        p.rot('hips', X, -3 * squat)
        p.rot('neck', X, -6 * joy)
        p.rot('head', X, -6 * joy + 4 * squat)
        p.rot('head', Y, 6 * joy * math.sin(2 * math.pi * 2 * t))
        p.rot_chain(TRUNK, X, -120 * joy, [0.8, 1, 1.1, 1.2, 1.3, 1.4, 1.5])
        trunk_wave(p, t, 0.5, 8 * joy, 0)
        ears(p, 6 + 20 * joy * abs(math.sin(2 * math.pi * 3 * t)), 8 * joy)
        tail_wave(p, t, 0.35, 22 * joy, 25 * joy)
        eyes(p, 1 - 0.7 * joy)  # にっこり
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Happy', period, False, sample, {'kind': 'react'})


# ---------------------------------------------------------------------------
# ねる


LYING_POLES = {'front_l': Vector((0, 0.35, -1)), 'front_r': Vector((0, 0.35, -1)),
               'back_l': Vector((0, -1, -0.4)), 'back_r': Vector((0, -1, -0.4))}


def _lying(p: Pose, rig: RigModel, k: float, hind_k: float, front_k: float, lg: dict) -> dict:
    """伏せ姿勢へ k（0=立つ, 1=伏せ）だけ近づける。

    前脚は前へ投げ出して足の裏を見せ、後ろ脚は体の下へ折りたたむ（スフィンクスのような伏せ）。
    鼻は地面に沿わせて前へ伸ばし、先を少し丸める。
    """
    p.move('hips', (0, 0.05 * k, -0.47 * k))
    p.rot('hips', X, 5 * (hind_k - front_k))
    p.rot('neck', X, 4 * k)
    p.rot('head', X, 2 * k)
    p.rot_chain(TRUNK, X, -38 * front_k, [1.2, 1.0, 0.8, 0, 0, 0, 0])
    p.rot_chain(TRUNK, X, -58 * front_k, [0, 0, 0, 1.0, 1.0, 0.8, 0.6])
    p.rot('trunk_7', X, -35 * front_k)
    offsets = {
        'back_l': Vector((0.05 * hind_k, 0.3 * hind_k, -0.03 * hind_k)),
        'back_r': Vector((-0.05 * hind_k, 0.3 * hind_k, -0.03 * hind_k)),
        'front_l': Vector((0.03 * front_k, -0.46 * front_k, -0.03 * front_k)),
        'front_r': Vector((-0.03 * front_k, -0.46 * front_k, -0.03 * front_k)),
    }
    rots = {key: Matrix.Rotation(math.radians(-62 * front_k), 3, 'X') for key in ('front_l', 'front_r')}
    rots.update({key: Matrix.Rotation(math.radians(-75 * hind_k), 3, 'X') for key in ('back_l', 'back_r')})
    # 膝・ひじの向きを、立ち姿勢の向きから伏せ用の向きへ連続的に切り替える
    legs_ = {}
    for key, leg in lg.items():
        w = front_k if key.startswith('front') else hind_k
        pole = leg.pole.lerp(LYING_POLES[key], w)
        legs_[key] = LegSpec(leg.upper, leg.lower, leg.foot, leg.phase, leg.lift, pole)
    return {'offsets': offsets, 'rots': rots, 'legs': legs_}


def lie_down(rig: RigModel, reverse: bool = False) -> Clip:
    lg, ra = standing(rig)
    period = 2.4

    def sample(t: float) -> Pose:
        if reverse:
            t = period - t
        p = Pose(rig)
        hind_k = keys(t, [(0.0, 0), (1.3, 1)])
        front_k = keys(t, [(0.7, 0), (2.2, 1)])
        k = 0.5 * (hind_k + front_k)
        legs_ = _lying(p, rig, k, hind_k, front_k, lg)
        ears(p, 2 - 6 * k, 0)
        tail_wave(p, t, 1.2, 8 * (1 - k), 0)
        eyes(p, 1 - 0.4 * k)
        posed = p.posed()
        A.plant_feet(p, posed, legs_['legs'], ra, legs_['offsets'], legs_['rots'])
        return p

    return Clip('GetUp' if reverse else 'LieDown', period, False, sample, {'kind': 'sleep'})


def sleep(rig: RigModel) -> Clip:
    lg, ra = standing(rig)
    period = 4.0

    def sample(t: float) -> Pose:
        c = t / period
        p = Pose(rig)
        legs_ = _lying(p, rig, 1, 1, 1, lg)
        breath = math.sin(2 * math.pi * c)
        p.move('hips', (0, 0, 0.012 * breath))
        p.rot('spine_1', X, -1.2 * breath)
        p.rot('head', X, 1.5 * breath)
        p.rot_chain(TRUNK[3:], Z, 8 * math.sin(2 * math.pi * c), [1, 1, 1, 1])
        twitch = window(t, 2.6, 3.0, 0.12) * math.sin(2 * math.pi * 5 * t)
        ears(p, -4 + 8 * twitch, 0)
        eyes(p, 0.06)
        posed = p.posed()
        A.plant_feet(p, posed, legs_['legs'], ra, legs_['offsets'], legs_['rots'])
        return p

    return Clip('Sleep', period, True, sample, {'kind': 'sleep'})


def clips(rig: RigModel) -> list[Clip]:
    return [idle(rig), walk(rig), walk(rig, 30, 'WalkLeft'), walk(rig, -30, 'WalkRight'), run(rig), turn(rig, 1),
            turn(rig, -1), eat(rig), lie_down(rig), sleep(rig),
            lie_down(rig, reverse=True), trumpet(rig), bath(rig), happy(rig), blink_clip(rig)]
