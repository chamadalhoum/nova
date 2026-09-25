from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Task, TaskEvent

VALID_TRANSITIONS = {
    "DRAFT": {"NEEDS_INFO", "PLANNED", "IN_PROGRESS", "CANCELLED", "FAILED"},
    "NEEDS_INFO": {"PLANNED", "CANCELLED", "FAILED"},
    "PLANNED": {"SEARCHING", "WAITING_CONFIRMATION", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "FAILED"},
    "SEARCHING": {"WAITING_CONFIRMATION", "PLANNED", "CANCELLED", "FAILED"},
    "WAITING_CONFIRMATION": {"CONFIRMED", "PLANNED", "CANCELLED", "FAILED"},
    "CONFIRMED": {"IN_PROGRESS", "COMPLETED", "CANCELLED", "FAILED"},
    "IN_PROGRESS": {"COMPLETED", "CANCELLED", "FAILED"},
    "COMPLETED": set(),
    "CANCELLED": set(),
    "FAILED": set(),
}


def add_task_event(
    db: Session, task: Task, event_type: str, message: str, data: dict | None = None
) -> TaskEvent:
    event = TaskEvent(
        task_id=task.id,
        user_id=task.user_id,
        event_type=event_type,
        message=message,
        data=data or {},
    )
    db.add(event)
    return event


def transition_task(db: Session, task: Task, new_status: str, event_type: str, message: str) -> Task:
    allowed = VALID_TRANSITIONS.get(task.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This task cannot move from {task.status.lower()} to {new_status.lower()}.",
        )
    task.status = new_status
    add_task_event(db, task, event_type, message)
    db.flush()
    return task
