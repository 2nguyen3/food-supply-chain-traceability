from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, documents
from app.core.config import allowed_origins
from app.core.errors import register_error_handlers


def create_app(origins: list[str] | None = None) -> FastAPI:
    app = FastAPI(
        title="Food Supply Chain Traceability API",
        version="0.1.0"
    )

    register_error_handlers(app)

    origins = allowed_origins() if origins is None else origins
    if origins:  # chỉ origin của frontend (ALLOWED_ORIGIN); Bearer token nên không cần cookie/credentials
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type"],
            expose_headers=["X-Document-Sha256", "Content-Disposition"],
            allow_credentials=False,
            max_age=600,
        )

    app.include_router(auth.router)
    app.include_router(documents.router)

    @app.get("/health")
    def health_check():
        return {"status": "ok"}

    return app


app = create_app()
