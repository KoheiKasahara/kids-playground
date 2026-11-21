"""符号付き距離関数（SDF）で動物の体型を組み立て、Surface Nets でメッシュ化する。

Blender に依存しない純粋な numpy 実装にしておくと、形の定義だけを素早く試せる。
距離はすべてメートル、座標は Blender と同じ Z-up・前方 -Y。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Sequence

import numpy as np

Vec3 = Sequence[float]


def _v(p: Vec3) -> np.ndarray:
    return np.asarray(p, dtype=np.float64)


def rotation_matrix(euler_deg: Vec3) -> np.ndarray:
    """XYZ オイラー角（度）から回転行列。Blender の既定順序と同じ。"""
    rx, ry, rz = (np.radians(a) for a in euler_deg)
    cx, sx, cy, sy, cz, sz = np.cos(rx), np.sin(rx), np.cos(ry), np.sin(ry), np.cos(rz), np.sin(rz)
    mx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    my = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    mz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return mz @ my @ mx


# ---------------------------------------------------------------------------
# プリミティブ。どれも (N,3) の点群を受け取り (N,) の距離を返す。


def sd_ellipsoid(p: np.ndarray, center: Vec3, radii: Vec3, rot: np.ndarray | None = None) -> np.ndarray:
    q = p - _v(center)
    if rot is not None:
        q = q @ rot  # ワールド→ローカル（回転行列の転置を右から掛ける）
    r = _v(radii)
    k0 = np.linalg.norm(q / r, axis=1)
    k1 = np.linalg.norm(q / (r * r), axis=1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def sd_round_cone(p: np.ndarray, a: Vec3, b: Vec3, r1: float, r2: float) -> np.ndarray:
    """両端の半径が異なるカプセル（Inigo Quilez の round cone）。"""
    a = _v(a)
    b = _v(b)
    ba = b - a
    l2 = float(ba @ ba)
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = p - a
    y = pa @ ba
    z = y - l2
    xv = pa * l2 - np.outer(y, ba)
    x2 = np.einsum('ij,ij->i', xv, xv)
    y2 = y * y * l2
    z2 = z * z * l2
    k = np.sign(rr) * rr * rr * x2
    d_b = np.sqrt(x2 + z2) * il2 - r2
    d_a = np.sqrt(x2 + y2) * il2 - r1
    d_m = (np.sqrt(np.maximum(x2 * a2 * il2, 0.0)) + y * rr) * il2 - r1
    return np.where(np.sign(z) * a2 * z2 > k, d_b, np.where(np.sign(y) * a2 * y2 < k, d_a, d_m))


def smin(a: np.ndarray, b: np.ndarray, k: float) -> np.ndarray:
    """多項式スムーズ最小値。k が大きいほど継ぎ目がなだらかになる。"""
    if k <= 0:
        return np.minimum(a, b)
    h = np.maximum(k - np.abs(a - b), 0.0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def smax(a: np.ndarray, b: np.ndarray, k: float) -> np.ndarray:
    return -smin(-a, -b, k)


# ---------------------------------------------------------------------------
# 形の組み立て


@dataclass
class Part:
    """名前付きの部位。region は色分けと骨の割り当てに使う。"""

    name: str
    region: str
    fn: Callable[[np.ndarray], np.ndarray]
    blend: float = 0.08
    subtract: bool = False


@dataclass
class Body:
    parts: list[Part] = field(default_factory=list)
    floor: float | None = None  # 足裏を平らにする高さ（None なら切らない）

    def add(self, part: Part) -> 'Body':
        self.parts.append(part)
        return self

    def ellipsoid(self, name: str, region: str, center: Vec3, radii: Vec3, rot_deg: Vec3 | None = None,
                  blend: float = 0.08, subtract: bool = False) -> 'Body':
        rot = rotation_matrix(rot_deg) if rot_deg is not None else None
        return self.add(Part(name, region, lambda p: sd_ellipsoid(p, center, radii, rot), blend, subtract))

    def cone(self, name: str, region: str, a: Vec3, b: Vec3, r1: float, r2: float, blend: float = 0.08,
             subtract: bool = False) -> 'Body':
        return self.add(Part(name, region, lambda p: sd_round_cone(p, a, b, r1, r2), blend, subtract))

    def chain(self, name: str, region: str, points: Sequence[Vec3], radii: Sequence[float],
              blend: float = 0.08) -> 'Body':
        """折れ線に沿ってテーパーするカプセルを連ねる（鼻・尾・首など）。"""
        for i in range(len(points) - 1):
            self.cone(f'{name}.{i}', region, points[i], points[i + 1], radii[i], radii[i + 1],
                      blend=blend if i == 0 else 0.02)
        return self

    def evaluate(self, p: np.ndarray) -> tuple[np.ndarray, list[np.ndarray]]:
        """合成後の距離と、部位ごとの生の距離（色分け用）を返す。"""
        d = np.full(len(p), 1e9)
        raw: list[np.ndarray] = []
        for part in self.parts:
            di = part.fn(p)
            raw.append(di)
            d = smax(d, -di, part.blend) if part.subtract else smin(d, di, part.blend)
        if self.floor is not None:
            d = smax(d, self.floor - p[:, 2], 0.03)
        return d, raw

    def region_of(self, p: np.ndarray) -> np.ndarray:
        """各点に最も近い（減算でない）部位の region 名を返す。"""
        names = [pt.region for pt in self.parts if not pt.subtract]
        dists = np.stack([pt.fn(p) for pt in self.parts if not pt.subtract], axis=1)
        return np.asarray(names, dtype=object)[np.argmin(dists, axis=1)]


# ---------------------------------------------------------------------------
# Surface Nets


_CORNERS = np.array([[i & 1, (i >> 1) & 1, (i >> 2) & 1] for i in range(8)], dtype=np.float64)
_EDGES = [(0, 1), (2, 3), (4, 5), (6, 7), (0, 2), (1, 3), (4, 6), (5, 7), (0, 4), (1, 5), (2, 6), (3, 7)]


def surface_nets(field_fn: Callable[[np.ndarray], np.ndarray], lo: Vec3, hi: Vec3, h: float):
    """距離場をメッシュ化する。返り値は (頂点 (N,3), 四角形 (M,4))。法線は外向き。"""
    lo = _v(lo) - 2 * h
    hi = _v(hi) + 2 * h
    n = np.ceil((hi - lo) / h).astype(int) + 1
    xs, ys, zs = (lo[i] + h * np.arange(n[i]) for i in range(3))
    grid = np.stack(np.meshgrid(xs, ys, zs, indexing='ij'), axis=-1).reshape(-1, 3)
    sdf = field_fn(grid).reshape(n)

    nx, ny, nz = n
    corners = [sdf[c[0]:nx - 1 + c[0], c[1]:ny - 1 + c[1], c[2]:nz - 1 + c[2]] for c in _CORNERS.astype(int)]
    inside = [c < 0 for c in corners]
    any_in = np.logical_or.reduce(inside)
    all_in = np.logical_and.reduce(inside)
    active = any_in & ~all_in

    acc = np.zeros(active.shape + (3,))
    cnt = np.zeros(active.shape)
    for a, b in _EDGES:
        va, vb = corners[a], corners[b]
        cross = (va < 0) != (vb < 0)
        denom = np.where(cross, va - vb, 1.0)
        t = np.clip(np.where(cross, va / denom, 0.0), 0.0, 1.0)
        pos = _CORNERS[a] + t[..., None] * (_CORNERS[b] - _CORNERS[a])
        acc += np.where(cross[..., None], pos, 0.0)
        cnt += cross
    idx = np.argwhere(active)
    local = acc[active] / cnt[active][:, None]
    verts = lo + h * (idx + local)

    vid = np.full(active.shape, -1, dtype=np.int64)
    vid[active] = np.arange(len(idx))

    s = sdf < 0
    quads = []
    # x 方向の辺: 面内の軸は (y, z)
    e = s[:-1, 1:-1, 1:-1] != s[1:, 1:-1, 1:-1]
    i, j, k = np.nonzero(e)
    j += 1
    k += 1
    q = np.stack([vid[i, j - 1, k - 1], vid[i, j, k - 1], vid[i, j, k], vid[i, j - 1, k]], axis=1)
    quads.append(np.where(s[i, j, k][:, None], q, q[:, ::-1]))
    # y 方向の辺: 面内の軸は (z, x)
    e = s[1:-1, :-1, 1:-1] != s[1:-1, 1:, 1:-1]
    i, j, k = np.nonzero(e)
    i += 1
    k += 1
    q = np.stack([vid[i - 1, j, k - 1], vid[i - 1, j, k], vid[i, j, k], vid[i, j, k - 1]], axis=1)
    quads.append(np.where(s[i, j, k][:, None], q, q[:, ::-1]))
    # z 方向の辺: 面内の軸は (x, y)
    e = s[1:-1, 1:-1, :-1] != s[1:-1, 1:-1, 1:]
    i, j, k = np.nonzero(e)
    i += 1
    j += 1
    q = np.stack([vid[i - 1, j - 1, k], vid[i, j - 1, k], vid[i, j, k], vid[i - 1, j, k]], axis=1)
    quads.append(np.where(s[i, j, k][:, None], q, q[:, ::-1]))
    faces = np.concatenate(quads, axis=0)
    faces = faces[(faces >= 0).all(axis=1)]
    return verts, faces


def surface_point(body: Body, origin: Vec3, direction: Vec3, max_dist: float = 2.0) -> tuple[np.ndarray, np.ndarray]:
    """内側の点から direction へ進み、表面と交わる点とその法線を返す（目・きばの配置用）。"""
    o = _v(origin)
    d = _v(direction) / np.linalg.norm(direction)
    f = lambda t: body.evaluate((o + d * t)[None, :])[0][0]  # noqa: E731
    lo, hi = 0.0, max_dist
    if f(lo) > 0:
        raise ValueError('origin must be inside the body')
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        if f(mid) > 0:
            hi = mid
        else:
            lo = mid
    p = o + d * lo
    e = 1e-3
    grad = np.array([
        body.evaluate((p + np.array(off))[None, :])[0][0] - body.evaluate((p - np.array(off))[None, :])[0][0]
        for off in ((e, 0, 0), (0, e, 0), (0, 0, e))
    ])
    return p, grad / np.linalg.norm(grad)


def signed_volume(verts: np.ndarray, faces: np.ndarray) -> float:
    tri = np.concatenate([faces[:, [0, 1, 2]], faces[:, [0, 2, 3]]])
    a, b, c = verts[tri[:, 0]], verts[tri[:, 1]], verts[tri[:, 2]]
    return float(np.einsum('ij,ij->i', a, np.cross(b, c)).sum() / 6.0)
