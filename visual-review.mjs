import {realpath,readFile} from 'node:fs/promises';
import {resolve,sep,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export async function visionPayload(workspaceRoot, assetId, indexFile) {
 const index=JSON.parse(await readFile(indexFile,'utf8'));
 const asset=index.records.find(x=>x.id===assetId&&x.kind==='image');
 if(!asset)throw Error('仅允许索引内的真实图片');
 const root=await realpath(resolve(workspaceRoot,'images'));
 const original=await realpath(resolve(workspaceRoot,asset.path));
 if(!original.startsWith(root+sep))throw Error('图片路径越界');
 const code="from PIL import Image,ImageOps\nimport sys,io,base64\nim=Image.open(sys.argv[1]);im=ImageOps.exif_transpose(im);im.thumbnail((768,768));buf=io.BytesIO();im.convert('RGB').save(buf,format='JPEG',quality=72);print(base64.b64encode(buf.getvalue()).decode())";
 const {stdout}=await exec('python3',['-c',code,original],{maxBuffer:1800000,timeout:20000});
 const data=stdout.trim();
 if(!/^[A-Za-z0-9+/=]+$/.test(data)||data.length>1400000)throw Error('缩略图超限');
 return {image:'data:image/jpeg;base64,'+data,asset};
}
export function visionPrompt(prompt){return '审查图片与以下提示词是否描述一致；严禁凭空推断来源。只返回 JSON：{"matched":true/false,"confidence":0-100,"issues":["中文问题"],"observations":["图中可见事实"],"suggestions":["建议"]}。提示词：'+String(prompt).slice(0,3000)}
