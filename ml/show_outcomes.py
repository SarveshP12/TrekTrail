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

# Load extracted features
data = np.load("data/activity_features_combined.npz")
X = data["X"]
y = data["y"]

# Randomly select 10 samples
np.random.seed(42)  # For reproducible results
indices = np.random.choice(len(X), 10, replace=False)
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
print(f"  TrekTrack AI - Activity Classifier Predictions")
print(f"{chr(61)*50}")
print(f"{'Actual':<15} | {'Predicted':<15} | {'Confidence'}")
print(f"{'-':-<15}-+-{'-':-<15}-+-{'-':-<15}")

for i in range(10):
    actual = labels[int(y_sample[i])]
    pred = labels[int(preds[i])]
    conf = probs[i, int(preds[i])] * 100

    match = "PASS" if actual == pred else "FAIL"
    print(f"{actual:<15} | {pred:<15} | {conf:5.1f}%   [{match}]")
print(f"{chr(61)*50}\n")
