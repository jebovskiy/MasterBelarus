# МастерБай — биржа бытовых мастеров в Telegram Mini App

Telegram Mini App для рынка Беларуси: сантехник, электрик, грузчик, репетитор — один запрос, мастер приходит сегодня.

## Стек
- **Frontend:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui + @telegram-apps/sdk
- **Backend:** Node.js (Express + telegraf) + BullMQ + socket.io
- **DB:** Supabase (PostgreSQL + PostGIS + Realtime + Storage)
- **Infra:** Docker Compose, Nginx + Let's Encrypt, Hetzner VPS

## Структура монорепо
- `web/` — React Mini App (планируется)
- `api/` — Node.js backend (планируется)
- `docs/` — техническая документация и дизайн-токены
- `memory/` — долговременный контекст проекта для AI-агентов

## Документация
- `memory/PROJECT.md` — что это, зачем, ключевые решения
- `docs/visual-spec.md` — дизайн-токены (палитра, компоненты, типографика, состояния)

## Что на текущем этапе
Это bootstrap-коммит. Спринт 0 (инфраструктура и БД) начнётся следующим.

## Разработка
```bash
# После настройки инфраструктуры (будут добавлены):
docker compose up -d db
cd api && npm install && npm run dev
cd ../web && npm install && npm run dev
```
