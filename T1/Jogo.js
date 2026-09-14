import * as THREE from  'three';
import { OrbitControls } from '../build/jsm/controls/OrbitControls.js';
import { PointerLockControls } from '../build/jsm/controls/PointerLockControls.js';
import {initRenderer, 
        initCamera,
        initDefaultBasicLight,
        setDefaultMaterial,
        InfoBox,
        onWindowResize} from "../libs/util/util.js";
import { createGround, createCastle } from "./Structures.js";
import { CollisionSystem } from "./CollisionSystem.js";

let scene, renderer, camera, material, light, controls, castle, walls; // Initial variables

// Scene, Camera, Renderer
scene = new THREE.Scene();    // Create main scene
renderer = initRenderer();    // Init a basic renderer
material = setDefaultMaterial(); // create a basic material
light = initDefaultBasicLight(scene); // Create a basic light to illuminate the scene

// Camera
camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 ); // mudar
camera.position.set( 2, 8, 20 );
camera.lookAt( 0, 0, 0 );
scene.add(camera); // Add camera to the scene

const collisionSystem = new CollisionSystem(camera, scene); // Create a collision system instance

controls = new PointerLockControls(camera, renderer.domElement);
renderer.domElement.addEventListener('click', function () {
    controls.lock();
});

// Movement variables

const speed = 10;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

window.addEventListener('keydown', function (event) {
    movementControls(event.keyCode, true);
});

window.addEventListener('keyup', function (event) {
    movementControls(event.keyCode, false);
});

function movementControls(key, value) {
    switch (key) {
        case 87: // W
            moveForward = value;
            break;
        case 83: // S
            moveBackward = value;
            break;
        case 65: // A
            moveLeft = value;
            break;
        case 68: // D
            moveRight = value;
            break;
}}

// Movement animation

function moveAnimate(delta) {
    const oldPosition = controls.object.position.clone();

    if(!controls.isLocked) return;

    if (moveForward) {
        controls.moveForward(speed * delta);
    }
    else if (moveBackward) {
        controls.moveForward(speed * -1 * delta);
    }

    if (moveRight) {
        controls.moveRight(speed * delta);
    }
    else if (moveLeft) {
        controls.moveRight(speed * -1 * delta);
    }

    // --- LÓGICA DE DESLIZAMENTO (SEPARAÇÃO DE EIXOS) ---
    
    // Salva a posição após a tentativa de movimento do PointerLockControls
    const targetPosition = controls.object.position.clone();

    // Teste 1: Tenta mover apenas no Eixo X
    controls.object.position.set(targetPosition.x, oldPosition.y, oldPosition.z);
    if (collisionSystem.checkWallCollision(controls.object.position, walls)) {
        controls.object.position.x = oldPosition.x; // Reverte X se bateu
    }

    // Teste 2: Tenta mover apenas no Eixo Z (mantendo o X que passou ou foi revertido)
    const intermediateX = controls.object.position.x;
    controls.object.position.set(intermediateX, oldPosition.y, targetPosition.z);
    if (collisionSystem.checkWallCollision(controls.object.position, walls)) {
        controls.object.position.z = oldPosition.z; // Reverte Z se bateu
    }
}

// Listen window size changes
window.addEventListener( 'resize', function(){onWindowResize(camera, renderer)}, false );

// Show axis (parameter is size of each axis)
let axesHelper = new THREE.AxesHelper( 12 );
scene.add( axesHelper );

createGround(scene);
castle = createCastle(scene);
walls = castle.walls;
// createTower(scene);

// Use this to show information onscreen
const clock = new THREE.Clock();
render();
function render()
{
  requestAnimationFrame(render);
  const delta = clock.getDelta();
  moveAnimate(delta);
  renderer.render(scene, camera); // Render scene
}
