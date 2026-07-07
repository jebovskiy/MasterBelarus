# МастерБай — память проекта

## Что это
Биржа бытовых мастеров внутри Telegram Mini App. Рынок: Беларусь, 2026.
Проблема: найти проверенного сантехника/электрика/грузчика «сегодня» — хаос в Viber/Telegram-чатах ЖК, старые доски объявлений неповоротливы.
Решение: один запрос в Telegram → мастер из соседнего дома откликается за 2-5 минут.

## Стек
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui + @telegram-apps/sdk + Zustand + framer-motion
- Backend: Node.js + Express + TypeScript + telegraf
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
5. **Telegraf webhook** достаточно для rate-limit Telegram (30 msg/sec). BullMQ убран до появления очередей.
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

---
## STATE — 2026-07-06 14:00

### Session 14: Archive order details + bot reactivate button

#### Problem
Завершённые/отменённые заказы в OrderDetail показывали только статус (✅/❌) без деталей: кто отменил, причина, отзыв, мастер.

#### Changes
1. **API `GET /orders/:orderId/review`** — `reviews.ts` переписан: fetch review + отдельный fetch master profile (supabase join не работал с `*`). Syntax error на строке `return ... });` — исправлен. (`this session`)
2. **OrderDetail.tsx** — для `completed`: отзыв + мастер (имя, рейтинг) в bento-карточке. Для `cancelled`: `cancelled_by` (мастер/клиент), `cancellation_reason_id` → читаемая причина через i18n. Добавлена кнопка "Вернуть в поиск" (reactivate, если cancelled_by=master и isOwner). (`this session`)
3. **i18n** — ключи `cancelled_by`, `cancelled_by_master`, `cancelled_by_client`, `cancel_reason` добавлены в ru/en/be. (`this session`)
4. **Bot reactivate button** — уже существует в `sendMasterCancelledToClient` (notifications.ts) + `useStartAppHandler.ts` обрабатывает `startapp=reactive_order_${orderId}`. Полный цикл: бот → кнопка → Mini App → confirm → API reactivate → заказ открыт. (`existing`)

#### Остаётся
- CI workflow
- Проверить деплой в Telegram Mini App

---
## STATE — 2026-07-06 19:30

### Session 15: Fix master price on bid accept + cancelled bids hidden + chats fix

#### Changes
1. **`bids.ts`** — при `accept-bid` цена заказа теперь устанавливается из `bid.proposed_price` мастера, а не остаётся ценой клиента. (`5ffc6b9`)
2. **`bids.ts`** — `GET /:orderId/bids` исключает ставки со статусом `cancelled` (`.neq('status', 'cancelled')`). После реактивации заказа отменённый мастер не виден в списке ставок. (`5bf1a78`)
3. **`orders.ts` `/orders/chats`** — теперь включает заказы `in_progress` даже без сообщений (убрал `.filter(id => latestMap.has(id))`). Мастер ищет только `accepted` bids, не все. (`82d32af`)
4. **ChatScreen** — добавлен `initialOrderId` prop для открытия конкретного чата при переходе. (`82d32af`)
5. **OrderDetail** — добавлен `onOpenChat` prop, кнопка 💬 Чат в хедере для `in_progress`. (`82d32af`)
6. **MasterInProgress** — добавлен `onOpenChat` prop, кнопка 💬 Чат на карточке заказа. (`82d32af`)
7. **App.tsx** — `onOpenChat` прокинут в оба режима (CustomerApp/MasterApp), ChatScreen получает `initialOrderId`. (`82d32af`)
8. **i18n** — добавлен ключ `chat.chat_btn`. (`82d32af`)

#### Коммиты
- `5ffc6b9` — fix: set order price to master's proposed_price on bid accept
- `5bf1a78` — fix: hide cancelled bids from order bids list on reactivate
- `82d32af` — fix: chats not showing — include in_progress orders without messages + Chat buttons

---
## STATE — 2026-07-06 20:00

### Session 16: Chat list now shows participant name + order description

#### Problem
В списке чатов отображалась только категория ("Электрик", "Уборка") — непонятно с кем чат и о каком заказе.

#### Changes
1. **API `GET /orders/chats`** — переписан: возвращает `description` (80 символов), `price`, `status`, `other_participant_name` (имя мастера для клиента, имя клиента для мастера). Имена подтягиваются из таблицы `profiles`. (`9e21bd7`)
2. **ChatScreen** — в списке чатов теперь: категория → имя собеседника (жирный) → описание заказа + цена → последнее сообщение. В хедере чата — имя собеседника вместо "Чат". (`9e21bd7`)

#### Коммит
- `9e21bd7`

---
## STATE — 2026-07-06 20:30

### Session 17: Chat scroll fix + unread refresh + read receipts

