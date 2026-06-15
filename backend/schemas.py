from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    is_completed: bool = False
    sort_order: int = 0
    priority: int = 1

class TaskCreate(TaskBase):
    folder_id: Optional[int] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    is_completed: Optional[bool] = None
    folder_id: Optional[int] = None
    sort_order: Optional[int] = None
    priority: Optional[int] = None

class Task(TaskBase):
    id: int
    folder_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class FolderBase(BaseModel):
    name: str

class FolderCreate(FolderBase):
    pass

class Folder(FolderBase):
    id: int
    tasks: List[Task] = []

    class Config:
        from_attributes = True

class TaskReorder(BaseModel):
    task_id: int
    new_sort_order: int
