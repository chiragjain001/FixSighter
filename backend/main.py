import asyncio
import json
import sys
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Body
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

# Lazy-load detector — server starts and reports health even when API key is missing.
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

@app.post("/analyze_scene")
async def analyze_scene_http(payload: dict = Body(...)):
    print(f"\n[Backend] 📸 POST /analyze_scene (size: {len(payload.get('full_frame_b64', ''))} chars)")
    d = get_detector()
    result = await asyncio.to_thread(
        d.analyze_scene,
        payload.get("full_frame_b64", ""),
        payload.get("hazard_focus_bbox", []),
        payload.get("session_id", "default"),
        payload.get("device_context", {}),
    )
    return result

@app.post("/analyze_chat")
async def analyze_chat_http(payload: dict = Body(...)):
    print(f"\n[Backend] 💬 POST /analyze_chat: \"{payload.get('user_message', '')[:60]}\"")
    d = get_detector()
    result = await asyncio.to_thread(
        d.analyze_with_chat,
        payload.get("full_frame_b64", ""),
        payload.get("user_message", ""),
        payload.get("session_id", "default"),
        payload.get("device_context", {}),
        payload.get("conversation_history", []),
    )
    return result


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        # Validate detector on first connection
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

            event = payload.get("event")

            # ── Normal scene frame (scan-driven) ─────────────────────────────
            if event == "scene_frame_ready":
                print(f"\n[Backend] 📸 Received scene frame (size: {len(payload.get('full_frame_b64', ''))} chars)")
                print("[Backend] 🧠 Sending to VLM for multi-hazard analysis...")

                result = await asyncio.to_thread(
                    detector.analyze_scene,
                    payload["full_frame_b64"],
                    payload.get("hazard_focus_bbox", []),
                    payload.get("session_id", "default"),
                    payload.get("device_context", {}),
                )

                hazard_count = len(result.get("hazards", []))
                top_risk = result.get("risk_level", "?")
                print(f"[Backend] ✅ Analysis complete — {hazard_count} hazard(s), top risk: {top_risk}")
                await websocket.send_json(result)

            # ── Chat frame (Ask AI mode — Phase 5) ───────────────────────────
            elif event == "chat_frame_query":
                user_msg = payload.get("user_message", "")
                print(f"\n[Backend] 💬 Chat query received: \"{user_msg[:60]}\"")
                print("[Backend] 🧠 Sending frame + text to VLM...")

                result = await asyncio.to_thread(
                    detector.analyze_with_chat,
                    payload["full_frame_b64"],
                    user_msg,
                    payload.get("session_id", "default"),
                    payload.get("device_context", {}),
                    payload.get("conversation_history", []),
                )

                print(f"[Backend] ✅ Chat analysis complete — reply: \"{str(result.get('chat_reply', ''))[:60]}\"")
                await websocket.send_json(result)

    except WebSocketDisconnect:
        print("\n[Backend] Client disconnected from WebSocket.")
    except Exception as e:
        try:
            await websocket.send_json({"event": "error", "message": str(e)})
        except Exception:
            pass


@app.post("/reset")
def reset():
    if _detector:
        _detector.sessions.clear()
    return {"status": "ok"}