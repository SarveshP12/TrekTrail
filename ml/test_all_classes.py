import numpy as np
import xgboost as xgb
import json

# Load model, scaler, and metadata
model = xgb.Booster()
model.load_model("models/activity_classifier.xgb")

with open("models/activity_classifier_scaler.json") as f:
    scaler_params = json.load(f)

with open("models/activity_classifier_metadata.json") as f:
    metadata = json.load(f)

labels = metadata["class_labels"]
feature_names = metadata["feature_names"]

# Load extracted features
data = np.load("data/activity_features_combined.npz")
X = data["X"]
y = data["y"]

# Select 1 sample from each of the 5 classes
indices = []
for class_idx in range(len(labels)):
    class_indices = np.where(y == class_idx)[0]
    if len(class_indices) > 0:
        indices.append(np.random.choice(class_indices))

X_sample = X[indices]
y_sample = y[indices]

# Apply Standard Scaling as learned during training
mean = np.array(scaler_params["mean"])
scale = np.array(scaler_params["scale"])
X_scaled = (X_sample - mean) / scale

# Predict using XGBoost
dmatrix = xgb.DMatrix(X_scaled)
probs = model.predict(dmatrix)
preds = np.argmax(probs, axis=1)

print(f"\n{chr(61)*50}")
print("  TrekTrack AI - All Activities Prediction Test")
print(f"{chr(61)*50}")
print(f"{'Actual':<15} | {'Predicted':<15} | {'Confidence'}")
print(f"{'-':-<15}-+-{'-':-<15}-+-{'-':-<15}")

for i in range(len(indices)):
    actual = labels[int(y_sample[i])]
    pred = labels[int(preds[i])]
    conf = probs[i, int(preds[i])] * 100

    match = "PASS" if actual == pred else "FAIL"
    print(f"{actual:<15} | {pred:<15} | {conf:5.1f}%   [{match}]")

print(f"\n{chr(61)*50}")
print(
    "  Example Inputs taken for the first activity (" + labels[int(y_sample[0])] + ")"
)
print(f"{chr(61)*50}")
for j, feat_name in enumerate(feature_names):
    print(f"{feat_name:<20} : {X_sample[0][j]:.4f}")
print("\n")
