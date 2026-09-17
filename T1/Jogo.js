import * as THREE from "three";
import { PointerLockControls } from "../build/jsm/controls/PointerLockControls.js";
import { OrbitControls } from '../build/jsm/controls/OrbitControls.js';
import {
  initRenderer,
  initDefaultBasicLight,
  setDefaultMaterial,
  onWindowResize,
} from "../libs/util/util.js";
import { createGround, createCastle } from "./Structures.js";
import { CollisionSystem } from "./CollisionSystem.js";

let scene, renderer, material, light;
let mode = 1;

let camera, camera1, camera2;
let controls, orbitControls, pointerControls;
const crosshair = document.getElementById("crosshair");

let castle, walls, floors, ramps, cylinders, ground;

const gravity = 9.8;
let verticalVelocity = 0;
let isGrounded = false;
let currentRamp = null;

// Inicialização da Cena e Renderizador
scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
renderer = initRenderer();
material = setDefaultMaterial();
light = initDefaultBasicLight(scene);

// Câmera 1 (Primeira Pessoa)
camera1 = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera1.position.set(0, 0, -50);
camera1.lookAt(new THREE.Vector3(0, 0, 0));

// Câmera 2 (Modo Espectador / Órbita)
camera2 = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera2.position.set(0, 50, 100);

// Configuração dos Controles
pointerControls = new PointerLockControls(camera1, renderer.domElement);
orbitControls = new OrbitControls(camera2, renderer.domElement);
orbitControls.enabled = false; // Desativado por padrão no modo 1

camera = camera1;
controls = pointerControls;

const collisionSystem = new CollisionSystem(camera1, scene);

// Só trava o ponteiro se o modo atual for o de primeira pessoa (Modo 1)
renderer.domElement.addEventListener("click", function () {
  if (mode === 1) {
    pointerControls.lock();
  }
});

// Controle de Movimentação
let speed = 10;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let running = false;

window.addEventListener("keydown", function (event) {
  movementControls(event.keyCode, true);
});

window.addEventListener("keyup", function (event) {
  movementControls(event.keyCode, false);
});

function movementControls(key, value) {
  switch (key) {
    case 87: // W
    case 38: // Seta para cima
      moveForward = value;
      break;

    case 83: // S
    case 40: // Seta para baixo
      moveBackward = value;
      break;

    case 65: // A
    case 37: // Seta para esquerda
      moveLeft = value;
      break;

    case 68: // D
    case 39: // Seta para direita
      moveRight = value;
      break;

    case 16: // Shift
      running = value;
      break;

    case 67: // Tecla C
      if (value) {
        if (mode === 2) {
          mode = 1;
          camera = camera1;
          controls = pointerControls;
          orbitControls.enabled = false;
          pointerControls.lock();
          crosshair.style.display = "block"; // Exibe a mira no modo 1
        } else {
          mode = 2;
          camera = camera2;
          controls = orbitControls;
          pointerControls.unlock();
          orbitControls.enabled = true;
          crosshair.style.display = "none"; // Oculta a mira no modo 2
        }

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      }
      break;
  }
}

function moveAnimate(delta) {
  if (mode !== 1) return;

  if (running) {
    speed = 20;
  } else {
    speed = 10;
  }

  const oldPosition = controls.object.position.clone();

  if (moveForward) controls.moveForward(speed * delta);
  if (moveBackward) controls.moveForward(-speed * delta);
  if (moveRight) controls.moveRight(speed * delta);
  if (moveLeft) controls.moveRight(-speed * delta);

  const targetPosition = controls.object.position.clone();

  let movement = new THREE.Vector3(
    targetPosition.x - oldPosition.x,
    0,
    targetPosition.z - oldPosition.z
  );

  if (isGrounded && currentRamp !== null) {
    movement = movement.clone().projectOnPlane(currentRamp.normal);
    controls.object.position.copy(oldPosition);
    controls.object.position.add(movement);
  }

  const cylinderResult = collisionSystem.checkCylinderCollision(
    controls.object.position,
    cylinders
  );
  controls.object.position.set(
    cylinderResult.position.x,
    oldPosition.y,
    cylinderResult.position.z
  );

  const targetPositionAfterCylinder = controls.object.position.clone();

  // Colisão Eixo X
  controls.object.position.set(
    targetPositionAfterCylinder.x,
    oldPosition.y,
    oldPosition.z
  );

  if (collisionSystem.checkWallCollision(controls.object.position, walls)) {
    controls.object.position.x = oldPosition.x;
  }

  // Colisão Eixo Z
  const xAfterCollision = controls.object.position.x;
  controls.object.position.set(
    xAfterCollision,
    oldPosition.y,
    targetPositionAfterCylinder.z
  );

  if (collisionSystem.checkWallCollision(controls.object.position, walls)) {
    controls.object.position.z = oldPosition.z;
  }

  const groundHeight = collisionSystem.checkGround(controls.object.position, floors);
  const ramp = collisionSystem.checkRamp(controls.object.position, ramps);

  let surfaceHeight = null;
  let surfaceType = null;

  if (groundHeight !== null) {
    surfaceHeight = groundHeight;
    surfaceType = "ground";
  }

  if (ramp !== null && (surfaceHeight === null || ramp.height > surfaceHeight)) {
    surfaceHeight = ramp.height;
    surfaceType = "ramp";
  }

  if (surfaceType === "ramp" && isGrounded) {
    controls.object.position.y = ramp.height;
    verticalVelocity = 0;
    currentRamp = ramp;
    return;
  }

  verticalVelocity -= gravity * delta;
  controls.object.position.y += verticalVelocity * delta;

  if (
    surfaceHeight !== null &&
    controls.object.position.y <= surfaceHeight &&
    verticalVelocity <= 0
  ) {
    controls.object.position.y = surfaceHeight;
    verticalVelocity = 0;
    isGrounded = true;
    currentRamp = surfaceType === "ramp" ? ramp : null;
  } else {
    isGrounded = false;
    currentRamp = null;
  }
}

// Redimensionamento de Janela
window.addEventListener(
  "resize",
  function () {
    onWindowResize(camera, renderer);
  },
  false
);

ground = createGround(scene);
castle = createCastle(scene);
walls = castle.walls;
floors = castle.floors;
ramps = castle.ramps;
cylinders = castle.cylinders;
floors.push(ground);

// Loop Único de Renderização
const clock = new THREE.Clock();

function render() {
  requestAnimationFrame(render);
  const delta = clock.getDelta();

  if (mode === 1) {
    moveAnimate(delta);
  } else if (mode === 2) {
    orbitControls.update();
  }

  renderer.render(scene, camera);
}

render();
