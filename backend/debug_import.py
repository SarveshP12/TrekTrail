import os
import sys

print(f"CWD: {os.getcwd()}")
sys.path.insert(0, os.getcwd())
print(f"Path: {sys.path}")
try:
    print("Import app SUCCESS")

    print("Import settings SUCCESS")
except Exception as e:
    print(f"Import FAILED: {e}")
