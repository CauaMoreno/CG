import * as THREE from  'three';
import {GLTFLoader} from '../build/jsm/loaders/GLTFLoader.js';
import GUI from '../libs/util/dat.gui.module.js'
import {initRenderer, 
        initDefaultBasicLight,
        onWindowResize,
        createGroundPlaneXZ} from "../libs/util/util.js";

let scene, renderer, camera, light; // Initial variables
scene = new THREE.Scene();    
renderer = initRenderer();    
light = initDefaultBasicLight(scene, true);
window.addEventListener( 'resize', function(){onWindowResize(camera, renderer)}, false );

// Camera
camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
   camera.position.set(0.0, 10.0, 25.0);
   // Para o exercício, a câmera deve estar na posição (0, 0, 0)
   camera.up.set( 0.0, 1.0, 0.0 );
   camera.lookAt(0.0, 0.0, 0.0);
scene.add(camera)

buildScene();
buildInterface();
render();

function render()
{
   requestAnimationFrame(render);
   renderer.render(scene, camera) // Render scene
}

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

function buildInterface()
{
  var controls = new function ()
  {
    this.movePosition1 = function(){
      camera.up.position.lerp(lerpConfig1.destination, lerpConfig1.alpha)
    };
    this.movePosition2 = function(){
      console.log("Este botão ainda não faz nada - 2");
    };
    this.movePosition3 = function(){
      console.log("Este botão ainda não faz nada - 3");
    };        
  };

  // GUI interface
  var gui = new GUI();
  gui.add(controls, 'movePosition1',true).name("Pos 1"); 
  gui.add(controls, 'movePosition2',true).name("Pos 2"); 
  gui.add(controls, 'movePosition3',true).name("Pos 3");     
}


// Aux functions
function buildScene()
{
   scene.add( createGroundPlaneXZ(30, 30) );

   // Load external objects  
   var loader = new GLTFLoader( );
   loader.load( '../assets/objects/woodenGoose.glb', function ( gltf ) {
      var obj = gltf.scene;
      obj.traverse( function ( child ) {
         if( child.isMesh ) child.castShadow = true;
         if( child.material ) child.material.side = THREE.DoubleSide;         
      });
      obj.scale.set(0.3, 0.3, 0.3);
      obj.rotateY( Math.PI / 2 );
      scene.add ( obj );
    });
}
