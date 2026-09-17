import { setDefaultMaterial, createGroundPlaneXZ } from "../libs/util/util.js";
import * as THREE from "three";

// ============================================================
// MATERIAIS
// ============================================================
const materialMuralha = setDefaultMaterial("rgb(150,142,128)");
const materialTorre = setDefaultMaterial("rgb(122,115,102)");
const materialMadeira = setDefaultMaterial("rgb(92,61,33)");
const materialSeteira = setDefaultMaterial("rgb(15,15,15)");

export class Structure {
  constructor(scene, position = new THREE.Vector3(0, 0, 0), rotation = 0) {
    this.scene = scene;
    this.position = position;
    this.rotation = rotation;
    this.walls = [];
    this.floors = [];
    this.ramps = [];
    this.decor = [];
    this.cylinders = [];

    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.rotation.y = rotation;
    this.scene.add(this.group);
  }

  addWall(wall) {
    this.walls.push(wall);
    this.group.add(wall);
  }

  addFloor(floor) {
    this.floors.push(floor);
    this.group.add(floor);
  }

  addRamp(ramp) {
    this.ramps.push(ramp);
    this.group.add(ramp);
  }

  addDecor(mesh) {
    this.decor.push(mesh);
    this.group.add(mesh);
  }

  addCylinderCollider(cylinder) {
    this.cylinders.push(cylinder);
  }
}

