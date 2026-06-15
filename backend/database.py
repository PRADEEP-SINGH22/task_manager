from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

import os

base_dir = os.path.dirname(os.path.abspath(__file__))
fallback_url = f"sqlite:///{os.path.join(base_dir, 'tasks.db')}"

SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", fallback_url)
# Render uses postgres:// but SQLAlchemy 1.4+ requires postgresql://
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
