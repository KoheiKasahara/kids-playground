#!/usr/bin/env bash
# 3Dどうぶつえんのアセット生成に使う Blender（固定版）を取得し、実行ファイルのパスを出力する。
#   scripts/zoo-3d/setup-blender.sh            # 取得（済みなら何もしない）してパスを表示
# 取得先は ${ZOO3D_CACHE:-~/.cache/kids-playground}/blender。リポジトリには置かない。
set -euo pipefail

VERSION=4.5.16
SERIES=4.5
SHA256=23432b064977908beb1ab4b7f32f024e7331105c875c187dce002aff84b10c11
CACHE=${ZOO3D_CACHE:-$HOME/.cache/kids-playground}/blender
NAME=blender-${VERSION}-linux-x64
BIN=$CACHE/$NAME/blender

if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
  echo "この取得スクリプトは Linux x86_64 用です。他の環境では Blender ${VERSION} を入れ、BLENDER=<実行ファイル> を指定してください。" >&2
  exit 1
fi

if [[ ! -x "$BIN" ]]; then
  mkdir -p "$CACHE"
  archive=$CACHE/$NAME.tar.xz
  if [[ ! -f "$archive" ]]; then
    echo "Blender ${VERSION} を取得します…" >&2
    curl -fsSL -o "$archive.part" "https://download.blender.org/release/Blender${SERIES}/${NAME}.tar.xz"
    mv "$archive.part" "$archive"
  fi
  echo "${SHA256}  $archive" | sha256sum -c - >&2
  tar -xf "$archive" -C "$CACHE"
fi
echo "$BIN"
