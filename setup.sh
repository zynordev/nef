#!/usr/bin/env bash
#
# nef — Weyv 1.1.21 Linux/Hyprland portunu sıfırdan kurar.
#
# Bu repo, telif nedeniyle Weyv'in kaynak kodunu İÇERMEZ. Onun yerine:
#   - port/new/      : porta özgü, sıfırdan yazılmış modüller
#   - port/weyv-linux.patch : upstream dosyalara yapılan değişiklikler
#   - tools/         : Linux yardımcı süreçleri (ses, parça bilgisi, sysmon)
# Bu script, elinizdeki Weyv kurulum .exe'sinden kaynağı çıkarır, portu üstüne
# uygular ve bağımlılıkları kurar.
#
# Kullanım:
#   ./setup.sh /yol/Weyv-Setup-1.1.21.exe
#
set -euo pipefail

INSTALLER="${1:-$HOME/Downloads/Weyv-Setup-1.1.21.exe}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/weyv-app"
EXPECTED_SHA="a5d5ccad425cc7da94375198dd94f90abb5a08e18e8b170dbce5322487dd4389"

echo "==> Kurulum dosyası: $INSTALLER"
[ -f "$INSTALLER" ] || { echo "HATA: kurulum .exe bulunamadı. Yol verin: ./setup.sh <exe>"; exit 1; }

SHA="$(sha256sum "$INSTALLER" | cut -d' ' -f1)"
if [ "$SHA" != "$EXPECTED_SHA" ]; then
  echo "UYARI: SHA-256 beklenenden farklı (sürüm 1.1.21 değil olabilir):"
  echo "  beklenen: $EXPECTED_SHA"
  echo "  gelen   : $SHA"
  read -r -p "Yine de devam edilsin mi? [e/H] " yn
  [ "$yn" = "e" ] || [ "$yn" = "E" ] || exit 1
fi

for cmd in 7z npx node npm git; do
  command -v "$cmd" >/dev/null || { echo "HATA: '$cmd' gerekli ama kurulu değil."; exit 1; }
done

echo "==> Kaynak çıkarılıyor (installer → asar → weyv-app/)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
7z x -y -o"$TMP/nsis" "$INSTALLER" >/dev/null
7z x -y -o"$TMP/app" "$TMP/nsis/\$PLUGINSDIR/app-64.7z" >/dev/null
rm -rf "$APP"
mkdir -p "$APP"
npx --yes asar@3 extract "$TMP/app/resources/app.asar" "$APP"
rm -rf "$APP/node_modules"          # win32 ikilileri; kök node_modules kullanılır

echo "==> C# yardımcı kaynakları kopyalanıyor (referans)"
cp -r "$TMP/app/resources/tools" "$APP/tools" 2>/dev/null || true

echo "==> Port uygulanıyor"
# Yeni modüller
cp "$ROOT/port/new/src/main/linuxwm.js"   "$APP/src/main/linuxwm.js"
cp "$ROOT/port/new/src/main/wm.js"        "$APP/src/main/wm.js"
cp "$ROOT/port/new/src/main/autostart.js" "$APP/src/main/autostart.js"
# Upstream değişiklikleri
( cd "$APP" && git apply "$ROOT/port/weyv-linux.patch" 2>/dev/null \
  || patch -p1 < "$ROOT/port/weyv-linux.patch" )

echo "==> Bağımlılıklar kuruluyor (electron, koffi, electron-updater)"
cd "$ROOT"
npm install --no-audit --no-fund

# npm 12, postinstall script'lerini varsayılan olarak engeller; Electron ikilisi
# inmemiş olabilir. Garanti altına al: install.js'i çalıştır, olmazsa önbellekteki
# zip'i elle aç.
if [ ! -x node_modules/electron/dist/electron ]; then
  echo "==> Electron ikilisi hazırlanıyor"
  npm install-scripts approve electron koffi >/dev/null 2>&1 || true
  node node_modules/electron/install.js || true
  if [ ! -x node_modules/electron/dist/electron ]; then
    ZIP="$(ls "$HOME"/.cache/electron/*/electron-*-linux-*.zip 2>/dev/null | head -1)"
    if [ -n "$ZIP" ]; then
      unzip -q -o "$ZIP" -d node_modules/electron/dist
      printf electron > node_modules/electron/path.txt
    fi
  fi
fi

echo
echo "Kurulum tamam. Çalıştırmak için:  npm start"
echo "Linux yardımcıları: tools/weyv-loopback, tools/weyv-nowplaying, tools/weyv-sysmon"
