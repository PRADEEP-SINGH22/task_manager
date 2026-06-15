from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import relationship
import datetime

from .database import Base

class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    
    tasks = relationship("Task", back_populates="folder", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    is_completed = Column(Boolean, default=False)
    folder_id = Column(Integer, ForeignKey("folders.id"))
    deadline = Column(DateTime, nullable=True)
    sort_order = Column(Integer, default=0)
    priority = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    folder = relationship("Folder", back_populates="tasks")
