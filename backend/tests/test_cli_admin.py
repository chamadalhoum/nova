from app.cli import main, promote_admin
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import AuditLog, User


def create_user(email: str, role: str = "user") -> str:
    db = SessionLocal()
    try:
        user = User(email=email, password_hash=hash_password("secretpass123"), full_name="CLI User", role=role)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.id
    finally:
        db.close()


def test_promote_existing_user_to_admin():
    user_id = create_user("promote@example.com")
    db = SessionLocal()
    try:
        result = promote_admin("promote@example.com", db)
        assert result.status == "promoted"
        assert result.user_id == user_id
        assert db.get(User, user_id).role == "admin"
        audit = db.query(AuditLog).filter(AuditLog.action == "admin.promoted").one()
        assert audit.data["target_user_id"] == user_id
        assert "password" not in str(audit.data).lower()
        assert "token" not in str(audit.data).lower()
    finally:
        db.close()


def test_new_users_default_to_normal_role():
    user_id = create_user("normal-role@example.com")
    db = SessionLocal()
    try:
        assert db.get(User, user_id).role == "user"
    finally:
        db.close()


def test_promote_already_admin_user_is_idempotent():
    user_id = create_user("already-admin@example.com", role="admin")
    db = SessionLocal()
    try:
        result = promote_admin("already-admin@example.com", db)
        assert result.status == "already_admin"
        assert result.user_id == user_id
        assert db.query(AuditLog).filter(AuditLog.action == "admin.promoted").count() == 0
    finally:
        db.close()


def test_promote_unknown_user_is_safe():
    db = SessionLocal()
    try:
        result = promote_admin("missing@example.com", db)
        assert result.status == "not_found"
        assert result.user_id is None
    finally:
        db.close()


def test_promote_invalid_input_exits_without_leakage(capsys):
    exit_code = main(["promote-admin", "--email", "not-an-email"])
    captured = capsys.readouterr().out
    assert exit_code == 2
    assert "invalid_input" in captured
    assert "password" not in captured.lower()
    assert "token" not in captured.lower()


def test_cli_promote_output_excludes_passwords_and_tokens(capsys):
    user_id = create_user("cli-promote@example.com")
    exit_code = main(["promote-admin", "--email", "cli-promote@example.com"])
    captured = capsys.readouterr().out
    assert exit_code == 0
    assert "promoted" in captured
    assert user_id in captured
    assert "password" not in captured.lower()
    assert "token" not in captured.lower()
