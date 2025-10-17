# Локальный стенд: Jitsi + TURN + Backend

Цель: поднять self‑hosted Jitsi (web/prosody/jicofo/jvb) и coturn локально, убедиться в работе WebRTC с fallback через TURN/TLS (5349), интегрировать с backend (JWT).

## 1) Предварительные зависимости
- Docker Desktop (Windows)
- Docker Compose
- Node.js (для бекенда/скриптов)
- mkcert (или self‑signed cert) для локального HTTPS

## 2) Домены и сертификаты (локально)
- Рекомендуемый локальный домен: `jitsi.localhost` (современные браузеры доверяют *.localhost; для iFrame может требоваться валидный сертификат).
- Сгенерировать dev‑сертификат (пример c mkcert):
  ```powershell
  mkcert -install
  mkcert jitsi.localhost
  ```
- Использовать сертификаты в web‑контейнере Jitsi (конкретный путь/переменные зависят от docker‑jitsi‑meet; зафиксируем в L2 с указанием версий).

## 3) TURN (coturn)
- Нужны 3478/udp,tcp и 5349/tls.
- Единый shared secret для REST‑аутентификации (ephemeral credentials) или статические учётные данные — в зависимости от выбранной схемы.
- Проверить, что локальные firewall‑правила разрешают указанные порты.

## 3.5) Быстрый дев-режим (HTTP)

- Для первого запуска без HTTPS используйте комплект в `jitsi/docker-jitsi-meet`.
- Проверьте, что файл `.env` в корне проекта содержит:
  - `PUBLIC_URL=http://localhost:8000`
  - `JITSI_JWT_APP_SECRET=local-dev-jitsi-secret-123` (значение должно совпадать с Jitsi `.env`)
- Запуск:
  ```powershell
  cd jitsi/docker-jitsi-meet
  docker compose --env-file .env up -d
  ```
- После старта веб-интерфейс будет доступен на `http://localhost:8000`. Примите предупреждение браузера, если оно появится.
- Бэкенд, запущенный из корневого `docker-compose.yml`, использует те же JWT-настройки, поэтому кнопка «Создать комнату» в админке сразу поднимет встречу в Jitsi.

## 4) Jitsi (docker‑jitsi‑meet)
- Используем официальный стек docker‑jitsi‑meet (web, prosody, jicofo, jvb).
- Включаем аутентификацию через JWT и запрещаем «гостей без токена».
- Базовые переменные окружения (концептуально — конкретные имена зависят от версии образов, уточним в L2):
  - Включение auth: `ENABLE_AUTH=1`, `AUTH_TYPE=jwt`.
  - Настройки JWT: допустимые `aud/iss/sub`, секрет/ключи, TTL.
  - TURN: указание TURN‑сервера(ов) и типа (udp/tcp/tls 5349).
- Публичный URL (для локали): `PUBLIC_URL=https://jitsi.localhost`.

## 5) Сборка docker‑стека
- Рекомендуем сделать отдельный override, не трогая текущий `docker-compose.yml` приложения:
  - `docker-compose.calls.yml` (или `docker-compose.override.yml`) с сервисами `jitsi-web`, `jitsi-prosody`, `jitsi-jicofo`, `jitsi-jvb`, `coturn`.
- Запуск (пример):
  ```powershell
  docker compose -f docker-compose.yml -f docker-compose.calls.yml up -d --build
  ```
- Проверить доступность:
  - `https://jitsi.localhost` отдаёт страницу Jitsi (web).

## 6) Интеграция backend (JWT)
- В `.env` бекенда хранить параметры для генерации JWT (ключи/секреты, issuer/audience, домен `sub`).
- Реализовать сервис генерации токенов (см. L4/L5) и эндпоинт `POST /api/calls`.
- На фронте открывать IFrame API, подставляя `roomId` и JWT.

## 7) Проверка ICE/TURN
- Откройте консоль Jitsi (`i` → stats) или `chrome://webrtc-internals` и убедитесь, что есть relay‑кандидаты.
- Смоделируйте блокировку UDP (firewall или флаг), убедитесь, что работает `turns:...:5349?transport=tcp`.

## 8) Troubleshooting
- **Нет звука/видео**: проверить разрешения браузера, устройства в pre‑join.
- **Не подключается к комнате**: проверить JWT (валидность подписи, `exp`, `room`, `aud/iss/sub`).
- **Нет relay‑кандидатов**: проверить порты coturn и настройки TURN в Jitsi.
- **Сертификат недоверенный**: переустановить mkcert, проверить, что домен совпадает с `PUBLIC_URL`.
- **Эхо/качество**: протестировать гарнитуру, снизить разрешение до 360p, проверить CPU/потери пакетов.

## 9) Ограничения локального стенда
- Локальные сети/NAT могут вести себя нестабильно; конечная проверка — на внешнем VPS.
- Некоторые мобильные браузеры строже к сертификатам и доменам; используйте валидные CA при полевых тестах.

## 10) Следующие шаги
- L2: подготовить конкретные compose‑сервисы Jitsi+TURN (с точными переменными) и проверенные инструкции для вашей версии образов.
- L3–L6: внедрить модели/сервисы/JWT/cron и REST‑эндпоинты.
- L8–L12: фронтенд‑интеграция (IFrame API, UI, таймер, pre‑join).
