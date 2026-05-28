# Codex Instructions

## Worktree And PR Workflow

- For any code or documentation change, do not edit the main checkout directly unless the user explicitly asks for it.
- Create a new git worktree from the repository default branch and work on a dedicated `codex/...` branch.
- Keep the main checkout clean. If changes accidentally land there, move them into a feature worktree before continuing.
- Stage only the intended files, commit the scoped change, push the branch, and open a draft pull request.
- Run the most relevant available checks before opening the pull request, and mention any checks that could not be run.
- Do not overwrite, reset, or include unrelated local/user changes from other worktrees.
