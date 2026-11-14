import { parse } from 'acorn';
import { fullAncestor } from 'acorn-walk';

export function instrumentInputs(source, { scope, browser = false } = {}) {
  if (typeof scope !== 'string' || !scope) throw new Error('Source input scope required');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true });
  const uuidNames = new Set(), edits = [], target = browser ? 'window.__costInputs' : '__costInputs';
  for (const statement of ast.body) if (statement.type === 'ImportDeclaration' && ['node:crypto', 'crypto', 'uuid'].includes(statement.source.value)) {
    for (const specifier of statement.specifiers) if (['randomUUID', 'v4'].includes(specifier.imported?.name)) uuidNames.add(specifier.local.name);
  }
  const member = (node, object, property) => node?.type === 'MemberExpression' && !node.computed && node.object.name === object && node.property.name === property;
  const key = node => node?.name ?? node?.value;
  const actor = ancestors => {
    const names = ancestors.flatMap(node => {
      if (node.type === 'VariableDeclarator') return key(node.id) ? [key(node.id)] : [];
      if (node.type === 'Property' || node.type === 'MethodDefinition') return key(node.key) ? [String(key(node.key))] : [];
      if (/^Function/.test(node.type) && node.id?.name) return [node.id.name];
      return [];
    });
    return scope + ':' + (names.join('/') || 'root');
  };
  fullAncestor(ast, (node, _state, ancestors) => {
    const identity = JSON.stringify(actor(ancestors));
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      if (member(callee, 'crypto', 'randomUUID') || uuidNames.has(callee.name)) edits.push([node.start, node.end, `${target}.id(${identity})`]);
      else if (member(callee, 'Math', 'random')) edits.push([node.start, node.end, `${target}.random(${identity})`]);
      else if (browser && callee.type === 'Identifier' && callee.name === 'initJsPsych') edits.push([callee.start, callee.end, `${target}.initJsPsych`]);
      else if (browser && callee.type === 'Identifier' && callee.name === 'fetch') edits.push([callee.start, callee.end, `${target}.fetch`]);
      else if (member(callee, 'Date', 'now')) {
        const parent = ancestors.at(-2);
        if (parent?.type === 'NewExpression' && parent.callee.name === 'Date' && parent.arguments[0] === node) return;
        const dataField = parent?.type === 'AssignmentExpression' ? key(parent.left?.property)
          : parent?.type === 'Property' ? key(parent.key) : null;
        const numeric = scope.startsWith('server/') || ['clientTimestamp', 'timestamp', 'createdAt'].includes(dataField);
        edits.push([node.start, node.end, numeric ? `${target}.number(${identity})` : `${target}.now()`]);
      }
    }
    if (member(node, 'Date', 'now') && !(ancestors.at(-2)?.type === 'CallExpression' && ancestors.at(-2).callee === node)) edits.push([node.start, node.end, `${target}.now`]);
    if (node.type === 'NewExpression' && node.callee.name === 'Date'
        && (node.arguments.length === 0 || (node.arguments.length === 1 && member(node.arguments[0].callee, 'Date', 'now')))) edits.push([node.start, node.end, `${target}.date()`]);
  });
  let output = source;
  for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0])) output = output.slice(0, start) + replacement + output.slice(end);
  return output;
}
