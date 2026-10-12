#!/usr/bin/env python3
"""Read-only inventory, reproducible relation evidence and non-destructive migration mapping."""
from pathlib import Path, PurePosixPath
from PIL import Image
from collections import Counter,defaultdict
import subprocess,json,hashlib,os,re,datetime,unicodedata
PROJECT=Path(__file__).resolve().parents[1]
ROOT=Path(os.environ.get('PROMPT_FORGE_WORKSPACE_ROOT','/home/ainfinit/hot-prompts')).resolve()
OUT=Path(os.environ.get('PROMPT_FORGE_GOVERNANCE_DIR',PROJECT/'.local/governance')).resolve()
INDEX=json.loads((PROJECT/'media-index.json').read_text())['records']
CATEGORY={'ceshi':'研究实验','卡通动漫':'动漫插画','女性':'女性角色','性感':'人物摄影','真人真物':'写实摄影','绘画插画':'艺术插画','非真实主体':'非真实主体'}
def slug(v):
 s=re.sub(r'[^a-zA-Z0-9_-]+','-',unicodedata.normalize('NFKC',v)).strip('-').lower()
 return s[:35] or hashlib.sha1(v.encode()).hexdigest()[:10]
def relative(p):
 r=p.resolve()
 if not r.is_relative_to(ROOT/'images'):raise ValueError('Media escaped source root')
 return str(r.relative_to(ROOT).as_posix())
def sample_sidecar(p):
 txt=p.read_text('utf8',errors='replace')[:20000]
 en=re.search(r'\*\*EN:\*\*\s*([\s\S]*?)(?:\*\*中文[:：]?\*\*|$)',txt,re.I)
 zh=re.search(r'\*\*中文[:：]?\*\*\s*([\s\S]*?)(?:\n\n|$)',txt)
 return {'english':en.group(1).strip() if en else '', 'chinese':zh.group(1).strip() if zh else '', 'textLength':len(txt)}
def media_metadata(path,kind):
 if kind=='image':
  try:
   with Image.open(path) as im:return {'width':im.width,'height':im.height,'format':im.format}
  except Exception as e:return {'metadataError':type(e).__name__}
 try:
  probe=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration:stream=width,height,codec_type','-of','json',str(path)],capture_output=True,text=True,timeout=12)
  if probe.returncode!=0:return {'metadataError':'ffprobe_failed'}
  d=json.loads(probe.stdout);frames=[x for x in d.get('streams',[]) if x.get('codec_type')=='video']
  return {'duration':float(d.get('format',{}).get('duration',0) or 0),'width':frames[0].get('width') if frames else None,'height':frames[0].get('height') if frames else None}
 except Exception as e:return {'metadataError':type(e).__name__}
def create():
 seen=set();records=[];mapped=[];stats=Counter();inventory=defaultdict(list)
 for n,x in enumerate(INDEX,1):
  path=ROOT/x['path'];rel=relative(path)
  if rel!=x['path'] or rel in seen or not path.is_file():raise RuntimeError('Invalid inventory '+x['path'])
  seen.add(rel)
  category=CATEGORY.get(PurePosixPath(rel).parts[1],'待分类')
  kind=x['kind'];asset_id=f"PF-{'IMG' if kind=='image' else 'VID'}-{n:06d}"
  hash=hashlib.sha256()
  with path.open('rb') as fp:
   while chunk:=fp.read(1024*1024):hash.update(chunk)
  relations=[]
  for sidecar in x.get('promptFiles',[]):
   f=ROOT/sidecar
   if not f.is_file():continue
   if not f.resolve().is_relative_to(ROOT/'images'):continue
   scope='same-directory' if f.parent==path.parent else 'shared-directory'
   candidate=sample_sidecar(f)
   relations.append({'sourcePath':sidecar,'scope':scope,'originalEnglish':candidate['english'] if scope=='same-directory' else '', 'originalChinese':candidate['chinese'] if scope=='same-directory' else '', 'textLength':candidate['textLength'],'sourceHasBilingual':bool(candidate['english'] and candidate['chinese'])})
  evidence=('same-directory-candidate' if any(r['scope']=='same-directory' for r in relations) else 'shared-directory-only' if relations else 'no-prompt-source')
  stats[evidence]+=1;inventory[category].append(rel)
  proposal=f"managed/{kind}/{slug(category)}/{asset_id}__{slug(path.stem)}{path.suffix.lower()}"
  doc={'assetId':asset_id,'id':x['id'],'kind':kind,'sourcePath':rel,'suggestedPath':proposal,'sourceFileName':path.name,'category':category,'bytes':path.stat().st_size,'sha256':hash.hexdigest(),'metadata':media_metadata(path,kind),'relationCandidates':relations,'evidenceLevel':evidence,'oneToOneStatus':'unverified','humanReview':'pending','aiReview':'not-run','score':None,'issues':(['no-source-prompt'] if not relations else ['shared-sidecar-not-one-to-one'] if evidence=='shared-directory-only' else ['candidate-requires-semantic-verification'])}
  records.append(doc);mapped.append({'id':x['id'],'original':rel,'proposed':proposal,'applied':False})
 result={'schema':1,'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRoot':str(ROOT),'count':len(records),'totals':dict(stats),'records':records,'guarantee':'originals left unchanged; all relations unverified'}
 OUT.mkdir(parents=True,exist_ok=True)
 files={'asset-manifest.json':result,'rename-map.json':{'schema':1,'movesPerformed':0,'mapping':mapped},'directory-taxonomy.json':{'categories':dict((k,len(v)) for k,v in inventory.items()),'strategy':'virtual categories and suggestions only'},'review-records.json':{'humanConfirmed':0,'aiReviewed':0,'pending':len(records)},'relation-report.json':{'evidence':dict(stats),'verifiedOneToOne':0,'pendingHumanReview':len(records)}}
 for name,payload in files.items():
  target=OUT/name;temp=OUT/(name+'.tmp');temp.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf8');temp.replace(target)
 print(json.dumps({'assets':len(records),'evidence':dict(stats),'files':list(files),'sourceModified':False},ensure_ascii=False))
if __name__=='__main__':create()
