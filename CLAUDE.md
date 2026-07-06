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
## STATE — 2026-07-04 17:00

### Session 4: Editable master "about" description

#### Changes
1. **`description` field end-to-end** — добавлен во все слои: `DBProfile` (api), `UserProfile` (web store), login SELECT, edit screen, profile view. (`cb139e5`)
2. **EditProfileScreen** — поле «Описание услуг» теперь предзаполнено из профиля. После сохранения `description` пишется в стор. Лимит: 1000 символов (счётчик под textarea).
3. **Profile.tsx** — секция «О мастере» теперь показывает `profile.description` (real data) вместо `MOCK_MASTER.about`. Если пусто — «Описание не добавлено».
4. **Проверка** — `tsc --noEmit` проходит на web и api.

#### Что остаётся
- После смены роли может быть микро-вспышка перед появлением оверлея (effect бежит после render)
- Верификация статуса — CTA показывает тост «временно недоступна» (legal compliance)

#### Известные баги
- `role` никогда не меняется на `'master'` — ни approve в админке, ни approve в боте не устанавливают `role: 'master'`. Везде используется `is_master` вместо `role`.
- Webhook: Express монтировался на `/${env.BOT_TOKEN}`, а Telegram слал на `/telegraf/${env.BOT_TOKEN}`. Пофикшено.
- `webhookCallback` получал `webhookPath` как `secretToken` — бот ждал неверный заголовок и дропал все апдейты. Пофикшено.

#### Next
- Sentry / PostHog
- CI (`.github/workflows/ci.yml`)

---
## STATE — 2026-07-04 18:00

### Session 5: Bot webhook fix (commands not responding)

#### Problem
После деплоя на Railway команды бота (/start, /menu, /status, /help) не отвечали. Telegram отправлял webhook POST'ы на Vercel (фронтенд), где нет обработчика → 404.

#### Root cause
`server.ts:54` использовал `env.PUBLIC_WEB_URL` для `setWebhook()`:
```
bot.telegram.setWebhook(`${env.PUBLIC_WEB_URL}${webhookPath}`)
```
В продакшене `PUBLIC_WEB_URL=https://master-belarus.vercel.app` (фронтенд). Telegram слал запросы на Vercel вместо Railway API.

#### Fix
1. **Новая env переменная** `PUBLIC_API_URL` в `api/src/config/env.ts` — отдельный URL для webhook (API), а `PUBLIC_WEB_URL` остался для кнопок Web App (фронтенд).
2. **server.ts:54** — `setWebhook` теперь использует `env.PUBLIC_API_URL`.
3. **`.trim()` в валидации** — добавлен к URL-полям в Zod-схеме, чтобы не падать из-за пробелов.
4. **`.env.example`** — обновлён с комментариями для обеих переменных.

#### Дополнительно
- Railway логи показали `PUBLIC_WEB_URL: Invalid url` — сервер падал при старте. Значение было без `https://`. Починено добавлением `.trim()`.
- После добавления `PUBLIC_API_URL` в Railway нужно нажать **Redeploy**, чтобы собрался новый код.
- Коммит: `5d10558`

#### Остаётся
- Sentry / PostHog
- CI workflow

---
## STATE — 2026-07-04 20:00

### Session 7: Master without approval + phone formatting + dynamic badges

#### Проблемы
1. `become-master` не ставил `is_master: true` — мастеру требовалось одобрение админа для откликов
2. `formatPhone` в MasterHome использовал `.slice(-9)` и hardcoded код 29 — номера 44 оператора показывались неправильно
3. Бейдж "НПД" в MasterHome показывался всегда, независимо от `is_npd`
4. В Profile статусы "верифицирован/не верифицирован" не совпадали с MasterHome

#### Изменения
1. **`web/.../MasterHome.tsx`** — `formatPhone` переписан: без `.slice(-9)`, без hardcoded `29`, использует динамический код/оператор. Бейдж "НПД" — по `profile.is_npd`. Добавлен "✅ Проверен" — по `master_status === 'approved'`. (`4fb5fd2`, доработка `34cc6f9`)
2. **`web/.../Profile.tsx`** — после `become-master` показывает "Заявка отправлена на модерацию" (без изменения). Бейджи статуса синхронизированы с MasterHome. (`4fb5fd2`, доработка `34cc6f9`)
3. **`api/src/routes/bids.ts`** — возвращена проверка `master_status === 'approved'`. Модерация нужна.
4. **`api/src/routes/auth.ts`** — `become-master` ставит `master_status: 'pending'`, ждёт одобрения админа.

