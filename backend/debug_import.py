import sys
import os
print(f"CWD: {os.getcwd()}")
sys.path.insert(0, os.getcwd())
print(f"Path: {sys.path}")
try:
    import app
    print("Import app SUCCESS")
    from app.config import settings
    print("Import settings SUCCESS")
except Exception as e:
    print(f"Import FAILED: {e}")
