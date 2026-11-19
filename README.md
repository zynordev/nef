# nef

**Weyv 1.1.21** (Windows masaüstü canlı müzik görselleştiricisi) için **Linux / Hyprland** portu.

- Ayrıntılı plan: [PLAN.md](PLAN.md)
- Hedef makine: `brotics` (Linux, Hyprland)

Bu repo telif nedeniyle Weyv'in kaynak kodunu **içermez**. Sadece porta özgü
kodu tutar; upstream kaynak, elinizdeki kurulum `.exe`'sinden `setup.sh` ile
çıkarılır.

## Kurulum

```bash
./setup.sh ~/Downloads/Weyv-Setup-1.1.21.exe
npm start
```

`setup.sh`: installer'ı açar → `app.asar`'ı `weyv-app/`'a çıkarır → portu uygular
(`port/`) → bağımlılıkları kurar. Gerekenler: `7z`, `node`, `npm`, `git`, `unzip`.

Çalışma zamanı gereksinimleri: `parec`/`pactl` (PipeWire-pulse, ses), `playerctl`
(MPRIS, parça bilgisi), `hyprctl` (pencere katmanı), opsiyonel `nvidia-smi`
(GPU). Tepsi ikonu için `libayatana-appindicator`.

## Durum (fazlar)

| Faz | Konu | Durum |
|---|---|---|
| 0 | Electron 33.4.11 + iskelet | ✅ Uygulama açılıyor, widget çiziliyor (~19 fps) |
| 1 | Ses (`weyv-loopback`) | ✅ Uygulama içinde çalışıyor; cihaz değişiminde exit 3 |
| 2 | Pencere katmanı (`linuxwm.js`) | ✅ Çalışıyor (Hyprland/hyprctl, "Kademe 3"); **ekranda görsel doğrulama gerek** |
| 3 | Parça bilgisi + sözler (`weyv-nowplaying`) | ✅ MPRIS'ten gerçek parça/kapak/zaman çizelgesi |
| 4 | sysmon, disk, oyun modu, autostart, updater | ✅ Helper + disk + gaming + autostart + updater-kapatma |
| 5 | Ekran koruyucu (hypridle), layer-shell, karşılaştırma | ⏳ `screensaver.js` Linux'ta no-op; kalanı açık |

Ayrıntı ve mimari kararlar: [port/README.md](port/README.md).

## Yapı

```
nef/
├─ setup.sh              Sıfırdan kurulum (installer → port → bağımlılıklar)
├─ package.json          electron 33.4.11, koffi, electron-updater
├─ tools/                Linux yardımcı süreçleri (stdio sözleşmeleri upstream ile birebir)
│  ├─ weyv-loopback      Ses: parec → PULSE1 mono float32
│  ├─ weyv-nowplaying    Parça bilgisi: playerctl/MPRIS → satır-satır JSON
│  └─ weyv-sysmon        GPU + ağ → satır-satır JSON
├─ port/
│  ├─ new/src/main/      Porta özgü yeni modüller (linuxwm, wm, autostart)
│  └─ weyv-linux.patch   Upstream dosyalara yapılan değişiklikler
└─ weyv-app/             (gitignore) installer'dan çıkarılan + yamanan upstream kaynak
```

## Lisans / dağıtım

Port kişisel kullanım içindir. Pro kilidi açılmaz, anahtar üretilmez; lisans
doğrulaması (`license.js`) olduğu gibi kalır. Yayınlamadan önce geliştiriciyle
(`hollen689/weyv-releases`) konuşulmalı. Bkz. PLAN.md §9.
