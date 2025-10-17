# L2: Локальный стек Jitsi + TURN (docker-compose.calls.yml)

Эта инструкция поднимает отдельный стек (не меняя прод‑compose) и проверяет ICE/TURN, в т.ч. fallback через 5349/tcp.

## 1) Файлы и версии
- Compose: `docker-compose.calls.yml` (версии зафиксированы)
  - Jitsi образы: `stable-8719` (web, prosody, jicofo, jvb)
  - Coturn: `4.6.2`
- Env‑шаблон: `.env.calls.example` → скопируйте в `.env.calls` и заполните.
- Серты: положите `tls.crt` и `tls.key` в `./calls/certs/`.

## 2) Подготовка сертификатов (self‑signed/mkcert)
Пример для Windows (PowerShell) с mkcert:
```powershell
mkcert -install
mkcert -cert-file .\calls\certs\tls.crt -key-file .\calls\certs\tls.key jitsi.localhost 127.0.0.1
```
В `.env.calls` PUBLIC_URL должен совпадать с CN/SAN сертификата, напр.: `PUBLIC_URL=https://jitsi.localhost:8443`.

## 3) Настройка .env.calls
Скопируйте шаблон:
```powershell
Copy-Item .env.calls.example .env.calls
```
Заполните поля:
- **PUBLIC_URL**: `https://jitsi.localhost:8443`
- **JWT**: `JITSI_JWT_APP_ID`, `JITSI_JWT_APP_SECRET`, `JITSI_JWT_ISS`, `JITSI_JWT_AUD` (должны совпадать с backend‑генерацией)
- **TURN**: `TURN_STATIC_USER`, `TURN_STATIC_PASSWORD`, `TURN_REALM`
- **Coturn IP/Host**: `COTURN_EXTERNAL_IP` (ваш локальный IP, если NAT), `COTURN_PUBLIC_HOST` (IP/домен, по которому клиентам доступен TURN)
- **DOCKER_HOST_ADDRESS**: `host.docker.internal` (локально для JVB/10000/udp)

Примечания по JWT:
- Включена аутентификация: `ENABLE_AUTH=1`, `AUTH_TYPE=jwt`, `ENABLE_GUESTS=0`.
- Prosody принимает `JWT_ACCEPTED_AUDIENCES`/`JWT_ACCEPTED_ISSUERS`.
- Клеймы в токене должны содержать `aud`, `iss`, `sub` (XMPP домен, по умолчанию `meet.jitsi`), `room`, `exp`, и `context.user.role`.

## 4) Запуск и остановка
Запуск стека (отдельный от основного):
```powershell
docker compose --env-file .env.calls -f docker-compose.calls.yml up -d --build
```
Проверка:
- Откройте `https://jitsi.localhost:8443` и примите сертификат (self‑signed/mkcert).

Логи:
```powershell
docker compose -f docker-compose.calls.yml logs -f jitsi-web
docker compose -f docker-compose.calls.yml logs -f jitsi-prosody
docker compose -f docker-compose.calls.yml logs -f jitsi-jicofo
docker compose -f docker-compose.calls.yml logs -f jitsi-jvb
docker compose -f docker-compose.calls.yml logs -f coturn
```
Остановка:
```powershell
docker compose -f docker-compose.calls.yml down
```

## 5) Тест входа с JWT (до L3, вручную)
Пока backend не генерирует JWT, можно создать тестовый токен (HS256) в jwt.io или Node.js, используя `JITSI_JWT_APP_SECRET`:
Пример payload (подставьте свои `aud/iss/sub/room/exp`):
```json
{
  "aud": "psyform-calls",
  "iss": "psyform-backend",
  "sub": "meet.jitsi",
  "room": "devroom",
  "exp": 1893456000,
  "context": { "user": { "name": "Host", "role": "host" } }
}
```
URL для входа: `https://jitsi.localhost:8443/devroom?jwt=<ВАШ_JWT>`

## 6) Проверка ICE/TURN
- Откройте `chrome://webrtc-internals`, затем подключитесь в комнату (с JWT).
- В статистике соединений убедитесь, что появляются `relay`‑кандидаты (`typ relay`) — это маршрутизация через TURN.
- Проверьте, что в обычном режиме задействуются `srflx/host`, а при блокировке UDP — `relay`.

### Сценарий: выключенный UDP → relay на 5349/tcp
Создайте временные правила в Windows Firewall (PowerShell с правами админа):
```powershell
# Блокируем исходящий/входящий UDP для ключевых портов
New-NetFirewallRule -DisplayName "Block UDP 10000 out" -Direction Outbound -Protocol UDP -LocalPort 10000 -Action Block
New-NetFirewallRule -DisplayName "Block UDP 10000 in"  -Direction Inbound  -Protocol UDP -LocalPort 10000 -Action Block
New-NetFirewallRule -DisplayName "Block UDP 3478 out"  -Direction Outbound -Protocol UDP -LocalPort 3478  -Action Block
New-NetFirewallRule -DisplayName "Block UDP 3478 in"   -Direction Inbound  -Protocol UDP -LocalPort 3478  -Action Block
```
Переподключитесь к комнате и убедитесь в `webrtc-internals`, что активный кандидат — `relay` через `turns:<host>:5349?transport=tcp`.

Откат правил:
```powershell
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "Block UDP *"} | Remove-NetFirewallRule
```

## 7) Troubleshooting
- **403/Unauthorized при входе**: проверьте подпись JWT, `exp`, `aud/iss/sub`, `room`, роль пользователя.
- **Нет relay‑кандидатов**: проверьте, что coturn слушает 3478/udp,tcp и 5349/tcp, и что `COTURN_PUBLIC_HOST` корректно указывает хост/домен.
- **Нет медиа**: проверьте разрешения камеры/микрофона и pre‑join;
- **Self‑signed ошибка**: убедитесь, что корневой сертификат mkcert установлен (`mkcert -install`) и домен совпадает с `PUBLIC_URL`.
- **Нестабильность/потери**: смотрите статистику в Jitsi/`webrtc-internals`, при необходимости понизьте качество до 360p, проверьте CPU.

## 8) Что дальше
- После валидации стека переходим к L3: модели, миграции и API бекенда (генерация JWT, создание/закрытие сессий, логи, крон).
