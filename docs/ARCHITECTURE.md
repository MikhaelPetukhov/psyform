# Техническая архитектура PsyBooking

## Общая архитектура
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   (React)       │◄──►│  (Node.js)      │◄──►│ (PostgreSQL)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Notifications  │
                    │ (Email/Telegram)│
                    └─────────────────┘
```

## Frontend (React + TypeScript)
### Структура:
```
frontend/
├── src/
│   ├── components/
│   │   ├── BookingForm/
│   │   ├── Calendar/
│   │   └── AdminPanel/
│   ├── pages/
│   ├── hooks/
│   ├── utils/
│   └── types/
├── public/
└── package.json
```

### Основные компоненты:
- **BookingForm** - форма записи клиента
- **Calendar** - календарь с доступным временем
- **AdminPanel** - панель управления для психолога
- **TimeSlot** - компонент выбора времени

## Backend (Node.js + Express)
### Структура:
```
backend/
├── src/
│   ├── routes/
│   │   ├── bookings.js
│   │   ├── admin.js
│   │   └── auth.js
│   ├── models/
│   ├── services/
│   │   ├── emailService.js
│   │   └── telegramService.js
│   ├── middleware/
│   └── utils/
├── config/
└── package.json
```

### API Endpoints:
```
POST /api/bookings          - Создать запись
GET  /api/bookings          - Получить все записи
GET  /api/available-slots   - Доступное время
DELETE /api/bookings/:id    - Отменить запись
POST /api/admin/login       - Авторизация админа
```

## База данных (PostgreSQL)
### Таблицы:
```sql
-- Записи на сеансы
bookings (
  id SERIAL PRIMARY KEY,
  client_name VARCHAR(100),
  client_email VARCHAR(100),
  client_phone VARCHAR(20),
  appointment_date DATE,
  appointment_time TIME,
  description TEXT,
  status VARCHAR(20),
  created_at TIMESTAMP
)

-- Настройки расписания
schedule_settings (
  id SERIAL PRIMARY KEY,
  day_of_week INTEGER,
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN
)

-- Заблокированное время
blocked_slots (
  id SERIAL PRIMARY KEY,
  date DATE,
  start_time TIME,
  end_time TIME,
  reason VARCHAR(200)
)
```

## Система уведомлений
### Email Service:
- **Nodemailer** для отправки email
- **Gmail SMTP** или **SendGrid**
- Шаблоны писем в HTML

### Telegram Service:
- **Telegram Bot API**
- Мгновенные уведомления психологу
- Команды для управления ботом

## Деплой и хостинг
### Frontend:
- **Vercel** или **Netlify** - статический хостинг
- Автоматический деплой из GitHub

### Backend:
- **Railway** или **Heroku** - хостинг Node.js
- **PostgreSQL** база данных в облаке

### Домен:
- Кастомный домен для профессионального вида
- SSL сертификат (HTTPS)

## Безопасность
- **CORS** настройки для API
- **Rate limiting** против спама
- **Input validation** всех форм
- **Environment variables** для секретов
- **JWT токены** для админ-панели

## Адаптивность
- **Mobile-first** подход
- **CSS Grid/Flexbox** для layout
- **Media queries** для разных экранов
- Тестирование на мобильных устройствах
