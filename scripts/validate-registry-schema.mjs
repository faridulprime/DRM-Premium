#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
const registry=JSON.parse(await readFile('governance/registry/systems.json','utf8'));
const schema=JSON.parse(await readFile('governance/registry/system-schema.json','utf8'));
const errors=[];
const unique=a=>new Set(a).size===a.length;
if(registry.authority!=='github-desired-state')errors.push('registry authority must be github-desired-state');
if(!/^\\d+\\.\\d+\\.\\d+$/.test(registry.registryVersion||''))errors.push('invalid registryVersion');
const known=new Set((registry.systems||[]).map(s=>s.id));
for(const s of registry.systems||[]){
 for(const k of schema.required||[])if(!Object.hasOwn(s,k))errors.push(s.id+' missing '+k);
 for(const k of Object.keys(s))if(schema.additionalProperties===false&&!Object.hasOwn(schema.properties||{},k))errors.push(s.id+' unknown field '+k);
 for(const [k,r] of Object.entries(schema.properties||{})){
  const v=s[k];if(v===undefined)continue;
  if(r.type==='string'&&typeof v!=='string')errors.push(s.id+'.'+k+' must be string');
  if(r.type==='boolean'&&typeof v!=='boolean')errors.push(s.id+'.'+k+' must be boolean');
  if(r.type==='array'&&!Array.isArray(v))errors.push(s.id+'.'+k+' must be array');
  if(typeof v==='string'&&r.pattern&&!new RegExp(r.pattern).test(v))errors.push(s.id+'.'+k+' invalid format');
  if(r.enum&&!r.enum.includes(v))errors.push(s.id+'.'+k+' invalid value');
  if(Array.isArray(v)&&r.uniqueItems&&!unique(v))errors.push(s.id+'.'+k+' duplicates');
 }
 for(const d of s.dependencies||[])if(!known.has(d))errors.push(s.id+' unknown dependency '+d);
}
const active=new Set(),done=new Set();
function visit(id,chain=[]){if(active.has(id)){errors.push('dependency cycle '+[...chain,id].join(' -> '));return}if(done.has(id))return;active.add(id);for(const d of (registry.systems.find(s=>s.id===id)?.dependencies||[]))if(known.has(d))visit(d,[...chain,id]);active.delete(id);done.add(id)}
for(const id of known)visit(id);
if(errors.length){console.error(errors.join('\\n'));process.exitCode=1}else console.log('Registry schema and dependency graph validation passed.');
