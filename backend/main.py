from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import Base, engine
from routers import admin, assets, auth, borrow

app = FastAPI(title="PRLab Asset System", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.app_env == "development" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # In production, prefer running `alembic upgrade head` instead.
    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def healthcheck():
    return {"status": "okay"}


app.include_router(auth.router)
app.include_router(assets.router)
app.include_router(borrow.router)
app.include_router(admin.router)
