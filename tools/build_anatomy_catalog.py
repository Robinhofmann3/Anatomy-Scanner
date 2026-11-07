"""Build a reproducible inventory from OBJ headers, without modifying models."""
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'isa': 'Data/isa_BP3D_4.0_obj_99',
    'partof': 'Data/partof_BP3D_4.0_obj_99/partof_BP3D_4.0_obj_99',
}
# UI grouping, not a claim about anatomical containment or depth order.
CATEGORIES = [
    ('body', None, 'Body'), ('skin', 'body', 'Skin'),
    ('muscles', 'body', 'Muscles'), ('skeleton', 'body', 'Skeleton'),
    ('skeleton.skull', 'skeleton', 'Skull'),
    ('skeleton.axial', 'skeleton', 'Spine and rib cage'),
    ('skeleton.limbs', 'skeleton', 'Limbs and girdles'),
    ('vessels', 'body', 'Blood vessels'),
    ('vessels.arteries', 'vessels', 'Arteries'),
    ('vessels.veins', 'vessels', 'Veins'),
    ('organs', 'body', 'Organs'), ('organs.heart', 'organs', 'Heart'),
    ('organs.heart.walls', 'organs.heart', 'Walls'),
    ('organs.heart.valves', 'organs.heart', 'Valves'),
    ('organs.heart.other', 'organs.heart', 'Other heart structures'),
    ('organs.respiratory', 'organs', 'Respiratory'),
    ('organs.digestive', 'organs', 'Digestive'),
    ('organs.urogenital', 'organs', 'Urinary and reproductive'),
    ('organs.nervous', 'organs', 'Brain and nervous structures'),
    ('organs.senses', 'organs', 'Eyes and sensory structures'),
    ('organs.endocrine', 'organs', 'Endocrine'),
    ('organs.lymphatic', 'organs', 'Lymphatic'),
    ('unclassified', 'body', 'Unclassified / review required'),
]


def classify(name):
    """Conservative name-based proposals. Unmatched parts stay visible in inventory."""
    n = name.lower()
    if n == 'skin':
        return 'skin', 'exact-skin'
    # A vessel supplying a named organ remains in the vessel category.
    if re.search(r'\b(vein|venous|vena cava|portal trunk|coronary sinus)\b', n):
        return 'vessels.veins', 'name-rule'
    if re.search(r'\b(artery|arterial|aorta|aortic arch|pulmonary trunk)\b', n):
        return 'vessels.arteries', 'name-rule'
    named_groups = [
        ('organs.nervous', ('habenula', 'insula', 'midbrain', 'tuber cinereum', 'occipital lobe', 'parietal lobule')),
        ('organs.digestive', ('hepatic biliary tree', 'hepatic duct', 'cystic duct', 'taenia ', 'mesentery', 'mesoappendix', 'mesocolon')),
        ('skeleton.axial', ('xiphoid process', 'manubrium')),
        ('muscles', ('anconeus', 'levator scapulae', 'transversus thoracis', 'external oblique', 'external anal sphincter', 'levator veli palatini', 'tensor veli palatini', 'levator palpebrae', 'inferior oblique', 'superior oblique', 'inferior rectus', 'superior rectus', 'medial rectus', 'lateral rectus')),
        ('organs.senses', ('nasolacrimal duct',)),
    ]
    if n in ('atlas', 'axis'):
        return 'skeleton.axial', 'name-rule'
    for category, phrases in named_groups:
        if any(phrase in n for phrase in phrases):
            return category, 'name-rule'
    # Vessel rules precede organ rules: renal artery is a vessel, not kidney.
    rules = [
        ('organs.heart.valves', r'\b(valve|mitral|tricuspid)\b'),
        ('organs.heart.walls', r'wall of (?:left |right )?(?:atrium|ventricle)'),
        ('organs.heart.other', r'\b(atrium|papillary|chordae tendineae)\b|(?:left|right) ventricle|interatrial|interventricular septum'),
        ('organs.senses', r'\b(eye|eyeball|lens|retina|cornea|choroid|lacrimal|iris|sclera|vitreous|ciliary|cochlea|ossicle|tympanic)\b'),
        ('organs.endocrine', r'\b(thyroid|parathyroid|pituitary|adrenal|pineal)\b'),
        ('organs.lymphatic', r'\b(spleen|thymus|lymph|lymphatic)\b'),
        ('organs.respiratory', r'\b(lung|pulmonary lobe|bronchus|bronchi|bronchial tree|trachea|larynx|cricoid|thyroid cartilage|alar cartilage)\b'),
        ('organs.digestive', r'\b(liver|hepatic segment|hepatovenous|bile|gallbladder|gall bladder|pancreas|pancreatic duct|stomach|gastric|duodenum|duodenal|jejunum|ileum|ileocecal|cecum|caecum|colon|rectum|appendix|esophagus|oesophagus|tongue|gingiva|tooth|teeth|molar|premolar|incisor|canine tooth|salivary|parotid|sublingual gland|submandibular gland)\b'),
        ('organs.urogenital', r'\b(kidney|ureter|urinary|urethra|bladder|testis|testicle|epididymis|prostate|penis|seminal|ductus deferens|ovary|uterus|vagina)\b'),
        ('organs.nervous', r'\b(brain|cerebral|cerebellar|cerebellum|gyrus|gyri|thalamus|hypothalamus|amygdala|hippocampus|pons|medulla oblongata|spinal cord|nerve|ventricle|colliculus|internal capsule|corpus callosum|putamen|pallidum|caudate nucleus|fornix|vermis)\b'),
        ('skeleton.axial', r'\b(vertebra|vertebral|rib|costal cartilage|sternum|sacrum|coccyx|intervertebral)\b'),
        ('skeleton.skull', r'\b(skull|cranial bone|frontal bone|parietal bone|temporal bone|occipital bone|sphenoid|ethmoid|nasal bone|zygomatic|mandible|maxilla|vomer|palatine bone|hyoid|lacrimal bone|nasal concha)\b'),
        ('skeleton.limbs', r'\b(clavicle|scapula|humerus|radius|ulna|carpal|metacarpal|phalanx|phalanges|pelvic bone|hip bone|ilium|ischium|pubis|femur|patella|tibia|fibula|talus|calcaneus|tarsal|metatarsal|cuneiform bone|cuboid|navicular|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate)\b'),
        ('muscles', r'\b(muscle|biceps|triceps|deltoid|pectoralis|trapezius|latissimus|serratus|rhomboid|supraspinatus|infraspinatus|subscapularis|teres|brachialis|coracobrachialis|brachioradialis|pronator|supinator|flexor|extensor|lumbrical|lumbricals|interossei|interosseous|tibialis|fibularis|peroneus|gastrocnemius|soleus|plantaris|popliteus|sartorius|gracilis|pectineus|adductor|abductor|gluteus|iliacus|psoas|piriformis|obturator|gemellus|quadratus|quadriceps|vastus|semitendinosus|semimembranosus|diaphragm|sternocleidomastoid|scalene|splenius|semispinalis|longissimus|iliocostalis|multifidus|rotatores|digastric|masseter|temporalis|pterygoid|mylohyoid|geniohyoid|stylohyoid|sternohyoid|sternothyroid|thyrohyoid|omohyoid|subclavius)\b'),
    ]
    for category, pattern in rules:
        if re.search(pattern, n):
            return category, 'name-rule'
    return 'unclassified', 'unmatched'


