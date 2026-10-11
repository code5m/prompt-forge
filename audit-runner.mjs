import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditIndex,writeAuditSnapshot} from './audit-core.mjs';
import {readPromptEvidence} from './prompt-evidence.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const workspaceRoot=process.env.PROMPT_FORGE_WORKSPACE_ROOT;
if(!workspaceRoot){console.error('缺少 PROMPT_FORGE_WORKSPACE_ROOT');process.exitCode=2;}
else{
 const result=await auditIndex({indexPath:join(root,'media-index.json'),workspaceRoot,readEvidence:readPromptEvidence,limit:Number(process.env.AUDIT_LIMIT)||991});
 const destination=process.env.PROMPT_FORGE_AUDIT_OUT||join(root,'.local','audit-report.json');
 await writeAuditSnapshot(destination,result);
 console.log(JSON.stringify({checked:result.checked,totals:result.totals,destination},null,2));
}
