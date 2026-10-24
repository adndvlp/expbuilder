import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../client/package.json',import.meta.url));
const { build } = require('esbuild');
const react = require('react'), flow = require('@xyflow/react'), dom = require('react-dom');
const globals = {react:['React',react],'react-dom':['ReactDOM',dom],'react/jsx-runtime':['jsxRuntime',{jsx:1,jsxs:1,Fragment:1}],'@xyflow/react':['ReactFlow',flow]};
const result=await build({
  entryPoints:[fileURLToPath(new URL('./branching-workspace-app.tsx',import.meta.url))],
  outdir:'/virtual',bundle:true,write:false,format:'iife',globalName:'AppCanvas',jsx:'automatic',minify:true,
  plugins:[{name:'pinned-cdn-globals',setup(b){
    b.onResolve({filter:/hooks\/useTrials$/},()=>({path:'trials',namespace:'demo-state'}));
    b.onResolve({filter:/intents\/branching$/},()=>({path:'branching',namespace:'demo-state'}));
    b.onLoad({filter:/.*/,namespace:'demo-state'},args=>({contents:args.path==='trials'
      ?'export default function useTrials(){return globalThis.workspaceDemo.defaultDependencies;}'
      :'export async function saveBranchingIntent(o){return o.dependencies.updateTrial(o.item.id,{defaultNextTrialId:o.defaultNextTrialId});}',loader:'js'}));
    b.onResolve({filter:/^(react|react-dom|react\/jsx-runtime|@xyflow\/react)$/},args=>({path:args.path,namespace:'cdn'}));
    b.onLoad({filter:/.*/,namespace:'cdn'},args=>{
      const [name,exports]=globals[args.path];
      return {contents:`const api=globalThis.${name}; export default api; `+Object.keys(exports).filter(k=>k!=='default'&&/^[A-Za-z_$][\w$]*$/.test(k)).map(k=>`export const ${k}=api.${k};`).join('\n'),loader:'js'};
    });
    // Keep the real toolbar, changing only the explicitly requested persistent + button.
    b.onLoad({filter:/CanvasToolbar\.tsx$/},args=>({contents:readFileSync(args.path,'utf8').replace('isRoot && itemCount === 0','isRoot'),loader:'tsx'}));
  }}],
});
const path=new URL('./branching-workspace.html',import.meta.url);
let html=readFileSync(path,'utf8');
html=html.replace(/\n?<script id="app-canvas-library">[\s\S]*?<\/script>/,'').replace(/\n?<style id="app-canvas-styles">[\s\S]*?<\/style>/,'');
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text.replace(/<\/script/gi,'<\\/script');
const css=result.outputFiles.find(f=>f.path.endsWith('.css'))?.text??'';
html=html.replace('<script id="workspace-ui">',()=>`<style id="app-canvas-styles">${css}</style>\n<script id="app-canvas-library">${js}</script>\n<script id="workspace-ui">`);
writeFileSync(path,html);
console.log('Embedded actual app components, styles and layout:',js.length,'JS bytes,',css.length,'CSS bytes');
