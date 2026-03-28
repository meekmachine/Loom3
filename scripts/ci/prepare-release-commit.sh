#!/usr/bin/env bash

set -euo pipefail

remote="origin"
push_ref=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote)
      remote="$2"
      shift 2
      ;;
    --push-ref)
      push_ref="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# Mirror the bot-authored patch bump that publish.yml performs on main so
# PR checks can simulate the same release commit before merge.
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

npm version patch --no-git-tag-version >/dev/null

package_version="$(node -p "require('./package.json').version")"
release_tag="v${package_version}"

git add package.json package-lock.json
git commit -m "build: bump npm package version to ${package_version}" >/dev/null

release_sha="$(git rev-parse HEAD)"

if [[ -n "$push_ref" ]]; then
  git push "$remote" "HEAD:${push_ref}"
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "version=${package_version}"
    echo "tag=${release_tag}"
    echo "release_sha=${release_sha}"
  } >> "$GITHUB_OUTPUT"
else
  printf 'version=%s\n' "$package_version"
  printf 'tag=%s\n' "$release_tag"
  printf 'release_sha=%s\n' "$release_sha"
fi
