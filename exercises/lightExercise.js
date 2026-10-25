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

// Luz ambiente: bem fraca, só pra evitar breu total
let ambientLight = new THREE.AmbientLight("rgb(255,255,255)", 0.15);
scene.add(ambientLight);

// Luz direcional: suave, só pra dar leve volume às faces dos objetos
let dirPosition = new THREE.Vector3(2, 2, 0)
const dirLight = new THREE.DirectionalLight('white', 0.25);
dirLight.position.copy(dirPosition);
scene.add(dirLight);

let position = new THREE.Vector3(0.5, 2, 0)
let lightColor = "rgb(255,255,255)";


// Spotlight: cone com borda esfumada e sombra suave
let spotLight = new THREE.SpotLight(lightColor, 5);
spotLight.position.copy(position);
spotLight.angle = THREE.MathUtils.degToRad(40);
spotLight.penumbra = 1;      // 0 = borda dura, 1 = totalmente esfumada
spotLight.decay = 1;       // quanto a luz enfraquece com a distância
spotLight.distance = 0;      // 0 = alcance infinito
spotLight.castShadow = true;
spotLight.shadow.mapSize.set(2048, 2048);  // sombra com mais resolução
spotLight.shadow.radius = 4;               // suaviza a borda da sombra
spotLight.shadow.bias = -0.0005;           // evita artefatos na sombra
spotLight.target.position.set(2.5, 0, 0);
scene.add(spotLight.target);
scene.add(spotLight);
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


function createObject(geometry, color, x, y, z)
{
  let material = new THREE.MeshLambertMaterial({ color: color });
  let object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = true;      // projeta sombra (só o spotlight gera)
  object.receiveShadow = true;
  scene.add(object);
  return object;
}

// Caixas retangulares grandes (y = metade da altura, para apoiar no chão)
let redBox   = createObject(new THREE.BoxGeometry(0.8, 1.2, 0.8), "rgb(200, 20, 20)", 2.5, 0.6, -0.5);
let greenBox = createObject(new THREE.BoxGeometry(1, 1.5, 1),     "rgb(20, 140, 20)", 3, 0.75, 2);

// Cilindros (raio topo, raio base, altura, segmentos)
let yellowCylinder = createObject(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 32), "rgb(220, 200, 20)", 1.5, 0.6, -0.8);
let purpleCylinder = createObject(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 32), "rgb(140, 20, 140)", -3, 0.6, 2);   // fora da área do spotlight
scene.add(redBox);
scene.add(greenBox);
scene.add(yellowCylinder);
scene.add(purpleCylinder);
function buildInterface()
{
  // GUI interface
  let gui = new GUI();

  // Estado de cada luz (true = ligada)
  let controls = {
    ambiente: ambientLight.visible,
    direcional: dirLight.visible,
    spotlight: spotLight.visible
  };

  gui.add(controls, 'ambiente').name('Luz ambiente')
    .onChange(v => ambientLight.visible = v);

  gui.add(controls, 'direcional').name('Luz direcional')
    .onChange(v => dirLight.visible = v);

  gui.add(controls, 'spotlight').name('Spotlight')
    .onChange(v => spotLight.visible = v);

    // Posição do spotlight
  let posFolder = gui.addFolder('Spotlight: posição');
  posFolder.add(spotLight.position, 'x', -10, 10, 0.1).name('x');
  posFolder.add(spotLight.position, 'y', 0, 10, 0.1).name('y');
  posFolder.add(spotLight.position, 'z', -10, 10, 0.1).name('z');
  posFolder.open();

  // Posição do target do spotlight
  let targetFolder = gui.addFolder('Spotlight: target');
  targetFolder.add(spotLight.target.position, 'x', -10, 10, 0.1).name('x');
  targetFolder.add(spotLight.target.position, 'y', -2, 10, 0.1).name('y');
  targetFolder.add(spotLight.target.position, 'z', -10, 10, 0.1).name('z');
  targetFolder.open();

}


function render()
{
  requestAnimationFrame(render);
  renderer.render(scene, camera);
}
