"""Ergänzt fehlende Strukturen aus BodyParts3D 3.0 (gleicher Körper, gleiches Koordinatensystem).

Quelle: GitHub-Spiegel Kevin-Mattheus-Moerman/BodyParts3D (BodyParts3D 3.0 / 20110915, als STL).
Lizenz: CC BY-SA 2.1 Japan – "BodyParts3D, (c) The Database Center for Life Science".
Die STL-Dateien werden vereinfacht (Polygonreduktion) und als OBJ im BodyParts3D-Stil gespeichert.

Aufruf:  python tools/build_v3_supplement.py <ordner-mit-FMA-stl-dateien>
"""
import json, sys
from pathlib import Path
import numpy as np
import fast_simplification

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'Data' / 'bp3d_v3_ergaenzung'

PARTS = [  # FMA-ID, englischer Name, Katalog-Kategorie, Ziel-Dreiecke
    ('FMA7333', 'Upper lobe of right lung', 'organs.respiratory', 6000),
    ('FMA7383', 'Middle lobe of right lung', 'organs.respiratory', 5000),
    ('FMA7337', 'Lower lobe of right lung', 'organs.respiratory', 7000),
    ('FMA7370', 'Upper lobe of left lung', 'organs.respiratory', 6000),
    ('FMA7371', 'Lower lobe of left lung', 'organs.respiratory', 6000),
    ('FMA13358', 'Right latissimus dorsi', 'muscles', 9000),
    ('FMA13359', 'Left latissimus dorsi', 'muscles', 9000),
    ('FMA13377', 'Right rectus abdominis', 'muscles', 7000),
    ('FMA13378', 'Left rectus abdominis', 'muscles', 7000),
]

HEADER = ('# The license for this database is specified in the Creative Commons Attribution-Share Alike 2.1 Japan. '
          'If you use data from this database, please be sure attribute this database as follows: '
          '"BodyParts3D, (c)  The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan".\n'
          '# http://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html\n'
          '# Source: BodyParts3D 3.0 (20110915) via github.com/Kevin-Mattheus-Moerman/BodyParts3D, simplified for the web\n')


def read_stl(path):
    data = path.read_bytes()
    n = int.from_bytes(data[80:84], 'little')
    rec = np.frombuffer(data[84:84 + n * 50], dtype=np.dtype([('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')]))
    verts = rec['v'].reshape(-1, 3).astype(np.float64)
    unique, inverse = np.unique(verts.round(4), axis=0, return_inverse=True)
    return unique, inverse.reshape(-1, 3)


def main(src):
    records = []
    for fma, name, category, target in PARTS:
        points, faces = read_stl(Path(src) / f'{fma}.stl')
        reduction = max(0.0, 1 - target / len(faces))
        p2, f2 = fast_simplification.simplify(points, faces, target_reduction=reduction)
        lo, hi = p2.min(0), p2.max(0)
        lines = [HEADER, f'# File ID : {fma}\n# English name : {name}\n',
                 f'# Bounds(mm): ({lo[0]:.4f},{lo[1]:.4f},{lo[2]:.4f})-({hi[0]:.4f},{hi[1]:.4f},{hi[2]:.4f})\n#\n']
        lines += [f'v {x:.4f} {y:.4f} {z:.4f}\n' for x, y, z in p2]
        lines += [f'f {a + 1} {b + 1} {c + 1}\n' for a, b, c in f2]
        (OUT / f'{fma}.obj').write_text(''.join(lines), encoding='utf-8')
        print(f'{fma} {name}: {len(faces)} -> {len(f2)} Dreiecke')
        records.append({'key': f'v3:{fma}', 'source': 'v3', 'fileId': fma, 'conceptId': fma, 'nameEn': name,
                        'path': f'./Data/bp3d_v3_ergaenzung/{fma}.obj', 'categoryId': category})
    (OUT / 'ergaenzung.json').write_text(json.dumps({
        'description': 'Ergänzung aus BodyParts3D 3.0 (fehlt in 4.0): Lungenlappen, Latissimus, gerader Bauchmuskel. '
                       'Gleiches Koordinatensystem wie BodyParts3D 4.0.',
        'license': 'BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 Japan',
        'models': records}, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
