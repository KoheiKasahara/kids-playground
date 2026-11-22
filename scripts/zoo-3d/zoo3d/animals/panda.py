# lion から作成した panda の土台を、パンダの個別仕様に書き換えたもの。
"""パンダ: まるい白い体に黒い脚・肩の帯・耳・目のまわり。大きな頭とずんぐりした体型。

白と黒の境目をなめらかにするため、黒い部位（脚・肩の帯・耳）は白い体に重なる別の形として作り、
両方を自動ウェイトの対象にする（面の色分けだと境目がギザギザになる）。
右前足の掌に、竹を持つための骨 hold_r（変形には使わない）を置く。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'panda'
WHITE = '#F6F3EA'
BLACK = '#2C2C34'
PALETTE = {'body': WHITE, 'head': WHITE, 'muzzle': '#FBF8F1', 'tail': WHITE, 'black': BLACK}
BLUSH = '#F6B3C2'

LEG_X = 0.2
FRONT_Y = -0.3
HIND_Y = 0.33
JOINTS = {
    'front': {'top': (FRONT_Y + 0.02, 0.6), 'mid': (FRONT_Y + 0.09, 0.32), 'low': (FRONT_Y, 0.1), 'toe': (FRONT_Y - 0.13, 0.03)},
    'hind': {'top': (HIND_Y, 0.58), 'mid': (HIND_Y - 0.09, 0.32), 'low': (HIND_Y + 0.03, 0.1), 'toe': (HIND_Y - 0.12, 0.03)},
}
HEAD_CENTER = (0, -0.62, 0.9)


def body() -> Body:
    """白い部分: 胴・頭・鼻先・しっぽ。"""
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', (0, 0.02, 0.62), (0.34, 0.5, 0.34))
    b.ellipsoid('chest', 'body', (0, -0.24, 0.64), (0.33, 0.3, 0.34), blend=0.15)
    b.ellipsoid('rump', 'body', (0, 0.3, 0.6), (0.33, 0.3, 0.33), blend=0.15)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.31, 0.27, 0.29), blend=0.12)
    for s in (1, -1):
        b.ellipsoid(f'cheek{s}', 'head', (0.15 * s, -0.74, 0.82), (0.15, 0.13, 0.13), blend=0.06)
    b.ellipsoid('muzzle', 'muzzle', (0, -0.86, 0.82), (0.13, 0.1, 0.095), blend=0.05)
    b.ellipsoid('tail', 'tail', (0, 0.58, 0.66), (0.075, 0.065, 0.075), blend=0.04)
    return b


def black_parts() -> Body:
    """黒い部分: 肩の帯（胴を少しふくらませた形を帯の範囲で切り出す）・4本の脚・耳。"""
    k = Body(floor=0.0)
    # 白い胴（胴＋胸）と同じ形を 2cm ふくらませ、肩のあたりの帯だけを切り出す
    k.ellipsoid('band_torso', 'black', (0, 0.02, 0.62), (0.36, 0.52, 0.36))
    k.ellipsoid('band_chest', 'black', (0, -0.24, 0.64), (0.35, 0.32, 0.36), blend=0.15)
    k.ellipsoid('band_cut', 'black', (0, -0.28, 0.66), (0.8, 0.14, 0.8), intersect=True, blend=0.03)
    for s in (1, -1):
        x = LEG_X * s
        k.ellipsoid(f'shoulder{s}', 'black', (x, FRONT_Y + 0.02, 0.5), (0.15, 0.17, 0.2), blend=0.08)
        k.cone(f'fl_u{s}', 'black', (x, FRONT_Y + 0.02, 0.55), (x, FRONT_Y + 0.05, 0.28), 0.13, 0.115, blend=0.06)
        k.cone(f'fl_l{s}', 'black', (x, FRONT_Y + 0.05, 0.28), (x, FRONT_Y, 0.1), 0.115, 0.11, blend=0.04)
        k.ellipsoid(f'fpaw{s}', 'black', (x, FRONT_Y - 0.04, 0.07), (0.12, 0.14, 0.08), blend=0.04)
        k.ellipsoid(f'thigh{s}', 'black', (x, HIND_Y, 0.5), (0.15, 0.2, 0.22), blend=0.08)
        k.cone(f'hl_u{s}', 'black', (x, HIND_Y, 0.5), (x, HIND_Y - 0.04, 0.27), 0.13, 0.115, blend=0.06)
        k.cone(f'hl_l{s}', 'black', (x, HIND_Y - 0.04, 0.27), (x, HIND_Y + 0.02, 0.1), 0.115, 0.11, blend=0.04)
        k.ellipsoid(f'hpaw{s}', 'black', (x, HIND_Y - 0.04, 0.07), (0.12, 0.15, 0.08), blend=0.04)
        k.ellipsoid(f'ear{s}', 'black', (0.21 * s, -0.58, 1.13), (0.095, 0.055, 0.09), rot_deg=(0, 0, 15 * s), blend=0.02)
    return k


EYES: dict = {}


def build(target_tris: int = 3400, shading: str = 'smooth'):
    b = body()
    white = M.body_object('panda_body', b, (-0.5, -1.0, 0.0), (0.5, 0.75, 1.25), 0.014, target_tris=target_tris)
    M.paint(white, b, PALETTE)
    k = black_parts()
    black = M.body_object('panda_black', k, (-0.5, -0.75, 0.0), (0.5, 0.6, 1.3), 0.014, target_tris=2400)
    M.paint(black, k, PALETTE)
    roles = C.new_roles()
    roles['body'] += [white, black]
    # 目のまわりの黒い模様（外側が下がった涙の形）と、その上に白目・黒目
    for s in (1, -1):
        patch = M.decal(f'patch{s}', b, HEAD_CENTER, (0.47 * s, -0.8, 0.2), (0.08, 0.11, 0.022), BLACK, sink=0.45,
                        up=(-0.55 * s, 0, 1), segments=14, rings=6)
        roles['rigid'].append((patch, 'head'))
        blush = M.decal(f'blush{s}', b, HEAD_CENTER, (0.66 * s, -0.68, -0.22), (0.055, 0.04, 0.015), BLUSH, sink=0.5,
                        segments=12, rings=5)
        roles['rigid'].append((blush, 'head'))
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.47 * s, -0.8, 0.22), (0.034, 0.042, 0.026),
                      eye='#15151C', sclera='#FFFFFF')
    EYES.update(eyes)
    nose = M.decal('nose', b, (0, -0.84, 0.84), (0, -0.75, 0.6), (0.055, 0.04, 0.03), BLACK, sink=0.4,
                   up=(0, -0.6, 0.8))
    roles['rigid'].append((nose, 'head'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.05)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.3, 0)),
        BoneSpec('hips', (0, 0.33, 0.62), (0, 0.05, 0.64), 'root'),
        BoneSpec('spine_1', (0, 0.05, 0.64), (0, -0.2, 0.66), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.2, 0.66), (0, -0.4, 0.74), 'spine_1', connect=True),
        BoneSpec('neck', (0, -0.4, 0.74), (0, -0.55, 0.86), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.55, 0.86), (0, -0.9, 0.88), 'neck', connect=True),
        BoneSpec('ear_l', (0.17, -0.58, 1.05), (0.24, -0.58, 1.2), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', (0, 0.52, 0.66), (0, 0.66, 0.62), 'hips'),
        BoneSpec('front_leg_upper_l', (x, *f['top']), (x, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x, *f['mid']), (x, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, *f['low']), (x, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('hold_l', (x, FRONT_Y - 0.07, 0.07), (x, FRONT_Y - 0.13, 0.07), 'front_leg_foot_l', deform=False),
        BoneSpec('back_leg_upper_l', (x, *h['top']), (x, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x, *h['mid']), (x, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, *h['low']), (x, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck', 'head', 'ear_l', 'ear_r', 'tail_1'] + \
    [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
