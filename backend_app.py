
"""
INSTRUCTIONS TO RUN:
1. Install dependencies: pip install fastapi uvicorn aiogram sqlalchemy psycopg2-binary
2. Set environment variables:
   export BOT_TOKEN='your_telegram_bot_token'
   export DATABASE_URL='postgresql://user:password@localhost:5432/quiz_db'
3. Run: python backend_app.py
"""

import os
import asyncio
import random
import logging
from typing import List, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, BigInteger
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import OperationalError

from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton

# --- LOGGING SETUP ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- DATABASE SETUP (PostgreSQL) ---
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/quiz_db")

# Ba'zi cloud platformalar 'postgres://' beradi, SQLAlchemy 'postgresql://' talab qiladi
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

try:
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base = declarative_base()
except Exception as e:
    logger.error(f"DATABASE CONNECTION ERROR: {e}")
    raise

class DBUser(Base):
    __tablename__ = "users"
    user_id = Column(BigInteger, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class DBWord(Base):
    __tablename__ = "words"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id"))
    en = Column(String)
    uz = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class DBStats(Base):
    __tablename__ = "stats"
    user_id = Column(BigInteger, primary_key=True)
    correct_count = Column(Integer, default=0)
    wrong_count = Column(Integer, default=0)
    streak = Column(Integer, default=0)
    best_streak = Column(Integer, default=0)

# Jadvallarni yaratish
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables synced successfully.")
except OperationalError as e:
    logger.error("Could not connect to PostgreSQL. Make sure the database exists and credentials are correct.")
    # Production-da bu yerda to'xtatish yoki local db ga o'tish mantiqi bo'lishi mumkin

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- SCHEMAS ---
class WordCreate(BaseModel):
    user_id: int
    en: str
    uz: str

class WordResponse(BaseModel):
    id: int
    en: str
    uz: str

class AnswerRequest(BaseModel):
    user_id: int
    is_correct: bool

# --- FASTAPI APP ---
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/words")
def add_word(word: WordCreate, db: Session = Depends(get_db)):
    user = db.query(DBUser).filter(DBUser.user_id == word.user_id).first()
    if not user:
        user = DBUser(user_id=word.user_id)
        db.add(user)
        db.commit()
    
    db_word = DBWord(user_id=word.user_id, en=word.en, uz=word.uz)
    db.add(db_word)
    db.commit()
    db.refresh(db_word)
    return {"status": "ok", "id": db_word.id}

@app.get("/api/words/list", response_model=List[WordResponse])
def list_words(user_id: int, db: Session = Depends(get_db)):
    return db.query(DBWord).filter(DBWord.user_id == user_id).order_by(DBWord.created_at.desc()).all()

@app.delete("/api/words/{word_id}")
def delete_word(word_id: int, user_id: int, db: Session = Depends(get_db)):
    db_word = db.query(DBWord).filter(DBWord.id == word_id, DBWord.user_id == user_id).first()
    if not db_word:
        raise HTTPException(status_code=404, detail="So'z topilmadi")
    db.delete(db_word)
    db.commit()
    return {"status": "deleted"}

@app.get("/api/stats")
def get_stats(user_id: int, db: Session = Depends(get_db)):
    stats = db.query(DBStats).filter(DBStats.user_id == user_id).first()
    word_count = db.query(DBWord).filter(DBWord.user_id == user_id).count()
    if not stats:
        return {"correct": 0, "wrong": 0, "streak": 0, "bestStreak": 0, "totalWords": word_count}
    return {
        "correct": stats.correct_count,
        "wrong": stats.wrong_count,
        "streak": stats.streak,
        "best_streak": stats.best_streak,
        "totalWords": word_count
    }

@app.post("/api/quiz/answer")
def submit_answer(req: AnswerRequest, db: Session = Depends(get_db)):
    stats = db.query(DBStats).filter(DBStats.user_id == req.user_id).first()
    if not stats:
        stats = DBStats(user_id=req.user_id)
        db.add(stats)
    
    if req.is_correct:
        stats.correct_count += 1
        stats.streak += 1
        if stats.streak > stats.best_streak:
            stats.best_streak = stats.streak
    else:
        stats.wrong_count += 1
        stats.streak = 0
    
    db.commit()
    db.refresh(stats)
    
    word_count = db.query(DBWord).filter(DBWord.user_id == req.user_id).count()
    return {
        "correct": stats.correct_count,
        "wrong": stats.wrong_count,
        "streak": stats.streak,
        "bestStreak": stats.best_streak,
        "totalWords": word_count
    }

# --- TELEGRAM BOT ---
BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_TOKEN_HERE")
WEB_APP_URL = os.getenv("WEB_APP_URL", "https://your-ngrok-url.ngrok-free.app")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🚀 Ilovani ochish", web_app=WebAppInfo(url=WEB_APP_URL))]
    ])
    
    await message.answer(
        "Xush kelibsiz! **ProSkill English Quiz** botiga a'zo bo'ldingiz. 📚\n\n"
        "O'zingiz so'z qo'shing va o'sha so'zlar bo'yicha test ishlang.\n"
        "Boshlash uchun pastdagi tugmani bosing!",
        parse_mode="Markdown",
        reply_markup=kb
    )

async def main_bot():
    logger.info("Bot polling starting...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    import uvicorn
    from multiprocessing import Process

    def run_fastapi():
        logger.info("FastAPI starting...")
        uvicorn.run(app, host="0.0.0.0", port=8000)

    p = Process(target=run_fastapi)
    p.start()
    
    asyncio.run(main_bot())
