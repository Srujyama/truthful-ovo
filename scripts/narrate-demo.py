"""Generate local system-voice narration for the recorded synthetic demo."""
from pathlib import Path
import json
import subprocess

root = Path(__file__).resolve().parent.parent
out = root / 'output' / 'demo'
out.mkdir(parents=True, exist_ok=True)
chapters = [
    (0, 'A promised credit is not a saving. Truthful connects what a vendor said to what actually reached the invoice.'),
    (8, 'This fictional cloud agreement promises ninety nine point nine percent uptime. The relevant credit tier is right here in the source.'),
    (19, 'Replay nine covered hours of downtime. Availability falls to ninety eight point seven five percent. The contract tier is twenty five percent of eight thousand dollars: a two thousand dollar claim.'),
    (32, 'The claim includes its calculation and evidence. A person reviews and approves it. Approval stays local in this prototype. No email is sent.'),
    (46, 'The vendor offers the credit if we renew for another year. That is a new obligation. Truthful keeps it separate from the original claim. We preserve the original terms without accepting the renewal.'),
    (63, 'Even an issued credit memo is not an applied saving. Watch verified savings stay at nine hundred dollars. Only invoice application moves the total to two thousand nine hundred.'),
    (77, 'Here is the actual line in the fictional next invoice. The credit reference connects the financial result to the original case.'),
    (88, 'Now the processing path. Supply promise text and invoice credit rows. It finds twenty four hundred dollars promised, nine hundred applied, and fifteen hundred outstanding.'),
    (100, 'Change the matching invoice amount to one thousand dollars and analyze again. The gap becomes fourteen hundred. These are computed results from edited source data, not a fixed replay.'),
    (114, 'Open the exact matching source row. Export the documents, finding, and local audit record together. Supported format rules. Real calculations. Proof you can inspect.'),
]
for i, (_, text) in enumerate(chapters):
    text_path = out / f'narration-{i:02}.txt'
    text_path.write_text(text)
    subprocess.run(['say','-v','Samantha','-r','175','-f',str(text_path),'-o',str(out/f'narration-{i:02}.aiff')],check=True)

inputs, filters = [], []
for i, (start, _) in enumerate(chapters):
    inputs += ['-i',str(out/f'narration-{i:02}.aiff')]
    filters.append(f'[{i}:a]adelay={start*1000}:all=1[a{i}]')
filters.append(''.join(f'[a{i}]' for i in range(len(chapters))) + f'amix=inputs={len(chapters)}:normalize=0,apad=whole_dur=128,loudnorm=I=-16:TP=-1.5:LRA=11[out]')
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error',*inputs,'-filter_complex',';'.join(filters),'-map','[out]','-t','128',str(out/'narration.wav')],check=True)
(out/'chapters.json').write_text(json.dumps([{'start':s,'text':t} for s,t in chapters],indent=2))
print('Generated 128-second local system-voice narration (Samantha).')
