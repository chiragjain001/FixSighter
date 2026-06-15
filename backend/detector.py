import os
import json
import uuid
from groq import Groq
from prompts.relational_vlm import SYSTEM_PROMPT, build_user_message


class HazardDetector:
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")

        if not api_key or api_key == "your_key_here":
            raise EnvironmentError(
                "\n\n[FixSight] GROQ_API_KEY is not set or is still the placeholder value.\n"
                "Set it in backend/.env before starting the server:\n"
                "  GROQ_API_KEY=gsk_...\n"
            )

        self.client = Groq(api_key=api_key)
        self.model = os.getenv("GROQ_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
        # In-memory session state (SRS §16.1)
        self.sessions: dict[str, dict] = {}

    # ──────────────────────────────────────────────────────────────
    # Primary analysis — scan-driven (no user text)
    # ──────────────────────────────────────────────────────────────
    def analyze_scene(
        self,
        full_frame_b64: str,
        hazard_focus_bbox: list,
        session_id: str,
        device_context: dict,
    ) -> dict:
        """Analyse a camera frame and return a multi-hazard scene graph."""
        return self._run_vlm(
            full_frame_b64=full_frame_b64,
            hazard_focus_bbox=hazard_focus_bbox,
            session_id=session_id,
            device_context=device_context,
            user_message=None,
        )

    # ──────────────────────────────────────────────────────────────
    # Chat analysis — user text + frame (Phase 5)
    # ──────────────────────────────────────────────────────────────
    def analyze_with_chat(
        self,
        full_frame_b64: str,
        user_message: str,
        session_id: str,
        device_context: dict,
        conversation_history: list | None = None,
    ) -> dict:
        """
        Analyse a camera frame in the context of a user's text question.
        Uses the chat_vlm prompt which returns chat_reply + chat_focus_target_id
        on top of the standard scene graph schema.
        """
        try:
            from prompts.chat_vlm import CHAT_SYSTEM_PROMPT, build_chat_message

            jpeg_b64 = self._ensure_jpeg(full_frame_b64)
            history  = conversation_history or []

            messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]
            messages.extend(
                build_chat_message(jpeg_b64, user_message, history, device_context)
            )

            response = self.client.chat.completions.create(
                model=self.model,
                response_format={"type": "json_object"},
                messages=messages,
                max_tokens=2048,
            )

            import json, uuid
            result = json.loads(response.choices[0].message.content)
            result["event"] = "scene_analysis_complete"
            if not result.get("scene_id"):
                result["scene_id"] = str(uuid.uuid4())

            # Ensure backwards-compat fields
            if result.get("hazards") and len(result["hazards"]) > 0:
                top = result["hazards"][0]
                result.setdefault("primary_hazard", top.get("title", ""))
                result.setdefault("risk_level", top.get("risk_level", "LOW"))
                result.setdefault("summary", top.get("summary", ""))
                result.setdefault("fallback_plan", top.get("fallback_plan", ""))
                result.setdefault("confidence", top.get("confidence", 0.0))

            result.setdefault("spatial_targets", [])
            result.setdefault("hazards", [])
            result.setdefault("selected_hazard_id", None)
            result.setdefault("general_solutions", [])
            result.setdefault("chat_reply", "")
            result.setdefault("chat_focus_target_id", None)

            self.sessions[session_id] = {
                "last_hazards": [h.get("id") for h in result.get("hazards", [])],
                "last_chat_reply": result.get("chat_reply"),
            }
            return result

        except Exception as e:
            return self._fallback_response(str(e))

    # ──────────────────────────────────────────────────────────────
    # Internal VLM call
    # ──────────────────────────────────────────────────────────────
    def _run_vlm(
        self,
        full_frame_b64: str,
        hazard_focus_bbox: list,
        session_id: str,
        device_context: dict,
        user_message: str | None,
        conversation_history: list | None = None,
    ) -> dict:
        try:
            jpeg_b64 = self._ensure_jpeg(full_frame_b64)

            # Build message list — optionally prepend conversation history for chat mode
            messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]

            if conversation_history:
                # Inject prior turns so the VLM has context
                messages.extend(conversation_history[-6:])  # last 3 exchanges max

            messages.append({
                "role": "user",
                "content": build_user_message(
                    jpeg_b64, hazard_focus_bbox, device_context, user_message
                ),
            })

            response = self.client.chat.completions.create(
                model=self.model,
                response_format={"type": "json_object"},
                messages=messages,
                max_tokens=2048,
            )

            result = json.loads(response.choices[0].message.content)

            # Normalise: ensure event field is always set
            result["event"] = "scene_analysis_complete"

            # Ensure scene_id exists (VLM may omit it)
            if not result.get("scene_id"):
                result["scene_id"] = str(uuid.uuid4())

            # Ensure backwards-compat fields for any frontend code still reading them
            if result.get("hazards") and len(result["hazards"]) > 0:
                top = result["hazards"][0]
                result.setdefault("primary_hazard", top.get("title", ""))
                result.setdefault("risk_level", top.get("risk_level", "LOW"))
                result.setdefault("summary", top.get("summary", ""))
                result.setdefault("fallback_plan", top.get("fallback_plan", ""))
                result.setdefault("confidence", top.get("confidence", 0.0))
                # Backwards-compat: flatten guidance.actions into the top-level guidance shape
                guidance = top.get("guidance", {})
                result.setdefault("guidance", guidance)

            # Ensure spatial_targets always present
            result.setdefault("spatial_targets", [])
            result.setdefault("hazards", [])
            result.setdefault("selected_hazard_id", None)
            result.setdefault("general_solutions", [])

            # Update session state
            self.sessions[session_id] = {
                "last_hazards": [h.get("id") for h in result.get("hazards", [])],
                "last_risk": result.get("risk_level"),
                "last_scene_id": result.get("scene_id"),
            }

            return result

        except Exception as e:
            return self._fallback_response(str(e))

    # ──────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────
    def _ensure_jpeg(self, full_frame_b64: str) -> str:
        """Convert raw RGB bytes (320x320x3) to valid JPEG if needed."""
        try:
            import base64
            from PIL import Image
            import io

            raw_bytes = base64.b64decode(full_frame_b64)
            if len(raw_bytes) == 320 * 320 * 3:
                img = Image.frombytes("RGB", (320, 320), raw_bytes)
                jpeg_io = io.BytesIO()
                img.save(jpeg_io, format="JPEG", quality=85)
                return base64.b64encode(jpeg_io.getvalue()).decode("utf-8")
            return full_frame_b64
        except Exception:
            return full_frame_b64

    def _fallback_response(self, reason: str) -> dict:
        return {
            "event": "error",
            "message": f"Analysis unavailable: {reason}",
        }
