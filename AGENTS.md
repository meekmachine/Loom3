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
