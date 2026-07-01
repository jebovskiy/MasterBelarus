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
- `api/package.json` (Express + telegraf + Supabase + BullMQ + zod)
- `api/tsconfig.json` (strict `NodeNext`, `noUncheckedIndexedAccess`) + `.eslintrc.yml` + `vitest.config.ts`
- `api/.env.example` + `.dockerignore`
- `api/src/config/env.ts` — Zod-валидация
- `api/src/lib/logger.ts` — pino
- `api/src/lib/supabase.ts` — admin client + `DBProfile` type
- `api/src/lib/app.ts` — Express factory (cors, helmet, compression, pino-http)
- `api/src/middleware/auth.ts` — `authRequired` (HMAC-валидация X-Telegram-Init-Data)
- `api/src/services/telegram.ts` — `validateTelegramWebAppData` + `fullNameOf`
- `api/src/routes/auth.ts` — `POST /auth/telegram` (rate-limit 10/min, upsert profiles, session)
- `api/src/bot/index.ts` — telegraf bot: `/start` + deep-link + inline keyboard
- `api/src/server.ts` — bootstrap, webhook on `/telegraf/<TOKEN>`
- `api/tests/telegram.test.ts` — 5 unit-кейсов HMAC-валидации
- Railway: проект создан (id `8b43a314-0610-4411-a8c5-f8f914dc0a08`), сервисы запланированы сэ после Sprint 1
- GitHub: `jebovskiy/MasterBelarus`, 2 commits pushed (bootstrap + api placeholder)
- Supabase: проект ещё не создан / пустые миграции не записаны

### В процессе (не закоммичено, в мыслях/буфере)
- `"pino-pretty"` в `api/devDependencies` (забыт) — `logger.ts` ждёт
- `supabase/migrations/001_create_enums.sql` — написан в мозгу, не записан
- миграции 002–008 — не записаны, держим в буфере
- `web/` пустой: нет `package.json`, `vite.config.ts`, `tailwind.config.ts`, `src/`
- test (telegram) ожидает добавления `.gitignore` + `.npmrc` → npm install; в рабочем вирт. состоянии все равно прошёл бы

### Не начато
- Supabase RPC: `find_orders_nearby`, `deduct_response`
- Supabase Storage bucket `order-images` + RLS
- Seed data (3 категории, 5 районов Минска)
- Frontend: React 18 + Vite + Tailwind + `@telegram-apps/sdk` + Zustand
- E2E tests / CI GitHub Actions / Sentry
- Cold start outreach / ТЗ на Telegram канал / метрики PostHog

---
## TODO — 2026-07-01 04:10

1. **pino-pretty** => `api/devDependencies` (чтобы `api/src/lib/logger.ts` работал в dev с цветным pretty-выводом)
2. **8 миграций** `supabase/migrations/001..008*.sql` с RLS + PostGIS + triggers
3. **web essay skeleton**: `package.json`, `tsconfig`, `vite.config`, `tailwind.config` (с palette из visual-spec.md), `index.html`, `src/main.tsx`, `src/lib/telegram.ts` (SDK init), `src/hooks/useTelegramUser.ts`, Zustand store
4. При каждом правке: прогонить `tsc --noEmit` (api) и `pnpm exec vite build` (web) до коммита
5. Сделать единый коммит и пуш
6. Поднятие функций + storage в Supabase после миграций
7. Sprint 1 close: проверка всех unit/typecheck/lint

---
## RECENT FILES — 2026-07-01 04:10

### api/
- `package.json` (зависимости полные)
- `tsconfig.json` (strict, NodeNext)
- `vitest.config.ts`
- `.eslintrc.yml`
- `.env.example`
- `.dockerignore`
- `src/config/env.ts`
- `src/lib/logger.ts`
- `src/lib/supabase.ts`
- `src/lib/app.ts`
- `src/middleware/auth.ts`
- `src/services/telegram.ts`
- `src/routes/auth.ts`
- `src/bot/index.ts`
- `src/server.ts`
- `tests/telegram.test.ts`