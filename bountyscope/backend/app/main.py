import secrets

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings


async def authenticate(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
):
    if settings.api_token:
        value = request.headers.get("authorization", "")
        if not secrets.compare_digest(value, "Bearer " + settings.api_token):
            raise HTTPException(401, "Valid API token required")


app = FastAPI(
    title="BountyScope", version="1.0.0", dependencies=[Depends(authenticate)], docs_url="/api/docs"
)


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return JSONResponse(
        {"error": {"code": exc.status_code, "message": exc.detail}}, status_code=exc.status_code
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse(
        {
            "error": {
                "code": 422,
                "message": "Invalid request",
                "fields": [{"loc": e["loc"], "msg": e["msg"]} for e in exc.errors()],
            }
        },
        status_code=422,
    )


@app.get("/api/health")
def health():
    from sqlalchemy import text

    from app.core.database import engine

    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}


from app.api.routes import router  # noqa: E402

app.include_router(router)
