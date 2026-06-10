import os

import uvicorn

from pixypilot.config import backend_host, backend_port


def main() -> None:
    uvicorn.run(
        "pixypilot.main:app",
        host=backend_host(),
        port=backend_port(),
        reload=os.environ.get("PIXYPILOT_RELOAD", "").lower() in {"1", "true", "yes"},
    )


if __name__ == "__main__":
    main()
