import os
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{ROOT_DIR / 'modelforge.db'}")
DATASET_DIR = Path(os.getenv("DATASET_DIR", ROOT_DIR.parent / "datasets")).resolve()
DATASET_DIR.mkdir(parents=True, exist_ok=True)
MAX_DATASET_BYTES = 25 * 1024 * 1024
