# Руководство по тестированию

## Обзор

Проект включает комплексную систему тестирования, покрывающую все основные компоненты:
- Аутентификация и авторизация
- Управление расписанием
- Бронирование сеансов
- Middleware и безопасность
- Напоминания и уведомления
- Интеграция с Telegram

## Структура тестов

```
backend/__tests__/
├── setup.js                    # Глобальная настройка тестов
├── comprehensive.test.js        # Комплексные системные тесты
├── middleware.test.js          # Тесты middleware
├── reminder-scheduler.test.js   # Тесты планировщика напоминаний
├── admin_auth.test.js          # Тесты админской авторизации
├── bookings.test.js            # Тесты бронирования
├── bookings_access.test.js     # Тесты доступа к бронированиям
├── slots.test.js               # Тесты слотов
├── telegram_auth.test.js       # Тесты Telegram авторизации
└── telegramBot.ensureUnique.test.js # Тесты уникальности кодов
```

## Запуск тестов

### Локально (без Docker)

```bash
# Переход в директорию backend
cd backend

# Установка зависимостей (если не установлены)
npm install

# Запуск всех тестов
npm test

# Запуск тестов в режиме наблюдения
npm run test:watch

# Запуск тестов с покрытием кода
npm run test:coverage

# Запуск конкретного теста
npm test -- comprehensive.test.js

# Запуск тестов с отладочной информацией
DEBUG_TESTS=true npm test
```

### В Docker окружении

```bash
# Запуск тестов в изолированном Docker окружении
docker-compose -f docker-compose.test.yml up --build

# Запуск тестов с сохранением логов
docker-compose -f docker-compose.test.yml up --build > test-results.log 2>&1

# Очистка тестового окружения
docker-compose -f docker-compose.test.yml down -v
```

## Конфигурация тестов

### Переменные окружения для тестов

```bash
NODE_ENV=test
JWT_SECRET=test-secret-key-for-testing
DB_NAME=psybooking_test
DB_USER=user
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=5433  # или 5434 для Docker тестов
TIMEZONE=Europe/Moscow
TELEGRAM_DISABLED=true
WHATSAPP_DISABLED=true
```

### Jest конфигурация

Файл `jest.config.js` содержит:
- Настройки тестового окружения Node.js
- Пути к тестовым файлам
- Настройки покрытия кода
- Таймауты и обработка открытых соединений

## Покрытие тестами

### Что покрыто:

✅ **Аутентификация и авторизация**
- Админский вход через логин/пароль
- Клиентская авторизация через Telegram коды
- JWT токены в HttpOnly cookies
- Middleware для проверки ролей

✅ **Управление расписанием**
- Получение и обновление настроек расписания
- Генерация доступных слотов
- Валидация параметров расписания

✅ **Система бронирования**
- Создание бронирований через существующие слоты
- Создание бронирований с произвольным временем
- Обновление времени бронирований
- Предотвращение конфликтов времени

✅ **Безопасность**
- Изоляция данных по practitionerId
- Валидация JWT токенов
- Обработка отсутствующих переменных окружения
- Защита от несанкционированного доступа

✅ **Планировщик напоминаний**
- Отправка напоминаний за 24 часа и 1 час
- Предотвращение дублирования напоминаний
- Обработка ошибок Telegram API

✅ **Middleware**
- practitionerScope - разрешение контекста практикующего
- authMiddleware - проверка JWT токенов
- clientAuthMiddleware - авторизация клиентов
- adminOnly - ограничение доступа для админов

### Метрики покрытия

Для получения детального отчета о покрытии:

```bash
npm run test:coverage
```

Отчет будет доступен в `backend/coverage/lcov-report/index.html`

## Моки и заглушки

Тесты используют моки для внешних сервисов:

```javascript
// Telegram API
jest.mock('../services/telegramLookup')
jest.mock('../services/telegramBot')

// WhatsApp API
jest.mock('../services/whatsappCheck')
```

## Отладка тестов

### Включение отладочных логов

```bash
DEBUG_TESTS=true npm test
```

### Запуск одного теста

```bash
npm test -- --testNamePattern="Admin login"
```

### Запуск тестов для одного файла

```bash
npm test comprehensive.test.js
```

## Интеграция с CI/CD

### GitHub Actions пример

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: psybooking_test
          POSTGRES_USER: user
          POSTGRES_PASSWORD: password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd backend && npm ci
      - run: cd backend && npm test
        env:
          NODE_ENV: test
          JWT_SECRET: test-secret
          DB_HOST: localhost
          DB_PORT: 5432
          DB_NAME: psybooking_test
          DB_USER: user
          DB_PASSWORD: password
```

## Рекомендации

### Добавление новых тестов

1. Создайте тестовый файл в `__tests__/`
2. Используйте существующие моки для внешних сервисов
3. Очищайте данные между тестами в `beforeEach`
4. Используйте описательные названия тестов
5. Группируйте связанные тесты в `describe` блоки

### Лучшие практики

- **Изоляция**: каждый тест должен быть независимым
- **Очистка**: используйте `beforeEach` для очистки БД
- **Моки**: мокайте внешние зависимости
- **Ассерции**: используйте конкретные проверки
- **Читаемость**: пишите понятные названия тестов

### Устранение проблем

**Тесты зависают:**
```bash
# Используйте флаг --detectOpenHandles
npm test -- --detectOpenHandles
```

**Проблемы с БД:**
```bash
# Проверьте подключение к тестовой БД
psql -h localhost -p 5433 -U user -d psybooking_test
```

**Конфликты портов:**
```bash
# Измените порт в docker-compose.test.yml
ports:
  - "5435:5432"  # Используйте свободный порт
```

## Заключение

Система тестирования обеспечивает:
- 🔒 Проверку безопасности и авторизации
- 📅 Валидацию логики бронирования
- 🔧 Тестирование всех API эндпоинтов
- 🐳 Возможность запуска в Docker
- 📊 Отчеты о покрытии кода

Регулярно запускайте тесты при разработке для обеспечения стабильности системы.
