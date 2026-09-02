import * as THREE from  'three';
import { OrbitControls } from '../build/jsm/controls/OrbitControls.js';
import KeyboardState from '../libs/util/KeyboardState.js';
import {initRenderer, 
        initCamera,
        initDefaultBasicLight,
        setDefaultMaterial,
        InfoBox,
        SecondaryBox,        
        onWindowResize, 
        createGroundPlaneXZ} from "../libs/util/util.js";

let scene, renderer, camera, material, material2, light, orbit;; // Initial variables
scene = new THREE.Scene();    // Create main scene
renderer = initRenderer();    // Init a basic renderer
camera = initCamera(new THREE.Vector3(0, 15, 30)); // Init camera in this position
material = setDefaultMaterial(); // create a basic material
material2 = setDefaultMaterial("rgb(255,200,0)");
light = initDefaultBasicLight(scene); // Create a basic light to illuminate the scene
orbit = new OrbitControls( camera, renderer.domElement ); // Enable mouse rotation, pan, zoom etc.

let balls = [];
const ballSpeed = 0.3;

// Listen window size changes
window.addEventListener( 'resize', function(){onWindowResize(camera, renderer)}, false );

// Use to scale the cube
var scale = 1.0;

// Show text information onscreen
showInformation();

// To use the keyboard
var keyboard = new KeyboardState();

// Show axes (parameter is size of each axis)
var axesHelper = new THREE.AxesHelper( 12 );
scene.add( axesHelper );

// create the ground plane
let plane = createGroundPlaneXZ(20, 20)
scene.add(plane);

// create a cube
var cubeGeometry = new THREE.BoxGeometry(4, 4, 4);
var cube = new THREE.Mesh(cubeGeometry, material);
// position the cube
cube.position.set(0.0, 2.0, 0.0);
// add the cube to the scene
scene.add(cube);

var sphGeo = new THREE.SphereGeometry(1, 20, 20);
var sphere = new THREE.Mesh(sphGeo, material2);
   sphere.position.set(0, 0, 3);
cube.add(sphere);

var cubeAxesHelper = new THREE.AxesHelper(9);
cube.add(cubeAxesHelper);

var positionMessage = new SecondaryBox("");
positionMessage.changeStyle("rgba(0,0,0,0)", "lightgray", "16px", "ubuntu")
render();



function shootBall() {

   let worldPos = new THREE.Vector3();
   sphere.getWorldPosition(worldPos);

   let worldQuat = new THREE.Quaternion();
   cube.getWorldQuaternion(worldQuat);

   // cria uma nova esfera independente
   let newBall = new THREE.Mesh(sphGeo, material2);
   newBall.position.copy(worldPos);
   scene.add(newBall);

   // direção de disparo = eixo Z local do cubo, convertido para o mundo
   let direction = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat);

   balls.push({ mesh: newBall, dir: direction });
}

//-------------------------------------------------------------------------------
function render()
{
   for (let i = balls.length - 1; i >= 0; i--) {
      let b = balls[i];
      b.mesh.position.addScaledVector(b.dir, ballSpeed);

      // (opcional) remove bolinhas que já foram longe demais, pra não acumular infinito
      if (b.mesh.position.length() > 100) {
         scene.remove(b.mesh);
         balls.splice(i, 1);
      }
   }

   keyboardUpdate();
   requestAnimationFrame(render); // Show events
   renderer.render(scene, camera) // Render scene
}

//-- Aux functions --------------------------------------------------------------
function keyboardUpdate() 
{
   keyboard.update();
   let angle = THREE.MathUtils.degToRad(5); 
   if ( keyboard.pressed("left") )  cube.rotateY(  angle );
   if ( keyboard.pressed("right") )  cube.rotateY( -angle );
   if ( keyboard.pressed("up") )   cube.translateZ(  1 );
   if ( keyboard.pressed("down") ) cube.translateZ( -1 );

   if ( keyboard.down("space") ) 
   {
      shootBall();
   }
   updatePositionMessage();
}

function updatePositionMessage()
{
   let wp = new THREE.Vector3(); 
   sphere.getWorldPosition( wp );

   var str =  "Sphere Position: Local Space {" + sphere.position.x.toFixed(1) + ", " + sphere.position.y.toFixed(1) + ", " + sphere.position.z.toFixed(1) + "} " + 
             "| World Space {" + wp.x.toFixed(1) + ", " + wp.y.toFixed(1) + ", " + wp.z.toFixed(1) + "}";
   positionMessage.changeMessage(str);
}


function showInformation()
{
  // Use this to show information onscreen
  var controls = new InfoBox();
    controls.add("Animation - Attach");
    controls.addParagraph();
    controls.add("Use keyboard arrows to rotate/move the cube.");
    controls.add("Press 'space' to shoot the ball");
    controls.show();
}


