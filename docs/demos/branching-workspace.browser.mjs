import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../client/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const { buildSync } = require('esbuild');
const helperBuild=buildSync({entryPoints:[fileURLToPath(new URL('../../client/e2e/helpers/layoutAssertions.ts',import.meta.url))],bundle:true,write:false,platform:'node',format:'cjs',external:['@playwright/test']});
const helperModule={exports:{}};
new Function('require','module','exports',helperBuild.outputFiles[0].text)(require,helperModule,helperModule.exports);
const {waitForCanvasViewport,expectBelowAndCentered,expectPathAvoidsNodes}=helperModule.exports;
const root = fileURLToPath(new URL('../../', import.meta.url));
const source = readFileSync(new URL('./branching-workspace.html', import.meta.url));
const server = createServer((req,res) => { res.setHeader('Content-Type','text/html');res.end(source); });
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const executable = '/private/tmp/branching-curves-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const browser = await chromium.launch({headless:true,...(existsSync(executable)?{executablePath:executable}:{})});
const page = await browser.newPage({viewport:{width:1500,height:980}});
const errors = [];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
// Optional cached copies of the exact pinned CDN resources make the check work offline.
const cdn = new Map([
  ['react@18.3.1/umd/react.production.min.js','/private/tmp/branching-workspace-react.js'],
  ['react-dom@18.3.1/umd/react-dom.production.min.js','/private/tmp/branching-workspace-react-dom.js'],
  ['htm@3.1.1/dist/htm.umd.js','/private/tmp/branching-workspace-htm.js'],
  ['@xyflow/react@12.9.2/dist/umd/index.js',root+'client/node_modules/@xyflow/react/dist/umd/index.js'],
  ['@xyflow/react@12.9.2/dist/style.css',root+'client/node_modules/@xyflow/react/dist/style.css'],
]);
await page.route('https://unpkg.com/**',async route=>{
  const key=route.request().url().replace('https://unpkg.com/',''),path=cdn.get(key);
  if(path&&existsSync(path))return route.fulfill({path,contentType:key.endsWith('.css')?'text/css':'application/javascript'});
  return route.continue();
});
const state=()=>page.evaluate(()=>window.workspaceDemo.getState());
const snapshot=async name=>page.screenshot({path:'/private/tmp/branching-workspace-'+name+'.png',fullPage:true});
const choose=async index=>{const select=page.getByLabel('Escenario',{exact:true});if(await select.inputValue()===String(index))await select.selectOption(String(index===3?0:3));await select.selectOption(String(index));await page.waitForTimeout(350);};
const run=async(name,fn)=>{await fn();console.log('PASS '+name);};
const selectConnection=async(source,target)=>{
  const id=await page.evaluate(({source,target})=>WorkspaceDemo.layout(workspaceDemo.getState()).flowEdges.find(e=>e.source===source&&e.target===target).id,{source,target});
  const edge=page.locator('.react-flow__edge[data-id="'+id+'"]');
  const point=await edge.locator('.react-flow__edge-path').evaluate(p=>{const v=p.getPointAtLength(p.getTotalLength()*.5).matrixTransform(p.getScreenCTM());return{x:v.x,y:v.y};});
  await page.mouse.click(point.x,point.y);await page.mouse.move(0,0);await expect(edge).toHaveClass(/selected/);
  return edge;
};
const dragConnectionTarget=async(edge,point)=>{
  const anchor=edge.getByRole('img',{name:'Arrastrar para reconectar',exact:true});await anchor.waitFor();const box=await anchor.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(point.x,point.y,{steps:20});await page.mouse.up();await page.mouse.move(0,0);
};
const dragHandles=async(a,ha,b,hb)=>{
  const first=await page.getByTestId('item-'+a).locator('[data-handleid="'+(ha==='top'?'flow-target':'flow-source')+'"]').boundingBox();
  const last=await page.getByTestId('item-'+b).locator('[data-handleid="'+(hb==='top'?'flow-target':'flow-source')+'"]').boundingBox();
  await page.mouse.move(first.x+first.width/2,first.y+first.height/2);await page.mouse.down();
  await page.mouse.move(last.x+last.width/2,last.y+last.height/2,{steps:20});await page.mouse.up();await page.mouse.move(0,0);
};
const loadInsertionFixture=async(complex=false)=>{
  await page.evaluate(complex=>{
    const s=WorkspaceDemo.makeState('Inserción',[WorkspaceDemo.trial('a','Inicio',null,'b'),WorkspaceDemo.trial('b','Ensayo A'),WorkspaceDemo.trial('free','Trial suelto')],[],'a');
    s.anchors.free={x:650,y:80};
    if(complex){
      s.trials=s.trials.filter(t=>t.id!=='free');
      s.trials.push(WorkspaceDemo.trial('loca','LOCA',null,'h1'),WorkspaceDemo.trial('h1','Hijo 1',null,'h2'),WorkspaceDemo.trial('h2','Hijo 2'),WorkspaceDemo.trial('right','New Trial 1'));
      WorkspaceDemo.connect(s,'loca','right');s.anchors.loca={x:650,y:80};
    }
    workspaceDemo.load(s);
  },complex);
  await expect(page.getByTestId('item-'+(complex?'loca':'free'))).toBeVisible();await waitForCanvasViewport(page.locator('.canvas-area'));
};
const loadSiblingFixture=async()=>{
  await loadInsertionFixture();
  await page.evaluate(()=>{
    const s=workspaceDemo.getState();s.trials.push(WorkspaceDemo.trial('loca','LOCA',null,'loca-child'),WorkspaceDemo.trial('loca-child','Hijo de LOCA'),WorkspaceDemo.trial('tail','Final'));
    WorkspaceDemo.connect(s,'a','loca');WorkspaceDemo.setDefault(s,'b','tail');workspaceDemo.load(s);
  });
  await expect(page.getByTestId('item-loca')).toBeVisible();await waitForCanvasViewport(page.locator('.canvas-area'));
};
const dragToPoint=async(id,point)=>{
  const node=await page.getByTestId('item-'+id).boundingBox();
  await page.mouse.move(node.x+node.width/2,node.y+node.height/2);await page.mouse.down();await page.mouse.move(point.x,point.y,{steps:24});
};
const dragOverEdge=async(id,offset=0)=>{
  const target=await page.locator('.react-flow__edge-path').first().evaluate(p=>{const point=p.getPointAtLength(p.getTotalLength()/2).matrixTransform(p.getScreenCTM());return{x:point.x,y:point.y};});
  await dragToPoint(id,{x:target.x+offset,y:target.y});
  return target;
};
const selectBox=async(ids)=>{
  const boxes=await Promise.all(ids.map(id=>page.getByTestId('item-'+id).boundingBox()));
  const start={x:Math.min(...boxes.map(b=>b.x))-26,y:Math.min(...boxes.map(b=>b.y))-26};
  const end={x:Math.max(...boxes.map(b=>b.x+b.width))+26,y:Math.max(...boxes.map(b=>b.y+b.height))+26};
  await page.mouse.move(start.x,start.y);await page.mouse.down({button:'left'});await page.mouse.move(end.x,end.y,{steps:20});
};
try {
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>!!window.workspaceDemo,{timeout:20000});
  await page.waitForTimeout(600);
  await run('renders the editor and persistent Add trial button',async()=>{
    await page.getByTitle('Add trial',{exact:true}).waitFor();
    assert.equal((await state()).trials.length,7);
    await expect(page.getByTestId('start-badge')).toHaveCount(1);
    await expect(page.getByTestId('item-start').getByText('▶ INICIO DEL EXPERIMENTO',{exact:true})).toBeVisible();
    await snapshot('initial');
    await expect(page.locator('.react-flow__edge-path')).toHaveCount(4);
    assert.equal(await page.locator('.react-flow__edge-path').evaluateAll(paths=>paths.every(path=>path.getTotalLength()>0&&getComputedStyle(path).stroke!=='none'&&parseFloat(getComputedStyle(path).strokeWidth)>0)),true);
  });
  await run('edge selection highlights only the connection and restores its normal style',async()=>{
    const edge=page.locator('.react-flow__edge').filter({has:page.locator('path')}).first();
    const path=edge.locator('.react-flow__edge-path');
    const original=await path.evaluate(p=>({stroke:getComputedStyle(p).stroke,width:parseFloat(getComputedStyle(p).strokeWidth),filter:getComputedStyle(p).filter}));
    const geometry=await page.evaluate(()=>WorkspaceDemo.layout(workspaceDemo.getState()).positions);
    await page.getByTestId('item-start').click();
    await expect(page.getByTestId('item-start').locator('.trial-node')).toHaveClass(/trial-node--selected/);
    const point=await path.evaluate(p=>{const v=p.getPointAtLength(p.getTotalLength()*.62).matrixTransform(p.getScreenCTM());return {x:v.x,y:v.y};});
    await page.mouse.click(point.x,point.y);await page.mouse.move(0,0);
    await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1);
    await expect(page.locator('.trial-node--selected,.loop-node--selected')).toHaveCount(0);
    await expect(page.getByRole('heading',{name:'Conexión seleccionada',exact:true})).toBeVisible();
    const selected=await path.evaluate(p=>({stroke:getComputedStyle(p).stroke,width:parseFloat(getComputedStyle(p).strokeWidth),filter:getComputedStyle(p).filter,marker:p.getAttribute('marker-end')}));
    assert.notEqual(selected.stroke,original.stroke);assert.ok(selected.width>original.width);assert.notEqual(selected.filter,'none');
    const arrow=await path.evaluate(p=>{const id=p.getAttribute('marker-end').match(/#([^'")]+)/)[1];const marker=document.getElementById(id).querySelector('polyline');return getComputedStyle(marker).fill;});
    assert.equal(arrow,selected.stroke);
    await expect(edge.getByRole('img',{name:'Arrastrar para reconectar',exact:true})).toBeVisible();
    assert.deepEqual(await page.evaluate(()=>WorkspaceDemo.layout(workspaceDemo.getState()).positions),geometry);
    await snapshot('selected-edge');
    await page.getByTestId('item-a').click();await page.mouse.move(0,0);
    await expect(page.locator('.react-flow__edge.selected')).toHaveCount(0);
    await expect(page.getByRole('img',{name:'Arrastrar para reconectar',exact:true})).toHaveCount(0);
    await expect(page.getByTestId('item-a').locator('.trial-node')).toHaveClass(/trial-node--selected/);
    const restored=await path.evaluate(p=>({stroke:getComputedStyle(p).stroke,width:parseFloat(getComputedStyle(p).strokeWidth),filter:getComputedStyle(p).filter}));
    assert.deepEqual(restored,original);
    await page.mouse.click(1080,850);
    await expect(page.locator('.trial-node--selected,.react-flow__edge.selected')).toHaveCount(0);
  });
  await run('double click enables node checkboxes and the canvas background clears multiple selection',async()=>{
    await choose(0);const before=await state();
    await page.getByTestId('item-a').dblclick();
    await expect(page.getByRole('checkbox',{name:'Seleccionar Ensayo A',exact:true})).toBeChecked();
    await expect(page.getByRole('checkbox')).toHaveCount(before.trials.length);
    await page.getByRole('checkbox',{name:'Seleccionar Final',exact:true}).check();
    await expect(page.getByTestId('item-a').locator('.trial-node')).toHaveClass(/trial-node--selected/);
    await expect(page.getByTestId('item-b').locator('.trial-node')).toHaveClass(/trial-node--selected/);
    await expect(page.getByRole('heading',{name:'Selección múltiple',exact:true})).toBeVisible();
    await page.getByRole('checkbox',{name:'Seleccionar Ensayo A',exact:true}).uncheck();
    await expect(page.getByTestId('item-a').locator('.trial-node')).not.toHaveClass(/trial-node--selected/);
    await expect(page.getByRole('checkbox',{name:'Seleccionar Final',exact:true})).toBeChecked();
    assert.deepEqual(await state(),before,'selecting nodes does not change the graph or layout');
    await snapshot('multiple-selection');
    await page.mouse.click(1080,850);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.locator('.trial-node--selected,.loop-node--selected')).toHaveCount(0);
    await page.getByTestId('item-a').click();
    await expect(page.getByTestId('item-a').locator('.trial-node')).toHaveClass(/trial-node--selected/);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
  });
  await run('checkboxes sit inside the visual trial and loop nodes and follow their animation',async()=>{
    for(const preset of [0,1]){
      await choose(preset);
      const id=preset===0?'a':(await state()).loops.find(l=>l.name==='Loop principal').id;
      const node=page.getByTestId('item-'+id),name=(await state())[preset===0?'trials':'loops'].find(n=>n.id===id).name;
      const textGeometry=()=>node.evaluate((el,name)=>{
        const parent=el.querySelector('.trial-node,.loop-node'),walker=document.createTreeWalker(parent,NodeFilter.SHOW_TEXT);
        let text;while((text=walker.nextNode()))if(text.textContent.trim()===name)break;
        const range=document.createRange();range.selectNodeContents(text);const bounds=range.getBoundingClientRect(),outer=parent.getBoundingClientRect();
        return{x:bounds.x-outer.x,y:bounds.y-outer.y,width:bounds.width,height:bounds.height};
      },name);
      await page.mouse.move(0,0);const originalText=await textGeometry();await node.dblclick();await page.mouse.move(0,0);
      const checkbox=node.getByRole('checkbox');await expect(checkbox).toBeChecked();
      const selectedText=await textGeometry();for(const key of ['x','y','width','height'])assert.ok(Math.abs(originalText[key]-selectedText[key])<.2,'selection preserves text '+key);
      assert.equal(await checkbox.evaluate(el=>!!el.closest('.trial-node,.loop-node')),true,'checkbox is inside the animated node');
      assert.equal(await checkbox.evaluate(el=>getComputedStyle(el,'::after').borderRightColor),'rgb(255, 255, 255)','the checkmark is white');
      const before=await checkbox.boundingBox();await node.hover();
      const samples=await checkbox.evaluate(async el=>{
        const result=[],parent=el.closest('.trial-node,.loop-node');
        for(let i=0;i<18;i++){
          await new Promise(requestAnimationFrame);const box=el.getBoundingClientRect(),node=parent.getBoundingClientRect();
          result.push({inside:box.left>=node.left&&box.right<=node.right&&box.top>=node.top&&box.bottom<=node.bottom,x:(box.x+box.width/2-node.x)/node.width-parent.clientLeft/parent.offsetWidth,y:(box.y+box.height/2-node.y)/node.height,centerY:box.y+box.height/2});
        }
        return result;
      });
      assert.ok(samples.every(s=>s.inside));
      assert.ok(Math.max(...samples.map(s=>s.x))-Math.min(...samples.map(s=>s.x))<.005);
      assert.ok(Math.max(...samples.map(s=>s.y))-Math.min(...samples.map(s=>s.y))<.005);
      assert.ok(Math.abs(samples.at(-1).centerY-before.y-before.height/2)>1,'checkbox moves with the node');
    }
  });
  await run('clicking node bodies toggles multiple selection and checkbox clicks toggle only once',async()=>{
    await choose(0);const before=await state();await page.getByTestId('item-a').dblclick();
    const final=page.getByTestId('item-b'),checkbox=final.getByRole('checkbox');
    await final.getByText('Final',{exact:true}).click();await expect(checkbox).toBeChecked();
    await final.getByText('Final',{exact:true}).click();await expect(checkbox).not.toBeChecked();
    await checkbox.check();await expect(checkbox).toBeChecked();
    await page.getByTestId('item-a').getByText('Ensayo A',{exact:true}).click();await expect(page.getByTestId('item-a').getByRole('checkbox')).not.toBeChecked();
    await expect(checkbox).toBeChecked();assert.deepEqual(await state(),before);
    await page.getByTestId('item-a').getByText('Ensayo A',{exact:true}).click();await snapshot('checkboxes-inside');
    await choose(1);const s=await state(),outer=s.loops.find(l=>l.name==='Loop principal'),inner=s.loops.find(l=>l.name==='Nested loop');
    await page.getByTestId('item-'+outer.id).dblclick();
    const loop=page.getByTestId('item-'+inner.id);await loop.getByText('Nested loop',{exact:true}).click();await expect(loop.getByRole('checkbox')).toBeChecked();
    await loop.getByText('Nested loop',{exact:true}).click();await expect(loop.getByRole('checkbox')).not.toBeChecked();
    await loop.getByTitle('Collapse loop',{exact:true}).click();await expect(loop.getByRole('checkbox')).not.toBeChecked();
    await expect(page.getByTestId('item-'+outer.id).getByRole('checkbox')).toBeChecked();
  });
  await run('left drag selects with the native rectangle, marks checkboxes, and supports Delete and Undo',async()=>{
    await choose(0);const before=await state(),viewport=await page.locator('.react-flow__viewport').getAttribute('style');
    await page.getByTestId('item-free').click();await page.getByLabel('Item name',{exact:true}).focus();
    await selectBox(['start','a']);
    await expect(page.locator('.react-flow__selection')).toBeVisible();
    await page.mouse.up();await page.mouse.move(0,0);
    await expect(page.locator('.react-flow__selection')).toHaveCount(0);
    await expect(page.getByRole('checkbox',{name:'Seleccionar Inicio',exact:true})).toBeChecked();
    await expect(page.getByRole('checkbox',{name:'Seleccionar Ensayo A',exact:true})).toBeChecked();
    await expect(page.getByRole('checkbox',{name:'Seleccionar Final',exact:true})).not.toBeChecked();
    assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'),viewport);
    assert.deepEqual(await state(),before);await snapshot('selection-rectangle');
    await page.keyboard.press('Delete');const after=await state();assert.ok(!after.trials.some(t=>t.id==='start'||t.id==='a'));assert.ok(after.trials.some(t=>t.id==='b'));
    await page.keyboard.press('Control+z');assert.deepEqual(await state(),before);
  });
  await run('holding a click or drawing a zero-area rectangle never selects everything',async()=>{
    await choose(0);const before=await state();await page.getByTestId('item-free').dblclick();await page.mouse.move(1050,730);
    await page.mouse.down();await page.waitForTimeout(120);
    await expect(page.locator('.node-selection-control input:checked')).toHaveCount(1);
    await expect(page.getByTestId('item-free').getByRole('checkbox')).toBeChecked();
    await page.mouse.move(1051,731);await page.waitForTimeout(80);
    await expect(page.locator('.node-selection-control input:checked')).toHaveCount(1);
    await page.mouse.up();await page.mouse.click(1050,730);
    for(const end of [{x:1050,y:820},{x:960,y:730}]){
      await page.mouse.move(1050,730);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:12});
      await expect(page.locator('.node-selection-control input:checked')).toHaveCount(0);
      await page.mouse.up();await page.mouse.click(1050,850);
    }
    assert.deepEqual(await state(),before);
  });
  await run('a tiny overlap selects a node and moving the rectangle away deselects it',async()=>{
    await choose(0);const before=await state(),node=await page.getByTestId('item-a').boundingBox(),y=node.y+node.height/2;
    await page.mouse.move(node.x-30,y);await page.mouse.down();await page.mouse.move(node.x+2,y+3,{steps:12});
    await expect(page.getByTestId('item-a').getByRole('checkbox')).toBeChecked();
    await expect(page.locator('.node-selection-control input:checked')).toHaveCount(1);
    await page.mouse.move(node.x-5,y+3,{steps:6});await expect(page.locator('.node-selection-control input:checked')).toHaveCount(0);
    await page.mouse.move(node.x+2,y+3,{steps:6});await expect(page.getByTestId('item-a').getByRole('checkbox')).toBeChecked();
    await page.mouse.up();await page.mouse.move(0,0);
    await expect(page.getByTestId('item-a').getByRole('checkbox')).toBeChecked();assert.deepEqual(await state(),before);
  });
  await run('two-finger wheel panning preserves the selected nodes and does not draw a rectangle',async()=>{
    await choose(0);await selectBox(['start','a']);await page.mouse.up();await page.mouse.move(0,0);
    const before=await state(),viewport=await page.locator('.react-flow__viewport').getAttribute('style');
    const canvas=await page.locator('.canvas-area').boundingBox();await page.mouse.move(canvas.x+canvas.width*.8,canvas.y+canvas.height*.8);
    await page.mouse.wheel(120,80);
    await expect(page.locator('.react-flow__viewport')).not.toHaveAttribute('style',viewport);
    await expect(page.locator('.react-flow__selection')).toHaveCount(0);
    await expect(page.getByRole('checkbox',{name:'Seleccionar Inicio',exact:true})).toBeChecked();
    await expect(page.getByRole('checkbox',{name:'Seleccionar Ensayo A',exact:true})).toBeChecked();
    assert.deepEqual(await state(),before);
    await page.mouse.click(canvas.x+canvas.width-30,canvas.y+canvas.height-50);await expect(page.getByRole('checkbox')).toHaveCount(0);
  });
  await run('the same rectangle can select again after clearing and checkboxes stay independently editable',async()=>{
    await choose(0);
    for(let i=0;i<2;i++){
      await selectBox(['start','a']);await page.mouse.up();await page.mouse.move(0,0);
      await expect(page.getByRole('checkbox',{name:'Seleccionar Inicio',exact:true})).toBeChecked();
      await expect(page.getByRole('checkbox',{name:'Seleccionar Ensayo A',exact:true})).toBeChecked();
      await page.getByRole('checkbox',{name:'Seleccionar Ensayo A',exact:true}).uncheck();
      await expect(page.getByRole('checkbox',{name:'Seleccionar Inicio',exact:true})).toBeChecked();
      await page.mouse.click(1080,850);await expect(page.getByRole('checkbox')).toHaveCount(0);
    }
  });
  await run('multiple selection includes loops and Delete removes exactly the checked nodes in one undoable action',async()=>{
    await choose(1);const before=await state(),outer=before.loops.find(l=>l.name==='Loop principal');
    await page.getByTestId('item-'+outer.id).dblclick();
    await expect(page.getByRole('checkbox',{name:'Seleccionar Loop principal',exact:true})).toBeChecked();
    await page.getByRole('checkbox',{name:'Seleccionar Nested A',exact:true}).check();
    await page.keyboard.press('Delete');
    const after=await state();assert.ok(!after.loops.some(l=>l.id===outer.id));assert.ok(!after.trials.some(t=>t.id==='x'));
    assert.ok(after.trials.some(t=>t.id==='y'));assert.ok(after.loops.some(l=>l.name==='Nested loop'));
    await page.keyboard.press('Control+z');assert.deepEqual(await state(),before);
    await page.keyboard.press('Control+Shift+z');assert.deepEqual(await state(),after);
  });
  await run('dragging over an edge previews a sequential insertion without mutating state and commits one undoable edit',async()=>{
    await loadInsertionFixture();const before=await state();await dragOverEdge('free');
    const preview=page.getByTestId('insertion-preview');await expect(preview).toHaveAttribute('data-mode','sequential');
    await expect(page.getByTestId('ghost-free')).toBeVisible();assert.deepEqual(await state(),before);
    await snapshot('ghost-sequential');
    const proposed=await page.evaluate(()=>AppCanvas.previewInsertion(workspaceDemo.getState(),'free',{sourceId:'a',targetId:'b',mode:'sequential'}).state);
    await page.mouse.up();await page.mouse.move(0,0);await expect(preview).toHaveCount(0);
    assert.deepEqual(await state(),proposed);
    await page.keyboard.press('Control+z');assert.deepEqual(await state(),before);
    await page.keyboard.press('Control+Shift+z');assert.deepEqual(await state(),proposed);
  });
  for(const side of ['left','right'])await run('lateral drag previews and commits a parallel insertion on the '+side,async()=>{
    await loadInsertionFixture();const before=await state();await dragOverEdge('free',side==='left'?-70:70);
    await expect(page.getByTestId('insertion-preview')).toHaveAttribute('data-mode','parallel');
    const ghost=await page.getByTestId('ghost-free').boundingBox(),sibling=await page.getByTestId('item-b').boundingBox();
    assert.ok(Math.abs(ghost.y-sibling.y)<2,'the ghost is a sibling of the destination');
    assert.ok(side==='left'?ghost.x<sibling.x:ghost.x>sibling.x);
    assert.deepEqual(await state(),before);await snapshot('ghost-parallel-'+side);
    await page.mouse.up();await page.mouse.move(0,0);
    const after=await state();assert.equal(after.trials.find(t=>t.id==='a').defaultNextTrialId,'b');
    assert.equal(after.trials.find(t=>t.id==='a').thenGoTo[0].targetId,'free');
    assert.equal(after.trials.find(t=>t.id==='free').defaultNextTrialId,null);
    assert.equal(after.trials.find(t=>t.id==='free').thenGoTo.length,0);
    assert.deepEqual(after.trials.find(t=>t.id==='a').destinationOrder,side==='left'?['free','b']:['b','free']);
  });
  for(const slot of ['between','left','right'])await run('a trial becomes the third sibling in the '+slot+' slot of an existing fork',async()=>{
    await loadSiblingFixture();const before=await state();
    const peers=[await page.getByTestId('item-b').boundingBox(),await page.getByTestId('item-loca').boundingBox()].sort((a,b)=>a.x-b.x);
    const x=slot==='between'?(peers[0].x+peers[0].width+peers[1].x)/2:slot==='left'?peers[0].x-50:peers[1].x+peers[1].width+50;
    await dragToPoint('free',{x,y:peers[0].y+peers[0].height/2});
    const preview=page.getByTestId('insertion-preview');await expect(preview).toHaveAttribute('data-mode','parallel');await expect(preview).toHaveAttribute('data-source','a');
    const ghost=await page.getByTestId('ghost-free').boundingBox(),b=await page.getByTestId('item-b').boundingBox(),loca=await page.getByTestId('item-loca').boundingBox();
    assert.ok(Math.abs(ghost.y-b.y)<2&&Math.abs(ghost.y-loca.y)<2);
    if(slot==='between')assert.ok(ghost.x>Math.min(b.x,loca.x)&&ghost.x<Math.max(b.x,loca.x));
    if(slot==='left')assert.ok(ghost.x<Math.min(b.x,loca.x));if(slot==='right')assert.ok(ghost.x>Math.max(b.x,loca.x));
    assert.deepEqual(await state(),before);await snapshot('ghost-siblings-'+slot);
    await page.mouse.up();await page.mouse.move(0,0);
    const after=await state();assert.equal(after.trials.find(t=>t.id==='a').defaultNextTrialId,'b');
    assert.equal(after.trials.find(t=>t.id==='b').defaultNextTrialId,'tail');assert.equal(after.trials.find(t=>t.id==='loca').defaultNextTrialId,'loca-child');
    assert.equal(after.trials.find(t=>t.id==='free').defaultNextTrialId,null);
    assert.equal(await page.evaluate(()=>WorkspaceDemo.connections(workspaceDemo.getState()).filter(e=>e.source==='a').length),3);
    assert.equal(await page.evaluate(()=>WorkspaceDemo.connections(workspaceDemo.getState()).filter(e=>e.source==='free').length),0);
    await page.keyboard.press('Control+z');assert.deepEqual(await state(),before);await page.keyboard.press('Control+Shift+z');assert.deepEqual(await state(),after);
  });
  await run('the shared area of a fork offers another sibling',async()=>{
    await loadSiblingFixture();const parent=await page.getByTestId('item-a').boundingBox();
    await dragToPoint('free',{x:parent.x+parent.width/2,y:parent.y+parent.height+24});
    await expect(page.getByTestId('insertion-preview')).toHaveAttribute('data-mode','parallel');
    await expect(page.getByTestId('insertion-preview')).toHaveAttribute('data-source','a');
    await page.keyboard.press('Escape');await page.mouse.up();await page.mouse.move(0,0);
  });
  await run('a precise hit on one fork arm still inserts sequentially into that branch only',async()=>{
    await loadSiblingFixture();
    const id=await page.evaluate(()=>WorkspaceDemo.layout(workspaceDemo.getState()).flowEdges.find(e=>e.source==='a'&&e.target==='b').id);
    const point=await page.locator('.react-flow__edge[data-id="'+id+'"] .react-flow__edge-path').evaluate(p=>{const point=p.getPointAtLength(p.getTotalLength()*.7).matrixTransform(p.getScreenCTM());return{x:point.x,y:point.y};});
    await dragToPoint('free',point);await expect(page.getByTestId('insertion-preview')).toHaveAttribute('data-mode','sequential');
    await page.mouse.up();await page.mouse.move(0,0);
    const after=await state();assert.equal(after.trials.find(t=>t.id==='a').defaultNextTrialId,'free');assert.equal(after.trials.find(t=>t.id==='free').defaultNextTrialId,'b');
    assert.ok(after.trials.find(t=>t.id==='a').thenGoTo.some(r=>r.targetId==='loca'));
  });
  await run('a branched island previews its real entry and final trial and keeps its other leaf unchanged',async()=>{
    await loadInsertionFixture(true);const before=await state();await dragOverEdge('loca');
    const preview=page.getByTestId('insertion-preview');await expect(preview).toHaveAttribute('data-entry','loca');await expect(preview).toHaveAttribute('data-exit','h2');
    await expect(page.getByTestId('ghost-h1')).toBeVisible();await expect(page.getByTestId('ghost-right')).toBeVisible();
    assert.deepEqual(await state(),before);await snapshot('ghost-branched');
    await page.mouse.up();await page.mouse.move(0,0);
    const after=await state();assert.equal(after.trials.find(t=>t.id==='a').defaultNextTrialId,'loca');
    assert.equal(after.trials.find(t=>t.id==='h2').defaultNextTrialId,'b');assert.equal(after.trials.find(t=>t.id==='right').defaultNextTrialId,null);
  });
  await run('moving away removes the insertion proposal and Escape cancels the whole drag',async()=>{
    await loadInsertionFixture();const before=await state(),point=await dragOverEdge('free');
    await expect(page.getByTestId('insertion-preview')).toBeVisible();
    await page.mouse.move(point.x+400,point.y+100,{steps:12});await expect(page.getByTestId('insertion-preview')).toHaveCount(0);assert.deepEqual(await state(),before);
    await page.mouse.move(point.x,point.y,{steps:12});await expect(page.getByTestId('insertion-preview')).toBeVisible();
    await page.keyboard.press('Escape');await expect(page.getByTestId('insertion-preview')).toHaveCount(0);
    await page.mouse.up();await page.mouse.move(0,0);assert.deepEqual(await state(),before);
  });
  await run('a collapsed nested loop previews real trial endpoints and preserves the destination scope',async()=>{
    await loadInsertionFixture();
    const outer=await page.evaluate(()=>{
      const s=workspaceDemo.getState();s.trials.push(WorkspaceDemo.trial('last','Último trial'));WorkspaceDemo.setDefault(s,'free','last');
      const inner=WorkspaceDemo.groupLoop(s,['last'],'Inner'),outer=WorkspaceDemo.groupLoop(s,['free',inner],'Outer');
      s.loops.find(l=>l.id===outer).expanded=false;workspaceDemo.load(s);return outer;
    });
    await expect(page.getByTestId('item-'+outer)).toBeVisible();await waitForCanvasViewport(page.locator('.canvas-area'));
    await dragOverEdge(outer);const preview=page.getByTestId('insertion-preview');
    await expect(preview).toHaveAttribute('data-entry','free');await expect(preview).toHaveAttribute('data-exit','last');
    await expect(page.getByTestId('ghost-'+outer)).toBeVisible();await snapshot('ghost-loop');
    await page.mouse.up();await page.mouse.move(0,0);
    const after=await state();assert.equal(after.trials.find(t=>t.id==='b').parentLoopId,null);
    assert.equal(after.trials.find(t=>t.id==='last').defaultNextTrialId,'b');
  });
  await run('dragging a selected edge target changes its rule and releases the old destination',async()=>{
    await choose(0);const edge=await selectConnection('a','b');
    await expect(edge.locator('.react-flow__edgeupdater-source')).toHaveCount(0);
    const target=await page.getByTestId('item-loca').locator('[data-handleid="flow-target"]').boundingBox();
    await dragConnectionTarget(edge,{x:target.x+target.width/2,y:target.y+target.height/2});
    await page.waitForFunction(()=>workspaceDemo.getState().trials.find(t=>t.id==='a').defaultNextTrialId==='loca');
    assert.equal(await page.evaluate(()=>WorkspaceDemo.componentFor(workspaceDemo.getState(),'b').locked),false);
    assert.equal(await page.evaluate(()=>WorkspaceDemo.componentFor(workspaceDemo.getState(),'loca').locked),true);
    assert.ok(!(await page.evaluate(()=>WorkspaceDemo.connections(workspaceDemo.getState()))).some(e=>e.source==='a'&&e.target==='b'));
    await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1);
    await expect(page.locator('.trial-node--selected')).toHaveCount(0);
    await snapshot('reconnected-edge');
  });
  await run('dropping a selected connection on empty canvas keeps it unchanged',async()=>{
    await choose(0);const before=JSON.stringify(await state()),edge=await selectConnection('start','a');
    await dragConnectionTarget(edge,{x:1070,y:850});
    assert.equal(JSON.stringify(await state()),before);
    await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1);
  });
  await run('Delete removes the selected edge and all Default/Then references with keyboard undo and redo',async()=>{
    await choose(0);
    await page.evaluate(()=>{const s=workspaceDemo.getState();s.trials.find(t=>t.id==='start').thenGoTo.push({id:'shared',targetId:'a'});workspaceDemo.load(s);});
    const before=await state();await selectConnection('start','a');
    await page.keyboard.press('Delete');
    await expect(page.locator('.react-flow__edge.selected')).toHaveCount(0);
    const after=await state(),source=after.trials.find(t=>t.id==='start');
    assert.equal(source.defaultNextTrialId,null);assert.equal(source.thenGoTo.length,0);
    assert.equal(after.trials.length,before.trials.length);
    assert.equal(await page.evaluate(()=>WorkspaceDemo.componentFor(workspaceDemo.getState(),'a').locked),false);
    await page.keyboard.press('Control+z');assert.deepEqual(await state(),before);
    await page.keyboard.press('Control+Shift+z');assert.deepEqual(await state(),after);
    await page.keyboard.press('Meta+z');assert.deepEqual(await state(),before);
    await page.getByTitle('Rehacer',{exact:true}).click();assert.deepEqual(await state(),after);
    await page.getByTitle('Deshacer',{exact:true}).click();assert.deepEqual(await state(),before);
    await page.keyboard.press('Meta+Shift+z');assert.deepEqual(await state(),after);
  });
  await run('Backspace deletes only the selected trial and undo restores its exact graph',async()=>{
    await choose(0);await selectConnection('start','a');
    await page.getByTestId('item-loca').click();
    const before=await state();await page.keyboard.press('Backspace');
    await page.getByTestId('item-loca').waitFor({state:'detached'});
    const after=await state();
    assert.ok(!after.trials.some(t=>t.id==='loca'));assert.ok(after.trials.some(t=>t.id==='loca1'));
    assert.equal(after.trials.find(t=>t.id==='start').defaultNextTrialId,'a');
    await page.keyboard.press('Control+z');assert.deepEqual(await state(),before);
    await page.keyboard.press('Control+y');assert.deepEqual(await state(),after);
  });
  await run('Delete ungroups expanded and collapsed loops while preserving nested loops and trials',async()=>{
    for(const collapsed of [false,true]){
      await choose(1);const before=await state(),loop=before.loops.find(l=>l.name==='Loop principal');
      if(collapsed)await page.getByTestId('item-'+loop.id).getByTitle('Collapse loop',{exact:true}).click();
      await page.getByTestId('item-'+loop.id).click();
      const selected=await state();await page.keyboard.press('Delete');
      await page.getByTestId('item-'+loop.id).waitFor({state:'detached'});
      const after=await state();assert.equal(after.trials.length,before.trials.length);
      assert.ok(!after.loops.some(l=>l.id===loop.id));
      const inner=after.loops.find(l=>l.name==='Nested loop');assert.equal(inner.parentLoopId,null);
      assert.equal(after.trials.find(t=>t.id==='x').parentLoopId,inner.id);
      await page.keyboard.press('Control+z');assert.deepEqual(await state(),selected);
    }
  });
  await run('editing fields, open dialogs and an empty selection do not delete graph elements',async()=>{
    await choose(0);await page.mouse.click(1080,850);
    const none=await state();await page.keyboard.press('Delete');await page.keyboard.press('Backspace');assert.deepEqual(await state(),none);
    await page.getByTestId('item-a').click();
    const name=page.getByLabel('Item name',{exact:true});await name.fill('Renamed');await name.press('End');await name.press('Backspace');
    assert.equal((await state()).trials.find(t=>t.id==='a').name,'Rename');
    assert.equal((await state()).trials.length,none.trials.length);
    await selectConnection('start','a');
    const select=page.getByLabel('Inicio de ejecución',{exact:true});await select.focus();
    const focused=await state();await page.keyboard.press('Delete');assert.deepEqual(await state(),focused);
    await page.keyboard.press('Control+z');assert.deepEqual(await state(),focused);
    await page.keyboard.press('Control+Shift+z');assert.deepEqual(await state(),focused);
    await page.getByRole('button',{name:'Estado / HTML',exact:true}).click();
    const dialog=await state();await page.keyboard.press('Delete');await page.keyboard.press('Control+z');assert.deepEqual(await state(),dialog);
    await page.getByRole('button',{name:'Close modal',exact:true}).click();
    await page.getByTestId('item-a').click();await page.getByRole('button',{name:'Open branching conditions',exact:true}).click();
    await expect(page.getByLabel('Default destination',{exact:true})).toBeVisible();
    const branching=await state();await page.keyboard.press('Delete');assert.deepEqual(await state(),branching);
    await page.getByRole('button',{name:'Save configuration',exact:true}).click();
  });
  await run('a fresh graph edit after undo discards redo and repeated deletion has no hidden history',async()=>{
    await choose(0);await page.getByTestId('item-free').click();const before=await state();
    await page.keyboard.press('Delete');const deleted=await state();
    await page.keyboard.press('Delete');await page.keyboard.press('Backspace');
    await page.keyboard.press('Control+z');assert.deepEqual(await state(),before);
    await page.getByTestId('item-loca2').click();await page.keyboard.press('Delete');
    const edited=await state();assert.ok(edited.trials.some(t=>t.id==='free'));
    await expect(page.getByTitle('Rehacer',{exact:true})).toBeDisabled();
    await page.keyboard.press('Control+Shift+z');assert.deepEqual(await state(),edited);
    assert.notDeepEqual(edited,deleted);
  });
  await run('creating a trial replaces the edge selection, so Delete cannot remove the former connection',async()=>{
    await choose(0);await selectConnection('start','a');
    await page.getByTitle('Add trial',{exact:true}).click();
    const added=(await state()).trials.at(-1).id;
    await expect(page.locator('.react-flow__edge.selected')).toHaveCount(0);
    await expect(page.getByTestId('item-'+added).locator('.trial-node')).toHaveClass(/trial-node--selected/);
    await page.keyboard.press('Delete');await page.getByTestId('item-'+added).waitFor({state:'detached'});
    assert.equal((await state()).trials.find(t=>t.id==='start').defaultNextTrialId,'a');
  });
  await choose(0);
  await run('adds a loose trial excluded from generated HTML',async()=>{
    await page.getByTitle('Add trial',{exact:true}).click();
    const s=await state(),id=s.trials.at(-1).id;
    assert.equal(s.trials.length,8);
    assert.equal(await page.evaluate(id=>WorkspaceDemo.componentFor(workspaceDemo.getState(),id).locked,id),false);
    assert.equal(await page.evaluate(id=>WorkspaceDemo.compile(workspaceDemo.getState()).trials.some(t=>t.id===id),id),false);
  });
  await run('default connection attaches LOCA and removal releases it',async()=>{
    await page.getByRole('button',{name:'Final Editor',exact:true}).count();
    await page.locator('.trial-list-button').filter({hasText:/^Final/}).click();await page.getByRole('button',{name:'Open branching conditions',exact:true}).click();
    await page.getByLabel('Default destination',{exact:true}).selectOption('loca');
    assert.equal(await page.evaluate(()=>WorkspaceDemo.reachable(workspaceDemo.getState()).trials.has('loca2')),true);
    await page.getByLabel('Default destination',{exact:true}).selectOption('FINISH_EXPERIMENT');await page.getByRole('button',{name:'Save configuration',exact:true}).click();
    assert.equal(await page.evaluate(()=>WorkspaceDemo.componentFor(workspaceDemo.getState(),'loca2').locked),false);
  });
  await run('dragging a child moves the whole disconnected structure',async()=>{
    await choose(0);
    const before=await page.evaluate(()=>WorkspaceDemo.layout(workspaceDemo.getState()).positions);
    const node=page.getByTestId('item-loca1'),box=await node.boundingBox();
    await page.mouse.move(box.x+box.width*.3,box.y+box.height*.55);await page.mouse.down();await page.mouse.move(box.x+box.width*.3+95,box.y+box.height*.55+55,{steps:12});await page.mouse.up();
    const after=await page.evaluate(()=>WorkspaceDemo.layout(workspaceDemo.getState()).positions);
    assert.ok(after.loca.x-before.loca.x>50);
    for(const id of ['loca','loca1','loca2'])assert.ok(Math.abs((after[id].x-before[id].x)-(after.loca.x-before.loca.x))<.01);
    assert.equal(after.start.x,before.start.x);
    await page.waitForTimeout(100);
    assert.equal(await page.getByTestId('item-loca1').count(),1);
    assert.deepEqual(errors,[],'drag must not crash after React processes its queued state update');
  });
  await run('green plus opens Sequential/Parallel and creates a removable Then go to',async()=>{
    await choose(0);await page.getByTestId('item-start').click();
    await page.getByTestId('item-start').getByTitle('Add branch',{exact:true}).click();
    await page.getByRole('button',{name:'As Branch (Parallel)',exact:true}).click();
    const s=await state(),child=s.trials.at(-1);
    assert.ok(s.trials.find(t=>t.id==='start').thenGoTo.some(r=>r.targetId===child.id));
    await page.locator('.trial-list-button').filter({hasText:/^Inicio/}).click();await page.getByRole('button',{name:'Open branching conditions',exact:true}).click();
    await page.getByTitle('Remove condition',{exact:true}).first().click();await page.getByRole('button',{name:'Save configuration',exact:true}).click();
    assert.equal(await page.evaluate(id=>WorkspaceDemo.componentFor(workspaceDemo.getState(),id).locked,child.id),false);
  });
  await run('nested loop detach lifts trials into the root canvas',async()=>{
    await choose(1);
    await page.locator('.trial-list-button').filter({hasText:/^Nested A/}).click();await page.getByRole('button',{name:'Open branching conditions',exact:true}).click();
    await page.getByLabel('Default destination',{exact:true}).selectOption('');
    await page.getByRole('button',{name:'Save configuration',exact:true}).click();
    const s=await state();assert.equal(s.trials.find(t=>t.id==='y').parentLoopId,null);
    assert.equal(await page.evaluate(()=>WorkspaceDemo.componentFor(workspaceDemo.getState(),'y').locked),false);
    await snapshot('nested-detached');
  });
  await run('loop markers reject branching handles and preserve collapsed projection',async()=>{
    await choose(1);const s=await state(),loop=s.loops.find(l=>l.name==='Loop principal');
    await page.getByTestId('item-'+loop.id).getByTitle('Collapse loop',{exact:true}).click();
    await page.getByTestId('item-x').waitFor({state:'detached'});
    const handles=page.getByTestId('item-'+loop.id).locator('.react-flow__handle');
    assert.equal(await handles.first().evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    await page.getByTestId('item-'+loop.id).getByTitle('Expand loop',{exact:true}).click();
    await page.getByTestId('item-p').waitFor();
    await page.evaluate(()=>{
      const s=WorkspaceDemo.makeState('Nested start',[WorkspaceDemo.trial('first','Primer trial',null,'second'),WorkspaceDemo.trial('second','Segundo trial')],[],'first');
      const inner=WorkspaceDemo.groupLoop(s,['first','second'],'Inner');WorkspaceDemo.groupLoop(s,[inner],'Outer');
      workspaceDemo.load(s);
    });
    await expect(page.getByTestId('item-first').getByTestId('start-badge')).toBeVisible();
    const loops=(await state()).loops,inner=loops.find(l=>l.name==='Inner'),outer=loops.find(l=>l.name==='Outer');
    await page.getByTestId('item-'+inner.id).getByTitle('Collapse loop',{exact:true}).click();
    await expect(page.getByTestId('item-'+inner.id).getByTestId('start-badge')).toBeVisible();
    await page.getByTestId('item-'+outer.id).getByTitle('Collapse loop',{exact:true}).click();
    await expect(page.getByTestId('item-'+outer.id).getByTestId('start-badge')).toBeVisible();
    await expect(page.getByTestId('start-badge')).toHaveCount(1);
  });
  await run('loop grouping modal creates a nested-capable ownership scope',async()=>{
    await choose(0);await page.locator('.trial-list-button').filter({hasText:/^LOCA/}).click();
    await page.getByTitle('Add loop',{exact:true}).click();
    await page.getByRole('checkbox').nth(3).check();await page.getByRole('checkbox').nth(4).check();
    await page.getByRole('checkbox').nth(5).check();
    await page.getByRole('button',{name:'Confirm (3 items)',exact:true}).click();
    const s=await state();assert.equal(s.loops.length,1);assert.equal(s.trials.find(t=>t.id==='loca1').parentLoopId,s.loops[0].id);
  });
  await run('real handle drag assigns Default first, Then go to second, and rejects equal ends',async()=>{
    await choose(0);
    await dragHandles('free','top','loca','top');
    assert.equal((await state()).trials.find(t=>t.id==='free').thenGoTo.length,0);
    await dragHandles('loca','top','b','bottom');
    await page.waitForFunction(()=>workspaceDemo.getState().trials.find(t=>t.id==='b').defaultNextTrialId==='loca');
    assert.equal((await state()).trials.find(t=>t.id==='b').thenGoTo.length,0);
    assert.equal(await page.evaluate(()=>WorkspaceDemo.componentFor(workspaceDemo.getState(),'loca2').locked),true);
    await waitForCanvasViewport(page.locator('.canvas-area'));
    await dragHandles('b','bottom','free','top');
    await page.waitForFunction(()=>workspaceDemo.getState().trials.find(t=>t.id==='b').thenGoTo.some(r=>r.targetId==='free'));
    assert.equal((await state()).trials.find(t=>t.id==='b').defaultNextTrialId,'loca');
  });
  await run('inserting a loose trial and removing the bypass preserves a complete Default route',async()=>{
    await choose(0);
    await page.evaluate(()=>{
      const s=workspaceDemo.getState();s.trials=s.trials.filter(t=>!['loca','loca1','loca2'].includes(t.id));delete s.anchors.loca;
      workspaceDemo.load(s);
    });
    await expect(page.locator('.react-flow__node')).toHaveCount(4);await waitForCanvasViewport(page.locator('.canvas-area'));
    await dragHandles('a','bottom','free','top');
    await page.waitForFunction(()=>workspaceDemo.getState().trials.find(t=>t.id==='a').thenGoTo.some(r=>r.targetId==='free'));
    await waitForCanvasViewport(page.locator('.canvas-area'));await dragHandles('free','bottom','b','top');
    await page.waitForFunction(()=>workspaceDemo.getState().trials.find(t=>t.id==='free').defaultNextTrialId==='b');
    const before=await state();await selectConnection('a','b');await page.keyboard.press('Delete');
    const inserted=await state();assert.equal(inserted.trials.find(t=>t.id==='a').defaultNextTrialId,'free');
    assert.equal(inserted.trials.find(t=>t.id==='free').defaultNextTrialId,'b');
    assert.equal(inserted.trials.find(t=>t.id==='free').thenGoTo.length,0);
    assert.equal(inserted.trials.find(t=>t.id==='a').thenGoTo[0].targetId,'free');
    await page.keyboard.press('Control+z');assert.deepEqual(await state(),before);
    await page.keyboard.press('Control+Shift+z');assert.deepEqual(await state(),inserted);
    await page.getByTestId('item-free').click();await page.getByRole('button',{name:'Open branching conditions',exact:true}).click();
    await expect(page.getByLabel('Default destination',{exact:true})).toHaveValue('b');
    await page.getByRole('button',{name:'Save configuration',exact:true}).click();
    await snapshot('default-insertion');
    await page.getByRole('button',{name:'Estado / HTML',exact:true}).click();await page.getByRole('button',{name:'Ejecutar HTML',exact:true}).click();
    const frame=page.frameLocator('iframe[title="Generated experiment preview"]');
    for(const name of ['Ensayo A','Trial suelto','Final','Finish experiment'])await frame.getByRole('button',{name:'Default → '+name,exact:true}).click();
    await frame.getByRole('heading',{name:'Preview complete',exact:true}).waitFor();
    await page.getByRole('button',{name:'Close modal',exact:true}).click();
  });
  await run('multiple Then go to rows share one edge and keep the same destination as Default',async()=>{
    await choose(0);await page.getByTestId('item-free').click();await page.getByRole('button',{name:'Open branching conditions',exact:true}).click();
    await page.getByRole('button',{name:/Add first condition/}).click();
    await page.getByLabel('Then go to · 1',{exact:true}).selectOption('b');
    await expect(page.getByLabel('Default destination',{exact:true})).toHaveValue('b');
    await page.getByRole('button',{name:/Add condition/}).click();
    await page.getByLabel('Then go to · 2',{exact:true}).selectOption('b');
    await expect(page.getByLabel('Default destination',{exact:true})).toHaveValue('b');
    const shared=await page.evaluate(()=>WorkspaceDemo.connections(workspaceDemo.getState()).filter(e=>e.source==='free'));
    assert.equal(shared.length,1);assert.equal(shared[0].refs.length,3);
    await page.getByRole('button',{name:'Save configuration',exact:true}).click();
    await selectConnection('free','b');await page.keyboard.press('Delete');
    const free=(await state()).trials.find(t=>t.id==='free');assert.equal(free.defaultNextTrialId,null);assert.equal(free.thenGoTo.length,0);
  });
  await run('all structural DB snapshots render without model errors',async()=>{
    for(const i of [4,5,6]){await choose(i);assert.ok((await state()).name.startsWith('DB · '));await snapshot('db-'+i);}
  });
  await run('deleting a trial preserves its descendants and supports Undo',async()=>{
    await choose(0);await page.locator('.trial-list-button').filter({hasText:/^LOCA/}).click();
    await page.getByRole('button',{name:'Eliminar trial',exact:true}).click();
    const s=await state();assert.ok(!s.trials.some(t=>t.id==='loca'));assert.ok(s.trials.some(t=>t.id==='loca1'));
    await page.getByTestId('item-loca').waitFor({state:'detached'});
    await page.getByTitle('Deshacer',{exact:true}).click();
    await page.getByTestId('item-loca').waitFor();
  });
  const setDefaultFromPanel=async(name,target)=>{
    await page.locator('.trial-list-button').filter({hasText:new RegExp('^'+name+'(?:HTML|Editor| )')}).first().click();
    await page.getByRole('button',{name:'Open branching conditions',exact:true}).click();
    await page.getByLabel('Default destination',{exact:true}).selectOption(target);
    await page.getByRole('button',{name:'Save configuration',exact:true}).click();
    await page.mouse.move(0,0);
  };
  await run('pending groups remain movable without shifting the main route',async()=>{
    await choose(0);const before=await page.evaluate(()=>WorkspaceDemo.layout(workspaceDemo.getState()).positions);
    await setDefaultFromPanel('Hijo 2','b');
    await page.getByTestId('partial-badge').waitFor();
    assert.equal((await state()).entryId,'start');
    const attached=await page.evaluate(()=>WorkspaceDemo.layout(workspaceDemo.getState()).positions);
    for(const id of ['start','a','b'])assert.deepEqual(attached[id],before[id]);
    await waitForCanvasViewport(page.locator('.canvas-area'));
    const screenBefore=await page.getByTestId('item-start').boundingBox();
    const handle=await page.getByTestId('item-loca1').boundingBox();
    await page.mouse.move(handle.x+handle.width*.4,handle.y+handle.height*.6);await page.mouse.down();
    await page.mouse.move(handle.x+handle.width*.4+65,handle.y+handle.height*.6+35,{steps:15});await page.mouse.up();
    await page.mouse.move(0,0);await page.waitForTimeout(150);
    const moved=await page.evaluate(()=>WorkspaceDemo.layout(workspaceDemo.getState()).positions);
    assert.ok(moved.loca.x-attached.loca.x>30);
    for(const id of ['start','a','b'])assert.deepEqual(moved[id],before[id]);
    const screenAfter=await page.getByTestId('item-start').boundingBox();
    assert.ok(Math.abs(screenAfter.x-screenBefore.x)<.1&&Math.abs(screenAfter.y-screenBefore.y)<.1);
    assert.deepEqual(errors,[]);
    await snapshot('partial-connection');
  });
  await run('a whole prefix becomes the start while a connection to the former start remains partial',async()=>{
    await choose(0);await setDefaultFromPanel('Hijo 2','start');
    assert.equal((await state()).entryId,'loca');
    await expect(page.getByTestId('item-loca').getByTestId('start-badge')).toBeVisible();
    await expect(page.getByLabel('Inicio de ejecución',{exact:true})).toHaveValue('loca');
    assert.equal(await page.evaluate(()=>WorkspaceDemo.componentFor(workspaceDemo.getState(),'loca1').locked),true);
    await setDefaultFromPanel('Trial suelto','start');
    assert.equal((await state()).entryId,'loca');
    assert.equal(await page.evaluate(()=>WorkspaceDemo.componentFor(workspaceDemo.getState(),'free').locked),false);
    await page.getByTestId('partial-badge').waitFor();
  });
  await run('cutting the photographed return promotes Hijo 2 as the sole start',async()=>{
    await choose(0);await setDefaultFromPanel('Final','loca');await setDefaultFromPanel('Hijo 2','start');
    assert.equal((await state()).entryId,'start','a return keeps the original start');
    await setDefaultFromPanel('Hijo 1','FINISH_EXPERIMENT');
    assert.equal((await state()).entryId,'loca2');
    await expect(page.getByTestId('item-loca2').getByTestId('start-badge')).toBeVisible();
    await expect(page.getByTestId('start-badge')).toHaveCount(1);
    await expect(page.getByLabel('Inicio de ejecución',{exact:true})).toHaveValue('loca2');
    assert.equal(await page.evaluate(()=>WorkspaceDemo.compile(workspaceDemo.getState()).entryId),'loca2');
    await waitForCanvasViewport(page.locator('.canvas-area'));await snapshot('promoted-start');
  });
  const canvas=page.locator('.canvas-area');
  const appScenarios=await page.evaluate(()=>AppCanvas.flatCurveScenarios.map((s,index)=>({name:s.name,spine:s.spine,count:s.items.length,edges:s.items.reduce((n,t)=>n+(t.branches?.length??0),0),index})));
  for(const fixture of appScenarios)await run('original app browser geometry: '+fixture.name,async()=>{
    await page.evaluate(index=>workspaceDemo.load(AppCanvas.fromAppGraph(AppCanvas.flatCurveScenarios[index].graph())),fixture.index);
    await expect(page.locator('.react-flow__node')).toHaveCount(fixture.count);
    await expect(page.locator('.react-flow__edge-path')).toHaveCount(fixture.edges);
    await page.mouse.move(0,0);await waitForCanvasViewport(canvas);
    for(let i=1;i<fixture.spine.length;i++)await expectBelowAndCentered(canvas,fixture.spine[i-1],fixture.spine[i]);
    const nodeLocators=await canvas.locator('.react-flow__node').all();
    for(const path of await canvas.locator('.react-flow__edge-path').all()){
      await expect(path).toHaveAttribute('d',/C/);await expect(path).toHaveAttribute('marker-end',/url/);
      await expectPathAvoidsNodes(path,nodeLocators);
    }
    assert.equal(await canvas.evaluate(element=>{const bounds=element.getBoundingClientRect();return [...element.querySelectorAll('.react-flow__edge-path')].every(path=>{const box=path.getBoundingClientRect();return box.left>=bounds.left&&box.right<=bounds.right&&box.top>=bounds.top&&box.bottom<=bounds.bottom;});}),true,'all original app curves must remain in the viewport');
  });
  await run('HTML execution contains only connected trials',async()=>{
    await choose(0);await page.getByRole('button',{name:'Estado / HTML',exact:true}).click();
    await page.getByRole('button',{name:'Ejecutar HTML',exact:true}).click();
    const frame=page.frameLocator('iframe[title="Generated experiment preview"]');
    await frame.getByRole('heading',{name:'Inicio',exact:true}).waitFor();
    await frame.getByRole('button',{name:'Default → Ensayo A',exact:true}).click();
    await frame.getByRole('button',{name:'Default → Final',exact:true}).click();
    await frame.getByRole('button',{name:'Default → Finish experiment',exact:true}).click();
    await frame.getByRole('heading',{name:'Preview complete',exact:true}).waitFor();
    assert.equal(await frame.getByText('LOCA',{exact:true}).count(),0);
    await page.getByRole('button',{name:'Close modal',exact:true}).click();
  });
  await run('exported nested loops repeat before continuing to the final trial',async()=>{
    await choose(1);await page.getByRole('button',{name:'Estado / HTML',exact:true}).click();
    await page.getByRole('button',{name:'Ejecutar HTML',exact:true}).click();
    const frame=page.frameLocator('iframe[title="Generated experiment preview"]');
    await frame.getByRole('heading',{name:'Inicio',exact:true}).waitFor();
    const visited=[];
    for(let step=0;step<30;step++){
      const name=await frame.locator('h1').innerText();
      if(name==='Preview complete')break;
      visited.push(name);await frame.getByRole('button',{name:/^Default →/}).click();
    }
    assert.equal(visited.filter(name=>name==='Antes del nested').length,3);
    assert.equal(visited.filter(name=>name==='Nested A').length,6);
    assert.equal(visited.filter(name=>name==='Nested B').length,6);
    assert.equal(visited.at(-1),'Final experimento');
    await frame.getByRole('heading',{name:'Preview complete',exact:true}).waitFor();
  });
  assert.deepEqual(errors,[],'browser errors');
  console.log('Browser checks complete; screenshots in /private/tmp/branching-workspace-*.png');
} finally { await browser.close();server.close(); }
