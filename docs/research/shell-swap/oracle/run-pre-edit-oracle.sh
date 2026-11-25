#!/bin/bash
# Pre-edit oracle for the shell swap — run from repo root. Writes to docs/research/shell-swap/oracle/pre-edit/
set -u
ROOT=/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT
OUT=$ROOT/docs/research/shell-swap/oracle/pre-edit
mkdir -p "$OUT"
cd "$ROOT"
export NODE_PATH=/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules
export PATH="$HOME/.maestro/bin:$PATH"
export JAVA_HOME="$(/usr/libexec/java_home)"
export CHROME_BINARY="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

echo "=== UNIT TESTS ===" | tee "$OUT/summary.txt"
for t in engine wetsim masks outlines order shaping ref-analyze style-library export-panel style-polish modular-bridge modular-switch; do
  if [ -f "tests/$t.test.js" ]; then
    node "tests/$t.test.js" > "$OUT/test-$t.log" 2>&1
    ec=$?
    line=$(grep -E "Passed|Failed|passed|failed" "$OUT/test-$t.log" | tail -2 | tr '\n' ' ')
    echo "$t exit=$ec :: $line" | tee -a "$OUT/summary.txt"
  fi
done

echo "=== VISUAL REGRESSION ===" | tee -a "$OUT/summary.txt"
node scripts/visual-regression.cjs > "$OUT/visual-regression.log" 2>&1
ec=$?
tail -3 "$OUT/visual-regression.log" | tee -a "$OUT/summary.txt"
echo "visual-regression exit=$ec" | tee -a "$OUT/summary.txt"

echo "=== ENGINE FILE HASHES ===" | tee -a "$OUT/summary.txt"
shasum -a 256 js/engine/*.js js/styles/*.js > "$OUT/engine-hashes.txt"
wc -l "$OUT/engine-hashes.txt" | tee -a "$OUT/summary.txt"

echo "=== MAESTRO FLOWS (own widths) ===" | tee -a "$OUT/summary.txt"
run_flow() {
  local flow="$1"; local size="$2"
  maestro test --headless --screen-size "$size" "maestro/$flow" > "$OUT/maestro-$flow.log" 2>&1
  local ec=$?
  local comp=$(grep -c "COMPLETED" "$OUT/maestro-$flow.log" || true)
  local fail=$(grep -c "FAILED" "$OUT/maestro-$flow.log" || true)
  echo "$flow @$size exit=$ec COMPLETED=$comp FAILED=$fail" | tee -a "$OUT/summary.txt"
}
run_flow www-paint-desktop-regression.yaml 1440x900
run_flow www-paint-mobile-ui-audit.yaml 390x844
run_flow www-paint-media-panel.yaml 390x844
run_flow www-paint-export-panel.yaml 1440x900

echo "=== BEFORE SCREENSHOTS ===" | tee -a "$OUT/summary.txt"
node "$ROOT/docs/research/shell-swap/oracle/before-shots.mjs" > "$OUT/before-shots.log" 2>&1
echo "before-shots exit=$?" | tee -a "$OUT/summary.txt"
echo "ORACLE DONE" | tee -a "$OUT/summary.txt"
