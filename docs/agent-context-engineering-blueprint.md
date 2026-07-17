# Agent Context Engineering Blueprint

A reusable template for building an agent collaboration protocol in any software project.

> 上下文工程不是喂资料，而是设计协作协议。
> Agent context engineering is not about feeding information; it is about designing a collaboration protocol.

---

## 1. Introduction

This blueprint captures a layered agent-context system that has been used in production to reduce context pollution, onboarding friction, mis-edits, fabricated facts, and file collisions when multiple agents work on the same codebase.

It is designed to be copied into another project and adapted. The templates below use generic placeholders such as `<your-project-name>` and `<your-build-command>`. Replace them with project-specific values. Any example taken from the original project is clearly marked as **"Example from this project"**.

### 1.1 What problem does this solve?

Without a context protocol, agents typically:
- Load too much or too little context.
- Repeat onboarding questions every session.
- Edit the wrong files or use the wrong commands.
- Hallucinate facts when content sources are unclear.
- Step on each other's work when running in parallel.
- Forget what the last agent verified or left unfinished.

A context-engineering system turns these into documented protocols: what to read first, who owns which files, when to ask the user, how to verify, and how to turn mistakes into long-term rules.

### 1.2 What this is not

- It is **not** a single massive prompt file.
- It is **not** a replacement for reading code, docs, or official references.
- It is **not** a static knowledge base that never changes.

It is a living set of conventions that improve as the project and the team learn.

---

## 2. Core Principles

1. **Minimal resident rules.** The file that loads on every task (`AGENTS.md` or `CLAUDE.md`) should stay short. Only rules that every agent must follow on every task belong there.
2. **Layered, on-demand reading.** Agents read only the layers relevant to the current task, not every document at once.
3. **Evidence first.** Code, project docs, and configuration outrank chat memory and agent inference.
4. **Judgment first.** Clarify before executing when a task is ambiguous, high-risk, or could affect product direction.
5. **Verifiable outcomes.** Every task should be convertible into a checklist: what was changed and how to check it.
6. **Rule maintenance.** Corrections should be evaluated and, if they will recur, routed to the correct document layer.

---

## 3. Layered Architecture Overview

| Layer | File | Purpose | Do not put here |
|---|---|---|---|
| Resident rules | `AGENTS.md` / `CLAUDE.md` | Minimum behavior rules every agent must follow | Detailed business knowledge, long flows, temporary status |
| Project map | `docs/agent-context.md` | Tech stack, directory layout, commands, required-reading index | Full page specs, long standards |
| Task flows | `docs/agent-workflows.md` | Minimal step-by-step workflows for common tasks | Single-task status, temporary discussions |
| Handoff | `docs/agent-progress.md` | Current / last task status for the next agent | Running logs, permanent rules |
| Coordination | `docs/agent-task-board.md` | Active agents, file ownership, blocking requests | Project knowledge base, task details |
| Human gates | `docs/agent-manual-gates.md` | Decision classes requiring explicit user confirmation | Ordinary execution steps |
| Rule evolution | `docs/agent-rule-maintenance.md` | When / how to turn corrections into long-term rules | Unverified guesses |
| Verification | `docs/agent-verification.md` | Change type → minimum and extended verification steps | Business fact explanations |
| References | `docs/agent-references.md` | Curated external resources with absorbable patterns | Copied long text or un-evaluated links |
| Anti-pitfalls | `docs/agent-gotchas.md` | Small, high-frequency traps in table format | General code structure |
| Business language | `CONTEXT.md` | Product language and boundaries | Implementation details |
| Path-local rules | `AGENTS.md` in subdirectories | Rules repeated in a specific directory | Root-level general rules |

### 3.1 Read priority for a new task

```text
1. AGENTS.md / CLAUDE.md
2. docs/agent-context.md
3. docs/agent-workflows.md
4. Any topical doc relevant to the task (e.g., docs/content-source-policy.md)
```

---

## 4. File Roles and Starter Templates

Each section below gives the role of the file and a starter template. Replace placeholders with your project values.

