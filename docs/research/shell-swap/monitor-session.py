#!/usr/bin/env python3
"""Watch the OpenCode shell-swap session; exit when the dispatch round settles.
The dispatch was ONE prompt, so the FIRST idle after PROMPT_TS ends the round.
Exit triggers a terminal notification; Hermes then verifies or re-dispatches."""
import json, subprocess, time, sys, os

SES = "ses_e0749652dffe1Y31a4pP5e1qLG"
OC = os.path.expanduser("~/.opencode/bin/opencode")
PROMPT_TS = 1795250656894
DEADLINE = time.time() + 4 * 3600
CKPT = "/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT/docs/research/shell-swap/checkpoint.md"
# The worker may end a round early (free-model habit). If the round settles but
# the brief's final phases are not evidenced on disk, re-prompt the SAME session
# to continue, up to MAX_ROUNDS. Context survives; checkpoint.md re-orients it.
MAX_ROUNDS = 12
CONTINUE = ("Continue the RESUME task (mobile Maestro flow contract update + 8 flows green + side-by-sides) "
            "from where you stopped. Read docs/research/shell-swap/checkpoint.md FIRST. "
            "Do not redo completed steps. Only report done when the mobile flow passes with full coverage "
            "AND all 8 flows are 0 FAILED AND side-by-sides are composed.")

def api(path):
    try:
        r = subprocess.run([OC, "api", "GET", path], capture_output=True, text=True, timeout=60)
        return json.loads(r.stdout)
    except Exception:
        return None

def post(path, payload):
    try:
        r = subprocess.run([OC, "api", "POST", path, "-d", json.dumps(payload)],
                           capture_output=True, text=True, timeout=120)
        return r.stdout[:200]
    except Exception as e:
        return str(e)

def gates_done():
    """RESUME completion: mobile flow passes with full coverage (Hermes runs it),
    all 8 flows 0 FAILED, side-by-sides composed. Verify by RUNNING, not by text."""
    base = os.path.dirname(CKPT)
    repo = os.path.abspath(os.path.join(base, "..", "..", ".."))
    flow = os.path.join(repo, "maestro", "www-paint-mobile-ui-audit.yaml")
    try:
        f = open(flow).read()
        if not ("Drawing" in f and "Stroke Min" in f and "UI SETTINGS" in f):
            return False
    except Exception:
        return False
    # run the mobile flow ourselves
    env = dict(os.environ,
               PATH=os.path.expanduser("~/.maestro/bin") + ":" + os.environ.get("PATH", ""),
               CHROME_BINARY="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    try:
        jh = subprocess.run(["/usr/libexec/java_home"], capture_output=True, text=True, timeout=30)
        env["JAVA_HOME"] = jh.stdout.strip()
    except Exception:
        pass
    log = os.path.join(base, "gates", "MONITOR-mobile-ui-audit.log")
    try:
        with open(log, "w") as lf:
            r = subprocess.run(["maestro", "test", "--headless", "--screen-size", "390x844", flow],
                               stdout=lf, stderr=subprocess.STDOUT, timeout=420, env=env, cwd=repo)
        out = open(log).read()
        comp = out.count("COMPLETED"); fail = out.count("FAILED")
        print(f"gates_done: mobile flow COMPLETED={comp} FAILED={fail} exit={r.returncode}", flush=True)
        if fail > 0 or comp < 20:
            return False
    except Exception as e:
        print("gates_done: flow run error", e, flush=True)
        return False
    sbs = [x for x in os.listdir(base) if x.startswith("side-by-side") and x.endswith(".png")] if os.path.isdir(base) else []
    return len(sbs) >= 3

rounds = 0
watch_ts = PROMPT_TS
while time.time() < DEADLINE:
    d = api(f"/api/session/{SES}/message")
    if d:
        msgs = d.get("data", [])
        idles = [m for m in msgs if m.get("type") == "idle" and m.get("time", {}).get("created", 0) > watch_ts]
        if idles:
            newest = max(idles, key=lambda m: m["time"]["created"])
            outcome = newest.get("outcome")
            asst = [m for m in msgs if m.get("type") == "assistant" and m.get("time", {}).get("created", 0) > watch_ts]
            tail = ""
            if asst:
                last = max(asst, key=lambda m: m["time"]["created"])
                texts = [c.get("text", "") for c in last.get("content", []) if c.get("type") == "text"]
                tail = "\n".join(texts)[-1200:]
            print(f"ROUND {rounds+1} SETTLED: outcome={outcome}", flush=True)
            if outcome == "failed":
                print("ERROR:", json.dumps(newest.get("error", {}))[:600], flush=True)
            print("LAST ASSISTANT TEXT TAIL:\n" + tail, flush=True)
            if gates_done():
                try:
                    ck = open(CKPT).read()
                    print("CHECKPOINT TAIL:\n" + ck[-800:], flush=True)
                except Exception:
                    pass
                print("MONITOR EXIT: final-phase evidence present", flush=True)
                sys.exit(0)
            rounds += 1
            if rounds >= MAX_ROUNDS:
                print("MONITOR EXIT: max rounds reached without final evidence", flush=True)
                sys.exit(2)
            # failed round with poisoned history won't recover by re-prompt; bail for Hermes
            if outcome == "failed":
                err = json.dumps(newest.get("error", {}))
                if "reasoning_details" in err or "invalid-request" in err:
                    print("MONITOR EXIT: poisoned session history — needs fresh session", flush=True)
                    sys.exit(3)
            watch_ts = newest["time"]["created"]
            print(post(f"/api/session/{SES}/prompt", {"text": CONTINUE}), flush=True)
            time.sleep(30)
    time.sleep(45)
print("MONITOR EXIT: 4h deadline reached", flush=True)
sys.exit(2)
