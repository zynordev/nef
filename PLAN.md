# Weyv → Linux Port Planı

> Windows uygulaması **Weyv 1.1.21**'in Hyprland/Wayland üzerinde tıpatıp aynı
> çalışacak şekilde taşınması. Bu dosya kendi kendine yeterlidir: sıfırdan bir
> oturum bu dosyayı okuyup devam edebilir.
>
> Hazırlanma tarihi: 2026-11-20 · Hedef makine: `brotics` (Linux, Hyprland)

---

## 0. Bir bakışta durum

| | |
|---|---|
| **Kaynak dosya** | `~/Downloads/Weyv-Setup-1.1.21.exe` (82.985.016 bayt) |
| **SHA-256** | `a5d5ccad425cc7da94375198dd94f90abb5a08e18e8b170dbce5322487dd4389` |
| **Uygulama** | Masaüstü duvar kağıdı üzerinde çalışan canlı müzik görselleştirici widget'ı |
| **Teknoloji** | Electron + NSIS installer, `koffi` ile Win32 FFI |
| **Yayıncı** | Alex Hollenbeck (Midlothian, VA, ABD), GitHub `hollen689/weyv-releases` |
| **İmza** | Microsoft ID Verified Code Signing (Azure Trusted Signing), 18–20 Kasım 2026 |
| **Lisans modeli** | İndirme ücretsiz, widget'ların çoğu "Pro" (Ed25519 imzalı anahtar) |
| **Kod durumu** | Minify edilmemiş, yorumlu, okunabilir JS — 363 dosya |

### Planın dayandığı tek kritik bulgu

**Animasyonlar için hiçbir iş yapılmayacak.** Lyrics akışı saf CSS:

```css
/* src/lyrics/view.css:163 */
transform: translateY(var(--y, 0));
transition: transform 760ms cubic-bezier(0.22, 0.8, 0.2, 1), opacity 500ms ease;
```

Tüm görselleştiriciler Canvas/WebGL. Bunları Linux'taki **aynı Chromium**
render ediyor. "Tıpatıp aynı" hedefinin en zor görünen kısmı bedavaya geliyor.

Gerçek iş yükü tamamen **native katmanda**: `src/main/` içindeki 8 dosya.

---

## 1. Kaynağı tekrar çıkarma tarifi

Bu adım bir kez yapılır; çıktı `src/` klasörüdür.

### Kolay yol (p7zip kurulu ise)

```bash
cd ~/projects
mkdir -p weyv-extract && cd weyv-extract
7z x ~/Downloads/Weyv-Setup-1.1.21.exe -onsis     # NSIS içeriği
# İçinden ~82 MB'lık 7z yükünü bul (app-64.7z benzeri), onu da aç:
7z x nsis/'$PLUGINSDIR'/app-64.7z -oapp           # yol sürüme göre değişebilir
npx asar extract app/resources/app.asar src       # asıl kaynak
```

### Manuel yol (7z yoksa — doğrulanmış)

Installer yapısı (ölçülmüş değerler):

| Bileşen | Konum / değer |
|---|---|
| PE stub sonu | `0xc800` |
| NSIS firstheader imzası | `0xc804` (`NullsoftInst`) |
| Sıkıştırma | **zlib / raw deflate** (LZMA değil) |
| Header bloğu | `0xc820`, 27.513 bayt → 116.908 bayt |
| NSIS veri bloğu sayısı | 8 (7 adet MZ yardımcı + 1 adet 7z yük) |
| **7z yük** | `0x21fd2`, 82.464.671 bayt |
| Sertifika tablosu | `0x4f20320`, 15.640 bayt |

7z yükü: 166 klasör, **LZMA2** (coder `0x21`), bazı `.exe`/`.dll` klasörleri
BCJ2 (`0x303011b`) — BCJ2'yi Python `lzma` açamaz, o dosyalar için 7z şart.
`resources/app.asar` düz LZMA2'dir, Python ile açılabilir (3.502.054 bayt).

`app.asar` ayrıştırma: offset 4'te header boyutu, offset 12'de JSON uzunluğu,
veri `8 + headerSize`'dan başlar.

---

## 2. Mimari karar: koffi korunuyor

