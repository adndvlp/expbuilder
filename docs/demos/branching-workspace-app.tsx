// This entry bundles the app's real canvas code into the standalone demo.
// The only extra layout responsibility is translating disconnected components.
import { buildUnifiedFlowLayout, getLoopLayoutScopeId } from '../../client/src/pages/ExperimentBuilder/components/Canvas/services/buildUnifiedFlowLayout';
import { getCanvasLayoutBounds } from '../../client/src/pages/ExperimentBuilder/components/Canvas/services/canvasLayoutBounds';
import { getCanonicalBranchEdgeId, addCanonicalBranchEdges } from '../../client/src/pages/ExperimentBuilder/components/Canvas/services/canonicalBranchProjection';
import { routeNavigationEdges } from '../../client/src/pages/ExperimentBuilder/components/Canvas/services/navigationRouting';
import { directCurve } from '../../client/src/pages/ExperimentBuilder/components/Canvas/services/navigationCurve';
import { assignBranchColorSlots } from '../../client/src/pages/ExperimentBuilder/components/Canvas/services/assignBranchEdgeColors';
import { getBranchEdgeStroke } from '../../client/src/pages/ExperimentBuilder/components/Canvas/services/branchEdgeTheme';
import { MarkerType } from '@xyflow/react';
import { getLoopBranchLevels as getDomainLoopBranchLevels } from '../../server/routes/timeline/loopBranching/scopeGraph.js';
import { createLoopBranch as createDomainLoopBranch } from '../../server/routes/timeline/loopBranching/createLoopBranch.js';
export { default as TrialNode } from '../../client/src/pages/ExperimentBuilder/components/Canvas/TrialNode';
export { default as LoopNode } from '../../client/src/pages/ExperimentBuilder/components/Canvas/LoopNode';
export { default as AddTrialModal } from '../../client/src/pages/ExperimentBuilder/components/Canvas/components/AddTrialModal';
export { default as LoopBranchLevelModal } from '../../client/src/pages/ExperimentBuilder/components/Canvas/features/loop-branching/LoopBranchLevelModal';
export { selectLoopBranchLevel } from '../../client/src/pages/ExperimentBuilder/modules/experiment-authoring/intents/loopBranch';
export { default as NavigationRoutingEdge } from '../../client/src/pages/ExperimentBuilder/components/Canvas/components/NavigationRoutingEdge';
export { default as LoopRoutingEdge } from '../../client/src/pages/ExperimentBuilder/components/Canvas/components/LoopRoutingEdge';
export { default as CanvasViewportFitter } from '../../client/src/pages/ExperimentBuilder/components/Canvas/components/CanvasViewportFitter';
export { default as CanvasToolbar } from '../../client/src/pages/ExperimentBuilder/components/Canvas/components/CanvasToolbar';
export { default as BranchedTrialModalFrame } from '../../client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/components/BranchedTrialModalFrame';
export { default as ConditionHeader } from '../../client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/ConditionHeader';
export { default as ConditionsEmptyState } from '../../client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/components/ConditionsEmptyState';
export { default as AddConditionButton } from '../../client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/components/AddConditionButton';
export { default as Descriptions } from '../../client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/Descriptions';
export { default as DefaultDestination } from '../../client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/DefaultDestination';
export { getCanvasBackground, getPatternStyle, getFabStyle } from '../../client/src/pages/ExperimentBuilder/components/Canvas/utils/styleUtils';
export { getCanvasLayoutBounds, buildUnifiedFlowLayout };
export { flatCurveScenarios, photographedChain, nestedChain } from '../../client/e2e/helpers/curvedCanvasScenarios';

export function fromAppGraph(graph: any, expanded = false) {
  const model = M(), s = model.makeState('App layout fixture');
  s.entryId = graph.root.entryItemId == null ? String(graph.root.items[0]?.id ?? '') || null : String(graph.root.entryItemId);
  const scopes = [graph.root,...Object.values(graph.scopes) as any[]];
  s.scopeOrder = {};
  for (const scope of scopes) {
    const parentLoopId = scope.scopeId == null ? null : String(scope.scopeId);
    s.scopeOrder[parentLoopId ?? 'root'] = scope.items.map((i: any)=>String(i.id));
    for (const i of scope.items) {
      if (i.type === 'trial') {
        const t = model.trial(String(i.id),i.name,parentLoopId,i.defaultNextTrialId == null ? null : String(i.defaultNextTrialId));
        t.destinationOrder = (i.branches??[]).map(String);
        t.thenGoTo = (i.branches??[]).filter((id: any)=>String(id)!==String(i.defaultNextTrialId)).map((id: any,n: number)=>({id:'fixture_'+i.id+'_'+n,targetId:String(id)}));
        s.trials.push(t);
      } else {
        const inner = graph.scopes[String(i.id)];
        s.loops.push({id:String(i.id),name:i.name,parentLoopId,entryId:String(inner?.entryItemId??inner?.items[0]?.id??'')||null,nextId:i.nextItemId==null?null:String(i.nextItemId),repetitions:3,expanded});
      }
    }
  }
  return s;
}

