import asyncio
import json
import sys
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="FixSight Scene Analysis API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-load detector so the server still starts and can report health even
# when the API key is missing — the error surfaces per-request, not at boot.
_detector = None

def get_detector():
    global _detector
    if _detector is None:
        from detector import HazardDetector
        _detector = HazardDetector()
    return _detector


@app.get("/")
def health():
    try:
        d = get_detector()
        return {"status": "running", "service": "FixSight Scene Analysis", "model": d.model}
    except EnvironmentError as e:
        return {"status": "degraded", "error": str(e)}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        # Validate detector on first connection — send clear error to client
        try:
            detector = get_detector()
        except EnvironmentError as e:
            await websocket.send_json({
                "event": "error",
                "message": str(e),
                "code": "MISSING_API_KEY",
            })
            await websocket.close()
            return

        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if payload.get("event") != "scene_frame_ready":
                continue

            print(f"\n[Backend] 📸 Received image frame from phone! (Size: {len(payload.get('full_frame_b64', ''))} bytes)")
            print("[Backend] 🧠 Sending image to Groq VLM for analysis...")

            result = await asyncio.to_thread(
                detector.analyze_scene,
                payload["full_frame_b64"],
                payload.get("hazard_focus_bbox", []),
                payload.get("session_id", "default"),
                payload.get("device_context", {}),
            )
            
            print(f"[Backend] ✅ Analysis Complete! Found: {result.get('primary_hazard')}")
            print(f"[Backend] 📡 Sending solutions back to phone...")
            await websocket.send_json(result)
    except WebSocketDisconnect:
        print("\n[Backend] Phone disconnected from WebSocket.")
    except Exception as e:
        await websocket.send_json({"event": "error", "message": str(e)})


@app.post("/reset")
def reset():
    if _detector:
        _detector.sessions.clear()
    return {"status": "ok"}