#### Результат
- НПД — добровольный бейдж (is_npd), нигде не блокирует функционал
- Мастер проходит модерацию (pending → approved) перед откликами
- Номер телефона форматируется правильно для любого оператора
- Статусы верификации синхронизированы между Profile и MasterHome

---
## STATE — 2026-07-04 19:00

### Session 6: Webhook fix + bid sheet layout + price input

#### Изменения
1. **Webhook URL** — добавлена env `PUBLIC_API_URL` для setWebhook, отдельно от `PUBLIC_WEB_URL` (фронтенд). Env валидация: `.trim()` к URL-полям. (`5d10558`)
2. **Express middleware order** — 404 handler перенесён ПОСЛЕ webhook middleware. Раньше 404 срабатывал раньше, Telegram получал 404. (`85ae55f`)
3. **Bottom sheet отклика** — переписан layout: убрано absolute позиционирование кнопок, flex-колонка (заголовок → контент → кнопки). Кнопки всегда видны. max-h увеличен с 70vh до 80vh. (`19d906a`)
4. **Price input** — убрано предзаполнение `bidPrice` из `order.price`. Поле пустое, цена из заказа — в placeholder. (`19d906a`)
5. Railway логи показали `PUBLIC_WEB_URL: Invalid url` — добавлен `.trim()` в Zod-схему.

#### Известные баги / ограничения
- После Redeploy нужно проверить `getWebhookInfo` — URL должен указывать на Railway

---
## STATE — 2026-07-04 22:00

### Session 8: City, categories, radius_km — end-to-end

#### Проблема
- `city`, `radius_km`, `categories` (master_categories) не возвращались при логине
- `EditProfileScreen` не инициализировал поля из профиля — при каждом входе всё было пусто
- После сохранения профиля стор не обновлялся этими полями
- `Profile.tsx` не показывал город и категории

#### Изменения
1. **`api/.../user-client.ts`** — `DBProfile` получил `city: string | null`, `radius_km: number | null`
2. **`api/.../auth.ts` (login)** — `SELECT` добавлены `city`, `radius_km`. Поле логина: `SELECT` master_categories → `categories: string[]`. Ответ: `{ ...profile, categories }`
3. **`web/.../auth.ts`** — `UserProfile` получил `city`, `radius_km`, `categories`
4. **`web/.../EditProfileScreen.tsx`** — `cityValue` инициализируется из `profile.city` (lookup в BELARUS_CITIES). `categories`/`radiusKm` — из `profile.categories`/`profile.radius_km`. После PATCH стор обновляется всеми полями включая `city`, `radius_km`, `categories`
5. **`web/.../Profile.tsx`** — блоки "Город" (если есть) и "Категории" (chips с русскими labels) подставлены перед "О мастере". Категории в хедере мастера берутся из `profile.categories` (fallback на `SPECIALTIES`)
6. **Коммит** `eb5bb18`
7. **Коммит** `ccd4369` — город + категории в хедере профиля, удалены дублирующие блоки

#### Остаётся
- После деплоя проверить: login → EditProfileScreen → pre-filled city/categories/radius → save → store update → Profile view
- Sentry / PostHog
- CI workflow

---
## STATE — 2026-07-06 09:30

### Session 9: Settings alive — i18n, dark theme, settings store

#### Проблема
SettingsScreen сохранял язык/тему/уведомления в localStorage, но **никогда не применял** их в рантайме. Ни i18n, ни тёмной темы, ни работающих настроек не существовало.

#### Изменения
1. **Инфраструктура:**
   - `web/package.json` — добавлены `react-i18next`, `i18next`
   - `web/tsconfig.json` — добавлен `resolveJsonModule: true`
   - `web/tailwind.config.cjs` — `darkMode: 'class'`, цвета через CSS-переменные
   - `web/src/index.css` — `:root` (светлая) + `.dark` (тёмная) CSS-переменные для всех цветов

2. **i18n:**
   - `web/src/i18n/index.ts` — i18next с react-i18next, читает сохранённый язык из localStorage
   - `web/src/i18n/locales/{ru,be,en}.json` — переводы для nav, settings, profile
   - `web/src/main.tsx` — импорт `./i18n` для инициализации до рендера

3. **Стор настроек:**
   - `web/src/stores/settings.ts` — Zustand persist (ключ `mb_settings`), поля: `language`, `theme`, `notifyNearby/notifyChat/notifyPromo`

4. **Тёмная тема:**
   - `web/src/hooks/useTheme.ts` — вешает `class="dark"` на `<html>`, слушает `prefers-color-scheme` в режиме `system`

