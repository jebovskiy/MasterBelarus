# MasterBelarus

Биржа бытовых мастеров внутри Telegram Mini App. Рынок: Беларусь, 2026.

## Стек

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui + framer-motion + Zustand + @telegram-apps/sdk
- **Backend**: Node.js + Express + TypeScript + telegraf + BullMQ (Redis)
- **DB**: Supabase (PostgreSQL + PostGIS + Realtime)
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
- RPC: `find_orders_nearby(lat, lng, radius_m, category?)`

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
