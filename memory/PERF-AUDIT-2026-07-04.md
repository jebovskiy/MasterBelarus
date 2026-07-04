# Performance Audit — 2026-07-04

## Critical (ROI high, 0-15 min each)

### 1. Zustand store mutation — UI не обновляется

**Файлы:** `Profile.tsx:211`, `EditProfileScreen.tsx:48,78`
**Bug:** `profile!.current_role = next; setProfile(profile!);` — та же ссылка, Zustand не триггерит re-render
**Фикс:** `setProfile({ ...profile!, current_role: next });`
**Трудозатраты:** 10 мин

### 2. PostGIS ST_DWithin считает в градусах

**Файл:** `migrations/20260701000008_notifications_and_rpc.sql` (find_orders_nearby)
**Bug:** `geometry(Point,4326)` + ST_DWithin = градусы, не метры. `p_radius=5000` = вся планета
**Фикс:** `ALTER COLUMN geo_location TYPE geography(Point,4326) USING geo_location::geography`
**Трудозатраты:** 5 мин

### 3. cancel.ts — несуществующие колонки master_balances

**Файл:** `api/src/routes/cancel.ts:102-115`
**Bug:** `bid_balance` (нет), `telegram_id` (нет). Реальность: `response_credits`, `master_id`
**Фикс:** Исправить имена колонок, использовать `deduct_response` RPC или прямой UPDATE
**Трудозатраты:** 10 мин

### 4. Оба приложения всегда в DOM

**Файл:** `App.tsx:94-114`
**Bug:** `opacity:0 + pointer-events:none` = оба CustomerApp и MasterApp в памяти, двойные API-вызовы
**Фикс:** Условный рендеринг `{isMasterMode ? <MasterApp key="master" /> : <CustomerApp key="customer" />}` + AnimatePresence
**Трудозатраты:** 15 мин

## High (ROI medium, 5-30 min each)

### 5. Нет пагинации — списки растут бесконечно

**Файлы:** `/orders/my`, `/orders/nearby`, `/admin/orders`, `/admin/masters`, `/admin/complaints`
**Фикс:** `?limit=20&offset=0` на все list-эндпоинты
**Трудозатраты:** 20 мин

### 6. Нет code splitting — 10 экранов в одном бандле

**Файл:** `App.tsx` (статический import всех экранов)
**Фикс:** `React.lazy(() => import(...))` + Suspense
**Трудозатраты:** 30 мин

### 7. Город фильтруется в памяти Node.js

**Файл:** `api/src/routes/orders.ts:138-145`
**Bug:** `result.filter(o => o.address_text.startsWith(...))` после find_orders_nearby
**Фикс:** Передать `p_city` в RPC, `AND o.address_text LIKE 'г. Минск%'` в SQL
**Трудозатраты:** 15 мин

### 8. Telegram-уведомления последовательные

**Файл:** `api/src/services/notifications.ts:152-159`
**Bug:** `for...await bot.telegram.sendMessage` — 20 мастеров = 4s
**Фикс:** `Promise.allSettled()` + BullMQ (уже в deps)
**Трудозатраты:** 20 мин

### 9. Missing partial GIST index

**Файл:** `migrations/20260701000003_orders.sql`
**Bug:** `idx_orders_geo` (GIST) без фильтра по статусу — сканирует все заказы
**Фикс:** `CREATE INDEX idx_orders_open_geo ON orders USING GIST (geo_location) WHERE status = 'open'`
**Трудозатраты:** 5 мин

### 10. getTelegramInitData() парсится на каждый API-запрос

**Файл:** `web/src/lib/api.ts` + `telegram.ts`
**Bug:** `retrieveLaunchParams()` на каждый `authHeaders()` вызов
**Фикс:** `let _cached: string | null = null; if (_cached) return _cached;`
**Трудозатраты:** 5 мин

## Medium (ROI variable)

- 11. HMAC кеш в middleware/auth.ts — +5 мин
- 12. N+1 в refund loop — batch profiles + upsert — +15 мин
- 13. Polling без visibility check (MasterHome.tsx:71) — +10 мин
- 14. AbortController в AdminPanelView + useStartAppHandler — +15 мин
- 15. Staggered animation cap — `Math.min(idx * 0.04, 0.5)` — +5 мин
- 16. `backdrop-blur-sm` опционально на low-end — +10 мин
- 17. `react-router-dom` — unused dep — +2 мин

## Low

- 19. `layout` prop на списках (MasterHome.tsx:170) — +5 мин
- 20. Spring → cubic-bezier на bottom sheets — +10 мин
- 21. BullMQ/ioredis/socket.io — dead deps — +5 мин
- 22. Railway deploy: `npm ci` без lockfile — +5 мин
- 23. sourceMap: true в production — +5 мин
- 24. `role` колонка избыточна — migration 015 — +15 мин
- 25. Race condition accept-bid — atomic UPDATE — +10 мин
- 26. Триггер рейтинга — инкрементальный UPDATE — +10 мин

## Top 10 by ROI

| # | Фикс | Ожидаемый эффект | Время |
|---|------|-----------------|-------|
| 1 | Новый reference в setProfile | UI обновляется | 10 мин |
| 2 | geometry → geography | Proximity search работает | 5 мин |
| 3 | Правильные колонки master_balances | Refund работает | 10 мин |
| 4 | Условный рендеринг App | −50% памяти/API | 15 мин |
| 5 | Partial GIST index | 10× быстрее proximity | 5 мин |
| 6 | Пагинация LIMIT 20 | Стабильное время ответа | 20 мин |
| 7 | Code splitting | −30% initial bundle | 30 мин |
| 8 | City filter в RPC | Меньше данных по сети | 15 мин |
| 9 | getTelegramInitData кеш | 1 парсинг вместо N | 5 мин |
| 10 | Polling visibility check | 0 запросов в фоне | 10 мин |