`koffi` **Linux'ta da çalışıyor**. Yani `win32.js`'in `user32.dll` yüklemesi
yerine `libxcb` / `libX11` yüklenir. Mimari, dosya düzeni, IPC kanal isimleri,
çağrı sıraları aynı kalır. Bu bir "yeniden yazma" değil, **arka uç değişimi** —
tıpatıp aynılık için en güvenli yol.

İkinci kaldıraç: **Hyprland'ın `hyprctl -j` IPC'si**. Windows'ta koffi +
`EnumWindows` ile yapılan işlerin neredeyse tamamını JSON olarak veriyor.

---

## 3. Dosya envanteri

| Dosya | Satır | Durum |
|---|---|---|
| `src/` renderer (17 klasör, ~340 dosya) | — | **Değişiklik yok.** lyrics, fluid, waves, glow, clock, boxviz, saver, dashboard, span, trail, env, wallpaper, lab, info, stage, backdrop |
| `main/win32.js` | 527 | **Tam arka uç değişimi** → `linuxwm.js` |
| `main/screensaver.js` | 174 | **Yeniden yazım** (registry → hypridle) |
| `main/disks.js` | ~60 | Yeniden yazım (kernel32 → `statvfs`) |
| `main/profiles.js` | 254 | Kısmi (yalnız `win32.*` çağrıları) |
| `main/gaming.js` | 111 | Kısmi (tam ekran algılama) |
| `main/geometry.js` | ~70 | Kısmi — **sadeleşiyor** (re-parent yok) |
| `main/scene-window.js` | 295 | Kısmi (attach / restack) |
| `main/box-widget.js` | 355 | Kısmi (aynı attach deseni) |
| `main/loopback.js` | 185 | **Değişiklik yok** — yalnız binary değişir |
| `main/nowplaying.js` | 265 | **Değişiklik yok** — yalnız binary değişir |
| `main/sysmon.js` | 186 | **Değişiklik yok** — yalnız binary değişir |
| `main/main.js` | 1512 | Taşınabilir + ufak platform dalları |
| `main/{license,settings,tray,artwork,weather,lyrics,stats,arrange,updater,preload}.js` | ~1900 | Taşınabilir |

### Dış bağımlılıklar (hepsi platformdan bağımsız)

- `weyv.app/api/{update,trial,time,renew}` — güncelleme + lisans
- `lrclib.net/api` — şarkı sözleri
- `itunes.apple.com`, `api.deezer.com`, `e-cdns-images.dzcdn.net` — albüm kapağı
- `api.open-meteo.com`, `geocoding-api.open-meteo.com` — hava durumu

Kodda `eval`, telemetri veya izleme **yok**. (Bu değerlendirme JS katmanına
dayanır; `pulse-*.exe`, `koffi.node`, `elevate.exe`, `PulseSaver.scr` ikilileri
incelenmedi — Linux portunda hiçbiri kullanılmayacak.)

---

## 4. En zor problem: duvar kağıdı katmanı

Windows'ta uygulama, Explorer'ın `WorkerW` penceresine `SetParent` ile giriyor;
böylece ikonların altında, her uygulamanın arkasında, Alt-Tab'de görünmeden
yaşıyor. **Linux'ta doğrudan karşılığı yok.** Planın tek gerçek riski burada.

### Kademe 1 — XWayland + `_NET_WM_WINDOW_TYPE_DESKTOP` *(ilk hedef)*

Electron'u `--ozone-platform=x11` ile çalıştır, pencereye xcb üzerinden:

```
_NET_WM_WINDOW_TYPE = _NET_WM_WINDOW_TYPE_DESKTOP
_NET_WM_STATE      += _NET_WM_STATE_BELOW
_NET_WM_STATE      += _NET_WM_STATE_SKIP_TASKBAR, _NET_WM_STATE_SKIP_PAGER
```

`xwinwrap` / `conky` yöntemi. **Hyprland'ın XWayland'ında davranışı test
edilmeli — garanti yok.**

### Kademe 2 — wlr-layer-shell *(doğru çözüm, araştırma)*

`zwlr_layer_shell_v1`, `layer = BACKGROUND`. `hyprpaper` / `swww` böyle çalışır.
Engel: **Electron layer-shell desteklemiyor.** Electron yaması ya da ayrı bir
host süreci gerekir. Faz 5.

