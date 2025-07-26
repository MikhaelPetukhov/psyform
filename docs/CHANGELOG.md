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
