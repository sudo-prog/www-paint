#!/usr/bin/env python3
"""Background visual review via local Ollama qwen3-vl /api/chat.
Posts each downscaled screenshot with a short targeted prompt, appends results
with latency to vision-review.md. Runs in background; partial results survive."""
import json, base64, time, urllib.request, os, sys

BASE = "/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT/docs/research/shell-swap"
SHOTS = [
    ("hermes-verify/hermes-expanded-1440.png",
     "This is a 1440x900 app screenshot. Look at the BOTTOM-CENTRE pill toolbar. Do all buttons fit INSIDE the pill with even spacing, or do any buttons overflow outside the pill or touch each other? Then look at the two side panels: are all rows and sliders aligned in straight columns with consistent heights, or are some chunkier/misaligned? Answer as a numbered list of concrete defects with screen positions, or 'no defects'. Be specific and short."),
    ("hermes-verify/hermes-navbar-1440.png",
     "This is a 1440x900 app screenshot in navbar mode. Look at the BOTTOM-CENTRE pill toolbar and the bottom-right controls bar. Is the pill centred with all buttons inside it? Are the bottom-right controls a single clean row or a wrapped messy stack? List concrete defects with positions, or 'no defects'. Short answer."),
    ("hermes-verify/hermes-navbar-390.png",
     "This is a 390x844 mobile app screenshot. Look at the top controls row and the bottom pills. Are any labels clipped or cut off? Are any buttons overflowing their pill or overlapping? Is the text style consistent? List concrete defects with positions, or 'no defects'. Short answer."),
    ("oracle/parity-expanded-1440.png",
     "This is the REFERENCE app screenshot at 1440x900. Describe ONLY the bottom-centre pill toolbar: its approximate width, the number and shape of its buttons, and how the buttons are spaced. Also describe the side panel row style in one sentence. Short factual answer."),
]
OUT = os.path.join(BASE, "vision-review.md")
with open(OUT, "w") as f:
    f.write("# Visual review (local qwen3-vl, /api/chat, 700px images)\n\n")

for rel, prompt in SHOTS:
    path = os.path.join(BASE, rel)
    small = "/tmp/vr-" + os.path.basename(rel)
    os.system(f"sips -Z 700 '{path}' --out '{small}' >/dev/null 2>&1")
    img = base64.b64encode(open(small, "rb").read()).decode()
    payload = {
        "model": "qwen3-vl:4b-instruct",
        "messages": [{"role": "user", "content": prompt, "images": [img]}],
        "stream": False,
        "options": {"num_predict": 350, "num_ctx": 4096, "temperature": 0.1},
    }
    data = json.dumps(payload).encode()
    t0 = time.time()
    try:
        req = urllib.request.Request("http://localhost:11434/api/chat", data=data,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=400) as r:
            reply = json.loads(r.read())
        text = reply.get("message", {}).get("content", "")
        err = reply.get("error", "")
    except Exception as e:
        text, err = "", f"ERROR {e}"
    dt = time.time() - t0
    with open(OUT, "a") as f:
        f.write(f"===== {rel} ({dt:.0f}s) =====\n{text}\n{err}\n\n")
        f.flush()
    print(f"done {rel} {dt:.0f}s", flush=True)
print("VISION REVIEW COMPLETE", flush=True)
