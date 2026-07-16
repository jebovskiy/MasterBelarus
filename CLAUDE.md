# МастерБай — память проекта

## Что это
Биржа бытовых мастеров внутри Telegram Mini App. Рынок: Беларусь, 2026.
Проблема: найти проверенного сантехника/электрика/грузчика «сегодня» — хаос в Viber/Telegram-чатах ЖК, старые доски объявлений неповоротливы.
Решение: один запрос в Telegram → мастер из соседнего дома откликается за 2-5 минут.

## Стек
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui + @telegram-apps/sdk + Zustand + framer-motion + i18next
- Backend: Node.js 22 + Express + TypeScript + telegraf
- DB: Supabase (PostgreSQL + PostGIS + Realtime + Storage + Auth)
- Infra: Railway (api) + Vercel (web)
- Monitoring: Sentry + PostHog (код есть, ключи пусты)
- CI: GitHub Actions (`.github/workflows/ci.yml`) — lint → typecheck → test

## Архитектура (monorepo)
```
MasterBelarus/
├── web/                  # React + Vite Mini App
├── api/                  # Node.js + Express + telegraf
│   ├── src/
│   │   ├── bot/          # Telegraf webhook bot
│   │   ├── config/       # env.ts (Zod validation)
│   │   ├── lib/          # analytics, express-helpers, logger, user-client
│   │   ├── routes/       # auth, orders, bids, cancel, messages, read, masters, reviews, complaints, admin, upload
│   │   ├── services/     # botRegistry, cancelTracker (DB-backed)
│   │   └── types/
│   ├── db/
│   └── tests/            # vitest, 8/8 pass
├── supabase/
│   ├── migrations/       # 26 миграций (20260701000001–26)
│   └── seed.sql
├── docs/
│   └── visual-spec.md    # дизайн-токены
├── docker-compose.yml
└── package.json          # workspaces root
```

## База данных Supabase
### Таблицы
- `profiles` — id, telegram_id, username, full_name, role (client|master), current_role (customer|master), is_master, master_status (none|pending|approved|rejected|blocked), is_npd, phone, description, city, radius_km, avatar_url, avg_rating, review_count, auth_user_id, created_at
- `orders` — PostGIS location, category, description, price, status (open|in_progress|completed|cancelled), images (text[]), client_id, cancelled_by, cancellation_reason_id, master_id (set on accept)
- `bids` — order_id, master_id, proposed_price, message, status (open|accepted|cancelled)
- `master_categories` — master_id, category (many-to-many)
- `master_balances` — master_id, response_credits (lazy init 20 на первый отклик)
- `reviews` — order_id, master_id, client_id, rating (1-5), comment. UNIQUE(order_id)
- `messages` — order_id, sender_id, text (≤2000), created_at. Realtime publication
- `chat_read_state` — order_id, profile_id, last_read_at
- `cancel_rates` — master_id, cancel_count, window_start
- `complaints` — order_id, reporter_id, reason, status
- `notifications_log` — история уведомлений
- `blocked_users` — blocker_id, blocked_id, created_at. UNIQUE(blocker_id, blocked_id)
- `hidden_chats` — profile_id, order_id, created_at. UNIQUE(profile_id, order_id)

### PostGIS-функции (RPC)
- `find_orders_nearby(lat, lng, radius_m, category?)` — поиск заказов
- `deduct_response(master_id)` — атомарное списание откликов (lazy init 20)
- `check_cancel_rate(master_id)` — проверка частоты отмен
- `update_master_categories(master_id, categories[])` — атомарное обновление категорий

