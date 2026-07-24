import base64
from dataclasses import dataclass
from typing import Protocol

import cv2
import numpy as np
from fastapi import HTTPException, status

from app.core.config import get_settings


@dataclass(frozen=True)
class FaceVector:
    embedding: list[float]
    bbox: list[int]
    confidence: float
    model_name: str
    model_version: str


class FaceRecognitionProvider(Protocol):
    model_name: str
    model_version: str

    def extract(self, image_bytes: bytes) -> list[FaceVector]:
        ...

    def compare(self, probe: list[float], gallery: list[float]) -> float:
        ...


class InsightFaceArcFaceProvider:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.model_name = self.settings.face_model_name
        self.model_version = "insightface-arcface-onnxruntime"
        self._app = None

    def _load(self):
        if self._app is not None:
            return self._app
        try:
            from insightface.app import FaceAnalysis
        except ImportError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="InsightFace is not installed. Install backend requirements to enable recognition.",
            ) from exc
        providers = [self.settings.face_provider]
        self._app = FaceAnalysis(name=self.model_name, providers=providers)
        self._app.prepare(ctx_id=0, det_size=(self.settings.face_detection_size, self.settings.face_detection_size))
        return self._app

    def extract(self, image_bytes: bytes) -> list[FaceVector]:
        image = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(status_code=400, detail="Invalid image payload")
        faces = self._load().get(image)
        vectors: list[FaceVector] = []
        for face in faces:
            embedding = np.asarray(face.normed_embedding, dtype=np.float32)
            vectors.append(
                FaceVector(
                    embedding=embedding.tolist(),
                    bbox=[int(v) for v in face.bbox.tolist()],
                    confidence=float(getattr(face, "det_score", 0.0)),
                    model_name=self.model_name,
                    model_version=self.model_version,
                )
            )
        return vectors

    def compare(self, probe: list[float], gallery: list[float]) -> float:
        a = np.asarray(probe, dtype=np.float32)
        b = np.asarray(gallery, dtype=np.float32)
        denom = float(np.linalg.norm(a) * np.linalg.norm(b))
        if denom == 0:
            return 0.0
        return float(np.dot(a, b) / denom)


def decode_base64_image(image_base64: str) -> bytes:
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    try:
        return base64.b64decode(image_base64, validate=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Image must be a valid base64 string") from exc


def get_face_provider() -> FaceRecognitionProvider:
    return InsightFaceArcFaceProvider()
