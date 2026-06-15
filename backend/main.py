from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List
import logging
import os

from . import models, schemas, database

# Set up audit logger
audit_logger = logging.getLogger("audit")
audit_logger.setLevel(logging.INFO)
audit_handler = logging.FileHandler(os.path.join(os.path.dirname(__file__), "audit.log"))
audit_handler.setFormatter(logging.Formatter('[%(asctime)s] %(message)s'))
audit_logger.addHandler(audit_handler)

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    db = database.SessionLocal()
    folders = db.query(models.Folder).all()
    if not folders:
        db.add(models.Folder(name="Folder 1"))
        db.add(models.Folder(name="Folder 2"))
        db.commit()
    db.close()

@app.get("/api/folders/", response_model=List[schemas.Folder])
def read_folders(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return db.query(models.Folder).offset(skip).limit(limit).all()

@app.post("/api/folders/", response_model=schemas.Folder)
def create_folder(folder: schemas.FolderCreate, db: Session = Depends(database.get_db)):
    db_folder = models.Folder(name=folder.name)
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

@app.put("/api/folders/{folder_id}", response_model=schemas.Folder)
def update_folder(folder_id: int, folder: schemas.FolderCreate, db: Session = Depends(database.get_db)):
    db_folder = db.query(models.Folder).filter(models.Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    db_folder.name = folder.name
    db.commit()
    db.refresh(db_folder)
    return db_folder

@app.delete("/api/folders/{folder_id}")
def delete_folder(folder_id: int, db: Session = Depends(database.get_db)):
    db_folder = db.query(models.Folder).filter(models.Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    task_count = db.query(models.Task).filter(models.Task.folder_id == folder_id).count()
    audit_logger.info(f'DELETED FOLDER: "{db_folder.name}" (ID: {db_folder.id}) including {task_count} tasks')
    
    db.delete(db_folder)
    db.commit()
    return {"message": "Folder deleted"}

@app.get("/api/tasks/", response_model=List[schemas.Task])
def read_tasks(skip: int = 0, limit: int = 1000, db: Session = Depends(database.get_db)):
    return db.query(models.Task).offset(skip).limit(limit).all()

@app.get("/api/tasks/inbox", response_model=List[schemas.Task])
def read_inbox_tasks(db: Session = Depends(database.get_db)):
    return db.query(models.Task).filter(models.Task.folder_id == None).order_by(models.Task.sort_order).all()

@app.get("/api/tasks/folder/{folder_id}", response_model=List[schemas.Task])
def read_tasks_by_folder(folder_id: int, db: Session = Depends(database.get_db)):
    return db.query(models.Task).filter(models.Task.folder_id == folder_id).order_by(models.Task.sort_order).all()

@app.post("/api/tasks/", response_model=schemas.Task)
def create_task(task: schemas.TaskCreate, db: Session = Depends(database.get_db)):
    max_order = db.query(models.Task).filter(models.Task.folder_id == task.folder_id).order_by(models.Task.sort_order.desc()).first()
    next_order = (max_order.sort_order + 1) if max_order else 0
    db_task = models.Task(**task.dict(exclude={'sort_order'}), sort_order=next_order)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.put("/api/tasks/{task_id}", response_model=schemas.Task)
def update_task(task_id: int, task: schemas.TaskUpdate, db: Session = Depends(database.get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    update_data = task.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task, key, value)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(database.get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    audit_logger.info(f'DELETED TASK: "{db_task.title}" (ID: {db_task.id}) from folder ID {db_task.folder_id}')
    
    db.delete(db_task)
    db.commit()
    return {"message": "Task deleted"}

@app.post("/api/tasks/reorder")
def reorder_tasks(reorders: List[schemas.TaskReorder], db: Session = Depends(database.get_db)):
    for reorder in reorders:
        db_task = db.query(models.Task).filter(models.Task.id == reorder.task_id).first()
        if db_task:
            db_task.sort_order = reorder.new_sort_order
    db.commit()
    return {"message": "Tasks reordered"}

# Mount frontend
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
