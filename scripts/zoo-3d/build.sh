#!/usr/bin/env bash
# 3Dどうぶつえんの動物アセットを再生成する。
#   scripts/zoo-3d/build.sh                 # 全動物
#   scripts/zoo-3d/build.sh elephant        # 指定した動物だけ
#   QA_DIR=/tmp/zoo3d-qa scripts/zoo-3d/build.sh elephant   # 品質確認用の画像・動画も書き出す
#
# 1. Blender（固定版）で形・骨格・モーションを生成し、GLB・モーション情報 JSON・.blend を書き出す
# 2. glTF Transform でキーフレームを間引き、meshopt 圧縮して public/models/zoo-3d/ へ置く
set -euo pipefail

cd "$(dirname "$0")/../.."
BLENDER=${BLENDER:-$(scripts/zoo-3d/setup-blender.sh)}
GLTF_TRANSFORM=(npx --yes @gltf-transform/cli@4.5.1)
ANIMALS=("$@")
if [[ ${#ANIMALS[@]} -eq 0 ]]; then
  ANIMALS=(elephant giraffe lion)
fi

for animal in "${ANIMALS[@]}"; do
  args=(--animal "$animal")
  if [[ -n "${QA_DIR:-}" ]]; then
    args+=(--qa "$QA_DIR/$animal")
  fi
  "$BLENDER" -b --factory-startup --python scripts/zoo-3d/build_animal.py -- "${args[@]}" 2>&1 \
    | grep -E '^\[zoo3d\]|Error|Traceback|^  File|Bone Heat' || true
  glb=public/models/zoo-3d/$animal.glb
  if [[ ! -f "$glb" ]]; then
    echo "GLB が生成されませんでした: $glb" >&2
    exit 1
  fi
  tmp=$(mktemp -d)
  "${GLTF_TRANSFORM[@]}" resample "$glb" "$tmp/a.glb" > /dev/null
  "${GLTF_TRANSFORM[@]}" prune "$tmp/a.glb" "$tmp/b.glb" > /dev/null
  "${GLTF_TRANSFORM[@]}" meshopt --level high "$tmp/b.glb" "$tmp/c.glb" > /dev/null
  mv "$tmp/c.glb" "$glb"
  rm -rf "$tmp"
  echo "[zoo3d] optimized $glb ($(( $(stat -c %s "$glb") / 1024 )) KiB)"
done
