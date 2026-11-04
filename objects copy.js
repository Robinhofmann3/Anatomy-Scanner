import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const BASE_PATH = './Data/partof_BP3D_4.0_obj_99/partof_BP3D_4.0_obj_99/';

// Wie viele OBJ-Dateien gleichzeitig geladen werden
const MAX_PARALLEL = 8;

const SKIN_ID = 'FJ2810';


// ========================================
// GEMEINSAME MODELLPOSITIONIERUNG
// ========================================

function prepareModel(obj) {

    obj.rotation.x = -Math.PI / 2;
    obj.scale.setScalar(20 / 1641);

}


// ========================================
// DATEILISTE (aus dem cmd-Output)
// [von, bis, modus]
// 'p' = nur FJxxxx.obj
// 'b' = FJxxxx.obj und FJxxxxM.obj (gespiegelt)
// 'm' = nur FJxxxxM.obj
// ========================================

const ID_RANGES = [

    [1252, 1302, 'p'], [1304, 1306, 'p'], [1308, 1313, 'p'],
    [1315, 1326, 'p'], [1328, 1353, 'p'], [1355, 1357, 'p'],
    [1359, 1364, 'p'], [1366, 1377, 'p'], [1379, 1382, 'p'],

    [1383, 1447, 'b'],
    [1448, 1448, 'p'],
    [1449, 1449, 'm'],
    [1450, 1452, 'b'],
    [1453, 1453, 'm'],
    [1454, 1456, 'b'],
    [1457, 1458, 'm'],
    [1459, 1518, 'b'],
    [1520, 1522, 'b'],
    [1524, 1528, 'b'],
    [1532, 1554, 'b'],

    [1555, 1601, 'p'],

    [1654, 1654, 'b'],
    [1655, 1655, 'p'],
    [1656, 1671, 'b'],
    [1672, 1672, 'p'],
    [1673, 1729, 'b'],

    [1730, 1815, 'p'],
    [1816, 1816, 'b'],
    [1817, 1844, 'p'],
    [1846, 1846, 'p'],

    [1853, 1853, 'p'], [1858, 1858, 'p'], [1867, 1867, 'p'],
    [1874, 1874, 'p'], [1883, 1883, 'p'], [1893, 1893, 'p'],
    [1895, 1896, 'p'], [1913, 1914, 'p'], [1916, 1916, 'p'],
    [1924, 1924, 'p'], [1928, 1928, 'p'], [1931, 1939, 'p'],
    [1950, 1950, 'p'], [1961, 1961, 'p'], [1967, 1967, 'p'],
    [1969, 1977, 'p'], [1979, 1979, 'p'], [1981, 1981, 'p'],
    [1985, 1988, 'p'], [1991, 1991, 'p'], [1993, 1996, 'p'],
    [2011, 2011, 'p'], [2013, 2013, 'p'], [2025, 2025, 'p'],
    [2034, 2034, 'p'], [2038, 2038, 'p'], [2041, 2046, 'p'],
    [2049, 2049, 'p'], [2052, 2069, 'p'], [2072, 2074, 'p'],
    [2076, 2087, 'p'], [2089, 2097, 'p'], [2099, 2100, 'p'],
    [2102, 2103, 'p'], [2107, 2108, 'p'], [2113, 2113, 'p'],
    [2115, 2115, 'p'], [2117, 2122, 'p'], [2124, 2125, 'p'],
    [2127, 2133, 'p'], [2135, 2138, 'p'], [2141, 2141, 'p'],
    [2143, 2145, 'p'], [2150, 2153, 'p'], [2158, 2160, 'p'],
    [2162, 2167, 'p'], [2169, 2176, 'p'], [2178, 2179, 'p'],
    [2181, 2374, 'p'],
    [2386, 2386, 'p'], [2394, 2394, 'p'], [2404, 2405, 'p'],
    [2409, 2409, 'p'], [2414, 2558, 'p'], [2561, 2665, 'p'],
    [2667, 2668, 'p'], [2670, 2725, 'p'], [2727, 2824, 'p'],
    [2881, 3086, 'p'], [3088, 3401, 'p'],

    [3406, 3406, 'p'], [3409, 3411, 'p'], [3413, 3421, 'p'],
    [3426, 3434, 'p'], [3437, 3444, 'p'], [3446, 3452, 'p'],
    [3458, 3486, 'p'], [3493, 3497, 'p'], [3499, 3502, 'p'],
    [3510, 3520, 'p'], [3522, 3527, 'p'], [3529, 3534, 'p'],
    [3541, 3546, 'p'], [3553, 3553, 'p'], [3557, 3587, 'p'],
    [3589, 3597, 'p'], [3603, 3612, 'p'], [3614, 3626, 'p'],
    [3631, 3632, 'p'], [3635, 3641, 'p'], [3644, 3659, 'p']

];