def read_header(path):
    values = {}
    with path.open(encoding='utf-8', errors='replace') as stream:
        for line in stream:
            if not line.startswith('#'):
                break
            match = re.match(r'#\s*([^:]+?)\s*:\s*(.*)', line)
            if match:
                values[match[1].strip()] = match[2].strip()
    return values


def build():
    overrides_path = ROOT / 'Data/anatomy-category-overrides.json'
    overrides = json.loads(overrides_path.read_text(encoding='utf-8'))
    category_ids = {c[0] for c in CATEGORIES}
    records = []
    for source, folder in SOURCES.items():
        for path in sorted((ROOT / folder).glob('*.obj')):
            header = read_header(path)
            name = header.get('English name', '')
            category, basis = classify(name)
            key = f'{source}:{path.stem}'
            override = overrides.get(key)
            if override:
                category = override['categoryId']
                if category not in category_ids:
                    raise ValueError(f'Unknown category in override {key}: {category}')
                basis = 'manual'
            records.append({
                'key': key, 'source': source, 'fileId': path.stem,
                'headerFileId': header.get('File ID'),
                'representationId': header.get('Representation ID'),
                'conceptId': header.get('Concept ID'),
                'nameEn': name or path.stem,
                'path': './' + path.relative_to(ROOT).as_posix(),
                'categoryId': category, 'classificationBasis': basis,
                'needsReview': basis not in ('manual', 'exact-skin'),
            })
    unused = set(overrides) - {r['key'] for r in records}
    if unused:
        raise ValueError(f'Overrides reference missing files: {sorted(unused)}')
    catalog = {'schemaVersion': 1, 'defaultSource': 'partof',
               'categories': [dict(id=i, parentId=p, labelEn=n) for i, p, n in CATEGORIES],
               'models': records}
    (ROOT / 'Data/anatomy-catalog.json').write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for source in SOURCES:
        counts = Counter(r['categoryId'] for r in records if r['source'] == source)
        print(source, sum(counts.values()), json.dumps(dict(sorted(counts.items()))))
    return catalog


if __name__ == '__main__':
    build()
