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

---
## STATE — 2026-07-02 04:20 — Profile screen + CreateOrderSheet redesign

### Создано
- `web/src/components/screens/Profile.tsx` — динамический экран профиля:
  - Role Toggle Switch (Я заказчик / Я мастер) — `bg-slate-200/60` плашка, активная роль с белой подложкой
  - Мастер: аватар, рейтинг, теги специализаций, НПД-статус (emerald), «О мастере», статистика заказов, кнопка редактирования
  - Клиент: аватар, рейтинг, маскированный телефон, история заказов (активные/завершённые), способы оплаты (чекбоксы), кнопка изменения данных
  - Footer: «Выйти из аккаунта» (rose-500/60)
  - Mock-данные для мастера (специализации, описание, статистика)

### Изменено
- `CreateOrderSheet.tsx` — полный редизайн в стиле «Мягкая галька»:
  - Белая карточка `rounded-2xl shadow-lg shadow-slate-200/50 p-6`
  - Поля `bg-[#f4f4f6] rounded-xl p-4 border-transparent focus:ring-2 focus:ring-slate-400 focus:bg-white`
  - Метки `text-xs font-semibold text-slate-500 uppercase tracking-wider`
  - Категории: `bg-slate-800` (актив) / `bg-[#f4f4f6]` (неактив)
  - Кнопка `bg-slate-900 text-white py-4 rounded-xl`
  - Toast через shared-компонент вместо `notification()`
- `App.tsx` — подключён Profile вместо заглушки
- `ClientHome.tsx` — полное обновление:
  - Hero bento в стиле «Мягкая галька» (bg-white rounded-2xl shadow-sm, slate-900 заголовок)
  - Активные заказы: эмодзи статуса, emerald-500 левая рамка, status badge (Поиск мастера / В работе)
  - Карусель «Проверенные мастера»: snap-x горизонтальный скролл, w-44 карточки, онлайн-индикатор emerald-500, аватар буква, рейтинг звёздами
  - API запросы /orders/my + /masters/recent с fallback на мок-данные
  - Скелетоны загрузки через animate-pulse

### Не начато
- CI (`.github/workflows/ci.yml`)
- Админ: жалобы, блокировка мастеров
- Sentry / PostHog
- Hover scale(1.02) на кнопках (вместо active scale(0.98))

---
## STATE — 2026-07-02 05:20 — Seed + LocationManager + AdminToken

### Создано
- `supabase/seed.sql` — 10 мастеров, 5 клиентов, 15 заказов, 25 откликов, категории, балансы
- `web/src/hooks/useLocation.ts` — LocationManager через Telegram WebApp > Geolocation API > Minsk fallback, кеш localStorage
- `web/src/stores/admin.ts` — zustand store + adminHeaders helper
- `web/src/components/screens/AdminDashboard.tsx` — экран администратора:
  - Ввод AdminToken (пароль, кеш localStorage)
  - 3 таба: Статистика / Заказы / Мастера
  - Тёмная тема (bg-slate-900), адаптив

