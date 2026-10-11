import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeExperiments,exportResearch} from '../knowledge-core.js';
test('knowledge ignores mock experiments and preserves failures',()=>{
 const db={records:[{id:'r',title:'Orange cat'}],experiments:[
 {recordId:'r',winner:'B',mock:false,note:'better anatomy'},
 {recordId:'r',winner:'A',mock:false,note:'too much drift'},
 {recordId:'r',winner:'B',mock:true,note:'fake'}]};
 const v=analyzeExperiments(db);
 assert.deepEqual([v.total,v.improvements,v.regressions],[2,1,1]);
 assert.equal(v.results[0].notes.length,2);
 assert.match(exportResearch(db),/too much drift/);
});
test('knowledge handles malformed older storage',()=>{
 const v=analyzeExperiments({records:[],experiments:[null,{}, {mock:true,winner:'A'}].filter(Boolean)});
 assert.equal(v.total,0);
});