5. **UI:**
   - `SettingsScreen` — переписан: вызывает `i18n.changeLanguage()`, `setTheme()`, использует CSS-переменные вместо хардкода
   - `BottomTabBar` — подписи из i18n, цвета из CSS-переменных
   - `Profile/SettingsCard` — читает реальные настройки из стора, ведёт в SettingsScreen
   - `App.tsx` — `useTheme()` в AppShell, bg цвета через CSS-переменные

6. **Коммит** `6c2a935`

#### Остаётся
- После деплоя проверить: SettingsScreen → язык меняет UI → theme переключает тёмный режим → настройки сохраняются
- Перевести остальные экраны (сейчас переведены только nav, settings, profile)
- Sentry / PostHog
- CI workflow

---
## STATE — 2026-07-06 10:00

### Session 9b: Remove dark theme — light only

#### Изменения
1. **`tailwind.config.cjs`** — убран `darkMode: 'class'`, цвета снова хардкод
2. **`index.css`** — удалён блок `.dark`, body цвета хардкод
3. **`useTheme.ts`** — удалён
4. **`SettingsScreen`** — убрана секция выбора темы
5. **`App.tsx`** — убраны `useTheme()`, `bg-appBg` заменён на `bg-[#f4f4f6]`
6. **`BottomTabBar`** — хардкод цвета вместо CSS-переменных
7. **`settings store`** — убраны `theme`/`ThemeMode`
8. **`Profile/SettingsCard`** — убрана строка темы, хардкод цветов
9. **Коммит** `486040b`

---
## STATE — 2026-07-06 10:30

### Session 9c: Fix language persistence + translate all screens

#### Проблемы
1. Язык не сохранялся между сессиями — `SettingsScreen` вызывал только `i18n.changeLanguage()`, но не `setLanguage()` из стора. Стор никогда не обновлялся → при перезаходе читалось 'ru'.
2. `SettingsCard` всегда показывал "Русский" — читал `language` из стора, который не менялся.
3. Почти весь текст хардкод — переведены были только nav, settings, profile.

#### Изменения
1. **Фикс персистентности:**
   - `SettingsScreen` — `onClick` вызывает и `setLanguage(value)`, и `i18n.changeLanguage(value)`
   - `AppShell` — `useEffect` синхронизирует `language` из стора → `i18n.changeLanguage()` при загрузке

2. **Перевод всех экранов:**
   - `ClientHome.tsx` — категории, заголовки, статусы, карточки заказов
   - `MasterHome.tsx` — лента, фильтры, карточки, бейджи, bottom sheet отклика
   - `CreateOrderSheet.tsx` — форма создания, лейблы, плейсхолдеры, кнопки
   - `EditProfileScreen.tsx` — хедеры, лейблы полей, радиус, категории
   - `OrderDetail.tsx` — детали, отклики, отмена, отзыв, статусы
   - `MasterInProgress.tsx` — список в работе, отмена заказа
   - `SplashScreen.tsx` — ошибка авторизации, открыть в Telegram

3. **Локали:** `ru.json`/`en.json`/`be.json` расширены секциями `auth`, `orders.*`, `master.*`, `toast.*`, `home.*`, `profile.*`

4. **Коммиты:**
   - `e6549c5` — фикс персистентности + расширение локалей
   - `7803a36` — перевод всех экранов

#### Остаётся
- CI workflow
- Проверить деплой: все ли строки переводятся в Telegram Mini App

---
## STATE — 2026-07-06 11:00

### Session 10: Sentry + PostHog monitoring

#### Проблема
Мониторинг был только в планах — ни Sentry, ни PostHog не были подключены. Ошибки в проде не трекались, аналитика отсутствовала.

#### Изменения

1. **Пакеты (web):**
   - `@sentry/react`, `@sentry/vite-plugin`, `posthog-js` — добавлены в `web/package.json`

2. **Пакеты (api):**
   - `@sentry/node`, `posthog-node` — добавлены в `api/package.json`

3. **Sentry (web):**
   - `web/src/main.tsx` — `Sentry.init()` с browserTracingIntegration, replayIntegration (tracesSampleRate 0.1)
   - `web/src/App.tsx` — `Sentry.ErrorBoundary` оборачивает корень, fallback с кнопкой перезагрузки
   - `web/.env` — добавлены `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_APP_ENV`

4. **Sentry (api):**
   - `api/src/server.ts` — `Sentry.init()` при наличии `SENTRY_DSN`, error handler обёрнут в `Sentry.withScope`/`captureException`
   - Graceful shutdown: `Sentry.close(2000)` на SIGTERM/SIGINT

5. **PostHog (api):**
   - `api/src/lib/analytics.ts` — сервисный слой: `getPostHog()` (lazy init), `captureEvent()`, `identifyUser()`, `shutdownAnalytics()`
   - `api/src/config/env.ts` — добавлены `SENTRY_DSN`, `POSTHOG_KEY`, `POSTHOG_HOST` в Zod-схему
   - `api/.env.example` — добавлены комментарии для Sentry/PostHog

