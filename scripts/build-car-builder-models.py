#!/usr/bin/env python3
"""「3Dクルマづくり」で使う車体GLBを、Quaternius公式の .blend から生成する変換スクリプト。

生成物（`public/models/car-builder/*.glb`）はリポジトリへコミット済みのため、
このスクリプトを日常の開発・CIで実行する必要はない。
車種を足す・加工方針を変えるときだけ、手元で実行して差し替える。

## 実行方法

    pip install bpy==4.2.0            # Blender 4.2 を Python モジュールとして入れる（要 Python 3.11）
    python3 scripts/build-car-builder-models.py --source-dir <.blendを置いたディレクトリ>

`--source-dir` を省略すると Quaternius 公式の配布元（Google Drive）から取得する。

bpy はすべての書き出しを終えたあとのインタプリタ終了時に segfault することがある。
GLBと --metrics が出力できていれば変換自体は成功しているので、出力の有無で判断する。

## 素材の出どころ

- Cars Pack           https://quaternius.com/packs/cars.html
- Public Transport    https://quaternius.com/packs/publictransport.html
- いずれも Quaternius 作 / CC0 1.0 Universal（改変・商用可、クレジット不要）

## この変換が行うこと

1. 元タイヤのオブジェクトを削除する（Phase 3 でゲーム側の共通タイヤへ置き換えるため）。
   削除前にホイール位置を実測し、`--metrics` へ書き出す。
   マテリアルは削除せずオブジェクト単位で消すため、同じ `Black` / `Grey` を使う
   ドアミラー・下部クラッディング・ルーフレールは車体側に残る。
2. 座標系を揃える。Blender の Z-up / -Y前 は glTF 書き出し時に Y-up / +Z前 へ変換される。
   SchoolBus だけ前方が -X なので Z軸まわりに +90° 回して他と揃える。
3. 接地（タイヤ下端）を原点の高さに合わせ、車体の左右・前後中心を原点へ寄せる。
4. Public Transport の2台だけ、他車と並べたときの実寸が破綻しないよう一様スケールをかける。
   車種間の実寸差は幼児が車種を見分ける手がかりなので、全車を同じ全長へ正規化はしない。
5. マテリアルを Principled BSDF へ作り直し、役割の分かる名前（Body / Glass / Trim …）へ
   改名する。パトランプ・タクシーサインは面単位で切り出して専用マテリアルにする。
6. GLB を書き出す。
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import urllib.request
from collections import defaultdict

import bpy  # type: ignore[import-not-found]
from mathutils import Matrix, Vector  # type: ignore[import-not-found]

# Quaternius公式の配布Driveに置かれている .blend のファイルID。
# 配布側の都合で変わりうるので、取得できないときは手元にダウンロードして
# --source-dir で渡す。
BLEND_DRIVE_IDS = {
    'SportsCar2.blend': '1Q9FIPBQuKP3KtW3bcRzmTUBf5U-16VSz',
    'NormalCar2.blend': '1wg2lW4rDQavOtcu2i5qzWtHJXXY0kDDD',
    'SUV.blend': '1i_J-m5wjrr6wxXy2-XONATGydBAdJWuL',
    'Taxi.blend': '1zw7_r7wbli_XZCERfzFY2ge4lFDB9Zy2',
    'Cop.blend': '1dWk2t09F_mfUHF-6gwgbic6H89K67YDU',
    'SchoolBus.blend': '1NHBDghhuMVcm8Ke7lOcBe1KyX1p87FLN',
    'Ambulance.blend': '15muKRM_51PcFrNBiNGL8HK766hiDRJ7f',
}

# マテリアルの役割名。ゲーム側（carVehicles.ts）はこの名前でボディ・ガラス・
# パトランプを判別するため、勝手に変えないこと。
ROLE_BODY = 'Body'
ROLE_BODY_LOWER = 'BodyLower'
ROLE_ACCENT = 'Accent'
ROLE_GLASS = 'Glass'
ROLE_TRIM = 'Trim'
ROLE_TRIM_DARK = 'TrimDark'
ROLE_LIGHT_FRONT = 'LightFront'
ROLE_LIGHT_REAR = 'LightRear'

# 発光として扱うマテリアル役割（ヘッドライト・テールランプ・パトランプ）。
EMISSIVE_ROLES = {ROLE_LIGHT_FRONT, ROLE_LIGHT_REAR, 'PoliceLightBlue', 'PoliceLightRed', 'PoliceLightWhite'}

# 役割ごとの質感。元のローポリらしさを保つため金属反射は使わない。
ROUGHNESS = {
    ROLE_BODY: 0.42,
    ROLE_BODY_LOWER: 0.5,
    ROLE_ACCENT: 0.42,
    ROLE_GLASS: 0.22,
    ROLE_TRIM: 0.55,
    ROLE_TRIM_DARK: 0.7,
}
DEFAULT_ROUGHNESS = 0.5


class Vehicle:
    """1車種ぶんの変換設定。"""

    def __init__(
        self,
        *,
        vehicle_id: str,
        blend: str,
        body_object: str,
        pack: str,
        source_model: str,
        materials: dict[str, str],
        scale: float = 1.0,
        yaw_deg: float = 0.0,
        face_groups: tuple = (),
    ) -> None:
        self.vehicle_id = vehicle_id
        self.blend = blend
        self.body_object = body_object
        self.pack = pack
        self.source_model = source_model
        self.materials = materials
        self.scale = scale
        self.yaw_deg = yaw_deg
        # (新マテリアル名, 元マテリアル名, 選択条件) の並び。
        # 条件は「島（連結した面のかたまり）のワールド座標bbox」を受け取る述語。
        self.face_groups = face_groups


def cop_light_bar(bbox: dict) -> bool:
    """パトランプ（ルーフ上の光る棒）の島かどうか。ルーフ高さより上だけを拾う。"""
    return bbox['zmin'] > 1.05 and abs(bbox['xmin']) < 0.5 and abs(bbox['xmax']) < 0.5


def taxi_roof_sign(bbox: dict) -> bool:
    """タクシーのルーフサインの島かどうか。車体本体の島はXが広いので除外される。"""
    return (
        bbox['zmax'] > 1.14
        and bbox['zmin'] > 1.10
        and bbox['xmin'] > -0.4
        and bbox['xmax'] < 0.4
    )


VEHICLES = [
    Vehicle(
        vehicle_id='sports-car',
        blend='SportsCar2.blend',
        body_object='SportsCar2',
        pack='Cars Pack',
        source_model='SportsCar2',
        materials={
            'White': ROLE_BODY,
            'Grey': ROLE_TRIM,
            'Windows': ROLE_GLASS,
            'Headlights': ROLE_LIGHT_FRONT,
            'TailLights': ROLE_LIGHT_REAR,
        },
    ),
    Vehicle(
        vehicle_id='car',
        blend='NormalCar2.blend',
        body_object='NormalCar2',
        pack='Cars Pack',
        source_model='NormalCar2',
        materials={
            'LightBlue': ROLE_BODY,
            # 元は Material.007 という役割の分からない名前だった下部パネル。
            'Material.007': ROLE_BODY_LOWER,
            'Black': ROLE_TRIM_DARK,
            'Grey': ROLE_TRIM,
            'Windows': ROLE_GLASS,
            'Headlights': ROLE_LIGHT_FRONT,
            'TailLights': ROLE_LIGHT_REAR,
        },
    ),
    Vehicle(
        vehicle_id='suv',
        blend='SUV.blend',
        body_object='SUV',
        pack='Cars Pack',
        source_model='SUV',
        materials={
            'White': ROLE_BODY,
            # 下部クラッディングとルーフレール。元タイヤとマテリアルを共有するが、
            # 削除はオブジェクト単位なので車体側には残る。
            'Black': ROLE_TRIM_DARK,
            'Grey': ROLE_TRIM,
            'Windows': ROLE_GLASS,
            'Headlights': ROLE_LIGHT_FRONT,
            'TailLights': ROLE_LIGHT_REAR,
        },
    ),
    Vehicle(
        vehicle_id='taxi',
        blend='Taxi.blend',
        body_object='Taxi',
        pack='Cars Pack',
        source_model='Taxi',
        materials={
            'Yellow': ROLE_BODY,
            'Black': ROLE_TRIM_DARK,
            'Grey': ROLE_TRIM,
            'Windows': ROLE_GLASS,
            'Headlights': ROLE_LIGHT_FRONT,
            'TailLights': ROLE_LIGHT_REAR,
        },
        # ルーフサインはボディカラーに追従させない。黒い板＋黄色い文字のまま固定して、
        # 何色に塗ってもタクシーだと分かるようにする。
        face_groups=(
            ('SignPlate', 'Black', taxi_roof_sign),
            ('SignText', 'Yellow', taxi_roof_sign),
        ),
    ),
    Vehicle(
        vehicle_id='police-car',
        blend='Cop.blend',
        body_object='Cop',
        pack='Cars Pack',
        source_model='Cop',
        materials={
            'Black': ROLE_BODY,
            # ドア・ルーフの白いパネル。塗り分けを残さないとパトカーに見えなくなる。
            'White': ROLE_ACCENT,
            'Grey': ROLE_TRIM,
            'Windows': ROLE_GLASS,
            'Headlights': ROLE_LIGHT_FRONT,
            'TailLights': ROLE_LIGHT_REAR,
        },
        # パトランプはルーフ上の島だけを切り出して PoliceLight* にする。
        # 赤いレンズは車体後部のテールランプと同じマテリアルなので、位置で切り分ける。
        face_groups=(
            ('PoliceLightBar', 'Black', cop_light_bar),
            ('PoliceLightBlue', 'BlueLights', cop_light_bar),
            ('PoliceLightWhite', 'WhiteLights', cop_light_bar),
            ('PoliceLightRed', 'TailLights', cop_light_bar),
        ),
    ),
    Vehicle(
        vehicle_id='school-bus',
        blend='SchoolBus.blend',
        body_object='SchoolBus',
        pack='Public Transport Pack',
        source_model='SchoolBus',
        # 前方が -X なので、他車と同じ「-Y が前」へ回す。
        yaw_deg=90.0,
        # 素のままだと乗用車より小さく、バスに見えない。
        scale=1.20,
        materials={
            'Yellow': ROLE_BODY,
            'Bumper': ROLE_TRIM_DARK,
            'Details': ROLE_TRIM,
            'Windows': ROLE_GLASS,
            'Lights': ROLE_LIGHT_FRONT,
        },
    ),
    Vehicle(
        vehicle_id='ambulance',
        blend='Ambulance.blend',
        body_object='Ambulance',
        pack='Public Transport Pack',
        source_model='Ambulance',
        # 素のままだとSUVより3割以上広く、並べたときだけ極端に大きく見える。
        scale=0.82,
        materials={
            'White': ROLE_BODY,
            # 赤いストライプ。救急車の識別要素なのでボディカラーに追従させない。
            'Red': ROLE_ACCENT,
            'Bumper': ROLE_TRIM_DARK,
            'Grey': ROLE_TRIM,
            'Windows': ROLE_GLASS,
            'Lights': ROLE_LIGHT_FRONT,
        },
    ),
]


def download_sources(target_dir: str) -> None:
    os.makedirs(target_dir, exist_ok=True)
    for name, file_id in BLEND_DRIVE_IDS.items():
        path = os.path.join(target_dir, name)
        if os.path.exists(path) and os.path.getsize(path) > 10_000:
            continue
        url = f'https://drive.usercontent.google.com/download?id={file_id}&export=download'
        print(f'  download {name}')
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(request) as response, open(path, 'wb') as out:
            out.write(response.read())


def world_bbox(objects) -> dict:
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return {
        'xmin': min(p.x for p in points), 'xmax': max(p.x for p in points),
        'ymin': min(p.y for p in points), 'ymax': max(p.y for p in points),
        'zmin': min(p.z for p in points), 'zmax': max(p.z for p in points),
    }


def face_islands(obj, face_indices: list[int]) -> list[list[int]]:
    """指定した面のうち、頂点を共有してつながっているものをまとめる。"""
    parent: dict[int, int] = {}

    def find(a: int) -> int:
        while parent.setdefault(a, a) != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    mesh = obj.data
    by_vertex: dict[int, list[int]] = defaultdict(list)
    for index in face_indices:
        parent.setdefault(index, index)
        for vertex in mesh.polygons[index].vertices:
            by_vertex[vertex].append(index)
    for faces in by_vertex.values():
        root = find(faces[0])
        for other in faces[1:]:
            other_root = find(other)
            if other_root != root:
                parent[other_root] = root
                root = find(root)

    islands: dict[int, list[int]] = defaultdict(list)
    for index in face_indices:
        islands[find(index)].append(index)
    return list(islands.values())


def island_bbox(obj, faces: list[int]) -> dict:
    mesh = obj.data
    matrix = obj.matrix_world
    points = [matrix @ mesh.vertices[v].co for f in faces for v in mesh.polygons[f].vertices]
    return {
        'xmin': min(p.x for p in points), 'xmax': max(p.x for p in points),
        'ymin': min(p.y for p in points), 'ymax': max(p.y for p in points),
        'zmin': min(p.z for p in points), 'zmax': max(p.z for p in points),
    }


def source_color(material) -> tuple[float, float, float]:
    """元マテリアルの色。Cars Pack はノード無し、Public Transport は Cycles ノード。"""
    if material.use_nodes:
        for node in material.node_tree.nodes:
            for key in ('Base Color', 'Color'):
                if node.type in ('BSDF_PRINCIPLED', 'BSDF_DIFFUSE', 'EMISSION') and key in node.inputs:
                    value = node.inputs[key].default_value
                    return (value[0], value[1], value[2])
    return tuple(material.diffuse_color[:3])  # type: ignore[return-value]


def make_principled(name: str, color: tuple[float, float, float], role: str):
    """役割名を持つ Principled BSDF マテリアルを新規に作る。

    Diffuse BSDF / ノード無しのどちらの元マテリアルも、ここで glTF が素直に
    書き出せる形へ揃える。ガラスも透過させず不透明のままにして、
    Web での描画順の問題を避ける。
    """
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    tree = material.node_tree
    for node in list(tree.nodes):
        tree.nodes.remove(node)
    bsdf = tree.nodes.new('ShaderNodeBsdfPrincipled')
    output = tree.nodes.new('ShaderNodeOutputMaterial')
    tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = ROUGHNESS.get(role, DEFAULT_ROUGHNESS)
    bsdf.inputs['Alpha'].default_value = 1.0
    if role in EMISSIVE_ROLES:
        # ライト類はわずかに自発光させて、影の中でも光っている粒として読めるようにする。
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.35
    material.blend_method = 'OPAQUE'
    return material


def convert(vehicle: Vehicle, source_dir: str, out_dir: str) -> dict:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.open_mainfile(filepath=os.path.join(source_dir, vehicle.blend))

    body = bpy.data.objects[vehicle.body_object]
    wheels = [o for o in bpy.data.objects if o.type == 'MESH' and 'wheel' in o.name.lower()]
    if not wheels:
        raise SystemExit(f'{vehicle.vehicle_id}: ホイールのオブジェクトが見つからない')

    # --- 1. 向き・スケール・接地の正規化 ---------------------------------
    # 元ファイルは適用前のスケール・位置を持つものがあるため、まず全オブジェクトへ
    # 回転とスケールを重ねてから apply する。
    # 元ファイルには回転・スケールが適用済みでないオブジェクトがある（Ambulanceの
    # 車体は scale 1.938）。ローカルのeuler/scaleを触ると既存の回転と混ざるので、
    # ワールド行列へ直接掛けてから apply する。
    transform = Matrix.Scale(vehicle.scale, 4) @ Matrix.Rotation(math.radians(vehicle.yaw_deg), 4, 'Z')
    for obj in [body, *wheels]:
        obj.matrix_world = transform @ obj.matrix_world

    bpy.ops.object.select_all(action='DESELECT')
    for obj in [body, *wheels]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # 接地はタイヤの下端。左右・前後は車体の中心へ寄せる。
    wheel_box = world_bbox(wheels)
    body_box = world_bbox([body])
    offset = Vector((
        -(body_box['xmin'] + body_box['xmax']) / 2,
        -(body_box['ymin'] + body_box['ymax']) / 2,
        -wheel_box['zmin'],
    ))
    for obj in [body, *wheels]:
        obj.matrix_world = Matrix.Translation(offset) @ obj.matrix_world
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [body, *wheels]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

    # --- 2. ホイール位置の実測（削除前に採る） ---------------------------
    # Blender の -Y が前、Z が上。glTF では +Z が前、Y が上になる。
    # 車種によって前輪が左右別オブジェクト（Cars Pack）だったり1つに統合
    # （Public Transport）だったりするので、前後の位置で2群に分けてから測る。
    def wheel_z(wheel) -> float:
        box = world_bbox([wheel])
        return -(box['ymin'] + box['ymax']) / 2

    boundary = (max(wheel_z(w) for w in wheels) + min(wheel_z(w) for w in wheels)) / 2
    front_wheels = [w for w in wheels if wheel_z(w) > boundary]
    rear_wheels = [w for w in wheels if wheel_z(w) <= boundary]

    def axle(group) -> dict:
        box = world_bbox(group)
        # 左右のタイヤの「中心」を採る。左右が1オブジェクトに統合されている車種でも
        # 使えるよう、頂点を左右に分けてそれぞれの幅の中点を見る。
        points = [obj.matrix_world @ vertex.co for obj in group for vertex in obj.data.vertices]
        sides = []
        for keep in (lambda x: x > 0, lambda x: x < 0):
            xs = [p.x for p in points if keep(p.x)]
            if xs:
                sides.append(((min(xs) + max(xs)) / 2, max(xs) - min(xs)))
        return {
            'z': round(-(box['ymin'] + box['ymax']) / 2, 4),
            'halfTrack': round(sum(abs(center) for center, _ in sides) / len(sides), 4),
            'wheelWidth': round(sum(width for _, width in sides) / len(sides), 4),
            'radius': round((box['zmax'] - box['zmin']) / 2, 4),
        }

    front = axle(front_wheels)
    rear = axle(rear_wheels)

    # --- 3. 元タイヤを削除 ------------------------------------------------
    # マテリアル単位ではなくオブジェクト単位で消すので、同じ Black / Grey を使う
    # ドアミラー・クラッディング・ルーフレールは車体に残る。
    for wheel in wheels:
        bpy.data.objects.remove(wheel, do_unlink=True)

    # --- 4. 面グループの切り出し（パトランプ・タクシーサイン） -----------
    mesh = body.data
    extra_slots: dict[str, int] = {}
    for new_name, source_name, predicate in vehicle.face_groups:
        slot_index = next(
            (i for i, s in enumerate(body.material_slots) if s.material and s.material.name == source_name),
            None,
        )
        if slot_index is None:
            raise SystemExit(f'{vehicle.vehicle_id}: {source_name} が見つからない')
        candidates = [p.index for p in mesh.polygons if p.material_index == slot_index]
        selected = [f for island in face_islands(body, candidates) if predicate(island_bbox(body, island)) for f in island]
        if not selected:
            raise SystemExit(f'{vehicle.vehicle_id}: {new_name} に該当する面が無い')
        placeholder = bpy.data.materials.new(name=f'__{new_name}')
        body.data.materials.append(placeholder)
        extra_slots[new_name] = len(body.material_slots) - 1
        for face in selected:
            mesh.polygons[face].material_index = extra_slots[new_name]

    # --- 5. マテリアルを役割名の Principled BSDF へ作り直す ---------------
    used_slots = {p.material_index for p in mesh.polygons}
    roles: dict[str, str] = {}
    for index, slot in enumerate(body.material_slots):
        if slot.material is None:
            continue
        name = slot.material.name
        if name.startswith('__'):
            role = name[2:]
            # 切り出した面の色は元マテリアルから引き継ぐ。
            origin = next(s for n, s, _ in vehicle.face_groups if n == role)
            color = source_color(bpy.data.materials[origin])
        else:
            role = vehicle.materials.get(name)
            if role is None:
                # 面が1つも割り当てられていない未使用スロットは無視してよい。
                if index not in used_slots:
                    continue
                raise SystemExit(f'{vehicle.vehicle_id}: マテリアル {name} の役割が未定義')
            color = source_color(slot.material)
        if index not in used_slots:
            continue
        slot.material = make_principled(role, color, role)
        roles[role] = f'#{"".join(f"{round(min(1.0, max(0.0, c)) ** (1 / 2.2) * 255):02x}" for c in color)}'

    # 面を持たない空スロットを落として、GLBに使われないマテリアルを残さない。
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.material_slot_remove_unused()

    body.name = vehicle.vehicle_id
    body.data.name = vehicle.vehicle_id

    # --- 6. 書き出し ------------------------------------------------------
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f'{vehicle.vehicle_id}.glb')
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_apply=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_texcoords=False,
        # 元データに残っている頂点カラーは使わない。書き出すとGLBが倍近く膨らむうえ、
        # Three.js側で baseColor へ乗算されてボディカラー変更を濁らせる。
        export_vertex_color='NONE',
        export_all_vertex_colors=False,
        export_normals=True,
        export_tangents=False,
        export_extras=False,
    )

    final = world_bbox([body])
    triangles = sum(len(p.vertices) - 2 for p in body.data.polygons)

    # キャビン（窓のかたまり）の位置。屋根パーツや飾りの取り付け基準を
    # 手打ちの比率ではなくモデルの実測から出すために使う。
    glass_slot = next(
        (i for i, s in enumerate(body.material_slots) if s.material and s.material.name == ROLE_GLASS),
        None,
    )
    glass_faces = [p.index for p in body.data.polygons if p.material_index == glass_slot]
    glass = island_bbox(body, glass_faces)
    return {
        'id': vehicle.vehicle_id,
        'pack': vehicle.pack,
        'sourceModel': vehicle.source_model,
        'appliedScale': vehicle.scale,
        'appliedYawDeg': vehicle.yaw_deg,
        'triangles': triangles,
        'bytes': os.path.getsize(out_path),
        # glTF 座標系（Y上・+Z前）での寸法。
        'size': {
            'width': round(final['xmax'] - final['xmin'], 4),
            'height': round(final['zmax'] - final['zmin'], 4),
            'length': round(final['ymax'] - final['ymin'], 4),
        },
        # 車体下端の地上高（タイヤ接地面を0とする）。Phase 3 で車高・タイヤ径を
        # 決めるときの下限の目安になる。
        'bodyFloor': round(final['zmin'], 4),
        'wheels': {'front': front, 'rear': rear},
        # 窓の広がりから求めたキャビン。glTF座標系（+Zが前）。
        'cabin': {
            'centerZ': round(-(glass['ymin'] + glass['ymax']) / 2, 4),
            'length': round(glass['ymax'] - glass['ymin'], 4),
            'width': round(glass['xmax'] - glass['xmin'], 4),
            'floorY': round(glass['zmin'], 4),
        },
        'materials': roles,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    parser.add_argument('--source-dir', default=None, help='Quaternius公式の .blend を置いたディレクトリ')
    parser.add_argument('--out-dir', default=os.path.join(repo_root, 'public', 'models', 'car-builder'))
    parser.add_argument('--metrics', default=None, help='実測値をJSONで書き出す先')
    args = parser.parse_args()

    source_dir = args.source_dir
    if source_dir is None:
        source_dir = os.path.join(repo_root, '.cache', 'quaternius-blends')
        print(f'--source-dir 未指定のため公式配布元から取得します: {source_dir}')
        download_sources(source_dir)

    metrics = []
    for vehicle in VEHICLES:
        print(f'convert {vehicle.vehicle_id} <- {vehicle.blend}')
        metrics.append(convert(vehicle, source_dir, args.out_dir))

    payload = json.dumps(metrics, indent=2, ensure_ascii=False)
    if args.metrics:
        with open(args.metrics, 'w', encoding='utf-8') as out:
            out.write(payload + '\n')
    print(payload)
    return 0


if __name__ == '__main__':
    sys.exit(main())
