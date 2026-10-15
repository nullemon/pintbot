from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import DatabaseError

from alembic import command
from app.core.config import settings


def test_migrations_roundtrip_and_database_audit_boundary(tmp_path, monkeypatch):
    url = "sqlite:///" + str(tmp_path / "migrated.db")
    monkeypatch.setattr(settings, "database_url", url)
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, "head")
    command.check(config)
    engine = create_engine(url)
    assert {"projects", "scan_events", "evidence", "reports"} <= set(
        inspect(engine).get_table_names()
    )
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO scan_events (id, scan_id, kind, data, created_at) VALUES ('event','scan','scope_check','{}',CURRENT_TIMESTAMP)"
            )
        )
    for sql in ("UPDATE scan_events SET kind='tamper'", "DELETE FROM scan_events"):
        with pytest.raises(DatabaseError), engine.begin() as connection:
            connection.execute(text(sql))
    command.downgrade(config, "base")
    assert inspect(engine).get_table_names() == ["alembic_version"]
    command.upgrade(config, "head")
    command.check(config)
    engine.dispose()
