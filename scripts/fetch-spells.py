# Regenerates src/data/spells.json from the SRD (dnd5eapi.co). Run: python3 scripts/fetch-spells.py
import json, urllib.request, concurrent.futures as cf
B = 'https://www.dnd5eapi.co'
import time
def get(u):
    for a in range(5):
        try: return json.load(urllib.request.urlopen(B + u, timeout=30))
        except Exception:
            if a == 4: raise
            time.sleep(1 + a)
idx = get('/api/2014/spells')['results']
def one(r):
    d = get(r['url'])
    dmg = d.get('damage') or {}
    if isinstance(dmg, list): dmg = dmg[0] if dmg else {}
    out = {
        'i': d['index'], 'n': d['name'], 'l': d['level'], 's': d['school']['name'], 'ct': d['casting_time'], 'r': d['range'],
        'c': ', '.join(d.get('components', [])) + (f" ({d['material']})" if d.get('material') else ''),
        'd': d['duration'], 'conc': d.get('concentration', False), 'rit': d.get('ritual', False),
        'desc': '\n\n'.join(d.get('desc', [])), 'hl': '\n\n'.join(d.get('higher_level', [])),
        'cls': [c['index'] for c in d.get('classes', [])],
    }
    if dmg.get('damage_type'): out['dt'] = dmg['damage_type']['index']
    if dmg.get('damage_at_slot_level'): out['dsl'] = dmg['damage_at_slot_level']
    if dmg.get('damage_at_character_level'): out['dcl'] = dmg['damage_at_character_level']
    if d.get('dc'): out['save'] = d['dc']['dc_type']['name'] + (' (half on success)' if d['dc'].get('dc_success') == 'half' else '')
    if d.get('attack_type'): out['atk'] = d['attack_type']
    if d.get('heal_at_slot_level'): out['heal'] = d['heal_at_slot_level']
    return out
with cf.ThreadPoolExecutor(8) as ex: spells = list(ex.map(one, idx))
spells.sort(key=lambda s: (s['l'], s['n']))
json.dump(spells, open('src/data/spells.json', 'w'), separators=(',', ':'))
print(len(spells), 'spells')
