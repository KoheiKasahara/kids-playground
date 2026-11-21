"""ゾウ: 大きな頭と丸い耳、柱のような太い脚、先が少し巻いた鼻を持つかわいいローポリ。

座標は Blender の Z-up・前方 -Y・メートル。左（+X）右（-X）は動物から見た向き。
"""

from __future__ import annotations

import numpy as np

from ..sdf import Body

NAME = 'elephant'

PALETTE = {
    'body': '#A9B6CB',
    'leg': '#A9B6CB',
    'head': '#ADBACE',
    'trunk': '#ADBACE',
    'tail': '#A9B6CB',
    'tuft': '#6F788A',
    'ear': '#A3B0C6',
    'ear_inner': '#F3B6C6',
    'toenail': '#F7EEDD',
    'blush': '#F6AFC1',
    'mouth': '#E9919F',
    'eye': '#24273A',
    'sparkle': '#FFFFFF',
    'tusk': '#FFF6DF',
}

# 脚の付け根・関節・足の位置。リグ（骨の配置）と形の両方がここを参照する。
LEG_X = 0.34
FRONT_Y = -0.42
HIND_Y = 0.42
# 形（柱のような脚）の芯線
LEG_SHAPE = {
    'front': {'top': (FRONT_Y + 0.02, 1.02), 'mid': (FRONT_Y + 0.05, 0.56), 'low': (FRONT_Y, 0.15)},
    'hind': {'top': (HIND_Y, 0.98), 'mid': (HIND_Y - 0.07, 0.54), 'low': (HIND_Y + 0.02, 0.15)},
}
# 骨の関節。中間の関節を少し後ろ（前脚）・前（後ろ脚）へずらし、休止姿勢でもわずかに曲げておく。
# まっすぐな脚だと、歩くときに足を前後へ出すぶん胴を下げる余裕がなく、IK が届かなくなる。
JOINTS = {
    'front': {'top': (FRONT_Y + 0.02, 1.02), 'mid': (FRONT_Y + 0.12, 0.56), 'low': (FRONT_Y, 0.15), 'toe': (FRONT_Y - 0.2, 0.04)},
    'hind': {'top': (HIND_Y, 0.98), 'mid': (HIND_Y - 0.13, 0.54), 'low': (HIND_Y + 0.02, 0.15), 'toe': (HIND_Y - 0.18, 0.04)},
}

TRUNK = [(0, -1.2, 1.44), (0, -1.36, 1.25), (0, -1.43, 1.02), (0, -1.44, 0.8), (0, -1.42, 0.6), (0, -1.47, 0.45),
         (0, -1.58, 0.38), (0, -1.68, 0.42)]
TRUNK_R = [0.2, 0.165, 0.14, 0.123, 0.11, 0.1, 0.092, 0.088]

TAIL = [(0, 0.78, 1.14), (0, 0.9, 0.94), (0, 0.94, 0.72)]

HEAD_CENTER = (0, -0.9, 1.52)


