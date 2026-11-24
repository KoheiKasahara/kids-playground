"""SDF の部位定義から Blender のメッシュを作り、ローポリ化と色付けを行う。"""

from __future__ import annotations

import math
from typing import Callable, Iterable, Sequence

import bmesh  # type: ignore[import-not-found]
import bpy  # type: ignore[import-not-found]
import numpy as np
from mathutils import Matrix, Vector  # type: ignore[import-not-found]

from .sdf import Body, surface_nets

ColorRule = Callable[[np.ndarray, np.ndarray, np.ndarray], np.ndarray | None]
"""(面の中心 (N,3), 面の法線 (N,3), 部位名 (N,)) -> 上書きする色 (N,4) か None。NaN の行は上書きしない。"""


def hex_rgba(value: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    """sRGB の 16 進表記をリニアの RGBA に変換する（Blender の色属性はリニアで持つ）。"""
    value = value.lstrip('#')
    srgb = [int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (lin[0], lin[1], lin[2], alpha)


def mesh_from_arrays(name: str, verts: np.ndarray, faces: np.ndarray) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts.tolist(), [], faces.tolist())
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def apply_modifier(obj: bpy.types.Object, mod: bpy.types.Modifier) -> None:
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def tri_count(obj: bpy.types.Object) -> int:
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def lowpoly(obj: bpy.types.Object, target_tris: int, smooth: int = 2) -> None:
    """細かいメッシュをなめらかにしてから、目標の三角形数まで減面する。"""
    if smooth:
        mod = obj.modifiers.new('smooth', 'SMOOTH')
        mod.factor = 0.5
        mod.iterations = smooth
        apply_modifier(obj, mod)
    current = tri_count(obj)
    if current > target_tris:
        mod = obj.modifiers.new('decimate', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = target_tris / current
        mod.use_collapse_triangulate = True
        apply_modifier(obj, mod)
    tri = obj.modifiers.new('tri', 'TRIANGULATE')
    apply_modifier(obj, tri)


def body_object(name: str, body: Body, lo: Sequence[float], hi: Sequence[float], h: float, target_tris: int,
                smooth: int = 2) -> bpy.types.Object:
    verts, faces = surface_nets(lambda p: body.evaluate(p)[0], lo, hi, h)
    obj = mesh_from_arrays(name, verts, faces)
    lowpoly(obj, target_tris, smooth)
    return obj


def face_arrays(obj: bpy.types.Object) -> tuple[np.ndarray, np.ndarray]:
    mesh = obj.data
    n = len(mesh.polygons)
    centers = np.zeros(n * 3)
    normals = np.zeros(n * 3)
    mesh.polygons.foreach_get('center', centers)
    mesh.polygons.foreach_get('normal', normals)
    return centers.reshape(-1, 3), normals.reshape(-1, 3)


def paint(obj: bpy.types.Object, body: Body | None, palette: dict[str, str], rules: Iterable[ColorRule] = (),
          default: str = '#ff00ff') -> None:
    """面ごとに色を決め、コーナー領域の色属性へ書き込む（フラットシェーディングで面の色になる）。"""
    centers, normals = face_arrays(obj)
    if body is not None:
        regions = body.region_of(centers)
    else:
        regions = np.full(len(centers), next(iter(palette)), dtype=object)
    colors = np.array([hex_rgba(palette.get(r, default)) for r in regions])
    for rule in rules:
        over = rule(centers, normals, regions)
        if over is None:
            continue
        mask = ~np.isnan(over[:, 0])
        colors[mask] = over[mask]
    mesh = obj.data
    attr = mesh.color_attributes.get('Col') or mesh.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    loop_colors = np.zeros((len(mesh.loops), 4))
    for poly, color in zip(mesh.polygons, colors):
        loop_colors[poly.loop_start:poly.loop_start + poly.loop_total] = color
    attr.data.foreach_set('color', loop_colors.ravel())
    mesh.color_attributes.active_color = attr
    mesh.attributes.default_color_name = attr.name
    mesh.attributes.active_color_name = attr.name


def solid(obj: bpy.types.Object, color: str) -> None:
    paint(obj, None, {'all': color})


def region_rule(mask_fn: Callable[[np.ndarray, np.ndarray, np.ndarray], np.ndarray], color: str) -> ColorRule:
    rgba = np.array(hex_rgba(color))

    def rule(c: np.ndarray, n: np.ndarray, r: np.ndarray) -> np.ndarray:
        out = np.full((len(c), 4), np.nan)
        out[mask_fn(c, n, r)] = rgba
        return out

    return rule


def primitive(kind: str, name: str, matrix: Matrix, segments: int = 12, rings: int = 8,
              radius1: float = 1.0, radius2: float = 0.0, depth: float = 1.0) -> bpy.types.Object:
    """小物（目・きば・ハイライト）用の低ポリ形状。"""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    if kind == 'sphere':
        bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=1.0, matrix=matrix)
    elif kind == 'cone':
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius1, radius2=radius2, depth=depth,
                              matrix=matrix)
    else:
        raise ValueError(kind)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def look_matrix(location: Sequence[float], forward: Sequence[float], up: Sequence[float] = (0, 0, 1),
                scale: Sequence[float] = (1, 1, 1)) -> Matrix:
    """ローカル +Z を forward へ向けた変換行列（コーン・楕円体の向き付け用）。"""
    z = Vector(forward).normalized()
    x = Vector(up).cross(z)
    if x.length < 1e-6:
        x = Vector((1, 0, 0))
    x.normalize()
    y = z.cross(x)
    rot = Matrix((x, y, z)).transposed().to_4x4()
    return Matrix.Translation(Vector(location)) @ rot @ Matrix.Diagonal((*scale, 1.0))


def decal(name: str, body: Body, origin: Sequence[float], direction: Sequence[float], radii: Sequence[float],
          color: str, sink: float = 0.4, up: Sequence[float] = (0, 0, 1), segments: int = 12,
          rings: int = 7) -> bpy.types.Object:
    """体の表面に貼り付く薄い楕円体（頬・爪・耳の内側など）。色の境界をなめらかに保つ。

    radii は (表面に沿った横, 表面に沿った縦, 法線方向の厚み)。sink は厚みの何割を埋め込むか。
    """
    from .sdf import surface_point

    p, n = surface_point(body, origin, direction)
    normal = Vector(n)
    loc = Vector(p) - normal * radii[2] * sink
    obj = primitive('sphere', name, look_matrix(loc, normal, up=up, scale=radii), segments=segments, rings=rings)
    solid(obj, color)
    return obj


def smooth_shade(obj: bpy.types.Object, angle_deg: float = 60.0) -> None:
    """なめらかに陰影を付けつつ、指定角度より鋭い折れ目は残す。"""
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.data.set_sharp_from_angle(angle=math.radians(angle_deg))


def join(objects: Sequence[bpy.types.Object], name: str) -> bpy.types.Object:
    target = objects[0]
    with bpy.context.temp_override(active_object=target, object=target, selected_editable_objects=list(objects),
                                   selected_objects=list(objects)):
        bpy.ops.object.join()
    target.name = name
    target.data.name = name
    return target


def flat_shade(obj: bpy.types.Object) -> None:
    for poly in obj.data.polygons:
        poly.use_smooth = False


def vertex_color_material(name: str, roughness: float = 0.85) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = True
    nodes = mat.node_tree.nodes
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = 0.0
    attr = nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    mat.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    return mat
