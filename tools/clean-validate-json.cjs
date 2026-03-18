// scripts/clean-validate-json.js
const fs = require('fs');
const path = require('path');

function walk(dir){
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e=>{
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p;
  });
}

const root = process.cwd();
const files = walk(root).filter(f => f.endsWith('.json'));
let bad = 0;
for(const f of files){
  try{
    let s = fs.readFileSync(f,'utf8');
    // remove BOM
    if(s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    // trim trailing garbage after last }
    const last = s.lastIndexOf('}');
    if(last !== -1 && last < s.length - 1) s = s.slice(0, last+1);
    // write back if changed
    fs.writeFileSync(f, s, 'utf8');
    // validate
    JSON.parse(s);
    console.log('OK', f);
  }catch(e){
    bad++;
    console.error('INVALID JSON:', f, e.message);
  }
}
console.log('checked', files.length, 'json files, invalid:', bad);
if(bad) process.exit(2);
