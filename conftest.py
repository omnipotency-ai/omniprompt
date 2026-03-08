import sys
from pathlib import Path

# Ensure the project root is on sys.path so `from backend.models import ...` works
# without needing to set PYTHONPATH manually.
sys.path.insert(0, str(Path(__file__).resolve().parent))