function buildFileList() {

    const ids = [];

    ID_RANGES.forEach(([from, to, mode]) => {

        for (let n = from; n <= to; n++) {

            if (mode === 'p' || mode === 'b') ids.push('FJ' + n);
            if (mode === 'm' || mode === 'b') ids.push('FJ' + n + 'M');

        }

    });

    return ids;

}


// ========================================
// BEKANNTE ORGANE (Name + Farbe)
// ========================================

const KNOWN = {

    FJ2564: { name: 'MAGEN',                    color: 0xc68e62 },
    FJ2561: { name: 'MILZ',                     color: 0x702c45 },
    FJ1895: { name: 'BAUCHSPEICHELDRÜSE',       color: 0xd99b72 },
    FJ2817: { name: 'GALLENBLASE',              color: 0x729b38 },
    FJ3147: { name: 'RECHTE NIERE',             color: 0x963d3d },
    FJ3145: { name: 'LINKE NIERE',              color: 0x963d3d },
    FJ3149: { name: 'HARNBLASE',                color: 0xb56c83 },
    FJ2573: { name: 'ZWÖLFFINGERDARM',          color: 0xc68e62 },
    FJ2563: { name: 'SPEISERÖHRE',              color: 0xc68e62 },
    FJ2541: { name: 'LUFTRÖHRE',                color: 0xb5a6a0 },
    FJ3131: { name: 'ZWERCHFELL',               color: 0xc68e62 },
    FJ2565: { name: 'APPENDIX',                 color: 0xc68e62 },
    FJ2571: { name: 'MASTDARM',                 color: 0xc68e62 },
    FJ2566: { name: 'AUFSTEIGENDER DICKDARM',   color: 0xc68e62 },
    FJ2572: { name: 'QUERDICKDARM',             color: 0xc68e62 },
    FJ2567: { name: 'ABSTEIGENDER DICKDARM',    color: 0xc68e62 },
    FJ3396: { name: 'DÜNNDARM',                 color: 0xc68e62 },
    FJ2816: { name: 'LEBER LOBUS CAUDATUS',     color: 0x8b3a32 },
    FJ3094: { name: 'LEBER GALLENGANG',         color: 0x729b38 },
    FJ2428: { name: 'HERZKAMMERWAND',           color: 0xa83232 },
    FJ2439: { name: 'WAND RECHTER VORHOF',      color: 0xb94d4d },
    FJ2438: { name: 'WAND LINKER VORHOF',       color: 0x8b3030 },
    FJ2450: { name: 'LINKER HAUPTBRONCHUS',     color: 0x9b7770 },
    FJ2539: { name: 'RECHTER HAUPTBRONCHUS',    color: 0x9b7770 },
    FJ2966: { name: 'LUNGENSTAMM',              color: 0x9e2929 },
    FJ3019: { name: 'RECHTE LUNGENARTERIE',     color: 0xb83232 },
    FJ2924: { name: 'LINKE LUNGENARTERIE',      color: 0xb83232 }

};

// Diese zuerst laden, damit man sie früh sieht
const PRIORITY = [SKIN_ID, ...Object.keys(KNOWN)];


// Farbe für alle übrigen Teile (stabil pro Dateiname)
function colorForId(id) {

    let hash = 0;

    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }

    const color = new THREE.Color();

    color.setHSL(
        (hash % 360) / 360,
        0.25 + (hash % 20) / 100,
        0.55
    );

    return color;

}


// ========================================
// MATERIALIEN
// ========================================

