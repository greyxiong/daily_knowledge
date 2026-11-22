import {parseExpressionAt} from 'acorn';
const denied=new Set(['constructor','prototype','__proto__']);
export function evaluate(expression,scope={}) {
 const tree=parseExpressionAt(expression,0,{ecmaVersion:2022});
 if(expression.slice(tree.end).trim())throw new Error('Trailing expression');
 function run(n,env=scope) {
  switch(n.type) {
   case 'Literal':return n.value;
   case 'Identifier':if(Object.hasOwn(env,n.name))return env[n.name];throw new Error(`Unsupported identifier: ${n.name}`);
   case 'ArrayExpression':if(n.elements.length>200)throw new Error('Array limit');return n.elements.map(x=>run(x,env));
   case 'ObjectExpression':return Object.fromEntries(n.properties.map(p=>{if(p.type!=='Property'||p.method||p.computed)throw new Error('Unsupported object');const k=p.key.name??p.key.value;if(denied.has(k))throw new Error('Unsafe key');return [k,run(p.value,env)];}));
   case 'UnaryExpression':{const v=run(n.argument,env);if(n.operator==='-')return -v;if(n.operator==='+')return +v;if(n.operator==='!')return !v;break;}
   case 'BinaryExpression':{const a=run(n.left,env),b=run(n.right,env);switch(n.operator){case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':return a/b;case '%':return a%b;case '**':return a**b;case '===':return a===b;case '!==':return a!==b;case '<':return a<b;case '>':return a>b;case '<=':return a<=b;case '>=':return a>=b;}break;}
   case 'ConditionalExpression':return run(n.test,env)?run(n.consequent,env):run(n.alternate,env);
   case 'TemplateLiteral':return n.quasis.map((q,i)=>q.value.cooked+(i<n.expressions.length?run(n.expressions[i],env):'')).join('');
   case 'MemberExpression':{const value=run(n.object,env),key=n.computed?run(n.property,env):n.property.name;if(denied.has(String(key))||value==null)throw new Error('Unsafe property');if(Array.isArray(value)&&Number.isInteger(Number(key)))return value[key];if(Object.hasOwn(value,key))return value[key];throw new Error('Unsupported property');}
   case 'CallExpression':{
    if(n.callee.type!=='MemberExpression')break;
    const obj=n.callee.object,method=n.callee.property.name;
    if(obj.type==='Identifier'&&obj.name==='Math'&&method==='floor'&&n.arguments.length===1)return Math.floor(run(n.arguments[0],env));
    if(obj.type==='Identifier'&&obj.name==='Array'&&method==='from') {
     const cfg=run(n.arguments[0],env),fn=n.arguments[1];if(!Number.isInteger(cfg.length)||cfg.length<0||cfg.length>200||fn?.type!=='ArrowFunctionExpression'||fn.body.type!=='Identifier'||fn.params[1]?.name!==fn.body.name)throw new Error('Unsupported array generator');
     return Array.from({length:cfg.length},(_,i)=>i);
    }
    const value=run(obj,env),args=n.arguments.map(a=>run(a,env));
    if(method==='includes'&&Array.isArray(value)&&args.length===1)return value.includes(args[0]);
    if(method==='toLocaleString'&&typeof value==='number'&&args.length<=1&&(!args.length||args[0]==='en-US'))return value.toLocaleString('en-US');
    break;
   }
  }
  throw new Error(`Unsupported expression: ${n.type}`);
 }
 return run(tree);
}
export function braceEnd(source,start) {
 let depth=0,quote=null,escape=false;
 for(let i=start;i<source.length;i++){
  const c=source[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue;}
  if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0)return i;
 }
 return -1;
}
