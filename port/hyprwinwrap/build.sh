#!/usr/bin/env bash
#
# hyprwinwrap'i, çalışan Hyprland sürümüne BİREBİR uyan commit'ten derler.
#
# hyprwinwrap, bir pencereyi Hyprland'ın gerçek arka plan (duvar kağıdı)
# katmanına taşır — normal bir Electron penceresinin kendi başına yapamadığı şey.
# Weyv'in görselleştiricisini "her şeyin arkasında" çalıştırmanın tek sağlam yolu.
#
# Çıktı: build/libhyprwinwrap.so  (hyprctl plugin load ile yüklenir)
#
# hyprpm GEREKMEZ: sistemde Hyprland başlıkları (/usr/include/hyprland) ve
# pkg-config hyprland varsa doğrudan cmake ile derlenir.
set -euo pipefail

REPO="https://github.com/gen3vra/hyprwinwrap"
DIR="${1:-$HOME/.local/share/weyv/hyprwinwrap}"

command -v hyprctl >/dev/null || { echo "HATA: hyprctl yok (Hyprland çalışmıyor mu?)"; exit 1; }
command -v cmake   >/dev/null || { echo "HATA: cmake gerekli"; exit 1; }
pkg-config --exists hyprland || { echo "HATA: Hyprland başlıkları/pkgconfig yok. 'hyprland' paketini kurun."; exit 1; }

# Çalışan Hyprland'ın commit hash'i
HYPR_COMMIT="$(hyprctl version | grep -oE 'commit [0-9a-f]{40}' | awk '{print $2}')"
echo "==> Çalışan Hyprland commit: ${HYPR_COMMIT:-bilinmiyor} (sürüm $(pkg-config --modversion hyprland))"

echo "==> hyprwinwrap klonlanıyor"
rm -rf "$DIR"
git clone "$REPO" "$DIR" >/dev/null 2>&1
cd "$DIR"

# hyprpm.toml, her Hyprland commit'i için uyumlu hyprwinwrap commit'ini eşler.
PIN=""
if [ -n "$HYPR_COMMIT" ] && [ -f hyprpm.toml ]; then
  PIN="$(grep -F "$HYPR_COMMIT" hyprpm.toml | grep -oE '"[0-9a-f]{40}"' | tail -1 | tr -d '"' || true)"
fi
if [ -n "$PIN" ]; then
  echo "==> Uyumlu hyprwinwrap commit'i: $PIN"
  git fetch --depth 1 origin "$PIN" >/dev/null 2>&1
  git checkout "$PIN" >/dev/null 2>&1
else
  echo "==> UYARI: Bu Hyprland sürümü için sabit commit bulunamadı; varsayılan dal derlenecek (uyumsuz olabilir)."
fi

echo "==> Derleniyor"
cmake -B build -DCMAKE_BUILD_TYPE=Release >/dev/null
cmake --build build >/dev/null

SO="$DIR/build/libhyprwinwrap.so"
[ -f "$SO" ] || { echo "HATA: derleme çıktısı yok"; exit 1; }
echo
echo "Hazır: $SO"
echo
echo "Yüklemek için (SEN çalıştır):"
echo "  hyprctl plugin load $SO"
echo "Sonra Weyv'i başlat:  (nef dizininde) npm start"
echo "Kaldırmak için:        hyprctl plugin unload $SO"
