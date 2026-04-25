# AI Onboarding Prompt

Paste the block below into any AI coding assistant (Claude Code, Cursor chat, GitHub Copilot Chat, ChatGPT with codebase access, etc.) **the first time you open the project in a session**. Replace `[YOUR FIRST NAME]` with one of: `Hamza` · `Haithem` · `Abderraouf` · `Oussama` · `Imad`.

The assistant will read the project, identify your slice, and brief you on exactly what to do next.

---

```
I'm a student on the Climence project — a real-time air-quality monitoring
system for Riyadh, built for SWE 496 / SWE 497 (KSU CCIS). My first name is
Oussama.

Before answering anything else, do the following — in order — using only
what you actually read in the repo (do not guess):

1. Read these files:
   - README.md                                  (project quick start + layout)
   - ARCHITECTURE.md                            (chosen architecture, layer rules, data flow)
   - team/OVERVIEW.md                           (ownership matrix + build order + conventions + progress log)
   - team/student-*-[Oussama]/TASKS.md  (my specific prioritized tasks — find the folder whose name ends with my first name)
   - docs/SWE496_REQUIREMENTS_TRACEABILITY.md   (FR/NFR/UC status + evidence)

2. Skim what just shipped:
   - Run: git log --oneline -10
   - Read the most recent 3 entries under "Progress log" in team/OVERVIEW.md

3. Give me a single concise briefing in EXACTLY this structure (Markdown
   headings, no extra prose). Keep each section tight — bullets, not
   paragraphs.

   ## Who I am
   - Student #N · [Name] · Role title (from team/OVERVIEW.md)

   ## Files I own
   - Bullet list with relative paths (from my TASKS.md)

   ## Requirements I cover
   - FR / NFR / UC IDs (from my TASKS.md)

   ## What's already done from my list
   - Any task marked ✅ DONE above the original block in my TASKS.md
   - If nothing is done yet, say "Nothing yet."

   ## My next task
   - Priority + name (e.g. "P0 — Login lockout policy")
   - Files to create/edit (relative paths)
   - Acceptance criteria (verbatim from TASKS.md)
   - Dependencies — which teammate's work (if any) must land first, by name
   - A 30-second start plan: the first 3 commands or file reads I should do

   ## What my teammates are doing right now
   - Last 3 entries from the Progress log (date · who · what · branch)
   - Anything I should coordinate on (snapshot shape changes, schema
     migrations, auth contract changes — flag them explicitly)

   ## Conventions I must follow
   - My branch name format: `[my-oussama-lowercased]/<slice>-<short-desc>`
   - Commit message format (from team/OVERVIEW.md)
   - Definition of Done checklist (typecheck + lint + test + dev still
     boots + traceability row updated + TASKS.md ✅ DONE block added +
     OVERVIEW.md Progress log entry added + .env.example updated if
     applicable + PR description lists requirement IDs)

4. WHENEVER WE FINISH A TASK during this session (not turn 1 — later,
   when actual work lands), you MUST update these three docs before we
   close out the task. Treat this as part of the task itself, not optional.

   a. team/student-*-[Oussama]/TASKS.md
      - Insert a ✅ DONE block IMMEDIATELY ABOVE the original `### P#`
        heading for the task we just finished.
      - PRESERVE the original task description below — never delete or
        overwrite it. The original stays as historical reference.
      - Format the DONE block as a blockquote, starting with
        `> ✅ **DONE — YYYY-MM-DD.**` and including: branch name, files
        added/changed (as clickable relative links), test count + result,
        requirement IDs that moved, and one short heads-up sentence for
        the next maintainer.

   b. team/OVERVIEW.md → the "Progress log" section
      - Prepend a NEW BULLET at the TOP of the list (most recent first).
      - Format:
        `- **YYYY-MM-DD — [Name]** — P# **<task name>** complete (FR-XX /
        UC-YY → Implemented). <one-sentence what>. Branch
        `name/slice-desc`. Files: [path](path), [path](path). N/M tests
        green. **Heads-up for #N [Teammate]:** <what they can now consume>.`

   c. docs/SWE496_REQUIREMENTS_TRACEABILITY.md
      - Update the relevant FR / NFR / UC row's Status (Partial →
        Implemented when applicable) and rewrite the Evidence column to
        cite the new file paths.
      - Append a new section at the bottom titled
        `## Iteration (YYYY-MM-DD — [Name] · <slice>)` listing what
        shipped (one bullet per requirement touched).

   This protocol is the team standard. The first delivered slice — Haithem's
   auth lockout (2026-04-25) — uses exactly this format; copy that style
   when in doubt.

Constraints:
- If you cannot find my TASKS.md folder, list the team/student-*/ folders
  you DO see and ask me to confirm my name spelling. Do not invent a role.
- Do not start writing code in this turn. Only brief me.
- Cite the relative file path next to any non-obvious claim so I can
  verify quickly.
```

---

## Why this prompt is structured this way

- **It forces the AI to read real files instead of guessing.** "Only what you actually read in the repo" + "cite the relative file path" keeps it grounded.
- **It includes git log + progress log.** So teammates' recent work is visible, not just static role assignments.
- **The output structure is fixed.** Same shape every session means you can re-run it after a week away and pick up cleanly.
- **It refuses to start coding in turn 1.** First exchange is briefing only — you stay in control of what gets implemented.
- **Step 4 enforces the team's record-keeping protocol.** Every finished slice updates three docs the same way (TASKS ✅ DONE block above the original, OVERVIEW Progress log entry, traceability row + iteration). That's how the next teammate to open the repo — or the SWE 497 reviewer — knows what landed and where to look.

## When to re-run it

- First session in the project ever (obviously)
- After a long break — gets you re-oriented in 30 seconds
- When your previous priority has shipped and you need to pick the next one
- After a teammate merges something that touches your slice (their progress entry will surface in the briefing)

## After the briefing

Once the AI has briefed you, your follow-up message can be as direct as:

> Let's start P0. Read the files I own first, then propose the design before writing code.

That's how I (Haithem) opened the lockout work — see the Progress log entry dated 2026-04-25 for the actual outcome.
