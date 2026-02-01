
# ProSkill English Quiz - Telegram Mini App MVP (PostgreSQL version)

A premium vocabulary learning app built with React (Frontend), FastAPI (Backend), and Aiogram (Bot).

## Features
- **Premium UI**: Dark mode, glassmorphism, amber accents.
- **Vocabulary Manager**: Add/Delete English words with Uzbek translations.
- **Smart Quiz**: Auto-generated 4-option quizzes from your own word list.
- **PostgreSQL**: Robust data storage for production.

## Local Setup

### 1. Requirements
- Python 3.10+
- PostgreSQL server installed and running
- Ngrok (for local testing)

### 2. Backend & Bot Setup
1. Install dependencies:
   ```bash
   pip install fastapi uvicorn aiogram sqlalchemy psycopg2-binary
   ```
2. Create a PostgreSQL database (e.g., `quiz_db`).
3. Set environment variables:
   ```bash
   export BOT_TOKEN='your_token_here'
   export DATABASE_URL='postgresql://user:password@localhost:5432/quiz_db'
   ```
4. Run the combined backend script:
   ```bash
   python backend_app.py
   ```

### 3. Exposing to Internet (Ngrok)
1. Run ngrok:
   ```bash
   ngrok http 8000
   ```
2. Copy the `https://...` URL and update the `WEB_APP_URL` env var or code.

### 4. Telegram Configuration
1. Go to @BotFather.
2. Use `/setwebapp` to link your bot to the Ngrok URL.
