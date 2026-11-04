
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const BASE_PATH = './Data/partof_BP3D_4.0_obj_99/partof_BP3D_4.0_obj_99/';

// ========================================
// GEMEINSAME MODELLPOSITIONIERUNG
// ========================================

function prepareModel(obj) {

    obj.rotation.x = -Math.PI / 2;
    obj.scale.setScalar(20 / 1641);

}


// ========================================
// MODELL UNTERSUCHEN / DEBUG
// ========================================

function inspectModel(obj, name) {

    const box = new THREE.Box3().setFromObject(obj);

    const center = box.getCenter(new THREE.Vector3());

    const size = box.getSize(new THREE.Vector3());

    const originalBox = new THREE.Box3();

    obj.updateMatrixWorld(true);

    obj.traverse((child) => {

        if (child.isMesh) {

            const geometryBox = child.geometry.boundingBox ||
                child.geometry.computeBoundingBox();

            const meshBox = geometryBox.clone();

            meshBox.applyMatrix4(child.matrixWorld);

            originalBox.union(meshBox);

        }

    });

    console.log('');
    console.log('====================================');
    console.log('MODELL:', name);
    console.log('====================================');

    console.log('Position:', obj.position);
    console.log('Rotation:', obj.rotation);
    console.log('Skalierung:', obj.scale);

    console.log('Bounding Box Minimum:', box.min);
    console.log('Bounding Box Maximum:', box.max);

    console.log('Mittelpunkt:', center);
    console.log('Größe:', size);

    console.log('Originale Welt-Bounding-Box:', originalBox);

    console.log('====================================');

}


// ========================================
// ALLGEMEINE ANATOMIEMODELLE LADEN
// ========================================

function loadAnatomyModel(scene, filename, name, color = 0xa83232) {

    const loader = new OBJLoader();

    loader.load(

        BASE_PATH + filename + '.obj',

        (obj) => {

            console.log(name + ' erfolgreich geladen!');

            prepareModel(obj);
            const box = new THREE.Box3().setFromObject(obj);
            console.log(name, {
                min: box.min,
                max: box.max,
                center: box.getCenter(new THREE.Vector3()),
                size: box.getSize(new THREE.Vector3())
            });
            inspectModel(obj, name);

            obj.traverse((child) => {

                if (child.isMesh) {

                    child.geometry.computeVertexNormals();

                    child.material = new THREE.MeshStandardMaterial({

                        color: color,
                        roughness: 0.8,
                        side: THREE.DoubleSide

                    });

                    child.castShadow = true;
                    child.receiveShadow = true;

                }

            });

            scene.add(obj);

        },

        (xhr) => {

            if (xhr.total > 0) {

                console.log(
                    name + ':',
                    (xhr.loaded / xhr.total * 100).toFixed(1) + '%'
                );

            }

        },

        (error) => {

            console.error(
                'Fehler beim Laden von ' + name + ':',
                error
            );

        }

    );

}


// ========================================
// MAGEN
// ========================================

export function createMagen(scene) {

    loadAnatomyModel(
        scene,
        'FJ2564',
        'MAGEN FJ2564',
        0xc68e62
    );

}


// ========================================
// HAUTMODELL LADEN
// ========================================

