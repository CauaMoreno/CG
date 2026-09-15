import * as THREE from "three";
import { PointerLockControls } from "../build/jsm/controls/PointerLockControls.js";
import {
  initRenderer,
  initDefaultBasicLight,
  setDefaultMaterial,
  onWindowResize,
} from "../libs/util/util.js";
import { createGround, createCastle } from "./Structures.js";
import { CollisionSystem } from "./CollisionSystem.js";

let scene,
  renderer,
  camera,
  material,
  light,
  controls,
  castle,
  walls,
  floors,
  ramps,
  ground; // Initial variables
const gravity = 9.8; // Gravity constant
let verticalVelocity = 0; // Vertical velocity of the player
let isGrounded = false; // Flag to check if the player is on the ground
let currentRamp = null; // Current ramp the player is on
// Scene, Camera, Renderer
scene = new THREE.Scene(); // Create main scene
renderer = initRenderer(); // Init a basic renderer
material = setDefaultMaterial(); // create a basic material
light = initDefaultBasicLight(scene); // Create a basic light to illuminate the scene
// Camera
camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
); // mudar
camera.position.set(2, 50, 20);
camera.lookAt(0, 0, 0);
scene.add(camera); // Add camera to the scene
const collisionSystem = new CollisionSystem(camera, scene); // Create a collision system instance

controls = new PointerLockControls(camera, renderer.domElement);
renderer.domElement.addEventListener("click", function () {
  controls.lock();
});

// Movement variables

const speed = 10;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

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
  }
}

// Movement animation

function moveAnimate(delta) {

    // POSIÇÃO ANTERIOR
    const oldPosition = controls.object.position.clone();

    // MOVIMENTO HORIZONTAL
    if (moveForward) {
        controls.moveForward(speed * delta);
    }

    if (moveBackward) {
        controls.moveForward(-speed * delta);
    }

    if (moveRight) {
        controls.moveRight(speed * delta);
    }

    if (moveLeft) {
        controls.moveRight(-speed * delta);
    }


    const targetPosition = controls.object.position.clone();

    // Trata movimento em rampas, projetando o movimento no plano da rampa
    let movement = new THREE.Vector3(
        targetPosition.x - oldPosition.x,
        0,
        targetPosition.z - oldPosition.z
    );

    if (isGrounded && currentRamp !== null) {

        movement =
            movement
                .clone()
                .projectOnPlane(currentRamp.normal);

        controls.object.position.copy(oldPosition);

        controls.object.position.add(movement);
    }

    // Trata colisão com paredes
    const positionBeforeWallCollision = controls.object.position.clone();

    // Eixo X
    controls.object.position.set(
        positionBeforeWallCollision.x,
        oldPosition.y,
        positionBeforeWallCollision.z
    );

    if (
        collisionSystem.checkWallCollision(
            controls.object.position,
            walls
        )
    ) {
        controls.object.position.x =
            oldPosition.x;
    }


    // Eixo Z
    const xAfterCollision =
        controls.object.position.x;

    controls.object.position.set(
        xAfterCollision,
        oldPosition.y,
        positionBeforeWallCollision.z
    );

    if (
        collisionSystem.checkWallCollision(
            controls.object.position,
            walls
        )
    ) {
        controls.object.position.z =
            oldPosition.z;
    }

    // Procura o chão ou rampa mais próximo do jogador
    const groundHeight =
        collisionSystem.checkGround(
            controls.object.position,
            floors
        );

    const ramp =
        collisionSystem.checkRamp(
            controls.object.position,
            ramps
        );

    // Verifica se o jogador está no chão ou em uma rampa
    let surfaceHeight = null;
    let surfaceType = null;

    if (groundHeight !== null) {

        surfaceHeight = groundHeight;
        surfaceType = "ground";
    }

    if (
        ramp !== null &&
        (
            surfaceHeight === null ||
            ramp.height > surfaceHeight
        )
    ) {

        surfaceHeight = ramp.height;
        surfaceType = "ramp";
    }

    // Acompanha a altura da rampa se o jogador estiver sobre ela
    if (
        surfaceType === "ramp" &&
        isGrounded
    ) {

        controls.object.position.y =
            ramp.height;

        verticalVelocity = 0;

        currentRamp = ramp;

        return;
    }

    // Definição de velocidade vertical e gravidade
    verticalVelocity -=
        gravity * delta;

    controls.object.position.y +=
        verticalVelocity * delta;

    // Trata colisão com o chão ou rampa
    if (
        surfaceHeight !== null &&
        controls.object.position.y <= surfaceHeight &&
        verticalVelocity <= 0
    ) {

        controls.object.position.y =
            surfaceHeight;

        verticalVelocity = 0;

        isGrounded = true;

        if (surfaceType === "ramp") {
            currentRamp = ramp;
        }
        else {
            currentRamp = null;
        }

    }
    else {

        isGrounded = false;
        currentRamp = null;
    }
}

// Listen window size changes
window.addEventListener(
  "resize",
  function () {
    onWindowResize(camera, renderer);
  },
  false,
);

// Show axis (parameter is size of each axis)
let axesHelper = new THREE.AxesHelper(12);
scene.add(axesHelper);

ground = createGround(scene);
castle = createCastle(scene);
walls = castle.walls;
floors = castle.floors;
ramps = castle.ramps;
floors.push(ground); // Add ground to the floors array
// createTower(scene);

// Use this to show information onscreen
const clock = new THREE.Clock();
render();
function render() {
  requestAnimationFrame(render);
  const delta = clock.getDelta();
  moveAnimate(delta);
  renderer.render(scene, camera); // Render scene
}
