import * as THREE from  'three';
import { OrbitControls } from '../build/jsm/controls/OrbitControls.js';
import {initRenderer, 
        initCamera,
        initDefaultBasicLight,
        setDefaultMaterial,
        InfoBox,
        onWindowResize,
        createGroundPlaneXZ} from "../libs/util/util.js";

let scene, renderer, camera, material, light, orbit; // Initial variables
scene = new THREE.Scene();    // Create main scene
renderer = initRenderer();    // Init a basic renderer
material = setDefaultMaterial(); // create a basic material
light = initDefaultBasicLight(scene); // Create a basic light to illuminate the scene
camera = initCamera(new THREE.Vector3(0, 15, 30)); // Init camera in this position
scene.add(camera); // Add camera to the scene
orbit = new OrbitControls( camera, renderer.domElement ); // Enable mouse rotation, pan, zoom etc.

// Listen window size changes
window.addEventListener( 'resize', function(){onWindowResize(camera, renderer)}, false );

// Show axes (parameter is size of each axis)
let axesHelper = new THREE.AxesHelper( 12 );
scene.add( axesHelper );

// create the ground plane
let plane = createGroundPlaneXZ(20, 20)
scene.add(plane);

// create a cube
let bolinhaGeometry = new THREE.SphereGeometry(0.5, 32, 16);

function cria_roda(geoBall, raio, qtd) {
  let invisivel = setDefaultMaterial()
  invisivel.visible = false

  let centro = new THREE.Mesh(geoBall, invisivel);
  centro.translateY(0.5);
  scene.add(centro);

  let angle = THREE.MathUtils.degToRad(360/qtd)

  for (let i = 0; i < qtd; i++) {
    let ball = new THREE.Mesh(geoBall, material);
    centro.add(ball)
    ball.translateX(Math.sin(angle*i)*raio)
    ball.translateZ(Math.cos(angle*i)*raio)
  }
}

cria_roda(bolinhaGeometry, 8, 12)


// Use this to show information onscreen
let controls = new InfoBox();
  controls.add("Basic Scene");
  controls.addParagraph();
  controls.add("Use mouse to interact:");
  controls.add("* Left button to rotate");
  controls.add("* Right button to translate (pan)");
  controls.add("* Scroll to zoom in/out.");
  controls.show();

render();
function render()
{
  requestAnimationFrame(render);
  renderer.render(scene, camera) // Render scene
}