export function createCastle(
  scene,
  position = new THREE.Vector3(0, 0, 0),
  rotation = 0,
) {
  const castle = new Structure(scene, position, rotation);

  // Dimensões gerais
  const wallHeight = 12;
  const wallThickness = 1.0;
  const castleWidth = 42; // Eixo X
  const castleDepth = 48; // Eixo Z

  const sTowerSize = 10.0;
  const sTowerHeight = 15.0;

  const halfW = castleWidth / 2;
  const halfD = castleDepth / 2;

  function localToWorldXZ(localX, localZ) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    return {
      x: position.x + (localX * cos + localZ * sin),
      z: position.z + (-localX * sin + localZ * cos),
    };
  }

  // ==========================================================
  // FUNÇÕES AUXILIARES
  // ==========================================================

  function createWall(width, depth, height, posX, posZ, rotY = 0, mat = materialMuralha) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(posX, height / 2, posZ);
    mesh.rotation.y = rotY*(Math.PI / 180);

    // Adiciona ameias
    const ameiaHeight = 0.8;
    const ameiaDepth = 1.0;
    const ameiasQTD = Math.floor(width / 2);
    const gap = width / ameiasQTD;

    for (let i = 0; i < ameiasQTD; i++) {
      const x = -width/2 + (i + 0.5) * gap;
      const geoAmeia = new THREE.BoxGeometry(gap * 0.75, ameiaHeight, ameiaDepth);
      const meshAmeia = new THREE.Mesh(geoAmeia, mat);
      meshAmeia.position.set(x, (ameiaHeight + height)/2, 0);
      mesh.add(meshAmeia);
    }
      
    castle.addWall(mesh);
    return mesh;
  }

  function createInnerWall(width, depth, height, posX, posZ, rotY = 0, mat = materialMuralha) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(posX, height / 2, posZ);
    mesh.rotation.y = rotY*(Math.PI / 180);
  }


  function createDoorColliders(wallHeight, thickness, wallSpanWidth, doorWidth, doorHeight, posX, posZ, rotY = 0) {
    const sideWidth = (wallSpanWidth - doorWidth) / 2;

    const parts = [
      { dx: -(doorWidth / 2 + sideWidth / 2), w: sideWidth, h: wallHeight, dy: 0 },
      { dx: (doorWidth / 2 + sideWidth / 2), w: sideWidth, h: wallHeight, dy: 0 },
      { dx: 0, w: doorWidth, h: wallHeight - doorHeight, dy: doorHeight },
    ];

    for (const p of parts) {
      if (p.w <= 0.01) continue;

      const worldX = posX + p.dx * Math.cos(rotY);
      const worldZ = posZ - p.dx * Math.sin(rotY);

      const geo = new THREE.BoxGeometry(p.w, p.h, thickness);
      const mat = new THREE.MeshBasicMaterial({ visible: false });
      const collider = new THREE.Mesh(geo, mat);
      collider.position.set(worldX, p.dy + p.h / 2, worldZ);
      collider.rotation.y = rotY;

      castle.addWall(collider);
    }
  }

  function createWallWithDoor(
    wallWidth,
    wallHeight,
    thickness,
    doorWidth,
    doorHeight,
    posX,
    posZ,
    rotY = 0,
    mat = materialMuralha,
  ) {
    const shape = new THREE.Shape();
    const hw = wallWidth / 2;

    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    shape.lineTo(hw, wallHeight);
    shape.lineTo(-hw, wallHeight);
    shape.closePath();

    const doorHole = new THREE.Path();
    const hdw = doorWidth / 2;
    const straightHeight = doorHeight - hdw;

    doorHole.moveTo(-hdw, 0);
    doorHole.lineTo(hdw, 0);
    doorHole.lineTo(hdw, straightHeight);
    doorHole.absarc(0, straightHeight, hdw, 0, Math.PI, false);
    doorHole.lineTo(-hdw, 0);
    doorHole.closePath();

    shape.holes.push(doorHole);

    const extrudeSettings = { depth: thickness, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.translate(0, 0, -thickness / 2);

    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(posX, 0, posZ);
    mesh.rotation.y = rotY;

    castle.addDecor(mesh);

    createDoorColliders(
      wallHeight,
      thickness,
      wallWidth,
      doorWidth,
      doorHeight,
      posX,
      posZ,
      rotY,
    );
    return mesh;
  }

  function createRoundTower(
    outerRadius,
    height,
    posX,
    posZ,
    segments = 32,
    depth = 1.0,
    mat = materialTorre,
  ) {
    const innerRadius = outerRadius - depth;

    // Cria as paredes da torre
    const towerProfile = [
      new THREE.Vector2(outerRadius, 0),
      new THREE.Vector2(outerRadius, height),
      new THREE.Vector2(innerRadius, height),
      new THREE.Vector2(innerRadius, 0),
    ];

    const geo = new THREE.LatheGeometry(towerProfile, segments);
    const wall = new THREE.Mesh(geo, mat);
    wall.position.set(posX, 0, posZ);
    castle.addDecor(wall);

    // Cria o topo da torre
    const geoTop = new THREE.CylinderGeometry(outerRadius, outerRadius, depth, 16);
    const top = new THREE.Mesh(geoTop, mat);
    top.position.set(0, height, 0);
    castle.addFloor(top);
    wall.add(top);

    // Adiciona ameias
    const ameiaHeight = 0.8;
    const ameiaDepth = 1.0;
    const ameiasQTD = Math.floor((2 * Math.PI * outerRadius) / 2);
    const ameiaGap = (2 * Math.PI * outerRadius) / ameiasQTD;

    for (let i = 0; i < ameiasQTD; i++) {
      const angle = (i / ameiasQTD) * Math.PI * 2;
      const x = Math.cos(angle) * (outerRadius-0.65);
      const z = Math.sin(angle) * (outerRadius-0.65);

      const geoAmeia = new THREE.BoxGeometry(ameiaGap * 0.75, ameiaHeight, ameiaDepth);
      const meshAmeia = new THREE.Mesh(geoAmeia, mat);
      meshAmeia.position.set(x, ameiaHeight, z);
      meshAmeia.rotation.y = -angle + Math.PI / 2;
      top.add(meshAmeia);
    }

    const worldPos = localToWorldXZ(posX, posZ);
    castle.addCylinderCollider({
      x: worldPos.x,
      z: worldPos.z,
      outerRadius,
      height,
    });
  }

  function createSquareTower(
    sizeX,
    sizeZ,
    height,
    posX,
    posZ,
    depth = 1.0,
    mat = materialTorre,
  ) {
    const halfX = sizeX / 2;
    const halfZ = sizeZ / 2;
    const halfD = depth / 2;

    // Cria as quatro paredes da torre
    createWall(sizeX, depth, height, posX, posZ - halfZ + halfD, 0, mat);
    createWall(sizeX, depth, height, posX, posZ + halfZ - halfD, 0, mat);
    createWall(sizeZ, depth, height, posX + halfX - halfD, posZ, 90, mat);
    createWall(sizeZ, depth, height, posX - halfX + halfD, posZ, 90, mat);


    // Adiciona o topo da torre
    const topGeo = new THREE.BoxGeometry(sizeX, depth, sizeZ);
    const top = new THREE.Mesh(topGeo, mat);
    top.position.set(posX, height-depth, posZ);
    castle.addFloor(top);
  }

  function createStairs(
    width,
    totalHeight,
    totalDepth,
    numSteps,
    startX,
    startZ,
    directionZ = 1,
    mat = materialMadeira,
  ) {
    const stepHeight = totalHeight / numSteps;
    const stepDepth = totalDepth / numSteps;

    for (let i = 0; i < numSteps; i++) {
      const currentHeight = (i + 1) * stepHeight;
      const geo = new THREE.BoxGeometry(width, currentHeight, stepDepth);
      const mesh = new THREE.Mesh(geo, mat);

      const zPos = startZ + directionZ * (i * stepDepth + stepDepth / 2);
      const yPos = currentHeight / 2;

      mesh.position.set(startX, yPos, zPos);
      castle.addRamp(mesh);
    }

    const extension = 0.1;
    const angle = Math.atan2(totalHeight, totalDepth);
    const rampLength = Math.sqrt(
      totalDepth * totalDepth + totalHeight * totalHeight,
    );
    const rampLengthExtended = rampLength + extension * 2;
    const rampWidth = width;
    const rampThickness = 0.4;

    const rampMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    const rampGeometry = new THREE.BoxGeometry(
      rampWidth,
      rampThickness,
      rampLengthExtended,
    );

    const ramp = new THREE.Mesh(rampGeometry, rampMaterial);
    ramp.rotation.x = directionZ === 1 ? -angle : angle;
    ramp.position.x = startX;
    ramp.position.z = startZ + directionZ * (totalDepth / 2);
    ramp.position.y = totalHeight / 2 + 0.08;
    ramp.position.z += (directionZ * extension) / 2;
    castle.addRamp(ramp);
  }

  function createArrowSlit(posX, posZ, rotY, midY, mat = materialSeteira) {
    const geo = new THREE.BoxGeometry(0.3, 2.2, 0.3);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(posX, midY, posZ);
    mesh.rotation.y = rotY;
    castle.addWall(mesh);
  }

  function addRoundTowerSlits(radius, midY, posX, posZ, count = 4, mat = materialSeteira) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.PI / count;
      const x = posX + Math.cos(angle) * (radius + 0.1);
      const z = posZ + Math.sin(angle) * (radius + 0.1);
      createArrowSlit(x, z, -angle + Math.PI / 2, midY, mat);
    }
  }

  // ==========================================================
  // 1. TORRES CIRCULARES
  // ==========================================================
  const cornerRadius = 5;
  const cornerHeight = 18.0;

  const corners = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [-halfW, halfD],
    [halfW, halfD],
  ];
  for (const [cx, cz] of corners) {
    createRoundTower(cornerRadius, cornerHeight, cx, cz);
    addRoundTowerSlits(cornerRadius, cornerHeight * 0.55, cx, cz, 4);
  }

  // ==========================================================
  // 2. MURALHA OESTE
  // ==========================================================

  const posZ1 = -halfD/2;
  const width = (castleDepth - sTowerSize) / 2 - cornerRadius;
  createWall(width, wallThickness, wallHeight, -halfW, posZ1, 90);

  createSquareTower(
    sTowerSize,
    sTowerSize,
    sTowerHeight,
    -halfW,
    0,
  );

  const posZ2 = halfD/2;
  createWall(width, wallThickness, wallHeight, -halfW, posZ2, 90);

  // ==========================================================
  // 3. MURALHA LESTE
  // ==========================================================
  const offsetDistance = 3;

  createWall(8.0, wallThickness, wallHeight, halfW, -halfD + 8.5, 90);

  createWall(
    offsetDistance + wallThickness,
    wallThickness,
    wallHeight,
    halfW + offsetDistance / 2,
    -halfD + 12.5,
    0,
    materialMuralha,
  );

  createWall(
    12,
    wallThickness,
    wallHeight,
    halfW + offsetDistance,
    -halfD + 18.5,
    90,
    materialMuralha,
  );

  createSquareTower(
    sTowerSize,
    sTowerSize,
    sTowerHeight,
    halfW,
    5.0,
  );

  createWall(12.0, wallThickness, wallHeight, halfW, halfD - 10.5, 90);

  // ==========================================================
  // 4. FACHADA NORTE E ENTRADA PRINCIPAL
  // ==========================================================
  const gateTowerW = 7.5;
  const gateTowerD = 7.5;
  const gateTowerH = 17.0;
  const gateOpening = 5.0;
  const doorHeight = 5;

  const northSegmentLength = (castleWidth - (gateTowerW * 2 + gateOpening)) / 2 - cornerRadius;

  const posX1 = -halfW + cornerRadius + northSegmentLength / 2;
  createWall(
    northSegmentLength,
    wallThickness,
    wallHeight,
    posX1,
    -halfD,
  );

  const gateTowerLeftX = -(gateOpening / 2 + gateTowerW / 2);
  createSquareTower(
    gateTowerW,
    gateTowerD,
    gateTowerH,
    gateTowerLeftX,
    -halfD,
  );

  createArrowSlit(
    gateTowerLeftX,
    -halfD - gateTowerD / 2 - 0.1,
    0,
    gateTowerH * 0.55,
  );

  createWallWithDoor(
    gateOpening,
    gateTowerH - 2,
    wallThickness*3,
    gateOpening - 1,
    doorHeight,
    0,
    -halfD,
    0,
    materialMuralha,
  );

  const gateTowerRightX = gateOpening / 2 + gateTowerW / 2;
  createSquareTower(
    gateTowerW,
    gateTowerD,
    gateTowerH,
    gateTowerRightX,
    -halfD,
  );

  createArrowSlit(
    gateTowerRightX,
    -halfD - gateTowerD / 2 - 0.1,
    0,
    gateTowerH * 0.55,
  );


  const posX2 = halfW - cornerRadius - northSegmentLength / 2;
  createWall(
    northSegmentLength,
    wallThickness,
    wallHeight,
    posX2,
    -halfD,
  );


  // ==========================================================
  // 5. MURALHA SUL & TORRE
  // ==========================================================

  const southSegmentLength = (castleWidth - sTowerSize) / 2 - cornerRadius;


  const posX3 = -halfW + cornerRadius + southSegmentLength / 2;
  createWall(
    southSegmentLength,
    wallThickness,
    wallHeight,
    posX3,
    halfD,
  );


  createSquareTower(sTowerSize, sTowerSize, sTowerHeight, 0, halfD);

  const posX4 = halfW - cornerRadius - southSegmentLength / 2;
  createWall(
    southSegmentLength,
    wallThickness,
    wallHeight,
    posX4,
    halfD,
  );

  return castle;
}

export function createGround(scene) {
  const plane = createGroundPlaneXZ(500, 500);
  scene.add(plane);
  return plane;
}