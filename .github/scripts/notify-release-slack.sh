#!/usr/bin/env bash

set -euo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_REF_NAME:?GITHUB_REF_NAME is required}"
: "${GITHUB_SHA:?GITHUB_SHA is required}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${SLACK_RELEASE_WEBHOOK_URL:?SLACK_RELEASE_WEBHOOK_URL is required}"

release_tag="${RELEASE_TAG:-${GITHUB_REF_NAME}}"
release_sha="${RELEASE_SHA:-${GITHUB_SHA}}"
short_commit_sha="${release_sha:0:7}"
commit_url="https://github.com/${GITHUB_REPOSITORY}/commit/${release_sha}"
extension_asset_name="chrome-extension.zip"
fallback_release_url="https://github.com/${GITHUB_REPOSITORY}/releases/tag/${release_tag}"
fallback_extension_asset_url="https://github.com/${GITHUB_REPOSITORY}/releases/download/${release_tag}/${extension_asset_name}"
release_api_url="https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/tags/${release_tag}"
release_response_file="$(mktemp)"
release_status="$(
  curl -sS -o "${release_response_file}" -w '%{http_code}' \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "${release_api_url}" || true
)"

release_json="{}"
if [[ "${release_status}" =~ ^2[0-9][0-9]$ ]]; then
  release_json="$(cat "${release_response_file}")"
else
  release_response="$(head -c 200 "${release_response_file}" | tr '\n' ' ')"
  echo "::warning::Unable to read GitHub release metadata for ${release_tag}; continuing with deterministic release links. HTTP ${release_status:-unknown}. Response: ${release_response:-empty}."
fi
rm -f "${release_response_file}"

release_url="$(printf '%s' "${release_json}" | jq -r --arg fallback "${fallback_release_url}" '.html_url // $fallback')"
release_title="$(printf '%s' "${release_json}" | jq -r --arg fallback "${release_tag}" '.name // .tag_name // $fallback')"
release_body_raw="$(printf '%s' "${release_json}" | jq -r '.body // ""')"
published_at="$(printf '%s' "${release_json}" | jq -r '.published_at // ""')"
extension_asset_url="$(
  printf '%s' "${release_json}" \
    | jq -r --arg asset_name "${extension_asset_name}" '.assets[]? | select(.name == $asset_name) | .browser_download_url' \
    | head -n 1
)"

if [ -z "${extension_asset_url}" ]; then
  extension_asset_url="${fallback_extension_asset_url}"
fi

if [ -z "${release_url}" ] || [ -z "${release_title}" ]; then
  echo "::error::Unable to read release metadata for tag ${release_tag}."
  exit 1
fi

release_body_clean="$(printf '%s\n' "${release_body_raw}" | sed -E 's/\r$//')"

mapfile -t unique_changes < <(
  printf '%s\n' "${release_body_clean}" \
    | grep -E '^\* ' \
    | awk '!seen[$0]++'
)