### Kademe 3 — yedek *(kesin çalışır)*

Normal pencere + Hyprland kuralları: `nofocus`, `noblur`, `noanim`, en alta
sabitleme.

> **Avantaj:** Hyprland'da masaüstü ikonu yok. Windows kodundaki
> "ikonların altında kal, ama tıklamaları ikon görünümüne kaptırma"
> karmaşıklığının (`findIconHost`, `restackBehindIcons`, 24H2 ayrımı)
> tamamı düşüyor.

---

## 5. Yardımcı süreç sözleşmeleri

C# kaynakları asar içinde mevcut (`tools/Pulse*.cs`) — referans implementasyon
elimizde. `loopback.js` / `nowplaying.js` / `sysmon.js` dosyalarına
**dokunulmayacak**; yalnız aynı dili konuşan Linux binary'leri yazılacak.

### `weyv-loopback` — ses (ZORUNLU)

```
stdout: "PULSE1 <sampleRate> <channels>\n"
      + kesintisiz little-endian float32 MONO örnekler
exit  : 0 normal · 2 başlatılamadı · 3 cihaz geçersizleşti (çağıran respawn eder)
```

Windows tarafı WASAPI loopback'i açıp **mono'ya indiriyor**; 32-bit float
dışındaki mix formatlarını reddediyor.

Linux: `pw-record --format=f32 --channels=1 --rate=<rate> --target <sink>.monitor`
(veya `parec --format=float32le --channels=1 -d <sink>.monitor`).
Header'ı yazıp PCM'i boruya aktaran ~50 satır. Cihaz değişimi için
`pactl subscribe` izlenip **exit 3**.

`loopback.js` davranışı (korunacak): ilk dinleyicide başlar, son dinleyici
gidince durur; exit 3'te 600 ms sonra respawn; başka çıkışlarda artan gecikme,
60 sn içinde 5 çökmeden sonra vazgeçer.

### `weyv-nowplaying` — parça bilgisi (opsiyonel)

```
stdout (satır satır JSON):
  {"playing":bool,"title":..,"artist":..,"album":..,"art":..,"source":..,"app":..}
  {"timeline":true,"position":<ms>,"duration":<ms>,"updated":<unixMs>}
stdin  (satır satır komut):
  play-pause | next | previous
```

Linux: MPRIS / D-Bus (`playerctl --follow` veya `dbus-next`).
Kapak `mpris:artUrl`'den gelir.

> **Linux'ta Windows'tan daha iyi olacak:** SMTC'nin Spotify için pencere
> başlığından okuma hack'i (`source:"window"`, ardından kapak araması) ve
> Apple Music'in `"Artist — Album"` ayrıştırması Linux'ta gereksiz; MPRIS
> alanları zaten ayrı veriyor. Bu kod yolları ölü kalacak ama **silinmeyecek**
> (davranış sözleşmesi bozulmasın).

### `weyv-sysmon` — GPU / ağ (opsiyonel)

```
stdout (satır satır): {"gpu":37.5,"down":182340,"up":9120}
gpu : 0-100, kullanılamıyorsa -1   ·   down/up : bayt/saniye
```

CPU ve RAM'i Node kendi hesaplıyor (`os.cpus()`), helper yalnız GPU + ağ verir.

Linux:
- AMD → `/sys/class/drm/card*/device/gpu_busy_percent`
- NVIDIA → `nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits`
- Intel → `intel_gpu_top -J`
- Ağ → `/proc/net/dev` farkı

---

## 6. `win32.js` → `linuxwm.js` fonksiyon eşlemesi