---

### 4.1 `AGENTS.md` / `CLAUDE.md`

**Role.** The resident rule layer. It loads automatically in many agent tools. Keep it short and action-oriented. It should answer: "What must every agent do before, during, and after every task?"

> **Note on file naming.** Some tools read `AGENTS.md`, others read `CLAUDE.md`. Use the file name your primary tool expects. If you must keep both, designate one as the source of truth and keep them in sync; better still, use only one.

**Starter template.**

```markdown
# Agent Rules for <your-project-name>

Minimum rules every agent must follow on every task.

## 1. Context entry

Do not load all documentation into the conversation. Start with the smallest evidence set:

- `docs/agent-context.md`
- `docs/agent-workflows.md`
- `CONTEXT.md`

Read topical docs only when the task touches that area.

## 2. Layered reading

Read in this priority:

1. This file (`AGENTS.md` / `CLAUDE.md`).
2. `docs/agent-context.md`.
3. `docs/agent-workflows.md`.
4. Relevant topical docs.

## 3. Judgment first

- Do not assume the user is correct. Flag misunderstandings, risks, and more reliable paths.
- Clarify before executing high-risk, ambiguous, or product-affecting tasks.
- For low-risk, well-defined tasks, you may proceed, but state your key assumptions.
- When multiple valid approaches exist with clear tradeoffs, do not decide silently; present options.

## 4. Human gates

Stop and ask the user before:

1. Changing product direction.
2. Changing aesthetic direction.
3. Adding new dependencies, frameworks, or services.
4. Changing architecture or long-term maintenance cost.
5. Using content facts from unclear sources.
6. Performing operations that affect real users or real business.
7. Modifying files outside your declared ownership or shared files without approval.

## 5. Evidence priority

When judging facts, prefer this order:

1. Current repo code, project docs, and configuration.
2. Official docs, standards, and authoritative references.
3. Mature open-source implementations and real product cases.
4. Industry common practice.
5. Agent inference — clearly label as speculation.

Research externally when the task involves third-party libraries, frameworks, APIs, design patterns, architecture choices, or when local evidence is insufficient.

## 6. Code changes

- Make the smallest change that solves the problem.
- Edit only what the request directly concerns.
- Match existing style.
- Do not add unrequested flexibility, configuration, or abstractions.
- Clean up unused imports, variables, and functions introduced by your change.
- Do not delete pre-existing dead code unless explicitly asked.

## 7. Verification

Convert every task into verifiable steps:

```text
1. [Step] -> Verification: [How to check]
```

- For logic changes in typed code: run `<your-build-command>`.
- For components, hooks, routes, shared utilities: run `<your-build-command>` and `<your-lint-command>`.
- For visual changes: check desktop and mobile layouts.
- If you cannot verify something, say so in the final reply and explain the remaining risk.

## 8. Multi-agent collaboration

Before starting work:

- Read `docs/agent-task-board.md`.
- Register your `Owns`, `May Touch`, and `Must Not Touch` files.
- Do not modify files you do not own unless you write a blocking request first.

## 9. Progress handoff

Update `docs/agent-progress.md` at these four points:

1. When starting a task.
2. After completing a deliverable stage.
3. When blocked.
4. Before ending, interrupting, or switching tasks.

Record only what the next agent needs to know.

## 10. Rule maintenance

When the user corrects you, do not only fix the current error. Decide whether the correction should be persisted to the appropriate context layer using the scoring rubric in `docs/agent-rule-maintenance.md`.

## 11. External references

When absorbing external examples:

- Copy mechanisms, not text.
- Cite the source.
- State the applicable scenario.
- State what transfers and what does not.
- Mark whether it has been adopted.

## 12. Output

Every final reply must be inspectable. Include:

- What you based your work on.
- What judgment or change you made.
- How you verified it.
- What remains uncertain or unverified.
```

**Example from this project.** The original `AGENTS.md` contains the same 12 sections in Chinese, with project-specific commands such as `npm run build` and references to `HashRouter` and `ChinaTripsMobile`. In the blueprint, those become placeholders.

