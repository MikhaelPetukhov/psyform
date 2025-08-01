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
psybooking/
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
    git clone https://github.com/virtualsect/psybooking.git
    cd psybooking
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
2. Generate a session string using a tool like [GramJS](https://gram.js.org/) or Telethon.
3. Add the credentials to `/backend/.env`:
   ```
   TELEGRAM_API_ID=<your_api_id>
   TELEGRAM_API_HASH=<your_api_hash>
   TELEGRAM_SESSION=<your_session_string>
   ```
4. Restart the backend server after saving the file.
