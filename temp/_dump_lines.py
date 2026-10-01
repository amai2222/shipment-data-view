import json
from pathlib import Path

p = Path(r'C:\Users\admin\.cursor\projects\e-shipment-data-view\agent-transcripts\d1ca9554-1019-4ce6-a31c-1efb1d672012\d1ca9554-1019-4ce6-a31c-1efb1d672012.jsonl')
out = Path(r'e:\shipment-data-view\temp')
with p.open(encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if i not in (674, 675, 686, 700):
            continue
        obj = json.loads(line)
        for c in obj.get('message', {}).get('content', []):
            if c.get('type') != 'tool_use':
                continue
            inp = c.get('input') or {}
            old = inp.get('old_string') or ''
            (out / f'_line{i}_old.txt').write_text(old, encoding='utf-8')
            print(i, 'old', len(old), 'starts', old[:80].replace('\n',' / '))
