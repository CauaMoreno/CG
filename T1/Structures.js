import { setDefaultMaterial, createGroundPlaneXZ } from "../libs/util/util.js";
import * as THREE from  'three';

const materialAzul = setDefaultMaterial("blue");
const materialVermelho = setDefaultMaterial("red");

export function createWalls(scene) {
    const walls = [];
  for (let i = 0; i < 4; i++) {
    walls.push(new THREE.Mesh(new THREE.BoxGeometry(1, 4, 20), materialAzul));
  }
  //ajustar coordenadas
  walls[0].position.set(0, 2.5, -25);

  walls[1].position.set(0, 2.5, 25);
  walls[1].rotation.y = Math.PI;

  walls[2].position.set(-25, 2.5, 0);
  walls[2].rotation.y = Math.PI / 2;

  walls[3].position.set(25, 2.5, 15);
  walls[3].rotation.y = Math.PI / -2;
  walls.forEach((wall) => {
    scene.add(wall);
  });
}

export function createGround(scene) {
    let plane = createGroundPlaneXZ(20, 20) //ajustar tamanho do plano
    scene.add(plane);
}
