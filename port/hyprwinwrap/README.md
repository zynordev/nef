# hyprwinwrap — Weyv'i gerçek duvar kağıdı yapmak

Hyprland'da normal bir Electron penceresi diğer uygulamaların **arkasına**
geçemez (floating pencere her zaman tiled'ın üstündedir; gerçek arka plan
katmanı `wlr-layer-shell` ister, Electron desteklemez). Bunu çözen tek sağlam
yol, Hyprland'ın kendi xwinwrap klonu olan **hyprwinwrap** plugin'i: eşleşen bir
pencereyi arka plan/duvar kağıdı katmanına taşır.

## Gereksinim doğrulandı (bu makinede)

- Hyprland 0.56.2, sistemde başlıklar (`/usr/include/hyprland`) ve
  `pkg-config hyprland` = 0.56.2 kurulu → `hyprpm` olmadan derlenebiliyor.
- Plugin bu repodaki `build.sh` ile, çalışan Hyprland'a **birebir uyan**
  commit'ten derlendi ve `libhyprwinwrap.so` üretildi.

## Kurulum

```bash
# 1) Derle (çalışan Hyprland'a uygun commit otomatik seçilir)
./port/hyprwinwrap/build.sh
# → ~/.local/share/weyv/hyprwinwrap/build/libhyprwinwrap.so

# 2) Plugin'i yükle  (SEN çalıştır — sistemini değiştiren adım)
hyprctl plugin load ~/.local/share/weyv/hyprwinwrap/build/libhyprwinwrap.so

# 3) Hangi pencerenin duvar kağıdı olacağını söyle
hyprctl keyword plugin:hyprwinwrap:title "Weyv Visualizer"

# 4) Weyv'i başlat
npm start
```

Port, ana görselleştirici penceresine Linux'ta **`Weyv Visualizer`** başlığını
verir; böylece hyprwinwrap yalnız onu hedefler, dashboard'a (`Weyv`) dokunmaz.

## Kalıcı yapmak

Lua config kullandığın için `weyv-wallpaper.lua` içindeki tanımı Hyprland
config'ine ekle (ör. `~/.config/hypr/custom/` altına koyup çağır). Plugin'i her
açılışta yüklemek için Hyprland config'ine:

```
exec-once = hyprctl plugin load ~/.local/share/weyv/hyprwinwrap/build/libhyprwinwrap.so
```

> Not: Plugin Hyprland **sürümüne bağlıdır**. Hyprland güncellenince plugin'i
> `build.sh` ile yeniden derle (uygun commit'i yine kendi seçer).

## Geri alma

```bash
hyprctl plugin unload ~/.local/share/weyv/hyprwinwrap/build/libhyprwinwrap.so
```

Config'e eklediğin `exec-once` ve lua tanımını silersen iz kalmaz.

## Ayarlar

`size_x`/`size_y`/`pos_x`/`pos_y` (yüzde) ile görselleştiriciyi tüm ekran yerine
bir köşede küçük tutabilirsin. Alanlar `weyv-wallpaper.lua` ve hyprwinwrap
README'sinde.
