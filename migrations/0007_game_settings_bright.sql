-- メートルは規格の霧のまま。調整するのは部屋と灯火の明るさ。
alter table game_settings add column if not exists room_bright real;
alter table game_settings add column if not exists lantern_bright real;
update game_settings
set
  room_bright = coalesce(room_bright, 0.28),
  lantern_bright = coalesce(lantern_bright, 0.48)
where id = 1;
