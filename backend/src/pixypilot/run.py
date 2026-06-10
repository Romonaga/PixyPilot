import uvicorn

from pixypilot.config import backend_host, backend_port, reload_enabled


def main() -> None:
    uvicorn.run(
        "pixypilot.main:app",
        host=backend_host(),
        port=backend_port(),
        reload=reload_enabled(),
    )


if __name__ == "__main__":
    main()
