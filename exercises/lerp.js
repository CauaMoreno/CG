import * as THREE from  'three';
import { OrbitControls } from '../build/jsm/controls/OrbitControls.js';
import GUI from '../libs/util/dat.gui.module.js'
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
let ballGeometry = new THREE.SphereGeometry(0.75, 32, 16);

const lerpConfig1 = {
  destination: new THREE.Vector3(8.0, 1.0, 5.0),
  alpha: 0.02,
  move: true
}

const lerpConfig2 = {
  destination: new THREE.Vector3(8.0, 1.0, -5.0),
  alpha: 0.01,
  move: true
}

let bola1 = new THREE.Mesh(ballGeometry, material);
bola1.position.set(-8.0, 1.0, 5.0);
scene.add(bola1);
let animationOn1 = false

let bola2 = new THREE.Mesh(ballGeometry, material);
bola2.position.set(-8.0, 1.0, -5.0);
scene.add(bola2);
let animationOn2 = false


function buildInterface()
{
  var controls = new function ()
  {
    this.moveBall1 = function(){
      animationOn1 = !animationOn1;
    };
    this.moveBall2 = function(){
      animationOn2 = !animationOn2;
    };
    this.reset = function(){
      animationOn1 = false
      animationOn2 = false
      bola1.position.set(-8.0, 1.0, 5.0);
      bola2.position.set(-8.0, 1.0, -5.0);
    }


  };

  // GUI interface
  var gui = new GUI();
  gui.add(controls, 'moveBall1',true).name("Esfera 1");
  gui.add(controls, 'moveBall2',true).name("Esfera 2");
  gui.add(controls, 'reset',true).name("Reset");
}


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
buildInterface();

function render()
{
  if(animationOn1) {
    bola1.position.lerp(lerpConfig1.destination, lerpConfig1.alpha)
  }
  if(animationOn2)
    bola2.position.lerp(lerpConfig2.destination, lerpConfig2.alpha)

  requestAnimationFrame(render);
  renderer.render(scene, camera) // Render scene
}