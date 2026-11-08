"""Baut Data/organ-hierarchy.json: LOD1 System -> LOD2 Gruppe -> LOD3 Organ/Knochen/Muskel.

LOD3-Knoten fassen mehrere OBJ-Teile (modelKeys) zu einem ansprechbaren Objekt zusammen,
z. B. "Herz" = Vorhofwände + Klappen + Kammerhohlräume + Papillarmuskeln.
LOD4 (Steckbrief/Quiz) liegt separat in Data/organ-portfolio.json und wird über die LOD3-id verknüpft.

Aufruf:  python tools/build_organ_hierarchy.py
Quelle:  Data/anatomy-catalog.json (Sammlung 'partof', wie im Viewer)
"""
import json, re
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'Data' / 'anatomy-catalog.json'
SUPPLEMENT = ROOT / 'Data' / 'bp3d_v3_ergaenzung' / 'ergaenzung.json'   # Lungenlappen aus BP3D 3.0
OUT = ROOT / 'Data' / 'organ-hierarchy.json'

LOD1 = [
    ('haut', 'Haut'),
    ('skelett', 'Skelett'),
    ('muskulatur', 'Muskulatur'),
    ('organe', 'Organe & Organsysteme'),
    ('sonstiges', 'Nicht zugeordnet'),
]

# LOD2: (id, parent LOD1, Label)
LOD2 = [
    ('haut.haut', 'haut', 'Haut'),
    ('skelett.schaedel', 'skelett', 'Schädel'),
    ('skelett.rumpf', 'skelett', 'Wirbelsäule & Brustkorb'),
    ('skelett.gliedmassen', 'skelett', 'Arme, Beine & Gürtel'),
    ('muskulatur.muskeln', 'muskulatur', 'Muskeln'),
    ('organe.kreislauf', 'organe', 'Herz & Kreislauf'),
    ('organe.atmung', 'organe', 'Atmung'),
    ('organe.verdauung', 'organe', 'Verdauung'),
    ('organe.harn', 'organe', 'Harn- & Geschlechtsorgane'),
    ('organe.nerven', 'organe', 'Gehirn & Nervensystem'),
    ('organe.sinne', 'organe', 'Sinnesorgane'),
    ('organe.hormone', 'organe', 'Hormondrüsen'),
    ('organe.immun', 'organe', 'Immunsystem'),
    ('sonstiges.unklar', 'sonstiges', 'Unbekannte Teile'),
]

# Katalog-Kategorie (Lily) -> LOD2
CATEGORY_TO_LOD2 = {
    'skin': 'haut.haut',
    'skeleton.skull': 'skelett.schaedel',
    'skeleton.axial': 'skelett.rumpf',
    'skeleton.limbs': 'skelett.gliedmassen',
    'muscles': 'muskulatur.muskeln',
    'vessels.arteries': 'organe.kreislauf',
    'vessels.veins': 'organe.kreislauf',
    'organs.heart.walls': 'organe.kreislauf',
    'organs.heart.valves': 'organe.kreislauf',
    'organs.heart.other': 'organe.kreislauf',
    'organs.respiratory': 'organe.atmung',
    'organs.digestive': 'organe.verdauung',
    'organs.urogenital': 'organe.harn',
    'organs.nervous': 'organe.nerven',
    'organs.senses': 'organe.sinne',
    'organs.endocrine': 'organe.hormone',
    'organs.lymphatic': 'organe.immun',
}

# Korrekturen für 'unclassified' (Name -> LOD2)
UNCLASSIFIED_FIX = [
    (r'trunk$|plantar arch', 'organe.kreislauf'),
    (r'iliotibial tract', 'muskulatur.muskeln'),
    (r'nasal cartilage', 'organe.atmung'),
    (r'pubic hair', 'haut.haut'),
]

