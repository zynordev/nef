# port/ — Weyv → Linux yama katmanı

Bu klasör, Weyv'in upstream kaynağına dokunmadan portu tanımlar. `setup.sh`
upstream'i `weyv-app/`'a çıkardıktan sonra buradakileri uygular.

- `new/src/main/` — porta özgü, sıfırdan yazılmış modüller (upstream'de yok).
- `weyv-linux.patch` — upstream dosyalara yapılan değişikliklerin diff'i
  (`weyv-app/` kökünden `git apply` / `patch -p1`).

## Yeni modüller

### `wm.js` — platform seçici
`require('./win32')` çağrıları `require('./wm')`'e çevrildi. `wm.js` platforma
göre `win32.js` (Windows) veya `linuxwm.js` (Linux) döndürür. Uygulamanın geri
kalanı platform dalı içermez.

### `linuxwm.js` — `win32.js`'in Linux karşılığı
`win32.js` ile **birebir aynı dışa aktarım sözleşmesi**, Hyprland/Wayland için.
Windows WorkerW re-parent'ının Wayland'da doğrudan karşılığı yok (gerçek arka
plan katmanı wlr-layer-shell ister, Electron desteklemez — PLAN Faz 5). Bu
yüzden "Kademe 3" kullanılır:

- **Sorgular** (`isCovered`, `fullscreenApp`, `foregroundFrame`, `windowedApps`)
  → `hyprctl -j` (XWayland ve Wayland pencerelerini birlikte görür).
- **Pencere eylemleri** (`setBounds`, `setClickThrough`, `makeToolWindow`, `show`)
  → Electron `BrowserWindow` API'leri; pencere, opak handle'dan bulunur.
- **Masaüstü "katmanı"** (`attachToDesktop`) → `hyprctl dispatch setprop` ile
  `nofocus/noblur/noanim/...` + `alterzorder bottom`. Re-parent yok.
- `toHwnd` → XWayland'da XID, Wayland'da opak buffer; her ikisi de kararlı bir
  tamsayıya özetlenir (yalnız map anahtarı olarak kullanılır).
- İkon tabanlı tüm karmaşa (`findIconHost`, `restackBehindIcons`...) düşer:
  Hyprland'da masaüstü ikonu yok.

> **Doğrulama notu:** pencere katmanının görsel davranışı (arkada durma,
> Alt-Tab'de görünmeme, tıklama geçişi) ekranda doğrulanmalı; başsız ortamda
> test edilemedi. Mantık yüklenip hyprctl'e bağlanıyor ve uygulama kararlı
> çalışıyor.

### `autostart.js` — "oturum açılışında başlat"
Electron'un `setLoginItemSettings`'i Linux'ta çalışmaz; bunun yerine
`~/.config/autostart/weyv.desktop` yazılır/silinir.

## Upstream değişiklikleri (`weyv-linux.patch`)

| Dosya | Değişiklik |
|---|---|
| `src/main/{profiles,box-widget,gaming,geometry,scene-window,main}.js` | `require('./win32')` → `require('./wm')` |
| `src/main/disks.js` | kernel32 → `df`/statvfs (sürücü listesi) |
| `src/main/screensaver.js` | Linux no-op dalı (hypridle: Faz 5) |
| `src/main/gaming.js` | NOT_GAMES'e Linux pencere sınıfları eklendi |
| `src/main/geometry.js` | `setChildBounds` Linux dalı (re-parent yok → sade) |
| `src/main/updater.js` | Linux'ta otomatik güncelleme kapalı |
| `src/main/main.js` | autostart platform dalı |
| `scripts/build-helper.js` | Linux'ta helper yolları → repo kökü `tools/` |

## Yardımcı süreçler (`../tools/`)
Node tarafındaki `loopback.js` / `nowplaying.js` / `sysmon.js` **değişmedi**;
yalnız aynı stdio sözleşmesini konuşan Linux binary'leri yazıldı. Sözleşmeler
için bkz. PLAN.md §5.