---

### 4.2 `docs/agent-context.md`

**Role.** The project map. It tells an agent where the application lives, how to run it, which docs to read, and what the verification principles are.

**Starter template.**

```markdown
# Agent Context for <your-project-name>

## Project facts

- **Stack:** <your-tech-stack>
- **Application directory:** <your-app-directory> (if commands must run in a subdirectory)
- **Routing:** <your-router-type> (e.g., hash router, browser router, file-based routes)
- **Entry file:** <your-main-entry-file>
- **Root component:** <your-root-component-file>
- **Package manager:** <npm|pnpm|yarn|bun>

## Directory map

```text
<your-app-directory>/
  src/
    pages/          # Page components
    components/     # Shared components
    lib/            # Utilities, clients, shared data
    hooks/          # Custom hooks
    styles/         # Global styles
```

## Required reading

1. `AGENTS.md` / `CLAUDE.md` — behavior rules.
2. `CONTEXT.md` — business language and product boundaries.
3. `docs/agent-context-engineering-plan.md` — how this context system works (optional).

## Collaboration docs

- `docs/agent-progress.md` — current task status.
- `docs/agent-task-board.md` — multi-agent ownership and blocking requests.
- `docs/agent-manual-gates.md` — decisions that require user confirmation.
- `docs/agent-rule-maintenance.md` — how to turn corrections into rules.
- `docs/agent-verification.md` — verification matrix.
- `docs/agent-references.md` — external references.
- `docs/agent-gotchas.md` — frequent traps.

## Common commands

Run commands in `<your-app-directory>`:

```bash
<your-install-command>
<your-dev-command>
<your-build-command>
<your-lint-command>
<your-test-command>
```

## Verification principles

| Change type | Minimum verification |
|---|---|
| Copy or small style | Check affected pages; verify content source |
| Typed logic | `<your-build-command>` |
| Components, hooks, routes, shared utilities | `<your-build-command>` + `<your-lint-command>` |
| Visual changes | Desktop and mobile layout check |
| Responsive / mobile component | `<your-mobile-breakpoints>` |
| Routing or navigation | Navigation flow, refresh, scroll-to-top |
| Content, images, data | Check `docs/content-source-policy.md` |
| Documentation | UTF-8 read, link check |

## Content source priority

If your project has authoritative content sources, list them here:

1. <primary-source-location>
2. <secondary-source-location>
3. <reference-only-source-location>
```

---

### 4.3 `docs/agent-workflows.md`

**Role.** Minimal step-by-step routes for common tasks. Agents should not have to reinvent the navigation path every time.

**Starter template.**

```markdown
# Agent Workflows

Minimal workflows for common tasks.

## Generic workflow

1. Read `AGENTS.md` / `CLAUDE.md`.
2. Read `docs/agent-context.md`.
3. Read the workflow for your task type below.
4. Read relevant topical docs (content source, design contract, ADRs).
5. Identify the files to change.
6. Make the smallest change.
7. Verify per `docs/agent-verification.md`.
8. Update `docs/agent-progress.md`.

## Modify a page or component

1. Read `docs/agent-context.md` for the entry file and routing.
2. Read the route file (`<your-router-file>`) and the target page/component.
3. Check `CONTEXT.md` for business language.
4. If content is involved, check `docs/content-source-policy.md`.
5. Make the change; verify build and lint.
6. Check affected pages visually.

## Modify routing or navigation

1. Read `<your-router-file>`.
2. Read `<your-navigation-component>` and `<your-footer-component>`.
3. Confirm link format matches your router (e.g., hash links for hash routers).
4. Update routes, navigation, and footer links consistently.
5. Verify navigation, refresh, and scroll-to-top behavior.

## Modify content, images, or data

1. Check `docs/content-source-policy.md` for source priority.
2. Verify facts against the authoritative source.
3. Update data files, media, or CMS records as needed.
4. Do not fabricate names, numbers, testimonials, or facts.
5. Verify the affected page renders correctly.

## Fix a bug

1. Reproduce the bug if possible.
2. Read the relevant code path and tests.
3. Form a hypothesis; make the smallest fix.
4. Verify the fix and run regression checks.
5. If the bug reveals a recurring trap, consider adding it to `docs/agent-gotchas.md`.

## Write or update documentation

1. Decide which layer the doc belongs to (see `docs/agent-context-engineering-plan.md` or this blueprint).
2. Write concise, positive, verifiable rules.
3. Check links and formatting.
4. Verify the doc renders as UTF-8.
```

