import kagglehub
import shutil
import os

# Target directory
target_dir = os.path.join(os.path.dirname(__file__), "data", "raw", "geolife")
os.makedirs(target_dir, exist_ok=True)

print("Downloading dataset via kagglehub...")
# Download latest version to default cache
try:
    path = kagglehub.dataset_download("arashnic/microsoft-geolife-gps-trajectory-dataset")
    print(f"Dataset downloaded to cache: {path}")
    print(f"Moving dataset to: {target_dir}")

    # Move/Copy logic
    for item in os.listdir(path):
        s = os.path.join(path, item)
        d = os.path.join(target_dir, item)
        
        # Remove target if exists to avoid errors on retry
        if os.path.isdir(s):
            if os.path.exists(d):
                shutil.rmtree(d)
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)

    print(f"\nDownload and move complete! Data is available at:\n{target_dir}")
except Exception as e:
    print(f"Error downloading dataset: {e}")
