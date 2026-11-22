"""骨格の作成とスキニング。

骨の名前と親子関係は Mesh2Motion（CC0）の四足テンプレート（horse / fox）に合わせる。
Mesh2Motion のモーションをリターゲットするときの対応表を単純に保つためで、
動物ごとに足りない骨（ゾウの鼻・キリンの首・ライオンのたてがみ等）だけを追加する。

骨のローカル X 軸は、可能な限り動物の左（ワールド +X）へ向ける。
こうすると前後に曲げる関節は X 軸まわりの回転で表せ、リターゲットや手付けが読みやすくなる。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence

import bpy  # type: ignore[import-not-found]
import numpy as np
from mathutils import Vector  # type: ignore[import-not-found]


@dataclass
class BoneSpec:
    name: str
    head: Sequence[float]
    tail: Sequence[float]
    parent: str | None = None
    deform: bool = True
    lateral: Sequence[float] = (1.0, 0.0, 0.0)
    """ローカル X 軸を向けたい方向（骨の向きと直交化して使う）。"""
    connect: bool = False


def mirror(spec: BoneSpec) -> BoneSpec:
    """左（_l）の定義から右（_r）を作る。"""
    def m(v):
        return (-v[0], v[1], v[2])

    return BoneSpec(
        name=spec.name[:-2] + '_r' if spec.name.endswith('_l') else spec.name,
        head=m(spec.head), tail=m(spec.tail),
        parent=(spec.parent[:-2] + '_r') if spec.parent and spec.parent.endswith('_l') else spec.parent,
        deform=spec.deform, lateral=(spec.lateral[0], -spec.lateral[1], -spec.lateral[2]), connect=spec.connect,
    )


def with_mirrors(specs: Iterable[BoneSpec]) -> list[BoneSpec]:
    out: list[BoneSpec] = []
    for s in specs:
        out.append(s)
        if s.name.endswith('_l'):
            out.append(mirror(s))
    return out


def build_armature(name: str, specs: Sequence[BoneSpec]) -> bpy.types.Object:
    data = bpy.data.armatures.new(name)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    edit = data.edit_bones
    for s in specs:
        b = edit.new(s.name)
        b.head = Vector(s.head)
        b.tail = Vector(s.tail)
        b.use_deform = s.deform
        y = (b.tail - b.head).normalized()
        x = Vector(s.lateral)
        x = (x - y * x.dot(y))
        if x.length < 1e-4:
            x = Vector((0, 0, 1)) - y * y.z
        x.normalize()
        b.align_roll(x.cross(y))  # ローカル Z = X × Y
    for s in specs:
        if s.parent:
            edit[s.name].parent = edit[s.parent]
            edit[s.name].use_connect = s.connect
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)
    for pb in obj.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return obj


def auto_weights(mesh: bpy.types.Object, armature: bpy.types.Object, bones: Iterable[str]) -> None:
    """指定した骨だけを使って、熱拡散（bone heat）で自動ウェイトを付ける。"""
    bones = set(bones)
    saved = {b.name: b.use_deform for b in armature.data.bones}
    for b in armature.data.bones:
        b.use_deform = b.name in bones
    for o in bpy.context.selected_objects:
        o.select_set(False)
    mesh.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for b in armature.data.bones:
        b.use_deform = saved[b.name]
    # 熱拡散が解けないと、ウェイトのない頂点が休止姿勢のまま残る（体が動かない）。気づけるように知らせる
    empty = sum(1 for v in mesh.data.vertices if not any(g.weight > 0 for g in v.groups))
    if empty:
        print(f'[zoo3d] WARNING: {mesh.name}: {empty} vertices have no bone weights (bone heat failed?)')
    mesh.select_set(False)
    armature.select_set(False)


def rigid_weights(mesh: bpy.types.Object, bone: str) -> None:
    group = mesh.vertex_groups.get(bone) or mesh.vertex_groups.new(name=bone)
    group.add(list(range(len(mesh.data.vertices))), 1.0, 'REPLACE')


def chain_weights(mesh: bpy.types.Object, chain: Sequence[tuple[str, Sequence[float], Sequence[float]]],
                  root_bone: str | None = None, root_falloff: float = 0.0) -> None:
    """骨の並び（名前・始点・終点）に沿って、各頂点を最も近い区間の骨へ線形に配分する。

    root_bone を指定すると、付け根から root_falloff の範囲は親の骨へなめらかに戻す（耳の付け根など）。
    """
    verts = np.array([v.co[:] for v in mesh.data.vertices])
    n = len(verts)
    weights = {name: np.zeros(n) for name, _, _ in chain}
    if root_bone:
        weights.setdefault(root_bone, np.zeros(n))
    best = np.full(n, np.inf)
    best_k = np.zeros(n, dtype=int)
    best_t = np.zeros(n)
    for k, (_, a, b) in enumerate(chain):
        a = np.asarray(a)
        b = np.asarray(b)
        ab = b - a
        t = np.clip(((verts - a) @ ab) / (ab @ ab), 0.0, 1.0)
        d = np.linalg.norm(verts - (a + t[:, None] * ab), axis=1)
        better = d < best
        best[better] = d[better]
        best_k[better] = k
        best_t[better] = t[better]
    for i in range(n):
        k = best_k[i]
        t = best_t[i]
        name = chain[k][0]
        # 区間の終わり 30% は次の骨と混ぜ、継ぎ目を折れにくくする
        if t > 0.7 and k + 1 < len(chain):
            w = (t - 0.7) / 0.3 * 0.5
            weights[name][i] += 1 - w
            weights[chain[k + 1][0]][i] += w
        elif t < 0.3 and k > 0:
            w = (0.3 - t) / 0.3 * 0.5
            weights[name][i] += 1 - w
            weights[chain[k - 1][0]][i] += w
        else:
            weights[name][i] += 1.0
    if root_bone and root_falloff > 0:
        a = np.asarray(chain[0][1])
        dist = np.linalg.norm(verts - a, axis=1)
        keep = np.clip(dist / root_falloff, 0.0, 1.0)
        for name, _, _ in chain:
            weights[name] *= keep
        weights[root_bone] += 1 - keep
    for name, w in weights.items():
        group = mesh.vertex_groups.get(name) or mesh.vertex_groups.new(name=name)
        for i in np.nonzero(w > 1e-4)[0]:
            group.add([int(i)], float(w[i]), 'REPLACE')


def copy_nearest_weights(target: bpy.types.Object, source: bpy.types.Object) -> None:
    """体の表面に貼った小物（爪・頬）に、最も近い体の頂点のウェイトをそのまま写す。"""
    src = np.array([v.co[:] for v in source.data.vertices])
    names = {g.index: g.name for g in source.vertex_groups}
    for v in target.data.vertices:
        i = int(np.argmin(np.linalg.norm(src - np.array(v.co[:]), axis=1)))
        for g in source.data.vertices[i].groups:
            name = names[g.group]
            group = target.vertex_groups.get(name) or target.vertex_groups.new(name=name)
            group.add([v.index], g.weight, 'REPLACE')


def bind(mesh: bpy.types.Object, armature: bpy.types.Object) -> None:
    """ウェイト付け済みのメッシュを骨格へ結び付ける（Armature モディファイアと親子付け）。"""
    if not any(m.type == 'ARMATURE' for m in mesh.modifiers):
        mod = mesh.modifiers.new('Armature', 'ARMATURE')
        mod.object = armature
    mesh.parent = armature


def limit_influences(mesh: bpy.types.Object, max_influences: int = 4, threshold: float = 0.02) -> None:
    """glTF / Three.js の上限（1頂点あたり4本）に合わせ、小さいウェイトを捨てて正規化する。"""
    names = {g.index: g.name for g in mesh.vertex_groups}
    for v in mesh.data.vertices:
        gs = sorted(((g.weight, g.group) for g in v.groups), reverse=True)
        keep = [(w, gi) for w, gi in gs[:max_influences] if w >= threshold] or gs[:1]
        total = sum(w for w, _ in keep) or 1.0
        drop = {gi for _, gi in gs} - {gi for _, gi in keep}
        for gi in drop:
            mesh.vertex_groups[names[gi]].remove([v.index])
        for w, gi in keep:
            mesh.vertex_groups[names[gi]].add([v.index], w / total, 'REPLACE')
