// Read-only prompt evidence, never assume that directory-level sidecars are exact matches.
import {readFile,realpath} from "node:fs/promises";
import {resolve,sep,extname} from "node:path";
const EXT=new Set([".md",".txt"]);
export async function readPromptEvidence(workspaceRoot, mediaId, indexPath){
 if(!workspaceRoot) return {status:"unavailable",reason:"本地素材目录未配置"};
 if(typeof mediaId!=="string"||mediaId.length>600) throw new Error("非法素材标识");
 const index=JSON.parse(await readFile(indexPath,"utf8"));
 const asset=index.records?.find(x=>x.id===mediaId);
 if(!asset) throw new Error("素材不在白名单索引中");
 const root=await realpath(resolve(workspaceRoot));
 const imageRoot=resolve(root,"images");
 const candidate=resolve(root,asset.path);
 if(!candidate.startsWith(imageRoot+sep)) throw new Error("素材超出允许范围");
 const promptPaths=[...new Set(asset.promptFiles||[])].slice(0,6);
 const result=[];
 for(const relative of promptPaths){
  if(typeof relative!=="string"||relative.length>600||relative.includes("\0")||relative.includes("\\")||relative.split("/").includes(".."))continue;
  if(!EXT.has(extname(relative).toLowerCase()))continue;
  const path=resolve(root,relative);
  if(!path.startsWith(imageRoot+sep))continue;
  try{
   const actual=await realpath(path);
   if(!actual.startsWith(imageRoot+sep))continue;
   const raw=await readFile(actual);
   if(raw.length>150000) {result.push({path:relative,status:"too-large"});continue;}
   const text=raw.toString("utf8");
   result.push({path:relative,status:"ok",text:text.slice(0,12000),scope:resolve(root,relative).startsWith(resolve(root,asset.path).replace(/\/[^/]+$/,"")+"/")?"same-directory":"ancestor-directory"});
  }catch{result.push({path:relative,status:"missing"});}
 }
 return {status:result.length?"found":"no-evidence",assetId:asset.id,name:asset.name,kind:asset.kind,sources:result,association:"unverified",message:"关联来源于目录路径，需核对原图/视频与文字是否一对一对应"};
}