## API роуты
- `POST /auth/login` — JWT auth через Telegram initData
- `POST /auth/become-master` — заявка на статус мастера
- `PATCH /auth/profile` — обновление профиля
- `GET /orders/nearby` — заказы по геолокации
- `POST /orders` — создание заказа (с фото)
- `GET /orders/:id` — детали заказа
- `GET /orders/:id/bids` — отклики на заказ
- `POST /orders/:id/bids` — создание отклика
- `POST /orders/:id/bids/:bidId/accept` — принятие отклика
- `GET /orders/:id/messages`, `POST /orders/:id/messages` — чат
- `GET /orders/chats` — список диалогов
- `POST /orders/:id/complete`, `POST /orders/:id/cancel` — завершение/отмена
- `POST /orders/:id/reactivate` — реактивация отменённого
- `GET /orders/:orderId/review` — отзыв о мастере
- `GET /orders/completed`, `GET /orders/in-progress` — архив/в работе
- `GET /masters/me` — баланс + статистика мастера
- `GET /masters/me/reviews` — отзывы о мастере
- `POST /upload/photo` — загрузка фото (multer 10MB, file-type, rate-limit 10/мин)
- `GET /admin/pending`, `POST /admin/approve/:id`, `POST /admin/reject/:id` — модерация
- `POST /complaints` — жалобы
- `GET /orders/:id/read`, `POST /orders/:id/read` — read receipts
- `GET /blocks` — список заблокированных
- `POST /blocks/:userId` — заблокировать
- `DELETE /blocks/:userId` — разблокировать
- `GET /blocks/chats/hidden` — скрытые чаты
- `POST /blocks/chats/hide/:orderId` — скрыть чат
- `DELETE /blocks/chats/hide/:orderId` — вернуть чат

## Фронтенд — экраны
### Клиент (CustomerApp)
- `ClientHome` — категории, лента заказов, геолокация
- `OrderHistoryScreen` — история заказов
- `ChatScreen` — список чатов + переписка (polling 3 сек, read receipts)
- `Profile` — профиль, переходы в настройки/кошелёк/админку

### Мастер (MasterApp)
- `MasterHome` — лента заказов + фильтры + архив (табы Поиск/Архив)
- `MasterInProgress` — заказы в работе
- `ChatScreen` — список чатов + переписка
- `Profile` — профиль мастера

### Общие оверлеи
- `CreateOrderSheet` — создание заказа с фото (до 3)
- `OrderDetail` — детали заказа, отклики, чат, отзыв
- `SettingsScreen` — язык (ru/be/en), уведомления
- `EditProfileScreen` — редактирование профиля
- `WalletScreen` — баланс откликов
- `AdminPanelView` — модерация мастеров

### Навигация
- `BottomTabBar` — вкладки: home/orders/chat/profile (клиент) или feed/in_progress/chat/profile (мастер)
- Все экраны подключены через `React.lazy` + `Suspense`
- Два режима: `CustomerApp` / `MasterApp` (переключение через `current_role`)
- Layout: `fixed inset-0 flex flex-col` → контент `flex-1 overflow-y-auto` → BottomTabBar `shrink-0`

## Дизайн-система
- Фон: #F8F9FA / #f4f4f6
- Карточки: #FFFFFF
- Акцент: #7C3AED (аметистовый)
- Графитовый текст: #111827
- Bento-grid: rounded-2xl карточки, rounded-xl кнопки
- Glassmorphism шапка: backdrop-blur
- HapticFeedback на все значимые действия
- Light-only (тёмная тема удалена)
- Подробности: `docs/visual-spec.md`

## i18n
- Языки: ru (по умолчанию), be, en
- Хранение: Zustand persist (`mb_settings`)
- Все экраны переведены
- Настройки: `SettingsScreen` → `i18n.changeLanguage()` + `setLanguage()`

## Мониторинг
- Sentry (web + api) — код инициализации есть, DSN пуст
- PostHog (web + api) — код есть, ключ пуст
- Трекинг: user_login, order_created, bid_placed

## Env переменные (api)
```
NODE_ENV, PORT, PUBLIC_WEB_URL, PUBLIC_API_URL,
BOT_TOKEN, TELEGRAM_SECRET_TOKEN,
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
JWT_SECRET, ADMIN_TOKEN, ADMIN_TELEGRAM_ID, MODERATOR_CHAT_ID,
SENTRY_DSN, POSTHOG_KEY, POSTHOG_HOST, LOG_LEVEL
```

## Env переменные (web)
```
VITE_API_URL, VITE_SENTRY_DSN, VITE_POSTHOG_KEY, VITE_POSTHOG_HOST, VITE_APP_ENV
```

