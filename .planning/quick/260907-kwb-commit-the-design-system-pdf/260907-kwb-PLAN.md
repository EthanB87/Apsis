---
phase: quick
plan: 260907-kwb
type: execute
wave: 1
depends_on: []
files_modified:
  - "Apsis Design System.pdf"
  - "docs/Apsis Design System.pdf"
autonomous: false
requirements: []
estimate:
  tokens: 12000
  raw_tokens: 8000
  tasks: 2
  confidence: low
must_haves:
  truths:
    - "The design system PDF is tracked in git history on master at the path chosen in Task 1"
    - "The commit created by this plan changes exactly one file"
    - "No .planning/ or .gsd/ artifact rides along in that commit"
    - "The committed blob is byte-identical to the working-tree file (3,037,396 bytes)"
  artifacts:
    - "A commit on master whose sole changed path is the design system PDF"
  key_links:
    - "PDF placement resolved against docs/Apsis Design System.dc.html, its already-tracked sibling"
---

<objective>
Commit the already-staged `Apsis Design System.pdf` as a single-file, single-purpose commit on master.

Purpose: The design system reference exists on disk and is staged but not in history. One clean atomic commit puts it in the repo without dragging in unrelated artifacts.
Output: One commit on master containing exactly one file — the design system PDF.

Scope discipline — deliberate non-actions (do NOT do these):
- Do NOT configure Git LFS or add a `.gitattributes`. At 2.9 MB the file is far under GitHub's 50 MB warning and 100 MB hard limit, and the repo has no LFS today. Introducing LFS would change clone semantics for every future contributor to solve a problem that does not exist.
- Do NOT push. HEAD (`88ccba6`) is already one unpushed merge commit ahead of `origin/master` (`9641923`); pushing is a separate, user-initiated decision.
- Do NOT stage, add, or commit anything else. Not `.planning/`, not `.gsd/`, not the working tree at large.
- Do NOT rename the file or strip the spaces from its filename.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Live repo observations made at planning time (2026-09-07) — these are the authority for this plan's scope:
- `git status --porcelain` returns exactly two entries: `A  "Apsis Design System.pdf"` (staged add) and `?? .gsd/`.
- `.gsd/` is confirmed gitignored — `git check-ignore -v .gsd/` resolves to `.gitignore:38`.
- The PDF is NOT ignored (`git check-ignore` exits 1 for it) and sits at repo root, 3,037,396 bytes.
- No `.gitattributes` exists; Git LFS is not configured. No submodules.
- `docs/` already tracks `Apsis Design System.dc.html`, `apsis_claude_design_prompt.md`, and `hybrid_app_brief.docx`.
- Commit `9641923` ("chore: portfolio cleanup") explicitly moved loose root artifacts (product brief, design prompt, design HTML) into `docs/`.
- Commit trailer convention in this repo: a `Co-Authored-By:` line as the final trailer.
- Execution runs sequentially on the main working tree (worktree isolation degraded). The staged index entry exists only in the main checkout — operate there.
</context>

<tasks>

<task type="checkpoint:decision" gate="blocking">
  <name>Task 1: Decide PDF placement and confirm publication</name>
  <decision>Where does `Apsis Design System.pdf` live in history — repo root (as currently staged) or `docs/` — and are you content for it to be published?</decision>
  <context>
Two things need your call before this file enters history permanently.

**1. Placement.** The PDF is staged at repo root. But `docs/Apsis Design System.dc.html` is already tracked — the exact same name, different extension. The PDF is almost certainly the export of that design canvas, and the two would sit side by side in `docs/`. More pointedly, your last substantive commit (`9641923`, "chore: portfolio cleanup") deliberately moved loose root artifacts into `docs/` — product brief, design prompt, and the design HTML. Committing this PDF at root partially undoes that cleanup one commit later. Root is otherwise tidy: `.gitignore`, `.npmrc`, `BUILD.md`, `DESIGN-SYSTEM.md`, `LICENSE`, `NUTRITION.md`, `README.md`, and four config/lockfile entries — the PDF would be the only binary asset there.

Against that: root is what you staged, `DESIGN-SYSTEM.md` already sets a precedent for a design doc at root, and moving later is cheap since git detects the rename and stores the 2.9 MB blob only once.