---

### 4.4 `docs/agent-progress.md`

**Role.** A handoff note for the next agent. It should contain only what someone picking up the project needs to know, not a full history.

**Starter template.**

```markdown
# Agent Progress

## Current Goal

<One-line description of the active goal.>

## Last Updated

<YYYY-MM-DD>

## Read Context

- `AGENTS.md` / `CLAUDE.md`
- `docs/agent-context.md`
- <Other docs read for this task>

## Changed Files

- `<file-path>` — <what changed>

## Verified

- <What has been checked and how>

## Not Verified

- <What has not been checked and why>

## Open Risks

- <What could still go wrong>

## Next Step

- <What the next agent or the user should do>
```

**Update trigger points.** Update this file only when:

1. Starting a task.
2. Completing a deliverable stage.
3. Becoming blocked.
4. Ending, interrupting, or switching tasks.

**Lesson from this project.** Do not keep a long history here. Archive completed goals elsewhere; `agent-progress.md` should stay small and current.

---

### 4.5 `docs/agent-task-board.md`

**Role.** Multi-agent coordination. Prevents two agents from editing the same file or shared surface without agreeing first.

**Starter template.**

```markdown
# Agent Task Board

## Active Agents

| Agent | Goal | Owns | May Touch | Must Not Touch | Status | Last Update |
|---|---|---|---|---|---|---|
| <agent-name> | <goal> | <files> | <files> | <files> | <status> | <YYYY-MM-DD> |

### Status values

- `planned` — not started.
- `working` — in progress.
- `blocked` — waiting on user or another agent.
- `review-needed` — ready for review.
- `verified` — checked and working.
- `done` — completed.

## Shared Files

| File | Owner | Rule |
|---|---|---|
| `<shared-file-1>` | <owner> | <who may edit and when> |
| `<shared-file-2>` | <owner> | <who may edit and when> |

## Blocking Requests

| From | Needs | Reason | Proposed Change | Status |
|---|---|---|---|---|
| <agent> | <permission / file access> | <why> | <what would change> | <open / approved / rejected> |

## Coordinator

The current coordinator is `<coordinator-name>`.

Responsibilities:
- Maintain task board ownership.
- Approve cross-scope changes.
- Merge progress from each agent.
- Decide final verification checklist.
- Report to the user.
```

**Guidelines.**
- Register ownership before touching files.
- Shared files must have an owner.
- To edit a file you do not own, open a blocking request first.
- The default coordinator is the current primary agent.

---

### 4.6 `docs/agent-manual-gates.md`

**Role.** Defines decisions that agents must not make alone.

**Starter template.**

```markdown
# Manual Gates

Decisions that require explicit user confirmation.

## Must confirm

| Gate | Description | Examples |
|---|---|---|
| Product direction | Changes to page positioning, navigation structure, conversion flow, or business process | Renaming a top-level product entry, removing a call-to-action |
| Aesthetic direction | Changes to overall visual tone, brand feel, or reference style | Switching from minimal to high-conversion marketing style |
| New dependency / framework / service | Adds long-term maintenance cost or external service binding | New state library, new UI framework, payment provider |
| Architecture or maintenance cost | Changes data flow, routing, component boundaries, or build setup | Refactoring a shared data layer, changing routers |
| Unclear content sources | Missing reliable sources that affect public content | Team names, prices, testimonials, route facts |
| Real business operations | Affects real users, external systems, or money | Deploy, send email, write production database, payment setup |
| Cross-agent scope | Modifying files outside your declared ownership or shared files | A page agent changing a data source or global style |

## Agent can handle

- Reading task-related files.
- Making minimal code or doc changes.
- Cleaning up unused imports / variables / functions introduced by the change.
- Running verification commands that do not modify source code.
- Updating progress and task-board status.
- Persisting confirmed recurring rules to the right doc layer.

## Request template

```markdown
## Manual Gate Request

