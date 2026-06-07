import os
import sys
from pathlib import Path

# Point the app at a throw-away SQLite file BEFORE any backend module is imported,
# so config.Settings() reads it instead of the real Postgres URL.
os.environ["DATABASE_URL"] = "sqlite:///./pytest_test.db"
os.environ.setdefault("JWT_SECRET", "pytest-secret")
os.environ.setdefault("APP_ENV", "development")

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient

from database import Base, engine
from main import app


@pytest.fixture(autouse=True)
def _fresh_schema():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)