export function createBody(scene, cutout) {

    const loader = new OBJLoader();

    loader.load(
        BASE_PATH + 'FJ2810.obj',

        (obj) => {

            console.log('Haut erfolgreich geladen!');

            prepareModel(obj);

            inspectModel(obj, 'HAUTMODELL FJ2810');

            obj.traverse((child) => {

                if (child.isMesh) {

                    child.geometry.computeVertexNormals();

                    const material = new THREE.MeshStandardMaterial({
                        color: 0xe6bea0,
                        roughness: 0.7,
                        side: THREE.DoubleSide
                    });

                    material.onBeforeCompile = (shader) => {

                        shader.uniforms.uRingCenter = {
                            value: cutout.center
                        };

                        shader.uniforms.uRingAxisX = {
                            value: cutout.axisX
                        };

                        shader.uniforms.uRingAxisY = {
                            value: cutout.axisY
                        };

                        shader.uniforms.uRingRadius = {
                            value: cutout.radius
                        };

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

                            vec3 ringDelta =
                                vAnatomyWorldPosition - uRingCenter;

                            float ringX =
                                dot(ringDelta, uRingAxisX);

                            float ringY =
                                dot(ringDelta, uRingAxisY);

                            float ringDistance =
                                sqrt(ringX * ringX + ringY * ringY);

                            if (ringDistance < uRingRadius) {
                                discard;
                            }
                            `
                        );

                    };

                    material.customProgramCacheKey = () =>
                        'anatomy-ring-cutout-v1';

                    material.needsUpdate = true;

                    child.material = material;

                    child.castShadow = true;
                    child.receiveShadow = true;

                }

            });

            scene.add(obj);

            console.log('Hautmodell positioniert:', obj);

        },

        (xhr) => {

            if (xhr.total > 0) {
                console.log(
                    'Haut:',
                    (xhr.loaded / xhr.total * 100).toFixed(1) + '%'
                );
            }

        },

        (error) => {
            console.error('Fehler beim Laden der Haut:', error);
        }
    );
}

 // ========================================
 // DÜNNDARM
 // ========================================

export function createDuennDarm(scene) {

    loadAnatomyModel(
        scene,
        'FJ3396',
        'DÜNNDARM FMA14092',
        0xc68e62
    );

}
// ========================================
// HERZKAMMERWAND
// ========================================

export function createHerzkammerwand(scene) {

    loadAnatomyModel(
        scene,
        'FJ2428',
        'HERZKAMMERWAND FMA13884',
        0xa83232
    );

}


// ========================================
// WAND DES RECHTEN VORHOFS
// ========================================

export function createRechterVorhof(scene) {

    loadAnatomyModel(
        scene,
        'FJ2439',
        'WAND DES RECHTEN VORHOFS FMA9457',
        0xb94d4d
    );

}


// ========================================
// WAND DES LINKEN VORHOFS
// ========================================

export function createLinkerVorhof(scene) {

    loadAnatomyModel(
        scene,
        'FJ2438',
        'WAND DES LINKEN VORHOFS FMA9531',
        0x8b3030
    );

}


 // ========================================
 // GESAMTE LEBER ZUSAMMENSETZEN
 // ========================================

export function createLeber(scene) {

    const leber = new THREE.Group();

    leber.name = 'GESAMTE LEBER';

    const loader = new OBJLoader();

    const leberTeile = [

        {
            id: 'BP8867',
            name: 'VORDERER SEKTOR RECHTS'
        },

        {
            id: 'BP9211',
            name: 'HINTERER SEKTOR RECHTS'
        },

        {
            id: 'BP8872',
            name: 'VORDERER SEKTOR LINKS'
        },

        {
            id: 'FJ2816',
            name: 'LOBUS CAUDATUS'
        },

        {
            id: 'FJ3094',
            name: 'LINKER GALLENGANG DES LOBUS CAUDATUS'
        }

    ];

    let geladen = 0;
    let abgeschlossen = 0;

    leberTeile.forEach((teil) => {

        loader.load(

            BASE_PATH + teil.id + '.obj',

            (obj) => {

                console.log('Leberteil geladen:', teil.name);

                obj.traverse((child) => {

                    if (child.isMesh) {

                        child.geometry.computeVertexNormals();

                        child.material = new THREE.MeshStandardMaterial({

                            color: teil.id === 'FJ3094'
                                ? 0x729b38
                                : 0x8b3a32,

                            roughness: 0.8,
                            side: THREE.DoubleSide

                        });

                        child.castShadow = true;
                        child.receiveShadow = true;

                    }

                });

                leber.add(obj);

                geladen++;

                abgeschlossen++;

                if (abgeschlossen === leberTeile.length) {

                    prepareModel(leber);

                    inspectModel(leber, 'GESAMTE LEBER');

                    scene.add(leber);

                    console.log(
                        'Gesamte Leber erfolgreich zusammengesetzt!',
                        geladen,
                        'von',
                        leberTeile.length,
                        'Teilen geladen.'
                    );

                }

            },

            undefined,

            (error) => {

                console.error(
                    'Fehler beim Laden des Leberteils:',
                    teil.name,
                    error
                );

                abgeschlossen++;

                if (abgeschlossen === leberTeile.length) {

                    prepareModel(leber);

                    inspectModel(leber, 'GESAMTE LEBER');

                    scene.add(leber);

                    console.log(
                        'Leber geladen:',
                        geladen,
                        'von',
                        leberTeile.length,
                        'Teilen.'
                    );

                }

            }

        );

    });

    return leber;

}

// ========================================
// MILZ
// ========================================

export function createMilz(scene) {

    loadAnatomyModel(scene, 'FJ2561', 'MILZ FJ2561', 0x702c45);

}


// ========================================
// BAUCHSPEICHELDRÜSE
// ========================================

export function createBauchspeicheldruese(scene) {

    loadAnatomyModel(scene, 'FJ1895', 'BAUCHSPEICHELDRÜSE FJ1895', 0xd99b72);

}


// ========================================
// GALLENBLASE
// ========================================

export function createGallenblase(scene) {

    loadAnatomyModel(scene, 'FJ2817', 'GALLENBLASE FJ2817', 0x729b38);

}


// ========================================
// RECHTE NIERE
// ========================================

export function createRechteNiere(scene) {

    loadAnatomyModel(scene, 'FJ3147', 'RECHTE NIERE FJ3147', 0x963d3d);

}


// ========================================
// LINKE NIERE
// ========================================

export function createLinkeNiere(scene) {

    loadAnatomyModel(scene, 'FJ3145', 'LINKE NIERE FJ3145', 0x963d3d);

}


// ========================================
// HARNBLASE
// ========================================

export function createHarnblase(scene) {

    loadAnatomyModel(scene, 'FJ3149', 'HARNBLASE FJ3149', 0xb56c83);

}


// ========================================
// ZWÖLFFINGERDARM
// ========================================

export function createZwoelffingerdarm(scene) {

    loadAnatomyModel(scene, 'FJ2573', 'ZWÖLFFINGERDARM FJ2573', 0xc68e62);

}


// ========================================
// SPEISERÖHRE
// ========================================

export function createSpeiseroehre(scene) {

    loadAnatomyModel(
        scene,
        'FJ2563',
        'SPEISERÖHRE FJ2563',
        0xc68e62
    );

}


// ========================================
// LUFTRÖHRE
// ========================================

export function createLuftroehre(scene) {

    loadAnatomyModel(
        scene,
        'FJ2541',
        'LUFTRÖHRE FJ2541',
        0xb5a6a0
    );

}


// ========================================
// ZWERCHFELL
// ========================================

export function createZwerchfell(scene) {

    loadAnatomyModel(
        scene,
        'FJ3131',
        'ZWERCHFELL FJ3131',
        0xc68e62
    );

}


// ========================================
// APPENDIX
// ========================================

export function createAppendix(scene) {

    loadAnatomyModel(
        scene,
        'FJ2565',
        'APPENDIX FJ2565',
        0xc68e62
    );

}


// ========================================
// MASTDARM
// ========================================

export function createMastdarm(scene) {

    loadAnatomyModel(
        scene,
        'FJ2571',
        'MASTDARM FJ2571',
        0xc68e62
    );

}


// ========================================
// AUFSTEIGENDER DICKDARM
// ========================================

export function createAufsteigenderDickdarm(scene) {

    loadAnatomyModel(
        scene,
        'FJ2566',
        'AUFSTEIGENDER DICKDARM FJ2566',
        0xc68e62
    );

}


// ========================================
// QUERDICKDARM
// ========================================

export function createQuerdickdarm(scene) {

    loadAnatomyModel(
        scene,
        'FJ2572',
        'QUERDICKDARM FJ2572',
        0xc68e62
    );

}


// ========================================
// ABSTEIGENDER DICKDARM
// ========================================

export function createAbsteigenderDickdarm(scene) {

    loadAnatomyModel(
        scene,
        'FJ2567',
        'ABSTEIGENDER DICKDARM FJ2567',
        0xc68e62
    );

}
// Linker Hauptbronchus
export function createLinkerHauptbronchus(scene) {
  loadAnatomyModel(
    scene,
    'FJ2450',
    'LINKER HAUPTBRONCHUS FMA7396',
    0x9b7770
  );
}

// Rechter Hauptbronchus
export function createRechterHauptbronchus(scene) {
  loadAnatomyModel(
    scene,
    'FJ2539',
    'RECHTER HAUPTBRONCHUS FMA68418',
    0x9b7770
  );
}

// Lungenstamm
export function createTruncusPulmonalis(scene) {
  loadAnatomyModel(
    scene,
    'FJ2966',
    'LUNGENSTAMM FMA8612',
    0x9e2929
  );
}

// Rechte Lungenarterie
export function createRechteLungenarterie(scene) {
  loadAnatomyModel(
    scene,
    'FJ3019',
    'RECHTE LUNGENARTERIE FMA50872',
    0xb83232
  );
}

// Linke Lungenarterie
export function createLinkeLungenarterie(scene) {
  loadAnatomyModel(
    scene,
    'FJ2924',
    'LINKE LUNGENARTERIE FMA50873',
    0xb83232
  );
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