| Windows | Linux karşılığı |
|---|---|
| `attachBehindIcons`, `attachToDesktop` | xcb atomları (Kademe 1) / layer-shell (Kademe 2) |
| `restackBehindIcons`, `findIconHost`, `findWallpaperWorkerW`, `desktopHost` | **Gereksiz** (ikon yok) |
| `isOnDesktop`, `getParent`, `detachFromDesktop` | xcb pencere durumu |
| `isCovered(hwnd, rect)` | `hyprctl clients -j` → görünür pencerelerle dikdörtgen kesişimi |
| `fullscreenApp`, `fullscreenExe` | `hyprctl activewindow -j` → `fullscreen` + `class` |
| `foregroundFrame` | `hyprctl activewindow -j` → `at`, `size` |
| `processNames` | `/proc/*/comm` |
| `windowedApps` | `hyprctl clients -j` → `class` listesi |
| `makeToolWindow` | `SKIP_TASKBAR` + `SKIP_PAGER` atomları |
| `setNoActivate` | `nofocus` pencere kuralı |
| `setClickThrough` | Electron `setIgnoreMouseEvents(true)` (Linux'ta çalışır) |
| `setBounds` | Electron `setBounds` (re-parent olmadığı için yeterli) |
| `sendToBottom`, `sendToTopMost`, `clearTopMost` | xcb `ConfigureWindow` / `setAlwaysOnTop` |
| `toHwnd` | `getNativeWindowHandle()` → XID |
| `classNameOf`, `isCloaked`, `windowRect` | `hyprctl` alanları |

**`geometry.js` notu:** Windows'ta `setChildBounds`, re-parent yüzünden ham
Win32 kullanıyor ve DIP→piksel çevirip sanal masaüstü orijinini çıkarıyor.
Linux'ta re-parent olmayacağı için Electron'un kendi `setBounds`'u yeter —
bu fonksiyon **büyük ölçüde siliniyor**.

---

## 7. Fazlar

### Faz 0 — Temel *(yarım gün)*
- [ ] **Electron sürümünü kesinleştir.** Render'ın tıpatıp aynı olması için şart.
      `Weyv.exe` sürüm kaynağı BCJ2 sıkıştırmalı; makinede `7z` ile çıkarıp oku.
- [ ] `~/projects/weyv-linux/` iskeleti: `app.asar` içeriği + `tools/` kaynakları
- [ ] `npm i electron@<sürüm> koffi electron-updater`
- **Kabul:** `npx electron .` açılıyor, dashboard geliyor (widget'lar yanlış katmanda olabilir)

### Faz 1 — Ses *(yarım gün)* ← **önce bu**
- [ ] `weyv-loopback` yaz, PULSE1 sözleşmesine birebir uy
- [ ] `build-helper.js`'i Linux'ta binary yolunu döndürecek şekilde uyarla
- **Kabul:** Spotify çalarken görselleştirici tepki veriyor *(projenin kalbi)*

### Faz 2 — Pencere katmanı *(1–2 gün, en riskli)*
- [ ] `linuxwm.js` + Kademe 1 denemesi; olmazsa Kademe 3
- [ ] `scene-window.js`, `box-widget.js`, `geometry.js` uyarlaması
- **Kabul:** Widget masaüstünde, pencerelerin arkasında, Alt-Tab'de yok, taşınıp boyutlandırılabiliyor

### Faz 3 — Parça bilgisi + sözler *(yarım gün)*
- [ ] `weyv-nowplaying` (MPRIS)
- **Kabul:** Şarkı adı, kapak ve **akan lyrics animasyonu** Windows'la aynı

### Faz 4 — Geri kalanlar *(1 gün)*
- [ ] `weyv-sysmon`
- [ ] `disks.js` → `statvfs`
- [ ] `gaming.js`, `profiles.js` → `hyprctl`
- [ ] Tepsi ikonu (`libayatana-appindicator` gerekir)
- [ ] Autostart → `~/.config/autostart/weyv.desktop`
- [ ] `updater.js`'i Linux'ta devre dışı bırak (sunucu Windows artifact'i veriyor)
- **Kabul:** System monitor, disk, oyun modu, profiller çalışıyor

### Faz 5 — Cila / araştırma
- [ ] Ekran koruyucu → `hypridle` entegrasyonu
- [ ] Layer-shell (Kademe 2) araştırması
- [ ] Windows ↔ Linux yan yana ekran görüntüsü karşılaştırması

---

## 8. %99'un dışında kalan %1 (dürüst liste)

| Konu | Durum |
|---|---|
| Masaüstü ikonlarının altında durma | Hyprland'da ikon yok → konu düşüyor |
| `.scr` ekran koruyucu | Birebir karşılığı yok; `hypridle` ile yaklaşık |
| DWM "cloaked" pencere algılama | Wayland'da karşılığı yok; kesişim hesabı yeterli |
| SMTC'ye özel davranışlar | MPRIS daha temiz; ufak farklar olabilir |
| Kenara yapışma (`snapToEdges`) | Çalışır; Hyprland'ın `workArea` raporlaması farklı olabilir |
| Otomatik güncelleme | Linux'ta kapatılacak |
| `elevate.exe` (UAC yükseltme) | Linux'ta karşılığı yok, gerekmiyor |

---

## 9. Lisans sınırı — değiştirilmeyecek

`license.js` **olduğu gibi kalır.** Ed25519 imza doğrulaması node `crypto`
ile zaten taşınabilir. Pro kilidi açılmaz, anahtar üretilmez, `PRO_KEYS`
listesi kurcalanmaz.

- Ücretsiz widget'lar Linux'ta çalışır.
- Pro widget'ları için kullanıcının kendi anahtarı gerekir.
- Trial "PC başına bir kez" olsun diye `machineId` kullanılıyor; Linux
  karşılığı `/etc/machine-id` — **kasten sadık** kurulacak, yani tek-trial
  mantığı korunur, atlatılmaz.

**Dağıtım:** Bu port kişisel kullanım için. Yayınlamak için önce geliştiriciyle
konuşulmalı (`hollen689/weyv-releases`, Discord: `discord.gg/jBQrSU6XeD`).
Kod bu kadar taşınabilirken resmî bir Linux sürümü talebi makul.

---

## 10. Pratik engeller

1. **Makinede disk alanı yok.** Claude'un izole Linux ortamı (`device_bash`)
   17 GB istiyor ve başlatılamadı. Bu yüzden kod makinede çalıştırılıp test
   edilemiyor. Akış: dosyalar yazılır → kullanıcı `npm install` ve
   `npx electron .` çalıştırır → hatalar paylaşılır. **Alan açılırsa döngü
   çok hızlanır.**
2. Electron, bulut ortamında çalıştırılamaz (ağ kapalı, GUI yok). Wayland
   testi zaten yalnız gerçek ekranda anlamlı.

---

## 11. Karar bekleyen 3 şey

1. **Faz sırası:** Ses (Faz 1) önce mi, pencere katmanı (Faz 2) önce mi?
   *Öneri: ses* — en hızlı "çalışıyor!" anı, en az risk.
2. **Pencere katmanı:** Kademe 1 (XWayland DESKTOP) denenerek mi başlanmalı,
   yoksa doğrudan kesin çalışan Kademe 3 mü?
3. **Hedef klasör:** `~/projects/weyv-linux/` uygun mu?

---

## Ek: Tam dosya manifestosu (installer içeriği)

### Electron çalışma zamanı
`Weyv.exe` · `chrome_100_percent.pak` · `chrome_200_percent.pak` ·
`resources.pak` · `icudtl.dat` · `snapshot_blob.bin` ·
`v8_context_snapshot.bin` · `locales/*.pak` (55 dil) ·
`d3dcompiler_47.dll` · `ffmpeg.dll` · `libEGL.dll` · `libGLESv2.dll` ·
`vk_swiftshader.dll` · `vulkan-1.dll` · `vk_swiftshader_icd.json` ·
`LICENSE.electron.txt` · `LICENSES.chromium.html`

### Uygulama
`resources/app.asar` (3.502.054 bayt, 363 dosya) ·
`resources/app-update.yml` · `resources/elevate.exe` ·
`resources/app.asar.unpacked/node_modules/koffi/**` (win32_x64 `koffi.node`)

### Native yardımcılar (Linux'ta yeniden yazılacak)
`resources/tools/pulse-loopback.exe` · `resources/tools/pulse-nowplaying.exe` ·
`resources/tools/pulse-sysmon.exe` · `resources/tools/PulseSaver.scr`

### `app-update.yml`
```yaml
provider: generic
url: https://www.weyv.app/api/update
updaterCacheDirName: weyv-updater
publisherName:
  - Alex Hollenbeck
```

### Renderer klasörleri (hiçbiri değişmeyecek)
`backdrop` · `boxviz` · `clock` · `dashboard` · `env` · `fluid` · `glow` ·
`info` · `lab` · `lyrics` · `main` · `renderer` · `saver` · `shared` ·
`span` · `stage` · `trail` · `wallpaper` · `waves`
