"""Generate local system-voice narration for the recorded synthetic demo."""
from pathlib import Path
import json
import subprocess

root = Path(__file__).resolve().parent.parent
out = root / 'output' / 'demo-v3'
out.mkdir(parents=True, exist_ok=True)
chapters = [
    (0, 'A promised credit is not a saving. Truthful follows what is owed, the evidence behind it, and what an agent is still allowed to do. This recording uses synthetic records and the real local SQLite service.'),
    (15, 'Here is the trap. Pipeline offers fifteen hundred dollars in credit if we renew. Against the explicit equivalent-service baseline, the renewal costs twenty four hundred dollars extra. Net incremental value: negative nine hundred dollars. Recovering the credit would make this deal worse.'),
    (33, 'A separate date amendment conflicts with that renewal. Neither silently replaces the original agreement. Finance must choose deliberately.'),
    (43, 'We dismiss the renewal with a retained reason, then prepare a fresh review of the date change. Approval and execution are separate. The exact action is approved, then recorded once. This is a local state transition, not a message or a real renewal.'),
    (68, 'Now separate financial time from knowledge time. We ask what applied on November second, using only evidence known by October twenty eighth. The original October first due date remains. Later knowledge includes our accepted November fifteenth schedule. The old view is preserved, rather than rewritten.'),
    (95, 'The failure lab makes these boundaries executable. This case approves an action, revises its source, then attempts to execute the old approval. Inspect the command trace. Stale approval is an actual reducer rejection. A changed policy, ledger, or accepted terms also invalidates an earlier authorization.'),
    (123, 'Another case tries to allocate the same nine hundred dollar credit twice. The second allocation is rejected. Credit capacity is conserved across commitments, not just within one case. Issued memos and conditional offers are kept out of applied savings.'),
    (146, 'Refusing bad actions is only half the job. This valid atomic batch records a new invoice source, a separate fifteen hundred dollar credit line, and its allocation. All three commit together or none do.'),
    (164, 'The original promise is now fully applied: twenty four hundred dollars, zero outstanding. Export the sources, versions, decisions, and command chain for replay. Internal consistency you can inspect, with the trust boundary stated.'),
]
for i, (_, text) in enumerate(chapters):
    text_path = out / f'narration-{i:02}.txt'
    text_path.write_text(text)
    subprocess.run(['say','-v','Samantha','-r','175','-f',str(text_path),'-o',str(out/f'narration-{i:02}.aiff')],check=True)

inputs, filters = [], []
for i, (start, _) in enumerate(chapters):
    inputs += ['-i',str(out/f'narration-{i:02}.aiff')]
    filters.append(f'[{i}:a]adelay={start*1000}:all=1[a{i}]')
filters.append(''.join(f'[a{i}]' for i in range(len(chapters))) + f'amix=inputs={len(chapters)}:normalize=0,apad=whole_dur=181,loudnorm=I=-16:TP=-1.5:LRA=11[out]')
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error',*inputs,'-filter_complex',';'.join(filters),'-map','[out]','-t','181',str(out/'narration.wav')],check=True)
(out/'chapters.json').write_text(json.dumps([{'start':s,'text':t} for s,t in chapters],indent=2))
print('Generated 181-second local system-voice narration (Samantha).')
