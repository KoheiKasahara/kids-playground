"""品質確認用のレンダリング（多方向の静止画・動画・コンタクトシート）。

ゲームと同じ光の当たり方を再現する必要はなく、形の破綻・関節の曲がり・足の接地を
目で確かめられることを優先する。Cycles（CPU）で GPU なしのクラウド環境でも動く。
"""

from __future__ import annotations

import math
import os
import shutil
import subprocess
from typing import Iterable, Sequence

import bpy  # type: ignore[import-not-found]
from mathutils import Vector  # type: ignore[import-not-found]

VIEWS = {
    # 名前: (方位角[度]（0=正面 -Y 側から見る）, 仰角[度])
    'front': (0, 8),
    'front34': (40, 20),
    'side': (90, 6),
    'back34': (145, 22),
    'back': (180, 8),
    'top': (60, 62),
}


def setup_scene(resolution: tuple[int, int] = (640, 480), engine: str = 'CYCLES', samples: int = 24,
                ground: bool = True, ground_color=(0.42, 0.62, 0.32, 1)) -> None:
    scene = bpy.context.scene
    scene.render.engine = engine
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    if engine == 'CYCLES':
        scene.cycles.samples = samples
        scene.cycles.device = 'CPU'
        scene.cycles.use_denoising = True
        scene.cycles.max_bounces = 3
    elif engine == 'BLENDER_WORKBENCH':
        scene.display.shading.light = 'STUDIO'
        scene.display.shading.color_type = 'VERTEX'
        scene.display.shading.show_shadows = True
        scene.display.shading.show_cavity = False
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('qa-world') if scene.world is None else scene.world
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.78, 0.88, 1.0, 1)
    bg.inputs['Strength'].default_value = 0.9
    if 'qa-sun' not in bpy.data.objects:
        sun_data = bpy.data.lights.new('qa-sun', 'SUN')
        sun_data.energy = 3.2
        sun_data.angle = math.radians(8)
        sun = bpy.data.objects.new('qa-sun', sun_data)
        sun.rotation_euler = (math.radians(42), math.radians(-18), math.radians(-35))
        scene.collection.objects.link(sun)
    if ground and 'qa-ground' not in bpy.data.objects:
        mesh = bpy.data.meshes.new('qa-ground')
        s = 30
        mesh.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
        obj = bpy.data.objects.new('qa-ground', mesh)
        mat = bpy.data.materials.new('qa-ground')
        mat.use_nodes = True
        mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = ground_color
        mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
        mesh.materials.append(mat)
        scene.collection.objects.link(obj)


def grid_floor(spacing: float = 0.25, extent: float = 6.0) -> None:
    """足の滑りを目視しやすいよう、地面に細い線を並べる。"""
    if 'qa-grid' in bpy.data.objects:
        return
    verts, faces = [], []
    n = int(extent / spacing)
    w = 0.008
    z = 0.002
    for i in range(-n, n + 1):
        c = i * spacing
        a = len(verts)
        verts += [(c - w, -extent, z), (c + w, -extent, z), (c + w, extent, z), (c - w, extent, z)]
        verts += [(-extent, c - w, z), (extent, c - w, z), (extent, c + w, z), (-extent, c + w, z)]
        faces += [(a, a + 1, a + 2, a + 3), (a + 4, a + 5, a + 6, a + 7)]
    mesh = bpy.data.meshes.new('qa-grid')
    mesh.from_pydata(verts, [], faces)
    mat = bpy.data.materials.new('qa-grid')
    mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.2, 0.35, 0.15, 1)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new('qa-grid', mesh)
    bpy.context.scene.collection.objects.link(obj)


def camera(name: str = 'qa-cam') -> bpy.types.Object:
    if name in bpy.data.objects:
        return bpy.data.objects[name]
    data = bpy.data.cameras.new(name)
    cam = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    return cam


def aim(cam: bpy.types.Object, target: Sequence[float], azimuth: float, elevation: float, distance: float,
        lens: float = 50.0, ortho: float | None = None) -> None:
    az = math.radians(azimuth)
    el = math.radians(elevation)
    t = Vector(target)
    # 方位角 0 は動物の正面（-Y 側）から見る。90 は動物の左側（+X 側）から見る。
    offset = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * distance
    cam.location = t + offset
    direction = t - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    if ortho:
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = ortho
    else:
        cam.data.type = 'PERSP'
        cam.data.lens = lens
    cam.data.clip_end = 200


def render_still(path: str) -> str:
    scene = bpy.context.scene
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def render_views(out_dir: str, target: Sequence[float], distance: float, views: Iterable[str] = VIEWS,
                 prefix: str = 'view', lens: float = 50.0) -> list[str]:
    os.makedirs(out_dir, exist_ok=True)
    cam = camera()
    paths = []
    for name in views:
        az, el = VIEWS[name]
        aim(cam, target, az, el, distance, lens=lens)
        paths.append(render_still(os.path.join(out_dir, f'{prefix}-{name}.png')))
    return paths