- Gate:
- Background:
- Why this needs your confirmation:
- Options:
- Recommended option:
- Default if not confirmed:
```

## Judgment principle

If a decision affects product direction, long-term cost, factual truth, real business operations, or another agent's scope, pause and ask.
```

---

### 4.7 `docs/agent-rule-maintenance.md`

**Role.** Defines how corrections become long-term rules, so the same mistake is not repeated.

**Starter template.**

```markdown
# Rule Maintenance

How to turn repeated errors and stable experience into long-term context.

## When to update rules

After the user corrects an agent, decide whether the correction will repeat.

### Persist

- Repeated agent mistakes.
- Project-specific rules.
- Stable user preferences.
- Content facts and evidence boundaries.
- Common task flows.
- Collaboration mechanisms.

### Do not persist

- One-time task goals.
- Intermediate page drafts.
- Outdated debugging steps.
- One-off aesthetic opinions.
- Agent guesses.
- Facts obvious from reading the code.

## Admission scoring

| Dimension | Question | Pass threshold |
|---|---|---|
| Repeat impact | Will this affect future judgments repeatedly? | Likely to recur at least twice |
| Specificity | Can it guide a clear action? | Can be written as a rule or check |
| Evidence | Does it have a source? | Repo, docs, user confirmation, or authoritative reference |
| Verifiability | Can compliance be checked? | Readable, runnable, or screenshot-verifiable |
| Maintenance cost | Will it expire quickly? | High-volatility content only gets links or routing |

Aim for 3 or more passes; factual and business rules must have evidence.

## Rule routing

| Rule type | Target file |
|---|---|
| Must follow on every task | `AGENTS.md` / `CLAUDE.md` |
| Project entry, commands, directories | `docs/agent-context.md` |
| Common task flow | `docs/agent-workflows.md` |
| Current task status | `docs/agent-progress.md` |
| Multi-agent ownership / blocking | `docs/agent-task-board.md` |
| User confirmation gates | `docs/agent-manual-gates.md` |
| Verification methods | `docs/agent-verification.md` |
| External references | `docs/agent-references.md` |
| Frequent small traps | `docs/agent-gotchas.md` |
| Content / asset sources | `docs/content-source-policy.md` |
| Business language / boundaries | `CONTEXT.md` |

## Writing rules

Use positive, specific, verifiable language.

Bad: "Do not mess up styles."  
Good: "For visual changes, check desktop and mobile layout before finishing."

Bad: "Do not make up content."  
Good: "Route facts must come from the authoritative source listed in `docs/content-source-policy.md`; flag uncertainty when sources are missing."

## Retrospective template

```markdown
## Rule Maintenance Entry

- Trigger:
- Error type:
- Will it repeat:
- Evidence source:
- Target file:
- Draft rule:
- Verification:
```
```

---

### 4.8 `docs/agent-verification.md`

**Role.** Converts "done" into a checkable conclusion. Maps change types to verification steps.

**Starter template.**

