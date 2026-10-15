"""Enforce append-only audit events at the database boundary.

Revision ID: 9b3d24c1e012
Revises: 6cf0d6322aea
"""

from alembic import op

revision = "9b3d24c1e012"
down_revision = "6cf0d6322aea"
branch_labels = None
depends_on = None


def upgrade():
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute("""CREATE FUNCTION reject_scan_event_mutation() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'Scan events are append-only'; END;
        $$ LANGUAGE plpgsql""")
        op.execute("""CREATE TRIGGER immutable_scan_events BEFORE UPDATE OR DELETE ON scan_events
        FOR EACH ROW EXECUTE FUNCTION reject_scan_event_mutation()""")
    elif dialect == "sqlite":
        for action in ("UPDATE", "DELETE"):
            op.execute(f"""CREATE TRIGGER immutable_scan_events_{action.lower()} BEFORE {action} ON scan_events
            BEGIN SELECT RAISE(ABORT, 'Scan events are append-only'); END""")


def downgrade():
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute("DROP TRIGGER immutable_scan_events ON scan_events")
        op.execute("DROP FUNCTION reject_scan_event_mutation()")
    elif dialect == "sqlite":
        op.execute("DROP TRIGGER immutable_scan_events_update")
        op.execute("DROP TRIGGER immutable_scan_events_delete")