const M = () => (globalThis as any).WorkspaceDemo;
const owner = (i: any) => i.parentLoopId ?? null;
const order = (ids: string[], declared: string[] = []) => {
  const rank = new Map(declared.map((id, index) => [String(id), index]));
  return [...ids].sort((a,b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity));
};
// Adapt only the storage shape. The app's pure domain functions run on this memory copy.
function loopBranchDocument(s: any) {
  const model=M(),edges=model.connections(s);
  const own=(scope: string|null)=>order(model.members(s,scope).map((i: any)=>i.id),s.scopeOrder?.[scope??'root']);
  return {
    entryItemId:s.entryId,
    timeline:own(null).map(id=>({id,name:model.item(s,id).name,type:s.loops.some((l: any)=>l.id===id)?'loop':'trial'})),
    trials:s.trials.map((t: any)=>({
      id:t.id,type:'Trial',name:t.name,parentLoopId:t.parentLoopId,
      defaultNextTrialId:model.realTrial(s,t.defaultNextTrialId)?t.defaultNextTrialId:null,
      branches:order(edges.filter((e: any)=>e.source===t.id).map((e: any)=>e.target),t.destinationOrder),
      branchConditions:t.thenGoTo.map(({targetId,...rule}: any)=>({...model.copy(rule),nextTrialId:targetId})),
    })),
    loops:s.loops.map((l: any)=>({id:l.id,name:l.name,parentLoopId:l.parentLoopId,entryItemId:l.entryId,nextItemId:l.nextId,trials:own(l.id)})),
  };
}
export function loopBranchLevels(s: any,sourceId: string,scopeTrialId=sourceId) {
  const document=loopBranchDocument(s),source=document.trials.find((t: any)=>t.id===sourceId),scopeTrial=document.trials.find((t: any)=>t.id===scopeTrialId);
  if(!source||!scopeTrial)throw Error('Source must be a trial');
  return getDomainLoopBranchLevels(document,{...scopeTrial,branches:source.branches});
}
export function planLoopBranch(s: any,sourceId: string,scopeId: string|null,mode: string) {
  if(mode!=='parallel'&&mode!=='sequential')throw Error('Invalid placement mode');
  const document=loopBranchDocument(s),source=document.trials.find((t: any)=>t.id===sourceId);
  if(!source)throw Error('Source must be a trial');
  const result=createDomainLoopBranch(document,source,scopeId,mode);
  if(result.error)throw Error(result.error);
  return {document,source,trial:result.trial,crossedLoopIds:result.crossedLoopIds};
}
export function inputFor(s: any, ids = new Set([...s.trials, ...s.loops].map((i: any) => i.id))) {
  const model = M();
  const all = [...s.trials, ...s.loops].filter(i => ids.has(i.id));
  const scopedOwner=(i: any)=>ids.has(owner(i))?owner(i):null;
  const active = model.connections(s).filter((e: any) => ids.has(e.source) && ids.has(e.target));
  const timelineFor = (parent: string | null) => {
    const own = all.filter(i => scopedOwner(i) === parent);
    return order(own.map(i => i.id), s.scopeOrder?.[parent ?? 'root']).map(id => {
      const i = own.find(i => i.id === id);
      if (s.loops.some((l: any) => l.id === id)) return {
        id, name: i.name, type: 'loop', parentLoopId: parent,
        trials: all.filter(i => scopedOwner(i) === id).map(i => i.id),
        nextItemId: i.nextId ?? null,
      };
      return {
        id, name: i.name, type: 'trial', parentLoopId: parent,
        branches: order(active.filter((e: any) => e.source === id).map((e: any) => e.target), i.destinationOrder),
        defaultNextTrialId: i.defaultNextTrialId,
      };
    });
  };
  const branchEdges = active.map((e: any) => {
    const source = model.item(s, e.source), target = model.item(s, e.target);
    const targetOwners = new Set(model.ancestors(s, target).map((l: any) => l.id));
    return {
      sourceId: e.source, targetId: e.target,
      sourceOwnerId: scopedOwner(source), targetOwnerId: scopedOwner(target),
      exitedLoopIds: model.ancestors(s, source).map((l: any) => l.id).filter((id: string) => ids.has(id)&&!targetOwners.has(id)),
    };
  });
  const loops = s.loops.filter((l: any) => ids.has(l.id));
  const entry = model.item(s, s.entryId);
  let rootEntry = entry && model.ancestors(s, entry).filter((l: any)=>ids.has(l.id)).at(-1)?.id || s.entryId;
  if (!ids.has(rootEntry)) {
    const roots=timelineFor(null);
    const rootOf=(id: string)=>{
      const i=model.item(s,id);return model.ancestors(s,i).filter((l: any)=>ids.has(l.id)).at(-1)?.id??id;
    };
    const incoming=new Set(active.filter((e: any)=>rootOf(e.source)!==rootOf(e.target)).map((e: any)=>rootOf(e.target)));
    rootEntry=(roots.find(i=>!incoming.has(i.id))??roots[0])?.id??null;
  }
  return {
    timeline: timelineFor(null),
    expandedPath: loops.filter((l: any) => l.expanded && model.ancestors(s,l).filter((p: any)=>ids.has(p.id)).every((p: any) => p.expanded)).map((l: any) => ({
      loop: { id:l.id, name:l.name, parentLoopId:scopedOwner(l) }, items:timelineFor(l.id),
    })),
    selectedItemId: null, selectedScopeId: null,
    branchEdges,
    scopeParents: Object.fromEntries(loops.map((l: any) => [l.id,scopedOwner(l)])),
    entryItemIds: Object.fromEntries([['root',rootEntry],...loops.map((l: any) => [getLoopLayoutScopeId(l.id),l.entryId])]),
    onSelectTrial: () => {}, onSelectLoop: () => {}, onToggleLoop: () => {}, onAddBranch: () => {},
  };
}
export function productionLayout(s: any, ids?: Set<string>) {
  return buildUnifiedFlowLayout(inputFor(s,ids) as any);
}
export function insertionEndpoints(s: any, itemId: string,fromTrialId?: string) {
  const model=M(),component=model.componentFor(s,itemId);
  if(!component||component.locked)return null;
  const expanded=model.copy(s);
  expanded.loops.forEach((l: any)=>{if(component.ids.has(l.id))l.expanded=true;});
  const flow=productionLayout(expanded,component.ids);
  const reachable=fromTrialId?model.reachable({...s,entryId:fromTrialId}).trials:null;
  const trials=flow.nodes.filter(n=>n.type==='trial'&&(!reachable||reachable.has(String(n.data.itemId)))).sort((a,b)=>a.position.y-b.position.y||a.position.x-b.position.x);
  if(!trials.length)return null;
  return {entryId:fromTrialId??String(trials[0].data.itemId),exitId:String(trials.at(-1)!.data.itemId),ids:[...component.ids] as string[]};
}
export function previewInsertion(s: any,itemId: string,candidate: any) {
  const state=M().copy(s),ends=M().insertStructure(state,itemId,candidate);
  return {...ends,state,layout:layout(state)};
}
export function findInsertion(s: any,flow: any,itemId: string,point: {x:number;y:number},zoom=1) {
  const model=M(),component=model.componentFor(s,itemId);
  if(!component||component.locked)return null;
  const semantic=new Map(model.connections(s).map((e: any)=>[e.id,e]));
  const byId=new Map(flow.flowNodes.map((n: any)=>[n.id,n])),eligible: any[]=[],hits: any[]=[];
  let best: any=null;
  for(const edge of flow.flowEdges){
    if(edge.data.control||edge.data.semanticEdgeIds?.length>1)continue;
    const connection: any=semantic.get(edge.data.semantic);
    if(!connection||component.ids.has(connection.source)||component.ids.has(connection.target))continue;
    eligible.push({edge,connection});
    const curve=edge.data.curve??[];
    let nearest: any=null;
    for(const segment of curve){
      for(let i=1;i<48;i++){
        const t=i/48,u=1-t;
        const p={x:0,y:0};
        for(const axis of ['x','y'] as const)p[axis]=u*u*u*segment.start[axis]+3*u*u*t*segment.control1[axis]+3*u*t*t*segment.control2[axis]+t*t*t*segment.end[axis];
        const distance=Math.hypot(point.x-p.x,point.y-p.y)*zoom;
        if(!nearest||distance<nearest.distance)nearest={point:p,distance};
      }
    }
    if(!nearest||nearest.distance>100)continue;
    const start=curve[0].start,end=curve.at(-1).end;
    if(Math.min(Math.hypot(nearest.point.x-start.x,nearest.point.y-start.y),Math.hypot(nearest.point.x-end.x,nearest.point.y-end.y))*zoom<16)continue;
    const dx=(point.x-nearest.point.x)*zoom,dy=(point.y-nearest.point.y)*zoom;
    hits.push({sourceId:connection.source,targetId:connection.target,distance:nearest.distance,side:dx<0?'left':'right'});
    const mode=nearest.distance<=24?'sequential':Math.abs(dx)>=28&&Math.abs(dy)<=55?'parallel':null;
    if(!mode||best&&best.distance<=nearest.distance)continue;
    best={sourceId:connection.source,targetId:connection.target,mode,side:dx<0?'left':'right',distance:nearest.distance};
  }
  // An individual arm remains a sequential insertion target. Shared fork areas
  // and gaps between siblings represent an additional branch of their parent.
  const precise=[...new Map(hits.filter(h=>h.distance<=10).map(h=>[JSON.stringify([h.sourceId,h.targetId]),h])).values()];
  const isolatedArm=precise.length===1&&!hits.some(h=>h.sourceId===precise[0].sourceId&&h.targetId!==precise[0].targetId&&h.distance<=24);
  const families=new Map<string,any[]>();
  for(const hit of eligible){
    const source: any=byId.get(hit.edge.source),target: any=byId.get(hit.edge.target);
    if(!source||!target||target.position.y<source.position.y+source.measured.height)continue;
    const key=JSON.stringify([hit.connection.source,source.id,Math.round(target.position.y*1000)]);
    if(!families.has(key))families.set(key,[]);families.get(key)!.push({...hit,source,target});
  }
  let fork: any=null;
  for(const family of families.values()){
    const peers=[...new Map(family.map(h=>[h.target.id,h])).values()].sort((a,b)=>a.target.position.x-b.target.position.x);
    if(peers.length<2)continue;
    const first=peers[0],last=peers.at(-1),top=first.target.position.y,bottom=Math.max(...peers.map(h=>h.target.position.y+h.target.measured.height));
    const parentBottom=first.source.position.y+first.source.measured.height;
    if(point.y<parentBottom+16/zoom||point.y>bottom+24/zoom||point.x<first.target.position.x-100/zoom||point.x>last.target.position.x+last.target.measured.width+100/zoom)continue;
    if(point.y>=top-12/zoom&&peers.some(h=>point.x>=h.target.position.x&&point.x<=h.target.position.x+h.target.measured.width))continue;
    const next=peers.find(h=>point.x<h.target.position.x+h.target.measured.width/2),anchor=next??last;
    const junction=Math.abs(point.x-first.source.position.x-first.source.measured.width/2)*zoom<=24&&(point.y-parentBottom)*zoom<=48;
    const distance=Math.abs(point.y-(top+bottom)/2)*zoom+Math.abs(point.x-first.source.position.x-first.source.measured.width/2)*zoom*.001;
    if(!fork||Number(junction)>Number(fork.junction)||junction===fork.junction&&distance<fork.distance)fork={sourceId:anchor.connection.source,targetId:anchor.connection.target,mode:'parallel',side:next?'left':'right',distance,junction};
  }
  if(fork?.junction)return fork;
  if(isolatedArm)return {...precise[0],mode:'sequential'};
  if(fork)return fork;
  return best;
}
export function layout(s: any) {
  const model = M(), groups = model.components(s), positions: any = {}, sizes: any = {}, componentIds: any = {};
  const nodes: any[] = [], edges: any[] = [], occupied: any[] = [];
  const semantic = new Map(inputFor(s).branchEdges.map((e: any) => [getCanonicalBranchEdgeId(e),JSON.stringify([e.sourceId,e.targetId])]));
  groups.sort((a: any,b: any) => Number(b.locked)-Number(a.locked) || Number([...b.ids].some(id=>s.anchors[id]))-Number([...a.ids].some(id=>s.anchors[id])));
  for (const component of groups) {
    const input=inputFor(s,component.ids);
    for(const e of input.branchEdges)semantic.set(getCanonicalBranchEdgeId(e),JSON.stringify([e.sourceId,e.targetId]));
    const flow = buildUnifiedFlowLayout(input as any);
    const bounds = getCanvasLayoutBounds(flow.nodes,flow.edges);
    if (!bounds) continue;
    let anchor = [...component.ids].sort().map(id=>s.anchors[id]).find(Boolean);
    if (!component.locked && !anchor) {
      anchor = {x:Math.max(850,...occupied.filter(b=>b.locked).map(b=>b.right+180)),y:80};
      while(occupied.some(b=>anchor.x<b.right+90&&anchor.x+bounds.width>b.left-90&&anchor.y<b.bottom+90&&anchor.y+bounds.height>b.top-90)) {
        anchor.x = Math.max(...occupied.map(b=>b.right+180));
      }
    }
    const dx = component.locked ? 0 : anchor.x-bounds.x;
    const dy = component.locked ? 0 : anchor.y-bounds.y;
    occupied.push({left:bounds.x+dx,right:bounds.x+dx+bounds.width,top:bounds.y+dy,bottom:bounds.y+dy+bounds.height,locked:component.locked});
    const byId = new Map(flow.nodes.map(n=>[n.id,String(n.data.itemId)]));
    for(const node of flow.nodes) {
      const id = String(node.data.itemId), position = {x:node.position.x+dx,y:node.position.y+dy};
      positions[id] = position; sizes[id] = node.measured; componentIds[id] = component.key;
      nodes.push({...node,id,position,draggable:!component.locked,data:{...node.data,free:!component.locked,partial:component.attached,pendingRoot:component.attached&&id===String(input.entryItemIds.root)}});
    }
    for(const edge of flow.edges) {
      const data: any = {...edge.data};
      if(data.curve)data.curve=data.curve.map((c: any)=>Object.fromEntries(Object.entries(c).map(([k,p]: any)=>[k,{x:p.x+dx,y:p.y+dy}])));
      if(data.routeX!==undefined)data.routeX+=dx;
      if(data.routeTopY!==undefined)data.routeTopY+=dy;
      if(data.routeBottomY!==undefined)data.routeBottomY+=dy;
      data.semantic = (data.semanticEdgeIds??[]).map((id: string)=>semantic.get(id)).find(Boolean);
      data.control = data.kind!=='flow';
      edges.push({...edge,source:byId.get(edge.source),target:byId.get(edge.target),data});
    }
  }
  // Boundary connections never participate in positioning the reachable graph.
  // They use the same canonical projection and curve router as the app.
  const groupByItem=new Map(groups.flatMap((c: any)=>[...c.ids].map(id=>[id,c.key])));
  const full=inputFor(s);
  const boundaries=full.branchEdges.filter((e: any)=>groupByItem.get(e.sourceId)!==groupByItem.get(e.targetId));
  const projected: any={nodes,edges:[],exitIds:[]};
  addCanonicalBranchEdges(projected,boundaries,full.scopeParents);
  const routable=[];
  for(const edge of projected.edges){
    const source=nodes.find(n=>n.id===edge.source),target=nodes.find(n=>n.id===edge.target);
    const start={x:source.position.x+source.measured.width/2,y:source.position.y+source.measured.height};
    const end={x:target.position.x+target.measured.width/2,y:target.position.y};
    const covered=nodes.some(n=>{
      const padding=n===source||n===target?0:n.type==='loop'?18:12;
      return [start,end].some(p=>p.x>n.position.x-padding&&p.x<n.position.x+n.measured.width+padding&&p.y>n.position.y-padding&&p.y<n.position.y+n.measured.height+padding);
    });
    // Manual placement can put an endpoint inside another node. No obstacle-free
    // path exists in that geometry; keep the app's cubic visible during overlap.
    if(covered)edge.data.curve=directCurve(start,end);else routable.push(edge);
  }
  routeNavigationEdges({...projected,edges:routable});
  const slots=assignBranchColorSlots([...edges,...projected.edges],full.branchEdges);
  for(const edge of projected.edges){
    const stroke=getBranchEdgeStroke(slots.get(edge.id));
    edges.push({...edge,type:'navigation',markerEnd:{type:MarkerType.ArrowClosed,color:stroke,width:20,height:20},style:{stroke,strokeWidth:1.5},data:{...edge.data,semantic:(edge.data.semanticEdgeIds??[]).map((id: string)=>semantic.get(id)).find(Boolean),control:false,boundary:true}});
  }
  return {positions,sizes,componentIds,groups,boxes:[],flowNodes:nodes,flowEdges:edges};
}
