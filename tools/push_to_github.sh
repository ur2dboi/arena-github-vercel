#!/usr/bin/env bash
# ------------------------------------------------------------------
# Create the GitHub repo (if needed) and push this project to it.
#
#   GITHUB_TOKEN=ghp_xxx GITHUB_USER=yourname REPO=arena-github-vercel \
#     ./tools/push_to_github.sh            # public repo
#
#   PRIVATE=1 ... ./tools/push_to_github.sh   # private repo
#
# The token is used only in memory and is stripped from .git/config
# again as soon as the push finishes.
# ------------------------------------------------------------------
set -euo pipefail

: "${GITHUB_TOKEN:?Set GITHUB_TOKEN (a GitHub token with repo scope)}"
: "${GITHUB_USER:?Set GITHUB_USER (your GitHub username)}"
REPO="${REPO:-arena-github-vercel}"
PRIVATE="${PRIVATE:-0}"

API="https://api.github.com"
AUTH=(-H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json")

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ---------- 1. who are we talking to? ----------
say "1/4  Checking the token"
who=$(curl -sf "${AUTH[@]}" "$API/user" | python3 -c 'import sys,json; print(json.load(sys.stdin)["login"])') || {
  echo "   ✗ GitHub rejected the token (401). It may be expired, mistyped, or missing the 'repo' scope."
  exit 1
}
echo "   ✓ authenticated as $who"

# ---------- 2. create the repository ----------
say "2/4  Creating $GITHUB_USER/$REPO (or reusing it if it already exists)"
priv=$([ "$PRIVATE" = "1" ] && echo true || echo false)
code=$(curl -s -o /tmp/gh_repo.json -w '%{http_code}' -X POST "${AUTH[@]}" "$API/user/repos" -d "$(python3 - "$REPO" "$priv" <<'PY'
import json, sys
print(json.dumps({
    "name": sys.argv[1],
    "private": sys.argv[2] == "true",
    "description": "Huxley Jewelry Creations — handcrafted silver & gold jewelry website with appointment booking and an admin portal.",
    "has_issues": True, "has_wiki": False, "has_projects": False,
}))
PY
)")
case "$code" in
  201) echo "   ✓ repository created" ;;
  422) echo "   • repository already exists — pushing into it" ;;
  403) echo "   ✗ the token cannot create repositories."
       echo "     Either create an empty repo named '$REPO' yourself at github.com/new,"
       echo "     then re-run this script, or use a classic token with the 'repo' scope."
       exit 1 ;;
  *)   echo "   ✗ unexpected response ($code):"; sed 's/^/     /' /tmp/gh_repo.json; exit 1 ;;
esac

# ---------- 3. push ----------
say "3/4  Pushing the main branch"
git remote remove origin 2>/dev/null || true
git remote add origin "https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${REPO}.git"
git push -u origin main
echo "   ✓ pushed"

# ---------- 4. remove the token from the remote ----------
git remote set-url origin "https://github.com/${GITHUB_USER}/${REPO}.git"
remotes=$(git remote -v | grep -c "$GITHUB_TOKEN" || true)
say "4/4  Cleaning up"
[ "$remotes" = "0" ] && echo "   ✓ token removed from .git/config" || echo "   ! check .git/config manually"

say "Done → https://github.com/$GITHUB_USER/$REPO"
echo "Remember to revoke the token at github.com/settings/tokens once you are finished."
echo
echo "Next: vercel.com → Add New → Project → Import Git Repository → $REPO"
echo "      Framework Preset: Other · build command and output directory: leave empty"