function createSkinMaterial(cutout) {

    const material = new THREE.MeshStandardMaterial({

        color: 0xe6bea0,
        roughness: 0.7,
        side: THREE.DoubleSide

    });

    material.onBeforeCompile = (shader) => {

        shader.uniforms.uRingCenter = { value: cutout.center };
        shader.uniforms.uRingAxisX = { value: cutout.axisX };
        shader.uniforms.uRingAxisY = { value: cutout.axisY };
        shader.uniforms.uRingRadius = { value: cutout.radius };

        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `
            #include <common>
            varying vec3 vAnatomyWorldPosition;
            `
        );

        shader.vertexShader = shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            `
            #include <worldpos_vertex>

            vAnatomyWorldPosition =
                (modelMatrix * vec4(transformed, 1.0)).xyz;
            `
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `
            #include <common>

            uniform vec3 uRingCenter;
            uniform vec3 uRingAxisX;
            uniform vec3 uRingAxisY;
            uniform float uRingRadius;

            varying vec3 vAnatomyWorldPosition;
            `
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <clipping_planes_fragment>',
            `
            #include <clipping_planes_fragment>

            // Normale der Ring-Ebene
            vec3 ringNormal = normalize(cross(uRingAxisX, uRingAxisY));

            // Sehstrahl von der Kamera zum Hautpunkt
            vec3 viewRay = vAnatomyWorldPosition - cameraPosition;

            float denom = dot(viewRay, ringNormal);

            if (abs(denom) > 0.00001) {

                // Schnittpunkt des Sehstrahls mit der Ring-Ebene
                float t = dot(uRingCenter - cameraPosition, ringNormal) / denom;

                vec3 hit = cameraPosition + viewRay * t;

                vec3 ringDelta = hit - uRingCenter;

                float ringX = dot(ringDelta, uRingAxisX);
                float ringY = dot(ringDelta, uRingAxisY);

                float ringDistance = sqrt(ringX * ringX + ringY * ringY);

                if (ringDistance < uRingRadius) {
                    discard;
                }

            }
            `
        );

    };

    material.customProgramCacheKey = () => 'anatomy-ring-cutout-v1';

    material.needsUpdate = true;

    return material;

}


function createPartMaterial(id) {

    const baseId = id.endsWith('M') ? id.slice(0, -1) : id;

    const color = KNOWN[baseId]
        ? KNOWN[baseId].color
        : colorForId(id);

    return new THREE.MeshStandardMaterial({

        color: color,
        roughness: 0.8,
        side: THREE.DoubleSide

    });

}


// ========================================
// ALLE MODELLE LADEN
// onProgress(geladen, fehler, gesamt) wird nach jeder Datei aufgerufen
// ========================================

export function createAlleModelle(scene, cutout, onProgress) {

    const anatomie = new THREE.Group();

    anatomie.name = 'ANATOMIE';

    prepareModel(anatomie);

    scene.add(anatomie);

    const loader = new OBJLoader();

    // Priorisierte Dateien zuerst, Rest danach
    const alle = buildFileList();

    const queue = [
        ...PRIORITY.filter((id) => alle.includes(id)),
        ...alle.filter((id) => !PRIORITY.includes(id))
    ];

    const gesamt = queue.length;

    let geladen = 0;
    let fehler = 0;
    let naechster = 0;

    const fehlendeDateien = [];

    function meldeFortschritt() {

        if (onProgress) onProgress(geladen, fehler, gesamt);

        if (geladen + fehler === gesamt) {

            console.log(
                'Alle Modelle verarbeitet:',
                geladen, 'geladen,',
                fehler, 'fehlgeschlagen von', gesamt
            );

            if (fehlendeDateien.length > 0) {
                console.warn('Nicht geladen:', fehlendeDateien);
            }

        }

    }

    function ladeNaechste() {

        if (naechster >= queue.length) return;

        const id = queue[naechster++];

        loader.load(

            BASE_PATH + id + '.obj',

            (obj) => {

                obj.name = id;

                obj.traverse((child) => {

                    if (child.isMesh) {

                        child.geometry.computeVertexNormals();

                        child.material = (id === SKIN_ID)
                            ? createSkinMaterial(cutout)
                            : createPartMaterial(id);

                        child.castShadow = true;
                        child.receiveShadow = true;

                    }

                });

                anatomie.add(obj);

                geladen++;

                meldeFortschritt();

                ladeNaechste();

            },

            undefined,

            () => {

                fehler++;

                fehlendeDateien.push(id);

                meldeFortschritt();

                ladeNaechste();

            }

        );

    }

    // Mehrere Ladevorgänge parallel starten
    for (let i = 0; i < MAX_PARALLEL; i++) {
        ladeNaechste();
    }

    return anatomie;

}


// ========================================
// RING ERSTELLEN
// ========================================

export function createRing(scene) {

    const geometry = new THREE.TorusGeometry(
        1,
        0.04,
        16,
        100
    );

    const material = new THREE.MeshStandardMaterial({

        color: 0xff0000,
        roughness: 0.5

    });

    const ring = new THREE.Mesh(geometry, material);

    ring.position.set(0, 10, 5);

    scene.add(ring);

    return ring;

}