```markdown
# Agent Verification

Make "done" an inspectable conclusion.

## Verification matrix

| Change type | Minimum verification | Extended verification |
|---|---|---|
| Copy or small style | Check affected page rendering | Verify content source |
| Typed logic | `<your-build-command>` | Interactive check on affected path |
| Components, hooks, routes, shared utilities | `<your-build-command>` + `<your-lint-command>` | Check calling pages |
| Visual changes | Desktop and mobile layout check | Screenshot or browser measurement |
| Mobile / responsive component | `<your-mobile-breakpoints>` | Check horizontal overflow, touch targets, text clipping |
| Routing or navigation | Navigation flow, refresh, scroll-to-top | Check nav and footer links |
| Content, images, data | Check `docs/content-source-policy.md` | Cross-check against `CONTEXT.md` |
| Documentation | UTF-8 read and format check | Link check |

## Common commands

Run in `<your-app-directory>`:

```bash
<your-build-command>
<your-lint-command>
<your-preview-command>
```

## Mobile / responsive checks

If your project has a mobile-specific component, verify at least:

- <breakpoint-1>
- <breakpoint-2>
- <breakpoint-3>

Checks:

- `document.documentElement.scrollWidth <= document.documentElement.clientWidth`
- Headlines, buttons, labels are not clipped.
- Image cropping matches design intent.
- Bottom navigation / safe areas do not obscure content.

## When you cannot verify

State in your final reply:

- What was not verified.
- Why it could not be verified.
- What risk remains.
- How the user or next agent should complete verification.

## Automation roadmap

As checks stabilize, script them:

- Build check.
- Lint check.
- Horizontal overflow check.
- Mobile width check.
- Key page screenshot check.
- Route link check.
```

---

### 4.9 `docs/agent-references.md`

**Role.** Curates external resources. Copy mechanisms, not text.

**Starter template.**

```markdown
# Agent References

External references for context engineering. Use them for mechanisms, not copy-paste content.

## Principles

- Record only mechanisms that can migrate to this project.
- Each entry must include risk and applicable boundary.
- Prefer official docs, mature open-source cases, and real product practices.
- Mark stale entries instead of silently deleting them.

## References

| Name | Category | Link | Useful Pattern | Risk | Status | Last Checked |
|---|---|---|---|---|---|---|
| <name> | <category> | <link> | <pattern> | <risk> | active | <YYYY-MM-DD> |

## Analysis template

```markdown
## Reference: <name>

- Category:
- Link:
- What is useful:
- What does not transfer:
- Risk:
- Decision:
- Last checked:
```

## Absorption criteria

A reference should only influence this project if it:

- Solves a real collaboration problem here.
- Fits into an existing doc layer.
- Does not depend on unsupported tool capabilities.
- Does not add long-term maintenance burden.
- Can be rewritten in our own words as a rule, flow, or check.
```

---

### 4.10 `docs/agent-gotchas.md`

**Role.** A small, high-frequency trap list. These are mistakes that cause rework.

**Starter template.**

```markdown
# Agent Gotchas

Small, high-frequency traps that cause rework.

## Current gotchas

| Gotcha | Correct handling |
|---|---|
| <short description> | <what to do instead> |
| <short description> | <what to do instead> |

## Adding a gotcha

A gotcha should be:

- Frequent (has happened more than once or is likely to happen).
- Small (a single sentence explains the trap and fix).
- Costly (causes rework if missed).

Do not put here:

- General code structure.
- One-off bugs already fixed.
- Long explanations that belong in workflows or context docs.
```

---

### 4.11 `CONTEXT.md`

**Role.** Business language and product boundaries. It prevents agents from using inconsistent terminology or misrepresenting the product.

**Starter template.**

```markdown
# <your-project-name> Context

Business language and product boundaries.

## Terminology

### <Term A>

<Definition.>

_Avoid:_ <incorrect usage>

### <Term B>

<Definition.>

_Avoid:_ <incorrect usage>

## Relationships

- <Entity A> contains <Entity B>.
- <Entity C> must not be exposed as a top-level navigation label.
- <Entity D> belongs under <Entity E>.

## Example dialogue

> **Dev:** "Should we label the main navigation link X?"  
> **Domain expert:** "No, use <Term A> because it covers both Y and Z."
```

**Language note.** Write `CONTEXT.md` in the primary language of the project team. If the product is localized, you may need separate context docs per language or a section per language.

---

### 4.12 Subdirectory `AGENTS.md`

**Role.** Path-local rules for directories where the same special rule keeps recurring.

**When to create one.**

Only when a directory repeatedly causes errors that do not belong in the root `AGENTS.md`. Common candidates:

