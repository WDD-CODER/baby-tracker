---
name: baby-tracker-plan-workflow
description: Save a Claude-authored plan into plans/ and execute milestones one at a time. Invoke when the human uses /plan-intake (new plan from Claude.ai) or /continue-plan (next milestone after human approval). Replaces per-milestone paste prompts — execution rules live in .cursorrules.
---

# Baby Tracker — Plan Workflow (Contractor)

Claude.ai (Architect) writes plans; it cannot write to this repo. Cursor saves the plan and executes milestones. The human approves between milestones.

**Always read first:** `_shared/agent-guide.md`, then the active plan file under `plans/`.

---

## Triggers (human → Cursor)

| Trigger | Action |
|---------|--------|
| `/plan-intake` + plan body | Save plan → execute **Milestone 1** → hand off → STOP |
| `/continue-plan` or `/next-milestone` | Execute **next** milestone on the active plan → hand off → STOP |
| `start milestone N` / `execute milestone N` | Execute **only** milestone N if prior milestones are complete per handoff |

Do **not** self-chain milestones. After every milestone, wait for human approval (continue trigger) before starting the next.

---

## Plan intake (`/plan-intake`)

1. **Parse filename** from the plan text (first match wins):
   - Explicit path: `plans/wave3_visual_identity_v1.md` or `/plans/wave3_visual_identity_v1.md`
   - Header: `# PLAN: wave1_data_model — v1` → `plans/wave1_data_model_v1.md`
   - Header: `# Plan Contract — Wave 3: Visual Identity` → slugify title → `plans/wave3_visual_identity_v1.md`
   - Slug rules: lowercase, spaces/punctuation → `_`, append `_v1` if no version suffix

2. **Collision:** If `plans/[name].md` exists and content differs materially, ask human: overwrite, or save as `_v2.md`. If identical, skip rewrite and proceed to execution.

3. **Save** the full plan body verbatim to `plans/[filename].md`. Do not strip the "Cursor Execution Instructions" block if present (harmless); Cursor ignores it — rules are in `.cursorrules`.

4. **Confirm** in one line: saved path + milestone count detected.

5. **Execute Milestone 1** using [Milestone execution](#milestone-execution) below.

---

## Continue plan (`/continue-plan`)

1. **Resolve active plan** (first hit):
   - AgentMemory `memory_recall`: query `Cursor handoff milestone plan baby-tracker` (latest entry)
   - Else: latest `## Milestone N` section in today's or most recent `sessions/*.md` with a `**Plan:**` line
   - Else: ask human which plan file to use

2. **Determine next milestone:** last completed milestone number from handoff + 1. If handoff says "Milestone 3 complete", run Milestone 4.

3. If all milestones in the plan are done, report plan complete — do not invent work.

4. **Execute** that milestone only.

---

## Milestone execution

For the target milestone N:

1. Read the plan file. Find `### Milestone N` (or `## Milestone N`) section.
2. **Scope:** Only touch files listed in that milestone. If the plan lists no files, infer from the milestone description but stay minimal.
3. **Conventions:** `_shared/agent-guide.md`, `.cursorrules`, `.cursor/rules/*.mdc`. Stack: `_shared/tech-stack.md` if present; else `plans/prd-gap-analysis.md` for design tokens.
4. **Plan write-off timing:** Do **not** mark the milestone complete in `plans/` when execution finishes — hand off and wait for human + Reviewer approval. **After** the human explicitly approves (`milestone N approved`, `mark M[N] complete`, or equivalent), update the plan: milestone status `✅ DONE — [date]`, bug checkmarks, and plan header `Status:`. Mark source-audit bugs `DONE` in `bugs/2026-07-04-full-feature-audit.md` when applicable.
5. **Do NOT** start milestone N+1.
6. **Verify:** run the milestone's verify command if specified (default: `npm run lint`).
7. **3-strike rule:** max 3 fix attempts in scoped files; then file `bugs/bug_<id>.md` and stop.
8. **Hand off:** invoke `baby-tracker-handoff` skill (AgentMemory → `sessions/YYYY-MM-DD.md` fallback).

### Final message template

```markdown
**Milestone [N] complete** — `[plan file]`

[1–3 bullets: what changed]

### 👀 Visual check
1. Run `npm run dev` → [tab/screen].
2. Look at **[specific UI element]**.
3. **Before:** … **Now:** …

**Verification:** [lint/build result]

**Handoff:** [AgentMemory | sessions/YYYY-MM-DD.md]

---
⏸ **Waiting for you.** Run Claude Code `/review-it`, then reply **`/continue-plan`** to start Milestone [N+1].
```

If plan has no further milestones:

```markdown
**Plan complete** — all milestones done for `[plan file]`.
```

---

## What Claude plan authors omit

Plans from Claude.ai **do not** need a "Cursor Execution Instructions" block or per-milestone paste prompts. Cursor follows this skill + `.cursorrules` automatically.

Plans **should** include per milestone:
- Files to touch
- Changes (numbered)
- Acceptance test
- Verify command (optional; default `npm run lint`)