#### Проблемы
1. При открытии чата скролл показывал первую половину первого сообщения — не докручивал до низа
2. Счётчик непрочитанных не сбрасывался после открытия чата
3. Не было индикации, прочитал ли собеседник сообщение

#### Изменения

1. **Скролл** (`ChatScreen.tsx`) — два старых `useEffect` заменены на один с `requestAnimationFrame`. `behavior: 'instant'` на первом входе, `'smooth'` на новых сообщениях. DOM гарантированно отрисован до прокрутки.

2. **Непрочитанные** (`ChatScreen.tsx`) — после `markRead` вызывается `loadConversations()` (один раз через `convLoadedRef`). При возврате из чата в список кнопка Back тоже дёргает `loadConversations()`. После отправки сообщения — тоже.

3. **Read receipts** (`messages.ts` + `ChatScreen.tsx`):
   - API: `GET /:orderId/messages` теперь возвращает `{ messages, other_read_at }` — timestamp последнего прочтения собеседника из `chat_read_state` (через admin client для обхода RLS)
   - UI: для своих сообщений — `✓` (отправлено, серый) или `✓✓` (прочитано, голубой `text-sky-400`), если `created_at <= other_read_at`
   - Обновляется каждый поллинг (3 сек)

4. **Чистка lint** — удалены неиспользуемые импорты в `server.ts`, `cancel.ts`; `as any` заменены на конкретные типы в 6 файлах

#### Коммиты
- `afbdf1a` — fix: chat scroll, unread badge refresh, read receipts
- `e41be99` — lint: fix unused imports, any types and null safety

---
## STATE — 2026-07-06 21:00

### Session 18: Chat RLS fix + white bubbles + read receipts working

#### Проблема
После деплоя Session 17 чат не работал: скролл не докручивал, бейдж непрочитанных не сбрасывался, read receipts не появлялись. Сообщения были тёмными.

#### Root cause
В миграции `20260701000022_chat_read_state.sql` не было RLS-политик. Supabase включает RLS по умолчанию для всех таблиц → `markRead` (upsert) и `readMap` (select) молча возвращали пустой результат.

#### Изменения
1. **`read.ts`** — `getSupabaseAdmin()` вместо `getUserClient()` для записи `chat_read_state` (обходит отсутствие RLS)
2. **`orders.ts`** — `getSupabaseAdmin()` для чтения `chat_read_state` в `/orders/chats`
3. **`20260701000022_chat_read_state.sql`** — добавлены RLS-политики (select/insert/update по `profile_id = auth.uid()`)
4. **`ChatScreen.tsx`** — свои сообщения теперь `bg-white` вместо `bg-slate-800`

#### Коммиты
- `435bd71` — fix: chat RLS — use admin client for read_state, white bubbles, migration policies

---
## STATE — 2026-07-07 10:00

### Session 19: Production readiness audit — all fixes applied

#### Проблемы (из аудита)
- `getUserClient()` не удалён → все роуты использовали `getSupabaseAdmin()` напрямую
- `master_categories` query использовал `profile_id` вместо `master_id`
- `deduct_response` RPC создавал phantom 19 credits вместо lazy init 20
- `sendMasterAcceptedNotification` не принимал `orderId`
- `become-master` не вставлял категории в `master_categories`
- Dead packages: `bullmq`, `ioredis`, `socket.io` (api); `@sentry/vite-plugin` (web)
- Dead `AdminPanel.tsx` (web)
- Zombie rate-limit в reviews.ts
- `role: 'master'` не ставился при approve (везде был `is_master`)
- seed.sql — stale trigger references
- `cancelTracker.ts` — in-memory Map (терялся при рестарте)
- `PATCH /auth/profile` — delete+insert категорий не атомарный
- `as` type casts (14 экземпляров)

