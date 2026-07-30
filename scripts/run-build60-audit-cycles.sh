#!/usr/bin/env bash
set -u
mkdir -p validation/build60-audits
: > validation/build60-audits/status.log
for cycle in 1 2 3; do
  echo "START $cycle $(date -u +%FT%TZ)" >> validation/build60-audits/status.log
  if npm run validate:full > "validation/build60-audits/cycle-${cycle}.log" 2>&1; then
    echo "PASS $cycle $(date -u +%FT%TZ)" >> validation/build60-audits/status.log
  else
    rc=$?
    echo "FAIL $cycle $rc $(date -u +%FT%TZ)" >> validation/build60-audits/status.log
    exit "$rc"
  fi
done
echo 0 > validation/build60-audits/exit-code