# Kuratierte LOD3-Organe innerhalb einer LOD2-Gruppe.
# (id, Label, Regex auf nameEn, game) - erste passende Regel gewinnt.
# Alles ohne Treffer wird pro eindeutigem Namen ein eigenes LOD3-Objekt.
ORGANS = {
    'organe.kreislauf': [
        # Herz inkl. Herzkranzgefäße (liegen auf der Herzoberfläche, gehören fürs Spiel dazu)
        ('herz', 'Herz', r'atrium|ventricle|valve|papillary|leaflet|cusp|coronary|cardiac vein|marginal vein', True),
    ],
    'organe.atmung': [
        ('luftroehre', 'Luftröhre', r'^trachea$', False),
        ('lunge_links', 'Linke Lunge', r'^left .*bronch|lingular|lobe of left lung', True),
        ('lunge_rechts', 'Rechte Lunge', r'^right .*bronch|^(medial|lateral) segmental bronchial|lobe of right lung', True),
        ('nase', 'Nase (Knorpel)', r'alar cartilage|nasal cartilage', False),
    ],
    'organe.verdauung': [
        ('mund', 'Mund & Zunge', r'tongue|gingiva', False),
        ('speicheldruesen', 'Speicheldrüsen', r'submandibular|sublingual|parotid', False),
        ('speiseroehre', 'Speiseröhre', r'esophagus', False),
        ('magen', 'Magen', r'^stomach$', True),
        ('duenndarm', 'Dünndarm', r'duodenum|jejunum|ileum$|mesentery of small intestine', True),
        ('dickdarm', 'Dickdarm', r'colon|rectum|appendix|mesoappendix|ileocecal|taenia|mesocolon', True),
        ('gallenwege', 'Gallenblase & Gallenwege', r'gallbladder|biliary|hepatic duct|cystic duct', False),
        ('leber', 'Leber', r'hepatovenous segment|lobe of liver', True),
        ('pankreas', 'Bauchspeicheldrüse', r'pancrea', False),
    ],
    'organe.harn': [
        ('niere_links', 'Linke Niere', r'^left kidney$', True),
        ('niere_rechts', 'Rechte Niere', r'^right kidney$', True),
        ('harnleiter', 'Harnleiter', r'ureter', False),
        ('harnblase', 'Harnblase', r'urinary bladder', True),
        ('harnroehre', 'Harnröhre', r'urethra', False),
        ('prostata', 'Prostata', r'prostate', False),
    ],
    'organe.nerven': [
        ('grosshirn', 'Großhirn', r'gyrus|gyri|lobule|occipital lobe|insula|hippocamp|internal capsule|white matter of .* cerebral', True),
        ('kleinhirn', 'Kleinhirn', r'^cerebellum$', False),
        ('hirnstamm', 'Hirnstamm', r'midbrain|pons|medulla oblongata|colliculus', False),
        ('zwischenhirn', 'Zwischenhirn', r'thalamus|habenula|tuber cinereum', False),
        ('hirnventrikel', 'Hirnventrikel', r'ventricle|cerebral aqueduct', False),
        ('rueckenmark', 'Rückenmark', r'spinal cord', False),
    ],
    'organe.sinne': [
        ('auge_links', 'Linkes Auge & Tränenapparat', r'left', False),
        ('auge_rechts', 'Rechtes Auge & Tränenapparat', r'right', False),
    ],
    'organe.hormone': [
        ('nebenniere_links', 'Linke Nebenniere', r'left adrenal', False),
        ('nebenniere_rechts', 'Rechte Nebenniere', r'right adrenal', False),
        ('hypophyse', 'Hypophyse', r'pituitary', False),
        ('zirbeldruese', 'Zirbeldrüse', r'pineal', False),
    ],
    'organe.immun': [
        ('thymus', 'Thymus', r'thymus', False),
    ],
}


def slug(text):
    t = text.lower()
    for a, b in (('ä', 'ae'), ('ö', 'oe'), ('ü', 'ue'), ('ß', 'ss')):
        t = t.replace(a, b)
    return re.sub(r'[^a-z0-9]+', '_', t).strip('_')


def lod2_for(model):
    cat = model['categoryId']
    if cat == 'unclassified':
        for pattern, target in UNCLASSIFIED_FIX:
            if re.search(pattern, model['nameEn'], re.I):
                return target
        return 'sonstiges.unklar'
    return CATEGORY_TO_LOD2[cat]


def build():
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    models = [m for m in catalog['models'] if m['source'] == catalog['defaultSource']]
    # Ergänzung aus BP3D 3.0: nur Organe (Lungenlappen); die Muskeln nutzt der Muskel-Atlas direkt
    if SUPPLEMENT.exists():
        extra = json.loads(SUPPLEMENT.read_text(encoding='utf-8'))['models']
        models += [m for m in extra if m['categoryId'].startswith('organs')]

    lod3 = OrderedDict()   # id -> node
    for model in models:
        group = lod2_for(model)
        node_id = None
        for oid, label, pattern, game in ORGANS.get(group, []):
            if re.search(pattern, model['nameEn'], re.I):
                node_id = f'{group}.{oid}'
                node = lod3.setdefault(node_id, {
                    'id': node_id, 'level': 3, 'parentId': group,
                    'label': label, 'curated': True, 'game': game, 'modelKeys': []})
                break
        if node_id is None:   # Fallback: ein Objekt pro eindeutigem Namen
            node_id = f'{group}.{slug(model["nameEn"])}'
            node = lod3.setdefault(node_id, {
                'id': node_id, 'level': 3, 'parentId': group,
                'label': model['nameEn'], 'curated': False, 'game': False, 'modelKeys': []})
        node['modelKeys'].append(model['key'])

    nodes = [{'id': i, 'level': 1, 'parentId': None, 'label': l} for i, l in LOD1]
    nodes += [{'id': i, 'level': 2, 'parentId': p, 'label': l} for i, p, l in LOD2]
    nodes += list(lod3.values())

    # Integritätsprüfung: jedes Modell genau einmal, keine leeren Gruppen
    keys = [k for n in lod3.values() for k in n['modelKeys']]
    assert len(keys) == len(set(keys)) == len(models), 'Modell doppelt oder fehlend'
    ids = {n['id'] for n in nodes}
    assert all(n['parentId'] in ids for n in nodes if n['parentId']), 'Unbekannte parentId'

    OUT.write_text(json.dumps({
        'schemaVersion': 1,
        'source': catalog['defaultSource'],
        'description': 'LOD1 System > LOD2 Gruppe > LOD3 Organ/Knochen/Muskel (aus Einzelteilen). LOD4: Data/organ-portfolio.json',
        'nodes': nodes,
    }, ensure_ascii=False, indent=1), encoding='utf-8')
    return nodes


if __name__ == '__main__':
    nodes = build()
    from collections import Counter
    l3 = [n for n in nodes if n['level'] == 3]
    print('LOD3-Objekte:', len(l3), '| davon kuratiert:', sum(n['curated'] for n in l3),
          '| Spielorgane:', [n['label'] for n in l3 if n['game']])
    for g, c in Counter(n['parentId'] for n in l3).items():
        print(f'  {g}: {c}')
