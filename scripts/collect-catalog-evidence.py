"""Read-only, allowlisted help probes. Never execute reference examples or generated commands."""
import datetime, hashlib, json, pathlib, re, shutil, subprocess, tomllib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/schema-evidence'
OUT.mkdir(exist_ok=True)
sources = {
 'git': 'https://git-scm.com/docs/git',
 'cargo': 'https://doc.rust-lang.org/cargo/commands/index.html',
 'docker': 'https://docs.docker.com/reference/cli/docker/',
 'gh': 'https://cli.github.com/manual/',
 'dotnet': 'https://learn.microsoft.com/en-us/dotnet/core/tools/',
 'cloudflared': 'https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/tunnel-useful-commands/',
 'openssl': 'https://docs.openssl.org/master/man1/openssl/',
 'linux': 'https://www.gnu.org/software/coreutils/manual/coreutils.html',
 'pandoc': 'https://pandoc.org/MANUAL.html',
 'ffmpeg': 'https://ffmpeg.org/ffmpeg.html',
 'magick': 'https://imagemagick.org/script/command-line-processing.php',
 'gpg': 'https://www.gnupg.org/documentation/manuals/gnupg/',
}
probes = {}
if '--reuse' in sys.argv and (OUT/'help-probes.json').exists():
    prior=json.loads((OUT/'help-probes.json').read_text(encoding='utf-8'))
    probes=prior['probes']
    for probe in probes.values(): probe.setdefault('capturedAt',prior['capturedAt'])
