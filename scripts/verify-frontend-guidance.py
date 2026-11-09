#!/usr/bin/env python3
"""Verify installed frontend guidance and offline helpers; does not reload any session."""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.parse import unquote, urlsplit


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--home', type=Path, default=Path.home(),
                        help='Home containing the actual .codex and .claude skill installation')
    parser.add_argument('--json', action='store_true', help='Print machine-readable findings')
    parser.add_argument('--build-studies', action='store_true', help='Typecheck and build all six seeded studies in temporary directories')
    parser.add_argument('--dependency-root', type=Path, help='Existing compatible node_modules to read; never installed or modified')
    parser.add_argument('--source-project', type=Path, help='Optionally compare the original-study bundle with this current ui source project')
    args = parser.parse_args()
    home = args.home.expanduser().resolve()
    repo = Path(__file__).resolve().parents[1]
    findings: list[dict[str, str | bool]] = []
    provenance: dict = {'observedAtUTC': datetime.datetime.now(datetime.timezone.utc).isoformat()}

    def check(name: str, work) -> None:
        try:
            detail = work()
            findings.append({'check': name, 'passed': True, 'detail': str(detail or 'Verified')})
        except Exception as exc:
            findings.append({'check': name, 'passed': False, 'detail': str(exc)})

    def require(condition: bool, message: str) -> None:
        if not condition:
            raise AssertionError(message)

    try:
        import yaml
    except ImportError:
        print('PyYAML is required to parse real YAML frontmatter. Install it in the interpreter used for this check.', file=sys.stderr)
        return 2

    canonical = home / '.codex/skills'
    claude = home / '.claude/skills'
    authored = canonical / 'authored-frontends'
    names = ('authored-frontends', 'form-design', 'form-explore', 'form-unslop')

    def frontmatter(path: Path) -> dict:
        text = path.read_text()
        match = re.match(r'^---\n(.*?)\n---(?:\n|$)', text, re.S)
        require(bool(match), f'Missing YAML frontmatter: {path}')
        data = yaml.safe_load(match.group(1))
        require(isinstance(data, dict), f'Frontmatter is not a mapping: {path}')
        for key in ('name', 'description'):
            require(isinstance(data.get(key), str) and bool(data[key].strip()), f'Missing {key}: {path}')
        require(bool(re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', data['name'])), f'Invalid skill name: {path}')
        return data

    for name in names:
        def installation(name=name):
            target, link = canonical / name, claude / name
            require((target / 'SKILL.md').is_file(), f'Missing canonical entrypoint: {target}')
            require(link.is_symlink(), f'Claude discovery path is not a symlink: {link}')
            require(link.resolve(strict=True) == target.resolve(strict=True), f'Wrong discovery target: {link}')
            data = frontmatter(target / 'SKILL.md')
            require(data['name'] == name, f'Discovery name mismatch: {target}')
            require((link / 'SKILL.md').read_bytes() == (target / 'SKILL.md').read_bytes(), f'Discovery entry differs: {link}')
            return f'{link} → {target}'
        check(f'{name} discovery and frontmatter', installation)

    check('Claude Impeccable frontmatter', lambda: frontmatter(claude / 'impeccable/SKILL.md')['name'])

    def linked_resources():
        files = [canonical / name / 'SKILL.md' for name in names]
        files += list((authored / 'references').glob('*.md'))
        files += [claude / 'impeccable/SKILL.md']
        checked = 0
        missing = []
        for source in files:
            text = source.read_text()
            for match in re.finditer(r'(?<!!)\[[^\]]+\]\(([^\n)]+)\)', text):
                target = match.group(1).strip()
                if target.startswith('<'):
                    target = target.split('>', 1)[0][1:]
                else:
                    target = target.split(' "', 1)[0]
                parsed = urlsplit(target)
                if parsed.scheme or target.startswith('#'):
                    continue
                relative = unquote(parsed.path)
                if not relative:
                    continue
                checked += 1
                if not (source.parent / relative).exists():
                    missing.append(f'{source}: {relative}')
        require(not missing, 'Broken local Markdown references:\n' + '\n'.join(missing))
        guide = authored / 'references/aiden-field-guide.md'
        require(guide.is_file() and guide.stat().st_size > 1000, 'Missing self-contained field guide')
        return f'{checked} local references resolve, including the installed Aiden field guide'
    check('Entrypoint and authored-reference links', linked_resources)

    def preserved_commands_and_backups():
        candidates = sorted((repo / 'output/frontend-guidance-backup').glob('*/manifest.json'))
        require(bool(candidates), 'No original-file backup manifest')
        original_impeccable = None
        count = 0
        for candidate in candidates:
            manifest = json.loads(candidate.read_text())
            for entry in manifest['files']:
                backup = repo / entry['backup']
                require(backup.is_file(), f'Missing backup: {backup}')
                require(hashlib.sha256(backup.read_bytes()).hexdigest() == entry['sha256'], f'Changed backup: {backup}')
                count += 1
                if entry['original'].endswith('/.claude/skills/impeccable/SKILL.md'):
                    original_impeccable = backup.read_text()
        require(original_impeccable is not None, 'Impeccable original missing from backup')
        installed = (claude / 'impeccable/SKILL.md').read_text()
        commands = lambda text: [line for line in text.splitlines() if line.startswith('| `')]
        original_commands = commands(original_impeccable)
        require(len(original_commands) >= 20, 'Original command table unexpectedly incomplete')
        require(commands(installed) == original_commands, 'An existing Impeccable command row changed')
        require(frontmatter(claude / 'impeccable/SKILL.md') == yaml.safe_load(re.match(r'^---\n(.*?)\n---', original_impeccable, re.S).group(1)), 'Impeccable frontmatter changed')
        return f'{count} backed-up originals have matching hashes; {len(original_commands)} Impeccable commands preserved'
    check('Original backups and preserved Impeccable commands', preserved_commands_and_backups)

    def original_bundle_integrity():
        bundle = authored / 'assets/examples'
        manifest_path = authored / 'references/example-manifest.json'
        inventory = json.loads(manifest_path.read_text())
        require(isinstance(inventory, dict) and inventory, 'Missing example hash inventory')
        source_record = None
        if inventory.get('schemaVersion') == 2:
            manifest = inventory.get('files')
            source_record = inventory.get('source', {})
            datetime.datetime.fromisoformat(source_record['capturedAtUTC'])
            require(source_record.get('standaloneExceptions') == ['src/base.css'], 'Unexpected source snapshot exceptions')
            inventory_format = 'schemaVersion 2 with source metadata'
        else:
            # The upstream original-study packager deliberately emits a flat
            # path→SHA-256 inventory. Verify it fully; never rewrite its schema.
            manifest = inventory
            inventory_format = 'upstream flat path-to-SHA256 inventory'
        require(isinstance(manifest, dict) and manifest, 'Missing example hash inventory')
        for relative, digest in manifest.items():
            require(isinstance(relative, str) and not Path(relative).is_absolute() and '..' not in Path(relative).parts,
                    f'Unsafe inventory path: {relative}')
            require(isinstance(digest, str) and bool(re.fullmatch(r'[0-9a-f]{64}', digest)), f'Invalid SHA-256: {relative}')
        source_files = {relative:digest for relative,digest in manifest.items() if relative!='src/base.css'}
        source_hash = hashlib.sha256(json.dumps(source_files,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        if source_record is not None:
            require(source_record.get('sourceInventorySha256') == source_hash, 'Pinned source inventory hash does not match the bundle')
        actual = {str(path.relative_to(bundle)): hashlib.sha256(path.read_bytes()).hexdigest()
                  for path in bundle.rglob('*') if path.is_file()}
        require(actual == manifest, 'Example manifest differs from actual file inventory/hashes')
        prohibited = {'.references', '.formroom', 'node_modules', 'server', 'private'}
        for relative in actual:
            require(not (set(Path(relative).parts) & prohibited), f'Out-of-scope path in study bundle: {relative}')
        mechanism_paths = (
            'src/concepts/Corsair.tsx', 'src/concepts/Elsewhere.tsx', 'src/concepts/Objects.tsx',
            'src/concepts/Relay.tsx', 'src/concepts/Resonance.tsx', 'src/concepts/Matter.tsx',
            'src/concepts/harbor/HarborScene.tsx', 'src/concepts/harbor/CrewPortrait.tsx',
            'src/concepts/harbor/voyage.ts', 'src/concepts/harbor/world.ts', 'src/concepts/harbor/models.ts',
            'src/concepts/harbor/pixel.ts', 'src/concepts/editorial/PhotoStack.tsx',
            'src/concepts/editorial/ExpeditionMap.tsx', 'src/concepts/editorial/stories.ts',
            'src/concepts/objects/LampAtelier.tsx', 'src/concepts/objects/lamp-model.ts',
            'src/concepts/relay/ProofGarden.tsx', 'src/concepts/relay/useContinuity.ts',
            'src/concepts/resonance/VoiceObject.tsx', 'src/concepts/resonance/RoomTrace.tsx',
            'src/concepts/resonance/scoreAudio.ts', 'src/concepts/resonance/audio.ts', 'src/concepts/matter/engine.ts')
        for relative in mechanism_paths:
            require(relative in actual, f'Documented current mechanism missing from bundle: {relative}')
        if args.source_project:
            source = args.source_project.expanduser().resolve()
            for relative, digest in actual.items():
                if relative == 'src/base.css':
                    continue
                original = source / relative
                require(original.is_file(), f'Bundle file has no source in supplied project: {relative}')
                require(hashlib.sha256(original.read_bytes()).hexdigest() == digest,
                        f'Bundle differs from current supplied source: {relative}')
        provenance['bundle'] = {'inventoryFormat':inventory_format, 'fileCount':len(actual),
            'manifestSha256':hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
            'manifestModifiedAtUTC':datetime.datetime.fromtimestamp(manifest_path.stat().st_mtime,datetime.timezone.utc).isoformat(),
            'sourceInventorySha256':source_hash, 'sourceMetadata':source_record,
            'files':actual, 'documentedModulePathsVerified':len(mechanism_paths)}
        return f'{len(actual)} actual file hashes and {len(mechanism_paths)} documented module paths verify against {inventory_format}; source inventory SHA-256 {source_hash}' + ('; matches the supplied ui project' if args.source_project else '')
    check('Original study bundle inventory and current mechanisms', original_bundle_integrity)

    def instruction_preservation():
        skill_path = authored / 'SKILL.md'
        override_path = claude / 'impeccable/SKILL.md'
        skill_text, override_text = skill_path.read_text(), override_path.read_text()
        for intent in ('unapproved mechanism candidates', 'Prefer the installed FORM methods',
                       'source', 'Preserve identity through change', 'Do not require onboarding',
                       'not this user’s aesthetic authority'):
            # The typographic apostrophe is interchangeable with the original ASCII spelling.
            require(intent.replace('’', "'") in skill_text.replace('’', "'"), f'Expected authored-frontends guidance missing: {intent}')
        marker = "## This user's frontend preference"
        require(marker in override_text, 'Claude Impeccable preference override is absent')
        block = override_text.split(marker,1)[1].split('This skill gives you',1)[0]
        for intent in ('FORM Design', 'source to visible consequence', 'selected object/draft identity',
                       'not an aesthetic authority', 'Do not make init/teach'):
            require(intent in block, f'Expected Claude preference override missing: {intent}')
        provenance['instructions'] = {'authoredFrontendsSha256':hashlib.sha256(skill_path.read_bytes()).hexdigest(),
            'claudeImpeccableSha256':hashlib.sha256(override_path.read_bytes()).hexdigest(),
            'claudePreferenceBlockSha256':hashlib.sha256((marker+block).encode()).hexdigest(),
            'scope':'Required preference content remains present; hashes record exact current instruction identity, not design quality.'}
        return 'FORM, source/consequence, identity and no-onboarding guidance present; Claude preference block retained; exact instruction hashes recorded'
    check('Installed frontend preference and instruction identity', instruction_preservation)

    def run_script(script: Path, arguments: list[str], *, environment=None):
        require(script.is_file(), f'Missing helper: {script}')
        result = subprocess.run([sys.executable, str(script), *arguments], cwd=authored,
                                env=environment, capture_output=True, text=True, timeout=35)
        require(result.returncode == 0, f'{script.name} failed ({result.returncode}): {result.stderr.strip()}')
        return result.stdout

    def reference_fallback():
        with tempfile.TemporaryDirectory(prefix='frontend-reference-fallback-') as folder:
            environment = {**os.environ, 'FORMROOM_ROOT': str(Path(folder) / 'absent-corpus')}
            output = run_script(authored / 'scripts/find_reference.py', ['source to consequence'], environment=environment)
        require('Optional local FORM corpus unavailable' in output, 'Absent corpus did not use the documented fallback')
        urls = re.findall(r'https://\S+', output)
        require(any('github.com/aiden-guan/Nomen' in url for url in urls), 'Fallback lacks a primary Nomen link')
        require(any('github.com/aiden-guan/form-design' in url for url in urls), 'Fallback lacks a primary FORM link')
        return f'Forced absent-corpus path exits successfully with {len(urls)} primary reference links; no network used'
    check('Offline reference-search fallback', reference_fallback)

    def original_seed_behavior():
        script = authored / 'scripts/seed.py'
        kits = run_script(script, ['--list']).splitlines()
        require(set(kits) == {'harbor', 'atlas', 'atelier', 'loom', 'synth', 'material'}, 'Original study list is incomplete')
        with tempfile.TemporaryDirectory(prefix='frontend-study-smoke-') as folder:
            destination = Path(folder) / 'loom'
            run_script(script, ['loom', str(destination)])
            package = json.loads((destination / 'package.json').read_text())
            require(package.get('name') == 'authored-loom-study', 'Seeded package is wrong')
            for relative in ('src/main.tsx', 'src/concepts/Relay.tsx', 'src/concepts/relay/ProofGarden.tsx', 'src/concepts/relay/useContinuity.ts', 'index.html', 'ASSETS.md'):
                require((destination / relative).is_file(), f'Seeded closure missing {relative}')
            before = {path.relative_to(destination): hashlib.sha256(path.read_bytes()).hexdigest()
                      for path in destination.rglob('*') if path.is_file()}
            rejected = subprocess.run([sys.executable, str(script), 'material', str(destination)],
                                      cwd=authored, capture_output=True, text=True, timeout=10)
            require(rejected.returncode != 0, 'Seed accepted a nonempty destination')
            after = {path.relative_to(destination): hashlib.sha256(path.read_bytes()).hexdigest()
                     for path in destination.rglob('*') if path.is_file()}
            require(before == after, 'Rejected seed changed an existing study')
        return f'{len(kits)} original starters remain available; loom copy works and refuses overwriting existing work'
    check('Original study helper and overwrite guard', original_seed_behavior)

    if args.build_studies:
        def build_all_studies():
            dependency_root = (args.dependency_root or home / 'Downloads/Coding/Randomprojects/ui/node_modules').expanduser().resolve()
            required_versions = {'react':'19.2.0', 'react-dom':'19.2.0', 'lucide-react':'0.468.0',
                                 'three':'0.187.0', '@types/react':'19.2.2', '@types/react-dom':'19.2.2',
                                 '@types/three':'0.187.0', 'typescript':'5.9.3', 'vite':'6.4.5', '@vitejs/plugin-react':'4.7.0'}
            for package, version in required_versions.items():
                installed = json.loads((dependency_root / package / 'package.json').read_text())
                require(installed.get('version') == version, f'Existing dependency {package} must be {version}; supply a compatible --dependency-root')
            checks = []
            with tempfile.TemporaryDirectory(prefix='frontend-all-studies-') as folder:
                for kit in ('harbor', 'atlas', 'atelier', 'loom', 'synth', 'material'):
                    destination = Path(folder) / kit
                    run_script(authored / 'scripts/seed.py', [kit, str(destination)])
                    # The directory itself is local, so temporary config/cache writes cannot
                    # land in the source project's node_modules through a directory symlink.
                    local_modules = destination / 'node_modules'
                    local_modules.mkdir()
                    for package in required_versions:
                        link = local_modules / package
                        link.parent.mkdir(parents=True, exist_ok=True)
                        link.symlink_to(dependency_root / package, target_is_directory=True)
                    for relative in re.findall(r'["\'](/assets/[^"\'?#)\s]+)',
                                               '\n'.join(path.read_text() for path in (destination / 'src').rglob('*') if path.suffix in {'.ts','.tsx','.css'})):
                        require((destination / 'public' / relative.lstrip('/')).is_file(), f'{kit}: missing asset {relative}')
                    if kit == 'loom':
                        # Execute the actual current fixture with staged/reverted props.
                        # This verifies consequence rendering, not browser gestures or motion.
                        entry = destination / 'fixture-smoke.tsx'
                        entry.write_text("""import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ProofGarden from './src/concepts/relay/ProofGarden';
import assert from 'node:assert/strict';
const render=(changes:number[],before=false,empty=false)=>renderToStaticMarkup(<ProofGarden changes={changes} selected={0} before={before} empty={empty} onEmpty={()=>{}}/>);
assert.match(render([]),/is-cramped/);
assert.match(render([0]),/is-spacious/);
assert.doesNotMatch(render([]),/<input/);
assert.match(render([1]),/aria-label=\"Search example observations\"/);
assert.doesNotMatch(render([],false,true),/Start an observation/);
assert.match(render([2],false,true),/Start an observation/);
assert.equal(render([0,1,2],true,true),render([],false,true));
console.log('PASS: staged layout/search/empty-state consequences render; before restores the original fixture.');
""")
                        executable = dependency_root / 'esbuild/bin/esbuild'
                        require(executable.is_file(), 'Compatible dependencies must include Vite’s esbuild')
                        bundle = destination / 'fixture-smoke.cjs'
                        compiled = subprocess.run([str(executable), str(entry), '--bundle', '--platform=node',
                                                   '--format=cjs', '--jsx=automatic', f'--outfile={bundle}'],
                                                  cwd=destination, capture_output=True, text=True, timeout=30)
                        require(compiled.returncode == 0, f'Fixture smoke compilation failed: {compiled.stderr}')
                        smoke = subprocess.run(['node', str(bundle)], cwd=destination, capture_output=True, text=True, timeout=15)
                        require(smoke.returncode == 0, f'Fixture consequence check failed: {smoke.stdout}{smoke.stderr}')
                        checks.append('loom:staged-consequence-and-revert')
                    commands = [('check', ['node', str(dependency_root / 'typescript/bin/tsc'), '--noEmit']),
                                ('build', ['node', str(dependency_root / 'vite/bin/vite.js'), 'build', '--configLoader', 'native'])]
                    for label, command in commands:
                        result = subprocess.run(command, cwd=destination, capture_output=True, text=True, timeout=60)
                        require(result.returncode == 0, f'{kit} {label} failed:\n{(result.stdout + result.stderr)[-6000:]}')
                        checks.append(f'{kit}:{label}')
            return f'{len(checks)} checks passed: ' + ', '.join(checks) + '; temporary projects removed; no installs/services'
        check('Six seeded studies typecheck and production build', build_all_studies)

    def stable_observation():
        recorded = provenance.get('bundle')
        require(recorded is not None, 'No verified bundle observation')
        actual = {str(path.relative_to(authored / 'assets/examples')):hashlib.sha256(path.read_bytes()).hexdigest()
                  for path in (authored / 'assets/examples').rglob('*') if path.is_file()}
        require(actual == recorded['files'], 'Study bundle changed during verification; rerun against the new inventory')
        require(hashlib.sha256((authored / 'references/example-manifest.json').read_bytes()).hexdigest() == recorded['manifestSha256'],
                'Study manifest changed during verification')
        return 'Actual bundle and manifest remain identical to the observation checked above'
    check('Bundle stable during verification', stable_observation)

    passed = all(item['passed'] for item in findings)
    if args.json:
        print(json.dumps({'passed': passed, 'checks': findings, 'provenance':provenance,
                          'scope': 'Saved discovery, YAML, references, backup integrity and helper behavior; optional seeded builds and server-rendered fixture consequences. Active-session loading, browser behavior and design quality are not established.'}, indent=2))
    else:
        for item in findings:
            print(f'{"PASS" if item["passed"] else "FAIL"} {item["check"]}: {item["detail"]}')
        print('This verifies saved installation and helper behavior; it does not establish active-session loading or design quality.')
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