## Ключевые решения (ADR-lite)
1. **Нет эквайринга на MVP** — расчёты наличные/ЕРИП напрямую. Приложение = доска объявлений.
2. **Модель монетизации** — плата за отклик (0.5-1 BYN), пополнение через ЕРИП позже. Старт: 20 бесплатных откликов.
3. **Supabase Free Tier** для MVP, миграция на Pro при >500 MAU.
4. **Telegraf webhook** (не polling) — `PUBLIC_API_URL` для webhook, `PUBLIC_WEB_URL` для Web App кнопок.
5. **DB-backed cancelTracker** — таблица `cancel_rates` + RPC вместо in-memory Map.
6. **Атомарные категории** — RPC `update_master_categories` вместо delete+insert.
7. **Cold start через ручной outreach** — 30-50 мастеров до публичного запуска.
8. **НПД-статус** — чекбокс в профиле мастера, без верификации на MVP.
9. **Модерация мастеров** — pending → approved перед откликами.

## Тесты
- `npm run test -w api` — vitest, 8/8 pass
- `npm run typecheck` — 0 errors (api + web)
- `npm run lint` — 0 errors (api)

## Известные особенности
- `role` и `is_master` — оба используются. `current_role` определяет режим UI (customer|master), `is_master` — одобрен ли мастер.
- Орфанные файлы фото (загрузил но не создал заказ) — на MVP не чистим.
- ChatScreen: polling каждые 3 сек (без Supabase Realtime JS), `visibility guard` (document.hidden).
- Read receipts: `✓` (отправлено) / `✓✓` (прочитано, голубой).

## Конкурентное поле (РБ)
- Услуги.by, Куфар Услуги, ЯДо, Профи.ру (без Mini App)
- Чаты ЖК в Viber/Telegram (хаос, нет структуры)
- Сделай.бай — неповоротливый сайт

## TODO (осталось)

### Фичи (post-MVP)
- FEAT-001: Эквайринг (bePaid/EasyPay) — Month 2
- FEAT-002: Юрлицо ИП — Month 2
- FEAT-003: Админ-панель (заново) — Month 2
- FEAT-004: Веб-версия — Month 3
- FEAT-005: Жалобы на мастеров — Month 3 (миграция есть)
- FEAT-006: Гео-карта — Month 3
- FEAT-007: BY/EN локализация — Month 4
- FEAT-008: Native push — Month 4
- FEAT-009: Cold start (30-50 мастеров) — Sprint 5
- FEAT-010: Онбординг мастеров
- FEAT-011: Pull-to-refresh

### Юридические
- LEGAL-001: Консультация юриста (комиссия за отклик)
- LEGAL-002: Privacy Policy + Terms of Service (обязательно для Telegram)
- LEGAL-003: Договор-оферта (перед эквайрингом)
- LEGAL-004: ИП (перед монетизацией)

### Инфра
- Вписать `SENTRY_DSN` и `POSTHOG_KEY` в Railway (api) и Vercel (web)

## Пост-MVP roadmap
- Month 2: эквайринг, юрлицо ИП, админ-панель
- Month 3: веб-версия, жалобы, гео-карта
- Month 4: BY/EN локализация, native push

## Контакты для cold start
- Kufar: раздел Услуги Минск
- VK: группы самозанятых мастеров
- Telegram: @chat_minsk_mir, чаты Новой Боровой, Лебяжьего
- Оффлайн: локальные строительные магазины и кофейни → QR-коды

---
## STATE — 2026-07-16 16:30

### Session 25: Blocks & Hidden Chats

#### Новые фичи
- **Блокировка пользователей** — таблица `blocked_users`, API `/blocks`, UI в чате (меню "...")
- **Скрытые чаты** — таблица `hidden_chats`, API `/blocks/chats/hide`, возврат при новом сообщении
- Фильтрация: заблокированные не видят чаты/сообщения друг друга, скрытые чаты исключены из списка

#### Файлы
- `supabase/migrations/20260701000027_blocks_and_hidden_chats.sql` — миграция
- `api/src/routes/blocks.ts` — CRUD блокировок + скрытия
- `api/src/routes/messages.ts` — проверка блокировки при отправке/чтении
- `api/src/routes/orders.ts` — фильтрация в `/orders/chats`
- `web/src/components/screens/ChatScreen.tsx` — UI: меню блокировки/скрытия, баннер
- `web/src/lib/api.ts` — добавлен `apiDelete`

#### Исправления
- Кэш `_cachedSecretKey` в `telegram.ts` — инвалидация при смене токена (фикс теста)
- `let images` → `const images` в CreateOrderSheet.tsx (линтер)

#### Текущий статус
- TypeScript: 0 errors, Lint: 0 errors, Tests: 8/8 pass
