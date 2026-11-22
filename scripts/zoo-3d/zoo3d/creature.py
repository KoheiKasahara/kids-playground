"""動物の部品（目・デカール）作りと、骨格への結び付け（ウェイト付け→結合）の共通処理。"""

from __future__ import annotations

from typing import Callable, Sequence

import numpy as np
from mathutils import Vector  # type: ignore[import-not-found]

from . import meshing as M
from . import rig as R
from .sdf import Body, surface_point

Roles = dict[str, list]


def new_roles() -> Roles:
    return {'body': [], 'decal': [], 'rigid': [], 'chains': [], 'eye_l': [], 'eye_r': []}


def add_eyes(roles: Roles, body: Body, center: Sequence[float], direction: Callable[[int], Sequence[float]],
             size: tuple[float, float, float], eye: str = '#24273A', sparkle: str = '#FFFFFF',
             sclera: str | None = None) -> dict:
    """左右の目（黒い楕円＋ハイライト）を顔の表面に置き、目の骨の位置と向きを返す。

    sclera を指定すると黒目の後ろに白目を敷く（パンダのように目のまわりが黒い動物で目を読ませる）。
    """
    out = {}
    for side, lr in ((1, 'l'), (-1, 'r')):
        p, n = surface_point(body, center, direction(side))
        normal = Vector(n)
        if sclera:
            white_size = (size[0] * 1.45, size[1] * 1.35, size[2] * 1.1)
            w = M.primitive('sphere', f'sclera_{lr}', M.look_matrix(Vector(p) - normal * white_size[2] * 0.5, normal,
                            scale=white_size), segments=12, rings=8)
            M.solid(w, sclera)
            roles[f'eye_{lr}'].append(w)
        e = M.primitive('sphere', f'eye_{lr}', M.look_matrix(Vector(p) - normal * size[2] * (0.1 if sclera else 0.4),
                        normal, scale=size), segments=12, rings=8)
        M.solid(e, eye)
        x_axis = Vector((0, 0, 1)).cross(normal).normalized()
        up_axis = normal.cross(x_axis).normalized()
        sp = Vector(p) + up_axis * size[1] * 0.38 - x_axis * size[0] * 0.3 * side + normal * size[2] * 0.7
        s = size[0] * 0.32
        spark = M.primitive('sphere', f'sparkle_{lr}', M.look_matrix(sp, normal, scale=(s, s, s * 0.6)), segments=8,
                            rings=5)
        M.solid(spark, sparkle)
        roles[f'eye_{lr}'] += [e, spark]
        out[lr] = (tuple(p), tuple(n))
    return out


def assemble(name: str, roles: Roles, specs: Sequence[R.BoneSpec], body_bones: Sequence[str],
             shading: str = 'smooth'):
    """部品にウェイトを付けて1つのメッシュへ結合し、骨格へ結び付ける。

    roles:
      body   : 熱拡散で自動ウェイトを付ける本体（先頭が主メッシュ）
      decal  : 本体の最寄り頂点のウェイトを写す小物（爪・ぶち・頬）
      rigid  : (オブジェクト, 骨名) — 1本の骨に固定する小物（きば・つの）
      chains : (オブジェクト, 骨の並び, 根元の骨, 根元のぼかし距離) — 耳・たてがみの房など
      eye_l / eye_r : 目の骨へ固定
    """
    arm = R.build_armature(f'{name}_rig', specs)
    main = roles['body'][0]
    extra_bodies = roles['body'][1:]
    if extra_bodies:
        main = M.join([main, *extra_bodies], f'{name}_body')
    R.auto_weights(main, arm, body_bones)
    for o in roles['decal']:
        R.copy_nearest_weights(o, main)
    for o, bone in roles['rigid']:
        R.rigid_weights(o, bone)
    for o, chain, root, falloff in roles['chains']:
        R.chain_weights(o, chain, root_bone=root, root_falloff=falloff)
    for lr in ('l', 'r'):
        for o in roles[f'eye_{lr}']:
            R.rigid_weights(o, f'eye_{lr}')
    parts = [main] + roles['decal'] + [o for o, _ in roles['rigid']] + [c[0] for c in roles['chains']] + \
        roles['eye_l'] + roles['eye_r']
    for o in parts:
        o.parent = None
        for m in list(o.modifiers):
            o.modifiers.remove(m)
        if shading == 'flat':
            M.flat_shade(o)
        else:
            M.smooth_shade(o)
    mesh = M.join(parts, name)
    R.limit_influences(mesh)
    mesh.data.materials.clear()
    mesh.data.materials.append(M.vertex_color_material(name))
    R.bind(mesh, arm)
    return mesh, arm


def spots(roles: Roles, body: Body, centers: Sequence[tuple[Sequence[float], Sequence[float], float]], color: str,
          seed: int = 1) -> None:
    """体の表面に、ぶち模様（少しいびつな平たい楕円）を貼る。centers は (内側の点, 向き, 大きさ)。"""
    rng = np.random.default_rng(seed)
    for i, (origin, direction, size) in enumerate(centers):
        sx = size * (0.85 + 0.3 * rng.random())
        sy = size * (0.75 + 0.3 * rng.random())
        up = (rng.random() - 0.5, rng.random() - 0.5, 1.0)
        roles['decal'].append(M.decal(f'spot{i}', body, origin, direction, (sx, sy, 0.02), color, sink=0.55, up=up,
                                      segments=10, rings=5))
