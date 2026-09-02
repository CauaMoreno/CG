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
let tampoGeometry = new THREE.BoxGeometry(11, 0.3, 6);
let tampo = new THREE.Mesh(tampoGeometry, material);
tampo.position.set(0.0, 2.9, 0.0);
scene.add(tampo);

let peGeometry = new THREE.CylinderGeometry(0.2, 0.2, 3);


function cria_pe(tampo_mesa, geo_pe, x, y, z) {
  let pe = new THREE.Mesh(geo_pe, material);
  pe.position.set(x, y, z);
  tampo_mesa.add(pe);
}

cria_pe(tampo, peGeometry, 5, -1.5, 2.5)
cria_pe(tampo, peGeometry, 5, -1.5, -2.5)
cria_pe(tampo, peGeometry, -5, -1.5, -2.5)
cria_pe(tampo, peGeometry, -5, -1.5, 2.5)

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