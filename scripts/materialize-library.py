#!/usr/bin/env python3
"""Build read-only canonical symlink tree; preserve all original paths."""
from pathlib import Path
import json,os,collections
project=Path(__file__).resolve().parents[1]
root=Path(os.environ.get("PROMPT_FORGE_WORKSPACE_ROOT","/home/ainfinit/hot-prompts")).resolve()
manifest=json.loads((project/".local/governance/asset-manifest.json").read_text())["records"]
managed=project/".local/governance/managed"
counts=collections.Counter()
mapping=[]
for item in manifest:
 source=(root/item["sourcePath"]).resolve(strict=True)
 if not source.is_relative_to(root/"images"):raise RuntimeError("invalid source")
 proposed=item["suggestedPath"]
 target=managed/proposed
 target.parent.mkdir(parents=True,exist_ok=True)
 if target.is_symlink():
  if target.resolve()!=source:raise RuntimeError("conflicting mapped file")
 elif target.exists():raise RuntimeError("occupied destination")
 else:target.symlink_to(source)
 mapping.append({"id":item["assetId"],"original":item["sourcePath"],"managed":str(target.relative_to(managed)),"type":"symlink","sourceUnchanged":True})
 counts[item["kind"]]+=1
out=project/".local/governance/migration-applied.json"
tmp=out.with_suffix(".json.tmp")
tmp.write_text(json.dumps({"schema":1,"strategy":"non-destructive symlinks; undo by deleting managed directory","count":len(mapping),"totals":counts,"records":mapping},ensure_ascii=False,indent=2))
tmp.replace(out)
print(json.dumps({"count":len(mapping),"totals":counts,"managed":str(managed),"originalsModified":False},ensure_ascii=False))
