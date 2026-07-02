-- Seed: МастерБай — 10 мастеров, 5 клиентов, заказы, отклики, отзывы
-- Все координаты — реальные районы Минска

-- Отключаем триггер для чистого insert (триггер на profiles, не master_balances)
ALTER TABLE public.profiles DISABLE TRIGGER trg_profiles_after_insert;

-- Очистка (порядок важен из-за foreign keys)
TRUNCATE TABLE public.reviews             CASCADE;
TRUNCATE TABLE public.bids                CASCADE;
TRUNCATE TABLE public.orders              CASCADE;
TRUNCATE TABLE public.master_categories   CASCADE;
TRUNCATE TABLE public.master_balances     CASCADE;
TRUNCATE TABLE public.notifications_log   CASCADE;
TRUNCATE TABLE public.profiles            CASCADE;

-- ============================================================
-- PROFILES (10 masters, 5 clients)
-- ============================================================
INSERT INTO public.profiles (telegram_id, role, full_name, username, is_npd, avg_rating, review_count) VALUES
  (200001, 'master', 'Алексей Кузнецов',   'alex_master',    true,  4.9, 87),
  (200002, 'master', 'Дмитрий Волков',     'dima_volk',      true,  4.7, 34),
  (200003, 'master', 'Сергей Новиков',     'novikov_s',      true,  5.0, 112),
  (200004, 'master', 'Иван Морозов',       'morozov_m',      false, 4.5, 23),
  (200005, 'master', 'Андрей Соколов',     'sokolov_a',      true,  4.8, 56),
  (200006, 'master', 'Павел Захаров',      'zaharoFF',       true,  4.6, 41),
  (200007, 'master', 'Николай Ковалёв',    'kovalev_n',      false, 4.3, 18),
  (200008, 'master', 'Евгений Попов',      'popov_e',        true,  4.9, 73),
  (200009, 'master', 'Максим Тихонов',     'tikhonov_max',   true,  4.4, 29),
  (200010, 'master', 'Владимир Орлов',     'orlov_v',        false, 4.2, 15),
  (100001, 'client', 'Мария Коваль',       'mary_k',         false, NULL, 0),
  (100002, 'client', 'Елена Смирнова',     'lena_smir',      false, NULL, 0),
  (100003, 'client', 'Ольга Фёдорова',     'olga_f',         false, NULL, 0),
  (100004, 'client', 'Татьяна Белова',     'tanya_bel',      false, NULL, 0),
  (100005, 'client', 'Анна Громова',       'anna_gr',        false, NULL, 0);

-- ============================================================
-- MASTER CATEGORIES
-- ============================================================
INSERT INTO public.master_categories (master_id, category)
SELECT p.id, c.category
FROM public.profiles p
CROSS JOIN (VALUES
  (200001, ARRAY['plumber', 'handyman']),
  (200002, ARRAY['electrician', 'handyman']),
  (200003, ARRAY['electrician']),
  (200004, ARRAY['plumber', 'mover']),
  (200005, ARRAY['cleaning']),
  (200006, ARRAY['plumber', 'electrician', 'handyman']),
  (200007, ARRAY['mover', 'handyman']),
  (200008, ARRAY['electrician', 'plumber']),
  (200009, ARRAY['cleaning', 'handyman']),
  (200010, ARRAY['mover', 'plumber'])
) AS t(t_id, cats), LATERAL UNNEST(t.cats) AS c(category)
WHERE p.telegram_id = t.t_id;

-- ============================================================
-- MASTER BALANCES
-- ============================================================
INSERT INTO public.master_balances (master_id, response_credits, total_purchased, total_spent)
SELECT id, 20 + (random() * 30)::int, 20, (random() * 15)::int
FROM public.profiles WHERE role = 'master';

-- ============================================================
-- ORDERS (15 штук, разные районы Минска)
-- ============================================================
INSERT INTO public.orders (client_id, category, description, price, is_negotiable, address_text, geo_location, status, created_at)
SELECT
  c.id,
  vals.category,
  vals.description,
  vals.price,
  vals.is_negotiable,
  vals.address,
  ST_SetSRID(ST_MakePoint(vals.lng, vals.lat), 4326),
  vals.status::public.order_status,
  now() - (random() * interval '72 hours')
