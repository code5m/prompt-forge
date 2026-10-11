// Read-only localhost media bridge for the original hot-prompts workspace.
// The index contains paths, not public URLs. Never serves files outside images/.
import {realpath,stat,open} from "node:fs/promises";
import {resolve,sep,extname} from "node:path";

const MIME={".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".gif":"image/gif",".mp4":"video/mp4",".webm":"video/webm",".mov":"video/quicktime",".mkv":"video/x-matroska"};
const MAX_RANGE=8*1024*1024;
export async function serveLocalMedia(req,res,{workspaceRoot}={}){
 if(!workspaceRoot){res.writeHead(503);res.end("Media workspace not configured");return;}
 const base=await realpath(resolve(workspaceRoot,"images"));
 const requested=new URL(req.url,"http://localhost").searchParams.get("path");
 if(!requested||requested.length>500||!requested.startsWith("images/")||requested.includes("\\")||
    requested.split("/").includes("..")||requested.includes("\0")){res.writeHead(400);res.end("Invalid media path");return;}
 const path=resolve(workspaceRoot,requested);
 if(!path.startsWith(base+sep)&&path!==base){res.writeHead(403);res.end("Outside media root");return;}
 let actual,info;
 try{actual=await realpath(path);info=await stat(actual);}catch{res.writeHead(404);res.end("Media missing");return;}
 if(!actual.startsWith(base+sep)||!info.isFile()){res.writeHead(403);res.end("Media outside workspace");return;}
 const mime=MIME[extname(actual).toLowerCase()];
 if(!mime){res.writeHead(415);res.end("Unsupported media type");return;}
 const headers={"Content-Type":mime,"Cache-Control":"private, max-age=60","Accept-Ranges":"bytes","X-Content-Type-Options":"nosniff"};
 const total=info.size;
 let start=0,end=Math.max(0,total-1),status=200;
 const range=req.headers.range;
 if(range){
  const m=/^bytes=(\d+)-(\d*)$/.exec(range);
  if(!m){res.writeHead(416,{"Content-Range":"bytes */"+total});res.end();return;}
  start=Number(m[1]);end=m[2]?Number(m[2]):Math.min(total-1,start+MAX_RANGE-1);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=total||end<start){res.writeHead(416,{"Content-Range":"bytes */"+total});res.end();return;}
  end=Math.min(end,start+MAX_RANGE-1,total-1);status=206;headers["Content-Range"]="bytes "+start+"-"+end+"/"+total;
 }else if(total>MAX_RANGE){status=206;end=MAX_RANGE-1;headers["Content-Range"]="bytes 0-"+end+"/"+total;}
 headers["Content-Length"]=String(end-start+1);
 res.writeHead(status,headers);
 if(req.method==="HEAD"){res.end();return;}
 const fd=await open(actual,"r");
 try{
  let offset=start;
  while(offset<=end){
   const buffer=Buffer.allocUnsafe(Math.min(65536,end-offset+1));
   const {bytesRead}=await fd.read(buffer,0,buffer.length,offset);
   if(!bytesRead)break;
   if(!res.write(buffer.subarray(0,bytesRead)))await new Promise(resolve=>res.once("drain",resolve));
   offset+=bytesRead;
  }
  res.end();
 }finally{await fd.close();}
}
