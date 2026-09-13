#!/usr/bin/env bash
# One-shot: validate the token, create the repo, push, verify, clean up.
# The token is never written into .git/config and is masked in all output.
set -uo pipefail

: "${GITHUB_TOKEN:?}"
REPO="${REPO:-arena-github-vercel}"
PRIVATE="${PRIVATE:-0}"
API=https://api.github.com

api() { curl -s -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" "$@"; }
mask() { sed -e "s/${GITHUB_TOKEN}/***TOKEN***/g"; }

echo "== 1. token =="
resp=$(api "$API/user")
login=$(printf '%s' "$resp" | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin); print(d.get("login",""))
except Exception: print("")')
if [ -z "$login" ]; then
  echo "   REJECTED — GitHub said:"
  printf '%s' "$resp" | head -c 400 | mask
  exit 1
fi
echo "   authenticated as: $login"

echo
echo "== 2. create repository =="
priv=$([ "$PRIVATE" = "1" ] && echo true || echo false)
body=$(python3 -c 'import json,sys;print(json.dumps({
  "name": sys.argv[1], "private": sys.argv[2]=="true",
  "description": "Huxley Jewelry Creations - handcrafted silver & gold jewelry website with appointment booking and an admin portal."}))' "$REPO" "$priv")
code=$(api -o /tmp/gh_repo.json -w '%{http_code}' -X POST "$API/user/repos" -d "$body")
echo "   HTTP $code"
case "$code" in
  201) echo "   repo created (private=$priv)" ;;
  422) echo "   repo already exists - pushing into it" ;;
  *)   echo "   could not create the repo. GitHub said:"; head -c 400 /tmp/gh_repo.json | mask ;;
esac

echo
echo "== 3. push =="
cd /home/user
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/${login}/${REPO}.git"
b64=$(printf '%s' "x-access-token:${GITHUB_TOKEN}" | base64 -w0)
git -c http.extraheader="Authorization: Basic ${b64}" push -u origin main 2>&1 | mask
echo "   push exit: ${PIPESTATUS[0]}"

echo
echo "== 4. verify what GitHub is holding =="
api "$API/repos/${login}/${REPO}" | python3 -c 'import sys,json
d=json.load(sys.stdin)
print("   repo   :", d.get("full_name"), "| private:", d.get("private"))
print("   url    :", d.get("html_url"))
print("   default:", d.get("default_branch"))' 2>/dev/null
api "$API/repos/${login}/${REPO}/commits?per_page=5" | python3 -c 'import sys,json
for c in json.load(sys.stdin):
    print("   commit :", c["sha"][:7], c["commit"]["message"].splitlines()[0])' 2>/dev/null
api "$API/repos/${login}/${REPO}/contents/" | python3 -c 'import sys,json
names=[x["name"] for x in json.load(sys.stdin)]
print("   files  :", len(names), "-", ", ".join(sorted(names)[:12]))' 2>/dev/null

echo
echo "== 5. cleanup =="
git config --local --unset-all http.extraheader 2>/dev/null && echo "   removed temp auth header" || echo "   no temp auth header left"
rm -f /tmp/gh_repo.json
if git remote -v | grep -q "$GITHUB_TOKEN"; then echo "   !! token still in remote config"; else echo "   remote config is clean:"; git remote -v | mask; fi
echo "   token still visible in this session's shell only - not stored anywhere on disk"