def capture(name, argv):
    if name in probes: return probes[name]['stdout']+'\n'+probes[name]['stderr']
    try:
        # File-backed output avoids waiting on inherited pipes held by grandchildren.
        import tempfile
        with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
            p = subprocess.run(argv, stdout=stdout, stderr=stderr, timeout=15)
            stdout.seek(0); stderr.seek(0)
            result = dict(argv=argv, exitCode=p.returncode, stdout=stdout.read().decode(errors='replace'), stderr=stderr.read().decode(errors='replace'))
    except (OSError, subprocess.TimeoutExpired) as e:
        result = dict(argv=argv, error=str(e), stdout='', stderr='')
    result['sha256'] = hashlib.sha256((result['stdout']+'\n'+result['stderr']).encode()).hexdigest()
    result['capturedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    probes[name] = result
    print(name, result.get('exitCode', 'unavailable'), flush=True)
    return result['stdout'] + '\n' + result['stderr']

git = capture('git command list', ['git', '--list-cmds=main']).split()
allow = {'git': set(git),
 'cargo': set('add bench build check clean doc fetch fix generate-lockfile info init install locate-project login logout metadata new owner package pkgid publish read-manifest remove report run rustc rustdoc search test tree uninstall update vendor verify-project version yank'.split()),
 'docker': set('attach build buildx compose config container context cp create diff events exec export history image images import info inspect kill load login logout logs manifest network node pause plugin port ps pull push rename restart rm rmi run save search secret service stack start stats stop swarm system tag top trust unpause update version volume wait'.split()),
 'gh': set('auth browse cache codespace completion config extension gist gpg-key issue label org pr project release repo ruleset run search secret ssh-key status variable workflow'.split())}
commands = set()
for family in ['git','cargo','docker','gh','dotnet','cloudflared','openssl','gpg']:
    commands.add(family)
for p in (ROOT/'docs/schemas').rglob('*.md'):
    name = p.stem
    parent = 'cargo' if p.parent.name == 'carge' else p.parent.name
    if parent in allow and name.startswith(parent+'-'):
        # Preserve the hyphens in native command names, splitting only known command groups.
        suffix = name[len(parent)+1:]
        prefix = suffix.split('-')[0]
        if parent == 'git' and suffix in allow[parent] and suffix not in ['gui','citool','gitk']: commands.add(parent+' '+suffix)
        elif parent in ['docker','gh'] and (prefix in allow[parent] or suffix in allow[parent]):
            groups = ['buildx','compose','container','context','image','manifest','network','node','plugin','secret','service','stack','swarm','system','trust','volume'] if parent=='docker' else ['pr','repo','release','run','project','search','secret','ruleset']
            if suffix in allow[parent]: commands.add(parent+' '+suffix)
            elif prefix in groups: commands.add(parent+' '+suffix.replace('-', ' '))
        elif parent == 'cargo' and suffix in allow[parent]: commands.add(parent+' '+suffix)
commands.update('dotnet '+c for c in 'build clean format new pack publish restore run test build-server shutdown nuget tool workload sln'.split() if c!='shutdown')
commands.update(['dotnet nuget locals','dotnet tool list','dotnet workload list','cloudflared tunnel','cloudflared tunnel create','cloudflared tunnel list','cloudflared tunnel run','cloudflared tunnel delete','cloudflared tunnel info','cloudflared tunnel route dns','openssl genpkey','openssl req','openssl x509','openssl pkey','openssl dgst','openssl enc','openssl rand','gpgv','gpgtar','magick','magick identify','magick composite','ffmpeg','pandoc'])
commands.update('dotnet '+c for c in 'msbuild package reference sdk solution store vstest dev-certs fsi user-jwts user-secrets watch'.split())
commands.update('cloudflared '+c for c in ['access','access login','access token','access tcp','access ssh','service','service install','service uninstall','tail','version'])
for command in sorted(commands):
    exe, *prefix = command.split()
    help_flag = ['-h'] if exe=='git' and prefix else ['-help'] if exe in ['openssl','magick'] else ['--help']
    if exe=='openssl' and not prefix: help_flag=['help']
    capture(command, [exe, *prefix, *help_flag])
for exe in sorted(set(c.split()[0] for c in commands)):
    capture('version:'+exe, [exe, 'version'] if exe=='openssl' else [exe, '-version'] if exe in ['ffmpeg','magick'] else [exe, '--version'])
for exe in 'apt chmod cat mv tail tree rsync dnf zstd zstdmt'.split():
    capture('linux '+exe, ['wsl.exe','--exec',exe,'--help'])
    capture('version:linux '+exe, ['wsl.exe','--exec',exe,'--version'])

# Explicit root probes for the supplied portable catalog; no arbitrary commands from reference text.
for exe in 'mongoexport mongofiles mongoimport mongorestore mongodump mongostat mongotop node ollama pnpm rustup ssh scp sftp ssh-keygen ssh-add uv wget2 winget wsl yt-dlp duckdb robocopy ipconfig'.split():
    flags = ['/?'] if exe in ['ipconfig','robocopy'] else ['-?'] if exe in ['ssh','scp','sftp','ssh-keygen','ssh-add'] else ['--help']
    capture(exe, [exe, *flags])
    if exe not in ['ipconfig','robocopy','ssh','scp','sftp','ssh-keygen','ssh-add']: capture('version:'+exe,[exe,'--version'])

cmdlets={}
for file in (ROOT/'docs/schemas').glob('*.toml'):
    try: schema=tomllib.loads(file.read_text(encoding='utf-8-sig'))
    except Exception: continue
    tool=schema.get('tool',{});name=tool.get('name','')
    homepage=schema.get('metadata',{}).get('homepage','')
    if re.fullmatch(r'[A-Za-z]+-[A-Za-z]+',name) and 'learn.microsoft.com/powershell/' in homepage:
        text=capture('cmdlet '+name,['pwsh.exe','-NoProfile','-NonInteractive','-Command',f"$c=Get-Command -Name '{name}' -ErrorAction Stop; @($c.Parameters.Values | ForEach-Object {{ [pscustomobject]@{{name=$_.Name;type=$_.ParameterType.Name}} }}) | ConvertTo-Json -Compress"])
        try: cmdlets[name]=json.loads(text)
        except Exception: pass

inventory=[]; seen={}
for p in sorted((ROOT/'docs/schemas').rglob('*')):
    if not p.is_file(): continue
    data=p.read_bytes(); digest=hashlib.sha256(data).hexdigest(); relative=str(p.relative_to(ROOT)).replace('\\','/')
    record=dict(path=relative, sha256=digest, bytes=len(data), validation=[], gaps=[])
    if digest in seen: record.update(classification='duplicate', duplicateOf=seen[digest])
    elif p.suffix=='.toml':
        try:
            parsed=tomllib.loads(data.decode('utf-8-sig'))
            if 'tool' in parsed: record.update(classification='existing schema', command=parsed['tool'].get('name','')); record['validation'].append('TOML parsed')
            else: record['classification']='metadata resource'
        except Exception as e:
            record['classification']='metadata resource' if p.name.startswith('Metadata-') else 'unsupported source'
            record['validation'].append(str(e))
    elif p.suffix in ['.md','.txt']:
        family='cargo' if p.parent.name=='carge' else p.parent.name
        candidates=[c for c in commands if p.stem==c.replace(' ','-')]
        if candidates: record.update(classification='core-command reference', command=candidates[0])
        elif family in allow:
            if p.stem in ['gh-reference','gitremote-helpers']:
                record.update(classification='metadata resource',gaps=['Guide or metadata page, not an executable command.'])
            elif p.stem in ['git-gui','git-citool','gitk','gitweb']:
                record.update(classification='unsupported source',gaps=['Graphical command; excluded from command-line core catalog.'])
            elif p.stem=='dockerd': record.update(classification='core-command reference',gaps=['Daemon executable is separate from docker client; local Windows help not captured.'])
            else: record.update(classification='optional extension', gaps=['Not part of the reviewed core command allowlist; extension installation and syntax not reviewed.'])
        else: record.update(classification='core-command reference', gaps=['Standalone reference; catalog mapping recorded in coverage report.'])
    else: record['classification']='unsupported source'
    seen.setdefault(digest,relative);inventory.append(record)
payload=dict(capturedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), officialSources=sources, probes=probes,cmdletParameters=cmdlets)
(OUT/'help-probes.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
(OUT/'reference-inventory.json').write_text(json.dumps(inventory,indent=2),encoding='utf-8')
print(f'Inventoried {len(inventory)} files; recorded {len(probes)} help/version probes. Originals unchanged.')
