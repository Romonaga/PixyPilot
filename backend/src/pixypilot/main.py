from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from pixypilot.api.routes import router
from pixypilot.config import cors_origins, frontend_dist_path

app = FastAPI(title="PixyPilot API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


frontend_dist = frontend_dist_path()
frontend_index = frontend_dist / "index.html"
frontend_assets = frontend_dist / "assets"

if frontend_index.exists():
    if frontend_assets.exists():
        app.mount("/assets", StaticFiles(directory=frontend_assets), name="assets")

    @app.get("/")
    async def frontend_index_route() -> FileResponse:
        return FileResponse(frontend_index)

    @app.get("/{path:path}", include_in_schema=False)
    async def frontend_fallback(path: str) -> FileResponse:
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        return FileResponse(frontend_index)
