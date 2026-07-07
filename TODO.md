# МастерБай — Master TODO

## Legend
- `[crit]` — блокирует запуск / integrity данных
- `[high]` — значительное влияние на UX / бизнес
- `[med]` — улучшение качества
- `[low]` — nice-to-have

---

## 🚀 Features / Roadmap

### FEAT-001: Эквайринг (bePaid/EasyPay)
**Когда:** Month 2 пост-MVP

### FEAT-002: Юрлицо ИП
**Когда:** Month 2 (перед эквайрингом)

### FEAT-003: Админ-панель (заново)
**Когда:** Month 2
**Note:** `AdminPanel.tsx` удалён.

### FEAT-004: Веб-версия
**Когда:** Month 3

### FEAT-005: Жалобы на мастеров
**Когда:** Month 3 (миграция `complaints` есть)

### FEAT-006: Гео-карта
**Когда:** Month 3

### FEAT-007: BY/EN локализация
**Когда:** Month 4 (все экраны переведены)

### FEAT-008: Native push
**Когда:** Month 4

### FEAT-009: Cold start (30-50 мастеров)
**Когда:** Sprint 5
**Каналы:** Kufar, VK, Telegram-чаты ЖК, оффлайн.

### FEAT-010: Онбординг мастеров
**Что:** Приветственный флоу после approve.

### FEAT-011: Pull-to-refresh
**Что:** RefreshIndicator на всех списках.

---

## ⚖️ Legal

### LEGAL-001: Консультация юриста
Комиссия за отклик — можно ли оставаться «доской объявлений».

### LEGAL-002: Privacy Policy + Terms of Service
Обязательно для Telegram Review.

### LEGAL-003: Договор-оферта
Перед эквайрингом.

### LEGAL-004: ИП
Перед монетизацией.

---

## ⚡ Need user action

### SENTRY_DSN / POSTHOG_KEY
Код Sentry и PostHog есть, но env vars пусты. Вписать ключи в Railway (api) и Vercel (web).

---

## ✅ Done (подтверждено кодом)

### Critical (4)
| # | Баг | Где починено |
|---|-----|-------------|
| CRIT-001 | PostGIS градусы → geography | миграция 16 |
| CRIT-002 | Zustand mutation → spread | `Profile.tsx:221` |
| CRIT-003 | cancel.ts колонки → `master_id, response_credits` | `cancel.ts:113` |
| CRIT-004 | Оба приложения в DOM → условный рендер | `App.tsx:142` |

### High (13 → 11 fixed, 2 reclassified)
| # | Баг | Где починено |
|---|-----|-------------|
| HIGH-005 | react-router-dom unused | уже удалён |
| HIGH-006 | sourceMap в production | Vite default (false) |
| HIGH-007 | Пагинация | почти везде LIMIT есть |
| HIGH-008 | Code splitting | **Session 20** — все экраны lazy |
| HIGH-009 | Город в памяти → RPC | миграция 16 + `orders.ts:154` |
| HIGH-010 | Уведомления последовательно → parallel | **Session 20** — `notifications.ts:185` |
| HIGH-011 | Partial GIST index | миграция 15 |
| HIGH-012 | getTelegramInitData кеш | `telegram.ts:16` |
| HIGH-013 | Race accept-bid | `bids.ts:216` `.eq('status', 'open')` |
| HIGH-014 | Рейтинг O(N) → O(1) | **Session 20** — миграция 26 |
| HIGH-016 | N+1 refund → batch upsert | **Session 20** — `cancel.ts:119` |
| HIGH-015 | HMAC cache per-request | ↓ MED (логин 1 раз) |
| HIGH-019 | `is_master` vs `role` race | ↓ LOW (синхронизированы) |

### Medium (11 → 5 done, 6 skip)
| # | Баг | Что сделано |
|---|-----|-------------|
| MED-015 | HMAC кеш для логина | Skip — hash всегда новый, кеш никогда не попадёт |
| MED-018 | AbortController на fetch | Skip — Zustand безопасен после unmount |
| MED-020 | Отзывы — дубли | Done — `UNIQUE(order_id)` в reviews (миграция 7) |
| MED-021 | Staggered cap | Done — caps есть, +фикс ms→s в MasterHome |
| MED-022 | backdrop-blur low-end | Skip — нет backdrop-blur в коде |
| MED-023 | Sentry/PostHog env | Skip — нужны ваши ключи |
| MED-024 | Spring → cubic-bezier | Skip — нет spring-анимаций |
| MED-025 | HapticFeedback | Done — во всех 10 компонентах |
| MED-026 | Safe area insets | Done — во всех экранах (15 вхождений) |
| MED-027 | Layout prop | Skip — списки статические |
| MED-028 | Миграции | Done — 26 шт, без пропусков, консистентны |

### Low (6 → 4 done, 2 skip)
| # | Баг | Что сделано |
|---|-----|-------------|
| LOW-019 | `is_master` vs `role` | Skip — approve-хендлеры синхронизированы |
| LOW-029 | Dead docs refs | Done — CLAUDE.md очищен |
| LOW-030 | Lockfile missing | Done — `package-lock.json` есть (300KB) |
| LOW-031 | Docker vs Nixpacks | Done — дизайн-решение |
| LOW-032 | Admin rate-limit | Done — 30 req/min уже на всех роутах |
| LOW-033 | Нет тестов web | Skip — дизайн-решение |

### Session 19 — Production audit
- `getUserClient()` удалён — все роуты через `getSupabaseAdmin()`
- `master_categories` query: `.eq('profile_id')` → `.eq('master_id')`
- `deduct_response` RPC: lazy init 20, атомарный deduct
- `sendMasterAcceptedNotification` принимает `orderId`
- `become-master` вставляет в `master_categories`
- Dead deps удалены: `bullmq`, `ioredis`, `socket.io`, `@sentry/vite-plugin`
- `AdminPanel.tsx` удалён
- Zombie rate-limit в `reviews.ts` удалён
- `role: 'master'` при approve согласован (3 файла)
- `seed.sql` — stale trigger удалены
- `cancelTracker.ts` → DB-backed (миграция 24)
- `PATCH /auth/profile` categories → atomic RPC (миграция 25)
- `as` type casts: 14 → 7

### Session 20 — Code splitting + parallel + batch + incremental rating
- Code splitting: React.lazy + Suspense на все экраны
- Parallel notifications: for → Promise.allSettled() (notifications.ts:185)
- Batch refund: N upserts → batch upsert (cancel.ts:119)
- Visibility check: ChatScreen polling guarded by document.hidden
- Incremental rating: O(N)→O(1) running average (миграция 26)

### Session 20b — MED/LOW cleanup (2026-07-07)
- MasterHome.tsx: `Math.min(idx * 40, 500)` → `Math.min(idx * 0.04, 0.5)` (ms → seconds bug)
- CLAUDE.md: удалены 3 мёртвые ссылки (decisions.md, ARCHITECTURE.md, API.md)
- TODO.md: приведён в соответствие с реальностью

### Infrastructure
- TypeScript: 0 errors api + web
- Lint: 0 errors api
- Tests: 8/8 pass
- CI: `.github/workflows/ci.yml`
- Чат: end-to-end (БД, API, UI, polling, read receipts)
- i18n: все экраны переведены (ru/be/en)
- Тёмная тема: удалена (light only)
