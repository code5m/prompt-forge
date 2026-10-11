#!/usr/bin/env python3
"""Build a lightweight, path-only catalog for local image/video review."""
from pathlib import Path
import datetime
import json

ROOT = Path(__file__).resolve().parent.parent
MEDIA_ROOT = ROOT / "images"
MEDIA_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".mov", ".webm", ".mkv"}
PROMPT_NAMES = {"提示词.md", "i2v_prompts.txt", "prompts.txt", "prompt.txt"}

def sidecars(path):
    found = []
    for parent in [path.parent, *path.parents]:
        if parent == ROOT.parent:
            break
        for name in PROMPT_NAMES:
            candidate = parent / name
            if candidate.is_file():
                found.append(candidate.relative_to(ROOT).as_posix())
        if parent == MEDIA_ROOT:
            break
    return list(dict.fromkeys(found))

records = []
for path in sorted(MEDIA_ROOT.rglob("*")):
    if path.is_file() and path.suffix.lower() in MEDIA_EXTENSIONS:
        stat = path.stat()
        kind = "video" if path.suffix.lower() in {".mp4", ".mov", ".webm", ".mkv"} else "image"
        records.append({"id": path.relative_to(ROOT).as_posix(), "path": path.relative_to(ROOT).as_posix(), "name": path.name, "kind": kind, "extension": path.suffix.lower().lstrip("."), "bytes": stat.st_size, "promptFiles": sidecars(path), "review": "pending", "reviewNote": ""})

output = ROOT / "workbench" / "media-index.json"
output.write_text(json.dumps({"schema": "prompt-forge/media-index/v1", "generatedAt": datetime.datetime.now().isoformat(timespec="seconds"), "workspaceHint": "Resolve paths relative to the workspace root; media bytes are intentionally not uploaded.", "reviewStates": ["pending", "approved", "needs-attention", "rejected"], "records": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"indexed {len(records)} media files -> {output}")
