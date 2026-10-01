import json
from pathlib import Path

p = Path(r'C:\Users\admin\.cursor\projects\e-shipment-data-view\agent-transcripts\d1ca9554-1019-4ce6-a31c-1efb1d672012\d1ca9554-1019-4ce6-a31c-1efb1d672012.jsonl')
out_dir = Path(r'e:\shipment-data-view\temp')
keys = [
    'DEFAULT_CONFIG',
    'COST_STATE_MAP',
    'def add_rev_row',
    'def add_cost_row',
    'def _setup_left_panel',
    'def _setup_action_buttons',
    '物流收入',
    '司机运费',
    '居间费含',
    '业务份数',
    '自动算总额',
    'def _collect_ui',
    'def get_pct',
    'def calculate_cost',
]
n = 0
with p.open(encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if '36.py' not in line:
            continue
        obj = json.loads(line)
        msg = obj.get('message') or {}
        content = msg.get('content') or []
        if not isinstance(content, list):
            continue
        for c in content:
            if c.get('type') != 'tool_use':
                continue
            inp = c.get('input') or {}
            old = inp.get('old_string') or ''
            new = inp.get('new_string') or inp.get('contents') or ''
            blob = old + new
            kh = [k for k in keys if k in blob]
            if not kh:
                continue
            n += 1
            print(f'LINE {i} {c.get("name")} old={len(old)} new={len(new)} hits={kh}')
            if 'DEFAULT_CONFIG' in old and 'surcharge_rate' in old:
                (out_dir / '_old_default_config.txt').write_text(old[:4000], encoding='utf-8')
                print('  saved default from old')
            if 'COST_STATE_MAP' in old:
                (out_dir / '_old_cost_map.txt').write_text(old[:2500], encoding='utf-8')
                print('  saved cost map from old')
            if 'def _setup_left_panel' in old:
                (out_dir / '_old_left_panel.txt').write_text(old, encoding='utf-8')
                print('  saved left panel from old')
            if '物流收入' in old:
                (out_dir / '_old_init_rows.txt').write_text(old[:2500], encoding='utf-8')
                print('  saved init rows from old')
            if '业务份数' in old or '自动算总额' in old:
                (out_dir / '_old_qty_label.txt').write_text(old[:3500], encoding='utf-8')
                print('  saved qty label from old')
print('n', n)
