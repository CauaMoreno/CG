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
  const oldPosition = controls.object.position.clone();

  //movimento
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

  // colisoes na parede
  controls.object.position.set(targetPosition.x, oldPosition.y, oldPosition.z);
  if (collisionSystem.checkWallCollision(controls.object.position, walls)) {
    controls.object.position.x = oldPosition.x;
  }
  const intermediateX = controls.object.position.x;
  controls.object.position.set(intermediateX, oldPosition.y, targetPosition.z);
  if (collisionSystem.checkWallCollision(controls.object.position, walls)) {
    controls.object.position.z = oldPosition.z;
  }

 const movement = new THREE.Vector3(
        targetPosition.x - oldPosition.x,
        0,
        targetPosition.z - oldPosition.z
    );

    //verifica se esta na rampa
    //movimento muda pois desliza na rampa ao inves de cair com gravidade
    const ramp = collisionSystem.checkRamp(
        oldPosition,
        ramps
    );
    if (ramp !== null) {
        // Projeta o movimento do jogador
        // sobre a superfície da rampa
        const normal = ramp.normal;
        const projectedMovement =
            movement.clone().projectOnPlane(normal);
        controls.object.position.copy(oldPosition);
        controls.object.position.add(
            projectedMovement
        );
        // Mantém o jogador exatamente sobre a rampa
        const newRamp =
            collisionSystem.checkRamp(
                controls.object.position,
                ramps
            );

        if (newRamp !== null) {
            controls.object.position.y =
                newRamp.height;
            verticalVelocity = 0;
        }

    }
    else {
        // Colisão nas paredes
        controls.object.position.set(
            targetPosition.x,
            oldPosition.y,
            oldPosition.z
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


        const intermediateX =
            controls.object.position.x;

        controls.object.position.set(
            intermediateX,
            oldPosition.y,
            targetPosition.z
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

        // Gravidade normal
        verticalVelocity -= gravity * delta;

        controls.object.position.y +=
            verticalVelocity * delta;
        // Chão normal
        const groundHeight =
            collisionSystem.checkGround(
                controls.object.position,
                floors
            );

        if (
            groundHeight !== null &&
            controls.object.position.y <= groundHeight
        ) {

            controls.object.position.y =
                groundHeight;

            verticalVelocity = 0;
        }
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
