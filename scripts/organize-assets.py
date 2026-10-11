#!/usr/bin/env python3
"""Non-destructive normalized library: prompt files, media references, SHA256 and provenance."""
from pathlib import Path
import json,hashlib,os,datetime,sys,tempfile
PROJECT=Path(__file__).resolve().parents[1]
ROOT=Path(os.environ.get('PROMPT_FORGE_WORKSPACE_ROOT','/home/ainfinit/hot-prompts')).resolve()
DEST=Path(os.environ.get('PROMPT_FORGE_ORGANIZED_DIR',str(PROJECT/'.local/organized'))).resolve()
assert not DEST.is_relative_to(ROOT/'images'),"Refusing to write inside original images folder"
SOURCE=json.loads((PROJECT/'hot_prompts.json').read_text())
MEDIA=json.loads((PROJECT/'media-index.json').read_text())['records']
DEST.mkdir(parents=True,exist_ok=True)
records=[]
count=0
for category,items in SOURCE['categories'].items():
 catdir=DEST/'prompts'/category;catdir.mkdir(parents=True,exist_ok=True)
 for i,item in enumerate(items,1):
  prompt=str(item.get('prompt','')).strip()
  if not prompt: continue
  digest=hashlib.sha256(prompt.encode()).hexdigest()
  ident=f"prompt-{hashlib.sha256((category+str(i)+digest).encode()).hexdigest()[:20]}"
  file=catdir/f'{i:04d}-{digest[:12]}.md'
  content=f'# {category} · {i:04d}\n\n- 来源：hot_prompts.json\n- SHA256：{digest}\n- 热度：{item.get("heat","")}\n\n## 原始英文提示词\n\n{prompt}\n'
  if not file.exists():file.write_text(content,encoding='utf8')
  records.append({'id':ident,'kind':'prompt','category':category,'title':f'{category} #{i:04d}','en':prompt,'zh':'','heat':item.get('heat'),'source':'hot_prompts.json','sourceIndex':i-1,'organizedPath':file.relative_to(DEST).as_posix(),'sha256':digest})
  count+=1
for item in MEDIA:
 path=ROOT/item['path']
 if not path.is_file(): continue
 # Media content remains at its original path, no 1.25GiB copy.
 records.append({'id':item['id'],'kind':item['kind'],'category':item['path'].split('/')[1] if len(item['path'].split('/'))>1 else '未分类','title':item['name'],'path':item['path'],'bytes':item.get('bytes'), 'sidecars':item.get('promptFiles',[]),'source':'local-media','review':'pending'})
summary={'schema':1,'generatedAt':datetime.datetime.now().isoformat(),'workspace':str(ROOT),'promptCount':count,'mediaCount':sum(r['kind']!='prompt' for r in records),'totalCount':len(records),'readOnlyOriginals':True,'records':records}
tmp=DEST/'catalog.json.tmp';tmp.write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8');tmp.replace(DEST/'catalog.json')
print(json.dumps({'promptCount':count,'mediaCount':summary['mediaCount'],'totalCount':len(records),'catalog':str(DEST/'catalog.json'),'originalsModified':False},ensure_ascii=False))