FROM public.profiles c
CROSS JOIN (VALUES
  -- Мария Коваль (100001)
  ((SELECT id FROM public.profiles WHERE telegram_id = 100001), 'plumber',     'Протечка трубы под мойкой на кухне, капает на соседей. Нужен срочный ремонт.',                      80,  false, 'ул. Немига 5, кв. 42',       53.8988, 27.5484, 'open'),
  ((SELECT id FROM public.profiles WHERE telegram_id = 100001), 'electrician', 'Трещит и искрит розетка в спальне, перестал работать кондиционер.',                              65,  false, 'ул. Кальварийская 25',        53.8962, 27.5341, 'in_progress'),
  ((SELECT id FROM public.profiles WHERE telegram_id = 100001), 'handyman',    'Собрать шкаф-купе Икеа Пакс, 3 секции, инструкция есть. Инструмент нужен свой.',                  120, true,  'пр-т Победителей 59',         53.9156, 27.5252, 'open'),
  -- Елена Смирнова (100002)
  ((SELECT id FROM public.profiles WHERE telegram_id = 100002), 'cleaning',    'Генеральная уборка 3-комнатной квартиры 80м². Мытьё окон, химчистка дивана.',                       200, false, 'ул. Герасименко 12',          53.8834, 27.6831, 'open'),
  ((SELECT id FROM public.profiles WHERE telegram_id = 100002), 'electrician', 'Провести проводку для варочной панели на кухне. Кабель заложен, нужно подключение.',               90,  false, 'ул. Герасименко 12',          53.8836, 27.6835, 'open'),
  ((SELECT id FROM public.profiles WHERE telegram_id = 100002), 'mover',       'Перевезти диван, стол и 5 коробок из центра на Каменную Горку. Есть грузовой лифт.',               150, true,  'ул. Ленина 18 — Каменная Горка',53.9050, 27.5530, 'completed'),
  -- Ольга Фёдорова (100003)
  ((SELECT id FROM public.profiles WHERE telegram_id = 100003), 'plumber',     'Установить посудомоечную машину Bosch — подключение к воде и канализации, убрать столешницу.',        75,  false, 'ул. Притыцкого 156',          53.9315, 27.4187, 'open'),
  ((SELECT id FROM public.profiles WHERE telegram_id = 100003), 'handyman',    'Повесить 6 полок, 3 картины и кронштейн для телевизора. Стенка гипсокартон, нужны дюбели бабочка.', 70,  false, 'ул. Матусевича 40',           53.8881, 27.4712, 'cancelled'),
  ((SELECT id FROM public.profiles WHERE telegram_id = 100003), 'electrician', 'Заменить люстру в гостиной + dimmer-выключатель. Высота потолка 2.7м, стремянка есть.',             55,  false, 'ул. Притыцкого 156',          53.9312, 27.4182, 'open'),
  -- Татьяна Белова (100004)
  ((SELECT id FROM public.profiles WHERE telegram_id = 100004), 'cleaning',    'Уборка после ремонта — строительная пыль, 2-комнатная квартира, санузел. Пылесос есть.',            180, true,  'ул. Якуба Колоса 45',         53.9203, 27.5827, 'in_progress'),
  ((SELECT id FROM public.profiles WHERE telegram_id = 100004), 'mover',       'Разгрузить Газель (коробки, мешки) и поднять на 3-й этаж без лифта. Двое грузчиков, 2-3 часа.',    100, false, 'ул. Кедышко 6',              53.9126, 27.6985, 'open'),
  ((SELECT id FROM public.profiles WHERE telegram_id = 100004), 'handyman',    'Замена замков на входной двери (2 комплекта), подгонка двери — трётся о пол.',                     90,  false, 'ул. Якуба Колоса 45',         53.9201, 27.5823, 'open'),
  -- Анна Громова (100005)
  ((SELECT id FROM public.profiles WHERE telegram_id = 100005), 'plumber',     'Прорвало батарею отопления — течь в стыке. Подтекает соседям. Аварийно!',                           120, false, 'ул. Бурдейного 15',           53.8769, 27.4807, 'open'),
  ((SELECT id FROM public.profiles WHERE telegram_id = 100005), 'handyman',    'Собрать 2 кровати и 3 тумбочки — куплено в 21vek. Рассрочка по акту.',                             100, true,  'ул. Бурдейного 15',           53.8772, 27.4810, 'open'),
  ((SELECT id FROM public.profiles WHERE telegram_id = 100005), 'cleaning',    'Мытьё окон — 12 шт, 3 балкона. С наружной стороны нужен доступ. Моя помощь возможна.',              70,  false, 'ул. Кунцевщина 24',           53.9318, 27.4269, 'completed')
) AS vals(c_id, category, description, price, is_negotiable, address, lat, lng, status)
WHERE c.id = vals.c_id;

