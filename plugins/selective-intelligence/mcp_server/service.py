"""Safe service boundary over the existing Selective Intelligence engine."""
from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = ROOT / "skills" / "selective-intelligence" / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import build_engine as engine  # noqa: E402
import capabilities as capability_engine  # noqa: E402
import checkpoint as checkpoints  # noqa: E402
import lane_session as sessions  # noqa: E402


class ServiceError(RuntimeError):
    """Structured, safe error suitable for an MCP tool result."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _workspace_root() -> Path:
    root = Path(os.environ.get("SI_WORKSPACE_ROOT") or (Path(tempfile.gettempdir()) / "si-mcp-workspaces"))
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def _session(session_id: str) -> dict[str, Any]:
    try:
        session = sessions.load_session(session_id)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        raise ServiceError("SESSION_INVALID", "Session state could not be loaded safely.") from exc
    if not session:
        raise ServiceError("SESSION_NOT_FOUND", "Selective Intelligence session not found.")
    return session


def _save(session: dict[str, Any]) -> None:
    sessions.save_session(session)


def _result(data: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, **data}


def _error(exc: Exception) -> dict[str, Any]:
    if isinstance(exc, ServiceError):
        return {"ok": False, "error": {"code": exc.code, "message": str(exc)}}
    if isinstance(exc, (engine.EngineError, checkpoints.CheckpointError, ValueError)):
        return {"ok": False, "error": {"code": "REQUEST_REJECTED", "message": str(exc)}}
    return {"ok": False, "error": {"code": "INTERNAL_ERROR", "message": "The request failed without exposing internal state."}}


def safe_call(operation: Any, /, *args: Any, **kwargs: Any) -> dict[str, Any]:
    try:
        return operation(*args, **kwargs)
    except Exception as exc:  # Tool boundary must not leak a traceback or secrets.
        return _error(exc)


def start_session(objective: str) -> dict[str, Any]:
    if not isinstance(objective, str) or not objective.strip():
        raise ServiceError("INVALID_OBJECTIVE", "objective must be non-empty text")
    workspace = _workspace_root() / f"run-{uuid.uuid4().hex}"
    session = engine.start_project(
        request=objective.strip(),
        workspace=str(workspace),
        canonical_roots=[],
        auto_approve=False,
    )
    return _result(
        {
            "session": sessions.summary(session),
            "nextAction": "Review the proposed intent checkpoint, then approve it or submit a correction.",
        }
    )


def understand_intent(session_id: str) -> dict[str, Any]:
    session = _session(session_id)
    return _result(
        {
            "sessionId": session_id,
            "activeIntent": session.get("activeIntent", {}),
            "facts": session.get("knownFacts", []),
            "assumptions": session.get("assumptions", []),
            "unknowns": session.get("unknowns", []),
            "contradictions": session.get("contradictions", []),
            "checkpoint": sessions.summary(session).get("currentCheckpoint"),
            "status": "proposal_only" if session.get("executionLocked", True) else "approved",
        }
    )


def generate_choices(session_id: str) -> dict[str, Any]:
    session = _session(session_id)
    objective = session.get("objective", "")
    choices = [
        {"id": "finish", "label": "Finish the full outcome", "description": "Recover the complete destination, then build and prove it."},
        {"id": "repair", "label": "Repair what exists", "description": "Preserve valid work, remove drift, and complete broken flows."},
        {"id": "audit", "label": "Audit before changing", "description": "Map confirmed state, contradictions, risks, and missing proof first."},
        {"id": "smallest_complete", "label": "Ship the smallest complete version", "description": "Reduce breadth without removing the real user outcome."},
        {"id": "plan_only", "label": "Lock the plan only", "description": "Produce an execution-ready contract without authorizing implementation."},
    ]
    digest = hashlib.sha256(json.dumps({"objective": objective, "choices": choices}, sort_keys=True).encode()).hexdigest()
    sessions.record_event(session, "intent.choices_generated", {"choiceSetHash": digest, "choiceIds": [item["id"] for item in choices]})
    _save(session)
    return _result(
        {
            "sessionId": session_id,
            "state": "intent_selection_required",
            "choices": choices,
            "allowSelectAll": True,
            "allowCustomResponse": True,
            "customResponseLabel": "None of those—here’s what I actually mean",
            "choiceSetHash": digest,
        }
    )


def submit_choice(
    session_id: str,
    choice_ids: list[str],
    choice_set_hash: str,
    custom_response: str | None = None,
) -> dict[str, Any]:
    session = _session(session_id)
    allowed = {"finish", "repair", "audit", "smallest_complete", "plan_only", "select_all"}
    if not choice_ids or any(item not in allowed for item in choice_ids):
        raise ServiceError("INVALID_CHOICE", "choice_ids contains an unsupported choice")
    if not isinstance(choice_set_hash, str) or len(choice_set_hash) != 64:
        raise ServiceError("STALE_CHOICE_SET", "A valid choice_set_hash is required")
    payload = {
        "choiceIds": list(dict.fromkeys(choice_ids)),
        "choiceSetHash": choice_set_hash,
        "hasCustomResponse": bool(custom_response and custom_response.strip()),
    }
    sessions.record_event(session, "intent.choice_submitted", payload, actor="user")
    if custom_response and custom_response.strip():
        correction = sessions.add_correction(session, custom_response.strip())
        _save(session)
        return _result(
            {
                "sessionId": session_id,
                "selection": payload,
                "correction": correction,
                "status": "new_checkpoint_requires_approval",
            }
        )
    session["intentSelection"] = payload
    _save(session)
    return _result({"sessionId": session_id, "selection": payload, "status": "recorded_not_authorized"})


def approve_checkpoint(session_id: str, checkpoint_id: str, intent_hash: str) -> dict[str, Any]:
    session = engine.approve_project(
        session_id=session_id,
        checkpoint_id=checkpoint_id,
        intent_hash=intent_hash,
    )
    return _result({"session": sessions.summary(session), "status": "approved"})


def correct_intent(session_id: str, correction: str, checkpoint_id: str | None = None) -> dict[str, Any]:
    if not correction.strip():
        raise ServiceError("INVALID_CORRECTION", "correction must be non-empty text")
    session, result = engine.interrupt_project(
        session_id=session_id,
        correction=correction.strip(),
        disliked_checkpoint_id=checkpoint_id,
    )
    return _result({"session": sessions.summary(session), "correction": result, "status": "interrupted_requires_approval"})


def run_councils(session_id: str) -> dict[str, Any]:
    session = _session(session_id)
    inventory = capability_engine.inventory(probe_root=_workspace_root())
    model_adapters = [
        item
        for item in inventory
        if item.get("executable") and "reasoning" in item.get("verifiedCapabilities", [])
    ]
    count = min(len(model_adapters), 3)
    sessions.record_event(
        session,
        "council.capabilities_checked",
        {"availableIndependentRoutes": count, "adapterIds": [item["adapterId"] for item in model_adapters[:3]]},
    )
    _save(session)
    return _result(
        {
            "sessionId": session_id,
            "status": "capability_report_only",
            "availableCouncilRoutes": count,
            "consensus": "not_run",
            "reason": "Council execution requires independently configured reasoning routes; capability discovery does not manufacture model output.",
        }
    )


def create_plan(session_id: str, plan: dict[str, Any]) -> dict[str, Any]:
    session = _session(session_id)
    engine.validate_plan(plan)
    if session.get("executionLocked", True):
        session["pendingPlan"] = plan
        sessions.record_event(session, "plan.staged", {"planId": plan.get("planId"), "taskCount": len(plan["tasks"])})
        _save(session)
        return _result({"sessionId": session_id, "status": "staged_pending_checkpoint_approval"})
    engine.add_plan_tasks(session, plan)
    _save(session)
    return _result({"session": sessions.summary(session), "status": "plan_created"})


def execute_step(session_id: str, task_id: str) -> dict[str, Any]:
    session = _session(session_id)
    try:
        checkpoints.require_authorized_checkpoint(session)
    except checkpoints.CheckpointError as exc:
        raise ServiceError("APPROVAL_REQUIRED", str(exc)) from exc
    packet = engine.make_worker_packet(session_id=session_id, task_id=task_id)
    return _result(
        {
            "sessionId": session_id,
            "taskId": task_id,
            "status": "worker_packet_prepared",
            "workerPacket": packet,
            "note": "No external worker, filesystem mutation, commit, deployment, or publication is claimed.",
        }
    )


def verify_result(session_id: str, task_id: str, command: dict[str, Any]) -> dict[str, Any]:
    result = engine.verify_task(session_id=session_id, task_id=task_id, command=command)
    return _result({"verification": result})


def record_feedback(session_id: str, checkpoint_id: str, verdict: str, correction: str | None = None) -> dict[str, Any]:
    if verdict not in {"like", "dislike"}:
        raise ServiceError("INVALID_VERDICT", "verdict must be like or dislike")
    session = _session(session_id)
    sessions.record_event(
        session,
        "checkpoint.feedback",
        {"checkpointId": checkpoint_id, "verdict": verdict, "hasCorrection": bool(correction)},
        actor="user",
    )
    _save(session)
    if verdict == "dislike" and correction:
        return correct_intent(session_id, correction, checkpoint_id)
    return _result({"sessionId": session_id, "status": "recorded", "verdict": verdict})


def get_session(session_id: str) -> dict[str, Any]:
    return _result({"session": sessions.summary(_session(session_id))})


def get_evidence(session_id: str) -> dict[str, Any]:
    session = _session(session_id)
    return _result(
        {
            "sessionId": session_id,
            "facts": session.get("knownFacts", []),
            "artifacts": session.get("artifacts", []),
            "verificationAttempts": session.get("verificationAttempts", []),
            "completionEvidence": session.get("completionEvidence", []),
            "policyDecisions": session.get("policyDecisions", []),
            "commandEvidence": session.get("commandEvidence", []),
            "events": session.get("events", []),
        }
    )
