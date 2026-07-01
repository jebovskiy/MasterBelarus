# Visual Design Specification — МастерБай
# Сохраняется как единый source-of-truth для всех агентов и генераторов UI

## Design System: 2026 Scandinavian Cyber-Minimalism (Light Mode Luxury)

## COLOR PALETTE

### Backgrounds
--app-bg:          #F8F9FA   matte off-white canvas (never #FFFFFF fullscreen)
--app-surface:     #FFFFFF   pure white cards
--app-surface-alt: #F1F3F5   nested elements inside cards

### Borders
--app-border:      #E4E7EB   1px solid ultra-thin slate

### Primary Accent (Amethyst)
--primary:         #7C3AED   main CTAs, active nav
--primary-hover:   #6D28D9
--primary-tint:    #EDE9FE   badge/chip background

### Semantic
--success:         #059669   active order, "Master on the way"
--success-tint:    #D1FAE5   status badge bg
--warning:         #D97706   low balance
--error:           #DC2626   errors/cancellations

### Typography
--text-primary:    #111827   body, headings
--text-secondary:  #6B7280   labels, dates
--text-tertiary:   #9CA3AF   placeholders, disabled

## TYPOGRAPHY
Font: 'Inter', fallback 'system-ui, -apple-system, sans-serif'
Hero:   24px / 800 / -0.02em / 1.1
Section: 18px / 700 / -0.01em
Body:   15px / 500 / 1.5
Caption: 13px / 500 / #6B7280
Button:  15px / 600 / 0
Prices:  tabular-nums (font-feature-settings: 'tnum')

## RADII
Card/bento: rounded-2xl (16px)
Button:     rounded-xl (12px)
Badge/chip: rounded-full (9999px)
Input:      rounded-xl (12px)

## SHADOWS
Card:        0 1px 2px rgba(17,24,39,0.04), 0 1px 3px rgba(17,24,39,0.06)
Card-hover:  0 4px 6px -1px rgba(17,24,39,0.07), 0 2px 4px -2px rgba(17,24,39,0.05)
Modal:       0 24px 48px -12px rgba(17,24,39,0.18)
Accent-glow: 0 0 24px rgba(125,58,237,0.25)

## MICRO-INTERACTIONS
Transition: 180ms cubic-bezier(0.4, 0, 0.2, 1)
Button:     hover scale(1.02) + accent glow
Card:       hover translateY(-2px) + shadow upgrade
Page:       fade + slide-up 12px 240ms

## LAYOUT (mobile-first)
Breakpoints: sm 360px | md 430px | lg 768px
Container: px-4 (16px)
Vertical: space-y-4 (16px between sections)
Card inner: p-5 (20px)
Bento gap: gap-3 (12px)

## FIXED ELEMENTS
Top Navbar (56px):
  bg: rgba(248,249,250,0.78) backdrop-blur(14px) saturate(180%)
  border-bottom: 1px solid rgba(228,231,235,0.6)
  left: Logo "МастерБай" 16px 700 + purple icon
  right: avatar 32px ring 1px #E4E7EB

Bottom TabBar (64px+inset):
  bg: rgba(255,255,255,0.85) backdrop-blur
  border-top: 1px #E4E7EB
  active: #7C3AED, inactive: #9CA3AF
  tabs: Главная, Заказы, Чат, Профиль
  haptic: light impact on tap

## SCREENS

### Client Home
1. Hero Bento (full width p-6)
   - eyebrow: "Бытовые услуги" 12px purple uppercase
   - heading: "Нужен мастер сегодня?" 24px 800
   - sub: "Отклик за 5 минут" 13px muted
   - right: isometric wrench+screwdriver icon
   - CTA: "Создать заявку" full-width primary h-12

2. Active Orders (conditional)
   - pulsing emerald dot + status badge
   - category icon + title + price
   - left emerald 3px border accent

3. Categories Bento (2col gap-3)
   - 6 tiles h-24: Сантехник, Электрик, Грузчик, Муж на час, Репетитор, Уборка
   - 24px monochrome icon #7C3AED
   - 14px 600 label

4. Recent Masters Carousel
   - horizontal snap-x-mandatory
   - w-44 cards, avatar 40px + stars

### Create Order Sheet (bottom sheet)
   - drag-up 90vh max, drag-indicator top
   - heading: "Опишите задачу" 20px 700
   - category chips (multi-select, active=primary-tint)
   - textarea min-h 100px 1px border
   - budget: number input + BYN suffix + "По договоренности" toggle
   - address: text + map pin prefix + Telegram geolocation fallback
   - photo: grid up to 5 × 1:1 rounded-lg
   - sticky CTA "Опубликовать"

### Master Home
1. Status Banner (gradient #EDE9FE→#F8F9FA)
   - avatar 48px + name + @username
   - "Статус: НПД Активен" emerald badge
   - "💎 15 откликов" balance pill

2. Stats Bento (asymmetric)
   - Box 2/3w: "Баланс откликов" big 40px gradient num + sparkline + "Пополнить"
   - Box 1/3w: "Рейтинг" 4.9 ★ 28px + "87 оценок"
   - Full row: Выполнено 12 · В работе 2 · Откликов сегодня 7

3. Live Orders Stream
   - real-time via socket + polling fallback
   - card: category pill(#EDE9FE) + "📍400м · 5 мин" muted
   - title 15px 600 2-line clamp
   - address 13px muted truncate
   - photo strip 3×48px
   - bottom: price tag 17px 700 #7C3AED vs "Договорная" muted italic
   - input "Ваша цена BYN" w-28 h-9 + button "Откликнуться" h-9

## STATES
- Empty: centered illustration + "Заказов рядом пока нет" + pull-to-refresh
- Loading: skeleton shimmer same dimensions as loaded cards
- Error: inline message + retry button
- Success: toast bottom-center white on graphite

## COMPONENT API

### Shared
- Button: variant(primary|secondary|ghost|danger), size(sm|md|lg), loading, disabled
- Input: label, helperText, prefix/suffix, error, type
- Card: interactive, highlighted(success|primary), pressable
- Chip: default|active|removable
- Badge: success|warning|error|neutral|primary
- Avatar: size(32|40|48|64), src, fallback=initials+gradient
- Sheet: open, onClose, dragDetent
- Toast: type, title, description, duration

## TELEGRAM INTEGRATION
- HapticFeedback: light(icon tap), medium(success actions), heavy(error)
- LocationManager: request geolocation
- initData: validate with HMAC on backend
- startParam: deep link / referral support
- themeParams: respect color-scheme
- safe-area-inset on all fixed elements

## ACCESSIBILITY
- prefers-reduced-motion: disable all hover transforms
- tap targets minimum 44×44
- contrast: all text passes AA on white (4.5:1), white on primary passes AAA (6.8:1)
- RTL-ready: logical properties (ms-/me-)
- focus-visible ring on all interactive elements