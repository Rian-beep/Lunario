#!/usr/bin/env bash
# Smoke-check the live GitHub Pages deploy for Lunario Dashboard + offline navigator.
# Exit 0 only when the homepage embeds the navigator (post Agent A merge).
# Against today's placeholder homepage this script is expected to FAIL.
set -euo pipefail

BASE_URL="${LUNARIO_PAGES_BASE:-https://rian-beep.github.io/Lunario}"
INDEX_URL="${BASE_URL}/"
ABOUT_URL="${BASE_URL}/about.html"
NAV_URL="${BASE_URL}/navigator/public/solarreach-navigator.html"

PASS=0
FAIL=0

pass() {
  echo "PASS: $*"
  PASS=$((PASS + 1))
}

fail() {
  echo "FAIL: $*"
  FAIL=$((FAIL + 1))
}

echo "Lunario Pages smoke check"
echo "Base: ${BASE_URL}"
echo

INDEX_TMP="$(mktemp)"
NAV_TMP="$(mktemp)"
trap 'rm -f "${INDEX_TMP}" "${NAV_TMP}"' EXIT

# --- Index (Dashboard) ---
INDEX_CODE="$(curl -sS -L -o "${INDEX_TMP}" -w "%{http_code}" "${INDEX_URL}" || true)"
INDEX_SIZE="$(wc -c < "${INDEX_TMP}" | tr -d ' ')"

if [[ "${INDEX_CODE}" == "200" ]]; then
  pass "index HTTP 200 (${INDEX_SIZE} bytes) — ${INDEX_URL}"
else
  fail "index HTTP ${INDEX_CODE} (expected 200) — ${INDEX_URL}"
fi

if grep -q "Placeholder layout" "${INDEX_TMP}"; then
  fail "index still contains 'Placeholder layout' (Dashboard embed not live yet)"
else
  pass "index no longer contains 'Placeholder layout'"
fi

if grep -q "navigator-frame" "${INDEX_TMP}"; then
  pass "index contains 'navigator-frame'"
else
  fail "index missing 'navigator-frame' (expected after Dashboard embed PR)"
fi

if grep -q "solarreach-navigator.html" "${INDEX_TMP}"; then
  pass "index references 'solarreach-navigator.html'"
else
  fail "index missing 'solarreach-navigator.html' (expected after Dashboard embed PR)"
fi

# --- About ---
ABOUT_CODE="$(curl -sS -L -o /dev/null -w "%{http_code}" "${ABOUT_URL}" || true)"
if [[ "${ABOUT_CODE}" == "200" ]]; then
  pass "about HTTP 200 — ${ABOUT_URL}"
else
  fail "about HTTP ${ABOUT_CODE} (expected 200) — ${ABOUT_URL}"
fi

# --- Offline navigator (large static bundle; ~78–81MB) ---
echo "Fetching offline navigator (large; may take a few seconds)…"
NAV_CODE="$(curl -sS -L -o "${NAV_TMP}" -w "%{http_code}" "${NAV_URL}" || true)"
NAV_SIZE="$(wc -c < "${NAV_TMP}" | tr -d ' ')"

if [[ "${NAV_CODE}" == "200" ]]; then
  pass "offline navigator HTTP 200 (${NAV_SIZE} bytes) — ${NAV_URL}"
else
  fail "offline navigator HTTP ${NAV_CODE} (expected 200) — ${NAV_URL}"
fi

echo
echo "Summary: ${PASS} passed, ${FAIL} failed"
if [[ "${FAIL}" -gt 0 ]]; then
  echo "RESULT: FAIL"
  exit 1
fi

echo "RESULT: PASS"
exit 0
