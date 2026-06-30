# Setup Status — Baby Tracker

Stage 0 bootstrap and workflow integration checklist. After all **Remaining** items are done, the project enters Stage 1 (feature loop via Architect → Cursor → Claude Code).

---

## Done

- [x] Working folders: `plans/`, `bugs/`, `sessions/`
- [x] Rule files: `.cursorrules` (Cursor/Contractor), `CLAUDE.md` (Reviewer/DevOps)
- [x] Workflow README: `README_WORKFLOW.md`
- [x] Authoritative stack reference: `_shared/tech-stack.md`
- [x] Baseline state anchor: `_shared/current-state.md`
- [x] Secrets hygiene: `.env*` and `firebase-applet-config.json` in `.gitignore`
- [x] AI Studio app imported as working baseline (React 19 + Express + Firestore)

---

## Remaining (HUMAN — not Cursor)

These steps complete **Stage 0.5** (AgentMemory wiring). Cursor and Claude Code must not attempt them autonomously.

1. **Start the AgentMemory server**
   - Run the AgentMemory server locally (default: `http://localhost:3111`).

2. **Hand-write MCP config into Cursor and Claude Code**
   - Native Windows path — `agentmemory connect` is **unsupported** on Windows.
   - Paste the MCP block below into `%USERPROFILE%\.cursor\mcp.json` (Cursor).
   - Paste the **same block** into Claude Code's MCP config.
   - **`AGENTMEMORY_URL` is mandatory.** Without it the shim silently drops to 7-tool mode instead of FULL mode (~53 tools).

3. **Verify FULL mode**
   - After wiring, confirm the agent sees ~**53** tools, **not** 7.
   - If only 7 tools appear, check that `AGENTMEMORY_URL` is set correctly and the server is running.

4. **Install the Claude Code memory plugin**
   - Follow AgentMemory docs to install the memory plugin in Claude Code.

5. **Backfill memory**
   - Seed AgentMemory from `_shared/current-state.md` and `/sessions` so the Context Capsule has project history.

---

## MCP config reference (paste verbatim)

Add to `%USERPROFILE%\.cursor\mcp.json` and Claude Code's MCP config:

```json
{
  "mcpServers": {
    "agentmemory": {
      "command": "npx",
      "args": ["-y", "@agentmemory/mcp"],
      "env": {
        "AGENTMEMORY_URL": "http://localhost:3111"
      }
    }
  }
}
```
