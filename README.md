# Psy-booking: Psychologist Booking System

Modern, self-hosted booking system for psychologists and therapists, built with React and Node.js. This project provides a seamless booking experience for clients and a powerful admin panel for schedule management.

## Tech Stack

- **Frontend:**
  - [React](https://reactjs.org/) (UI Library)
  - [Tailwind CSS](https://tailwindcss.com/) (Styling)
  - [React Day Picker](https://react-day-picker.js.org/) (Calendar Component)
  - [React Hook Form](https://react-hook-form.com/) (Form Management)
  - [Axios](https://axios-http.com/) (HTTP Client)

- **Backend:**
  - [Node.js](https://nodejs.org/)
  - [Express](https://expressjs.com/) (Web Framework)
  - [PostgreSQL](https://www.postgresql.org/) (Database)
  - [Sequelize](https://sequelize.org/) (ORM)
  - [JSON Web Token (JWT)](https://jwt.io/) (Authentication)

- **DevOps & Tooling:**
  - [Docker](https://www.docker.com/) & Docker Compose
  - [ESLint](https://eslint.org/) (Code Linting)

## Project Structure

This project is a monorepo containing two main packages: `frontend` and `backend`.

```
psyform/
├── .github/         # GitHub Actions workflows
├── backend/         # Node.js/Express backend application
│   ├── config/      # Database and logger configuration
│   ├── middleware/  # Custom Express middleware (e.g., auth)
│   ├── migrations/  # Sequelize database migrations
│   ├── models/      # Sequelize data models
│   ├── routes/      # API endpoint definitions
│   ├── seeders/     # Database seed files
│   ├── .env.example # Environment variable template
│   └── server.js    # Main application entry point
├── docs/            # Project documentation (e.g., user stories)
├── frontend/        # React frontend application
│   ├── public/      # Static assets and index.html
│   ├── src/
│   │   ├── api/       # Functions for making API calls
│   │   ├── assets/    # Images, fonts, etc.
│   │   ├── components/# Reusable React components
│   │   ├── hooks/     # Custom React hooks
│   │   ├── pages/     # Page-level components
│   │   ├── App.js     # Main application component with routing
│   │   └── index.js   # Application entry point
│   └── tailwind.config.js # Tailwind CSS configuration
├── .gitignore       # Files and folders to ignore in Git
├── docker-compose.yml # Docker configuration for local development
└── README.md        # This file
```

## Getting Started

Follow these instructions to get the project up and running on your local machine.

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) (v16 or later)
- [npm](https://www.npmjs.com/get-npm) or [Yarn](https://yarnpkg.com/)
- [PostgreSQL](https://www.postgresql.org/download/) running locally or via Docker.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/virtualsect/psyform.git
    cd psyform
    ```

2.  **Set up the Backend:**
    ```bash
    cd backend
    ```
    - Create the environment file:
      ```bash
      cp .env.example .env
      ```
    - Open the new `.env` file and fill in your database credentials, JWT secret, and other required values.
    - Install dependencies:
      ```bash
      npm install
      ```

3.  **Set up the Frontend:**
    ```bash
    cd ../frontend
    npm install
    ```

### Database Setup

From the `/backend` directory, run the Sequelize CLI commands to prepare the database:

1.  **Run migrations:** This will create all the necessary tables.
    ```bash
    npx sequelize-cli db:migrate
    ```

2.  **(Optional) Run seeders:** This will populate the database with initial data (e.g., the admin user).
    ```bash
    npx sequelize-cli db:seed:all
    ```

## Running the Application

You need to run the backend and frontend servers in separate terminals.

1.  **Start the Backend Server:**
    - In a terminal at the `/backend` directory:
      ```bash
      npm start
      ```
    - The server will start on the port specified in your `.env` file (default: `http://localhost:5000`).

2.  **Start the Frontend Development Server:**
    - In another terminal at the `/frontend` directory:
      ```bash
      npm start
      ```
    - The React application will open automatically in your browser at `http://localhost:3000`.

### Telegram Lookup Setup

The application can display Telegram usernames and avatars for phone numbers. To enable this feature:

1. Create a Telegram application at [my.telegram.org](https://my.telegram.org/) to obtain an **API ID** and **API Hash**.
2. Generate a session string using a tool like GramJS or Telethon (we provide a script in `/backend/scripts` if needed).
3. Add the credentials to `/backend/.env`:
   ```
   TELEGRAM_API_ID=<your_api_id>
   TELEGRAM_API_HASH=<your_api_hash>
   TELEGRAM_SESSION=<your_session_string>
   ```
4. Restart the backend server after saving the file.

## Multi-tenant public forms and Telegram deep-links

- The `Practitioners.publicSlug` field is REQUIRED and UNIQUE. It powers public booking URLs like `/p/<publicSlug>`.
- Telegram client login uses deep-links that always carry the target public slug:
  - Bot start payload format: `start=login_<nonce>_<base64url(publicSlug)>`
  - After sharing contact, the bot sends a magic-link to the backend: `/api/auth/magic?t=<code>&p=<publicSlug>[&r=<base64url path>]`
- The backend endpoint `/api/auth/magic` requires the `p` parameter and validates it strictly against `Practitioners.publicSlug` (or `slug`).
  - If `p` is missing → `400 Missing p`
  - If `p` does not match any practitioner → `404 Unknown practitioner`
  - If token belongs to a different tenant → `403 Wrong tenant for token`
  - On success, client cookies are issued and the user is redirected to `/p/<publicSlug>` (or to `r` if provided and safe).
- The frontend `TelegramLogin` component resolves the current `publicSlug` from the URL or localStorage; if it cannot determine a slug, it disables the deep-link button and shows an error prompt to open the correct `/p/<slug>` page.

Migration note: a migration enforces `publicSlug NOT NULL UNIQUE` and backfills missing values for existing practitioners based on their `slug`.

### Public booking page validation (`/p/:publicSlug`)

- The public booking page is validated on load. Wrapper component `frontend/src/components/ValidatedBooking.jsx` fetches:
  - While fetching, a loading spinner is shown with the message "Загружаем данные психолога...".
  - If the API returns `404`, the page displays a "Психолог не найден" message and a button to go to the home page. Deep-link buttons are effectively disabled since the page does not proceed to the booking UI.
  - For network/5xx errors, the page shows an error message and a "Повторить" button to retry the request.
- On successful validation, the UI proceeds to the booking form and only then stores `localStorage.practitionerPublicSlug = <publicSlug>` (previous practitionerId/slug are cleared). This ensures axios attaches `x-practitioner-public-slug` automatically for subsequent requests.
- Route: `frontend/src/App.js` uses `<ValidatedBooking />` for `/p/:slug`, which then renders `<BookingForm />` only after successful validation.

## Psychologist Admin Workflow (админ‑кабинет)

1. Log in through the public page for psychologists `/psychologist` (or personal `/psychologist/:slug`).
2. Fill in the profile (name, specialization, price, message to clients, timezone).
3. Set up the schedule (working days/hours, duration, breaks, generation period). Optionally, enable auto-generation of slots.
4. Generate slots and preview the calendar.
5. Manage bookings: filter, confirm, reschedule, quickly open a chat or copy contacts.

### Admin Components

- `frontend/src/components/AdminApp.jsx`
  - Saves the active tab in `localStorage.adminActiveTab`.
  - Shows a banner "Profile not filled" on the first login, if the profile is empty, with a CTA to the "Profile" tab.

- `frontend/src/components/ProfileSettings.jsx`
  - Previews the public page (iframe) by `practitionerPublicSlug`.
  - Provides a live preview of the message to clients and a template variable hint.

- `frontend/src/components/ScheduleSettingsTab.jsx`
  - Shows the current timezone with a hint.
  - After saving or generating slots, opens a visual preview (modal window with a calendar).
  - Adds a flag "auto-generation" of slots (UI; server-side logic is on the backend).

- `frontend/src/components/BookingsTab.jsx`
  - Filters: status, date range, search by name (uses query parameters `/api/bookings`).
  - Infinite scrolling (button "Show more").
  - Quick actions on hover: delete, reschedule, copy contacts, open Telegram chat.
  - Blocks "Today" and "Next 7 days" with a scroll to the corresponding entry.

### Centralized Error Handling

- In `frontend/src/api.js`, added `api.interceptors.response` with `react-hot-toast` for friendly error messages on 5xx/offline.
- Supports suppressing global toasts with the `_suppressGlobalError` flag or the `X-Suppress-Error` header.

### Localization & Copywriting

- Simple i18n wrapper: `frontend/src/locale/i18n.js` (now supports string interpolation like `{name}`) and RU dictionary `frontend/src/locale/ru.js`.
- App is wrapped in `<I18nProvider locale="ru">` (see `frontend/src/index.js`).
- Admin UI is fully localized (no mojibake):
  - `AdminApp.jsx` (header, tabs, profile banner)
  - `BookingsTab.jsx` (titles, filters, placeholders, actions, toasts, table headers, status badges)
  - `ScheduleSettingsTab.jsx` (headings, labels, hints, toasts, buttons)
  - `ProfileSettings.jsx` (fields, hints, preview modal, toasts)
  - `ValidatedBooking.jsx` (loading, not found, retry)
- All above strings were moved to the dictionary; Russian copy polished for consistency.

### Accessibility & UI Polish

- Checked the contrast of main buttons/texts (Tailwind classes for accents/focus).
- Focus styles are visible for interactive elements; keyboard navigation works.
- Spacing is unified, and "air" headers are added.

## User Stories (addition)

- As a psychologist, I want to see confirmed/pending bookings in one table with color indication of status and filters.
- As a psychologist, I want to quickly generate a schedule and immediately see which slots have been created (calendar preview).
- As a psychologist, I want to edit my profile and immediately understand how it looks to clients (public page preview).
- As a psychologist, I want to quickly open a chat with a client or copy their contacts from the booking list.

## CHANGELOG (selected)

- Added a wrapper `ValidatedBooking` for validating the public `publicSlug` and getting the public booking form.
- In the admin: saves the active tab, shows a banner when the profile is empty, previews the public page and calendar.
- In the schedule: shows the timezone with a hint, auto-generation (UI), preview after saving/generating.
- In the booking list: filters, pagination, quick actions, blocks "Today/Next 7 days".
- Centralized error toasts in `api.js`.
- Added an i18n wrapper and the RU dictionary; Admin UI now fully uses i18n keys (no hardcoded Russian left in admin pages).
- Copy and UX polish: added placeholders for filters, consistent toasts and hints, improved error messages.
- Cleanup: removed unused imports (e.g., `BookingForm` from `App.js`, `useNavigate` from `AdminApp.jsx`, `Controller` from `ScheduleSettingsTab.jsx`).

## Timezone Handling (Как работает время и часовые пояса)

- **Фронтенд (Intl):**
  - Отображение времени через `Intl.DateTimeFormat` в компонентах `frontend/src/components/TimezoneDisplay.jsx` (`SimpleTimeDisplay`, `TimeRangeDisplay`).
  - Для клиента используется локальная зона или выбранная вручную (`localStorage.clientTimezone`). Для психолога в админке — `practitioner.timezone`.
  - В `BookingDetailsModal.jsx` дополнительно показывается «время клиента», если оно отличается от зоны психолога.

- **Передача TZ на бэкенд:**
  - Все запросы с фронта отправляют заголовок `x-client-timezone` (см. `frontend/src/api.js`).
  - Бэкенд использует его как `booking.sourceTimezone` для новых записей и для обновления `Client.clientTimezone` при авторизации.

- **Бэкенд (утилиты):**
  - Единые функции в `backend/utils/timez.js`:
    - `getTzLabel(tz)` → строка вида ` (Asia/Bangkok, UTC+7)`
    - `formatRangeInTz(startISO, endISO, tz)` → `{ dateStr, timeStr, tzLabel }`
  - Уведомления Telegram в `backend/services/telegramBot.js` используют утилиты и общий порядок фоллбеков.

- **Порядок фоллбеков TZ:**
  - Для клиентских уведомлений/отображения времени:
    1. `client.clientTimezone`
    2. `booking.sourceTimezone` (берётся с фронта из заголовка)
    3. `process.env.TIMEZONE`
    4. `'Europe/Moscow'`
  - Для уведомлений психологу — `practitioner.timezone`.

- **Примеры форматов:**
  - Диапазон времени: `HH:mm–HH:mm`
  - Подпись TZ: ` (Europe/Moscow, UTC+3)`
  - Пример: `Новая запись: Иван — 05.03.2025 13:00–14:00 (Europe/Moscow, UTC+3).`

### Тесты по TZ

- Бэкенд (Jest):
  - `backend/tests/timez.test.js` — проверка `getTzLabel` и `formatRangeInTz`.
  - `backend/tests/telegramBot.texts.test.js` — снапшоты/проверки текстов для `notifyBookingCreated` и `sendRescheduleNotification` (мок `bot.telegram.sendMessage`).
  - Запуск:
    ```bash
    cd backend
    set NODE_ENV=test&& npm test
    # или покрытие
    set NODE_ENV=test&& npm run test:coverage
    ```

- Фронтенд (CRA + RTL):
  - `frontend/src/__tests__/BookingDetailsModal.test.jsx` — отображение блока «время клиента».
  - `frontend/src/__tests__/BookingForm.timezone.test.jsx` — наличие подписи «Время указано для…» и открытие селектора по клику «Изменить».
  - Запуск:
    ```bash
    cd frontend
    npm test
    ```

### Примечания

- Для корректной работы Telegram-бота укажите `TELEGRAM_BOT_TOKEN` в `backend/.env`.
- При проблемах с окружением перезапустите контейнеры Docker:
  ```bash
  docker compose down
  docker compose up -d --build
  ```
