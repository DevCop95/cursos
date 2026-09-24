#!/usr/bin/env bash
# Construye la imagen del laboratorio Linux (Alpine + git) para v86 y la deja en lab-linux/img-vN/.
# Requisitos: Docker, Python 3 con "zstandard", Node, y una copia de https://github.com/copy/v86
#   V86_REPO=/ruta/a/v86   (tools/fs2json.py, tools/copy-to-sha256.py y bios/)
#   V86_PKG=/ruta/al/paquete npm "v86" descomprimido (build/libv86.mjs y build/v86.wasm)
# Uso: V86_REPO=... V86_PKG=... IMG=img-v2 bash scripts/linux-lab/build.sh
set -euo pipefail
cd "$(dirname "$0")"
: "${V86_REPO:?}"; : "${V86_PKG:?}"; IMG="${IMG:-img-v1}"
WORK="${WORK:-$(pwd -W 2>/dev/null || pwd)/.build}"; rm -rf "$WORK"; mkdir -p "$WORK"; OUT="../../lab-linux/$IMG"

docker build . --platform linux/386 --tag dev101x/git-lab
docker rm -f gitlab-v86 >/dev/null 2>&1 || true
docker create --platform linux/386 --name gitlab-v86 dev101x/git-lab >/dev/null
docker export gitlab-v86 -o "$WORK/rootfs.tar" && docker rm gitlab-v86 >/dev/null
tar -f "$WORK/rootfs.tar" --delete .dockerenv 2>/dev/null || true

python "$V86_REPO/tools/fs2json.py" --zstd --out "$WORK/fs.json" "$WORK/rootfs.tar"
mkdir -p "$WORK/flat" && python "$V86_REPO/tools/copy-to-sha256.py" --zstd "$WORK/rootfs.tar" "$WORK/flat"

# Arranca una vez (2-3 min), comprueba git y guarda el estado ya iniciado.
node make-state.mjs "$WORK" "$V86_PKG" "$V86_REPO"
python -c "import zstandard,sys;d=open(sys.argv[1],'rb').read();open(sys.argv[1]+'.zst','wb').write(zstandard.ZstdCompressor(level=19,threads=-1).compress(d))" "$WORK/state.bin"

rm -rf "$OUT" && mkdir -p "$OUT/flat"
cp "$WORK/fs.json" "$WORK/state.bin.zst" "$OUT/" && cp "$WORK/flat/"* "$OUT/flat/"
cp "$V86_REPO/bios/seabios.bin" "$V86_REPO/bios/vgabios.bin" "$OUT/"
mkdir -p ../../lab-linux/v86 && cp "$V86_PKG/build/libv86.js" "$V86_PKG/build/v86.wasm" ../../lab-linux/v86/
echo "Listo: $OUT (recuerda cambiar IMG en lab-linux/lab.js si usas una carpeta nueva)"
