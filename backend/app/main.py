from fastapi import FastAPI

from app.api import auth
from app.core.errors import register_error_handlers

app = FastAPI(
    title="Food Supply Chain Traceability API",
    version="0.1.0"
)

register_error_handlers(app)
app.include_router(auth.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
