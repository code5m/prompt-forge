#!/usr/bin/env python3
"""Bounded resumable multimodal audit. Never marks provenance human-confirmed."""
from pathlib import Path
from urllib.request import Request,urlopen
from PIL import Image,ImageOps
from io import BytesIO
import subprocess,json,re,base64,time,os,hashlib
base=Path(__file__).resolve().parents[1]
root=Path(os.environ.get("PROMPT_FORGE_WORKSPACE_ROOT","/home/ainfinit/hot-prompts")).resolve()
manifest=json.loads((base/".local/governance/asset-manifest.json").read_text())["records"]
out=base/".local/governance/vision-audit.json"
data=json.loads(out.read_text()) if out.exists() else {"schema":1,"records":{},"errors":{}}
keyfile=Path.home()/".config/prompt-forge/sensenova.env"
key=re.search(r"^SENSENOVA_API_KEY=(.*)$",keyfile.read_text(),re.M).group(1).strip().strip("'\"")
def capture(a):
 p=(root/a["sourcePath"]).resolve(strict=True)
 if not p.is_relative_to(root/"images"):raise ValueError("outside source")
 if a["kind"]=="image":
  im=ImageOps.exif_transpose(Image.open(p));im.thumbnail((480,480));b=BytesIO();im.convert("RGB").save(b,"JPEG",quality=63);return base64.b64encode(b.getvalue()).decode()
 t=float(a.get("metadata",{}).get("duration") or 1)*0.5
 run=subprocess.run(["ffmpeg","-nostdin","-loglevel","error","-ss",str(t),"-i",str(p),"-vframes","1","-vf","scale=480:480:force_original_aspect_ratio=decrease","-f","image2pipe","-vcodec","mjpeg","pipe:1"],capture_output=True,timeout=25)
 if run.returncode or not run.stdout:raise ValueError("no video frame")
 return base64.b64encode(run.stdout).decode()
def main():
 limit=int(os.environ.get("VISION_LIMIT","12"));done=0
 for a in manifest:
  if done>=limit:break
  if data["records"].get(a["id"],{}).get("sha256")==a["sha256"]:continue
  done+=1
  try:
   hints=[{"source":s["sourcePath"],"scope":s["scope"],"en":s["originalEnglish"][:1300]} for s in a["relationCandidates"]][:3]
   message="请根据图片/视频中间帧，描述实际视觉内容并审查候选提示词的相关性。候选不等于原始生成提示词；如无足够文本请标记unknown。只返回合法JSON：{\"relation\":\"related|partial|mismatch|unknown\",\"confidence\":0,\"observed\":\"中文可见事实\",\"reason\":\"中文解释\"}。候选："+json.dumps(hints,ensure_ascii=False)
   payload={"model":"sensenova-6.8-flash-lite","temperature":0.1,"max_tokens":600,"messages":[{"role":"user","content":[{"type":"text","text":message},{"type":"image_url","image_url":{"url":"data:image/jpeg;base64,"+capture(a)}}]}]}
   req=Request("https://token.sensenova.cn/v1/chat/completions",data=json.dumps(payload).encode(),headers={"Content-Type":"application/json","Authorization":"Bearer "+key},method="POST")
   with urlopen(req,timeout=100) as f:response=json.load(f)
   raw=response.get("choices",[{}])[0].get("message",{}).get("content")
   if not isinstance(raw,str) or not raw.strip():raise ValueError("model returned no textual review")
   raw=raw.strip()
   try:review=json.loads(raw)
   except:review=json.loads(raw[raw.find("{"):raw.rfind("}")+1])
   if review.get("relation") not in ("related","partial","mismatch","unknown"):raise ValueError("invalid answer")
   if not any(h.get("en") for h in hints):review["relation"]="unknown"
   data["records"][a["id"]]={"sha256":a["sha256"],"review":review,"humanConfirmed":False,"model":"sensenova-6.8-flash-lite","frameCount":1}
   data["errors"].pop(a["id"],None)
  except Exception as e:data["errors"][a["id"]]=type(e).__name__+":"+str(e)[:120]
  tmp=out.with_suffix(".json.tmp");tmp.write_text(json.dumps(data,ensure_ascii=False));os.replace(tmp,out)
  print("PROGRESS",done,len(data["records"]),len(data["errors"]),flush=True)
  time.sleep(0.3)
if __name__=="__main__":main()