- `<your-app-directory>/AGENTS.md` — frontend-specific conventions.
- `<your-api-directory>/AGENTS.md` — backend-specific conventions.
- `<your-components-directory>/AGENTS.md` — component-specific conventions.

**Guideline.** Do not create empty `AGENTS.md` files for completeness. Add one only when the pain is real and repeated.

---

## 5. Operating Protocols

### 5.1 Progress handoff

Update `docs/agent-progress.md` only at these four points:

1. **Start.** When beginning a task.
2. **Milestone.** When completing a deliverable stage.
3. **Blocked.** When you cannot proceed without help.
4. **End / interrupt / switch.** When leaving the task.

Record only the information the next agent needs: current goal, read context, changed files, verified items, unverified items, open risks, next step. Do not keep a running log.

### 5.2 Multi-agent coordination

Before starting work:

1. Read `docs/agent-task-board.md`.
2. Add yourself to the active agents table with `Owns`, `May Touch`, and `Must Not Touch`.
3. Identify shared files and their owners.

During work:

- Do not modify files you do not own.
- If you must modify an unowned or shared file, open a blocking request and wait for approval.

### 5.3 Coordinator responsibilities

The coordinator (default: current primary agent) is responsible for:

- Maintaining task-board ownership.
- Assigning file owners.
- Approving cross-scope changes.
- Merging progress from each agent.
- Deciding the final verification checklist.
- Reporting to the user.

Sub-agents may update their own status, notes, and blocking requests, but they should not change ownership rules or approve blocking requests unilaterally.

### 5.4 Human gate flow

When you encounter a manual gate:

1. Identify which gate applies.
2. Pause execution.
3. Present the request using the `Manual Gate Request` template.
4. Wait for explicit user confirmation.
5. Record the decision in the appropriate context layer if it is recurring.

### 5.5 Rule-maintenance flow

When a user corrects an agent:

1. Fix the current error.
2. Decide whether the correction will recur.
3. Score it against the admission rubric.
4. Route it to the correct file layer.
5. Write the rule in positive, verifiable language.
6. Verify the updated doc renders correctly.

---

## 6. Lessons and Anti-Patterns from This Project

The following are real rough edges observed while building this system. Avoid them in a new project.

### 6.1 Duplicate resident rule files

This project maintains both `AGENTS.md` and `CLAUDE.md` with identical content. This is fragile: if one is updated and the other is not, agents may see inconsistent rules.

**Recommendation.** Use only one resident rule file. Pick the file name your primary agent tool expects. If a secondary tool requires a different file name, either automate sync or clearly designate one as the source of truth.

### 6.2 Overloaded progress file

`docs/agent-progress.md` accumulated too much historical detail: completed work, bug retrospectives, and next-step instructions all mixed together.

**Recommendation.** Keep only the current goal and the immediately previous closed goal. Archive older entries elsewhere.

### 6.3 Tool-specific commands leaking into resident rules

Commands such as `npm run build` and references to `HashRouter` appeared in the resident rules layer.

**Recommendation.** Keep resident rules generic. Project-specific commands belong in `docs/agent-context.md` and verification commands belong in `docs/agent-verification.md`.

### 6.4 Creating all files at once

It is tempting to create the full set of context files for completeness.

**Recommendation.** Start with Phase 1 files only: `agent-progress.md`, `agent-task-board.md`, `agent-manual-gates.md`, `agent-rule-maintenance.md`. Add other layers when real pain appears.

### 6.5 AGENTS.md becoming a knowledge base

If `AGENTS.md` grows too long, it stops being a rule file and becomes a dump of everything.

**Recommendation.** If a section is not required on every task, move it to `docs/agent-context.md` or a topical doc.

### 6.6 Shared files defined reactively

Shared files and owners were defined after collisions occurred.

**Recommendation.** Define the first shared files and owners as soon as two agents might touch the same surface.

### 6.7 Verification matrix not automated

The verification matrix exists as a checklist, but no scripts run it yet.

**Recommendation.** Prioritize automating checks that are stable and expensive to miss, such as build, lint, and link checks.