release_achievements_summary=""
release_notes_summary=""
max_changes=12
change_count=0
for change_line in "${unique_changes[@]}"; do
  if [ "${change_count}" -ge "${max_changes}" ]; then
    break
  fi

  change_text="${change_line#\* }"
  achievement_text="${change_text}"

  achievement_text="$(printf '%s' "${achievement_text}" | sed -E 's/ by @[^[:space:]]+ in https:\/\/github\.com\/[^[:space:]]+$//')"
  achievement_text="$(printf '%s' "${achievement_text}" | sed -E 's/^[A-Z]+-[0-9]+:?[[:space:]]*//')"
  achievement_text="$(printf '%s' "${achievement_text}" | sed -E 's/^[a-z]+(\([^)]+\))?:[[:space:]]*//')"
  achievement_text="$(printf '%s' "${achievement_text}" | awk '{ print tolower(substr($0, 1, 1)) substr($0, 2) }')"

  if [ -n "${achievement_text}" ]; then
    if [ -z "${release_achievements_summary}" ]; then
      release_achievements_summary="${achievement_text}"
    else
      release_achievements_summary+="; ${achievement_text}"
    fi
  fi

  if [[ "${change_text}" =~ ^(.+)\ in\ (https://github\.com/.+/pull/([0-9]+))$ ]]; then
    change_text="${BASH_REMATCH[1]} in <${BASH_REMATCH[2]}|#${BASH_REMATCH[3]}>"
  fi

  release_notes_summary+=$'• '"${change_text}"$'\n'
  change_count=$((change_count + 1))
done

commit_range_ref="${release_sha}"
if git rev-parse -q --verify "${release_tag}^{commit}" >/dev/null; then
  commit_range_ref="${release_tag}"
fi

previous_release_tag="$(
  git tag --merged "${commit_range_ref}" --sort=-version:refname 'v[0-9]*' \
    | grep -v "^${release_tag}$" \
    | head -n 1 || true
)"

commit_log_args=()
if [ -n "${previous_release_tag}" ]; then
  commit_log_args=("${previous_release_tag}..${commit_range_ref}")
else
  commit_log_args=("-n" "12" "${commit_range_ref}")
fi

commit_changes_summary=""
while IFS=$'\t' read -r commit_sha commit_subject; do
  if [ -z "${commit_sha}" ] || [ -z "${commit_subject}" ]; then
    continue
  fi

  commit_changes_summary+=$'• '"<https://github.com/${GITHUB_REPOSITORY}/commit/${commit_sha}|${commit_sha}> ${commit_subject}"$'\n'
done < <(git log "${commit_log_args[@]}" --pretty=format:'%h%x09%s')

if [ -z "${release_notes_summary}" ]; then
  release_notes_summary="Release notes were not available from GitHub metadata. See the commits below and the GitHub release for details."
fi

if [ -z "${commit_changes_summary}" ]; then
  commit_changes_summary="No commits were found for this release range."
fi

if [ -z "${release_achievements_summary}" ]; then
  release_achievements_summary="See the release notes and commit list below."
fi

full_changelog_url="$(
  printf '%s\n' "${release_body_clean}" \
    | sed -nE 's/^\*\*Full Changelog\*\*: (https:\/\/[^[:space:]]+).*$/\1/p' \
    | head -n 1
)"

release_summary=$'*Release notes*\n'"${release_notes_summary}"$'\n*Commits*\n'"${commit_changes_summary}"
if [ -n "${full_changelog_url}" ]; then
  release_summary+=$'\n'"<${full_changelog_url}|View full changelog>"
elif [ -n "${previous_release_tag}" ]; then
  release_summary+=$'\n'"<https://github.com/${GITHUB_REPOSITORY}/compare/${previous_release_tag}...${release_tag}|View full changelog>"
fi

release_summary="$(printf '%s' "${release_summary}" | sed -E 's/[[:space:]]+$//')"
release_summary="${release_summary:0:3000}"
release_achievements_summary="Includes: ${release_achievements_summary}."
release_achievements_summary="${release_achievements_summary:0:1200}"

published_text="Not available"
if [ -n "${published_at}" ] && [ "${published_at}" != "null" ]; then
  published_text="${published_at}"
fi

payload="$(jq -n \
  --arg tag "${release_tag}" \
  --arg release_url "${release_url}" \
  --arg release_title "${release_title}" \
  --arg commit_url "${commit_url}" \
  --arg short_commit_sha "${short_commit_sha}" \
  --arg published_at "${published_text}" \
  --arg extension_asset_name "${extension_asset_name}" \
  --arg extension_asset_url "${extension_asset_url}" \
  --arg achievement_summary "${release_achievements_summary}" \
  --arg summary "${release_summary}" \
  '{
    text: ("Chrome extension release " + $tag),
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: ("Quantum Vault " + $tag + " released")
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: (
            "*Release:* <" + $release_url + "|" + $release_title + ">\n" +
            "*Commit:* <" + $commit_url + "|" + $short_commit_sha + ">\n" +
            "*Published:* " + $published_at +
            (if ($extension_asset_url | length) > 0
             then "\n*Extension:* <" + $extension_asset_url + "|" + $extension_asset_name + ">"
             else ""
             end)
          )
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ("*Summary*\n" + $achievement_summary)
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: $summary
        }
      }
    ]
  }'
)"

slack_response_file="$(mktemp)"
slack_status="$(
  curl -sS -o "${slack_response_file}" -w '%{http_code}' -X POST \
    -H 'Content-Type: application/json' \
    --data "${payload}" \
    "${SLACK_RELEASE_WEBHOOK_URL}" || true
)"

if [[ ! "${slack_status}" =~ ^2[0-9][0-9]$ ]]; then
  slack_response="$(head -c 200 "${slack_response_file}" | tr '\n' ' ')"
  rm -f "${slack_response_file}"

  echo "::warning::Slack release notification failed with HTTP ${slack_status:-unknown}. Response: ${slack_response:-empty}. The GitHub release was already created."
  exit 0
fi

rm -f "${slack_response_file}"

echo "Posted Slack release notification for ${release_tag}."
