const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const captureCanvas = document.getElementById("capture");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("detection-list");
const btnStart = document.getElementById("btn-start");
const btnStop = document.getElementById("btn-stop");
const btnSwitch = document.getElementById("btn-switch");

const MAX_FRAME_WIDTH = 640;
const JPEG_QUALITY = 0.7;

let stream = null;
let facingMode = "environment";
let socket = null;
let running = false;
let awaitingResponse = false;
let frameCount = 0;
let fpsWindowStart = performance.now();
let lastInferenceMs = 0;

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function resizeOverlay() {
  const rect = video.getBoundingClientRect();
  overlay.width = rect.width * devicePixelRatio;
  overlay.height = rect.height * devicePixelRatio;
  const ctx = overlay.getContext("2d");
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

function clearOverlay() {
  const ctx = overlay.getContext("2d");
  ctx.clearRect(0, 0, overlay.width, overlay.height);
}

function drawDetections(detections) {
  resizeOverlay();
  const ctx = overlay.getContext("2d");
  const w = video.clientWidth;
  const h = video.clientHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 2;
  ctx.font = "14px system-ui, sans-serif";

  for (const det of detections) {
    const [x1n, y1n, x2n, y2n] = det.box;
    const x1 = x1n * w;
    const y1 = y1n * h;
    const x2 = x2n * w;
    const y2 = y2n * h;
    const width = x2 - x1;
    const height = y2 - y1;

    ctx.strokeStyle = "#4ade80";
    ctx.strokeRect(x1, y1, width, height);

    const label = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
    const metrics = ctx.measureText(label);
    const pad = 4;
    ctx.fillStyle = "rgba(15, 20, 25, 0.75)";
    ctx.fillRect(x1, y1 - 20, metrics.width + pad * 2, 20);
    ctx.fillStyle = "#e8ecf1";
    ctx.fillText(label, x1 + pad, y1 - 6);
  }
}

function renderDetectionList(detections) {
  listEl.replaceChildren();
  if (!detections.length) {
    const li = document.createElement("li");
    li.textContent = "No objects detected";
    listEl.appendChild(li);
    return;
  }
  for (const det of detections) {
    const li = document.createElement("li");
    li.textContent = `${det.label} — ${(det.confidence * 100).toFixed(1)}%`;
    listEl.appendChild(li);
  }
}

function updateFps() {
  frameCount += 1;
  const now = performance.now();
  const elapsed = now - fpsWindowStart;
  if (elapsed >= 1000) {
    const fps = (frameCount * 1000) / elapsed;
    setStatus(
      `FPS: ${fps.toFixed(1)} · inference: ${lastInferenceMs.toFixed(1)} ms`
    );
    frameCount = 0;
    fpsWindowStart = now;
  }
}

function stopCamera() {
  if (stream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
    stream = null;
  }
  video.srcObject = null;
}

function closeSocket() {
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
}

function captureAndSend() {
  if (!running || !socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  if (awaitingResponse || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    requestAnimationFrame(captureAndSend);
    return;
  }

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) {
    requestAnimationFrame(captureAndSend);
    return;
  }

  const scale = Math.min(1, MAX_FRAME_WIDTH / vw);
  const cw = Math.round(vw * scale);
  const ch = Math.round(vh * scale);
  captureCanvas.width = cw;
  captureCanvas.height = ch;
  const ctx = captureCanvas.getContext("2d");
  ctx.drawImage(video, 0, 0, cw, ch);

  captureCanvas.toBlob(
    (blob) => {
      if (!blob || !running || !socket || socket.readyState !== WebSocket.OPEN) {
        requestAnimationFrame(captureAndSend);
        return;
      }
      awaitingResponse = true;
      blob.arrayBuffer().then((buffer) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(buffer);
        } else {
          awaitingResponse = false;
        }
        requestAnimationFrame(captureAndSend);
      });
    },
    "image/jpeg",
    JPEG_QUALITY
  );
}

async function openCamera() {
  stopCamera();
  const constraints = {
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      setStatus("Camera permission denied.", true);
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      setStatus("No camera found on this device.", true);
    } else {
      setStatus(`Could not open camera: ${err.message}`, true);
    }
    throw err;
  }
  video.srcObject = stream;
  await video.play();
  resizeOverlay();
  window.addEventListener("resize", resizeOverlay);
}

function connectSocket() {
  return new Promise((resolve, reject) => {
    socket = new WebSocket(wsUrl());
    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
      setStatus("Connected. Streaming frames…");
      resolve();
    };

    socket.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        awaitingResponse = false;
        return;
      }
      awaitingResponse = false;
      lastInferenceMs = payload.inference_ms ?? 0;
      const detections = payload.detections ?? [];
      drawDetections(detections);
      renderDetectionList(detections);
      updateFps();
    };

    socket.onerror = () => {
      setStatus("WebSocket error.", true);
      reject(new Error("WebSocket error"));
    };

    socket.onclose = () => {
      if (running) {
        setStatus("Connection closed.", true);
        stopSession();
      }
    };
  });
}

async function startSession() {
  btnStart.disabled = true;
  try {
    await openCamera();
    await connectSocket();
    running = true;
    btnStop.disabled = false;
    btnSwitch.disabled = false;
    frameCount = 0;
    fpsWindowStart = performance.now();
    requestAnimationFrame(captureAndSend);
  } catch {
    btnStart.disabled = false;
    closeSocket();
    stopCamera();
  }
}

function stopSession() {
  running = false;
  awaitingResponse = false;
  closeSocket();
  stopCamera();
  window.removeEventListener("resize", resizeOverlay);
  clearOverlay();
  listEl.replaceChildren();
  btnStart.disabled = false;
  btnStop.disabled = true;
  btnSwitch.disabled = true;
  if (!statusEl.classList.contains("error")) {
    setStatus("Stopped");
  }
}

btnStart.addEventListener("click", () => {
  startSession();
});

btnStop.addEventListener("click", () => {
  stopSession();
  setStatus("Stopped");
});

btnSwitch.addEventListener("click", async () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  if (!running) {
    return;
  }
  try {
    await openCamera();
  } catch {
    stopSession();
  }
});

if (
  location.hostname !== "localhost" &&
  location.hostname !== "127.0.0.1" &&
  location.protocol !== "https:"
) {
  const hint = document.getElementById("https-hint");
  if (hint) {
    hint.hidden = false;
  }
}
