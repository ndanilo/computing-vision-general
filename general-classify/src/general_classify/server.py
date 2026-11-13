from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO

STATIC_DIR = Path(__file__).parent / "static"

_model: YOLO | None = None


def _empty_response() -> dict:
    return {"detections": [], "inference_ms": 0.0}


def _decode_detections(result) -> list[dict]:
    if result.boxes is None or len(result.boxes) == 0:
        return []

    xyxyn = result.boxes.xyxyn.cpu().numpy()
    confs = result.boxes.conf.cpu().numpy()
    classes = result.boxes.cls.cpu().numpy().astype(int)
    names = result.names

    detections: list[dict] = []
    for index in range(len(xyxyn)):
        detections.append(
            {
                "label": names[int(classes[index])],
                "confidence": float(confs[index]),
                "box": xyxyn[index].tolist(),
            }
        )
    return detections


def _predict_frame(model: YOLO, frame: np.ndarray) -> tuple[list[dict], float]:
    started = time.perf_counter()
    results = model.predict(frame, conf=0.4, verbose=False)
    inference_ms = (time.perf_counter() - started) * 1000.0
    if not results:
        return [], inference_ms
    return _decode_detections(results[0]), inference_ms


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _model
    _model = YOLO("yolo26n.pt")
    try:
        yield
    finally:
        _model = None


app = FastAPI(lifespan=lifespan)


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.websocket("/ws")
async def websocket_detect(websocket: WebSocket) -> None:
    await websocket.accept()
    model = _model
    if model is None:
        await websocket.close(code=1011)
        return

    try:
        while True:
            data = await websocket.receive_bytes()
            if not data:
                await websocket.send_json(_empty_response())
                continue

            buffer = np.frombuffer(data, dtype=np.uint8)
            frame = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
            if frame is None:
                await websocket.send_json(_empty_response())
                continue

            detections, inference_ms = await asyncio.to_thread(
                _predict_frame, model, frame
            )
            await websocket.send_json(
                {
                    "detections": detections,
                    "inference_ms": round(inference_ms, 1),
                }
            )
    except WebSocketDisconnect:
        return
