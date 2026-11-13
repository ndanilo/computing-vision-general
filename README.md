# computational-vision-studies

A collection of studies, experiments, and small projects, mostly about **computer vision**.

Most studies are written in **Python** (image processing, model training and inference). Some have a **Node.js** UI application on top for visualizing results or interacting with the models.

> These are learning projects. Expect experiments, prototypes, and work-in-progress code, not production-ready libraries.

## Topics

These are the areas covered, or planned:

- Image processing fundamentals (filtering, thresholding, edge detection, morphology)
- Feature detection and matching
- Object detection and tracking
- Image classification and segmentation
- Face and pose detection
- Real-time video processing (webcam and stream input)
- Web UIs for visualizing and interacting with vision models

## Tech stack

**Python**

- [OpenCV](https://opencv.org/)
- [NumPy](https://numpy.org/)
- [PyTorch](https://pytorch.org/) / [TensorFlow](https://www.tensorflow.org/)
- [Ultralytics YOLO](https://docs.ultralytics.com/)
- [MediaPipe](https://developers.google.com/mediapipe)
- [Jupyter](https://jupyter.org/) notebooks for exploration

**Node.js / UI**

- [Node.js](https://nodejs.org/)
- React / Vite (or similar) frontends
- REST or WebSocket communication with the Python backends

## Repository structure

Each study lives in its own folder and is self-contained, with its own README, dependencies, and instructions.

```
computational-vision-studies/
├── <study-name>/
│   ├── README.md          # What the study is about and how to run it
│   ├── python/            # Python code (scripts, notebooks, models)
│   │   └── requirements.txt
│   └── ui/                # Node.js UI application (optional)
│       └── package.json
└── README.md
```

## Studies

| Study | Description | Stack |
| ----- | ----------- | ----- |
| _coming soon_ | | |

## Getting started

### Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- Git

### Clone

```bash
git clone <repository-url>
cd computational-vision-studies
```

### Running a Python study

```bash
cd <study-name>/python
python -m venv .venv

# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
python main.py
```

### Running a Node UI

```bash
cd <study-name>/ui
npm install
npm run dev
```

Check each study's own README for specific instructions, datasets, and model weights.

## Datasets and models

Large datasets and model weights are **not** committed to this repository. Each study's README explains where to download what it needs.

## License

This project is for educational purposes. Add a license (for example, MIT) if you plan to share or reuse the code.