### Изменено
- `api/src/routes/admin.ts` — добавлен `adminRouter.use(adminRequired)` на все админ-роуты
- `web/src/components/screens/MasterHome.tsx` — хардкод lat/lng заменён на `useLocation()`
- `web/src/App.tsx` — adminOpen стейт, условный рендер AdminDashboard вместо BottomTabBar
- `web/src/components/screens/Profile.tsx` — проп onOpenAdmin, кнопка «Админ-панель» в футере
-
----
-## STATE — 2026-07-02 05:50 — Admin panel refactor: отдельный полноэкранный экран + дизайн «Мягкая галька»
-
-### Изменено
-- `web/src/App.tsx` — AnimatePresence + motion.div для fade/slide перехода (duration 0.2s, ease [0.32,0.72,0,1])
-- `web/src/components/screens/Profile.tsx` — старая невидимая кнопка «Админ-панель» заменена на карточку bg-white rounded-2xl p-5 с иконкой 🛠 и →; показывается только когда isAdmin === true; useAdminStore вызов вынесен наверх компонента
-- `web/src/components/screens/AdminDashboard.tsx` — удалён (заменён на AdminPanelView)
-
-### Создано
-- `web/src/components/screens/AdminPanelView.tsx` — полноэкранный админ-экран в стиле «Мягкая галька»:
-  - Login-экран (без токена): bg-[#F4F4F6], карточка bg-white rounded-2xl, поле ввода bg-[#F4F4F6], кнопка bg-slate-900
-  - Хедер: bg-white shadow-sm rounded-xl border border-slate-100, кастомная кнопка «← Назад», «Выйти» (text-rose-500)
-  - Таб-бар: bg-slate-100 rounded-xl p-1 (как Role Toggle в Profile), 4 таба: Статистика, Заказы, Мастера, Жалобы
-  - Статистика: grid 2×2 карточек bg-white rounded-2xl p-5 shadow-sm
-  - Заказы: карточки bg-white rounded-2xl p-5, статус-бейджи (emerald/blue/amber), цена, дата
-  - Мастера: карточки bg-white rounded-2xl p-5, рейтинг (amber-600), НПД-бейдж, дата регистрации
-  - Жалобы: микро-карточки с name (font-semibold), текстом (text-xs text-slate-500), кнопки «Отклонить» (bg-slate-100) / «Заблокировать» (bg-rose-50 text-rose-600), состояние resolved/blocked
-  - Анимация: active:scale-[0.97] на всех кнопках, active:scale-[0.98] на карточках
-
-### Архитектура навигации
-- Profile → onOpenAdmin → setAdminOpen(true) → AnimatePresence монтирует AdminPanelView
-- AdminPanelView → onClose → setAdminOpen(false) → fade-out
-- BottomTabBar скрыт пока adminOpen === true
-- При отсутствии AdminToken экран показывает только логин-форму
-- API те же: /admin/stats, /admin/orders, /admin/masters (mock complaints на фронте)
-
----
-## STATE — 2026-07-02 06:10 — Admin access via long-press on Profile tab
-
-### Изменено
-- `web/src/components/shared/BottomTabBar.tsx` — long-press (500ms) на кнопке Profile; если `profile.telegram_id === VITE_ADMIN_TELEGRAM_ID` → popover с выбором «Профиль» / «Админ-панель»; таймер сбрасывается на pointerUp/pointerLeave; isLongPress флаг блокирует обычный click
-- `web/src/App.tsx` — Profile без `onOpenAdmin`; BottomTabBar с пропом `onAdminChoice`
-- `web/src/components/screens/Profile.tsx` — удалён импорт `useAdminStore`, проп `onOpenAdmin`, карточка «Панель администратора»
-- `web/vite-env.d.ts` — добавлен тип `VITE_ADMIN_TELEGRAM_ID`
-- `web/.env` — создан с `VITE_ADMIN_TELEGRAM_ID=0` (заменить на Railway)
-
-### Архитектура
-- без Admin ID: long-press бездействует
-- с Admin ID: long-press Profile → popover [👤 Профиль] [🛠 Админ-панель]
-- Popover: bg-white rounded-xl shadow-lg border-slate-100, над кнопкой профиля
-- dismiss: любой выбор или повторный tap

---
## STATE — 2026-07-02 06:40 — Premium Toast (zustand + haptic + backdrop-blur)

### Создано
- `web/src/components/shared/Toast.tsx` — полностью переписан:
  - zustand-стора `useToastStore` с `showToast(message, type?)`
  - типы `'info' | 'warning' | 'success' | 'error'`
  - Telegram HapticFeedback: `impactOccurred('medium')` для info/success, `notificationOccurred` для warning/error
  - авто-dismiss через 2.5s
  - тёмный компонент: `bg-slate-900/95 backdrop-blur-md`, border `slate-800`, тень `12px 40px rgba(0,0,0,0.25)`
  - иконки: 💡 info, 🛠 warning, ✅ success, ❌ error
- `web/src/index.css` — `@keyframes fadeInUp` + класс `animate-fade-in-up` (cubic-bezier 0.16,1,0.3,1)

### Изменено
- `web/src/App.tsx` — `ToastProvider` → `<Toast />` внутри AuthGuard
- `web/src/components/screens/Profile.tsx` — `useToast` → `useToastStore`, тексты заглушек заменены на живые сообщения
- `web/src/components/screens/MasterHome.tsx` — `useToast` → `useToastStore`, «Пополнение» через showToast
- `web/src/components/screens/CreateOrderSheet.tsx` — `useToast` → `useToastStore`, error/success через showToast
- `web/src/pages/ClientHome.tsx` — удалён `showMasterPopup` (Telegram popup/alert), вместо него Toast «Профиль мастера откроется в версии 1.1»

### Архитектура
- Zustand store, не Context → `<Toast />` можно разместить в любом месте дерева
- Haptic триггерится внутри стора, вызывающий код не заботится о вибрации
- `animate-fade-in-up` (CSS) вместо framer-motion (Toast — единственный элемент, не требует React-анимации)

---
## STATE — 2026-07-02 07:10 — 4 рабочих экрана (Settings, EditProfile, Wallet, OrderHistory)

### Создано
- `web/src/components/screens/SettingsScreen.tsx`
- `web/src/components/screens/EditProfileScreen.tsx`
- `web/src/components/screens/WalletScreen.tsx`
- `web/src/components/screens/OrderHistoryScreen.tsx`
- `api/src/routes/auth.ts` — `PATCH /auth/profile`, `POST /auth/avatar`
- `api/src/routes/orders.ts` — `GET /orders/my`
- `supabase/migrations/20260701000009_profiles_extras.sql`
- `supabase/migrations/20260701000010_avatar_storage.sql`

### Изменено
- `web/src/App.tsx` — screen state overlay навигация
- `web/src/components/screens/Profile.tsx` — ⚙️ кнопка → disabled "Настройки" card, "Способы оплаты" заголовок, Avatar src={profile?.avatar_url}
- `web/src/components/screens/EditProfileScreen.tsx` — кликабельный Avatar для загрузки фото
- `web/src/components/shared/Toast.tsx` — Context API → zustand store + haptic + backdrop-blur
- `web/src/lib/api.ts` — apiUpload()
- `web/src/hooks/useTelegramAuth.ts` — getTelegramLocation() использует Telegram.LocationManager вместо {0,0}
- `web/src/types/telegram.d.ts` — LocationManager + getLocation типы
- `api/src/routes/auth.ts` — photo_url → avatar_url при auth, POST /auth/avatar (multer → Supabase storage)
- `api/src/lib/supabase.ts` — avatar_url в DBProfile

### Архитектура навигации
- 4 экрана рендерятся как overlay (fixed inset-0 z-30) поверх AppShell, tab-бар скрыт
- Анимация fade+slide x-20 (как AdminPanelView)
- Back → setScreen(null) → возврат к предыдущему табу

---
## STATE — 2026-07-02 07:30 — Avatar из Telegram + загрузка

### Создано
- `supabase/migrations/20260701000010_avatar_storage.sql` — storage bucket `avatars` + RLS policies

### Изменено
- `api/src/lib/supabase.ts` — `avatar_url` добавлен в `DBProfile`
- `api/src/routes/auth.ts`:
  - При upsert профиля: `user.photo_url` из Telegram сохраняется в `avatar_url`
  - При повторном входе: если photo_url изменился — обновляется
  - `POST /auth/avatar` — multer memoryStorage, валидация image/*, upload в Supabase `avatars` bucket, обновление `profiles.avatar_url`
- `web/src/lib/api.ts` — добавлена `apiUpload<T>(path, file)` с FormData
- `web/src/components/screens/Profile.tsx` — `<Avatar src={profile?.avatar_url}>` для клиента и мастера
- `web/src/components/screens/EditProfileScreen.tsx`:
  - input[type=file] скрытый + ref
  - клик по Avatar → file picker → upload → обновление auth store + preview
  - Avatar размер 64px, hover overlay с 📷

### Flow
1. Telegram initData.user.photo_url → сохраняется в `profiles.avatar_url` при auth
2. Profile screen отображает Telegram фото через Avatar src
3. EditProfile: tap на аватар → выбрать фото → POST /auth/avatar → Supabase storage → public URL → preview

---
## STATE — 2026-07-02 08:00 — Phone symmetry: client sees + edits, master sees + edits

### Изменено
- `web/src/components/screens/Profile.tsx` (client view):
  - Block 1: masked phone `maskClientPhone()` → `+375 (29) ***-**-XX`
  - Block 2: settings card — clean info rows (Язык, Тема, Уведомления) без полей ввода
  - Block 3: [Редактировать профиль и телефон] → AnimatePresence bottom sheet с name input + phone input (+375 mask через `formatPhoneInput`)
  - Удалены: «Мои заказы», «Способы оплаты», ссылка на SettingsScreen
- `web/src/components/screens/MasterHome.tsx`:
  - Header: gradient → белая карточка с Avatar, ФИО, рейтинг, бейдж НПД, «Связь: +375 (29) XXX-XX-XX»
  - Добавлена кнопка [Редактировать анкету мастера] → onNavigate('edit_profile')
  - Импортированы useAuthStore + Avatar
- `web/src/components/screens/EditProfileScreen.tsx` — phone инициализируется из `profile?.phone`
- `web/src/stores/auth.ts` — поле `phone: string | null` в `UserProfile`
- `web/src/lib/api.ts` — type guard `isErrorResult()` для правильного TS-narrowing discriminated union

### Симметрия
- Заказчик: видит маскированный номер → Bottom Sheet → меняет имя и телефон
- Мастер: видит полный номер в шапке → Редактировать анкету → меняет телефон + описание + категории

---
## STATE — 2026-07-02 08:40 — Role separation (Вариант А)

### Добавлено
- `supabase/migrations/20260701000011_role_separation.sql` — is_master (bool), current_role (customer|master), master_status (none|pending|approved|rejected)
- `api/src/services/botRegistry.ts` — singleton для Telegraf instance

### Backend
- `POST /auth/become-master` — принимает full_name, phone, city, category → master_status=pending, отправляет в MODERATOR_CHAT_ID с inline-кнопками [Принять/Отклонить]
- `POST /auth/switch-role` — переключает current_role (только если is_master)
- `GET /auth/master-status` — читает is_master, current_role, master_status
- `POST /admin/masters/approve/:telegramId` — is_master=true, approved, уведомление пользователю
- `POST /admin/masters/reject/:telegramId` — rejected, уведомление
- `GET /admin/masters/pending` — список заявок

### Bot
- action `approve_master:\d+` — обновляет БД, редактирует сообщение, шлёт уведомление
- action `reject_master:\d+` — обновляет БД, редактирует сообщение, шлёт уведомление

### Frontend
- `App.tsx` → CustomerApp / MasterApp по `current_role`
- `BottomTabBar` — 3 таба: customer (Главная/Мои заказы/Профиль) / master (Лента заказов/В работе/Профиль)
- `Profile.tsx`:
  - Premium toggle [Режим Клиента / Режим Мастера] если is_master
  - Client: кнопка «Стать мастером» (master_status=none) → bottom sheet форма
  - Client: блок «⏳ Заявка на модерации» (pending)
  - Client: блок «❌ Заявка отклонена» (rejected)
  - Master view: прежний вид (аватар, рейтинг, НПД, статистика, редактирование)
- `api/src/routes/auth.ts` — selects новые поля при upsert
- `api/src/lib/supabase.ts` — DBProfile с is_master, current_role, master_status, phone
- `web/src/stores/auth.ts` — UserProfile с is_master, current_role, master_status

### Env
- `MODERATOR_CHAT_ID` — ID чата модераторов для уведомлений о заявках

---
## STATE — 2026-07-02 09:20 — Auth fix + Profile polish

### Migration
- `current_role` закавычен (reserved word)

### api.ts
- `authHeaders()` переведён с `window.Telegram.WebApp.initData` на `getTelegramInitData()` из SDK v2 (`@telegram-apps/sdk`)

### Profile.tsx
- Переписаны функции форматирования телефона:
  - `formatPhone()` — корректный парсинг любого оператора (29/33/44/25): `375447545631` → `+375 (44) 754-56-31`
  - `formatPhoneInput()` — прогрессивная маска при вводе: цифры → `+375 (XX) XXX-XX-XX`
  - `maskPhone()` — маскирует середину: `+375 (44) ***-**-31`
- Выделен `ProfileBottomSheet` — компонент с фиксированной кнопкой внизу, скроллом контента, `maxHeight: 80dvh` (корректно на мобильных с клавиатурой)
- Выделен `SettingsCard` — блок Настройки (Язык, Тема, Уведомления) переиспользуется в customer/master view
- `loading` проп для кнопки Сохранить
