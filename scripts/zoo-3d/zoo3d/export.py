"""GLB とモーション情報（JSON）の書き出し。"""

from __future__ import annotations

import json
import os
from typing import Sequence

import bpy  # type: ignore[import-not-found]
import numpy as np

from .anim import FPS, Clip


def export_glb(mesh: bpy.types.Object, armature: bpy.types.Object, path: str) -> None:
    """骨格・メッシュ・NLA に置いた全アクションを1つの GLB へ書き出す。"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(False)
    mesh.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    armature.animation_data.action = None
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=False,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_materials='EXPORT',
        export_image_format='NONE',
        export_vertex_color='ACTIVE',
        export_all_vertex_colors=False,
        export_active_vertex_color_when_no_material=True,
        export_attributes=False,
        export_extras=False,
        export_yup=True,
        export_skins=True,
        export_all_influences=False,
        export_def_bones=False,
        export_leaf_bone=False,
        export_morph=False,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_nla_strips=True,
        export_force_sampling=True,
        export_frame_step=1,
        export_optimize_animation_size=True,
        export_anim_single_armature=True,
        export_reset_pose_bones=True,
        export_rest_position_armature=True,
        export_anim_slide_to_zero=True,
        export_current_frame=False,
        export_negative_frame='SLIDE',
    )


def bounds(mesh: bpy.types.Object) -> dict:
    co = np.array([v.co[:] for v in mesh.data.vertices])
    lo, hi = co.min(axis=0), co.max(axis=0)
    # Blender (x, y, z) → glTF / Three.js (x, z, -y)。前方は +Z。
    return {
        'width': round(float(hi[0] - lo[0]), 3),
        'length': round(float(hi[1] - lo[1]), 3),
        'height': round(float(hi[2]), 3),
        'front': round(float(-lo[1]), 3),
        'back': round(float(hi[1]), 3),
    }


def clip_entry(c: Clip) -> dict:
    """書き出したクリップの実際の長さ（フレーム数/FPS）で、速度・旋回速度を計算し直す。"""
    duration = max(2, round(c.duration * FPS)) / FPS
    entry = {'duration': round(duration, 4), 'loop': c.loop, **c.meta}
    if 'distancePerCycle' in entry:
        entry['speed'] = round(entry['distancePerCycle'] / duration, 4)
        entry['turnSpeed'] = round(entry.get('turnPerCycle', 0) / duration, 3)
    return entry


def write_manifest(path: str, animal: str, glb_name: str, mesh: bpy.types.Object, clips: Sequence[Clip],
                   extra: dict | None = None) -> dict:
    data = {
        'animal': animal,
        'model': glb_name,
        'fps': FPS,
        'triangles': sum(len(p.vertices) - 2 for p in mesh.data.polygons),
        'bounds': bounds(mesh),
        'clips': {c.name: clip_entry(c) for c in clips},
    }
    if extra:
        data.update(extra)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    return data
