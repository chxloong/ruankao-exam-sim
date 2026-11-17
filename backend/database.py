"""SQLite 连接与建表（与原 Node 版 schema 完全一致，沿用同一个数据库文件）"""
import sqlite3
import sys
from contextlib import contextmanager
from pathlib import Path


def _data_dir() -> Path:
    """开发模式：backend/data；打包为 exe 后：exe 同级的 data 目录（便携式数据）"""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent / "data"
    return Path(__file__).resolve().parent / "data"


DATA_DIR = _data_dir()
DB_PATH = DATA_DIR / "app.db"


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db_scope():
    """请求级连接：用完提交并关闭"""
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  type TEXT NOT NULL CHECK (type IN ('single','multiple','text')),
  stem TEXT NOT NULL,
  options TEXT,
  answer TEXT,
  answer_text TEXT,
  analysis TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS papers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 150,
  pass_score REAL NOT NULL DEFAULT 45,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS paper_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  section TEXT NOT NULL DEFAULT '综合知识',
  sort INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exam_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  paper_id INTEGER NOT NULL REFERENCES papers(id),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted')),
  started_at TEXT NOT NULL,
  submitted_at TEXT,
  answers TEXT NOT NULL DEFAULT '[]',
  scores TEXT,
  total_score REAL,
  self_scored INTEGER NOT NULL DEFAULT 0
);
"""


def init_schema() -> None:
    with db_scope() as conn:
        conn.executescript(SCHEMA)