**2. This publishes the PDF.** The repo carries a portfolio README and a source-available view-only LICENSE, so committing makes the PDF readable by anyone with repo access. Presumably fine for a design system doc — but confirm you are content for its full contents and any embedded PDF metadata (author name, source application, edit history) to be visible.
  </context>
  <options>
    <option id="option-a">
      <name>A (default) — commit at repo root, as staged: `Apsis Design System.pdf`</name>
      <pros>Zero deviation from what you staged; no rename to review; fastest path.</pros>
      <cons>Adds the only binary asset to a freshly-tidied root and cuts against the `docs/` convention set one commit ago; separates the PDF from its `.dc.html` sibling.</cons>
    </option>
    <option id="option-b">
      <name>B — `git mv` into `docs/` first, commit as `docs/Apsis Design System.pdf`</name>
      <pros>Lands next to `docs/Apsis Design System.dc.html`; honors the `9641923` cleanup convention; keeps root config-only.</pros>
      <cons>One extra command; the committed path differs from what you staged.</cons>
    </option>
    <option id="option-c">
      <name>C — stop, do not commit yet</name>
      <pros>Lets you inspect contents, strip PDF metadata, or re-export before anything is permanent.</pros>
      <cons>Task stays open; the file remains staged but uncommitted.</cons>
    </option>
  </options>
  <resume-signal>Reply "A", "B", or "C". On A or B the chosen path is fixed for Task 2; on C, halt the plan without committing.</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Create the single-file commit</name>
  <files>Apsis Design System.pdf (option A) OR docs/Apsis Design System.pdf (option B) — exactly one is realized, determined by Task 1</files>
  <precondition>Task 1 returned option A or B. `git status --porcelain` still shows the PDF as a staged add and `.gsd/` as the only other entry. If the working tree has drifted from that, halt and report rather than committing.</precondition>
  <action>
If Task 1 selected option B, first relocate the staged file with `git mv` from the root path to `docs/`, preserving the filename verbatim including its spaces. `git mv` operates correctly on a staged-but-uncommitted add. Do not create the destination by copy-and-delete; that would break rename detection. If option A was selected, skip this and leave the file where it is.

Then create the commit with an explicit pathspec so only the PDF can possibly be included, quoting the path because it contains spaces: `git commit -m "<message>" -- "<chosen path>"`. The pathspec form is required, not optional — it makes the single-file guarantee structural rather than dependent on the current index state.

Use subject line `docs: add Apsis Design System PDF`, a short body line describing it as the PDF companion to `docs/Apsis Design System.dc.html` covering the palette, type scale, and component specs, and close with the `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` trailer followed by the `Claude-Session:` line, matching the trailer convention set by commit `9641923`.

Do not run `git add`, `git add -A`, or `git commit -a` at any point. Do not run `git push`.
  </action>
  <verify>
    <automated>set -e; P=$(git show --pretty=format: --name-only HEAD | sed '/^$/d'); [ "$(printf '%s\n' "$P" | wc -l)" -eq 1 ]; printf '%s\n' "$P" | grep -q 'Apsis Design System\.pdf$'; [ "$(git cat-file -s "$(git rev-parse "HEAD:$P")")" -eq 3037396 ]; [ -z "$(git status --porcelain -- '*Apsis Design System.pdf')" ]; echo PASS</automated>
  </verify>
  <done>HEAD is a new commit whose changed-file list is exactly one path ending in `Apsis Design System.pdf`; the committed blob is 3,037,396 bytes (byte-identical to the working-tree file); `git status` scoped to that filename is empty; nothing was pushed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| local filesystem → git history | A 2.9 MB binary the tooling cannot introspect crosses permanently into version control |
| git history → repo readers | The repo is portfolio-facing with a source-available LICENSE; a commit is effectively a publication |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-kwb-01 | Information Disclosure | `Apsis Design System.pdf` contents and embedded PDF metadata | medium | mitigate | Task 1 checkpoint explicitly asks the human to confirm publication and metadata exposure before the commit is created |
| T-kwb-02 | Tampering | commit scope creep — unrelated files swept into the commit | low | mitigate | Pathspec-scoped `git commit -- "<path>"` plus an automated gate asserting the commit's changed-file count is exactly 1 |
| T-kwb-03 | Tampering | binary corrupted or altered between staging and commit | low | mitigate | Verify gate asserts the committed blob is exactly 3,037,396 bytes, matching the live-observed working-tree size |

No package-manager installs occur in this plan, so no `T-kwb-SC` package-legitimacy row applies.
</threat_model>

<verification>
1. `git show --stat HEAD` lists exactly one changed path, ending in `Apsis Design System.pdf`.
2. `git cat-file -s $(git rev-parse HEAD:"<path>")` returns `3037396`.
3. `git status --porcelain -- '*Apsis Design System.pdf'` is empty.
4. `git status --porcelain` shows no `.planning/` or `.gsd/` path inside the new commit (`.gsd/` remains untracked and gitignored).
5. `git rev-list --count origin/master..HEAD` is 2 — the pre-existing unpushed merge plus this one commit. Nothing was pushed.
6. No `.gitattributes` was created; `git lfs ls-files` remains empty/unconfigured.
</verification>

<success_criteria>
- The design system PDF is in master's history at the human-approved path.
- That commit changes exactly one file, and the file's bytes are unchanged.
- Repo LFS/attributes configuration and remote state are untouched.
</success_criteria>

<output>
Create `.planning/quick/260907-kwb-commit-the-design-system-pdf/260907-kwb-SUMMARY.md` when done, recording the placement option chosen in Task 1 and the resulting commit SHA.
</output>
