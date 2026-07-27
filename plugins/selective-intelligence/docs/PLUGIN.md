# Selective Intelligence plugin

Selective Intelligence is canonically maintained inside TradeScout Infinity at
`plugins/selective-intelligence`. It remains a self-contained Python package so
its proven lane, checkpoint, evidence, and PolicyGuard implementation is not
rewritten or coupled to Infinity's TypeScript services.

This repository is a combined ChatGPT/Codex plugin:

- `.codex-plugin/plugin.json` supplies installable plugin metadata.
- `skills/selective-intelligence/` remains the complete portable intelligence workflow.
- `.mcp.json` starts the local MCP adapter over stdio.
- `mcp_server/` exposes the existing lane, checkpoint, evidence, and PolicyGuard controls.

## Local development

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e .
python -m unittest discover -s tests -p 'test_*.py'
python /root/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py .
```

From the Infinity repository root, the repo-local marketplace can be installed
for development with:

```bash
codex plugin marketplace add .
```

To run the hosted transport locally:

```bash
SI_MCP_TRANSPORT=streamable-http python -m mcp_server.server
```

The MCP SDK serves Streamable HTTP at `/mcp`. Put it behind stable HTTPS for a
hosted install. Do not use a temporary tunnel for a production listing.

## Tool truth contract

- A new session starts execution-locked.
- Intent choices never grant execution authority.
- Approval requires the current checkpoint id and matching intent hash.
- Corrections interrupt SI session state and require a new approval.
- Council capability discovery is not council execution or consensus.
- `si_execute_step` prepares a bounded worker packet; it does not claim that an
  external worker ran.
- Verification uses the existing PolicyGuard and records exact evidence.
- The adapter does not accept provider credentials through chat or MCP inputs.

## Not yet claimed

- No production MCP endpoint has been deployed.
- No public plugin listing has been submitted.
- No custom MCP App card UI has been implemented.
- External model/tool/worker interruption is not proven by session-state control.
- Cross-model behavioral equivalence remains unproven until reproducible evals run.
