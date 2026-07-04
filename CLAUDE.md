# MasterBelarus

Биржа бытовых мастеров внутри Telegram Mini App. Рынок: Беларусь, 2026. Проблема: найти проверенного сантехника/электрика/грузчика «сегодня» — хаос в Viber/Telegram-чатах ЖК, старые доски объявлений неповоротливы. Решение: один запрос в Telegram → мастер из соседнего дома откликается за 2-5 минут.

## Стек

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui + framer-motion + Zustand + @telegram-apps/sdk
- **Backend**: Node.js + Express + TypeScript + telegraf + BullMQ (Redis)
- **DB**: Supabase (PostgreSQL + PostGIS + Realtime + Storage + Auth)
- **Infra**: Hetzner CX22 / Docker / Nginx + Let's Encrypt

## Архитектура

```
MasterBelarus/
├── web/                  # React + Vite Mini App
├── api/                  # Express + telegraf
├── docs/                 # ADRs, ARCHITECTURE, API, visual-spec
├── memory/PROJECT.md     # полный лог сессий
├── supabase/migrations/  # 13 миграций
└── package.json          # workspaces root
```

## Дизайн-система

- Фон: `bg-[#f4f4f6]` (slate-100)
- Карточки: `bg-white rounded-2xl shadow-sm`
- Акцент: `bg-slate-900 text-white` (кнопки)
- Ввод: `bg-[#f4f4f6] rounded-xl p-4 focus:ring-2 focus:ring-slate-400 focus:bg-white`
- Метки: `text-xs font-semibold text-slate-500 uppercase tracking-wider`
- Bottom sheet: `bg-white rounded-t-2xl shadow-lg shadow-slate-200/50 max-h-[90vh]`
- Анимация: framer-motion, spring/damping, swipe-to-close
- Haptic: `useHaptic()` на все тапы

## Ключевые правила

1. **Всегда кнопки**: `bg-slate-900 text-white rounded-xl py-3.5 font-semibold active:scale-[0.98]`
2. **Bottom sheet стандарт**: drag="y" + dragElastic + onDragEnd с swipeConfidenceThreshold=80 / swipeVelocityThreshold=400
3. **AnimatePresence**: все оверлеи/листы с key={}, initial/animate/exit, duration 0.25
4. **Toast**: через `useToastStore` (zustand), не через `notification()`
5. **Telegram**: хедер `x-telegram-init-data` через `getTelegramInitData()`
6. **Все города** (заказы, профиль): через `CitySelector` из `@/data/belarus-cities`, никакого free-text

## Города (belarus-cities)

- 6 областей: Минская, Брестская, Витебская, Гомельская, Гродненская, Могилёвская
- Каскад: область → город → район (только для Минска: 9 районов)
- `address_text` собирается: `"г. {city}, {district} р-н, {street}"`

## БД (Supabase)

- `profiles` (telegram_id, role, is_npd, city, phone, is_master, current_role, master_status)
- `orders` (PostGIS geo_location, address_text, category, status, images)
- `bids` (order_id → master_id, proposed_price)
- `reviews` (order_id, rating 1-5, comment)
- `master_balances` (bid_balance, total_earned)
- `complaints` (user_name, text, status)
- `notifications_log`
- RPC: `find_orders_nearby(lat, lng, radius_m, category?)`, `deduct_response(master_id)`

## API маршруты

