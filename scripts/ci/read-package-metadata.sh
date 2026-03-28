#!/usr/bin/env bash

set -euo pipefail

package_name="$(node -p "require('./package.json').name")"
package_version="$(node -p "require('./package.json').version")"

if [[ -z "$package_name" || -z "$package_version" ]]; then
  echo "Package metadata is incomplete." >&2
  exit 1
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "name=${package_name}"
    echo "version=${package_version}"
    echo "tag=v${package_version}"
  } >> "$GITHUB_OUTPUT"
else
  printf 'name=%s\n' "$package_name"
  printf 'version=%s\n' "$package_version"
  printf 'tag=v%s\n' "$package_version"
fi
