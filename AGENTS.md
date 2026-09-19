# Codex Instructions

## Worktree And PR Workflow

- For any code or documentation change, do not edit the main checkout directly unless the user explicitly asks for it.
- Create a new git worktree from the repository default branch and work on a dedicated `codex/...` branch.
- Keep the main checkout clean. If changes accidentally land there, move them into a feature worktree before continuing.
- Stage only the intended files, commit the scoped change, push the branch, and open a draft pull request.
- Run the most relevant available checks before opening the pull request, and mention any checks that could not be run.
- Do not overwrite, reset, or include unrelated local/user changes from other worktrees.

## Karpathy-Style Agent Discipline

- Think before coding: state assumptions, name ambiguity, and ask before implementing when multiple interpretations would change the solution.
- Prefer the smallest change that satisfies the request. Do not add speculative flags, fallbacks, abstractions, or configurability that the user did not ask for.
- Keep PRs surgical. Package identity, runtime behavior, CI wiring, docs, and migration strategy should be separate changes unless the user explicitly asks for one combined PR.
- Every changed line should trace directly to the user's request. If you notice unrelated cleanup, mention it instead of editing it.
- Define success criteria before editing, then verify them with focused checks. For behavior changes, add or update tests that prove the intended behavior.

## Engineering Writing

Apply these rules to issues, implementation plans, design proposals, PR
descriptions, and review findings.

- Before drafting factual claims, read the relevant parts of [README.md](README.md),
  [VISION_AND_PRD.md](VISION_AND_PRD.md), and the code that owns the behavior.
  Check the affected public API, profile or preset definitions, and linked
  decisions as needed. Treat product aspirations as future direction, not
  evidence of implemented behavior; flag conflicting sources.
- Lead with the concrete problem and affected developer, technical artist, or
  downstream user. Name the relevant flow, such as applying a preset to a rig,
  controlling an expression, playing a clip, or reusing a character profile.
  Explain the observable benefit or engineering constraint without inventing
  changes to a consuming app.
- Locate the change in Loom3's expressive runtime, profiles, presets, or tooling.
  Distinguish that responsibility from a consuming app's authoring UI, workflow,
  capture, and persistence. For cross-repository work, name the affected interface
  or dependency, link the related work, and explain what it blocks and why.
- Separate observed current behavior, proposed behavior, delivered behavior,
  and follow-on work. A new schema field, stub, or exported interface is distinct
  from implemented runtime behavior and from integration in a consuming app.
- Give issues observable completion criteria using the relevant rig, profile,
  API call, or downstream flow and failure cases. Give PRs the actual verification
  performed, its result, and material limits; distinguish automated checks from
  visual checks of rendered character behavior.
- Use searchable titles that name the affected behavior and change. Write
  concise, active sentences, define unfamiliar abbreviations, and replace vague
  claims such as "improve expressiveness" with the specific condition and
  outcome. Keep detail proportional to the change and link durable design
  explanations instead of repeating them.
- PR descriptions must explain the final diff: the problem, resulting behavior,
  owning components, and verification. Update them when scope changes; omit
  abandoned plans and implementation chronology unless needed to explain a
  tradeoff.
- Review findings must connect a triggering condition to a failure, its user or
  system consequence, and supporting evidence. Label uncertain causes as
  hypotheses; prose preference alone is not a defect.
