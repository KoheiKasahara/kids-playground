"""Mesh2Motion（CC0）のモーションを、骨格の形が違う動物へ写す（リターゲット）。

方式: 骨格空間での「休止姿勢からの回転の差分」を対応する骨へ与える。
    D(t) = R_src(t) · R_src_rest⁻¹      （元の骨が休止姿勢からどれだけ回ったか）
    R_dst(t) = D(t)^w · R_dst_rest       （w は効きの強さ。首の長さの違いなどを吸収する）
骨の数が違う区間（馬の首2本→キリンの首4本など）は、前後の差分を球面補間して配る。
足は元の動きを使わず IK で地面に固定し、接地中に滑らないようにする。

Mesh2Motion の配布 GLB は EXT_meshopt_compression で圧縮されており Blender では読めないため、
scripts/zoo-3d/vendor/ に展開済みの GLB を置いて使う（出典と取得元は同フォルダーの SOURCE.md）。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import bpy  # type: ignore[import-not-found]
from mathutils import Matrix, Quaternion  # type: ignore[import-not-found]

from .anim import Pose, RigModel


@dataclass
class SourceClip:
    name: str
    rest: dict[str, Matrix]
    frames: list[dict[str, Matrix]]
    """フレームごとの骨格空間での回転（3x3）。"""
    hips: list
    """フレームごとの腰（hips）の位置（骨格空間）。"""
    fps: float

    @property
    def duration(self) -> float:
        return (len(self.frames) - 1) / self.fps

    def at(self, t: float) -> tuple[dict[str, Quaternion], object]:
        """時刻 t の各骨の差分回転（四元数）と腰の位置の変化。フレーム間は球面補間する。"""
        f = max(0.0, min(len(self.frames) - 1.0, t * self.fps))
        i = int(f)
        j = min(i + 1, len(self.frames) - 1)
        k = f - i
        out = {}
        for name, rest in self.rest.items():
            qa = (self.frames[i][name] @ rest.inverted()).to_quaternion()
            qb = (self.frames[j][name] @ rest.inverted()).to_quaternion()
            out[name] = qa.slerp(qb, k)
        hips = self.hips[i].lerp(self.hips[j], k) - self.hips[0]
        return out, hips


def load_source(path: str, fps: float = 30.0) -> SourceClip:
    """展開済み GLB（骨格＋アクション1つ）を読み込み、全フレームの骨の回転を取り出してから片付ける。"""
    before_objects = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    before_arms = set(bpy.data.armatures)
    bpy.ops.import_scene.gltf(filepath=path)
    new_objects = [o for o in bpy.data.objects if o not in before_objects]
    arm = next(o for o in new_objects if o.type == 'ARMATURE')
    action = next(a for a in bpy.data.actions if a not in before_actions)
    arm.animation_data_create()
    arm.animation_data.action = action
    if hasattr(arm.animation_data, 'action_slot') and getattr(action, 'slots', None):
        arm.animation_data.action_slot = action.slots[0]
    scene = bpy.context.scene
    start, end = (int(round(v)) for v in action.frame_range)
    # 元のクリップは 24fps / 30fps が混在するので、GLB を読み込んだシーンの fps で時刻に直す
    src_fps = scene.render.fps / scene.render.fps_base
    rest = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}
    frames, hips = [], []
    for f in range(start, end + 1):
        scene.frame_set(f)
        frames.append({pb.name: pb.matrix.to_3x3() for pb in arm.pose.bones})
        hips.append(arm.pose.bones['hips'].matrix.translation.copy())
    clip = SourceClip(action.name, rest, frames, hips, src_fps)
    for o in new_objects:
        bpy.data.objects.remove(o)
    for a in [a for a in bpy.data.actions if a not in before_actions]:
        bpy.data.actions.remove(a)
    for a in [a for a in bpy.data.armatures if a not in before_arms]:
        bpy.data.armatures.remove(a)
    return clip


Mapping = dict[str, tuple]
"""目的の骨 → ('bone', 元の骨) / ('blend', 元の骨A, 元の骨B, 比率)。"""


def apply(pose: Pose, deltas: dict[str, Quaternion], mapping: Mapping, strength: float | dict[str, float] = 1.0,
          posed: dict[str, Matrix] | None = None) -> dict[str, Matrix]:
    """差分回転を目的の骨格の姿勢へ書き込む。posed（親の姿勢）は親から順に更新して返す。"""
    rig: RigModel = pose.rig
    posed = posed if posed is not None else {}
    for name in rig.order:
        parent = rig.parent[name]
        parent_m = posed[parent] if parent else Matrix.Identity(4)
        base = parent_m @ rig.rest_rel[name]
        rule = mapping.get(name)
        if rule is not None:
            if rule[0] == 'bone':
                d = deltas[rule[1]]
            else:
                d = deltas[rule[1]].slerp(deltas[rule[2]], rule[3])
            w = strength.get(name, 1.0) if isinstance(strength, dict) else strength
            if w != 1.0:
                # 回転角だけを w 倍する（w > 1 で強調、w < 1 で弱める）
                axis, angle = d.to_axis_angle()
                d = Quaternion(axis, angle * w)
            want = d.to_matrix() @ rig.rest[name].to_3x3()
            local = base.to_3x3().inverted() @ want
            basis = local.to_4x4()
            basis.translation = pose.basis[name].translation
            pose.basis[name] = basis
        posed[name] = base @ pose.basis[name]
    return posed


def lowest_point(pose: Pose, bones: Sequence[str]) -> float:
    posed = pose.posed()
    return min(posed[b].translation.z for b in bones)
