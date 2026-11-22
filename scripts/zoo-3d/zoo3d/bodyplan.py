"""体型（ボディプラン）ごとに共通するモーションの組み立て。

歩き・走り・方向転換・待機・喜ぶ・まばたき・伏せを、脚の本数と配置だけを変えて使い回す。
- quadruped: 四足（キリン・ライオン・パンダ）。脚は front_l / back_l / front_r / back_r。
- biped: 二足（ペンギン・ダチョウ・フラミンゴなど）。脚は left / right。鳥の翼は別の骨の並びとして
  固有アクション側で動かす（歩容には含めない）。
ゾウ（鼻の動きが中心）は最初の成功例として elephant_motion.py に専用実装がある。
Mesh2Motion からリターゲットした姿勢（retarget.py）とも組み合わせられる。
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable, Sequence

from mathutils import Matrix, Quaternion, Vector  # type: ignore[import-not-found]

from . import anim as A
from . import retarget as RT
from .anim import X, Y, Z, Clip, Gait, LegSpec, Pose, RigModel, blink, keys, window

LEG_KEYS = ('front_l', 'back_l', 'front_r', 'back_r')
BIPED_KEYS = ('left', 'right')

# 歩容の位相（脚が胴の真下を通る瞬間が周期のどこに来るか）。動物の歩き方に合わせて選ぶ。
GAITS = {
    # 後ろ足→同じ側の前足の順に着く4拍子（ゾウ・ライオン・パンダの常歩）
    'lateral_walk': {'back_l': 0.0, 'front_l': 0.25, 'back_r': 0.5, 'front_r': 0.75},
    # 同じ側の前後がほぼ一緒に出る側対歩（キリン・ラクダ）
    'pace': {'back_l': 0.0, 'front_l': 0.1, 'back_r': 0.5, 'front_r': 0.6},
    # 後ろ2本→前2本の順に着くギャロップ（キリン・ライオンの走り）
    'gallop': {'back_l': 0.0, 'back_r': 0.08, 'front_l': 0.45, 'front_r': 0.53},
    # 後ろ2本・前2本がほぼ同時に着くバウンド（ウサギ・リス）
    'bound': {'back_l': 0.0, 'back_r': 0.02, 'front_l': 0.5, 'front_r': 0.52},
    # 二足の歩き（左右交互）と両足跳び
    'biped_walk': {'left': 0.0, 'right': 0.5},
    'biped_hop': {'left': 0.0, 'right': 0.0},
}


@dataclass
class Config:
    neck: list[str]
    tail: list[str]
    front_pole: Vector
    hind_pole: Vector
    toe: tuple[float, float, float, float]
    """(前足のつま先の前方距離, 前足の高さ, 後ろ足の前方距離, 後ろ足の高さ)。二足は後ろ足の値を使う。"""
    head: str = 'head'
    ears: tuple[str, str] = ('ear_l', 'ear_r')
    ear_axis: Vector = field(default_factory=lambda: Vector((0, 1, 0)))
    ear_mirror: bool = True
    """左右の耳で回転の向きを反転するか（左右へ向いた軸まわりなら True）。"""
    jaw: str | None = None
    plan: str = 'quadruped'
    """'quadruped'（四足）または 'biped'（二足・鳥）。"""


def leg_keys(cfg: Config) -> tuple[str, ...]:
    return BIPED_KEYS if cfg.plan == 'biped' else LEG_KEYS


def leg_bones(cfg: Config, key: str) -> tuple[str, str, str, bool]:
    """脚の (上の骨, 下の骨, 足の骨, 前脚か)。骨の名前はリグの標準命名に従う。"""
    if cfg.plan == 'biped':
        side = 'l' if key == 'left' else 'r'
        return f'leg_upper_{side}', f'leg_lower_{side}', f'leg_foot_{side}', False
    front = key.startswith('front')
    side = key[-1]
    prefix = 'front_leg' if front else 'back_leg'
    return f'{prefix}_upper_{side}', f'{prefix}_lower_{side}', f'{prefix}_foot_{side}', front


def legs(cfg: Config, phases: dict[str, float], lift: tuple[float, float], pitch: tuple[float, float]) -> dict[str, LegSpec]:
    out = {}
    for key in leg_keys(cfg):
        upper, lower, foot, front = leg_bones(cfg, key)
        out[key] = LegSpec(upper, lower, foot, phases[key],
                           lift[0] if front else lift[1], cfg.front_pole if front else cfg.hind_pole,
                           toe=cfg.toe[0] if front else cfg.toe[2], toe_drop=cfg.toe[1] if front else cfg.toe[3],
                           swing_pitch=pitch[0] if front else pitch[1])
    return out


def rest_ankles(rig: RigModel, lg: dict[str, LegSpec]) -> dict[str, Vector]:
    return {k: rig.head(l.foot) for k, l in lg.items()}


def standing(rig: RigModel, cfg: Config):
    lg = legs(cfg, {k: 0.0 for k in leg_keys(cfg)}, (0, 0), (0, 0))
    return lg, rest_ankles(rig, lg)


def eyes(p: Pose, openness: float) -> None:
    s = max(0.06, openness) if openness < 0.999 else 1.0
    p.set_scale('eye_l', (1, 1, s)).set_scale('eye_r', (1, 1, s))


def ears(p: Pose, cfg: Config, angle: float) -> None:
    """耳を後ろへ倒す（+）・前へ向ける（-）。"""
    p.rot(cfg.ears[0], cfg.ear_axis, angle).rot(cfg.ears[1], cfg.ear_axis, -angle if cfg.ear_mirror else angle)


def tail_wave(p: Pose, cfg: Config, t: float, period: float, amp: float, lift: float = 0.0) -> None:
    p.rot(cfg.tail[0], X, lift)
    n = len(cfg.tail)
    for i, name in enumerate(cfg.tail):
        p.rot(name, Z, amp * (0.6 + 0.4 * i / max(1, n - 1)) * math.sin(2 * math.pi * (t / period - 0.13 * i)))


def locomotion(rig: RigModel, cfg: Config, name: str, *, period: float, stride: float, duty: float, turn: float,
               phases: dict[str, float], lift: tuple[float, float], pitch: tuple[float, float], crouch: float,
               bob: float, roll: float, sway: float, neck_pump: float, neck_pitch: float, head_level: float,
               tail_amp: float, tail_lift: float, ear_back: float = 0.0, spine_flex: float = 0.0,
               bob_freq: int = 2) -> Clip:
    lg = legs(cfg, phases, lift, pitch)
    gait = Gait(period=period, stride=stride, duty=duty, legs=lg, turn=turn, rest_ankles=rest_ankles(rig, lg))
    lean = max(-1.0, min(1.0, turn / 90.0))
    # 体の上下・ねじれの基準にする脚（四足は左後ろ足と左前足、二足は左足）
    hind = phases.get('back_l', phases.get('left', 0.0))
    front = phases.get('front_l', hind + 0.5)

    def sample(t: float) -> Pose:
        c = t / period
        p = Pose(rig)
        up = math.cos(2 * math.pi * bob_freq * (c - hind))
        p.move('hips', (-sway * math.cos(2 * math.pi * (c - hind - 0.5)), 0, -crouch + bob * up))
        p.rot('hips', Y, roll * math.cos(2 * math.pi * (c - hind - 0.5)))
        p.rot('hips', Z, -roll * 0.7 * math.cos(2 * math.pi * (c - hind - 0.68)) + lean * 3)
        p.rot('spine_1', X, spine_flex * math.sin(2 * math.pi * (c - hind)))
        p.rot('spine_2', X, -spine_flex * 0.6 * math.sin(2 * math.pi * (c - hind)))
        p.rot('spine_2', Y, -roll * 0.8 * math.cos(2 * math.pi * (c - front - 0.5)))
        p.rot('spine_2', Z, lean * 4)
        pump = math.sin(2 * math.pi * bob_freq * (c - hind) + 0.6)
        p.rot_chain(cfg.neck, X, neck_pitch + neck_pump * pump)
        p.rot(cfg.head, X, head_level * -neck_pump * pump - neck_pitch * 0.6)
        p.rot_chain(cfg.neck, Z, lean * 8)
        p.rot(cfg.head, Z, lean * 5)
        ears(p, cfg, ear_back)
        tail_wave(p, cfg, t, period, tail_amp, tail_lift)
        posed = p.posed()
        A.place_feet(p, posed, gait, t)
        return p

    meta = {'kind': 'locomotion', 'distancePerCycle': round(stride, 4), 'turnPerCycle': round(turn, 3), 'duty': duty}
    clip = Clip(name, period, True, sample, meta)
    clip.gait = gait
    return clip


def idle(rig: RigModel, cfg: Config, period: float = 4.0, extra: Callable[[Pose, float], None] | None = None) -> Clip:
    lg, ra = standing(rig, cfg)

    def sample(t: float) -> Pose:
        c = t / period
        p = Pose(rig)
        breath = math.sin(2 * math.pi * 2 * c)
        p.move('hips', (0.01 * math.sin(2 * math.pi * c), 0, -0.015 + 0.004 * breath))
        p.rot('hips', Y, 1.2 * math.sin(2 * math.pi * c))
        p.rot('spine_1', X, -0.8 * breath)
        p.rot_chain(cfg.neck, Z, 6 * math.sin(2 * math.pi * (c + 0.15)))
        p.rot(cfg.head, Z, 8 * math.sin(2 * math.pi * (c + 0.1)))
        p.rot(cfg.head, X, 3 * math.sin(2 * math.pi * 2 * (c + 0.2)))
        flick = 0.0
        for t0 in (0.8, 2.6):
            if t0 <= t <= t0 + 0.35:
                flick = 25 * math.sin(math.pi * (t - t0) / 0.35)
        p.rot(cfg.ears[0], cfg.ear_axis, flick)
        tail_wave(p, cfg, t, period / 2, 14, 4)
        eyes(p, blink(t, (1.2, 3.3)))
        if extra:
            extra(p, t)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Idle', period, True, sample, {'kind': 'idle'})


def happy(rig: RigModel, cfg: Config, period: float = 1.6, extra: Callable[[Pose, float], None] | None = None) -> Clip:
    lg, ra = standing(rig, cfg)

    def sample(t: float) -> Pose:
        p = Pose(rig)
        squat = keys(t, [(0, 0), (0.2, 1), (0.4, -0.2), (0.6, 0.6), (0.8, -0.1), (1.1, 0)])
        joy = window(t, 0.15, period - 0.15, 0.2)
        h = rig.head('hips').z
        p.move('hips', (0, 0, (-0.06 * squat - 0.01) * h))
        p.rot_chain(cfg.neck, X, -8 * joy)
        p.rot(cfg.head, X, -6 * joy + 4 * squat)
        p.rot(cfg.head, Y, 8 * joy * math.sin(2 * math.pi * 2 * t))
        ears(p, cfg, -15 * joy)
        tail_wave(p, cfg, t, 0.35, 25 * joy, 30 * joy)
        eyes(p, 1 - 0.7 * joy)
        if extra:
            extra(p, t)
        posed = p.posed()
        A.plant_feet(p, posed, lg, ra)
        return p

    return Clip('Happy', period, False, sample, {'kind': 'react'})


def blink_clip(rig: RigModel) -> Clip:
    def sample(t: float) -> Pose:
        p = Pose(rig)
        eyes(p, blink(t, (0.0,), 0.2))
        return p

    return Clip('Blink', 0.2, False, sample, {'kind': 'overlay', 'bones': ['eye_l', 'eye_r']})


# ---------------------------------------------------------------------------
# 姿勢の合成


def blend(a: Pose, b: Pose, k: float) -> Pose:
    """骨ごとのローカル回転を球面補間し、移動は線形に混ぜた新しい姿勢。"""
    out = Pose(a.rig)
    for name in a.rig.order:
        qa = a.basis[name].to_quaternion()
        qb = b.basis[name].to_quaternion()
        m = qa.slerp(qb, k).to_matrix().to_4x4()
        m.translation = a.basis[name].translation.lerp(b.basis[name].translation, k)
        out.basis[name] = m
    for name in set(a.scale) | set(b.scale):
        sa = a.scale.get(name, Vector((1, 1, 1)))
        sb = b.scale.get(name, Vector((1, 1, 1)))
        out.scale[name] = sa.lerp(sb, k)
    return out


def retargeted(rig: RigModel, src: RT.SourceClip, mapping: RT.Mapping, t: float, *, strength=1.0,
               hips_scale: float = 1.0, hips_offset: Sequence[float] = (0, 0, 0)) -> Pose:
    """元のクリップの時刻 t の姿勢を写した Pose（足の IK はかけない）。"""
    deltas, hips = src.at(t)
    p = Pose(rig)
    p.move('hips', Vector(hips) * hips_scale + Vector(hips_offset))
    RT.apply(p, deltas, mapping, strength)
    return p


def ground_clearance(p: Pose, bones: Sequence[str]) -> float:
    posed = p.posed()
    lows = []
    for b in bones:
        lows.append(posed[b].translation.z)
        lows.append((posed[b] @ Vector((0, p.rig.length[b], 0))).z)
    return min(lows)
