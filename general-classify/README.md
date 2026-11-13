# general-classify

A small study app: your browser captures webcam (or phone camera) frames, sends JPEG over a WebSocket, and the FastAPI backend runs **Ultralytics YOLO26n** (`yolo26n.pt`) on each frame. The page draws bounding boxes and labels from normalized detection coordinates.

## What you learn

- Serving a static UI with FastAPI
- WebSocket binary frame streaming
- Offloading CPU/GPU inference with `asyncio.to_thread` so the event loop stays responsive
- Drawing YOLO boxes on a canvas overlay

## Prerequisites

- Python **3.14** (managed by [uv](https://docs.astral.sh/uv/))
- A webcam for desktop testing

## Run locally

```powershell
cd general-classify
uv sync
uv run general-classify
```

Open [http://localhost:8000](http://localhost:8000), click **Start**, and allow camera access.

On the **first run**, Ultralytics downloads `yolo26n.pt` into the working directory (gitignored). Inference runs on **CPU** by default unless you configure CUDA separately.

## Phone / HTTPS

The server binds to **127.0.0.1** only. To use a phone camera you typically expose the app through a tunnel or reverse proxy you control and serve it over **HTTPS** (browsers block camera access on insecure origins except localhost). This repository does not include tunnel or certificate setup.

## Project layout

- `src/general_classify/server.py` — FastAPI app, WebSocket inference
- `src/general_classify/static/` — HTML, CSS, and client JavaScript