#### Изменения
1. **`getUserClient()` удалён** — `api/src/lib/user-client.ts` экспортирует только `getSupabaseAdmin()`. Все 8 файлов-потребителей обновлены.
2. **`master_categories` query fix** — `orders.ts:141` `.eq('profile_id', ...)` → `.eq('master_id', ...)`
3. **`deduct_response` RPC** — новая миграция `migrations/23`: lazy init с 20 на первый отклик, атомарный deduct, возвращает FALSE при недостатке. Триггер `trg_profiles_after_approve` для авто-создания записи в `master_balances`.
4. **`sendMasterAcceptedNotification`** — добавлен параметр `orderId`, URL использует реальный `orderId`
5. **`become-master`** — теперь вставляет категории в `master_categories`
6. **Dead deps удалены** — `bullmq`, `ioredis`, `socket.io` из api/package.json; `@sentry/vite-plugin` из web/package.json
7. **`AdminPanel.tsx`** удалён
8. **Rate-limit zombie** удалён из `reviews.ts`
9. **`role: 'master'` согласован** — approve в auth.ts, admin.ts, bot/index.ts теперь ставят `role: 'master'`
10. **seed.sql** — stale DISABLE/ENABLE TRIGGER statements удалены
11. **`cancelTracker.ts` → DB-backed** — миграция `migrations/24`: таблица `cancel_rates` + RPC `check_cancel_rate`. Сервис переписан на async с вызовом RPC. Код в 2 раза короче, без потери данных при рестарте.
12. **Атомарное обновление категорий** — миграция `migrations/25`: RPC `update_master_categories`. `auth.ts:365-373` переписан на вызов RPC вместо delete+insert.
13. **`as` casts** — 14 → 7:
    - `admin.ts` — убран `(req as Request & {admin?: string})`, используется `AdminRequest` type
    - `orders.ts` — inline interface `NearbyOrder` вместо `(orders as Record<string, unknown>[])`
    - `cancel.ts` — убраны 7 `as` casts: типовая аннотация + разбивка `as unknown as` на два шага
    - `orders.ts`, `bids.ts`, `cancel.ts`, `complaints.ts`, `reviews.ts` — rate-limiter `keyGenerator` вынесен в `lib/express-helpers.ts` (1 cast вместо 5)
    - Оставшиеся 7: `jwt.verify` (lib API), `JSON.parse` (lib API), `Proxy {} as AppEnv` (необходимо), `auth.ts:68,85` (Supabase без generated types)

#### Verification
- `npm run typecheck -w api` — PASS (0 errors)
- `npm run typecheck -w web` — PASS (0 errors)
- `npm run lint -w api` — PASS (0 errors, 0 warnings)
- `npm run test -w api` — 8/8 PASS

#### Коммиты
- `migrations/23` — fix deduct_response RPC + approval trigger
- `api/.../lib/user-client.ts` — remove getUserClient
- `api/.../routes/*.ts` — use getSupabaseAdmin directly
- `migrations/24` — cancel_rates table + RPC
- `migrations/25` — update_master_categories RPC
- `api/.../lib/express-helpers.ts` — centralized rate-limiter key function
- Various fix commits across both workspaces

---
## STATE — 2026-07-07 20:00

### Sessions 20-20b: Code splitting + MED/LOW audit cleanup

#### Session 20 — Perf
1. **Code splitting** — React.lazy + Suspense на ClientHome, MasterHome, MasterInProgress, Profile. Веб-пакет разбит на чанки (ClientHome 6.9 kB, MasterHome 11 kB, Profile 16 kB).
2. **Parallel notifications** — `sendOrderCancelledToMasters`: for → Promise.allSettled() (`notifications.ts:185`)
3. **Batch refund** — N individual upserts → batch upsert (`cancel.ts:119-135`)
4. **Visibility guard** — ChatScreen polling: `if (!document.hidden)` (`ChatScreen.tsx:85`)
5. **Incremental rating** — O(N) SELECT AVG → O(1) running average trigger (миграция 26)

#### Session 20b — MED/LOW audit
6. **MED-021** — MasterHome stagger `idx * 40` (ms) → `idx * 0.04` (s) + cap 0.5s
7. **MED-024** — `web/src/lib/transitions.ts`: shared `sheetTransition` (type: 'tween', ease: [0.4,0,0.2,1]). Импортирован во все 7 bottom sheets, 3 локальные копии удалены, overlay'ы получили transition вместо дефолтного tween
8. **MED-022** — `index.css`: `@media (prefers-reduced-transparency: reduce)` отключает backdrop-filter на 4 элементах
9. **MED-018** — `api.ts`: опциональный `signal: AbortSignal` во всех 4 fetch-функциях. `useStartAppHandler.ts`: AbortController + cleanup
10. **MED-015** — `telegram.ts`: `_cachedSecretKey: Buffer | null`, кешируется на весь lifecycle сервера
11. **MED-027** — MasterHome: убран мёртвый `layout` prop (список статический), контейнер motion.div → div
12. **LOW-029** — CLAUDE.md: удалены 3 мёртвые ссылки (decisions.md, ARCHITECTURE.md, API.md)
13. **TODO.md** — приведён в соответствие (только FEAT, LEGAL, Sentry/PostHog keys)
14. All 5 MED confirmed done (020, 025, 026, 028), all 6 LOW confirmed done or skip (019-033)

#### Verification
- `npm run typecheck -w api` — PASS
- `npm run typecheck -w web` — PASS

#### Коммит
- `b02f170` — sessions 20-20b

---
## STATE — 2026-07-07 21:00

### Session 21: Remove all hardcoded master stats

#### Проблема
MasterHome, Profile, WalletScreen показывали фейковые данные вместо реальных: `balance: 15`, `rating: {4.9, 87}`, `stats: {12, 2, 7}`, `MOCK_MASTER {completed: 142, active: 3}`.

