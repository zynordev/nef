# nef

Weyv 1.1.21 (Windows masaüstü canlı müzik görselleştiricisi) için Linux / Hyprland portu.

- Ayrıntılı plan: [PLAN.md](PLAN.md)
- Hedef makine: `brotics` (Linux, Hyprland)

## Durum

- **Faz 0 (kısmen):** Electron 33.4.11 kuruldu, Weyv kaynağı `weyv-app/` altına çıkarıldı (repoya girmez). `npm start` uygulamayı açmaya çalışıyor ama `win32.js` Linux'ta `user32.dll` yüklerken çöküyor; bu Faz 2'nin (pencere katmanı) işi.
- **Faz 1 (tamam):** `tools/weyv-loopback` — PipeWire monitör kaynağından PULSE1 sözleşmesiyle mono float32 ses akıtır; varsayılan çıkış değişince çıkış kodu 3.

## Kurulum

```bash
npm install          # electron 33.4.11, koffi, electron-updater
npm start            # electron weyv-app
```

Sistem gereksinimleri: `parec`/`pactl` (PipeWire-pulse), `playerctl` (Faz 3), `hyprctl` (Faz 2+).