6. **PostHog (web):**
   - `web/src/main.tsx` — `posthog.init()` с capture_pageview: false (Telegram Mini App)

7. **Трекинг событий:**
   - `api/src/routes/auth.ts` — `identifyUser` + `captureEvent('user_login')` после успешного логина
   - `api/src/routes/orders.ts` — `captureEvent('order_created')` с category/has_price
   - `api/src/routes/bids.ts` — `captureEvent('bid_placed')` с has_price

8. **Коммит** `5cc7a6c`

#### Настройка после деплоя
- Вписать `SENTRY_DSN` и `POSTHOG_KEY` в Railway Dashboard → Variables (api)
- Вписать `VITE_SENTRY_DSN` и `VITE_POSTHOG_KEY` в Vercel Dashboard → Environment Variables (web)
- Где взять:
  - **Sentry DSN:** sentry.io → Create Project (React / Node.js) → скопировать DSN. Потом: Settings → Projects → [project] → Client Keys (DSN)
  - **PostHog Key:** app.posthog.com → Project Settings → Project API Key
  - Для Sentry понадобится два проекта (web + api), для PostHog — один ключ проекта

---
## STATE — 2026-07-06 11:30

### Session 11: CI workflow

#### Изменения
1. **`.github/workflows/ci.yml`** — actions/checkout@v4 + setup-node@v4 (Node 20, npm cache) → `npm ci` → `npm run lint` (continue-on-error) → `npm run typecheck` → `npm run test -w api`
2. **Concurrency:** группа по `${{ github.workflow }}-${{ github.ref }}`, cancel-in-progress
3. **Timeout:** 15 минут
4. **Коммит** `caeda27`

---
## STATE — 2026-07-06 12:00

### Session 12: Chat (messages) — end-to-end

#### Проблема
У клиента и мастера не было возможности общаться внутри приложения. После выбора мастера коммуникация происходила в Telegram личке (вне контекста заказа).

#### Изменения
1. **Миграция БД** `20260701000020_chat_messages.sql` — таблица `messages` (id, order_id, sender_id, text, created_at) с RLS-политиками (участники заказа читают/пишут). Индекс по (order_id, created_at). Realtime publication включена.

2. **API роуты** — `GET /orders/:id/messages` (список сообщений, сортировка ASC) и `POST /orders/:id/messages` (отправка, JWT верификация, лимит 2000 символов). JWTRequired через middleware роутера.

3. **API роут** `GET /orders/chats` — список диалогов для пользователя. Находит заказы где пользователь = client или имеет bid, собирает последнее сообщение из каждого чата, сортирует по дате.

4. **ChatScreen** — двухпанельный экран:
   - Список чатов (последнее сообщение, категория)
   - Чат с сообщениями (текстовые пузыри "свои/чужие", ASCII-часы, auto-scroll)
   - Polling каждые 3 сек на активном чате (без Supabase Realtime JS)
   - Textarea + кнопка отправки (Enter + клик, лимит 2000)

5. **BottomTabBar** — добавлена вкладка "Чаты" (💬) для клиента и мастера.

6. **Локали** — `chat.*` секции в `ru.json`, `en.json`, `be.json`.

7. **App.tsx** — `tab === 'chat'` рендерит ChatScreen (ленивый импорт) для обеих ролей. `onOpenOrder` открывает `OrderDetail` через `setSelectedOrderId`.

#### Проверка
- `tsc --noEmit` проходит на web и api.
- `npm run test -w api` — 8/8 pass.

#### Коммиты
- `20260701000020_chat_messages.sql` — таблица + RLS
- `orders.ts` — GET /orders/:id/messages, POST /orders/:id/messages, GET /orders/chats
- `ChatScreen.tsx` — новый компонент
- `BottomTabBar.tsx` — вкладка chat
- `App.tsx` — ChatScreen подключён
- `locales/*.json` — переводы чата

---
## STATE — 2026-07-06 12:30

### Session 13: Review fix + OrderDetail back button

#### Изменения
1. **review fix** — `reviews.ts` читал `master_id` из `orders` (колонки нет). Переписан: ищет принятый отклик через `bids WHERE order_id = $1 AND status = 'accepted'`. (`a809f77`)
2. **OrderDetail back button** — добавлена кнопка `← Назад` в хедер, чтобы закрыть окно без завершения/отмены. (`cdecde9`)

#### Остаётся
- Деплой миграции чата в Supabase
- Проверить деплой в Telegram Mini App