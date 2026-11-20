"""enforce one confirmed task per conversation

Revision ID: 0003_task_idempotency
Revises: 0002_add_user_role
Create Date: 2026-11-17
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003_task_idempotency"
down_revision: str | None = "0002_add_user_role"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint("uq_tasks_conversation_id", "tasks", ["conversation_id"])


def downgrade() -> None:
    op.drop_constraint("uq_tasks_conversation_id", "tasks", type_="unique")
