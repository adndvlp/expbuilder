import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const html = readFileSync(new URL('./branching-workspace.html', import.meta.url), 'utf8');
const require = createRequire(new URL('../../client/package.json',import.meta.url));
const context = vm.createContext({ structuredClone, console, React:require('react'), ReactDOM:require('react-dom'), ReactFlow:require('@xyflow/react'), jsxRuntime:require('react/jsx-runtime') });
vm.runInContext(html.match(/<script id="workspace-model">([\s\S]*?)<\/script>/)[1], context);
vm.runInContext(html.match(/<script id="app-canvas-library">([\s\S]*?)<\/script>/)[1], context);
const M = context.WorkspaceDemo;
const ids = (items) => [...items].sort();
const make = () => M.makeState('Test', [
  M.trial('a', 'A', null, 'b'), M.trial('b', 'B'),
  M.trial('loca', 'LOCA', null, 'child'), M.trial('child', 'Child'),
], [], 'a');
const makeBranchLevels = () => {
  const s=M.makeState('Branch levels',[
    M.trial('start','Inicio',null,'x'),M.trial('x','Source',null,'y'),M.trial('y','Inside',null,'ancestor'),
    M.trial('ancestor','Outer exit',null,'root-exit'),M.trial('root-exit','Root exit')
  ],[],'start');
  const inner=M.groupLoop(s,['x','y'],'Inner'),outer=M.groupLoop(s,[inner,'ancestor'],'Outer');
  M.connect(s,'x','ancestor');M.connect(s,'x','root-exit');return {s,inner,outer};
};
function originalLayout(graph,s) {
  return context.AppCanvas.buildUnifiedFlowLayout({timeline:graph.root.items,expandedPath:Object.values(graph.scopes).filter(scope=>s.loops.find(l=>l.id===String(scope.scopeId))?.expanded).map(scope=>({loop:{id:scope.scopeId,parentLoopId:scope.parentScopeId},items:scope.items})),branchEdges:graph.edges,scopeParents:Object.fromEntries(Object.values(graph.scopes).map(scope=>[scope.scopeId,scope.parentScopeId])),entryItemIds:Object.fromEntries([['root',graph.root.entryItemId],...Object.values(graph.scopes).map(scope=>['loop-scope:'+encodeURIComponent(scope.scopeId),scope.entryItemId])]),selectedItemId:null,selectedScopeId:null,onSelectTrial(){},onSelectLoop(){},onToggleLoop(){},onAddBranch(){}});
}
function compareGeometry(expected,actual,offset={x:0,y:0}) {
  for(const n of expected.nodes){const position=actual.positions[n.data.itemId];assert.ok(position,n.data.name);assert.equal(position.x-n.position.x,offset.x,n.data.name+' x');assert.equal(position.y-n.position.y,offset.y,n.data.name+' y');}
  const clean=edges=>JSON.parse(JSON.stringify(edges.map(e=>({kind:e.data.kind,curve:e.data.curve,routeX:e.data.routeX,routeTopY:e.data.routeTopY,routeBottomY:e.data.routeBottomY}))));
  const translated=expected.edges.map(e=>({...e,data:{...e.data,...(e.data.curve?{curve:e.data.curve.map(c=>Object.fromEntries(Object.entries(c).map(([key,p])=>[key,{x:p.x+offset.x,y:p.y+offset.y}])))}:{}),...(e.data.routeX===undefined?{}:{routeX:e.data.routeX+offset.x,routeTopY:e.data.routeTopY+offset.y,routeBottomY:e.data.routeBottomY+offset.y})}}));
  assert.deepEqual(clean(actual.flowEdges.filter(e=>expected.edges.some(original=>original.id===e.id))),clean(translated));
}

