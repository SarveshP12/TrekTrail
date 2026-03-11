# ML Workspace — TrekTrack AI

This workspace contains the machine learning training pipelines and model artifacts for TrekTrack AI.

## Structure

```
ml/
├── notebooks/      # Jupyter notebooks for exploration and training
├── data/           # Raw and processed datasets (.gitignored)
├── models/         # Trained model artifacts (.gitignored)
└── requirements.txt
```

## Setup

```bash
cd ml
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

## Launch Jupyter

```bash
jupyter lab
```

## Models (Future Phases)

- **Activity Classifier** — XGBoost model to classify trek activity (walk, run, rest)
- **TFLite Export** — On-device inference model for mobile
