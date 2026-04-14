import numpy as np

# Load real
real = np.load("data/activity_features.npz")
X_real, y_real = real["X"], real["y"]

# Load synthetic
syn = np.load("data/synthetic/activity_features.npz")
X_syn, y_syn = syn["X"], syn["y"]

# Combine
X_all = np.vstack([X_real, X_syn])
y_all = np.concatenate([y_real, y_syn])

# Save
np.savez("data/activity_features_combined.npz", X=X_all, y=y_all)
print("Combined shape:", X_all.shape)
