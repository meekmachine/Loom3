#!/usr/bin/env bash

set -euo pipefail

tag=""
commit=""
package_name=""
package_version=""

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
    --package-name)
      package_name="$2"
      shift 2
      ;;
    --package-version)
      package_version="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$tag" || -z "$commit" || -z "$package_name" || -z "$package_version" ]]; then
  echo "--tag, --commit, --package-name, and --package-version are required." >&2
  exit 1
fi

if [[ -z "${GH_TOKEN:-}" || -z "${GITHUB_REPOSITORY:-}" ]]; then
  echo "GH_TOKEN and GITHUB_REPOSITORY must be set." >&2
  exit 1
fi

notes_response="$(
  gh api \
    --method POST \
    -H "Accept: application/vnd.github+json" \
    "repos/${GITHUB_REPOSITORY}/releases/generate-notes" \
    -f tag_name="${tag}" \
    -f target_commitish="${commit}"
)"

release_name="$(jq -r '.name // empty' <<<"${notes_response}")"
generated_body="$(jq -r '.body // empty' <<<"${notes_response}")"
notes_file="$(mktemp)"
trap 'rm -f "${notes_file}"' EXIT

cat >"${notes_file}" <<EOF
## NPM Package

Install: \`npm install ${package_name}@${package_version}\`

Reference: [npmjs.com/package/${package_name}](https://www.npmjs.com/package/${package_name})
EOF

if [[ -n "${generated_body}" ]]; then
  printf '\n\n%s\n' "${generated_body}" >> "${notes_file}"
fi

release_title="${release_name:-${tag}}"

if gh release view "${tag}" --repo "${GITHUB_REPOSITORY}" >/dev/null 2>&1; then
  gh release edit "${tag}" \
    --repo "${GITHUB_REPOSITORY}" \
    --title "${release_title}" \
    --notes-file "${notes_file}" \
    --target "${commit}"
else
  gh release create "${tag}" \
    --repo "${GITHUB_REPOSITORY}" \
    --title "${release_title}" \
    --notes-file "${notes_file}" \
    --target "${commit}"
fi
