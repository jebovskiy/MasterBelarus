# МастерБай — память проекта

## Что это
Биржа бытовых мастеров внутри Telegram Mini App. Рынок: Беларусь, 2026.
Проблема: найти проверенного сантехника/электрика/грузчика «сегодня» — хаос в Viber/Telegram-чатах ЖК, старые доски объявлений неповоротливы.
Решение: один запрос в Telegram → мастер из соседнего дома откликается за 2-5 минут.

## Стек
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui + @telegram-apps/sdk + Zustand + framer-motion
- Backend: Node.js + Express + TypeScript + telegraf + BullMQ (Redis) + socket.io
- DB: Supabase (PostgreSQL + PostGIS + Realtime + Storage + Auth)
- Infra: VPS Hetzner CX22 / Docker Compose / Nginx + Let's Encrypt
- Monitoring: Sentry, PostHog (analytics)
- CI: GitHub Actions (lint → typecheck → tests)

## Архитектура (monorepo)
```
MasterBelarus/
├── web/                  # React + Vite Mini App
├── api/                  # Node.js + Express + telegraf
├── docs/
│   ├── decisions.md      # ADRs
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── visual-spec.md    # дизайн-токены
├── memory/               # долговременный контекст для агентов
├── docker-compose.yml
└── package.json          # workspaces root
```

База данных Supabase:
- `profiles` (telegram_id, role: client|master, is_npd)
- `orders` (PostGIS location, category, status, images)
- `bids` (order → master → price)
- `master_categories` (many-to-many)
- `master_balances` (счётчик откликов)
- `reviews` (rating 1-5 + comment)
- `notifications_log` (история уведомлений)

PostGIS-функции:
- `find_orders_nearby(lat, lng, radius_m, category?)` — RPC
- `deduct_response(master_id)` — атомарное списание

## Дизайн-система
Визуальный промт сохранён в `docs/visual-spec.md`.
Цветовая палитра: светлый скандинавский минимализм (2026 Light Mode Luxury).
- Фон: #F8F9FA
- Карточки: #FFFFFF
- Акцент: #7C3AED (аметистовый)
- Графитовый текст: #111827
- Bento-grid лейаут: rounded-2xl карточки, rounded-xl кнопки
- Glassmorphism шапка: backdrop-blur
- Telegram HapticFeedback на все значимые действия

## Ключевые решения (ADR-lite)
1. **Нет эквайринга на MVP** — расчёты наличные/ЕРИП напрямую. Приложение = доска объявлений.
2. **Модель монетизации** — плата за отклик (0.5-1 BYN), пополнение через ЕРИП позже. Старт: 20 бесплатных откликов.
3. **Supabase Free Tier** для MVP, миграция на Pro при >500 MAU.
4. **Telegraf webhook** вместо polling для уведомлений.
5. **Redis для BullMQ** — чтобы не упираться в rate-limit Telegram (30 msg/sec).
6. **Cold start через ручной outreach** — 30-50 мастеров до публичного запуска.
7. **Локальный запуск** — один ЖК (Минск-Мир / Новая Боровая) как стартовая площадка.
8. **НПД-статус** — чекбокс в профиле мастера, без верификации на MVP.

## График MVP
```
Sprint 0:   15 ч  инфра + CI/CD + VPS
Sprint 1:   37 ч  БД + auth + telegraf старт (Week 1)
Sprint 2:   36 ч  заказы + гео + PostGIS (Week 2)
Sprint 3:   46 ч  отклики + уведомления + баланс (Week 3)
Sprint 4:   46 ч  завершение сделок + отзывы + запуск (Week 4)
Sprint 5:   26 ч  cold start marketing (parallel Week 4+)
───────────────────────────────────────
Total:     180 ч  (~4.5 недели full-time)
```

Критические метрики:
- Time-to-first-bid ≤ 5 минут
- API p95 ≤ 400 мс
- Cold-start загрузка ≤ 3 секунды
- Crash rate ≤ 0.5%
- Тесты критич. модулей ≥ 70%

## Конкурентное поле (РБ)
- Услуги.by, Куфар Услуги, ЯДо, Профи.ру (без Mini App)
- Чаты ЖК в Viber/Telegram (хаос, нет структуры)
- Сделай.бай — неповоротливый сайт

## Пост-MVP roadmap
- Month 2: эквайринг (bePaid/EasyPay), юрлицо ИП, админ-панель
- Month 3: веб-версия (не только Telegram), жалобы, гео-карта
- Month 4: BY/EN локализация, native push-уведомления

## Юридические TODO
- Консультация юриста: можно ли с комиссией за отклик оставаться «доской объявлений»
- Privacy Policy + Terms of Service (обязательно для Telegram bots)
- Договор-оферта для мастеров (перед эквайрингом)
- Нужен ИП для приёма платежей от мастеров (после включения монетизации)

