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
Sprint 0:  15ч  инфра + CI/CD + VPS
Sprint 1:  37ч  БД + auth + telegraf старт (Week 1)
Sprint 2:  36ч  заказы + гео + PostGIS (Week 2)
Sprint 3:  46ч  отклики + уведомления + баланс (Week 3)
Sprint 4:  46ч  завершение сделок + отзывы + запуск (Week 4)
Sprint 5:  26ч  cold start marketing (parallel Week 4+)
────────────────────────────
Total:    180ч  (~4.5 недели full-time)
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
## STATE — 2026-07-01 04:10

### Завершено (закоммичено в GitHub pool `master`)
- monorepo root `package.json` (workspaces: api, web)
- `.gitignore` monorepo-wide + per-service
- `README.md` + `docs/visual-spec.md` + `memory/PROJECT.md`
- `Dockerfile.api` (multi-stage Node 20 alpine for Railway)
- `api/package.json` (Express + telegraf + Supabase + BullMQ + zod + pino-pretty)
- `api/tsconfig.json` (strict `NodeNext`, `noUncheckedIndexedAccess`) + `.eslintrc.yml` + `vitest.config.ts`
- `api/.env.example` + `.dockerignore`
- `api/src/config/env.ts` — Zod-валидация
- `api/src/lib/logger.ts` — pino + pino-pretty dev
- `api/src/lib/supabase.ts` — admin client + `DBProfile` type
- `api/src/lib/app.ts` — Express factory (cors, helmet, compression, pino-http)
- `api/src/middleware/auth.ts` — `authRequired` (HMAC-валидация X-Telegram-Init-Data)
- `api/src/services/telegram.ts` — `validateTelegramWebAppData` + `fullNameOf`
- `api/src/routes/auth.ts` — `POST /auth/telegram` (rate-limit 10/min, upsert profiles, session)
- `api/src/bot/index.ts` — telegraf bot: `/start` + deep-link + inline keyboard
- `api/src/server.ts` — bootstrap, webhook on `/telegraf/<TOKEN>`
- `api/tests/telegram.test.ts` — 5 unit-кейсов HMAC-валидации
- **8 Supabase миграций** (задачи 1.1.1–1.1.12):
  - `001_create_enums` — `user_role`, `order_status`
  - `002_profiles` — RLS + индексы
  - `003_orders` — PostGIS `geo_location` + GiST index + RLS
  - `004_bids` — UNIQUE(order_id, master_id) + RLS
  - `005_master_categories` — PK(master_id, category) + RLS
  - `006_master_balances` — `deduct_response()` RPC + триггер auto-create
  - `007_reviews` — rating 1-5 + триггер пересчёта avg_rating в profiles
  - `008_notifications_log` + `find_orders_nearby()` RPC + storage bucket `order-images`
- Railway: проект создан (id `8b43a314-0610-4411-a8c5-f8f914dc0a08`), сервисы отложены до Sprint 1 close
- GitHub: `jebovskiy/MasterBelarus`, 3 commits pushed

### В процессе
- `web/` пустой — нет package.json, Vite, Tailwind, React-каркаса
- `npm install` не прогонялся — нет `node_modules` и lockfile

### Не начато (Sprint 1 по бэклогу)
- Frontend: React 18 + Vite + Tailwind + `@telegram-apps/sdk` + Zustand (задачи 1.3.1–1.3.7)
- Seed data: 3 категории, 5 районов Минска
- CI: GitHub Actions workflow
- `npm install` + `tsc --noEmit` sanity check
- Railway сервисы (api + web)

---
## TODO — 2026-07-01 04:20

1. **web/ каркас**: `package.json`, `tsconfig`, `vite.config`, `tailwind.config` (palette из visual-spec.md), `index.html`, `src/main.tsx`, `src/App.tsx`, `src/lib/telegram.ts` (SDK init), `src/hooks/useTelegramUser.ts`, Zustand store, splash screen
2. **npm install** в root + `tsc --noEmit` sanity check (api)
3. **Seed data**: `supabase/seed.sql` — 6 категорий, 5 районов Минска
4. **CI**: `.github/workflows/ci.yml` — lint + typecheck + tests
5. **Sprint 1 close**: прогон всех тестов, проверка локального `npm run dev:api`

---
## RECENT FILES — 2026-07-01 04:20

### root
- `package.json` (workspaces)
- `Dockerfile.api`
- `.gitignore`

### api/
- `package.json` (deps + pino-pretty)
- `tsconfig.json`, `vitest.config.ts`, `.eslintrc.yml`
- `.env.example`, `.dockerignore`
- `src/config/env.ts`
- `src/lib/logger.ts`, `src/lib/supabase.ts`, `src/lib/app.ts`
- `src/middleware/auth.ts`
- `src/services/telegram.ts`
- `src/routes/auth.ts`
- `src/bot/index.ts`
- `src/server.ts`
- `tests/telegram.test.ts`

### supabase/migrations/
- `20260701000001_create_enums.sql`
- `20260701000002_profiles.sql`
- `20260701000003_orders.sql`
- `20260701000004_bids.sql`
- `20260701000005_master_categories.sql`
- `20260701000006_master_balances.sql`
- `20260701000007_reviews.sql`
- `20260701000008_notifications_and_rpc.sql`

### web/  (пустой — следующий шаг)