test('new trials are saved, free, and absent from the executable manifest', () => {
  const s = make(); const id = M.addTrial(s, { x: 800, y: 80 });
  assert.ok(s.trials.find(t => t.id === id));
  assert.equal(M.componentFor(s, id).locked, false);
  assert.ok(!M.compile(s).trials.some(t => t.id === id));
  assert.equal(JSON.parse(M.serialize(s)).trials.length, 5);
});
test('timeline order does not connect an otherwise unconnected trial', () => {
  const s = make();
  assert.deepEqual(ids(M.reachable(s).trials), ['a', 'b']);
  assert.equal(M.connections(s).length, 2);
});
test('removing the last rule removes the edge and releases the whole island', () => {
  const s = make(); M.setDefault(s, 'b', 'loca');
  assert.equal(M.componentFor(s, 'child').locked, true);
  M.setDefault(s, 'b', null);
  const island = M.componentFor(s, 'child');
  assert.equal(island.locked, false);
  assert.deepEqual(ids(island.trials), ['child', 'loca']);
  assert.deepEqual(ids(M.reachable(s).trials), ['a', 'b']);
});
test('a shared default/then destination disappears only after both references are removed', () => {
  const s = make(); M.setDefault(s, 'b', 'loca');
  M.realTrial(s,'b').thenGoTo.push({id:'shared',targetId:'loca'});
  M.setDefault(s, 'b', null);
  assert.ok(M.connections(s).some(e => e.source === 'b' && e.target === 'loca'));
  assert.equal(M.realTrial(s,'b').defaultNextTrialId,'loca');
  M.removeThen(s, 'b', s.trials.find(t => t.id === 'b').thenGoTo[0].id);
  assert.ok(M.connections(s).some(e => e.source === 'b' && e.target === 'loca'));
  M.removeConnection(s,'b','loca');
  assert.ok(!M.connections(s).some(e => e.source === 'b' && e.target === 'loca'));
});
test('dragging any trial of an island translates all members and preserves shape', () => {
  const s = make(); const before = M.layout(s).positions;
  M.moveComponent(s, 'loca', 123, 79);
  const after = M.layout(s).positions;
  for (const id of ['loca', 'child']) {
    assert.equal(after[id].x - before[id].x, 123);
    assert.equal(after[id].y - before[id].y, 79);
  }
  assert.equal(after.a.x, before.a.x);
});
test('main sequence cannot be freely moved', () => {
  const s = make(); const before = M.serialize(s);
  M.moveComponent(s, 'a', 10, 10);
  assert.equal(M.serialize(s), before);
});
test('parallel adds only a Then go to; deleting it disconnects the new trial', () => {
  const s = make(); const id = M.addChild(s, 'a', 'parallel');
  const a = s.trials.find(t => t.id === 'a');
  assert.equal(a.defaultNextTrialId, 'b');
  assert.ok(a.thenGoTo.some(r => r.targetId === id));
  M.removeThen(s, 'a', a.thenGoTo.find(r => r.targetId === id).id);
  assert.equal(M.componentFor(s, id).locked, false);
});
test('sequential inserts a trial before the existing destinations and transfers the rules', () => {
  const s = make(); M.connect(s, 'a', 'loca');
  const id = M.addChild(s, 'a', 'sequential');
  assert.equal(s.trials.find(t => t.id === 'a').thenGoTo.length, 0);
  assert.equal(s.trials.find(t => t.id === 'a').defaultNextTrialId, id);
  assert.equal(s.trials.find(t => t.id === id).defaultNextTrialId, 'b');
  assert.equal(s.trials.find(t => t.id === id).thenGoTo[0].targetId, 'loca');
});
test('handles reject same ends and loop markers, normalize reverse drags', () => {
  const s = make();
  assert.equal(M.normalizeConnection(s, 'a', 'top', 'b', 'top'), null);
  assert.equal(M.normalizeConnection(s, 'a', 'bottom', 'b', 'bottom'), null);
  assert.deepEqual(JSON.parse(JSON.stringify(M.normalizeConnection(s, 'b', 'top', 'a', 'bottom'))), { source: 'a', target: 'b' });
  const loopId = M.groupLoop(s, ['loca', 'child'], 'Loop');
  assert.equal(M.normalizeConnection(s, loopId, 'bottom', 'a', 'top'), null);
  assert.throws(() => M.connect(s, 'a', loopId), /trial/i);
});
test('loop ownership alone does not make disconnected trials executable', () => {
  const s = make(); const l = M.groupLoop(s, ['loca', 'child'], 'Isolated loop');
  assert.equal(M.componentFor(s, l).locked, false);
  assert.deepEqual(ids(M.reachable(s).loops), []);
  assert.ok(!M.compile(s).loops.some(loop => loop.id === l));
  M.connect(s, 'b', 'loca');
  assert.equal(M.componentFor(s, l).locked, true);
  assert.ok(M.compile(s).loops.some(loop => loop.id === l));
});
test('loop entry follows the selected structure regardless of checkbox order',()=>{
  for(const selected of [['a','b'],['b','a']]){
    const s=make(),before=JSON.stringify(M.connections(s)),loop=M.groupLoop(s,selected);
    assert.equal(M.item(s,loop).entryId,'a');
    for(const id of selected)assert.equal(M.item(s,id).parentLoopId,loop);
    assert.equal(JSON.stringify(M.connections(s)),before);
    assert.deepEqual(ids(M.reachable(s).trials),['a','b']);assert.doesNotThrow(()=>M.layout(s));
  }
});
test('selecting a loop and its visible descendants wraps the loop while retaining nested ownership',()=>{
  const s=make(),inner=M.groupLoop(s,['child'],'Inner');
  const outer=M.groupLoop(s,['child',inner,'loca']);
  assert.equal(M.item(s,outer).entryId,'loca');assert.equal(M.item(s,inner).parentLoopId,outer);
  assert.equal(M.item(s,'child').parentLoopId,inner);assert.equal(M.item(s,'loca').parentLoopId,outer);
  assert.doesNotThrow(()=>M.layout(s));
});
test('grouping rejects gaps and disconnected branches atomically instead of dropping selected items',()=>{
  const s=make();s.trials.push(M.trial('end','End'));M.setDefault(s,'b','end');
  let before=M.serialize(s);assert.throws(()=>M.groupLoop(s,['a','end']),/conectad|entrada|intermedio/i);assert.equal(M.serialize(s),before);
  M.connect(s,'a','loca');before=M.serialize(s);
  assert.throws(()=>M.groupLoop(s,['b','loca']),/conectad|entrada|intermedio/i);assert.equal(M.serialize(s),before);
});
test('grouping a scope entry replaces its saved slot and updates the containing loop entry',()=>{
  const s=make();M.setDefault(s,'b','loca');s.scopeOrder={root:['a','b','loca','child']};
  const outer=M.groupLoop(s,['a','b','loca','child'],'Outer'),inner=M.groupLoop(s,['b','a'],'Inner');
  assert.equal(M.item(s,outer).entryId,inner);assert.equal(M.item(s,inner).entryId,'a');
  assert.deepEqual(JSON.parse(JSON.stringify(s.scopeOrder.root)),[outer]);
  assert.deepEqual(JSON.parse(JSON.stringify(s.scopeOrder[outer])),[inner,'loca','child']);
  assert.deepEqual(JSON.parse(JSON.stringify(s.scopeOrder[inner])),['a','b']);
  assert.deepEqual(ids(M.reachable(s).loops),ids([inner,outer]));assert.doesNotThrow(()=>M.layout(s));
});
test('a selected cycle retains its scope entry and every selected trial',()=>{
  const s=make();M.setDefault(s,'b','a');s.entryId='b';
  const loop=M.groupLoop(s,['a','b']);assert.equal(M.item(s,loop).entryId,'b');
  assert.equal(M.item(s,'a').parentLoopId,loop);assert.equal(M.item(s,'b').parentLoopId,loop);
});
test('loop branch levels use the app current, ancestor and root scopes with unique destination counts',()=>{
  const {s,inner,outer}=makeBranchLevels();M.realTrial(s,'x').thenGoTo.push({id:'shared',targetId:'y'});const before=M.serialize(s);
  assert.deepEqual(JSON.parse(JSON.stringify(M.loopBranchLevels(s,'x'))),[
    {scopeId:inner,name:'Inner',relation:'current',branchCount:1},
    {scopeId:outer,name:'Outer',relation:'ancestor',branchCount:1},
    {scopeId:null,name:'Main timeline',relation:'root',branchCount:1}
  ]);assert.equal(M.serialize(s),before);assert.deepEqual(JSON.parse(JSON.stringify(M.loopBranchLevels(s,'start'))),[]);
});
test('parallel additions belong to the chosen scope without changing existing destinations or loop ownership',()=>{
  for(const level of ['inner','outer','root']){
    const {s,inner,outer}=makeBranchLevels(),scope=level==='inner'?inner:level==='outer'?outer:null,loops=JSON.stringify(s.loops);
    const created=M.addLoopBranch(s,'x',scope,'parallel');
    assert.equal(M.item(s,created).parentLoopId,scope);assert.equal(M.item(s,'x').defaultNextTrialId,'y');
    for(const target of ['y','ancestor','root-exit',created])assert.ok(M.connections(s).some(e=>e.source==='x'&&e.target===target));
    assert.equal(JSON.stringify(s.loops),loops);assert.doesNotThrow(()=>M.layout(s));
  }
});
test('placement is required only when the chosen level already has destinations',()=>{
  const {s,inner}=makeBranchLevels();M.removeConnection(s,'x','root-exit');const levels=M.loopBranchLevels(s,'x');
  assert.equal(context.AppCanvas.selectLoopBranchLevel({levels},inner).requiresPlacement,true);
  assert.equal(context.AppCanvas.selectLoopBranchLevel({levels},null).requiresPlacement,false);
  const created=M.addLoopBranch(s,'x',null,'parallel');assert.equal(M.item(s,created).parentLoopId,null);
  assert.equal(M.item(s,'x').defaultNextTrialId,'y');assert.ok(M.item(s,'x').thenGoTo.some(r=>r.targetId===created));
});
test('sequential insertion at root rewires only root destinations and keeps conditions on their source as in the app',()=>{
  const {s,inner,outer}=makeBranchLevels(),source=M.item(s,'x'),rule=source.thenGoTo.find(r=>r.targetId==='root-exit');
  rule.customParameters={button:'kept'};const ruleId=rule.id,created=M.addLoopBranch(s,'x',null,'sequential');
  assert.equal(M.item(s,created).parentLoopId,null);assert.equal(M.item(s,created).defaultNextTrialId,'root-exit');
  assert.equal(M.item(s,'x').defaultNextTrialId,created);
  assert.equal(M.item(s,'x').thenGoTo.find(r=>r.id===ruleId).targetId,created);
  assert.deepEqual(JSON.parse(JSON.stringify(M.item(s,'x').thenGoTo.find(r=>r.id===ruleId).customParameters)),{button:'kept'});
  for(const target of ['y','ancestor'])assert.ok(M.connections(s).some(e=>e.source==='x'&&e.target===target));
  assert.ok(!M.connections(s).some(e=>e.source==='x'&&e.target==='root-exit'));
  assert.equal(M.item(s,'x').parentLoopId,inner);assert.equal(M.item(s,'ancestor').parentLoopId,outer);
  assert.ok(s.scopeOrder.root.indexOf(created)<s.scopeOrder.root.indexOf('root-exit'));
});
test('sequential insertion in the current loop leaves ancestor and root exits unchanged',()=>{
  const {s,inner}=makeBranchLevels(),created=M.addLoopBranch(s,'x',inner,'sequential');
  assert.equal(M.item(s,created).parentLoopId,inner);assert.equal(M.item(s,created).defaultNextTrialId,'y');
  assert.equal(M.item(s,'x').defaultNextTrialId,created);
  for(const target of ['ancestor','root-exit'])assert.ok(M.connections(s).some(e=>e.source==='x'&&e.target===target));
  assert.deepEqual(JSON.parse(JSON.stringify(s.scopeOrder[inner])),['x',created,'y']);
});
test('multiple existing exits remain explicit branching references after sequential insertion at their level',()=>{
  const {s}=makeBranchLevels();s.trials.push(M.trial('root-2','Root 2'));M.setDefault(s,'root-exit','root-2');M.connect(s,'x','root-2');
  const created=M.addLoopBranch(s,'x',null,'sequential');
  assert.deepEqual(ids(M.connections(s).filter(e=>e.source===created).map(e=>e.target)),['root-2','root-exit']);
  assert.equal(M.item(s,created).defaultNextTrialId,'root-exit');
  assert.ok(M.item(s,created).thenGoTo.some(r=>r.targetId==='root-2'));
  assert.equal(M.connections(s).filter(e=>e.source==='x'&&e.target===created).length,1);
});
test('loop level additions reject unrelated scopes, root sources and invalid modes atomically',()=>{
  const {s}=makeBranchLevels(),before=M.serialize(s);
  for(const [source,scope,mode] of [['x','missing','parallel'],['start',null,'parallel'],['x',null,'invalid']]){
    assert.throws(()=>M.addLoopBranch(s,source,scope,mode));assert.equal(M.serialize(s),before);
  }
});
test('available branch levels follow arbitrary nesting depth',()=>{
  const {s,outer}=makeBranchLevels();let top=outer;
  for(let depth=3;depth<=5;depth++){
    top=M.groupLoop(s,[top],'Level '+depth);const levels=M.loopBranchLevels(s,'x');
    assert.equal(levels.length,depth+1);assert.equal(levels.at(-2).scopeId,top);assert.equal(levels.at(-1).scopeId,null);
  }
});
test('a loose connection requests levels from the loop endpoint without changing the graph',()=>{
  const {s,inner,outer}=makeBranchLevels(),free=M.addTrial(s),before=M.serialize(s);
  const outgoing=M.loopConnectionContext(s,'x',free),incoming=M.loopConnectionContext(s,free,'x');
  assert.equal(outgoing.looseTrialId,free);assert.equal(outgoing.scopeTrialId,'x');
  assert.deepEqual(JSON.parse(JSON.stringify(outgoing.levels.map(l=>l.scopeId))),[inner,outer,null]);
  assert.deepEqual(JSON.parse(JSON.stringify(incoming.levels.map(l=>l.scopeId))),[inner,outer,null]);
  assert.ok(incoming.levels.every(l=>l.branchCount===0));assert.equal(M.serialize(s),before);
  assert.equal(M.loopConnectionContext(s,'x','y'),null);assert.equal(M.loopConnectionContext(s,'start','root-exit'),null);
});
test('connecting an existing loose trial honors the chosen current, ancestor or root scope without creating a trial',()=>{
  for(const level of ['current','ancestor','root']){
    const {s,inner,outer}=makeBranchLevels(),free=M.addTrial(s),count=s.trials.length,scope=level==='current'?inner:level==='ancestor'?outer:null;
    M.connectAtLoopLevel(s,'x',free,scope);
    assert.equal(s.trials.length,count);assert.equal(M.item(s,free).parentLoopId,scope);
    assert.equal(M.item(s,'x').defaultNextTrialId,'y');assert.ok(M.item(s,'x').thenGoTo.some(r=>r.targetId===free));
    assert.doesNotThrow(()=>M.layout(s));
  }
});
test('a loose prefix connected to a loop entry becomes that scope entry in structural order',()=>{
  const {s,inner}=makeBranchLevels();s.trials.push(M.trial('head','Head',null,'tail'),M.trial('tail','Tail'));
  M.connectAtLoopLevel(s,'tail','x',inner);
  assert.equal(M.item(s,inner).entryId,'head');
  for(const id of ['head','tail','x','y'])assert.equal(M.item(s,id).parentLoopId,inner);
  assert.equal(M.item(s,'tail').defaultNextTrialId,'x');assert.doesNotThrow(()=>M.layout(s));
});
test('an incoming partial connection stays movable at root and cannot silently ignore a chosen loop level',()=>{
  const {s,inner}=makeBranchLevels(),free=M.addTrial(s),before=M.serialize(s);
  assert.throws(()=>M.connectAtLoopLevel(s,free,'y',inner),/entrada|alcanzable/i);assert.equal(M.serialize(s),before);
  M.connectAtLoopLevel(s,free,'y',null);assert.equal(M.item(s,free).parentLoopId,null);
  assert.equal(M.componentFor(s,free).locked,false);assert.equal(M.componentFor(s,free).attached,true);
});
test('connecting a loose structure moves its root items and retains its nested loops and internal branching',()=>{
  const {s,outer}=makeBranchLevels();s.trials.push(M.trial('free-head','Free head',null,'free-child'),M.trial('free-child','Free child'));
  const nested=M.groupLoop(s,['free-child'],'Free nested');M.connectAtLoopLevel(s,'x','free-head',outer);
  assert.equal(M.item(s,'free-head').parentLoopId,outer);assert.equal(M.item(s,nested).parentLoopId,outer);
  assert.equal(M.item(s,'free-child').parentLoopId,nested);assert.equal(M.item(s,'free-head').defaultNextTrialId,'free-child');
  assert.doesNotThrow(()=>M.layout(s));
});
test('scoped target reconnection preserves all edge references while honoring a root destination',()=>{
  const {s}=makeBranchLevels(),free=M.addTrial(s);M.item(s,'x').thenGoTo.push({id:'shared',targetId:'y',customParameters:{kept:true}});
  const edge=M.connectAtLoopLevel(s,'x',free,null,{source:'x',target:'y'});
  assert.equal(edge,JSON.stringify(['x',free]));assert.equal(M.item(s,free).parentLoopId,null);
  assert.equal(M.item(s,'x').defaultNextTrialId,free);assert.equal(M.item(s,'x').thenGoTo.find(r=>r.id==='shared').targetId,free);
  assert.deepEqual(JSON.parse(JSON.stringify(M.item(s,'x').thenGoTo.find(r=>r.id==='shared').customParameters)),{kept:true});
  assert.ok(!M.connections(s).some(e=>e.source==='x'&&e.target==='y'));
});
test('scoped source reconnection updates the old parent and the new loop entry atomically',()=>{
  const {s,inner}=makeBranchLevels(),free=M.addTrial(s);
  M.connectAtLoopLevel(s,free,'x',inner,{source:'start',target:'x'});
  assert.equal(M.item(s,'start').defaultNextTrialId,null);assert.equal(M.item(s,free).defaultNextTrialId,'x');
  assert.equal(M.item(s,free).parentLoopId,inner);assert.equal(M.item(s,inner).entryId,free);
});
test('scoped connections reject unrelated scopes and loop markers without changing the graph',()=>{
  const {s,inner}=makeBranchLevels(),free=M.addTrial(s),before=M.serialize(s);
  assert.throws(()=>M.connectAtLoopLevel(s,'x',free,'missing'));assert.equal(M.serialize(s),before);
  assert.throws(()=>M.connectAtLoopLevel(s,inner,free,inner));assert.equal(M.serialize(s),before);
});
test('creating and attaching a movable destination use the same per-level placement decision',()=>{
  const {s,inner,outer}=makeBranchLevels(),free=M.addTrial(s),before=M.serialize(s);
  for(const scope of [inner,outer,null]){
    assert.equal(M.loopBranchSelection(s,{sourceId:'x'},scope).requiresPlacement,true);
    assert.equal(M.loopBranchSelection(s,{sourceId:'x',targetId:free},scope).requiresPlacement,true);
  }
  assert.equal(M.loopBranchSelection(s,{sourceId:'x',targetId:free,previous:{source:'x',target:'y'}},inner).requiresPlacement,false);
  assert.equal(M.serialize(s),before);
});
test('sequential attachment inserts the existing trial before only the destinations in the chosen level',()=>{
  for(const level of ['current','ancestor','root']){
    const {s,inner,outer}=makeBranchLevels(),free=M.addTrial(s),count=s.trials.length;
    const scope=level==='current'?inner:level==='ancestor'?outer:null,target=level==='current'?'y':level==='ancestor'?'ancestor':'root-exit';
    M.connectAtLoopLevel(s,'x',free,scope,null,'sequential');
    assert.equal(s.trials.length,count);assert.equal(M.item(s,free).parentLoopId,scope);
    assert.equal(M.item(s,'x').defaultNextTrialId,free);assert.equal(M.item(s,free).defaultNextTrialId,target);
    for(const other of ['y','ancestor','root-exit'].filter(id=>id!==target))assert.ok(M.connections(s).some(e=>e.source==='x'&&e.target===other));
    assert.ok(!M.connections(s).some(e=>e.source==='x'&&e.target===target));assert.doesNotThrow(()=>M.layout(s));
  }
});
test('sequential attachment preserves an existing nested structure and appends the old continuation at its final trial',()=>{
  const {s,inner}=makeBranchLevels();s.trials.push(M.trial('head','Head',null,'tail'),M.trial('tail','Tail'));
  const nested=M.groupLoop(s,['tail'],'Free nested'),count=s.trials.length;
  M.connectAtLoopLevel(s,'x','head',inner,null,'sequential');
  assert.equal(s.trials.length,count);assert.equal(M.item(s,'head').defaultNextTrialId,'tail');assert.equal(M.item(s,'tail').defaultNextTrialId,'y');
  assert.equal(M.item(s,'tail').parentLoopId,nested);assert.equal(M.item(s,nested).parentLoopId,inner);assert.equal(M.item(s,'y').parentLoopId,inner);
  assert.deepEqual(JSON.parse(JSON.stringify(s.scopeOrder[inner])),['x','head',nested,'y']);assert.doesNotThrow(()=>M.layout(s));
});
test('sequential attachment merges shared condition references and preserves multiple old destinations at the structure exit',()=>{
  const {s}=makeBranchLevels();s.trials.push(M.trial('free','Free',null,'tail'),M.trial('tail','Tail'),M.trial('root-2','Root 2'));
  M.setDefault(s,'root-exit','root-2');M.connect(s,'x','root-2');const rule=M.item(s,'x').thenGoTo.find(r=>r.targetId==='root-exit');rule.customParameters={kept:true};const ruleId=rule.id;
  M.connectAtLoopLevel(s,'x','free',null,null,'sequential');
  assert.equal(M.item(s,'free').defaultNextTrialId,'tail');assert.equal(M.item(s,'tail').defaultNextTrialId,'root-exit');
  assert.ok(M.item(s,'tail').thenGoTo.some(r=>r.targetId==='root-2'));
  assert.equal(M.item(s,'x').thenGoTo.find(r=>r.id===ruleId).targetId,'free');
  assert.deepEqual(JSON.parse(JSON.stringify(M.item(s,'x').thenGoTo.find(r=>r.id===ruleId).customParameters)),{kept:true});
  assert.equal(M.connections(s).filter(e=>e.source==='x'&&e.target==='free').length,1);
});
test('reconnection excludes the replaced edge and inserts sequentially before other destinations at the level',()=>{
  const {s,inner}=makeBranchLevels(),free=M.addTrial(s),other=M.addLoopBranch(s,'x',inner,'parallel');
  M.item(s,'x').thenGoTo.push({id:'moved',targetId:'y',customParameters:{kept:true}});
  assert.equal(M.loopBranchSelection(s,{sourceId:'x',targetId:free,previous:{source:'x',target:'y'}},inner).requiresPlacement,true);
  M.connectAtLoopLevel(s,'x',free,inner,{source:'x',target:'y'},'sequential');
  assert.equal(M.item(s,'x').defaultNextTrialId,free);assert.equal(M.item(s,free).defaultNextTrialId,other);
  assert.equal(M.item(s,'x').thenGoTo.find(r=>r.id==='moved').targetId,free);
  assert.ok(!M.connections(s).some(e=>e.source===free&&e.target==='y'));
});
test('invalid placement modes cannot partially attach or move an existing structure',()=>{
  const {s,inner}=makeBranchLevels(),free=M.addTrial(s),before=M.serialize(s);
  assert.throws(()=>M.connectAtLoopLevel(s,'x',free,inner,null,'invalid'));assert.equal(M.serialize(s),before);
});
test('disconnecting from a nested loop lifts the disconnected subtree to the root canvas', () => {
  const s = M.makeState('Nested', [M.trial('a','A',null,'x'),M.trial('x','X',null,'y'),M.trial('y','Y',null,'z'),M.trial('z','Z')], [], 'a');
  const inner = M.groupLoop(s, ['x','y','z'], 'Inner');
  const outer = M.groupLoop(s, ['a',inner], 'Outer');
  assert.equal(s.loops.find(l => l.id === inner).parentLoopId, outer);
  M.setDefault(s, 'x', null);
  assert.equal(s.trials.find(t => t.id === 'y').parentLoopId, null);
  assert.equal(s.trials.find(t => t.id === 'z').parentLoopId, null);
  assert.equal(M.componentFor(s, 'y').locked, false);
  assert.deepEqual(ids(M.componentFor(s, 'y').trials), ['y','z']);
});
test('an island containing a nested loop moves together without breaking ownership', () => {
  const s = make(); const inner = M.groupLoop(s, ['child'], 'Inner');
  const outer = M.groupLoop(s, ['loca', inner], 'Outer');
  const before = M.layout(s).positions;
  M.moveComponent(s, outer, 200, 40);
  const after = M.layout(s).positions;
  for(const id of ['loca','child',inner,outer]) assert.equal(after[id].x - before[id].x, 200);
  assert.equal(s.loops.find(l => l.id === inner).parentLoopId, outer);
});
test('reconnecting a loose group into a nested loop gives it that scope', () => {
  const s = make(); const loopId = M.groupLoop(s, ['a','b'], 'Main loop');
  M.connect(s, 'b', 'loca');
  for(const id of ['loca','child']) assert.equal(s.trials.find(t => t.id === id).parentLoopId, loopId);
  assert.equal(M.componentFor(s, 'loca').locked, true);
});
test('an unreachable parent stays movable when it points to a reachable shared descendant', () => {
  const s = make(); M.connect(s, 'a', 'child');
  const loose = M.componentFor(s, 'loca');
  assert.equal(loose.locked, false);
  assert.equal(loose.attached, true);
  assert.deepEqual(ids(loose.trials), ['loca']);
  assert.ok(!M.reachable(s).trials.has('loca'));
});
test('cycle traversal and compilation terminate; loops have no branching target contract', () => {
  const s = make(); M.connect(s, 'b', 'a');
  assert.deepEqual(ids(M.reachable(s).trials), ['a','b']);
  assert.equal(M.compile(s).trials.length, 2);
});
test('editor JSON round-trips positions, disconnected islands, and loop membership', () => {
  const s = make(); M.groupLoop(s, ['loca','child'], 'Loose loop');
  M.moveComponent(s, 'loca', 50, 60);
  const json = M.serialize(s); const restored = M.restore(json);
  assert.equal(M.serialize(restored), json);
});
test('connected Validación uses exactly the app node positions and curves', () => {
  const fixtures=JSON.parse(html.match(/<script id="db-fixtures" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const s=fixtures.find(f=>f.name==='DB · Validación');
  const graph=JSON.parse(html.match(/<script id="app-graph-fixtures" type="application\/json">([\s\S]*?)<\/script>/)[1]).find(f=>f.name===s.name).graph;
  const input={timeline:graph.root.items,expandedPath:Object.values(graph.scopes).filter(scope=>s.loops.find(l=>l.id===String(scope.scopeId)).expanded).map(scope=>({loop:{id:scope.scopeId,parentLoopId:scope.parentScopeId},items:scope.items})),branchEdges:graph.edges,scopeParents:Object.fromEntries(Object.values(graph.scopes).map(scope=>[scope.scopeId,scope.parentScopeId])),entryItemIds:Object.fromEntries([['root',graph.root.entryItemId],...Object.values(graph.scopes).map(scope=>['loop-scope:'+encodeURIComponent(scope.scopeId),scope.entryItemId])]),selectedItemId:null,selectedScopeId:null,onSelectTrial(){},onSelectLoop(){},onToggleLoop(){},onAddBranch(){}};
  const app=context.AppCanvas.buildUnifiedFlowLayout(input),demo=M.layout(s);
  for(const n of app.nodes)assert.deepEqual(JSON.parse(JSON.stringify(demo.positions[n.data.itemId])),JSON.parse(JSON.stringify(n.position)),n.data.name);
  assert.deepEqual(JSON.parse(JSON.stringify(demo.flowEdges.map(e=>e.data.curve))),JSON.parse(JSON.stringify(app.edges.map(e=>e.data.curve))));
});
test('an island has the identical relative app structure including nested loops', () => {
  const s=make();const inner=M.groupLoop(s,['child'],'Inner');M.groupLoop(s,['loca',inner],'Outer');
  const c=M.componentFor(s,'loca'),app=context.AppCanvas.productionLayout(s,c.ids),demo=M.layout(s);
  const first=app.nodes[0],offset={x:demo.positions[first.data.itemId].x-first.position.x,y:demo.positions[first.data.itemId].y-first.position.y};
  for(const n of app.nodes){assert.equal(demo.positions[n.data.itemId].x-n.position.x,offset.x);assert.equal(demo.positions[n.data.itemId].y-n.position.y,offset.y);}
  assert.equal(demo.boxes.length,0,'no invented loop bounding rectangles');
  assert.equal(demo.flowEdges.filter(e=>e.type==='loop').length,app.edges.filter(e=>e.type==='loop').length);
});
test('deleting a trial removes its rules and incoming references but preserves descendants', () => {
  const s=make();M.connect(s,'b','loca');M.connect(s,'a','loca');
  M.deleteTrial(s,'loca');
  assert.ok(!s.trials.some(t=>t.id==='loca'));
  assert.ok(s.trials.some(t=>t.id==='child'));
  assert.ok(!M.connections(s).some(e=>e.source==='loca'||e.target==='loca'));
  assert.equal(M.componentFor(s,'child').locked,false);
});
test('deleting the entry promotes its Default continuation and keeps unrelated trials free', () => {
  const s=make();M.deleteTrial(s,'a');
  assert.equal(s.entryId,'b');assert.deepEqual(ids(M.reachable(s).trials),['b']);
  assert.equal(M.componentFor(s,'loca').locked,false);
});
test('deleting a branching entry follows Default regardless of duplicate rules, visual position or branch order',()=>{
  const s=make();M.connect(s,'a','loca');
  M.realTrial(s,'a').thenGoTo.push({id:'same-destination',targetId:'b',component:'button'});
  M.realTrial(s,'a').destinationOrder=['loca','b'];s.anchors.b={x:900,y:900};s.anchors.loca={x:0,y:0};
  M.deleteTrial(s,'a');
  assert.equal(s.entryId,'b');assert.deepEqual(ids(M.compile(s).trials.map(t=>t.id)),['b']);
});
test('batch deletion follows the removed prefix independently of checkbox selection order',()=>{
  for(const deleted of [['a','b'],['b','a']]){
    const s=make();s.trials.push(M.trial('c','C'));M.setDefault(s,'b','c');M.connect(s,'a','loca');
    M.deleteItems(s,deleted);
    assert.equal(s.entryId,'c');assert.deepEqual(ids(M.reachable(s).trials),['c']);
  }
});
test('deleting a whole Default branch uses a surviving Then destination and tolerates deleted cycles',()=>{
  const s=make();M.setDefault(s,'b','a');M.connect(s,'a','loca');M.connect(s,'a','child');
  M.deleteItems(s,['a','b']);
  assert.equal(s.entryId,'loca');assert.deepEqual(ids(M.reachable(s).trials),['child','loca']);
});
test('deleting the whole main sequence starts the first remaining structure at its head',()=>{
  const s=make();s.trials=[s.trials[0],s.trials[1],s.trials[3],s.trials[2],M.trial('other','Other')];
  M.deleteItems(s,['a','b']);
  assert.equal(s.entryId,'loca');assert.deepEqual(ids(M.reachable(s).trials),['child','loca']);
  assert.equal(M.componentFor(s,'other').locked,false);
});
test('automatic replacement respects saved structure order',()=>{
  const s=make();s.trials.push(M.trial('other','Other'));s.scopeOrder={root:['a','b','other','loca','child']};
  M.deleteItems(s,['b','a']);assert.equal(s.entryId,'other');
});
test('a remaining cyclic structure starts in its source cycle rather than at a downstream trial',()=>{
  const s=make();s.trials.push(M.trial('x','X',null,'y'),M.trial('y','Y',null,'child'));
  M.realTrial(s,'y').thenGoTo.push({id:'return',targetId:'x'});M.realTrial(s,'loca').defaultNextTrialId=null;
  s.scopeOrder={root:['a','b','child','x','y','loca']};
  M.deleteItems(s,['a','b']);assert.equal(s.entryId,'x');
  assert.deepEqual(ids(M.reachable(s).trials),['child','x','y']);
});
test('a disconnected nested loop becomes the sole start while retaining its ownership and repetitions',()=>{
  for(const expanded of [false,true]){
    const s=make(),inner=M.groupLoop(s,['child'],'Inner'),outer=M.groupLoop(s,['loca',inner],'Outer');
    M.item(s,outer).expanded=expanded;M.item(s,inner).expanded=expanded;
    M.deleteItems(s,['a','b']);assert.equal(M.resolve(s,s.entryId),'loca');
    assert.deepEqual(ids(M.reachable(s).loops),ids([inner,outer]));
    assert.equal(M.realTrial(s,'child').parentLoopId,inner);assert.equal(M.item(s,inner).parentLoopId,outer);
    assert.equal(M.compile(s).loops.length,2);assert.doesNotThrow(()=>M.layout(s));
  }
});
test('deleting every trial leaves an empty start and the next added trial becomes the new start',()=>{
  const s=make();M.deleteItems(s,s.trials.map(t=>t.id));
  assert.equal(s.entryId,null);assert.equal(M.compile(s).trials.length,0);
  const id=M.addTrial(s);assert.equal(s.entryId,id);assert.deepEqual(ids(M.reachable(s).trials),[id]);
});
test('deleting the real entry of a loop continues the main sequence from a surviving trial',()=>{
  const s=make(),loop=M.groupLoop(s,['a','b'],'Main loop');s.entryId=loop;
  M.deleteTrial(s,'a');assert.equal(M.resolve(s,s.entryId),'b');
  assert.deepEqual(ids(M.reachable(s).trials),['b']);assert.doesNotThrow(()=>M.layout(s));
});
test('deleting a nested loop entry lifts its remaining trials to the main canvas', () => {
  const s=make();const inner=M.groupLoop(s,['loca','child'],'Inner');M.deleteTrial(s,'loca');
  assert.ok(!M.item(s,inner));
  assert.equal(s.trials.find(t=>t.id==='child').parentLoopId,null);
});
test('deleting the last trial removes its loop, stored positions and scope references while preserving continuation',()=>{
  const s=make(),loop=M.groupLoop(s,['a'],'Main loop');
  s.entryId=loop;M.item(s,loop).nextId='b';s.anchors[loop]={x:900,y:100};
  M.deleteTrial(s,'a');
  assert.ok(!M.item(s,loop));assert.equal(s.entryId,'b');assert.ok(!s.anchors[loop]);assert.ok(!s.scopeOrder[loop]);
  assert.ok(!Object.values(s.scopeOrder).some(order=>order.includes(loop)));
  assert.deepEqual(ids(M.reachable(s).trials),['b']);assert.doesNotThrow(()=>M.layout(s));
});
test('deleting the only trial of nested loops removes every empty ancestor in one graph edit',()=>{
  const s=make(),inner=M.groupLoop(s,['child'],'Inner'),outer=M.groupLoop(s,[inner],'Outer');
  M.deleteTrial(s,'child');
  assert.ok(!M.item(s,inner));assert.ok(!M.item(s,outer));assert.equal(s.loops.length,0);
  assert.ok(!s.scopeOrder[inner]);assert.ok(!s.scopeOrder[outer]);
  assert.equal(s.entryId,'a');assert.deepEqual(ids(M.reachable(s).trials),['a','b']);
});
test('an outer loop with remaining trials survives removal of its empty nested loop',()=>{
  const s=make(),outer=M.groupLoop(s,['loca','child'],'Outer'),inner=M.groupLoop(s,['child'],'Inner');
  M.deleteTrial(s,'child');
  assert.ok(!M.item(s,inner));assert.equal(M.item(s,'loca').parentLoopId,outer);
  assert.equal(M.item(s,outer).entryId,'loca');assert.equal(M.leafTrials(s,outer).length,1);
  assert.equal(M.componentFor(s,outer).locked,false);assert.doesNotThrow(()=>M.layout(s));
});
test('removing an empty entry loop repairs its parent entry before reconciling the remaining body',()=>{
  const s=make(),inner=M.groupLoop(s,['loca'],'Inner'),outer=M.groupLoop(s,[inner,'child'],'Outer');
  M.item(s,inner).nextId='child';M.deleteTrial(s,'loca');
  assert.ok(!M.item(s,inner));assert.equal(M.item(s,outer).entryId,'child');
  assert.equal(M.item(s,'child').parentLoopId,outer);assert.doesNotThrow(()=>M.layout(s));
});
test('deleting all trials also removes all nested loops and leaves a genuinely empty workspace',()=>{
  const s=make(),main=M.groupLoop(s,['a','b'],'Main'),inner=M.groupLoop(s,['child'],'Inner');
  M.groupLoop(s,['loca',inner],'Outer');M.deleteItems(s,s.trials.map(t=>t.id));
  assert.equal(s.trials.length,0);assert.equal(s.loops.length,0);assert.equal(s.entryId,null);
  assert.deepEqual(ids(M.compile(s).loops),[]);assert.ok(!s.scopeOrder[main]);
  assert.doesNotThrow(()=>M.layout(s));
});
test('reconciliation removes legacy empty loop trees and redirects their entry to the surviving continuation',()=>{
  const s=make();M.realTrial(s,'a').defaultNextTrialId=null;s.loops.push(
    {id:'empty-inner',name:'Empty inner',parentLoopId:'empty-outer',entryId:null,nextId:'b',repetitions:2,expanded:false},
    {id:'empty-outer',name:'Empty outer',parentLoopId:null,entryId:'empty-inner',nextId:null,repetitions:3,expanded:true}
  );s.entryId='empty-outer';
  M.reconcileGraph(s);assert.equal(s.loops.length,0);assert.equal(s.entryId,'b');
  const before=M.serialize(s);M.reconcileGraph(s);assert.equal(M.serialize(s),before);
});
test('a loop emptied by releasing its body is removed without deleting the released trials',()=>{
  const s=make(),loop=M.groupLoop(s,['a','b'],'Main');M.item(s,loop).entryId=null;
  M.reconcileGraph(s);
  assert.ok(!M.item(s,loop));for(const id of ['a','b'])assert.equal(M.item(s,id).parentLoopId,null);
  assert.deepEqual(ids(M.reachable(s).trials),['a','b']);
});
for(const fixture of context.AppCanvas.flatCurveScenarios){
  test('reuses app fixture: '+fixture.name+' in the main structure and as an island',()=>{
    const graph=fixture.graph(),s=context.AppCanvas.fromAppGraph(graph),baseline=originalLayout(graph,s);
    compareGeometry(baseline,M.layout(s));
    s.trials.push(M.trial('main-only','Main'));s.entryId='main-only';
    const loose=M.layout(s),first=baseline.nodes[0];
    compareGeometry(baseline,loose,{x:loose.positions[first.data.itemId].x-first.position.x,y:loose.positions[first.data.itemId].y-first.position.y});
  });
}
for(const mask of [0,1,2,3])test('reuses photographed loop-chain app fixture, expansion '+mask,()=>{
  const graph=context.AppCanvas.photographedChain(),s=context.AppCanvas.fromAppGraph(graph);
  s.loops.forEach((l,i)=>l.expanded=!!(mask&(1<<i)));
  compareGeometry(originalLayout(graph,s),M.layout(s));
});
test('reuses the nested app fixture as a disconnected component',()=>{
  const graph=context.AppCanvas.nestedChain(),s=context.AppCanvas.fromAppGraph(graph,true),baseline=originalLayout(graph,s);
  s.trials.push(M.trial('main-only','Main'));s.entryId='main-only';
  const loose=M.layout(s),first=baseline.nodes[0];
  compareGeometry(baseline,loose,{x:loose.positions[first.data.itemId].x-first.position.x,y:loose.positions[first.data.itemId].y-first.position.y});
});
test('a partially connected group does not rearrange or move the reachable structure',()=>{
  const s=make(),before=M.layout(s);
  M.setDefault(s,'child','b');
  const attached=M.layout(s),group=M.componentFor(s,'loca');
  assert.equal(group.locked,false);assert.equal(group.attached,true);
  for(const id of ['a','b'])assert.deepEqual(attached.positions[id],before.positions[id]);
  assert.ok(attached.flowEdges.some(e=>e.source==='child'&&e.target==='b'));
  M.moveComponent(s,'loca',140,70);
  const moved=M.layout(s);
  for(const id of ['loca','child']){assert.equal(moved.positions[id].x-attached.positions[id].x,140);assert.equal(moved.positions[id].y-attached.positions[id].y,70);}
  for(const id of ['a','b'])assert.deepEqual(moved.positions[id],before.positions[id]);
  const edge=moved.flowEdges.find(e=>e.source==='child'&&e.target==='b');
  assert.equal(edge.data.curve[0].start.x,moved.positions.child.x+90);
  assert.equal(edge.data.curve.at(-1).end.x,moved.positions.b.x+90);
  assert.deepEqual(ids(M.reachable(s).trials),['a','b']);
});
test('independent pending routes that share a live destination move independently',()=>{
  const s=make();s.trials.push(M.trial('other','Other',null,'b'));M.setDefault(s,'child','b');
  const before=M.layout(s);
  assert.notEqual(M.componentFor(s,'other').key,M.componentFor(s,'loca').key);
  M.moveComponent(s,'other',55,20);const after=M.layout(s);
  for(const id of ['a','b','loca','child'])assert.deepEqual(after.positions[id],before.positions[id]);
  assert.equal(after.positions.other.x-before.positions.other.x,55);
});
test('connecting a pending group from the sole start integrates the whole reachable path',()=>{
  const s=make();M.setDefault(s,'child','b');M.connect(s,'a','loca');
  assert.equal(M.componentFor(s,'loca').locked,true);
  assert.deepEqual(ids(M.reachable(s).trials),['a','b','child','loca']);
  const before=M.serialize(s);M.moveComponent(s,'loca',100,100);assert.equal(M.serialize(s),before);
});
test('connecting a prefix to the current start promotes its first trial',()=>{
  const s=make();M.setDefault(s,'child','a');
  assert.equal(s.entryId,'loca');assert.equal(M.componentFor(s,'loca').locked,true);
  assert.deepEqual(ids(M.reachable(s).trials),['a','b','child','loca']);
  M.connect(s,'b','loca');
  assert.equal(s.entryId,'loca');assert.equal(M.componentFor(s,'loca').locked,true);
});
test('a reachable terminal trial is fixed without needing an outgoing connection',()=>{
  const s=make();assert.equal(M.realTrial(s,'b').defaultNextTrialId,null);
  assert.equal(M.componentFor(s,'b').locked,true);
});
test('a return preserves the start until removing an edge makes it a new prefix',()=>{
  const s=make();M.setDefault(s,'b','a');assert.equal(s.entryId,'a');
  M.setDefault(s,'a',null);assert.equal(s.entryId,'b');
  assert.deepEqual(ids(M.reachable(s).trials),['a','b']);
  assert.equal(M.componentFor(s,'b').locked,true);
});
test('cutting a cycle promotes the first trial of the entire remaining prefix',()=>{
  const s=M.makeState('Cycle',[M.trial('a','Inicio',null,'b'),M.trial('b','B',null,'c'),M.trial('c','C',null,'d'),M.trial('d','D',null,'a')],[],'a');
  M.setDefault(s,'b',null);assert.equal(s.entryId,'c');
  assert.deepEqual(ids(M.reachable(s).trials),['a','b','c','d']);
});
test('pointing to a former start is partial once a prefix became the current start',()=>{
  const s=make();M.setDefault(s,'child','a');
  s.trials.push(M.trial('other','Other'));
  M.setDefault(s,'other','a');assert.equal(s.entryId,'loca');
  assert.equal(M.componentFor(s,'other').locked,false);
  assert.equal(M.componentFor(s,'other').attached,true);
});
test('multiple exposed prefix heads use a stable automatic start without requiring a selector',()=>{
  const s=M.makeState('Multiple heads',[M.trial('a','A',null,'p'),M.trial('p','P',null,'x'),M.trial('x','X',null,'a'),M.trial('y','Y',null,'a')],[],'a');
  M.connect(s,'p','y');M.deleteTrial(s,'p');
  assert.equal(s.entryId,'x');assert.deepEqual(ids(M.reachable(s).trials),['a','x']);
  assert.equal(M.componentFor(s,'y').locked,false);
});
test('reconciling a graph is idempotent',()=>{
  const s=make();M.setDefault(s,'child','a');const before=M.serialize(s);
  M.reconcileGraph(s);M.reconcileGraph(s);assert.equal(M.serialize(s),before);
});
test('manually overlapping a pending group with a fixed node never crashes routing',()=>{
  const s=make();M.setDefault(s,'child','b');const before=M.layout(s);
  M.moveComponent(s,'child',before.positions.a.x-before.positions.child.x,before.positions.a.y-25-before.positions.child.y);
  assert.doesNotThrow(()=>M.layout(s));
});
test('an incoming loop prefix promotes the real trial at its entry',()=>{
  const s=make(),loop=M.groupLoop(s,['loca','child'],'Prefix loop');
  M.setDefault(s,'child','a');
  assert.equal(s.entryId,'loca');assert.equal(M.componentFor(s,loop).locked,true);
  assert.ok(M.compile(s).loops.some(l=>l.id===loop));
});
test('a partially attached loop stays movable in its expanded and collapsed forms',()=>{
  for(const expanded of [false,true]){
    const s=make();M.setDefault(s,'child','b');const loop=M.groupLoop(s,['loca','child'],'Partial loop');
    s.loops.find(l=>l.id===loop).expanded=expanded;
    const before=M.layout(s);assert.equal(M.componentFor(s,loop).locked,false);
    assert.ok(before.flowEdges.some(e=>e.target==='b'&&e.data.boundary));
    M.moveComponent(s,loop,100,40);const after=M.layout(s);
    for(const id of ['a','b'])assert.deepEqual(after.positions[id],before.positions[id]);
    assert.equal(after.positions[loop].x-before.positions[loop].x,100);
  }
});
test('reconnecting a default updates its destination and releases the old route',()=>{
  const s=make();const next=M.reconnectTarget(s,'a','b','loca');
  assert.equal(s.trials.find(t=>t.id==='a').defaultNextTrialId,'loca');
  assert.equal(next,JSON.stringify(['a','loca']));
  assert.ok(!M.connections(s).some(e=>e.source==='a'&&e.target==='b'));
  assert.equal(M.componentFor(s,'b').locked,false);
  assert.equal(M.componentFor(s,'child').locked,true);
});
test('reconnecting preserves all default and condition references represented by the edge',()=>{
  const s=make();M.realTrial(s,'a').thenGoTo.push({id:'shared',targetId:'b'});M.connect(s,'a','loca');
  const source=s.trials.find(t=>t.id==='a'),id=source.thenGoTo.find(r=>r.targetId==='b').id;
  source.thenGoTo.find(r=>r.id===id).customParameters={label:'preserved'};
  M.reconnectTarget(s,'a','b','child');
  const updated=s.trials.find(t=>t.id==='a');
  assert.equal(updated.defaultNextTrialId,'child');
  assert.equal(updated.thenGoTo.find(r=>r.id===id).targetId,'child');
  assert.deepEqual(JSON.parse(JSON.stringify(updated.thenGoTo.find(r=>r.id===id).customParameters)),{label:'preserved'});
  assert.ok(updated.thenGoTo.some(r=>r.targetId==='loca'));
});
test('reconnecting to an existing destination merges the visual edge and retains the rules',()=>{
  const s=make();M.connect(s,'a','loca');M.reconnectTarget(s,'a','b','loca');
  assert.equal(M.connections(s).filter(e=>e.source==='a'&&e.target==='loca').length,1);
  assert.equal(M.connections(s).find(e=>e.source==='a'&&e.target==='loca').refs.length,2);
});
test('invalid reconnection leaves the entire graph unchanged',()=>{
  const s=make(),loop=M.groupLoop(s,['loca','child'],'Loop'),before=M.serialize(s);
  assert.throws(()=>M.reconnectTarget(s,'a','b',loop),/trial/i);
  assert.equal(M.serialize(s),before);
  assert.throws(()=>M.reconnectTarget(s,'a','missing','b'),/Conexión/);
  assert.equal(M.serialize(s),before);
});
test('moving the source removes the old parent connection and gives a new parent its first Default',()=>{
  const s=make();s.trials.push(M.trial('free','Free'));
  const edge=M.reconnectSource(s,'a','b','free');
  assert.equal(edge,JSON.stringify(['free','b']));
  assert.equal(M.realTrial(s,'a').defaultNextTrialId,null);
  assert.equal(M.realTrial(s,'free').defaultNextTrialId,'b');
  assert.ok(!M.connections(s).some(e=>e.source==='a'&&e.target==='b'));
});
test('moving the source preserves an existing parent Default and adds a Then go to',()=>{
  const s=make();M.reconnectSource(s,'a','b','loca');
  assert.equal(M.realTrial(s,'loca').defaultNextTrialId,'child');
  assert.ok(M.realTrial(s,'loca').thenGoTo.some(r=>r.targetId==='b'));
  assert.equal(M.realTrial(s,'a').defaultNextTrialId,null);
});
test('moving a shared edge transfers every condition to its new parent and restores the old parent fallback',()=>{
  const s=make();M.connect(s,'a','loca');
  const rules=[{id:'shared-1',targetId:'b',customParameters:{label:'kept'}},{id:'shared-2',targetId:'b',rules:[{value:2}]}];
  M.realTrial(s,'a').thenGoTo.push(...M.copy(rules));M.reconnectSource(s,'a','b','child');
  assert.equal(M.realTrial(s,'a').defaultNextTrialId,'loca');
  assert.ok(M.realTrial(s,'a').thenGoTo.every(r=>r.targetId!=='b'));
  assert.equal(M.realTrial(s,'child').defaultNextTrialId,'b');
  assert.deepEqual(JSON.parse(JSON.stringify(M.realTrial(s,'child').thenGoTo)),rules);
  assert.equal(M.connections(s).find(e=>e.source==='child'&&e.target==='b').refs.length,3);
});
test('moving the source onto an existing connection merges its edge and retains both parents conditions',()=>{
  const s=make();M.connect(s,'loca','b');
  const existing=JSON.parse(JSON.stringify(M.realTrial(s,'loca').thenGoTo));
  M.realTrial(s,'a').thenGoTo.push({id:'shared',targetId:'b',customParameters:{kept:true}});
  M.reconnectSource(s,'a','b','loca');
  assert.equal(M.realTrial(s,'loca').defaultNextTrialId,'child');
  assert.deepEqual(JSON.parse(JSON.stringify(M.realTrial(s,'loca').thenGoTo)),[...existing,{id:'shared',targetId:'b',customParameters:{kept:true}}]);
  assert.equal(M.connections(s).filter(e=>e.source==='loca'&&e.target==='b').length,1);
});
test('moving conditions with colliding IDs retains their data under distinct IDs in the new parent',()=>{
  const s=make();M.realTrial(s,'loca').thenGoTo.push({id:'same',targetId:'child',customParameters:{owner:'new'}});
  M.realTrial(s,'a').thenGoTo.push({id:'same',targetId:'b',customParameters:{owner:'old'}});
  M.reconnectSource(s,'a','b','loca');const rules=M.realTrial(s,'loca').thenGoTo;
  assert.equal(new Set(rules.map(r=>r.id)).size,2);
  assert.deepEqual(JSON.parse(JSON.stringify(rules.map(({id,...r})=>r))),[{targetId:'child',customParameters:{owner:'new'}},{targetId:'b',customParameters:{owner:'old'}}]);
});
test('moving the source into a loop applies the same ownership rules as a new connection',()=>{
  const s=make(),loop=M.groupLoop(s,['loca','child'],'Loop');
  M.reconnectSource(s,'a','b','loca');
  assert.equal(M.realTrial(s,'b').parentLoopId,loop);assert.doesNotThrow(()=>M.layout(s));
});
test('source reconnection rejects markers and missing edges atomically, and unchanged endpoints are a no-op',()=>{
  const s=make(),loop=M.groupLoop(s,['loca','child'],'Loop'),before=M.serialize(s);
  assert.throws(()=>M.reconnectSource(s,'a','b',loop),/trial/i);assert.equal(M.serialize(s),before);
  assert.throws(()=>M.reconnectSource(s,'a','missing','loca'),/trial|Conexión/i);assert.equal(M.serialize(s),before);
  assert.throws(()=>M.reconnectSource(s,'b','a','loca'),/Conexión/i);assert.equal(M.serialize(s),before);
  assert.equal(M.reconnectSource(s,'a','b','a'),JSON.stringify(['a','b']));assert.equal(M.serialize(s),before);
});
test('deleting an expanded or collapsed loop ungroups its children without deleting their decisions',()=>{
  for(const expanded of [false,true]){
    const s=make(),inner=M.groupLoop(s,['child'],'Inner'),outer=M.groupLoop(s,['loca',inner],'Outer');
    s.loops.find(l=>l.id===outer).expanded=expanded;
    const before=JSON.stringify(s.trials.map(t=>({id:t.id,defaultNextTrialId:t.defaultNextTrialId,thenGoTo:t.thenGoTo})));
    M.deleteLoop(s,outer);
    assert.ok(!s.loops.some(l=>l.id===outer));
    assert.equal(s.loops.find(l=>l.id===inner).parentLoopId,null);
    assert.equal(M.realTrial(s,'loca').parentLoopId,null);
    assert.equal(M.realTrial(s,'child').parentLoopId,inner);
    assert.equal(JSON.stringify(s.trials.map(t=>({id:t.id,defaultNextTrialId:t.defaultNextTrialId,thenGoTo:t.thenGoTo}))),before);
    assert.equal(s.entryId,'a');assert.doesNotThrow(()=>M.layout(s));
  }
});
test('ungrouping a nested entry replaces its scope references with the retained contents',()=>{
  const s=make(),inner=M.groupLoop(s,['loca','child'],'Inner'),outer=M.groupLoop(s,[inner],'Outer');
  s.scopeOrder={root:['a','b',outer],[outer]:[inner],[inner]:['loca','child']};
  s.entryId=outer;
  M.deleteLoop(s,inner);
  assert.equal(s.entryId,outer);
  assert.equal(s.loops.find(l=>l.id===outer).entryId,'loca');
  assert.deepEqual([...s.scopeOrder[outer]],['loca','child']);
  assert.ok(!Object.hasOwn(s.scopeOrder,inner));
  for(const id of ['loca','child'])assert.equal(M.realTrial(s,id).parentLoopId,outer);
  assert.deepEqual(ids(M.reachable(s).trials),['child','loca']);
});
test('removing one edge clears all its references and preserves unrelated conditions and trials',()=>{
  const s=make();M.realTrial(s,'a').thenGoTo.push({id:'shared',targetId:'b'});M.connect(s,'a','loca');
  const unrelated=JSON.stringify(M.realTrial(s,'a').thenGoTo.find(r=>r.targetId==='loca'));
  M.removeConnection(s,'a','b');
  assert.equal(M.realTrial(s,'a').defaultNextTrialId,'loca');
  assert.ok(!M.realTrial(s,'a').thenGoTo.some(r=>r.targetId==='b'));
  assert.equal(JSON.stringify(M.realTrial(s,'a').thenGoTo[0]),unrelated);
  assert.ok(M.realTrial(s,'b'));
  assert.equal(M.componentFor(s,'b').locked,false);
});
test('the first connector connection becomes Default and later destinations become Then go to',()=>{
  for(const fallback of [null,M.FINISH]){
    const s=make();M.realTrial(s,'b').defaultNextTrialId=fallback;
    M.connect(s,'b','loca');
    assert.equal(M.realTrial(s,'b').defaultNextTrialId,'loca');
    assert.equal(M.realTrial(s,'b').thenGoTo.length,0);
    M.connect(s,'b','child');
    assert.equal(M.realTrial(s,'b').defaultNextTrialId,'loca');
    assert.equal(M.realTrial(s,'b').thenGoTo[0].targetId,'child');
    const before=M.serialize(s);M.connect(s,'b','loca');M.connect(s,'b','child');
    assert.equal(M.serialize(s),before,'repeating a connector gesture adds no duplicate reference');
  }
});
test('green plus uses Default on a terminal trial',()=>{
  const s=make(),id=M.addChild(s,'b');
  assert.equal(M.realTrial(s,'b').defaultNextTrialId,id);
  assert.equal(M.realTrial(s,'b').thenGoTo.length,0);
});
test('several component conditions to one destination keep every rule and share Default and a single edge',()=>{
  const s=make(),t=M.realTrial(s,'b');
  t.thenGoTo=[{id:'left',targetId:null,component:'left-button',rules:[{value:1}]},{id:'right',targetId:null,component:'right-button',rules:[{value:2}]}];
  M.setThen(s,'b','left','loca');M.setThen(s,'b','right','loca');
  const updated=M.realTrial(s,'b');
  assert.equal(updated.defaultNextTrialId,'loca');
  assert.equal(updated.thenGoTo.length,2);
  assert.deepEqual(JSON.parse(JSON.stringify(updated.thenGoTo.map(r=>[r.component,r.rules]))),[['left-button',[{value:1}]],['right-button',[{value:2}]]]);
  const edges=M.connections(s).filter(e=>e.source==='b');assert.equal(edges.length,1);assert.equal(edges[0].refs.length,3);
  M.removeConnection(s,'b','loca');
  assert.equal(M.realTrial(s,'b').defaultNextTrialId,null);
  assert.equal(M.realTrial(s,'b').thenGoTo.length,0);
});
test('deleting Default selects the first remaining destination and never discards its conditions',()=>{
  const s=make();s.trials.push(M.trial('other','Other'));
  M.connect(s,'a','loca');M.connect(s,'a','other');
  const rules=JSON.stringify(M.realTrial(s,'a').thenGoTo);
  M.removeConnection(s,'a','b');
  assert.equal(M.realTrial(s,'a').defaultNextTrialId,'loca');
  assert.equal(JSON.stringify(M.realTrial(s,'a').thenGoTo),rules);
  M.removeConnection(s,'a','loca');
  assert.equal(M.realTrial(s,'a').defaultNextTrialId,'other');
  M.removeConnection(s,'a','other');
  assert.equal(M.realTrial(s,'a').defaultNextTrialId,null);
  assert.equal(M.connections(s).filter(e=>e.source==='a').length,0);
});
test('changing Default explicitly keeps that choice while removing a destination trial restores a surviving fallback',()=>{
  const s=make();M.connect(s,'a','loca');M.setDefault(s,'a','child');
  assert.equal(M.realTrial(s,'a').defaultNextTrialId,'child');
  M.deleteTrial(s,'child');
  assert.equal(M.realTrial(s,'a').defaultNextTrialId,'loca');
  assert.doesNotThrow(()=>M.layout(s));
});
test('batch deletion ungroups selected loops and removes only the selected trials',()=>{
  const s=make(),inner=M.groupLoop(s,['child'],'Inner'),outer=M.groupLoop(s,['loca',inner],'Outer');
  M.deleteItems(s,[outer,'loca']);
  assert.ok(!s.loops.some(l=>l.id===outer));assert.ok(!M.realTrial(s,'loca'));
  assert.ok(M.realTrial(s,'child'));assert.equal(s.loops.find(l=>l.id===inner).parentLoopId,null);
  assert.equal(M.realTrial(s,'child').parentLoopId,inner);assert.doesNotThrow(()=>M.layout(s));
});
test('batch deletion reconciles the final graph atomically instead of rejecting an ambiguous intermediate graph',()=>{
  const s=M.makeState('Batch',[M.trial('a','A',null,'p'),M.trial('p','P',null,'x'),M.trial('x','X',null,'a'),M.trial('y','Y',null,'a')],[],'a');
  M.connect(s,'p','y');M.deleteItems(s,['p','x']);
  assert.equal(s.entryId,'y');assert.deepEqual(ids(M.reachable(s).trials),['a','y']);
});
test('sequential insertion rewires every reference on the targeted edge and preserves its component conditions',()=>{
  const s=make();M.realTrial(s,'a').thenGoTo.push({id:'button-rule',targetId:'b',component:'button',rules:[{value:1}]});
  const before=M.serialize(s),candidate={sourceId:'a',targetId:'b',mode:'sequential',side:'right'};
  const preview=context.AppCanvas.previewInsertion(s,'loca',candidate);
  assert.equal(M.serialize(s),before,'preview never changes editor state');
  assert.equal(preview.entryId,'loca');assert.equal(preview.exitId,'child');
  M.insertStructure(s,'loca',candidate);
  assert.equal(M.serialize(s),M.serialize(preview.state),'commit uses the exact preview operation');
  assert.equal(M.realTrial(s,'a').defaultNextTrialId,'loca');
  assert.equal(M.realTrial(s,'child').defaultNextTrialId,'b');
  assert.equal(M.realTrial(s,'a').thenGoTo[0].targetId,'loca');
  assert.equal(M.realTrial(s,'a').thenGoTo[0].component,'button');
  assert.deepEqual(JSON.parse(JSON.stringify(M.realTrial(s,'a').thenGoTo[0].rules)),[{value:1}]);
  assert.ok(!M.connections(s).some(e=>e.source==='a'&&e.target==='b'));
  assert.equal(s.entryId,'a');
});
test('insertion chooses the last trial of the mini timeline and does not connect every leaf',()=>{
  const s=make();s.trials.push(M.trial('middle','Hijo 1',null,'child'));M.setDefault(s,'loca','middle');const right=M.addChild(s,'loca','parallel');
  let ends=context.AppCanvas.insertionEndpoints(s,'loca');assert.equal(ends.entryId,'loca');assert.equal(ends.exitId,'child');
  const last=M.addChild(s,right);ends=context.AppCanvas.insertionEndpoints(s,'loca');
  assert.equal(ends.exitId,last,'the final trial on the last visual row is used');
  M.insertStructure(s,'loca',{sourceId:'a',targetId:'b',mode:'sequential'});
  assert.equal(M.realTrial(s,last).defaultNextTrialId,'b');
  assert.equal(M.realTrial(s,'child').defaultNextTrialId,null,'other leaves retain their configuration');
});
for(const side of ['left','right'])test('parallel insertion creates a sibling on the '+side+' and preserves its own continuation',()=>{
  const s=make();M.insertStructure(s,'loca',{sourceId:'a',targetId:'b',mode:'parallel',side});
  assert.equal(M.realTrial(s,'a').defaultNextTrialId,'b');
  assert.ok(M.realTrial(s,'a').thenGoTo.some(r=>r.targetId==='loca'));
  assert.equal(M.realTrial(s,'child').defaultNextTrialId,null);
  assert.ok(!M.connections(s).some(e=>e.source==='child'&&e.target==='b'));
  assert.deepEqual([...M.realTrial(s,'a').destinationOrder],side==='left'?['loca','b']:['b','loca']);
  const positions=M.layout(s).positions;
  assert.equal(positions.loca.y,positions.b.y);
  assert.ok(side==='left'?positions.loca.x<positions.b.x:positions.loca.x>positions.b.x);
});
test('inserting into a loop retains existing nested scopes and connects only real trials',()=>{
  const s=make(),main=M.groupLoop(s,['a','b'],'Main'),inner=M.groupLoop(s,['child'],'Inner');
  M.groupLoop(s,['loca',inner],'Loose outer');
  const result=M.insertStructure(s,'loca',{sourceId:'a',targetId:'b',mode:'sequential'});
  assert.equal(result.entryId,'loca');assert.equal(result.exitId,'child');
  assert.equal(M.ancestors(s,M.realTrial(s,'child')).at(-1).id,main);
  assert.equal(M.realTrial(s,'b').parentLoopId,main,'the existing destination keeps its original loop');
  assert.ok(M.connections(s).every(e=>M.realTrial(s,e.source)&&M.realTrial(s,e.target)));
  assert.doesNotThrow(()=>M.layout(s));
});
test('insertion rejects active structures and connections inside the dragged group atomically',()=>{
  const s=make(),before=M.serialize(s);
  assert.throws(()=>M.insertStructure(s,'a',{sourceId:'loca',targetId:'child',mode:'sequential'}),/movible/);
  assert.throws(()=>M.insertStructure(s,'loca',{sourceId:'loca',targetId:'child',mode:'sequential'}),/misma estructura/);
  assert.equal(M.serialize(s),before);
});
test('inserting a structure ending inside a loop does not move the existing destination into that loop',()=>{
  const s=make(),inner=M.groupLoop(s,['child'],'Inner');M.groupLoop(s,['loca',inner],'Outer');
  M.insertStructure(s,'loca',{sourceId:'a',targetId:'b',mode:'sequential'});
  assert.equal(M.realTrial(s,'b').parentLoopId,null);
  assert.equal(M.realTrial(s,'child').parentLoopId,inner);
});
test('insertion proximity uses actual app curves, zoom, and semantic edges',()=>{
  const s=make(),layout=M.layout(s),edge=layout.flowEdges.find(e=>e.source==='a'&&e.target==='b');
  const curve=edge.data.curve[0],point={x:(curve.start.x+curve.end.x)/2,y:(curve.start.y+curve.end.y)/2};
  for(const zoom of [.5,1,2]){
    const centered=context.AppCanvas.findInsertion(s,layout,'loca',point,zoom);
    assert.equal(centered.sourceId,'a');assert.equal(centered.targetId,'b');assert.equal(centered.mode,'sequential');
    const lateral=context.AppCanvas.findInsertion(s,layout,'loca',{x:point.x+70/zoom,y:point.y},zoom);
    assert.equal(lateral.mode,'parallel');assert.equal(lateral.side,'right');
  }
  assert.equal(context.AppCanvas.findInsertion(s,layout,'loca',{x:point.x+1000,y:point.y},1),null);
  assert.equal(context.AppCanvas.findInsertion(s,{...layout,flowEdges:layout.flowEdges.map(e=>({...e,data:{...e.data,control:true}}))},'loca',point,1),null);
});
for(const count of [2,3,5])test('a fork with '+count+' branches accepts another sibling in every gap and on both outer sides',()=>{
  const children=Array.from({length:count},(_,i)=>M.trial('child-'+i,'Child '+i));
  const s=M.makeState('Fork',[M.trial('parent','Inicio',null,children[0].id),...children,M.trial('free','Trial suelto')],[],'parent');
  children.slice(1).forEach(t=>M.connect(s,'parent',t.id));
  const layout=M.layout(s),ordered=children.map(t=>({id:t.id,p:layout.positions[t.id],size:layout.sizes[t.id]})).sort((a,b)=>a.p.x-b.p.x);
  for(const zoom of [.5,1,2])for(let slot=0;slot<=count;slot++){
    const x=slot===0?ordered[0].p.x-50/zoom:slot===count?ordered.at(-1).p.x+ordered.at(-1).size.width+50/zoom:(ordered[slot-1].p.x+ordered[slot-1].size.width+ordered[slot].p.x)/2;
    const candidate=context.AppCanvas.findInsertion(s,layout,'free',{x,y:ordered[0].p.y+ordered[0].size.height/2},zoom);
    assert.ok(candidate,'slot '+slot+' at zoom '+zoom);assert.equal(candidate.mode,'parallel');assert.equal(candidate.sourceId,'parent');
    const preview=context.AppCanvas.previewInsertion(s,'free',candidate),source=M.realTrial(preview.state,'parent');
    assert.equal(source.defaultNextTrialId,'child-0');assert.equal(M.connections(preview.state).filter(e=>e.source==='parent').length,count+1);
    assert.equal(M.realTrial(preview.state,'free').defaultNextTrialId,null);
    assert.ok(!M.connections(preview.state).some(e=>e.source==='free'));
    const positions=preview.layout.positions;assert.equal(positions.free.y,positions[ordered[0].id].y);
    if(slot>0)assert.ok(positions.free.x>positions[ordered[slot-1].id].x);
    if(slot<count)assert.ok(positions.free.x<positions[ordered[slot].id].x);
  }
});
test('the shared fork area offers siblings while a precise hit on an individual arm remains sequential',()=>{
  const s=M.makeState('Fork',[M.trial('a','Inicio',null,'b'),M.trial('b','Ensayo A'),M.trial('c','LOCA'),M.trial('free','Suelto')],[],'a');M.connect(s,'a','c');
  M.addChild(s,'b');M.addChild(s,'c');
  const layout=M.layout(s),parent=layout.positions.a,size=layout.sizes.a;
  for(const zoom of [.5,1,2]){
    const shared=context.AppCanvas.findInsertion(s,layout,'free',{x:parent.x+size.width/2,y:parent.y+size.height+24/zoom},zoom);
    assert.equal(shared.mode,'parallel');assert.equal(shared.sourceId,'a');
  }
  const edge=layout.flowEdges.find(e=>e.source==='a'&&e.target==='b'),c=edge.data.curve[0],t=.7,u=1-t;
  const point={x:u**3*c.start.x+3*u*u*t*c.control1.x+3*u*t*t*c.control2.x+t**3*c.end.x,y:u**3*c.start.y+3*u*u*t*c.control1.y+3*u*t*t*c.control2.y+t**3*c.end.y};
  const arm=context.AppCanvas.findInsertion(s,layout,'free',point,1);assert.equal(arm.mode,'sequential');assert.equal(arm.targetId,'b');
});
