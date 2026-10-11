import * as THREE from  'three';
import GUI from '../libs/util/dat.gui.module.js'
import { OrbitControls } from '../build/jsm/controls/OrbitControls.js';
import {initRenderer, 
        setDefaultMaterial,
        initDefaultBasicLight,        
        onWindowResize, 
        createLightSphere} from "../libs/util/util.js";
import {loadLightPostScene} from "../libs/util/utilScenes.js";
import { AmbientLight } from '../build/three.core.js';

let scene, renderer, camera, orbit;
scene = new THREE.Scene();    // Create main scene
renderer = initRenderer();    // View function in util/utils
   renderer.setClearColor("rgb(30, 30, 42)");
camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
   camera.lookAt(0, 0, 0);
   camera.position.set(5, 5, 5);
   camera.up.set( 0, 1, 0 );
orbit = new OrbitControls( camera, renderer.domElement ); // Enable mouse rotation, pan, zoom etc.

// Listen window size changes
window.addEventListener( 'resize', function(){onWindowResize(camera, renderer)}, false );

// Show axes (parameter is size of each axis)
let axesHelper = new THREE.AxesHelper( 3 );
  axesHelper.visible = false;
scene.add( axesHelper );

// let dirPosition = new THREE.Vector3(2, 2, 4)
// const dirLight = new THREE.DirectionalLight('white', 0.2);
// dirLight.position.copy(dirPosit  ion);
//  //mainLight.castShadow = true;
// scene.add(dirLight);  

// Load default scene
loadLightPostScene(scene)

// Luz ambiente
let ambientColor = "rgb(255,255,255)"
let ambientLight = new THREE.AmbientLight(ambientColor, 0.2)
scene.add(ambientLight)

// Spotlight
let position = new THREE.Vector3(1.25, 3, 0);
let lightColor = "yellow"
let spotLight = new THREE.SpotLight(lightColor, 10.0);
    spotLight.position.copy(position);
    spotLight.castShadow = true;
    spotLight.intensity = 10
    spotLight.penumbra = 1.0
    spotLight.target.position.set(1.25,0,0)
scene.add(spotLight)
scene.add(spotLight.target)

//Cu
let cuGeo = new THREE.BoxGeometry(0.5, 1, 0.5)
let material = setDefaultMaterial()
let cu = new THREE.Mesh(cuGeo, material)
scene.add(cu)

//---------------------------------------------------------
// Load external objects
buildInterface();
render();

function buildInterface()
{
  // GUI interface
  let gui = new GUI();
}

function render()
{
  requestAnimationFrame(render);
  renderer.render(scene, camera)
}
