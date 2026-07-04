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
## STATE — 2026-07-04 14:00

### New: Supabase migrated to ECC JWT keys — getUserClient now uses service_role
- **Problem**: Supabase deprecated legacy HMAC JWT secret, migrated to ECC P-256 signing keys. Our custom JWT (HMAC-SHA256) can't be verified by Supabase → RLS policies block all queries → "profile not found" → "switch failed"
- **Fix**: `getUserClient(jwt)` now returns `getSupabaseAdmin()` (service_role). All 23 call sites transparently use service_role. RLS bypassed; our Express `jwtRequired` middleware still validates identity.
- `GET /orders/my` added explicit `.eq('client_id', profileId)` filter (was relying on RLS)
- `getUserClient` LRU cache removed (single admin client reused)
- Commit: `7c2ecb7`

### New: setProfile clears JWT on optimistic updates
- `setProfile(p)` without JWT arg sets `jwt: null` → `Authorization` header lost → 401 → auth cleared
- Fix: `setProfile` preserves `state.jwt` when not provided
- Commit: `1e79870`

### New: CORS fix
- Fixed wrong Vercel URL in CORS whitelist, trailing slash in `PUBLIC_WEB_URL`
- Commit: `789adf6`

### Next
- Verify auth + role switch in Telegram Mini App
- Sentry / PostHog monitoring
- CI (`.github/workflows/ci.yml`)