| Route | Описание |
|---|---|
| POST /auth/telegram | Вход через Telegram |
| POST /auth/become-master | Заявка мастером |
| POST /auth/switch-role | Переключение роли |
| PATCH /auth/profile | Редактирование профиля |
| POST /auth/avatar | Загрузка аватара |
| POST /orders | Создание заказа |
| GET /orders/:id | Детали заказа |
| GET /orders/nearby | Поиск рядом (мастер) |
| GET /orders/my | История заказов |
| POST /orders/:id/bids | Отклик мастера |
| POST /orders/:id/accept-bid/:bidId | Выбор мастера |
| POST /orders/:id/review | Отзыв + завершение |
| GET /admin/* | Админка (проверка adminRequired) |
| POST /complaints | Жалоба от клиента |

## Ключевые решения (ADR-lite)

1. **Нет эквайринга на MVP** — расчёты наличные/ЕРИП напрямую. Приложение = доска объявлений.
2. **Модель монетизации** — плата за отклик (0.5-1 BYN), пополнение через ЕРИП позже. Старт: 20 бесплатных откликов.
3. **Supabase Free Tier** для MVP, миграция на Pro при >500 MAU.
4. **Telegraf webhook** вместо polling для уведомлений.
5. **Redis для BullMQ** — чтобы не упираться в rate-limit Telegram (30 msg/sec).
6. **Cold start через ручной outreach** — 30-50 мастеров до публичного запуска.
7. **Локальный запуск** — один ЖК (Минск-Мир / Новая Боровая) как стартовая площадка.
8. **НПД-статус** — чекбокс в профиле мастера, без верификации на MVP.

## Файлы сессии (последние изменения)

### OrderDetail.tsx — bottom sheet (как CreateOrderSheet)
- drag-to-dismiss, `bg-white rounded-t-2xl`, `text-slate-*`
- AnimatePresence enter/exit key={orderId}

### CitySelector + belarus-cities.ts
- Каскад: область → город → район (для Минска)
- Интегрирован в: CreateOrderSheet, EditProfileScreen, Profile (стать мастером)

### CreateOrderSheet.tsx
- CitySelector + улица/дом вместо free-text адреса
- `address_text` собирается: `"г. {city}, {district} р-н, {street}"`

## TODO

1. Админ: детальный review moderation + жалобы — DONE
2. npm install в root → sanity check перед деплоем — NOT STARTED
3. CI — `.github/workflows/ci.yml` — NOT STARTED
4. Sentry / PostHog — NOT STARTED
5. **Hover scale(1.02)** на кнопках (сейчас active scale(0.98)) — NOT STARTED
6. API-валидация городов на бэкенде — NOT STARTED
7. Поиск по городу в ленте мастеров — NOT STARTED
8. Real уведомления: wired telegraf bot — DONE
9. Seed-скрипт — DONE

---

## STATE — 2026-07-01 04:42

### Завершено (закоммичено)
- Root: `package.json` (workspaces api + web), `.gitignore`, `README.md`, `Dockerfile.api`
- **API Sprint 1:** Express + telegraf + Supabase + zod + pino.
  - `POST /auth/telegram` — HMAC-валидация initData, upsert profiles.
  - Telegraf `/start`, deep-link `?startapp=ref_*`, inline-keyboard.
  - Webhook на `/telegraf/<TOKEN>`.
  - Unit-тесты: `tests/telegram.test.ts`.
- **8 идемпотентных Supabase миграций:**
  - `001_create_enums`, `002_profiles+RLS`, `003_orders+PostGIS+RLS`,
  - `004_bids+RLS`, `005_master_categories+RLS`,
  - `006_master_balances+deduct_response()+trigger`,
  - `007_reviews+avg_rating trigger`,
  - `008_notifications_log+find_orders_nearby()+storage bucket`.
- **Web Sprint 1:** React 18 + Vite + Tailwind (palette из visual-spec).
  - `@telegram-apps/sdk` init, `window.Telegram` типы.
  - Zustand auth-store, `useTelegramAuth`, `useHaptic`.
  - `SplashScreen + AuthGuard`, `ClientHome` (Hero Bento + 6 категорий).
- **Sprint 2 backend (частично):**
  - `api/src/routes/orders.ts` — POST/GET/:id/GET/nearby/PATCH/:id/status.
  - Подключен в `server.ts`.
- Railway проект создан, сервисы отложены.
- GitHub: `jebovskiy/MasterBelarus`.

### В процессе
- Web: `CreateOrderSheet`, `MasterHome`, лента заказов, socket.io realtime.

### Не начато
- Seed data (`supabase/seed.sql`)
- CI (`.github/workflows/ci.yml`)
- `npm install` + sanity check
- Sprint 3: bids API, notifications, баланс

---

## STATE — 2026-07-01 04:55

Завершено (commit 25b610f):
- `api/src/routes/bids.ts` — POST /orders/:id/bids, GET /orders/:id/bids, POST /orders/:id/accept-bid/:bidId
- `api/src/services/notifications.ts` — sendBidNotification stub
- `api/src/types/bids.ts`
- server.ts подключил bidsRouter под /orders

Не начато:
- frontend: кнопка «Откликнуться» в MasterHome → POST /orders/:id/bids
- CI sanity check: npm install, tsc --noEmit, vite build

---

## STATE — 2026-07-01 05:00

Завершено (commit e88ed8c):
- api/src/routes/bids.ts — POST/GET/accept-bid
- api/src/services/notifications.ts — stub
- **web Sprint 2-3:**
  - CreateOrderSheet — создание заказа через POST /orders
  - MasterHome — лента nearby + bid-sheet + POST /orders/:id/bids
  - App.tsx — табы Клиенту/Мастеру

Не начато:
- Real уведомления
- Спринт 4: accept-bid → диалог, reviews, баланс
- CI sanity check, Railway deploy

---

## STATE — 2026-07-01 05:05

Завершено (commit pending):
- api/src/services/notifications.ts — real telegraf notifications (wired)

Не начато:
- Sprint 4: accept-bid → диалог, reviews, finish order
- CI sanity check, Railway deploy

---

## STATE — 2026-07-01 05:15

Завершено (commit 7e3e92d):
- api/src/routes/masters.ts — GET /masters/:masterId/profile
- api/src/services/notifications.ts — real sendBidNotification + sendMasterAcceptedNotification
- api/src/bot/index.ts — createBot c wired notifications

По бэклогу Sprint 4 закрыт (кроме POST /orders/:id/review).

Не начато:
- Frontend: OrderDetail + AcceptBid review flow
- POST /orders/:id/review endpoint
- npm install + sanity check, Railway deploy

---

## STATE — 2026-07-01 05:30

Завершено (commit 8ac18f2):
- api/src/routes/reviews.ts — POST /orders/:id/review + complete order
- **web:** OrderDetail.tsx — full cycle: order info, bids list, accept-bid, review form
- **web:** App.tsx — wired OrderDetail into tab-based shell

По бэклогу Sprint 4 закрыт полностью. Фронтенд cycle замкнут.

---

## STATE — 2026-07-01 05:50

### Завершено (commits 8ac18f2 / c64644b)
- **Backend Sprint 4 closed:**
  - api/src/routes/reviews.ts — POST /orders/:id/review
  - api/src/routes/masters.ts — GET /masters/:masterId/profile
  - api/src/services/notifications.ts — real telegraf bot sendMessage wired
  - api/src/bot/index.ts — initNotificationService(bot) in createBot()
- **Frontend Sprint 2-4 closed:**
  - CreateOrderSheet, MasterHome, OrderDetail, App.tsx tabs
- **Sprint 5 (частично): админ-модуль**
  - api/src/middleware/admin.ts, api/src/routes/admin.ts
  - web/src/components/admin/AdminPanel.tsx
  - .env.example — ADMIN_TOKEN, ADMIN_TELEGRAM_ID

### Не начато
- Админ: детальный review moderation + жалобы
- npm install + sanity check
- Railway deployment, Sentry / PostHog, Seed-скрипт

---

## STATE — 2026-07-02 04:00 — Design fix + shared components

### Исправлено
- `vite.config.ts` — удалён `postcss: null` (PostCSS был выключен → Tailwind не работал)
- Создан `postcss.config.cjs` — tailwindcss + autoprefixer
- `tailwind.config.cjs` — добавлены токены дизайна (цвета, тени, duration)
- `index.css` — CSS-переменные `--sat`/`--sab` для safe-area

### Создано
- `web/src/components/shared/`: Button, Input, Badge, Chip, Avatar, BottomTabBar, Toast

### Изменено
- App.tsx — BottomTabBar, ToastProvider
- MasterHome.tsx — stats row
- ClientHome.tsx — убран pb-24

---

## STATE — 2026-07-02 04:20 — Profile screen + CreateOrderSheet redesign

### Создано
- `web/src/components/screens/Profile.tsx` — динамический профиль с Role Toggle, мастер/клиент view

### Изменено
- `CreateOrderSheet.tsx` — редизайн «Мягкая галька»: `bg-white rounded-2xl shadow-lg`, поля `bg-[#f4f4f6]`, метки `text-xs font-semibold text-slate-500 uppercase tracking-wider`
- `App.tsx` — подключён Profile
- `ClientHome.tsx` — Hero bento, активные заказы, карусель мастеров, API-запросы

---

## STATE — 2026-07-02 05:20 — Seed + LocationManager + AdminToken

### Создано
- `supabase/seed.sql` — 10 мастеров, 5 клиентов, 15 заказов, 25 откликов
- `web/src/hooks/useLocation.ts` — LocationManager (Telegram → Geolocation API → Minsk fallback)
- `web/src/stores/admin.ts` — zustand store + adminHeaders
- `web/src/components/screens/AdminDashboard.tsx`

### Изменено
- `api/src/routes/admin.ts` — adminRequired на все роуты
- `MasterHome.tsx` — useLocation() вместо хардкода
- `App.tsx`, `Profile.tsx` — админ-навигация

---

## STATE — 2026-07-02 05:50 — Admin panel refactor

### Изменено
- App.tsx — AnimatePresence overlay
- Profile.tsx — карточка админки
- AdminDashboard.tsx → AdminPanelView.tsx (full screen, «Мягкая галька»)

### Создано
- `AdminPanelView.tsx` — 4 таба (Статистика, Заказы, Мастера, Жалобы)

---

## STATE — 2026-07-02 06:10 — Admin access via long-press

### Изменено
- BottomTabBar.tsx — long-press (500ms) на Profile → popover
- App.tsx — Profile без onOpenAdmin
- Profile.tsx — удалён импорт useAdminStore

---

## STATE — 2026-07-02 06:40 — Premium Toast (zustand + haptic)

### Создано
- `Toast.tsx` — zustand store, haptic, backdrop-blur, fadeInUp CSS

### Изменено
- App.tsx, Profile.tsx, MasterHome.tsx, CreateOrderSheet.tsx, ClientHome.tsx — useToast → useToastStore

---

## STATE — 2026-07-02 07:10 — 4 рабочих экрана (Settings, EditProfile, Wallet, OrderHistory)

### Создано
- SettingsScreen, EditProfileScreen, WalletScreen, OrderHistoryScreen
- api/src/routes/auth.ts — PATCH /auth/profile, POST /auth/avatar
- api/src/routes/orders.ts — GET /orders/my
- migrations 009, 010

### Архитектура
- 4 экрана как overlay (fixed inset-0 z-30), анимация fade+slide x-20

---

## STATE — 2026-07-02 07:30 — Avatar из Telegram + загрузка

### Создано
- migration 010 — storage bucket avatars + RLS

### Изменено
- api/src/routes/auth.ts — photo_url → avatar_url, POST /auth/avatar
- web: Avatar upload flow в EditProfileScreen

---

## STATE — 2026-07-02 08:00 — Phone symmetry

### Изменено
- Profile.tsx — masked phone, bottom sheet edit
- MasterHome.tsx — phone in header, edit button
- EditProfileScreen.tsx — phone init from profile
- stores/auth.ts — phone field
- lib/api.ts — isErrorResult() type guard

---

## STATE — 2026-07-02 08:40 — Role separation

### Добавлено
- migration 011 — is_master, current_role, master_status
- api/src/services/botRegistry.ts

### Backend
- POST /auth/become-master, POST /auth/switch-role, GET /auth/master-status
- POST /admin/masters/approve|reject/:telegramId

### Frontend
- CustomerApp / MasterApp по current_role
- Profile: toggle, become-master form, pending/rejected статусы

---

## STATE — 2026-07-02 09:20 — Auth fix + Profile polish

### Изменено
- api.ts — getTelegramInitData() вместо window.Telegram
- Profile.tsx — formatPhone, formatPhoneInput, maskPhone, ProfileBottomSheet, SettingsCard

---

## STATE — 2026-07-02 09:40 — Bot deep linking + notifications + moderation guard

### bot/index.ts
- Deep linking: startPayload → order_{id}, master_feed
- Atomic guard: master_status check before approve/reject

### services/notifications.ts
- sendBidNotification, notifyMasterApproved, sendMasterAcceptedNotification

---

## STATE — 2026-07-02 10:00 — Admin moderation tab

### AdminPanelView.tsx
- Таб Модерация (5-й), GET /admin/masters/pending
- Карточки, approve/reject per-card loading

### Migration 012
- category column в profiles

---

## STATE — 2026-07-02 10:20 — Admin auto-auth via initData

### api/src/middleware/admin.ts
- Два способа: x-admin-token ИЛИ x-telegram-init-data

### web/src/stores/admin.ts
- setTelegramAdmin(), adminHeaders() с initData

### AdminPanelView.tsx
- Авто-проверка доступа через /admin/stats

---

## STATE — 2026-07-02 10:40 — Admin entry button from Profile

### api/src/routes/admin.ts
- GET /admin/self — заглушка за adminRequired

### App.tsx
- Overlay тип расширен, adminOpen → overlay навигация

### Profile.tsx
- Проверка /admin/self при монтировании, кнопка «⚙️ Администрирование»

---

## STATE — 2026-07-02 10:50 — OrderHistoryScreen infinite loading fix

### OrderHistoryScreen.tsx
- Добавлен setLoading(false) в успех и catch

---

## STATE — 2026-07-02 10:55 — Real complaints (instead of mocks)

### migration 013
- Таблица complaints

### api/src/routes/admin.ts
- GET /admin/complaints, POST /admin/complaints/:id/resolve

### AdminPanelView.tsx
- Реальные жалобы вместо MOCK_COMPLAINTS

---

## STATE — 2026-07-02 11:10 — Bot commands overhaul

### api/src/bot/index.ts
- /start, /help, /menu, /status
- Master moderation approve/reject
- Complaint moderation block/dismiss

### api/src/services/notifications.ts
- notifyLowBalance, notifyComplaintToModerator

### api/src/routes/complaints.ts (new)
- POST /complaints

---

## STATE — 2026-07-03 12:20 — OrderDetail bottom sheet + Belarus city cascade picker

### OrderDetail.tsx — полный редизайн под CreateOrderSheet стиль
- Переписан с full-screen на bottom sheet с drag-to-dismiss
- `bg-white rounded-t-2xl shadow-lg shadow-slate-200/50` вместо `bg-app-bg / shadow-card`
- `bg-[#f4f4f6]` карточки вместо `rounded-bento`
- `text-slate-*` цветовая схема вместо `text-text-main / text-text-muted`
- AnimatePresence enter/exit анимация (key={orderId})
- Swipe down / backdrop click → onBack()

### CitySelector — каскадный выбор города
- `web/src/data/belarus-cities.ts` — 6 областей, 120+ городов, 9 районов Минска
- `web/src/components/shared/CitySelector.tsx` — bottom sheet picker (oblast → city → district)
- Интегрирован в:
  - **CreateOrderSheet**: CitySelector + улица/дом → `address_text` собирается как `"г. {city}, {district} р-н, {street}"`
  - **EditProfileScreen**: `city` через CitySelector
  - **Profile** (стать мастером): `city` через CitySelector
- Коммит: `b3474fd`
- Не начато: API-валидация городов на бэкенде, поиск по городу в ленте мастеров

---

## STATE — 2026-07-03 12:40 — Order cancellation system (client + master)

### Migration 014
- `orders`: `cancelled_by`, `cancellation_reason_id`, `cancellation_reason_text`
- `profiles`: `suspicious` (default false)

### Backend
- `api/src/routes/cancel.ts` — `POST /orders/:id/cancel` с Zod
- Клиент (open): 5 причин. Мастер (in_progress): 3 причины
- Rate-limit: in-memory Map, 3/24ч → suspicious + auto-complaint
- Refund bid_balance при причине 1 или <5 мин
- Мастер-отмена: клиенту Telegram + кнопка реактивации
- `api/src/services/cancelTracker.ts` — in-memory rate limiter
- `api/src/services/notifications.ts` — sendOrderCancelledToMasters, sendMasterCancelledToClient, sendRefundNotification

### Frontend
- OrderDetail.tsx — кнопка отмены + bottom sheet причин

### Коммит: `14624d9`

---

## STATE — 2026-07-03 13:00 — API-валидация городов + фильтр по городу в ленте

### Backend
- `api/src/data/belarus-cities.ts` — плоский Set всех городов, функция `isValidCity()`
- `POST /auth/become-master`: `city` валидируется через `.refine(isValidCity)`
- `PATCH /auth/profile`: `city` валидируется (только если передан)
- `POST /orders`: `address_text` парсится (`г. {city}`), город валидируется
- `GET /orders/nearby`: опциональный `?city=` — фильтрация по `address_text LIKE 'г. {city}%'`

### Frontend
- `MasterHome.tsx`: CitySelector между статистикой и кнопкой редактирования, сброс фильтра

### Коммит: `605c1bb`

---

## STATE — 2026-07-03 13:10 — Fix cancel button visibility

### OrderDetail.tsx
- Убрана избыточная проверка `order?.cancelled_by !== 'client'/'master'` (статус уже гарантирует)
- Добавлен fallback `role = currentRole ?? 'customer'` (если профиль ещё загружается)

### Коммит: `2800538`

---

## STATE — 2026-07-03 13:20 — Missing onOpenOrder in ClientHome

### App.tsx
- `ClientHome` не передавался `onOpenOrder` → тап по активному заказу на главной ничего не делал
- Добавлен: `onOpenOrder={(id) => setSelectedOrderId(id)}`

### Commit: `51763d3`

---

## STATE — 2026-07-03 13:30 — Fix cancel order not moving to archive

### api/src/routes/cancel.ts
- `.update({status:'cancelled',...})` не проверял `updateErr` — Supabase мог вернуть ошибку, но API отвечал `{ok:true}`
- Пользователь видел тост «Заказ отменён», заказ UI-локально менялся на cancelled, но при перезагрузке список возвращал старый статус
- Добавлено `if (updateErr) throw updateErr`

### Commit: `172521c`

---

## STATE — 2026-07-03 13:40 — Fix cancel error after migration 014 not applied

### api/src/routes/cancel.ts
- После добавления проверки `updateErr` стала вылезать ошибка — колонки `cancelled_by`, `cancellation_reason_id`, `cancellation_reason_text` отсутствуют в БД (миграция 014 не накачена)
- Фикс: разделён UPDATE на 2 — сначала статус (гарантированно работает), потом детали отмены (игнорируется ошибка если колонок нет)

### Commit: `5009953`

---

## STATE — 2026-07-03 23:30 — Master in_progress tab + OrderDetail fixes

### API
- `GET /orders/in-progress` — bids → filter in_progress orders for current master
  - Ищет все bids мастера, собирает order_ids, фильтрует по status='in_progress'

### Frontend
- `web/src/components/screens/MasterInProgress.tsx` — список заказов в работе мастера
  - Карточки с category, description, address, price, датой
  - Cancel button с e.stopPropagation() (не триггерит открытие OrderDetail)
  - Bottom sheet c 3 причинами отмены (мастер)
  - onOpenOrder для открытия OrderDetail по тапу на карточку
- `web/src/data/cancel-reasons.ts` — shared константы CLIENT_REASONS + MASTER_REASONS
- `App.tsx` — placeholder заменён на `<MasterInProgress />` с onOpenOrder
- `OrderDetail.tsx`:
  - Добавлены `client_id`, `master_id` в OrderRow
  - Форма отзыва скрыта для не-владельцев заказа (`isOwner` check)

### Не начато
- `/startapp=reactivate_order_{id}` handler в bot/index.ts (после отмены мастером)

### Commit: `febde51`

---

## STATE — 2026-07-04 11:00 — Global bottom sheet template + layout refactor

### Сделано
- **WalletScreen**: `pb-32` на scrollable content, футер кнопки → `absolute bottom-0 bg-gradient-to-t`
- **EditProfileScreen**: та же схема — absolute gradient footer с кнопкой сохранения, `pb-32` контент
- **CreateOrderSheet**: полный редизайн под шаблон (header + handle, scrollable pb-32, absolute gradient footer)
- **MasterHome bid-sheet**: редизайн под шаблон (header, scrollable pb-32, footer submit)
- **MasterInProgress cancel-sheet**: редизайн под шаблон (header, scrollable pb-32 с причинами, footer "Передумал")
- **OrderDetail**: редизайн под шаблон (header, scrollable pb-32, absolute footer с контекстными кнопками)
  - Завершить+оценить / Отменить — только когда уместно
  - Вложенный cancel-sheet тоже refactored под шаблон
- **SettingsScreen**, **OrderHistoryScreen** — уже имели `flex-col` + safe-area (OK)
- **CLAUDE.md** обновлён

### API
- `POST /orders/:id/reactivate` — возвращает cancelled → open, только если cancelled_by === 'master' и только клиентом-владельцем

### Bot
- `/start` handler: `reactive_order_{id}` — сообщение с кнопкой "Вернуть в поиск"

### Frontend
- `web/src/hooks/useStartAppHandler.ts` — детектит `startapp=reactive_order_{id}`, confirm(), POST /reactivate
- `web/src/App.tsx` — подключен хук в AppShell
- `web/src/lib/telegram.ts` — getStartParam()

### В работе (эта сессия)
- cancel.ts: убран дубликат catch-блока после вставки reactivate

### Commit: `d8b78ad`

---

## TODO
1. ~~Set CI — `.github/workflows/ci.yml`~~ — отложено
2. `npm install` в корне → sanity check
3. Railway deploy
4. Hover scale(1.02) на кнопках
5. API-валидация городов на бэкенде — DONE
6. Поиск по городу в ленте мастеров — DONE
7. ~~Real уведомления: wired telegraf bot~~ — DONE (Sprint 4)
8. ~~Seed-скрипт~~ — DONE
9. ~~Админ: детальный review moderation + жалобы~~ — DONE
10. **Reactivate cancelled order** — DONE (this session)
