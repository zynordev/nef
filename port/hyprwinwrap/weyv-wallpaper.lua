-- Weyv görselleştiricisini duvar kağıdı yapan hyprwinwrap tanımı.
-- Bu dosyayı Lua tabanlı Hyprland config'inden require et, ör:
--   ~/.config/hypr/custom/ içine kopyala ve hyprland.lua'dan çağır,
--   ya da içeriğini custom bir lua dosyasına yapıştır.
--
-- Eşleşme başlık iledir: port, ana görselleştirici penceresine Linux'ta
-- 'Weyv Visualizer' başlığını verir (dashboard/stage 'Weyv' kalır, onlara
-- dokunulmaz).

if hl ~= nil and hl.plugin ~= nil and hl.plugin.hyprwinwrap ~= nil then
    hl.plugin.hyprwinwrap.window({
        title = "Weyv Visualizer",  -- yalnız ana görselleştirici
        layer = 0,
        pos_x = 0,
        pos_y = 0,
        size_x = 100,               -- tüm ekran; küçük bir widget istersen küçült
        size_y = 100,
    })
end
