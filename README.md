# PsyBooking - Система записи к психологу

> Современная система онлайн-записи на консультации психолога с уведомлениями и красивым интерфейсом

## 🎯 MVP v0.1.0 - Готов к использованию!

### ✅ Что работает:
- **Красивая форма записи** с профессиональным календарем
- **Валидация данных** - имя, email, телефон
- **Email уведомления** психологу о новых записях
- **Адаптивный дизайн** для мобильных устройств
- **REST API** для управления записями

### 🚀 Быстрый старт

```bash
# Клонирование проекта
git clone https://github.com/virtualsect/psybooking.git
cd psybooking

# Установка зависимостей
cd frontend && npm install
cd ../backend && npm install

# Настройка email (опционально)
# Отредактируйте backend/.env

# Запуск (2 терминала)
cd backend && node server.js     # Терминал 1
cd frontend && npm start         # Терминал 2
```

### 📱 Результат:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000

## 🏗️ Архитектура

```
psybooking/
├── frontend/          # React приложение
│   ├── src/
│   │   ├── components/
│   │   │   └── BookingForm.jsx
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── backend/           # Express API
│   ├── server.js
│   ├── .env
│   └── package.json
└── docs/             # Документация
    ├── REQUIREMENTS.md
    ├── ARCHITECTURE.md
    └── CHANGELOG.md
```

## 🔧 Технологии

**Frontend:**
- React 18
- @demark-pro/react-booking-calendar
- react-hook-form
- axios
- react-hot-toast

**Backend:**
- Node.js + Express
- Nodemailer (email уведомления)
- Express-validator
- CORS, Helmet (безопасность)

## ⚙️ Настройка Email

1. Создайте пароль приложения в Gmail
2. Отредактируйте `backend/.env`:

```env
EMAIL_USER=ваш-gmail@gmail.com
EMAIL_PASS=пароль-приложения
PSYCHOLOGIST_EMAIL=email-психолога@gmail.com
```

## 📋 API Endpoints

- `GET /api/health` - Проверка работы API
- `POST /api/bookings` - Создание записи
- `GET /api/bookings` - Получение всех записей

## 🎨 Преимущества над BookNow.ru

| BookNow.ru | PsyBooking |
|------------|------------|
| ❌ Внешний сервис | ✅ Собственная система |
| ❌ Нет уведомлений | ✅ Мгновенные email |
| ❌ Плохой UX | ✅ Современный дизайн |
| ❌ Ограниченная настройка | ✅ Полный контроль |

## 🚀 Roadmap

- [ ] Админ-панель для психолога
- [ ] Telegram уведомления
- [ ] База данных PostgreSQL
- [ ] Система оплаты
- [ ] Мобильное приложение

## 📄 Лицензия

Proprietary - Все права защищены

---

**Создано для коммерциализации и продажи другим психологам**
