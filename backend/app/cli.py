import argparse
import json
from dataclasses import dataclass

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import AuditLog, User


@dataclass(frozen=True)
class PromotionResult:
    status: str
    email: str
    user_id: str | None = None

    def public_dict(self) -> dict[str, str | None]:
        return {"status": self.status, "email": self.email, "user_id": self.user_id}


def normalize_email(email: str) -> str:
    try:
        return str(TypeAdapter(EmailStr).validate_python(email)).lower()
    except ValidationError as exc:
        raise ValueError("Invalid email address") from exc


def promote_admin(email: str, db: Session) -> PromotionResult:
    normalized_email = normalize_email(email)
    user = db.query(User).filter(User.email == normalized_email).one_or_none()
    if user is None:
        return PromotionResult(status="not_found", email=normalized_email)
    if user.role == "admin":
        return PromotionResult(status="already_admin", email=normalized_email, user_id=user.id)
    user.role = "admin"
    db.add(
        AuditLog(
            user_id=user.id,
            action="admin.promoted",
            data={"target_user_id": user.id, "email": user.email, "source": "cli"},
        )
    )
    db.commit()
    return PromotionResult(status="promoted", email=normalized_email, user_id=user.id)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="NOVA operational CLI")
    subcommands = parser.add_subparsers(dest="command", required=True)
    promote = subcommands.add_parser("promote-admin", help="Promote an existing user to admin")
    promote.add_argument("--email", required=True, help="Existing user email address")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "promote-admin":
        db = SessionLocal()
        try:
            result = promote_admin(args.email, db)
        except ValueError as exc:
            print(json.dumps({"status": "invalid_input", "message": str(exc)}))
            return 2
        finally:
            db.close()
        print(json.dumps(result.public_dict()))
        return 1 if result.status == "not_found" else 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
