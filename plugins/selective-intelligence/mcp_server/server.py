"""MCP tools for Selective Intelligence.

Local plugin installs use stdio. Set SI_MCP_TRANSPORT=streamable-http to serve
Streamable HTTP; the MCP SDK exposes the endpoint at /mcp by default.
"""
from __future__ import annotations

import os
from typing import Any

from mcp.server.fastmcp import FastMCP

from . import service

mcp = FastMCP(
    "Selective Intelligence",
    instructions=(
        "Recover and evidence-grade intent before implementation. Treat proposed "
        "checkpoints as non-authoritative until the user explicitly approves the "
        "matching checkpoint id and intent hash. Never manufacture council consensus "
        "or completion evidence."
    ),
    stateless_http=True,
    json_response=True,
)


@mcp.tool()
def si_start_session(objective: str) -> dict[str, Any]:
    """Create a durable, execution-locked SI session from plain-language intent."""
    return service.safe_call(service.start_session, objective)


@mcp.tool()
def si_understand_intent(session_id: str) -> dict[str, Any]:
    """Return the evidence-graded active intent and current checkpoint proposal."""
    return service.safe_call(service.understand_intent, session_id)


@mcp.tool()
def si_generate_choices(session_id: str) -> dict[str, Any]:
    """Return five concrete intent paths plus Select All and custom-response support."""
    return service.safe_call(service.generate_choices, session_id)


@mcp.tool()
def si_submit_choice(
    session_id: str,
    choice_ids: list[str],
    choice_set_hash: str,
    custom_response: str | None = None,
) -> dict[str, Any]:
    """Record intent choices; this does not authorize execution."""
    return service.safe_call(service.submit_choice, session_id, choice_ids, choice_set_hash, custom_response)


@mcp.tool()
def si_approve_checkpoint(session_id: str, checkpoint_id: str, intent_hash: str) -> dict[str, Any]:
    """Approve only the current checkpoint with its matching intent hash."""
    return service.safe_call(service.approve_checkpoint, session_id, checkpoint_id, intent_hash)


@mcp.tool()
def si_correct_intent(session_id: str, correction: str, checkpoint_id: str | None = None) -> dict[str, Any]:
    """Interrupt SI session state, apply a correction, and require a new approval."""
    return service.safe_call(service.correct_intent, session_id, correction, checkpoint_id)


@mcp.tool()
def si_run_councils(session_id: str) -> dict[str, Any]:
    """Report independently available council routes without manufacturing consensus."""
    return service.safe_call(service.run_councils, session_id)


@mcp.tool()
def si_create_plan(session_id: str, plan: dict[str, Any]) -> dict[str, Any]:
    """Validate and stage or create a dependency-ordered SI execution plan."""
    return service.safe_call(service.create_plan, session_id, plan)


@mcp.tool()
def si_execute_step(session_id: str, task_id: str) -> dict[str, Any]:
    """Prepare an authorized worker packet for one ready task; does not claim execution."""
    return service.safe_call(service.execute_step, session_id, task_id)


@mcp.tool()
def si_verify_result(session_id: str, task_id: str, command: dict[str, Any]) -> dict[str, Any]:
    """Run a PolicyGuard-allowed verification command and record exact evidence."""
    return service.safe_call(service.verify_result, session_id, task_id, command)


@mcp.tool()
def si_record_feedback(
    session_id: str,
    checkpoint_id: str,
    verdict: str,
    correction: str | None = None,
) -> dict[str, Any]:
    """Record concise Like/Dislike feedback; a corrected dislike interrupts safely."""
    return service.safe_call(service.record_feedback, session_id, checkpoint_id, verdict, correction)


@mcp.tool()
def si_get_session(session_id: str) -> dict[str, Any]:
    """Resume a durable SI session using its authoritative public summary."""
    return service.safe_call(service.get_session, session_id)


@mcp.tool()
def si_get_evidence(session_id: str) -> dict[str, Any]:
    """Return the sanitized evidence, policy, verification, and audit ledgers."""
    return service.safe_call(service.get_evidence, session_id)


def main() -> None:
    transport = os.environ.get("SI_MCP_TRANSPORT", "stdio")
    if transport not in {"stdio", "streamable-http"}:
        raise SystemExit("SI_MCP_TRANSPORT must be stdio or streamable-http")
    mcp.run(transport=transport)


if __name__ == "__main__":
    main()
