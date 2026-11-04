
import * as THREE from 'three';

export function createLights(scene) {

    // Umgebungslicht
    const hemisphereLight = new THREE.HemisphereLight(
        0xffffff,
        0x888888,
        1.2
    );

    scene.add(hemisphereLight);

    // Gerichtetes Licht
    const directionalLight = new THREE.DirectionalLight(
        0xffffff,
        2
    );

    directionalLight.position.set(-20, 30, 30);
    directionalLight.castShadow = true;

    directionalLight.shadow.mapSize.set(2048, 2048);

    scene.add(directionalLight);
}
