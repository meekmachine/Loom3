#!/usr/bin/env bash

set -euo pipefail

tag=""
commit="HEAD"
remote="origin"
push_tag="false"
dry_run="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      tag="$2"
      shift 2
      ;;
    --commit)
      commit="$2"
      shift 2
      ;;
    --remote)
      remote="$2"
      shift 2
      ;;
    --push)
      push_tag="true"
      shift
      ;;
    --dry-run)
      dry_run="true"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$tag" ]]; then
  echo "--tag is required." >&2
  exit 1
fi

commit_sha="$(git rev-parse "$commit")"
remote_commit="$(git ls-remote --tags "$remote" "refs/tags/${tag}^{}" | awk '{print $1}')"

if [[ -z "$remote_commit" ]]; then
  remote_commit="$(git ls-remote --tags "$remote" "refs/tags/${tag}" | awk '{print $1}')"
fi

if [[ -n "$remote_commit" && "$remote_commit" != "$commit_sha" ]]; then
  echo "Tag ${tag} points to ${remote_commit}, expected ${commit_sha}." >&2
  exit 1
fi

if [[ -n "$remote_commit" ]]; then
  exit 0
fi

tag_args=(
  -c user.name=github-actions[bot]
  -c user.email=41898282+github-actions[bot]@users.noreply.github.com
  tag
  -a
)

if [[ "$dry_run" == "true" ]]; then
  temp_tag="${tag}-dry-run"
  git "${tag_args[@]}" "$temp_tag" -m "Release ${tag}" "$commit_sha"
  git tag -d "$temp_tag" >/dev/null
  exit 0
fi

git "${tag_args[@]}" "$tag" -m "Release ${tag}" "$commit_sha"

if [[ "$push_tag" == "true" ]]; then
  git push "$remote" "$tag"
fi
