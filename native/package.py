"""Package the ARM runtime; invoke on Linux with the Valve SDK rootfs path."""
import argparse, hashlib, pathlib, shutil, tarfile, subprocess
p=argparse.ArgumentParser()
p.add_argument('rootfs',type=pathlib.Path)
p.add_argument('output',type=pathlib.Path)
a=p.parse_args()
root=pathlib.Path(__file__).resolve().parent.parent
stage=root/'native/build/package/deceptive-dice'
stage.mkdir(parents=True,exist_ok=True)
for name in ('Artwork','BGM','SFX','Data','engine'):
    shutil.copytree(root/name,stage/name,dirs_exist_ok=True)
# Convert from source assets, retaining the original browser game's MP3 files.
# Cache conversions separately so repeated packaging does not re-encode audio.
cache=root/'native/build/audio-ogg'
for folder in ('BGM','SFX'):
    for source in (root/folder).rglob('*.mp3'):
        relative=source.relative_to(root).with_suffix('.ogg')
        converted=cache/relative
        converted.parent.mkdir(parents=True,exist_ok=True)
        if not converted.exists() or converted.stat().st_mtime < source.stat().st_mtime:
            temporary=converted.with_suffix('.tmp.ogg')
            subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(source),'-vn','-c:a','libvorbis','-q:a','4',str(temporary)],check=True)
            temporary.replace(converted)
        shutil.copy2(converted,stage/relative)
        (stage/source.relative_to(root)).unlink(missing_ok=True)
(stage/'native').mkdir(exist_ok=True)
for name in ('platform.js','core-bridge.js','sprite-bridge.js','scripts.txt','smoke-test.js','font.ttf','FONT-LICENSE.txt'):
    shutil.copy2(root/'native'/name,stage/'native'/name)
shutil.copy2(root/'native/build/deceptive-dice',stage/'deceptive-dice')
shutil.copy2(root/'native/launch.sh',stage/'launch.sh')
shutil.copy2(root/'native/README.md',stage/'README.md')
(stage/'deceptive-dice').chmod(0o755)
(stage/'launch.sh').chmod(0o755)
lib=stage/'lib';lib.mkdir(exist_ok=True)
libraries=['libSDL2-2.0.so.0','libSDL2_image-2.0.so.0','libSDL2_ttf-2.0.so.0','libSDL2_mixer-2.0.so.0','libjpeg.so.9','libpng16.so.16','libvorbisfile.so.3','libvorbis.so.0','libogg.so.0']
for name in libraries:
    source=a.rootfs/'usr/lib'/name
    if name=='libSDL2-2.0.so.0':source=a.rootfs/'usr/lib/libSDL2-2.0.so.0.3100.0'
    # SDK links use absolute paths; resolve relative to the SDK, not the host.
    while source.is_symlink():
        target=source.readlink()
        source=a.rootfs/str(target).lstrip('/') if target.is_absolute() else source.parent/target
    shutil.copyfile(source,lib/name)
licenses=stage/'LICENSES';licenses.mkdir(exist_ok=True)
for source,name in [(root/'native/vendor/LICENSE','QuickJS.txt'),(root/'native/deps/pixman-0.42.2/COPYING','Pixman.txt'),(root/'native/deps/cairo-1.16.0/COPYING','Cairo.txt'),(root/'native/deps/cairo-1.16.0/COPYING-MPL-1.1','Cairo-MPL-1.1.txt')]:shutil.copyfile(source,licenses/name)
sdk_licenses=root/'native/build/sdk-licenses'
if sdk_licenses.exists():shutil.copytree(sdk_licenses,licenses/'Valve-SDK',dirs_exist_ok=True)
a.output.mkdir(parents=True,exist_ok=True)
target=a.output/'Deceptive-Dice-SteamLink-armv7.tgz'
with tarfile.open(target,'w:gz') as archive:archive.add(stage,arcname='deceptive-dice')
digest=hashlib.sha256(target.read_bytes()).hexdigest()
target.with_suffix(target.suffix+'.sha256').write_text(f'{digest}  {target.name}\n')
print(digest,target)
