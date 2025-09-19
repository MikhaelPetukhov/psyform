# Changelog

Все значимые изменения в проекте PsyBooking будут документированы в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
и этот проект придерживается [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Планируется
- Форма записи с календарем
- Email уведомления
- Админ-панель для психолога
- Telegram интеграция
### Изменено
- Удалена дублирующая модель `ScheduleSettings`, вся логика использует `ScheduleSetting`.

## [0.2.0] - 2025-09-19
### Добавлено
- Перевод Telegram-бота на webhook-режим: эндпоинт `POST /api/telegram/webhook/:secret`, настройка `TELEGRAM_WEBHOOK_ENABLED=true`, защита секретом `TELEGRAM_WEBHOOK_SECRET`.
- Эндпоинт метрик Prometheus `GET /metrics` (зависимость `prom-client`).
- Миграция БД: уникальный индекс `Bookings(practitionerId, slotTime)` с предварительной дедупликацией.

### Изменено
- Исключён двойной запуск бота: при включенном webhook апдейты принимает только `backend`, в `worker` бот не стартует.
- Настроены таймауты в `frontend/nginx.conf` для стабильной работы через ngrok.
- Унифицированы настройки пула соединений Sequelize через env (`DB_POOL_MAX/MIN/ACQUIRE_MS/IDLE_MS`).
- Ужесточены атрибуты cookie: `SameSite=None`, `Secure` по `COOKIE_SECURE`/`NODE_ENV` для корректной работы через HTTPS (ngrok).
- Санитизирован `docker-compose.yml`: удалены хардкоды секретов, чтение из переменных окружения.

### Исправлено
- Удалён доступ к админскому календарю из публичной формы записи: из `BookingForm.jsx` убраны кнопка «Открыть календарь» и `CalendarModal`.

## [0.1.0] - 2025-07-22
### Добавлено
- Инициализация проекта
- Структура папок (frontend, backend, docs)
- Документация требований (REQUIREMENTS.md)
- Техническая архитектура (ARCHITECTURE.md)
- Настройка package.json
- GitHub репозиторий
- Шаблоны для Issues

### Техническая информация
- Выбран стек: React + Node.js + PostgreSQL
- Настроена структура монорепозитория
- Определены API endpoints
- Спроектирована схема базы данных
