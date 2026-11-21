"""手続き的なモーション制作の土台。

- RigModel: 骨格の休止姿勢を読み、順運動学（FK）で各骨の姿勢を計算する。
- Pose: 骨ごとのローカル回転・移動を「骨格空間の軸まわりの回転」で組み立てる。
- leg_ik: 2本骨の解析 IK。足首の目標位置と膝の向きから脚の回転を求める。
- Gait: 歩容（各脚の位相・接地率・歩幅・旋回量）から、足首の軌道を求める。
  接地中の足は地面に対して静止し、遊脚の水平移動も地面基準でイーズするため、
  ゲーム側が「1周あたりの移動量」に合わせて速度を同期すれば足は滑らない。
- bake_clip: 時刻→姿勢の関数を毎フレーム評価し、Blender のアクションへ書き込む。
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable, Iterable, Sequence

import bpy  # type: ignore[import-not-found]
from mathutils import Matrix, Quaternion, Vector  # type: ignore[import-not-found]

FPS = 30
X = Vector((1, 0, 0))
Y = Vector((0, 1, 0))
Z = Vector((0, 0, 1))


# ---------------------------------------------------------------------------
# 補間関数


def smoothstep(x: float) -> float:
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def smootherstep(x: float) -> float:
    x = min(max(x, 0.0), 1.0)
    return x * x * x * (x * (x * 6 - 15) + 10)


def window(t: float, start: float, end: float, fade: float) -> float:
    """start〜end の間 1、前後 fade 秒でなめらかに 0 へ落ちる重み。"""
    if t < start or t > end:
        return 0.0
    a = smoothstep((t - start) / fade) if fade > 0 else 1.0
    b = smoothstep((end - t) / fade) if fade > 0 else 1.0
    return min(a, b)


def keys(t: float, points: Sequence[tuple[float, float]], ease: Callable[[float], float] = smootherstep) -> float:
    """(時刻, 値) の列をイーズ付きでつなぐ。範囲外は端の値。"""
    if t <= points[0][0]:
        return points[0][1]
    for (t0, v0), (t1, v1) in zip(points, points[1:]):
        if t <= t1:
            return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0)) if t1 > t0 else v1
    return points[-1][1]


def blink(t: float, at: Iterable[float], length: float = 0.18) -> float:
    """まばたきの開き具合（1=開く, 0.08=閉じる）。"""
    v = 1.0
    for t0 in at:
        x = (t - t0) / length
        if 0 <= x <= 1:
            v = min(v, 1 - 0.92 * math.sin(math.pi * x))
    return v


# ---------------------------------------------------------------------------
# 骨格


class RigModel:
    def __init__(self, armature: bpy.types.Object):
        self.arm = armature
        bones = armature.data.bones
        self.rest: dict[str, Matrix] = {b.name: b.matrix_local.copy() for b in bones}
        self.parent: dict[str, str | None] = {b.name: (b.parent.name if b.parent else None) for b in bones}
        self.length: dict[str, float] = {b.name: b.length for b in bones}
        self.order: list[str] = []
        seen: set[str] = set()

        def visit(name: str) -> None:
            if name in seen:
                return
            p = self.parent[name]
            if p:
                visit(p)
            seen.add(name)
            self.order.append(name)

        for b in bones:
            visit(b.name)
        self.rest_rel: dict[str, Matrix] = {}
        for name in self.order:
            p = self.parent[name]
            self.rest_rel[name] = (self.rest[p].inverted() @ self.rest[name]) if p else self.rest[name].copy()

    def head(self, name: str) -> Vector:
        return self.rest[name].translation.copy()

    def tail(self, name: str) -> Vector:
        return (self.rest[name] @ Vector((0, self.length[name], 0)))

    def fk(self, basis: dict[str, Matrix]) -> dict[str, Matrix]:
        posed: dict[str, Matrix] = {}
        for name in self.order:
            p = self.parent[name]
            m = self.rest_rel[name] @ basis[name]
            posed[name] = posed[p] @ m if p else m
        return posed


class Pose:
    """骨ごとのローカル変換。回転は「休止姿勢での骨格空間の軸」まわりで指定する。"""

    def __init__(self, rig: RigModel):
        self.rig = rig
        self.basis: dict[str, Matrix] = {n: Matrix.Identity(4) for n in rig.order}
        self.scale: dict[str, Vector] = {}

    def rot(self, name: str, axis: Vector | Sequence[float], degrees: float) -> 'Pose':
        if abs(degrees) < 1e-6:
            return self
        r = self.rig.rest[name].to_3x3()
        q = Quaternion(Vector(axis).normalized(), math.radians(degrees)).to_matrix()
        local = (r.inverted() @ q @ r).to_4x4()
        b = self.basis[name]
        t = b.translation.copy()
        nb = local @ b.to_3x3().to_4x4()
        nb.translation = t
        self.basis[name] = nb
        return self

    def rot_chain(self, names: Sequence[str], axis: Vector | Sequence[float], degrees: float,
                  weights: Sequence[float] | None = None) -> 'Pose':
        """鼻・首・尾のような骨の並びに回転を配分する（合計がおよそ degrees になる）。"""
        weights = weights or [1.0] * len(names)
        total = sum(weights)
        for n, w in zip(names, weights):
            self.rot(n, axis, degrees * w / total)
        return self

    def move(self, name: str, offset: Vector | Sequence[float]) -> 'Pose':
        r = self.rig.rest[name].to_3x3()
        local = r.inverted() @ Vector(offset)
        self.basis[name].translation += local
        return self

    def set_scale(self, name: str, s: Sequence[float]) -> 'Pose':
        self.scale[name] = Vector(s)
        return self

    def posed(self) -> dict[str, Matrix]:
        return self.rig.fk(self.basis)


def _frame_from(y: Vector, x_hint: Vector, origin: Vector) -> Matrix:
    y = y.normalized()
    x = x_hint - y * x_hint.dot(y)
    if x.length < 1e-6:
        x = Z.cross(y)
    x.normalize()
    z = x.cross(y)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = origin
    return m


def leg_ik(pose: Pose, posed: dict[str, Matrix], upper: str, lower: str, foot: str, ankle: Vector, pole: Vector,
           foot_rot: Matrix | None = None) -> None:
    """2本骨 IK。ankle は足首（lower の終点＝foot の始点）の目標位置、pole は中間関節を押し出す向き。

    foot_rot は足先の向き（骨格空間での休止姿勢からの回転）。None なら休止姿勢と同じ向き。
    pose.basis と posed をその場で更新する。
    """
    rig = pose.rig
    p_up = rig.parent[upper]
    parent_m = posed[p_up] if p_up else Matrix.Identity(4)
    h = (parent_m @ rig.rest_rel[upper]).translation
    l1 = (rig.head(lower) - rig.head(upper)).length
    l2 = (rig.head(foot) - rig.head(lower)).length
    d_vec = ankle - h
    d = min(max(d_vec.length, abs(l1 - l2) + 1e-4), (l1 + l2) * 0.9995)
    u = d_vec.normalized()
    v = pole - u * pole.dot(u)
    if v.length < 1e-6:
        v = Y.cross(u)
    v.normalize()
    cos_a = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
    sin_a = math.sqrt(max(0.0, 1 - cos_a * cos_a))
    knee = h + (u * cos_a + v * sin_a) * l1
    target = h + u * d
    # 曲げる面の法線を、休止姿勢の X（左右）に近い向きで取る
    lateral_rest = parent_m.to_3x3() @ (rig.rest_rel[upper].to_3x3() @ X)
    n = u.cross(v)
    if n.dot(lateral_rest) < 0:
        n = -n
    # 休止姿勢で骨の X が左右からずれている分（骨のひねり）を保つため、休止時の X を回して使う
    m_up = _frame_from(knee - h, n, h)
    m_lo = _frame_from(target - knee, n, knee)
    # 骨の長さ方向の誤差は無視し、関節位置は休止姿勢の長さで決める
    base_up = parent_m @ rig.rest_rel[upper]
    pose.basis[upper] = base_up.inverted() @ m_up
    pose.basis[upper].translation = Vector((0, 0, 0))
    posed[upper] = base_up @ pose.basis[upper]
    base_lo = posed[upper] @ rig.rest_rel[lower]
    pose.basis[lower] = base_lo.inverted() @ m_lo
    pose.basis[lower].translation = Vector((0, 0, 0))
    posed[lower] = base_lo @ pose.basis[lower]
    base_ft = posed[lower] @ rig.rest_rel[foot]
    want = (foot_rot or Matrix.Identity(3)) @ rig.rest[foot].to_3x3()
    m_ft = want.to_4x4()
    m_ft.translation = base_ft.translation
    pose.basis[foot] = base_ft.inverted() @ m_ft
    pose.basis[foot].translation = Vector((0, 0, 0))
    posed[foot] = base_ft @ pose.basis[foot]
    # 足より先の骨（指など）は、足の姿勢に追従させる
    for name in rig.order:
        p = rig.parent[name]
        if p in (foot,) and name not in (upper, lower, foot):
            posed[name] = posed[p] @ rig.rest_rel[name] @ pose.basis[name]


# ---------------------------------------------------------------------------
# 歩容


@dataclass
class LegSpec:
    upper: str
    lower: str
    foot: str
    phase: float
    """接地の中央（足が胴の真下を通る瞬間）が来る、周期内の位置（0〜1）。"""
    lift: float
    pole: Vector
    toe: float = 0.2
    """足首からつま先までの前方距離。遊脚でつま先を地面にめり込ませないために使う。"""
    toe_drop: float = 0.11
    swing_pitch: float = 25.0
    """遊脚の中ほどでつま先を下げる角度（度）。"""
    reach: float = 0.0
    """接地中央の位置を休止姿勢から前後へずらす量（m, -Y が前）。"""


@dataclass
class Gait:
    period: float
    stride: float
    """1周期で胴体が進む距離（m）。"""
    duty: float
    legs: dict[str, LegSpec]
    turn: float = 0.0
    """1周期で胴体が左へ回る角度（度）。右回りは負。"""
    rest_ankles: dict[str, Vector] = field(default_factory=dict)

    @property
    def speed(self) -> float:
        return self.stride / self.period

    def body_at(self, t: float) -> tuple[Vector, float]:
        """地面基準での胴体の位置と向き（t=0 で原点・正面 -Y）。"""
        w = math.radians(self.turn) / self.period
        v = self.speed
        if abs(w) < 1e-9:
            return Vector((0, -v * t, 0)), 0.0
        th = w * t
        return Vector(((v / w) * (1 - math.cos(th)), -(v / w) * math.sin(th), 0)), th

    def _world_foot(self, key: str, t_mid: float) -> tuple[Vector, float]:
        leg = self.legs[key]
        p, th = self.body_at(t_mid)
        n = self.rest_ankles[key] + Vector((0, leg.reach, 0))
        rz = Matrix.Rotation(th, 3, 'Z')
        return p + rz @ Vector((n.x, n.y, 0)), th

    def foot(self, key: str, t: float) -> tuple[Vector, float, float, float]:
        """時刻 t の足首の目標（胴体基準）、地面からの持ち上げ量、足先の傾き、足先の向き（胴体基準のヨー）。"""
        leg = self.legs[key]
        period = self.period
        rel = ((t / period - leg.phase + 0.5) % 1.0)  # 0 = 接地中央の半周期前
        half = self.duty / 2
        # 現在の周期で接地中央を迎える時刻
        t_mid = t - (rel - 0.5) * period
        if 0.5 - half <= rel <= 0.5 + half:
            w, yaw = self._world_foot(key, t_mid)
            lift, pitch = 0.0, 0.0
        else:
            if rel > 0.5 + half:
                t_prev, t_next = t_mid, t_mid + period
                s = (rel - 0.5 - half) / (1 - self.duty)
            else:
                t_prev, t_next = t_mid - period, t_mid
                s = (rel + 0.5 - half) / (1 - self.duty)
            a, ya = self._world_foot(key, t_prev)
            b, yb = self._world_foot(key, t_next)
            e = s - math.sin(2 * math.pi * s) / (2 * math.pi)  # 両端で速度 0（地面基準）
            w = a.lerp(b, e)
            yaw = ya + (yb - ya) * e
            lift = leg.lift * math.sin(math.pi * s) ** 0.8
            # かかとから先に上がり、着地の前には足裏を水平へ戻す
            pitch = leg.swing_pitch * math.sin(math.pi * s ** 0.7)
        p, th = self.body_at(t)
        local = Matrix.Rotation(-th, 3, 'Z') @ (w - p)
        rest = self.rest_ankles[key]
        return Vector((local.x, local.y, rest.z)), lift, pitch, yaw - th

    def stance_weight(self, key: str, t: float) -> float:
        rel = ((t / self.period - self.legs[key].phase + 0.5) % 1.0)
        return 1.0 if abs(rel - 0.5) <= self.duty / 2 else 0.0


def place_feet(pose: Pose, posed: dict[str, Matrix], gait: Gait, t: float) -> dict[str, float]:
    """歩容に従って全脚へ IK をかける。返り値は各脚の持ち上げ量（演出に使う）。"""
    lifts = {}
    for key, leg in gait.legs.items():
        target, lift, pitch, yaw = gait.foot(key, t)
        rot = Matrix.Rotation(yaw, 3, 'Z') @ Matrix.Rotation(math.radians(pitch), 3, 'X')
        # つま先が地面に潜らないよう、足先を下げた分だけ足首を持ち上げる
        toe_z = -leg.toe_drop * math.cos(math.radians(pitch)) - leg.toe * math.sin(math.radians(pitch))
        target.z = max(target.z + lift, 0.015 - toe_z)
        leg_ik(pose, posed, leg.upper, leg.lower, leg.foot, target, leg.pole, rot)
        lifts[key] = lift
    return lifts


def plant_feet(pose: Pose, posed: dict[str, Matrix], legs: dict[str, LegSpec], rest_ankles: dict[str, Vector],
               offsets: dict[str, Vector] | None = None, foot_rots: dict[str, Matrix] | None = None) -> None:
    """足を休止位置（または offsets だけずらした位置）に置いたまま、胴体の動きを IK で吸収する。"""
    for key, leg in legs.items():
        target = rest_ankles[key] + (offsets or {}).get(key, Vector())
        leg_ik(pose, posed, leg.upper, leg.lower, leg.foot, target, leg.pole, (foot_rots or {}).get(key))


# ---------------------------------------------------------------------------
# アクションへの書き込み


@dataclass
class Clip:
    name: str
    duration: float
    loop: bool
    sample: Callable[[float], Pose]
    meta: dict = field(default_factory=dict)


def bake_clip(armature: bpy.types.Object, clip: Clip, fps: int = FPS) -> bpy.types.Action:
    frames = max(2, round(clip.duration * fps))
    poses = []
    for f in range(frames + 1):
        t = 0.0 if (clip.loop and f == frames) else clip.duration * f / frames
        poses.append(clip.sample(t))
    rig = poses[0].rig
    moved = {n for p in poses for n in rig.order if p.basis[n].translation.length > 1e-6} | {'hips'}
    scaled = {n for p in poses for n in p.scale}
    action = bpy.data.actions.new(clip.name)
    action.use_fake_user = True
    armature.animation_data_create()
    armature.animation_data.action = action
    prev: dict[str, Quaternion] = {}
    for f, pose in enumerate(poses):
        for name in rig.order:
            pb = armature.pose.bones[name]
            b = pose.basis[name]
            q = b.to_quaternion()
            if name in prev and prev[name].dot(q) < 0:
                q.negate()
            prev[name] = q
            pb.rotation_quaternion = q
            pb.keyframe_insert('rotation_quaternion', frame=f, group=name)
            if name in moved:
                pb.location = b.translation
                pb.keyframe_insert('location', frame=f, group=name)
            if name in scaled:
                pb.scale = pose.scale.get(name, Vector((1, 1, 1)))
                pb.keyframe_insert('scale', frame=f, group=name)
    action.use_frame_range = True
    action.frame_start, action.frame_end = 0, frames
    action['zoo3d_loop'] = clip.loop
    armature.animation_data.action = None
    for pb in armature.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    return action


def stash(armature: bpy.types.Object, actions: Sequence[bpy.types.Action]) -> None:
    """各アクションを個別の NLA トラックへ置く（glTF 書き出しで別々のアニメーションになる）。"""
    ad = armature.animation_data_create()
    for act in actions:
        track = ad.nla_tracks.new()
        track.name = act.name
        strip = track.strips.new(act.name, 0, act)
        strip.name = act.name
        track.mute = True