## Контакты для cold start
- Kufar: раздел Услуги Минск
- VK: группы самозанятых мастеров
- Telegram: @chat_minsk_mir, чаты Новой Боровой, Лебяжьего
- Оффлайн: локальные строительные магазины и кофейни → QR-коды

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
- Railway проект создан (`8b43a314-...`), сервисы отложены.
- GitHub: `jebovskiy/MasterBelarus`, 4 commits pushed.

### В процессе
- Web: `CreateOrderSheet`, `MasterHome`, лента заказов, socket.io realtime.

### Не начато
- Seed data (`supabase/seed.sql`)
- CI (`.github/workflows/ci.yml`)
- `npm install` + sanity check
- Sprint 3: bids API, notifications, баланс

---
## TODO — 2026-07-01 04:42

1. **Web Sprint 2:** `CreateOrderSheet` + геолокация + `POST /orders`.
2. **Web Sprint 2:** `MasterHome` + лента `GET /orders/nearby` (Realtime).
3. **Seed data:** `supabase/seed.sql` — 6 категорий, 5 районов Минска.
4. **CI:** `.github/workflows/ci.yml`.
5. **npm install** + sanity check перед Railway deploy.

---
## RECENT FILES — 2026-07-01 04:42

### root
- `package.json`, `.gitignore`, `Dockerfile.api`

