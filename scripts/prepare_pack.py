#!/usr/bin/env python3
"""Build an optional private Modrinth pack from pinned official releases."""
import argparse, hashlib, json, secrets, tempfile, urllib.request, zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
MODS = [
    {'file':'jsmacros-26.3-2.2.1-fabric.jar', 'url':'https://github.com/grepsedawk/JSMacros/releases/download/v2.2.1/jsmacros-26.3-2.2.1-fabric.jar', 'algorithm':'sha256', 'hash':'a9b0bdc773701b7c7b62027d1551b7c859eea1b995f224f4eff551a58b1d8480'},
    {'file':'baritone-api-fabric-1.20.0.jar', 'url':'https://github.com/cabaletta/baritone/releases/download/v1.20.0/baritone-api-fabric-1.20.0.jar', 'algorithm':'sha256', 'hash':'49adfc063cfbfd0b6f08e9d814359807baa2d1768c0d39d6c5968268547cbca6'},
    {'file':'fabric-api-0.160.6+26.3.jar', 'url':'https://cdn.modrinth.com/data/P7dR8mSH/versions/BQfN2OGk/fabric-api-0.160.6%2B26.3.jar', 'algorithm':'sha512', 'hash':'8735b180ce44bb115fc696a2ffa61d03186cd068f680f245422a5bdf25f976f070e65272d6da5e6206d7678d5f6678a8bf888b94304c0bcf3345eb3e01676d18'},
]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cache-dir', type=Path, default=Path(tempfile.gettempdir())/'minecraft_mcp-downloads')
parser.add_argument('--output', type=Path, default=ROOT/'dist/minecraft_mcp-26.3.mrpack')
args=parser.parse_args()
cache=args.cache_dir
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
config=json.loads((ROOT/'client/config.example.json').read_text())
config['token']=secrets.token_hex(32)
options={'version':3,'core':{'defaultProfile':'default','profiles':{'default':[]},'services':{'minecraft_mcp':{'file':'minecraft_mcp/bootstrap.js','enabled':True}}}}
index={'formatVersion':1,'game':'minecraft','versionId':'0.1.0','name':'minecraft_mcp','summary':'JsMacros + Baritone local MCP client','files':[],'dependencies':{'minecraft':'26.3','fabric-loader':'0.19.5'}}
pack=args.output
pack.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(pack,'w',zipfile.ZIP_DEFLATED) as z:
    z.writestr('modrinth.index.json',json.dumps(index,indent=2))
    z.writestr('overrides/config/jsMacros/options.json',json.dumps(options,indent=2))
    dest='overrides/config/jsMacros/Macros/minecraft_mcp/'
    for name in ['bootstrap.js','minecraft-mcp-bridge.jar']: z.write(ROOT/'dist'/name,dest+name)
    z.writestr(dest+'config.json',json.dumps(config,indent=2))
    z.writestr('overrides/options.txt','pauseOnLostFocus:false\nonboardAccessibility:false\nguiScale:3\nmaxFps:60\nrenderDistance:10\nsimulationDistance:6\n')
    for mod in MODS: z.write(cache/mod['file'],'overrides/mods/'+mod['file'])
print(pack)
