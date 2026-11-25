#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const unique = values => new Set(values).size === values.length;
const semver = value => typeof value === 'string' && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(value);
const dateOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
function safePattern(pattern,value) { try { return new RegExp(pattern).test(value); } catch { return false; } }
export function validateRegistry(registry, schema) {
  const errors=[];
  if(!isRecord(registry)) return ['registry root must be an object'];
  if(!isRecord(schema)) return ['schema root must be an object'];
  if(registry.authority!=='github-desired-state') errors.push('registry authority must be github-desired-state');
  for(const field of ['schemaVersion','registryVersion']) if(!semver(registry[field])) errors.push('invalid '+field);
  if(!dateOnly(registry.lastReviewed)) errors.push('lastReviewed must be a real YYYY-MM-DD date');
  if(!Array.isArray(registry.systems)||registry.systems.length===0) return [...errors,'systems must be a non-empty array'];
  if(!Array.isArray(schema.required)||!isRecord(schema.properties)) return [...errors,'schema requires an array and properties object'];
  const ids=[];
  for(const [index,system] of registry.systems.entries()){
    const label='systems['+index+']';
    if(!isRecord(system)){errors.push(label+' must be an object');continue;}
    if(typeof system.id!=='string'||!system.id.trim()) errors.push(label+' id must be a non-empty string'); else ids.push(system.id);
    for(const key of schema.required){if(typeof key!=='string'){errors.push('schema required entries must be strings');break;}if(!Object.hasOwn(system,key))errors.push((system.id||label)+' missing '+key);}
    for(const key of Object.keys(system))if(schema.additionalProperties===false&&!Object.hasOwn(schema.properties,key))errors.push((system.id||label)+' unknown field '+key);
    for(const [key,rule] of Object.entries(schema.properties)){
      if(!isRecord(rule)){errors.push('schema property '+key+' must be an object');continue;}
      const value=system[key];if(value===undefined)continue;const prefix=(system.id||label)+'.'+key;
      if(rule.type==='string'&&typeof value!=='string')errors.push(prefix+' must be string');
      if(rule.type==='boolean'&&typeof value!=='boolean')errors.push(prefix+' must be boolean');
      if(rule.type==='array'&&!Array.isArray(value))errors.push(prefix+' must be array');
      if(typeof value==='string'){if(rule.minLength&&value.length<rule.minLength)errors.push(prefix+' too short');if(rule.pattern&&!safePattern(rule.pattern,value))errors.push(prefix+' invalid format');}
      if(rule.enum&&(!Array.isArray(rule.enum)||!rule.enum.includes(value)))errors.push(prefix+' invalid value');
      if(Array.isArray(value)){
        if(rule.uniqueItems&&!unique(value))errors.push(prefix+' duplicates');
        for(const item of value){if(rule.items?.type==='string'&&typeof item!=='string')errors.push(prefix+' item must be string');if(typeof item==='string'){if(rule.items.minLength&&item.length<rule.items.minLength)errors.push(prefix+' item too short');if(rule.items.pattern&&!safePattern(rule.items.pattern,item))errors.push(prefix+' item invalid format');}}
      }
    }
    if(Array.isArray(system.dependencies))for(const dependency of system.dependencies)if(typeof dependency!=='string')errors.push((system.id||label)+' dependency must be string');
  }
  if(!unique(ids))errors.push('duplicate system IDs');
  const known=new Set(ids);
  for(const system of registry.systems){if(!isRecord(system)||!Array.isArray(system.dependencies))continue;for(const dependency of system.dependencies)if(typeof dependency==='string'&&!known.has(dependency))errors.push(system.id+' unknown dependency '+dependency);}
  const active=new Set(),done=new Set();
  function visit(id,chain=[]){if(active.has(id)){errors.push('dependency cycle '+[...chain,id].join(' -> '));return;}if(done.has(id))return;active.add(id);const current=registry.systems.find(system=>isRecord(system)&&system.id===id);for(const dependency of(Array.isArray(current?.dependencies)?current.dependencies:[]))if(typeof dependency==='string'&&known.has(dependency))visit(dependency,[...chain,id]);active.delete(id);done.add(id);}
  for(const id of known)visit(id);
  return errors;
}
async function main(){const registry=JSON.parse(await readFile('governance/registry/systems.json','utf8'));const schema=JSON.parse(await readFile('governance/registry/system-schema.json','utf8'));const errors=validateRegistry(registry,schema);if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Registry schema and dependency graph validation passed.');}
if(process.argv[1]?.endsWith('validate-registry-schema.mjs'))await main();
