#!/usr/bin/env bash
# Builds the unsigned macOS arm64 dmg for a vX.Y.Z-ja tag in a throwaway clone of a VMPal VM
# and publishes it to the fork's GitHub Releases. Usage: apps/web/vite/ja/release.sh v0.1.3-ja
# DRY_RUN=1 builds into ./release-<tag> without publishing.
# The build VM (T3CODE_JA_BUILD_VM) is a shut-down macOS VM with Xcode Command Line Tools,
# Node (from package.json's engines) and vite-plus installed; vmpal run clones it per build.
set -euo pipefail

TAG="${1:?usage: release.sh vX.Y.Z-ja}"
REPO="${T3CODE_JA_REPO:-mtaro346/t3code}"
BUILD_VM="${T3CODE_JA_BUILD_VM:-T3 Code ja build}"
VMPAL=(/Applications/VMPal.app/Contents/Helpers/VMPalMachine.app/Contents/MacOS/VMPalMachine --cli)
VERSION="${TAG#v}"
VERSION="${VERSION%-ja}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Unexpected tag: $TAG" >&2; exit 1; }

if [[ -z "${DRY_RUN:-}" ]] && gh release view "$TAG" -R "$REPO" >/dev/null 2>&1; then
  echo "$TAG is already released."
  exit 0
fi

root="$(git rev-parse --show-toplevel)"
work="$(mktemp -d "${TMPDIR:-/tmp}/t3code-ja-release.XXXXXX")"
trap 'rm -rf "$work"' EXIT

git -C "$root" fetch --quiet --force "https://github.com/$REPO.git" "refs/tags/$TAG:refs/tags/$TAG"
git -C "$root" archive --format=tar.gz -o "$work/src.tgz" "$TAG"

# Unsigned apps cannot take Squirrel.Mac updates, so the build ships without an update feed.
build='set -euo pipefail
mkdir -p src out && tar -xzf src.tgz -C src && cd src
vp install
node apps/web/vite/ja/translate.check.ts
missing="$(node apps/web/vite/ja/extract.ts)"
[[ "$missing" == "[]" ]] || echo "warning: untranslated UI text ships in English: $missing" >&2
node scripts/update-release-package-versions.ts "'"$VERSION"'"
node scripts/build-desktop-artifact.ts --platform mac --target dmg --arch arm64 \
  --build-version "'"$VERSION"'" --output-dir "$HOME/out"'

"${VMPAL[@]}" run "$BUILD_VM" --in-background --timeout 90m \
  --copy-in "$work/src.tgz:src.tgz" --copy-out "out:$work/out" \
  -- /bin/zsh -lc "$build"

dmg="$(ls "$work"/out/*.dmg)"
if [[ -n "${DRY_RUN:-}" ]]; then
  mkdir -p "release-$TAG" && cp "$dmg" "release-$TAG/"
  echo "Built release-$TAG/$(basename "$dmg") (not published)"
  exit 0
fi
notes="公式 [v$VERSION](https://github.com/pingdotgg/t3code/releases/tag/v$VERSION) の日本語版です。署名していないため、初回は Finder でアプリを右クリックして「開く」を選んでください。アプリ内の自動更新は使えないので、新しい版はこのページから dmg をダウンロードしてください。"
gh release create "$TAG" "$dmg" -R "$REPO" --verify-tag \
  --title "T3 Code $VERSION 日本語版" --notes "$notes" --latest
echo "Released $TAG"
