#!/usr/bin/env bash
# Builds the unsigned macOS arm64 dmg for a vX.Y.Z-ja tag on this Mac and publishes it to the
# fork's GitHub Releases. Usage: apps/web/vite/ja/release.sh v0.1.3-ja
set -euo pipefail

TAG="${1:?usage: release.sh vX.Y.Z-ja}"
REPO="${T3CODE_JA_REPO:-mtaro346/t3code}"
VERSION="${TAG#v}"
VERSION="${VERSION%-ja}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Unexpected tag: $TAG" >&2; exit 1; }

root="$(git rev-parse --show-toplevel)"
cd "$root"
export PATH="$root/node_modules/.bin:$PATH"

if gh release view "$TAG" -R "$REPO" >/dev/null 2>&1; then
  echo "$TAG is already released."
  exit 0
fi

# Build from a throwaway worktree so the caller's checkout is never touched.
git fetch --quiet --force "https://github.com/$REPO.git" "refs/tags/$TAG:refs/tags/$TAG"
work="$(mktemp -d "${TMPDIR:-/tmp}/t3code-ja-release.XXXXXX")"
trap 'git -C "$root" worktree remove --force "$work/src" >/dev/null 2>&1 || true; rm -rf "$work"' EXIT
git worktree add --quiet --detach "$work/src" "$TAG"
cd "$work/src"
export PATH="$work/src/node_modules/.bin:$PATH"

vp install
node apps/web/vite/ja/translate.check.ts
missing="$(node apps/web/vite/ja/extract.ts)"
[[ "$missing" == "[]" ]] || echo "warning: untranslated UI text ships in English: $missing" >&2

node scripts/update-release-package-versions.ts "$VERSION"
# Unsigned apps cannot take Squirrel.Mac updates, so ship without an update feed.
env -u GITHUB_REPOSITORY -u T3CODE_DESKTOP_UPDATE_REPOSITORY \
  node scripts/build-desktop-artifact.ts --platform mac --target dmg --arch arm64 \
  --build-version "$VERSION" --output-dir "$work/release"

dmg="$(ls "$work"/release/*.dmg)"
notes="公式 [v$VERSION](https://github.com/pingdotgg/t3code/releases/tag/v$VERSION) の日本語版です。署名していないため、初回は Finder でアプリを右クリックして「開く」を選んでください。アプリ内の自動更新は使えないので、新しい版はこのページから dmg をダウンロードしてください。"
gh release create "$TAG" "$dmg" -R "$REPO" --verify-tag \
  --title "T3 Code $VERSION 日本語版" --notes "$notes" --latest
echo "Released $TAG"