### api/ (Sprint 1-2)
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.eslintrc.yml`
- `.env.example`, `.dockerignore`
- `src/config/env.ts`, `src/lib/logger.ts`, `src/lib/supabase.ts`, `src/lib/app.ts`
- `src/middleware/auth.ts`, `src/services/telegram.ts`
- `src/routes/auth.ts`, `src/routes/orders.ts`, `src/bot/index.ts`, `src/server.ts`
- `src/types/orders.ts`
- `tests/telegram.test.ts`

### web/ (Sprint 1-2 в процессе)
- `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.ts`
- `index.html`, `.gitignore`, `vite-env.d.ts`
- `src/main.tsx`, `src/App.tsx`, `src/index.css`
- `src/lib/telegram.ts`, `src/lib/api.ts`
- `src/stores/auth.ts`
- `src/hooks/useTelegramAuth.ts`, `src/hooks/useHaptic.ts`
- `src/components/screens/SplashScreen.tsx`
- `src/pages/ClientHome.tsx`

### supabase/migrations/
- `20260701000001_create_enums.sql`
- `20260701000002_profiles.sql`
- `20260701000003_orders.sql`
- `20260701000004_bids.sql`
- `20260701000005_master_categories.sql`
- `20260701000006_master_balances.sql`
- `20260701000007_reviews.sql`
- `20260701000008_notifications_and_rpc.sql`
--- STATE ---
Создано на: 2026-07-01 04:55

Завершено (commit 25b610f):
- pi/src/routes/bids.ts — POST /orders/:id/bids, GET /orders/:id/bids, POST /orders/:id/accept-bid/:bidId
- pi/src/services/notifications.ts — sendBidNotification stub
- pi/src/types/bids.ts
- server.ts подключил bidsRouter под /orders

Не начато:
- frontend: кнопка «Откликнуться» в MasterHome → POST /orders/:id/bids
- CI sanity check: npm install, tsc --noEmit, vite build
--- STATE — 2026-07-01 05:00 ---

Завершено (commit e88ed8c):
- pi/src/routes/bids.ts — POST /orders/:orderId/bids, GET /orders/:orderId/bids, POST /orders/:orderId/accept-bid/:bidId
- pi/src/services/notifications.ts — stub sendBidNotification
- pi/src/types/bids.ts
- idsRouter подключен в server.ts под /orders
- **web Sprint 2-3:**
  - CreateOrderSheet — создание заказа через POST /orders
  - MasterHome — лента nearby + bid-sheet (AnimatePresence) + POST /orders/:id/bids
  - App.tsx — табы Клиенту/Мастеру

Не начато:
- Real уведомления: wired telegraf bot вместо stub
- Спринт 4: accept-bid → диалог, reviews, баланс
- CI sanity check
- Railway deploy
--- STATE — 2026-07-01 05:05 ---

Завершено (commit pending):
- pi/src/services/notifications.ts — real telegraf notifications (wired via initNotificationService)
- pi/src/server.ts — bot instance passed into notifier after webhook setup

Не начато:
- Sprint 4: accept-bid → диалог, reviews, finish order
- CI sanity check
- Railway deploy
--- STATE — 2026-07-01 05:15 ---
Завершено (commit 7e3e92d):
- pi/src/routes/masters.ts — GET /masters/:masterId/profile (агрегаты)
- pi/src/server.ts — регистрация /masters, initNotificationService в bootstrap
- pi/src/services/notifications.ts — real telegraf sendBidNotification + sendMasterAcceptedNotification
- pi/src/bot/index.ts — createBot c wired notifications

По бэклогу Sprint 4 закрыт (кроме POST /orders/:id/review, остался TODO).

Не начато:
- Frontend: OrderDetail + AcceptBid review flow
- POST /orders/:id/review endpoint
- npm install + sanity check
- Railway deploy

--- STATE — 2026-07-01 05:30 ---

Завершено (commit 8ac18f2):
- pi/src/routes/reviews.ts — POST /orders/:id/review + complete order
- pi/src/server.ts — mounted reviewsRouter
- **web:** OrderDetail.tsx — full cycle: order info, bids list, accept-bid, review form
- **web:** App.tsx — wired OrderDetail into tab-based shell

По бэклогу Sprint 4 закрыт полностью.

Сейчас: фронтенд cycle замкнут, но не тестировался (ждём npm install + sanity check).

---
## STATE — 2026-07-01 05:50

### Завершено (закоммичено, commit 8ac18f2 / c64644b)
- **Backend Sprint 4 closed:**
  - pi/src/routes/reviews.ts — POST /orders/:id/review
  - pi/src/routes/masters.ts — GET /masters/:masterId/profile
  - pi/src/services/notifications.ts — real telegraf bot sendMessage wired
  - pi/src/bot/index.ts — initNotificationService(bot) in createBot()
  - notices:приём отклика → уведомления клиенту и мастеру
- **Frontend Sprint 2-4 closed:**
  - CreateOrderSheet — форма заказа, POST /orders
  - MasterHome — лента nearby, bid sheet, POST /orders/:id/bids
  - OrderDetail — детали, список bids, accept, review form
  - App.tsx — табы Клиенту/Мастеру + OrderDetail интеграция
- **Sprint 5 (частично): админ-модуль**
  - pi/src/middleware/admin.ts
  - pi/src/routes/admin.ts
  - web/src/components/admin/AdminPanel.tsx
  - pi/.env.example — дополнен ADMIN_TOKEN, ADMIN_TELEGRAM_ID

### Не начато
- Админ: детальный review moderation + жалобы
- 
pm install + sanity check (api + web)
- Railway deployment (api + web сервисы)
- Sentry / PostHog
- Seed-скрипт с реальными пользователями

---
## TODO — 2026-07-01 05:50

1. **Sprint 5:** finish admin moderation (complaints + master suspend)
2. npm install в root → sanity check перед деплоем
3. Подключить Railway сервисы (api + web) — DONE
4. Наполнить Supabase тестовыми данными
5. **CI** — `.github/workflows/ci.yml`
6. **Sentry / PostHog** — мониторинг

---
## STATE — 2026-07-02 04:00 — Design fix + shared components

### Исправлено
- `vite.config.ts` — удалён `postcss: null` (PostCSS был выключен → Tailwind не работал → чёрный экран)
- Создан `postcss.config.cjs` — включает tailwindcss + autoprefixer плагины
- `tailwind.config.cjs` — добавлены все недостающие токены дизайна:
  - цвета: `primary-hover`, `primary-tint`, `success-tint`, `error`, `text-tertiary`, `app-surface-alt`
  - тени: `card`, `card-hover`, `modal`, `accent-glow`
  - `duration-180`, шрифт Inter
- `index.css` — добавлены CSS-переменные `--sat`/`--sab` для safe-area

### Создано
- `web/src/components/shared/` — система переиспользуемых компонентов:
  - `Button.tsx` — variant(primary|secondary|ghost|danger), size(sm|md|lg), loading, hover-scale, haptic
  - `Input.tsx` — label, prefix/suffix, error, multiline, placeholder
  - `Badge.tsx` — variant(success|warning|error|neutral|primary)
  - `Chip.tsx` — active|removable, hover state
  - `Avatar.tsx` — size(32|40|48|64), src/initials+gradient fallback
  - `BottomTabBar.tsx` — 4 таба с animated indicator, backdrop-blur, safe-area
  - `Toast.tsx` — ToastProvider + useToast() hook, success/error/info, auto-dismiss 3s

### Изменено
- `App.tsx` — BottomTabBar вместо top-nav "Клиенту/Мастеру", ToastProvider обёртка, safe-area bottom padding
- `main.tsx` — убран дублирующийся AuthGuard (уже в App.tsx)
- `MasterHome.tsx` — добавлен stats row "Выполнено/В работе/Сегодня", mock-данные balance+rating
- `ClientHome.tsx` — убран `pb-24` (parent управляет отступами)

### С чем не совпадает spec (осталось)
- ClientHome: активные заказы + карусель мастеров
- Hover scale(1.02) на кнопках (вместо active scale(0.98))
- LocationManager — геолокация через Telegram (сейчас хардкод lat/lng)
- Карусель последних мастеров
- Авторизация: AdminToken в хедере — не реализовано на фронте

### Не начато
- Seed data (supabase/seed.sql)
- CI (`.github/workflows/ci.yml`)
- Админ: жалобы, блокировка мастеров
- Sentry / PostHog
