// Build repository files from preserved, read-only help evidence. No installation.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer } from 'vite';
const root = process.cwd();
const evidence = JSON.parse(await fs.readFile('docs/schema-evidence/help-probes.json', 'utf8'));
const inventory = JSON.parse(await fs.readFile('docs/schema-evidence/reference-inventory.json', 'utf8'));
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { parseHelpText } = await vite.ssrLoadModule('/src/lib/helpImport.ts');
  const { emptySchema, parseSchemaToml, serializeSchemaToml, validateSchema } = await vite.ssrLoadModule('/src/lib/schema.ts');
  const entries = new Map(); const coverage = [];
  const globals = {
    git: [['-C','', 'Change directory'],['-c','', 'Configuration name=value'],['--git-dir','', 'Repository directory'],['--work-tree','', 'Working tree directory']],
    docker: [['--config','', 'Client configuration directory'],['-c','--context', 'Client context'],['-H','--host', 'Daemon socket']],
    cloudflared: [['--config','', 'Configuration file']],
  };
  const parameterCorrections = {
    'git clone': [['repository',true],['directory',false]], 'git add': [['pathspec',false]],
    'git commit': [], 'git status': [['pathspec',false]], 'git diff': [['pathspec',false]],
    'git log': [['revision',false]], 'git checkout': [['branch',false]], 'git switch': [['branch',true]],
    'git remote': [], 'git stash': [], 'git worktree': [], 'git config': [['name',false],['value',false]],
    'dotnet build': [['project',false]], 'dotnet clean': [['project',false]], 'dotnet publish': [['project',false]],
    'dotnet pack': [['project',false]], 'dotnet restore': [['project',false]], 'dotnet test': [['project',false]],
    'dotnet run': [], 'dotnet new': [['template',false]], 'dotnet format': [['project',false]],
    'dotnet msbuild': [['project',false]], 'dotnet vstest': [['test-assembly',true]], 'dotnet fsi': [['script',false]],
    'dotnet nuget': [], 'dotnet tool': [], 'dotnet workload': [], 'dotnet sln': [['solution',false]],
    'cloudflared tunnel': [], 'cloudflared tunnel create': [['name',true]], 'cloudflared tunnel run': [['tunnel',false]],
    'cloudflared tunnel delete': [['tunnel',true]], 'cloudflared tunnel info': [['tunnel',true]],
    'cloudflared tunnel list': [], 'cloudflared tunnel route dns': [['tunnel',true],['hostname',true]],
    'openssl genpkey': [], 'openssl req': [], 'openssl x509': [], 'openssl pkey': [], 'openssl dgst': [['file',false]],
    'openssl enc': [], 'openssl rand': [['bytes',true]],
    'pandoc': [['input-file',false]], 'ffmpeg': [], 'magick': [['input-file',false],['output-file',false]],
    'magick identify': [['image',true]], 'magick composite': [['overlay',true],['background',true],['output',true]],
    'apt': [], 'chmod': [['mode',true],['file',true]], 'cat': [['file',false]],
    'mv': [['source',true],['destination',true]], 'tail': [['file',false]], 'tree': [['directory',false]],
    'rsync': [['source',true],['destination',true]], 'dnf': [], 'zstd': [['file',false]], 'zstdmt': [['file',false]],
  };
  const clean = (schema) => {
    schema.executablePath = ''; schema.sourcePath = '';
    schema.arguments=schema.arguments.map((arg)=>arg.flag.includes(':') ? {...arg,flag:arg.flag.split(':')[0]+':',type:'string',valueStyle:'attached'} : arg);
    const seen = new Set();
    schema.arguments = schema.arguments.filter((arg) => {
      const key = arg.long || arg.flag;
      if (!/^(?:--?|\/)[A-Za-z0-9?][A-Za-z0-9_.:-]*$/.test(key) || seen.has(key)) return false;
      seen.add(key); return true;
    }).map((arg) => ({ ...arg, description: arg.description.slice(0, 800) }));
    const params = new Set();
    schema.parameters = schema.parameters.filter((p) => /^[A-Za-z][A-Za-z0-9_.-]*$/.test(p.name) && !/^(args?|flags?|options?|commands?|subcommands?|sdk-options|command-options)$/i.test(p.name) && !/\.exe$/i.test(p.name) && !params.has(p.name) && params.add(p.name));
    schema.actions = []; // root help must not donate unrelated options to every operation
    return schema;
  };
  for (const [key, probe] of Object.entries(evidence.probes)) {
    if (key.startsWith('version:') || key.startsWith('cmdlet ') || key==='git command list') continue;
    const name = key.replace(/^linux /, '');
    const output = (probe.stdout+'\n'+probe.stderr).replace(/\x1b\][^\x07]*?(?:\x07|\x1b\\)/g,'').replace(/\x1b\[[0-9;]*m/g,'');
    if (probe.error || !output.trim() || !/usage\b|syntax:|options\b|flags:|commands\b/im.test(output) || (/unknown command|not a git command|is not a docker command|could not execute|command not found|no such file|no decode delegate/i.test(output) && !/^Usage:/im.test(output))) {
      coverage.push({command:name, status:'gap', reason:probe.error || output.slice(0,300)}); continue;
    }
    const parsed = parseHelpText(name, output);
    const schema = clean(parsed.schema);
    const [exe, ...prefix] = name.split(' ');
    schema.installedName=exe; schema.family = prefix.length || ['git','cargo','docker','gh','dotnet','cloudflared','openssl','magick','gpg'].includes(exe) ? exe : undefined;
    schema.commandPrefix=prefix;
    if (!prefix.length) schema.parameters=[];
    if (parameterCorrections[name]) schema.parameters=parameterCorrections[name].map(([name,required]) => ({name,required,type:'string'}));
    const added = prefix.length ? (globals[exe] || []).map(([flag,long,description]) => ({flag,long,description,type:'string',valueStyle:'space',position:'before-prefix'})) : [];
    schema.arguments = [...added, ...schema.arguments.filter((arg)=> !added.some((global)=>(global.long||global.flag)===(arg.long||arg.flag)))];
    if (!prefix.length && ['git','docker','cloudflared'].includes(exe)) schema.arguments=schema.arguments.map((arg)=>({...arg,position:'before-prefix'}));
    schema.tags = [{name:key.startsWith('linux ') ? 'linux' : 'general',color:'#21C6B8'}];
    const supplied=inventory.find((item)=>item.classification==='existing schema' && item.command===name);
    const suppliedSchema=supplied ? parseSchemaToml(await fs.readFile(supplied.path,'utf8')) : null;
    const source = evidence.officialSources[exe] || suppliedSchema?.metadata.homepage || evidence.officialSources.linux;
    const version = evidence.probes['version:'+(key.startsWith('linux ') ? 'linux ' : '')+exe];
    schema.metadata = {...schema.metadata, source:`Help evidence: ${key}; ${source}`, homepage:source, sha256:probe.sha256, lastValidated:evidence.capturedAt.slice(0,10), executableVersion:(version?.stdout || version?.stderr || '').split('\n')[0].trim().slice(0,180)};
    schema.description = (schema.description && !schema.description.trim().startsWith('-') ? schema.description : `${name} command`).slice(0,300);
    schema.notes = 'Reviewed portable command identity and help-derived option rows. Repeatable arguments, alternate usage forms, conflicts, and shell operators require manual command review. Evidence and coverage: docs/schema-evidence. Copy/export only.';
    entries.set(name, schema);
    coverage.push({command:name,status:'authored',evidence:key,helpSha256:probe.sha256,source, warnings:parsed.warnings, gaps:['Help-based catalog cannot encode every alternative usage, repeated flag, or mutual exclusion.']});
  }
  for (const item of inventory.filter((item)=>item.classification==='existing schema')) {
    try {
      const schema = clean(parseSchemaToml(await fs.readFile(item.path,'utf8')));
      if (entries.has(schema.name)) { item.catalogName=schema.name; continue; }
      schema.installedName=schema.installedName || schema.name;
      const cmdletFields=evidence.cmdletParameters?.[schema.name];
      if(cmdletFields) schema.arguments=cmdletFields.map((field)=>({flag:'-'+field.name,long:'',description:schema.arguments.find(arg=>arg.flag==='-'+field.name)?.description || 'PowerShell parameter',type:field.type==='SwitchParameter'?'boolean':'string',valueStyle:'space'}));
      schema.arguments=schema.arguments.map((arg)=>arg.flag.includes(':') && arg.flag.startsWith('/') ? {...arg,flag:arg.flag.split(':')[0]+':',valueStyle:'attached'} : arg);
      // Replace the obsolete standalone Compose executable with its documented Docker plugin identity.
      if (schema.name==='docker-compose') { item.catalogName='docker compose'; continue; }
      schema.metadata = {...schema.metadata,sha256:item.sha256,source:`Supplied schema: ${item.path}`,executableVersion:'',lastValidated:evidence.capturedAt.slice(0,10)};
      schema.notes=cmdletFields ? 'PowerShell parameters checked with read-only Get-Command metadata. Parameter sets, mandatory option inputs and pipeline expressions require command review. Copy/export only.' : 'Portable normalization of supplied schema; executable paths removed. Option grammar retains supplied definitions; local help verification remains a coverage gap. Copy/export only.';
      entries.set(schema.name,schema);item.catalogName=schema.name;
      coverage.push({command:schema.name,status:'authored',evidence:item.path,sourceSha256:item.sha256,gaps:cmdletFields ? ['Parameter sets and mandatory option inputs are not encoded.'] : ['Supplied option definitions have not all been compared against installed help.']});
    } catch (error) {item.validation.push(String(error));item.gaps.push('Schema conversion failed.');}
  }
  // Useful reviewed standalone operations when WSL is unavailable. These flags come from the supplied manuals.
  const fallbackFlags = {chmod:[['-R','--recursive','boolean']],cat:[['-n','--number','boolean'],['-b','--number-nonblank','boolean']],mv:[['-i','--interactive','boolean'],['-f','--force','boolean'],['-n','--no-clobber','boolean']],tail:[['-n','--lines','string'],['-f','--follow','boolean']],tree:[['-a','','boolean'],['-L','','string'],['--du','','boolean']],apt:[['-y','--yes','boolean']],dnf:[['-y','--assumeyes','boolean']],zstd:[['-d','--decompress','boolean'],['-o','','string']],zstdmt:[['-d','--decompress','boolean'],['-o','','string']],rsync:[['-a','--archive','boolean'],['--delete','','boolean'],['--progress','','boolean']]};
  for (const [name,flags] of Object.entries(fallbackFlags)) {
    if (entries.has(name)) continue;
    const schema={...emptySchema(),name,installedName:name,description:`${name} Linux command`,parameters:(parameterCorrections[name]||[]).map(([name,required])=>({name,required,type:'string'})),arguments:flags.map(([flag,long,type])=>({flag,long,type,description:'See supplied manual for semantics',valueStyle:'space'})),tags:[{name:'linux',color:'#21C6B8'}]};
    schema.notes='Supplied-manual core subset. Installed WSL help unavailable; advanced alternatives and flags are excluded. Copy/export only.';
    schema.metadata.source='Supplied Linux references; '+evidence.officialSources.linux;schema.metadata.lastValidated=evidence.capturedAt.slice(0,10);
    entries.set(name,schema); coverage.push({command:name,status:'authored',gaps:['WSL help unavailable; conservative supplied-manual flag subset.']});
  }
  const gitGroups = {
    bisect:{start:[],bad:[['revision',false]],good:[['revision',false]],skip:[['revision',true]],reset:[['revision',false]],run:[['shell-command',true]],log:[]},
    bundle:{create:[['file',true],['revisions',true]],verify:[['file',true]],'list-heads':[['file',true]],unbundle:[['file',true]]},
    notes:{list:[['object',false]],add:[['object',false]],append:[['object',false]],edit:[['object',false]],show:[['object',false]],remove:[['object',true]],prune:[]},
    reflog:{show:[['ref',false]],list:[],exists:[['ref',true]],delete:[['ref-selector',true]],expire:[['ref',false]]},
    'sparse-checkout':{init:[],list:[],set:[['patterns',true]],add:[['patterns',true]],reapply:[],disable:[]},
    submodule:{add:[['repository',true],['path',false]],status:[['path',false]],init:[['path',false]],deinit:[['path',true]],update:[['path',false]],sync:[['path',false]],foreach:[['shell-command',true]]},
    subtree:{add:[['repository',true],['ref',true]],pull:[['repository',true],['ref',true]],push:[['repository',true],['ref',true]],split:[],merge:[['commit',true]]},
  };
  for (const [group, actions] of Object.entries(gitGroups)) {
    const parent=entries.get('git '+group);if(!parent)continue;
    parent.parameters=[]; const rawOptions=parent.arguments;
    parent.arguments=rawOptions.filter((arg)=>arg.position==='before-prefix');
    for(const [action, parameters] of Object.entries(actions)) {
      const name=parent.name+' '+action;
      const args=parent.arguments.map((arg)=>({...arg}));
      if(group==='notes' && ['add','append'].includes(action)) args.push({flag:'-m',long:'--message',description:'Note text',type:'string',valueStyle:'space'});
      if(group==='submodule' && action==='update') for(const flag of ['--init','--recursive','--remote']) args.push({flag,long:'',description:'See git submodule documentation',type:'boolean',valueStyle:'space'});
      if(group==='sparse-checkout' && ['init','set'].includes(action)) args.push({flag:'--cone',long:'',description:'Use cone mode patterns',type:'boolean',valueStyle:'space'});
      if(group==='subtree') args.push({flag:'--prefix',long:'',description:'Subdirectory prefix (required for add/pull/push/merge)',type:'string',valueStyle:'equals'});
      const child={...structuredClone(parent),name,commandPrefix:[group,action],arguments:args,actions:[],parameters:parameters.map(([name,required])=>({name,type:'string',required}))};
      entries.set(name,child);coverage.push({command:name,status:'authored',evidence:'git '+group,source:evidence.officialSources.git,gaps:['Conservative operation-specific fields; advanced usage alternatives excluded.']});
    }
  }
  const gitRoot=entries.get('git');
  if(gitRoot) gitRoot.arguments=[...(globals.git||[]).map(([flag,long,description])=>({flag,long,description,type:'string',valueStyle:'space',position:'before-prefix'})),...['--version','--help'].map(flag=>({flag,long:'',description:'Root information',type:'boolean',valueStyle:'space',position:'before-prefix'}))];
  const daemon={...emptySchema(),name:'dockerd',installedName:'dockerd',family:'Docker daemon',description:'Docker daemon (separate from the docker client)',arguments:[{flag:'-H',long:'--host',description:'Daemon listening socket',type:'string',valueStyle:'space'},{flag:'--data-root',long:'',description:'Daemon data directory',type:'string',valueStyle:'space'},{flag:'-D',long:'--debug',description:'Enable debug logging',type:'boolean',valueStyle:'space'}],tags:[{name:'linux',color:'#21C6B8'}]};
  daemon.metadata.source='Supplied dockerd reference; https://docs.docker.com/reference/cli/dockerd/';daemon.metadata.lastValidated=evidence.capturedAt.slice(0,10);daemon.notes='Conservative documented daemon subset; daemon executable not probed. Copy/export only.';
  entries.set('dockerd',daemon);coverage.push({command:'dockerd',status:'authored',evidence:'docs/schemas/docker/dockerd.md',gaps:['Daemon availability and full option grammar unverified.']});
  for (const item of inventory) {
    if (item.command && entries.has(item.command)) item.catalogName=item.command;
    if (item.classification==='core-command reference' && !item.catalogName) {
      const text=await fs.readFile(item.path,'utf8');
      const standalone=['dockerd','pandoc','ffmpeg','rsync','yt-dlp','tail','zstdmt','zstd','apt','mv','tree','dnf','openssl','gpgv','gpgtar','gpg'];
      const name=standalone.find((name)=>new RegExp(`\\b${name}\\b`,'i').test(path.basename(item.path)));
      if (name && entries.has(name)) item.catalogName=name;
      else if (/composite|identify|convert|imagemagick/i.test(path.basename(item.path))) item.catalogName=/composite/i.test(item.path)?'magick composite':/identify/i.test(item.path)?'magick identify':'magick';
      else item.gaps.push('No reviewed core mapping; retained for follow-up rather than invented executable.');
    }
  }
  // Hydrate parent group actions from the independently verified operation schemas.
  for (const schema of entries.values()) {
    // Keep root-only operation switches out of unrelated actions. Those operations
    // remain separate rail entries; only genuinely shared root options inherit.
    if (schema.arguments.some((arg)=>arg.position!=='before-prefix') && ['dotnet','cloudflared tunnel'].includes(schema.name)) continue;
    for (const child of entries.values()) {
      if (child.name.startsWith(schema.name+' ') && child.commandPrefix?.length===(schema.commandPrefix?.length||0)+1) {
        schema.actions.push({name:child.commandPrefix.at(-1),description:child.description,arguments:child.arguments.filter((arg)=>arg.position!=='before-prefix' && !schema.arguments.some((global)=>(global.long||global.flag)===(arg.long||arg.flag))),parameters:child.parameters});
      }
    }
  }
  for (const schema of entries.values()) {
    const issues=validateSchema(schema);if(issues.length)throw new Error(`${schema.name}: ${issues.join('; ')}`);
    const filename=schema.name.toLowerCase().replace(/[^a-z0-9_.-]+/g,'-')+'.toml';
    const text=serializeSchemaToml(schema);const restored=parseSchemaToml(text);
    if(validateSchema(restored).length)throw new Error(filename);
    await fs.writeFile(path.join('schemas',filename),text);
    const row=coverage.find((row)=>row.command===schema.name && row.status==='authored');
    if(row){row.file=`schemas/${filename}`;row.schemaSha256=crypto.createHash('sha256').update(text).digest('hex');row.optionCount=schema.arguments.length;row.parameterCount=schema.parameters.length;}
  }
  await fs.writeFile('docs/schema-evidence/catalog-coverage.json',JSON.stringify(coverage,null,2));
  for(const item of inventory) {
    if(item.path.endsWith('.md') || item.path.endsWith('.txt')) item.validation.push('Read as documentation; no example commands executed.');
    if(item.catalogName && entries.has(item.catalogName)) {
      item.validation.push('Catalog schema validated and TOML round-trip passed.');
      item.catalogFile='schemas/'+item.catalogName.toLowerCase().replace(/[^a-z0-9_.-]+/g,'-')+'.toml';
      item.gaps=item.gaps.filter((gap)=>!gap.startsWith('No reviewed core mapping'));
    }
    item.validation=[...new Set(item.validation)];item.gaps=[...new Set(item.gaps)];
  }
  await fs.writeFile('docs/schema-evidence/reference-inventory.json',JSON.stringify(inventory,null,2));
  await fs.writeFile('docs/schema-evidence/optional-extensions.json',JSON.stringify(inventory.filter((item)=>item.classification==='optional extension'),null,2));
  console.log(`Wrote ${entries.size} portable schemas. No installation performed.`);
} finally {await vite.close();}