### 6.8 Mixed-language documentation

In this project, most agent docs are in Chinese while `CONTEXT.md` is in English.

**Recommendation.** Choose one primary language for the agent-context system and translate only when the team requires it.

---

## 7. Phased Adoption Roadmap

Adopt the system incrementally. Do not create all files at once.

### Phase 1 — Basic loop

Create or refine:

- `AGENTS.md` / `CLAUDE.md`
- `docs/agent-context.md`
- `docs/agent-workflows.md`
- `docs/agent-progress.md`
- `docs/agent-task-board.md`
- `docs/agent-manual-gates.md`
- `docs/agent-rule-maintenance.md`

**Goal.** Agents can onboard, hand off, ask for confirmation, and persist rules.

### Phase 2 — Governance

Create or refine:

- `docs/agent-verification.md`
- `docs/agent-references.md`
- `docs/agent-gotchas.md`

**Goal.** Verification, external learning, and frequent traps have stable homes.

### Phase 3 — Path-local rules

Add subdirectory `AGENTS.md` files only when a path repeatedly causes errors.

**Goal.** Capture directory-specific conventions without bloating the root rule file.

### Phase 4 — Automation

Script stable, low-ambiguity checks:

- Build check.
- Lint check.
- Horizontal overflow check (for frontend).
- Mobile width check.
- Key page screenshot check.
- Route link check.

**Goal.** Reduce reliance on agents remembering to run repetitive checks.

---

## 8. Migration Checklist for a New Project

Use this checklist when applying the blueprint to another project.

- [ ] Replace all placeholders (`<your-project-name>`, `<your-build-command>`, etc.).
- [ ] Remove or clearly mark any "Example from this project" blocks.
- [ ] Calibrate commands to the new project's package manager and scripts.
- [ ] Define the application directory if commands must run in a subdirectory.
- [ ] List the correct content sources, or remove the content-source section if not applicable.
- [ ] Define the first shared files and owners in `docs/agent-task-board.md`.
- [ ] Add the first topical docs (design contract, content source policy, ADRs) as needed.
- [ ] Run a pilot task using the new system.
- [ ] Update `docs/agent-progress.md` during and after the pilot.
- [ ] Schedule the first rule-maintenance review.

---

## 9. Appendix

### 9.1 Template quick reference

| Layer | File | Section in this blueprint |
|---|---|---|
| Resident rules | `AGENTS.md` / `CLAUDE.md` | 4.1 |
| Project map | `docs/agent-context.md` | 4.2 |
| Task flows | `docs/agent-workflows.md` | 4.3 |
| Handoff | `docs/agent-progress.md` | 4.4 |
| Coordination | `docs/agent-task-board.md` | 4.5 |
| Human gates | `docs/agent-manual-gates.md` | 4.6 |
| Rule evolution | `docs/agent-rule-maintenance.md` | 4.7 |
| Verification | `docs/agent-verification.md` | 4.8 |
| References | `docs/agent-references.md` | 4.9 |
| Anti-pitfalls | `docs/agent-gotchas.md` | 4.10 |
| Business language | `CONTEXT.md` | 4.11 |
| Path-local rules | subdirectory `AGENTS.md` | 4.12 |

### 9.2 Recommended file creation order

```text
1. AGENTS.md / CLAUDE.md
2. docs/agent-context.md
3. docs/agent-workflows.md
4. docs/agent-progress.md
5. docs/agent-task-board.md
6. docs/agent-manual-gates.md
7. docs/agent-rule-maintenance.md
8. docs/agent-verification.md
9. docs/agent-references.md
10. docs/agent-gotchas.md
11. CONTEXT.md
12. Subdirectory AGENTS.md files (only when needed)
```

### 9.3 Original project reference

This blueprint was derived from the Agent Context Engineering system built for the Syncing Travel Portal. The original project files include `AGENTS.md`, `CLAUDE.md`, `docs/agent-context-engineering-plan.md`, and the layered `docs/agent-*.md` documents.