def contact_sheet(paths: Sequence[str], out: str, columns: int = 3) -> str | None:
    """ffmpeg があれば静止画を1枚に並べる（なければ個別画像のみ）。"""
    if not shutil.which('ffmpeg') or not paths:
        return None
    rows = math.ceil(len(paths) / columns)
    inputs = []
    for p in paths:
        inputs += ['-i', p]
    pad = columns * rows - len(paths)
    filt = ''.join(f'[{i}:v]' for i in range(len(paths)))
    if pad:
        filt = ''.join(f'[{i}:v]' for i in range(len(paths)))
        for i in range(pad):
            inputs += ['-i', paths[-1]]
            filt += f'[{len(paths) + i}:v]'
    filt += f'xstack=inputs={columns * rows}:layout='
    cells = []
    for i in range(columns * rows):
        cx, cy = i % columns, i // columns
        x = '+'.join(['w0'] * cx) or '0'
        y = '+'.join(['h0'] * cy) or '0'
        cells.append(f'{x}_{y}')
    filt += '|'.join(cells)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', filt, out], check=True)
    return out


def render_animation(out_path: str, frame_start: int, frame_end: int, fps: int = 30) -> str:
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end = frame_start, frame_end
    scene.render.fps = fps
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.ffmpeg.constant_rate_factor = 'MEDIUM'
    scene.render.filepath = out_path
    bpy.ops.render.render(animation=True)
    return out_path


# ---------------------------------------------------------------------------
# モーションの検査


def foot_slide_report(clip, cycles: int = 2, samples_per_cycle: int = 120) -> dict:
    """接地中の足裏が地面に対してどれだけ動くかを、ゲームと同じ前提（胴体を歩容どおりに動かす）で測る。

    返り値の slide は接地1回あたりの最大移動量[m]、speed は最大の滑り速度[m/s]、
    reach は IK が目標に届かなかった最大距離[m]。
    """
    import math as _m

    from mathutils import Matrix as _Mx, Vector as _V  # type: ignore[import-not-found]

    gait = clip.gait
    period = gait.period
    n = samples_per_cycle * cycles
    dt = period * cycles / n
    out = {}
    prev = {}
    acc = {k: 0.0 for k in gait.legs}
    worst = {k: {'slide': 0.0, 'speed': 0.0, 'reach': 0.0} for k in gait.legs}
    for i in range(n + 1):
        t = i * dt
        pose = clip.sample(t % period if clip.loop else t)
        posed = pose.posed()
        body_p, th = gait.body_at(t)
        world = _Mx.Translation(body_p) @ _Mx.Rotation(th, 4, 'Z')
        for key, leg in gait.legs.items():
            foot = posed[leg.foot]
            sole = world @ (foot @ _V((0, 0, 0)) + _V((0, 0, -leg.toe_drop)))
            target, _, _, _ = gait.foot(key, t % period)
            reach = (foot.translation.xy - target.xy).length if gait.stance_weight(key, t % period) else 0.0
            worst[key]['reach'] = max(worst[key]['reach'], reach)
            if gait.stance_weight(key, t % period) and key in prev:
                d = (sole.xy - prev[key].xy).length
                acc[key] += d
                worst[key]['speed'] = max(worst[key]['speed'], d / dt)
                worst[key]['slide'] = max(worst[key]['slide'], acc[key])
            else:
                acc[key] = 0.0
            prev[key] = sole
    for key, w in worst.items():
        out[key] = {k: round(v, 4) for k, v in w.items()}
    out['max_slide'] = max(w['slide'] for w in worst.values())
    out['max_reach_error'] = max(w['reach'] for w in worst.values())
    return out


def render_frames(out_dir: str, frames, armature, action) -> list[str]:
    """frames: [(アクションのフレーム, (x, y), 向き[rad])]。胴体を地面上で動かしながら静止画を連番で書き出す。"""
    os.makedirs(out_dir, exist_ok=True)
    armature.animation_data.action = action
    scene = bpy.context.scene
    paths = []
    for i, (f, xy, th) in enumerate(frames):
        scene.frame_set(int(f), subframe=f - int(f))
        armature.location = (xy[0], xy[1], 0)
        armature.rotation_euler = (0, 0, th)
        bpy.context.view_layer.update()
        paths.append(render_still(os.path.join(out_dir, f'f{i:04d}.png')))
    armature.location = (0, 0, 0)
    armature.rotation_euler = (0, 0, 0)
    return paths


def encode_video(frame_dir: str, out: str, fps: int = 30) -> str | None:
    if not shutil.which('ffmpeg'):
        return None
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i',
                    os.path.join(frame_dir, 'f%04d.png'), '-pix_fmt', 'yuv420p', '-vf',
                    'scale=trunc(iw/2)*2:trunc(ih/2)*2', out], check=True)
    return out


def strip_sheet(paths: Sequence[str], out: str, count: int = 8, columns: int = 4) -> str | None:
    if not paths:
        return None
    step = max(1, len(paths) // count)
    pick = list(paths[::step])[:count]
    return contact_sheet(pick, out, columns=columns)