def body() -> Body:
    b = Body(floor=0.0)
    # 胴体: 前が高く後ろが少し下がる、丸い樽型
    b.ellipsoid('torso', 'body', (0, 0.02, 1.06), (0.57, 0.7, 0.58))
    b.ellipsoid('chest', 'body', (0, -0.34, 1.1), (0.53, 0.44, 0.54), blend=0.2)
    b.ellipsoid('rump', 'body', (0, 0.4, 1.02), (0.5, 0.4, 0.5), blend=0.2)
    b.ellipsoid('belly', 'body', (0, -0.02, 0.82), (0.46, 0.52, 0.3), blend=0.22)
    # 頭: 体に対して大きめにしてかわいく見せる
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.46, 0.44, 0.47), blend=0.2)
    b.ellipsoid('forehead', 'head', (0, -0.98, 1.7), (0.35, 0.3, 0.26), blend=0.15)
    for s in (1, -1):
        b.ellipsoid(f'cheek{s}', 'head', (0.2 * s, -1.08, 1.34), (0.24, 0.24, 0.22), blend=0.12)
    b.ellipsoid('chin', 'head', (0, -1.07, 1.18), (0.16, 0.16, 0.12), blend=0.1)
    # 鼻: 根元から下へ垂れ、先が前へ少し巻き上がる
    b.chain('trunk', 'trunk', TRUNK, TRUNK_R, blend=0.12)
    b.ellipsoid('trunk_tip', 'trunk', (0, -1.69, 0.43), (0.1, 0.07, 0.1), blend=0.03)
    # 脚: 太い柱。上腕・太ももの膨らみで胴とつなぐ
    for s in (1, -1):
        x = LEG_X * s
        f = LEG_SHAPE['front']
        b.ellipsoid(f'upperarm{s}', 'leg', (x * 1.02, FRONT_Y + 0.03, 0.86), (0.25, 0.28, 0.32), blend=0.14)
        b.cone(f'foreleg_u{s}', 'leg', (x, *f['top']), (x, *f['mid']), 0.24, 0.215, blend=0.12)
        b.cone(f'foreleg_l{s}', 'leg', (x, *f['mid']), (x, *f['low']), 0.215, 0.205, blend=0.06)
        b.ellipsoid(f'forefoot{s}', 'leg', (x, FRONT_Y - 0.03, 0.1), (0.225, 0.235, 0.14), blend=0.06)
        h = LEG_SHAPE['hind']
        b.ellipsoid(f'thigh{s}', 'leg', (x * 1.02, HIND_Y + 0.02, 0.84), (0.26, 0.33, 0.34), blend=0.14)
        b.cone(f'hindleg_u{s}', 'leg', (x, *h['top']), (x, *h['mid']), 0.25, 0.215, blend=0.12)
        b.cone(f'hindleg_l{s}', 'leg', (x, *h['mid']), (x, *h['low']), 0.215, 0.2, blend=0.06)
        b.ellipsoid(f'hindfoot{s}', 'leg', (x, HIND_Y - 0.02, 0.1), (0.215, 0.23, 0.14), blend=0.06)
    # 尾: 細い尾と先の房
    b.chain('tail', 'tail', TAIL, [0.05, 0.036, 0.03], blend=0.06)
    b.ellipsoid('tuft', 'tuft', (0, 0.95, 0.64), (0.055, 0.055, 0.1), blend=0.02)
    return b


EAR_RADII = (0.045, 0.38, 0.43)


def ear_rotation(side: int) -> tuple[float, float, float]:
    # 付け根（前の縁）を軸に、後ろの縁を外へ 32° 開く
    return (0.0, -8.0 * side, -32.0 * side)


def ear_center(side: int) -> tuple[float, float, float]:
    return (0.52 * side, -0.74, 1.5)


def ear_root(side: int) -> tuple[float, float, float]:
    return (0.36 * side, -0.86, 1.56)


def ear(side: int) -> Body:
    """耳: 頭の横から後ろ斜めへ広がる丸い板。前面（解剖学的な内側）をピンクに塗る。"""
    b = Body()
    b.ellipsoid('ear', 'ear', ear_center(side), EAR_RADII, rot_deg=ear_rotation(side))
    # 付け根を頭へ少しめり込ませて、継ぎ目が見えないようにする
    b.ellipsoid('ear_root', 'ear', ear_root(side), (0.06, 0.14, 0.2), rot_deg=ear_rotation(side), blend=0.08)
    return b


def ear_inner_mask(side: int):
    """耳の前面のうち、縁を残した内側だけを選ぶ関数を返す。"""
    from ..sdf import rotation_matrix

    rot = rotation_matrix(ear_rotation(side))
    anterior = rot[:, 0] * side
    center = np.asarray(ear_center(side))

    def mask(c: np.ndarray, n: np.ndarray, _r: np.ndarray) -> np.ndarray:
        local = (c - center) @ rot
        inset = (local[:, 1] / EAR_RADII[1]) ** 2 + (local[:, 2] / EAR_RADII[2]) ** 2 < 0.72 ** 2
        return inset & (n @ anterior > 0.35)

    return mask


# ---------------------------------------------------------------------------
# Blender 上での組み立て


EYES: dict[str, tuple] = {}