#### Изменения
1. **API `auth.ts:62,82`** — login SELECT теперь включает `avg_rating, review_count`
2. **API `auth.ts:91-94`** — `response_credits` из `master_balances` в ответе логина
3. **API `masters.ts:12-65`** — новый `GET /masters/me`: balance + stats (completed, inProgress, todayBids)
4. **API `user-client.ts:32-33`** — `DBProfile` расширен: `avg_rating, review_count`
5. **Web `auth.ts` store** — `response_credits: number` в `UserProfile`
6. **Web `MasterHome.tsx`** — 3 хардкод состояния заменены на fetch `/masters/me` + `profile` данные
7. **Web `Profile.tsx`** — `MOCK_MASTER` удалён, stats через `/masters/me`, fallback `5.0` на реальные
8. **Web `WalletScreen.tsx`** — `useState(15)` → init из `profile.response_credits` + fetch

#### Verification
- `npm run typecheck -w api` — PASS
- `npm run typecheck -w web` — PASS

#### Коммит
- `c22460a` — fix: replace all hardcoded master stats with live API data

---
## STATE — 2026-07-07 22:00

### Session 22: Master inProgress count fix + completed orders archive + price color + layout fix

#### Проблемы
1. **inProgress = 0** — `masters.ts` фильтровал `orders.master_id = profileId`, но в таблице `orders` нет колонки `master_id`
2. **Нет архива выполненных** — мастер не видел свои выполненные заказы
3. **Цена цветом акцента** — `text-primary` (аметист) вместо чёрного
4. **Чёрный экран снизу** — при скролле контент уезжал под `fixed` таббар, overscroll показывал пустую область

#### Изменения
1. **`masters.ts`** — inProgress/completed считаются через `bids` → `order_ids` (subquery), а не через несуществующую `orders.master_id`. (`cd02d8e`)
2. **`orders.ts`** — новый `GET /orders/completed` (аналогично `/in-progress`). (`e0dde2d`)
3. **`MasterHome.tsx`** — табы "Поиск"/"Архив" под статистикой, переключение загружает выполненные заказы. (`e0dde2d`)
4. **i18n** — ключи `search_tab`, `completed_tab`, `completed_heading`, `no_completed`, `done` в ru/en/be. (`e0dde2d`)
5. **`MasterHome.tsx`** — цена `text-primary` → `text-slate-800`. (`5a19c39`)
6. **`App.tsx`** — layout переписан: `fixed inset-0 flex flex-col` / content `flex-1 overflow-y-auto` / BottomTabBar `shrink-0`. Вместо `min-h-screen pb-[64px]` с `fixed` таббаром. (`7dd377f`)
7. **`BottomTabBar.tsx`** — `fixed bottom-0` → `shrink-0` (часть flex-колонки). (`7dd377f`)
8. **`index.css`** — `html { background-color: #f4f4f6 }`. (`7dd377f`)

#### Verification
- `npm run typecheck -w api` — PASS
- `npm run typecheck -w web` — PASS

#### Коммиты
- `cd02d8e` — fix: use accepted bids subquery for master stats (no master_id column in orders)
- `e0dde2d` — feat: completed orders archive with tab toggle in MasterHome
- `5a19c39` — fix: unify price color to text-slate-800 across all views
- `7dd377f` — fix: app shell layout — fixed inset-0 flex-col with scrollable content area

---
## STATE — 2026-07-07 22:30

### Session 23: Reviews sheet for master (tap rating card)

#### Проблема
Мастер видел только цифру рейтинга и количество отзывов, но не мог посмотреть сами отзывы — кто оставил, оценку, комментарий.

#### Изменения
1. **`reviews.ts`** — новый `GET /reviews/mine`: все отзывы о текущем мастере (с информацией о клиенте: full_name, username, avatar_url). Собирает client_ids, делает второй запрос в profiles, маппит. (`93e5999`)
2. **`MasterHome.tsx`** — карточка рейтинга стала кнопкой: тап → фетч `/reviews/mine` → bottom sheet со списком отзывов. Каждый отзыв: аватар (инициал) + имя клиента, звезды (★/☆), комментарий, дата. Пустое состояние: "Пока нет отзывов". (`93e5999`)
3. **i18n** — `reviews_title`, `no_reviews`, `anonymous`, `close` в ru/en/be. (`93e5999`)

#### Verification
- `npm run typecheck -w api` — PASS
- `npm run typecheck -w web` — PASS

#### Коммит
- `93e5999` — feat: master can view reviews with client info by tapping rating card
- `9edff11` — fix: move reviews endpoint to masters/me/reviews (route conflict with orders/:id)
- `b87f176` — fix: use Avatar component in review sheet for client photos