import os
import tempfile
from pathlib import Path

# Must precede application imports; every test run owns its isolated DB.
_TEMP = tempfile.TemporaryDirectory(prefix="bountyscope-tests-")
os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(_TEMP.name) / "tests.db")
os.environ["API_TOKEN"] = "test-api-token"
os.environ["AI_ENABLED"] = "false"

import pytest  # noqa: E402

from app import models  # noqa: E402, F401
from app.core.database import Base, engine  # noqa: E402


@pytest.fixture(autouse=True)
def clean_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