def build_mesh(target_tris: int = 3600, shading: str = 'smooth'):
    """ゾウの部品メッシュを作り、役割（骨の割り当て方）ごとに分けて返す。"""
    from mathutils import Vector  # type: ignore[import-not-found]

    from .. import meshing as M
    from ..sdf import rotation_matrix, surface_point

    b = body()
    obj = M.body_object('elephant_body', b, (-0.85, -1.85, 0.0), (0.85, 1.1, 2.05), 0.02, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    parts = [obj]
    roles: dict[str, list] = {'body': [obj], 'nails': [], 'head': [], 'ear_l': [], 'ear_r': [], 'eye_l': [],
                              'eye_r': []}

    # 爪: 足先の前面に3枚ずつ
    for s in (1, -1):
        for y in (FRONT_Y - 0.03, HIND_Y - 0.02):
            for k, theta in enumerate((-0.62, 0.0, 0.62)):
                d = (np.sin(theta) * s, -np.cos(theta), 0.0)
                nail = M.decal(f'nail{s}{y}{k}', b, (s * LEG_X, y, 0.075), d, (0.062, 0.05, 0.03),
                               PALETTE['toenail'], sink=0.45, segments=8, rings=4)
                parts.append(nail)
                roles['nails'].append(nail)

    for side in (1, -1):
        lr = 'l' if side > 0 else 'r'
        eb = ear(side)
        e = M.body_object(f'ear{side}', eb, np.subtract(ear_center(side), 0.5), np.add(ear_center(side), 0.5), 0.012,
                          target_tris=360, smooth=1)
        M.paint(e, eb, PALETTE)
        parts.append(e)
        roles[f'ear_{lr}'].append(e)
        # 耳の内側: 耳と同じ形を縮めて前面へ少しずらす。境界は耳の面との交線になり、なめらかな楕円に見える
        inner_b = Body()
        rot = rotation_matrix(ear_rotation(side))
        anterior = rot[:, 0] * side
        inner_center = np.asarray(ear_center(side)) + anterior * 0.008 + rot[:, 1] * 0.025 - rot[:, 2] * 0.015
        inner_b.ellipsoid('ear_inner', 'ear_inner', inner_center, (EAR_RADII[0], EAR_RADII[1] * 0.72, EAR_RADII[2] * 0.74),
                          rot_deg=ear_rotation(side))
        inner = M.body_object(f'ear_inner{side}', inner_b, inner_center - 0.5, inner_center + 0.5, 0.012,
                              target_tris=200, smooth=1)
        M.paint(inner, inner_b, PALETTE)
        parts.append(inner)
        roles[f'ear_{lr}'].append(inner)

        # 目: 縦長の黒い楕円とハイライト
        p, n = surface_point(b, HEAD_CENTER, (0.5 * side, -0.82, 0.3))
        normal = Vector(n)
        eye_m = M.look_matrix(Vector(p) - normal * 0.012, normal, scale=(0.06, 0.08, 0.032))
        eye = M.primitive('sphere', f'eye{side}', eye_m, segments=12, rings=8)
        M.solid(eye, PALETTE['eye'])
        parts.append(eye)
        roles[f'eye_{lr}'].append(eye)
        EYES[lr] = (tuple(p), tuple(n))
        x_axis = (Vector((0, 0, 1)).cross(normal)).normalized()
        up_axis = normal.cross(x_axis).normalized()
        sp = Vector(p) + up_axis * 0.03 - x_axis * 0.018 * side + normal * 0.022
        spark = M.primitive('sphere', f'sparkle{side}', M.look_matrix(sp, normal, scale=(0.019, 0.019, 0.012)),
                            segments=8, rings=5)
        M.solid(spark, PALETTE['sparkle'])
        parts.append(spark)
        roles[f'eye_{lr}'].append(spark)

        # 頬: ほんのり赤い丸
        blush = M.decal(f'blush{side}', b, HEAD_CENTER, (0.62 * side, -0.75, -0.08), (0.085, 0.06, 0.02),
                        PALETTE['blush'], sink=0.5, segments=14, rings=6)
        parts.append(blush)
        roles['head'].append(blush)

        # きば: 鼻の付け根の両脇から前下へ
        tp, tn = surface_point(b, (0.12 * side, -1.0, 1.26), (0.3 * side, -0.9, -0.25))
        direction = Vector((0.28 * side, -0.85, -0.42)).normalized()
        base = Vector(tp) - Vector(tn) * 0.02
        tusk = M.primitive('cone', f'tusk{side}', M.look_matrix(base + direction * 0.085, direction), segments=8,
                           radius1=0.045, radius2=0.012, depth=0.17)
        M.solid(tusk, PALETTE['tusk'])
        parts.append(tusk)
        roles['head'].append(tusk)

    for o in parts:
        if shading == 'flat':
            M.flat_shade(o)
        else:
            M.smooth_shade(o)
    return roles


# ---------------------------------------------------------------------------
# 骨格


def bones():
    from ..rig import BoneSpec, with_mirrors

    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    ear_c = ear_center(1)
    from ..sdf import rotation_matrix
    back = rotation_matrix(ear_rotation(1))[:, 1]
    ear_tip = tuple(np.asarray(ear_c) + back * 0.3)
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.06)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.35, 0)),
        BoneSpec('hips', (0, 0.4, 1.06), (0, 0.05, 1.08), 'root'),
        BoneSpec('spine_1', (0, 0.05, 1.08), (0, -0.3, 1.13), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.3, 1.13), (0, -0.58, 1.24), 'spine_1', connect=True),
        BoneSpec('neck', (0, -0.58, 1.24), (0, -0.8, 1.42), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.8, 1.42), (0, -1.18, 1.62), 'neck', connect=True),
    ]
    pts = [TRUNK[0], TRUNK[1], TRUNK[2], TRUNK[3], TRUNK[4], TRUNK[5], TRUNK[6], TRUNK[7]]
    parent = 'head'
    for i in range(len(pts) - 1):
        name = f'trunk_{i + 1}'
        specs.append(BoneSpec(name, pts[i], pts[i + 1], parent, connect=i > 0))
        parent = name
    specs += [
        BoneSpec('trunk_tip', TRUNK[-1], (0, TRUNK[-1][1] - 0.04, TRUNK[-1][2] + 0.04), 'trunk_7', deform=False),
        BoneSpec('ear_l', ear_root(1), ear_c, 'head'),
        BoneSpec('ear_tip_l', ear_c, ear_tip, 'ear_l', connect=True),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', TAIL[0], TAIL[1], 'hips'),
        BoneSpec('tail_2', TAIL[1], TAIL[2], 'tail_1', connect=True),
        BoneSpec('tail_3', TAIL[2], (0, 0.95, 0.55), 'tail_2', connect=True),
        BoneSpec('front_leg_upper_l', (x, *f['top']), (x, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x, *f['mid']), (x, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, *f['low']), (x, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('back_leg_upper_l', (x, *h['top']), (x, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x, *h['mid']), (x, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, *h['low']), (x, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck', 'head'] + [f'trunk_{i}' for i in range(1, 8)] + \
    ['tail_1', 'tail_2', 'tail_3'] + [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot')
                                     for s in ('l', 'r')]


def build(target_tris: int = 3600, shading: str = 'smooth'):
    """メッシュと骨格を作り、ウェイトを付けて結合する。返り値は (メッシュ, 骨格)。"""
    from .. import meshing as M
    from .. import rig as R
    from ..sdf import rotation_matrix

    roles = build_mesh(target_tris, shading)
    arm = R.build_armature(f'{NAME}_rig', bones())
    body_obj = roles['body'][0]
    R.auto_weights(body_obj, arm, BODY_BONES)
    for o in roles['nails']:
        R.copy_nearest_weights(o, body_obj)
    for o in roles['head']:
        R.rigid_weights(o, 'head')
    for lr, side in (('l', 1), ('r', -1)):
        back = rotation_matrix(ear_rotation(side))[:, 1]
        c = np.asarray(ear_center(side))
        chain = [(f'ear_{lr}', ear_root(side), tuple(c)), (f'ear_tip_{lr}', tuple(c), tuple(c + back * 0.3))]
        for o in roles[f'ear_{lr}']:
            R.chain_weights(o, chain, root_bone='head', root_falloff=0.1)
        for o in roles[f'eye_{lr}']:
            R.rigid_weights(o, f'eye_{lr}')
    for o in [p for objs in roles.values() for p in objs]:
        o.parent = None
        for m in list(o.modifiers):
            o.modifiers.remove(m)
    order = [body_obj] + [p for k, objs in roles.items() if k != 'body' for p in objs]
    mesh = M.join(order, NAME)
    R.limit_influences(mesh)
    mesh.data.materials.clear()
    mesh.data.materials.append(M.vertex_color_material(NAME))
    R.bind(mesh, arm)
    return mesh, arm