-- ============================================================
-- BIDS (отклики мастеров на открытые заказы)
-- ============================================================
INSERT INTO public.bids (order_id, master_id, proposed_price, comment)
SELECT o.id, m.id, vals.price, vals.comment
FROM public.orders o
JOIN public.profiles m ON m.role = 'master'
CROSS JOIN (VALUES
  -- Мария: заказ 1 (open plumber) — 3 отклика
  ('plumber',   'Алексей Кузнецов',   85,  'Выезжаю в течение часа, сантехник с опытом 10 лет.'),
  ('plumber',   'Иван Морозов',       70,  'Могу сделать дешевле, если сами купите комплектующие.'),
  ('plumber',   'Павел Захаров',      90,  'Буду через 30 минут. Есть всё необходимое.'),
  -- Мария: заказ 3 (open handyman) — 2 отклика
  ('handyman',  'Алексей Кузнецов',   NULL, 'Сборка шкафов — моя специализация. Икеа собирал много раз.'),
  ('handyman',  'Дмитрий Волков',     NULL, 'Цена договорная, посмотрю на месте. Есть опыт 5 лет.'),
  -- Елена: заказ 4 (open cleaning)
  ('cleaning',  'Андрей Соколов',     250,  'Выезжаю бригадой 2 человека. Химчистка дивана +300 BYN.'),
  ('cleaning',  'Максим Тихонов',     180,  'Уберу качественно, есть отзывы. Приеду с оборудованием.'),
  -- Елена: заказ 5 (open electrician)
  ('electrician','Сергей Новиков',     85,  'Электрик 15 лет стажа. Подключу с гарантией.'),
  ('electrician','Евгений Попов',      95,  'Варочная панель — стандартная работа. Сделаю за 2 часа.'),
  ('electrician','Павел Захаров',      80,  'Могу сегодня вечером.'),
  -- Ольга: заказ 7 (open plumber)
  ('plumber',   'Владимир Орлов',     85,  'Установлю посудомойку. Ваш Bosch — отличный выбор.'),
  ('plumber',   'Дмитрий Волков',     65,  'Сделаю за 1.5 часа.'),
  -- Ольга: заказ 9 (open electrician)
  ('electrician','Евгений Попов',      60,  'Люстру заменю быстро. Dimmmer тоже настрою.'),
  ('electrician','Сергей Новиков',     50,  'Минимальный выезд 50 BYN. Сделаю за час.'),
  -- Татьяна: заказ 11 (open mover)
  ('mover',     'Иван Морозов',       120, 'Газель разгрузим вдвоём за час-полтора.'),
  ('mover',     'Николай Ковалёв',    90,  'Поднимем на 3-й. Есть тележка.'),
  -- Татьяна: заказ 12 (open handyman)
  ('handyman',  'Дмитрий Волков',     85,  'Менял замки не раз — и дверь подгоню.'),
  ('handyman',  'Николай Ковалёв',    100, 'Приду с инструментом.'),
  -- Анна: заказ 13 (open plumber — аварийно!)
  ('plumber',   'Алексей Кузнецов',   130, 'Аварийно! Выезжаю прямо сейчас, на месте оценю.'),
  ('plumber',   'Павел Захаров',      120, 'Срочно. Буду через 20 минут.'),
  ('plumber',   'Владимир Орлов',     110, 'Еду. Перекройте пока стояк, буду на месте через 15 мин.'),
  -- Анна: заказ 14 (open handyman)
  ('handyman',  'Алексей Кузнецов',   120, 'Соберу мебель аккуратно, на месте. 21vek — норм, знаю.'),
  ('handyman',  'Максим Тихонов',     NULL, 'Могу помочь. Цена договорная после осмотра.')
) AS vals(cat, master_name, price, comment)
JOIN public.master_categories mc ON mc.master_id = m.id AND mc.category = o.category
WHERE o.status = 'open'
  AND vals.cat = o.category
  AND m.full_name = vals.master_name
  AND mc.master_id = m.id
LIMIT 25;

-- ============================================================
-- REVIEWS (для выполненных заказов)
-- ============================================================
INSERT INTO public.reviews (order_id, client_id, master_id, rating, comment)
SELECT o.id, o.client_id, b.master_id, vals.rating, vals.comment
FROM public.orders o
JOIN public.bids b ON b.order_id = o.id
CROSS JOIN (VALUES
  (100002, 'mover',    5, 'Быстро и аккуратно перевезли вещи. Спасибо!'),
  (100005, 'cleaning', 5, 'Окна идеально чистые, мастер очень вежливый. Буду заказывать ещё.')
) AS vals(client_tg, cat, rating, comment)
JOIN public.profiles c ON c.telegram_id = vals.client_tg
WHERE o.client_id = c.id
  AND o.category = vals.cat
  AND o.status = 'completed';

-- Включаем триггер обратно
ALTER TABLE public.profiles ENABLE TRIGGER trg_profiles_after_insert;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT 'profiles' AS tbl, count(*) FROM public.profiles
UNION ALL SELECT 'orders', count(*) FROM public.orders
UNION ALL SELECT 'bids', count(*) FROM public.bids
UNION ALL SELECT 'master_categories', count(*) FROM public.master_categories
UNION ALL SELECT 'master_balances', count(*) FROM public.master_balances
UNION ALL SELECT 'reviews', count(*) FROM public.reviews;
