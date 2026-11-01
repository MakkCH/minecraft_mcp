#!/usr/bin/env python3
"""Build a private Minecraft launcher pack from pinned, verified official releases."""
import hashlib, json, os, secrets, urllib.request, zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
MODS = [
    {'file':'jsmacros-26.3-2.2.1-fabric.jar', 'url':'https://github.com/grepsedawk/JSMacros/releases/download/v2.2.1/jsmacros-26.3-2.2.1-fabric.jar', 'algorithm':'sha256', 'hash':'a9b0bdc773701b7c7b62027d1551b7c859eea1b995f224f4eff551a58b1d8480'},
    {'file':'baritone-api-fabric-1.20.0.jar', 'url':'https://github.com/cabaletta/baritone/releases/download/v1.20.0/baritone-api-fabric-1.20.0.jar', 'algorithm':'sha256', 'hash':'49adfc063cfbfd0b6f08e9d814359807baa2d1768c0d39d6c5968268547cbca6'},
    {'file':'fabric-api-0.160.6+26.3.jar', 'url':'https://cdn.modrinth.com/data/P7dR8mSH/versions/BQfN2OGk/fabric-api-0.160.6%2B26.3.jar', 'algorithm':'sha512', 'hash':'8735b180ce44bb115fc696a2ffa61d03186cd068f680f245422a5bdf25f976f070e65272d6da5e6206d7678d5f6678a8bf888b94304c0bcf3345eb3e01676d18'},
]
cache=ROOT/'.runtime/downloads'
cache.mkdir(parents=True,exist_ok=True)
for mod in MODS:
    path=cache/mod['file']
    if not path.exists():
        print('Downloading', mod['url'])
        request=urllib.request.Request(mod['url'],headers={'User-Agent':'minecraft_mcp/0.1.0'})
        with urllib.request.urlopen(request,timeout=120) as response:
            data=response.read()
        if hashlib.new(mod['algorithm'],data).hexdigest()!=mod['hash']:
            raise RuntimeError('Release checksum mismatch: '+mod['file'])
        path.write_bytes(data)
    if hashlib.new(mod['algorithm'],path.read_bytes()).hexdigest()!=mod['hash']:
        raise RuntimeError('Cached release checksum mismatch: '+mod['file'])
    with zipfile.ZipFile(path) as jar:
        meta=json.loads(jar.read('fabric.mod.json'))
        print(f'{meta["id"]}: {meta["version"]} (verified)')
config_path=ROOT/'.runtime/config.json'
if not config_path.exists():
    config=json.loads((ROOT/'client/config.example.json').read_text())
    config['token']=secrets.token_hex(32)
    fd=os.open(config_path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as out: json.dump(config,out,indent=2)
config=json.loads(config_path.read_text())
options={'version':3,'core':{'defaultProfile':'default','profiles':{'default':[]},'services':{'minecraft_mcp':{'file':'minecraft_mcp/bootstrap.js','enabled':True}}}}
index={'formatVersion':1,'game':'minecraft','versionId':'0.1.0','name':'minecraft_mcp','summary':'JsMacros + Baritone local MCP client','files':[],'dependencies':{'minecraft':'26.3','fabric-loader':'0.19.5'}}
pack=ROOT/'dist/minecraft_mcp-26.3.mrpack'
with zipfile.ZipFile(pack,'w',zipfile.ZIP_DEFLATED) as z:
    z.writestr('modrinth.index.json',json.dumps(index,indent=2))
    z.writestr('overrides/config/jsMacros/options.json',json.dumps(options,indent=2))
    dest='overrides/config/jsMacros/Macros/minecraft_mcp/'
    for name in ['bootstrap.js','minecraft-mcp-bridge.jar']: z.write(ROOT/'dist'/name,dest+name)
    z.writestr(dest+'config.json',json.dumps(config,indent=2))
    z.writestr('overrides/options.txt','pauseOnLostFocus:false\nonboardAccessibility:false\nguiScale:3\nmaxFps:60\nrenderDistance:10\nsimulationDistance:6\n')
    for mod in MODS: z.write(cache/mod['file'],'overrides/mods/'+mod['file'])
(ROOT/'artifacts').mkdir(exist_ok=True)
(ROOT/'artifacts/mod-receipt.json').write_text(json.dumps(MODS,indent=2)+'\n')
print(pack)
