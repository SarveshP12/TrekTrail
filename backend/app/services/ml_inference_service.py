import onnxruntime as ort
import os
import json
import sys
from enum import Enum
from pydantic import BaseModel, ConfigDict
from typing import List, Dict, Any, Optional
from datetime import datetime

# Add ml package to sys path so we can import feature extractor
_ML_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ml"))
if _ML_DIR not in sys.path:
    sys.path.append(_ML_DIR)

try:
    from training.feature_extractor import extract_window_features, GPSPoint

    _HAVE_FEATURE_EXTRACTOR = True
except ImportError as e:
    print(f"Warning: Could not import ml.training.feature_extractor: {e}")
    _HAVE_FEATURE_EXTRACTOR = False

# Configure models directory
MODELS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "../../ml/models"
)
MODEL_PATH = os.environ.get(
    "ML_MODEL_PATH", os.path.join(MODELS_DIR, "activity_classifier_v1.onnx")
)
METADATA_PATH = os.path.join(MODELS_DIR, "model_metadata.json")


class ActivityType(str, Enum):
    IDLE = "IDLE"
    WALKING = "WALKING"
    TREKKING = "TREKKING"
    RUNNING = "RUNNING"
    CYCLING = "CYCLING"
    UNKNOWN = "UNKNOWN"


class MLModelInfo(BaseModel):
    version: str
    updated_at: str
    accuracy: float
    features: List[str]


class MLInferenceResult(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    activity: ActivityType
    confidence: float
    model_version: str


class MLInferenceService:
    """
    On-server ML inference service using ONNX format of the XGBoost classifier.
    Used for clients that prefer to offload computation to the server.
    """

    _session: Optional[ort.InferenceSession] = None
    _metadata: Dict[str, Any] = {}

    @classmethod
    async def initialize(cls):
        """Load the model and metadata into memory."""
        try:
            # Load metadata
            if os.path.exists(METADATA_PATH):
                with open(METADATA_PATH, "r") as f:
                    cls._metadata = json.load(f)
            else:
                cls._metadata = {"version": "unknown", "accuracy": 0.0, "features": []}

            # Load ONNX model
            if os.path.exists(MODEL_PATH):
                cls._session = await ort.InferenceSession.create(MODEL_PATH)
                print(f"Loaded ML model from {MODEL_PATH}")
            else:
                print(
                    f"Warning: ML model not found at {MODEL_PATH}. Inference will return UNKNOWN."
                )

        except Exception as e:
            print(f"Failed to initialize ML Service: {e}")
            cls._session = None

    @classmethod
    def get_model_info(cls) -> MLModelInfo:
        return MLModelInfo(
            version=cls._metadata.get("version", "v1.0"),
            updated_at=cls._metadata.get("updated_at", str(datetime.now())),
            accuracy=cls._metadata.get("accuracy", 0.85),
            features=cls._metadata.get("input_features", []),
        )

    @classmethod
    async def extract_and_predict(cls, raw_points: List[Any]) -> MLInferenceResult:
        """
        Takes raw GPS points, extracts features, and runs inference.
        raw_points: List of objects with attributes (timestamp, latitude, longitude, altitude, accuracy, speed, heading).
        """
        if not _HAVE_FEATURE_EXTRACTOR:
            # Fallback if no model/extractor available
            return MLInferenceResult(
                activity=ActivityType.UNKNOWN, confidence=0.0, model_version="no_extractor"
            )

        try:
            # Convert raw_points to GPSPoint format expected by feature_extractor
            points_for_extraction = [
                GPSPoint(
                    timestamp=p.timestamp,
                    latitude=p.latitude,
                    longitude=p.longitude,
                    altitude=getattr(p, "altitude", None),
                    accuracy=getattr(p, "accuracy", 10.0),
                    speed=getattr(p, "speed", None),
                    heading=getattr(p, "heading", None),
                )
                for p in raw_points
            ]

            features_array = extract_window_features(points_for_extraction)
            features = features_array.tolist()
            return await cls.predict_activity(features)
        except Exception as e:
            print(f"Extraction or inference error: {e}")
            return MLInferenceResult(
                activity=ActivityType.UNKNOWN, confidence=0.0, model_version="error"
            )

    @classmethod
    async def predict_activity(cls, features: List[float]) -> MLInferenceResult:
        """
        Predict activity based on sliding-window features.
        """
        # If no model loaded, or mismatched feature count
        if cls._session is None:
            return MLInferenceResult(
                activity=ActivityType.UNKNOWN, confidence=0.0, model_version="unknown"
            )

        try:
            # ONNX models from XGBoost typically expect a 2D float32 tensor
            # Assuming output[0] is the predicted class indices, output[1] is probabilities map
            label_idx = int(ort_outs[0][0])
            prob_map = ort_outs[1][0]
            confidence = float(prob_map.get(label_idx, 1.0))

            # Map index to ActivityType
            classes = [
                ActivityType.IDLE,
                ActivityType.WALKING,
                ActivityType.TREKKING,
                ActivityType.RUNNING,
                ActivityType.CYCLING,
            ]

            predicted_class = (
                classes[label_idx] if 0 <= label_idx < len(classes) else ActivityType.UNKNOWN
            )

            return MLInferenceResult(
                activity=predicted_class,
                confidence=confidence,
                model_version=cls._metadata.get("version", "unknown"),
            )

        except Exception as e:
            print(f"Inference error: {e}")
            return MLInferenceResult(
                activity=ActivityType.UNKNOWN, confidence=0.0, model_version="error"
            )


ml_inference_service = MLInferenceService()
