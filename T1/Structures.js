import { setDefaultMaterial, createGroundPlaneXZ } from "../libs/util/util.js";
import * as THREE from "three";

// ============================================================
// MATERIAIS
// ============================================================
const materialMuralha = setDefaultMaterial("rgb(150,142,128)"); // pedra arenito (sandstone), tom do castelo real
const materialTorre = setDefaultMaterial("rgb(122,115,102)"); // pedra das torres, um pouco mais escura
const materialAmeia = setDefaultMaterial("rgb(160,152,138)"); // merlões (ameias) do topo das muralhas/torres
const materialMadeira = setDefaultMaterial("rgb(92,61,33)"); // madeira: escadas
const materialSeteira = setDefaultMaterial("rgb(15,15,15)"); // seteiras (aberturas escuras nas torres)

/**
 * Agrupa e organiza os meshes de uma construção (paredes, pisos e rampas)
 * dentro de um THREE.Group posicionado e rotacionado na cena.
 */
export class Structure {
  constructor(scene, position = new THREE.Vector3(0, 0, 0), rotation = 0) {
    this.scene = scene;
    this.position = position;
    this.rotation = rotation;
    this.walls = [];
    this.floors = [];
    this.ramps = [];
    this.decor = []

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
}

/**
 * Cria o modelo completo do Castelo de Bodiam: muralhas, torres de canto,
 * torre de entrada (gate house), torre sul, ameias, seteiras e o interior
 * com saguão, salas e escadas.
 */
export function createCastle(
  scene,
  position = new THREE.Vector3(0, 0, 0),
  rotation = 0,
) {
  const castle = new Structure(scene, position, rotation);

  // Dimensões gerais
  const wallHeight = 12;
  const wallThickness = 2.0;
  const castleWidth = 42; // Eixo X
  const castleDepth = 48; // Eixo Z

  const halfW = castleWidth / 2;
  const halfD = castleDepth / 2;

  // ==========================================================
  // HELPERS — Geometria básica (paredes e portas)
  // ==========================================================

  function createWallSegment(
    width,
    depth,
    height,
    posX,
    posZ,
    rotY = 0,
    mat = materialMuralha,
  ) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(posX, height / 2, posZ);
    mesh.rotation.y = rotY;
    castle.addWall(mesh);
    return mesh;
  }

  function createDoorColliders(
  wallHeight,
  thickness,
  wallSpanWidth, // largura do trecho de parede onde a porta está inserida
  doorWidth,
  doorHeight,
  posX,
  posZ,
  rotY = 0,
) {
  const sideWidth = (wallSpanWidth - doorWidth) / 2;

  const parts = [
    { dx: -(doorWidth / 2 + sideWidth / 2), w: sideWidth, h: wallHeight, dy: 0 }, // pilar esq.
    { dx: (doorWidth / 2 + sideWidth / 2), w: sideWidth, h: wallHeight, dy: 0 },  // pilar dir.
    { dx: 0, w: doorWidth, h: wallHeight - doorHeight, dy: doorHeight },         // verga
  ];

  for (const p of parts) {
    if (p.w <= 0.01) continue; // evita geometria inválida

    const worldX = posX + p.dx * Math.cos(rotY);
    const worldZ = posZ - p.dx * Math.sin(rotY);

    const geo = new THREE.BoxGeometry(p.w, p.h, thickness);
    const mat = new THREE.MeshBasicMaterial({ visible: false });
    const collider = new THREE.Mesh(geo, mat);
    collider.position.set(worldX, p.dy + p.h / 2, worldZ);
    collider.rotation.y = rotY;

    castle.addWall(collider); // entra na colisão como parede sólida normal
  }
}

  /** Parede reta com um único vão de porta em arco. */
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



  /** Parede reta com múltiplos vãos de porta em arco (não usada no momento, mantida para reaproveitamento). */
  function createWallWithDoors(
    wallWidth,
    wallHeight,
    thickness,
    doors,
    posX,
    posZ,
    rotY = 0,
    mat = materialMuralha,
    baseY = 0,
  ) {
    const shape = new THREE.Shape();
    const hw = wallWidth / 2;

    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    shape.lineTo(hw, wallHeight);
    shape.lineTo(-hw, wallHeight);
    shape.closePath();

    for (const door of doors) {
      const { offsetX = 0, width, height } = door;
      const hdw = width / 2;
      const straightHeight = height - hdw;

      const doorHole = new THREE.Path();
      doorHole.moveTo(offsetX - hdw, 0);
      doorHole.lineTo(offsetX + hdw, 0);
      doorHole.lineTo(offsetX + hdw, straightHeight);
      doorHole.absarc(offsetX, straightHeight, hdw, 0, Math.PI, false);
      doorHole.lineTo(offsetX - hdw, 0);
      doorHole.closePath();

      shape.holes.push(doorHole);
    }

    const extrudeSettings = { depth: thickness, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.translate(0, 0, -thickness / 2);

    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(posX, baseY, posZ);
    mesh.rotation.y = rotY;

    castle.addWall(mesh);
    return mesh;
  }

  // ==========================================================
  // HELPERS — Torres (ocas, formadas por segmentos de parede)
  // ==========================================================

  function createHollowRoundTower(
    radius,
    height,
    posX,
    posZ,
    segments = 8,
    t = 1.0,
    mat = materialTorre,
  ) {
    const angleStep = (Math.PI * 2) / segments;
    const segmentWidth = 2 * radius * Math.tan(angleStep / 2) + 0.2;

    for (let i = 0; i < segments; i++) {
      const angle = i * angleStep;
      const x = posX + Math.cos(angle) * radius;
      const z = posZ + Math.sin(angle) * radius;

      const geo = new THREE.BoxGeometry(segmentWidth, height, t);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, height / 2, z);
      mesh.rotation.y = -angle + Math.PI / 2;
      castle.addWall(mesh);
    }
  }

  function createHollowSquareTower(
    sizeX,
    sizeZ,
    height,
    posX,
    posZ,
    t = 1.0,
    mat = materialTorre,
  ) {
    const halfX = sizeX / 2;
    const halfZ = sizeZ / 2;
    const halfT = t / 2;

    createWallSegment(sizeX, t, height, posX, posZ - halfZ + halfT, 0, mat);
    createWallSegment(sizeX, t, height, posX, posZ + halfZ - halfT, 0, mat);
    createWallSegment(
      t,
      sizeZ - 2 * t,
      height,
      posX - halfX + halfT,
      posZ,
      0,
      mat,
    );
    createWallSegment(
      t,
      sizeZ - 2 * t,
      height,
      posX + halfX - halfT,
      posZ,
      0,
      mat,
    );
  }

  // ==========================================================
  // HELPERS — Escadas
  // ==========================================================

  /** Cria uma escada de degraus sólidos mais uma rampa invisível de colisão/navegação. */
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

    // Rampa invisível, alinhada à inclinação da escada, usada como
    // superfície plana de referência (ex.: para navegação/colisão)
    const extension = 0.1; // quanto a rampa ultrapassa os degraus em cada ponta
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
    // Empurra a rampa para baixo, fazendo-a passar um pouco do primeiro degrau
    ramp.position.z += (directionZ * extension) / 2;
    castle.addRamp(ramp);
  }

  /** Recorte (Path) do vão da escada no piso superior, para uso com ExtrudeGeometry. */
  function buildStairHole(stairX) {
    const hole = new THREE.Path();
    const holeXMin = stairX - stairWidth / 2 - 0.2;
    const holeXMax = stairX + stairWidth / 2 + 0.2;
    const holeZMin = stairStartZ - 0.3;
    const holeZMax = stairStartZ + stairDepth + 0.3;

    hole.moveTo(holeXMin, holeZMin);
    hole.lineTo(holeXMax, holeZMin);
    hole.lineTo(holeXMax, holeZMax);
    hole.lineTo(holeXMin, holeZMax);
    hole.closePath();
    return hole;
  }

  // ==========================================================
  // HELPERS — Ameias (merlões)
  // Aparecem apenas no topo das torres (redondas e quadradas);
  // as muralhas retas ficam com o topo liso.
  // ==========================================================

  function createBattlementsAlongX(
    length,
    posX,
    posZ,
    topY,
    mat = materialAmeia,
    merlonW = 0.9,
    merlonH = 0.6,
    gap = 0.9,
    merlonDepth = 1.0,
  ) {
    const step = merlonW + gap;
    const count = Math.max(1, Math.floor((length + gap) / step));
    const usedLength = count * step - gap;
    const startX = posX - usedLength / 2 + merlonW / 2;

    for (let i = 0; i < count; i++) {
      const x = startX + i * step;
      const geo = new THREE.BoxGeometry(merlonW, merlonH, merlonDepth);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, topY + merlonH / 2, posZ);
      castle.addWall(mesh);
    }
  }

  function createBattlementsAlongZ(
    length,
    posX,
    posZ,
    topY,
    mat = materialAmeia,
    merlonW = 0.9,
    merlonH = 0.6,
    gap = 0.9,
    merlonDepth = 1.0,
  ) {
    const step = merlonW + gap;
    const count = Math.max(1, Math.floor((length + gap) / step));
    const usedLength = count * step - gap;
    const startZ = posZ - usedLength / 2 + merlonW / 2;

    for (let i = 0; i < count; i++) {
      const z = startZ + i * step;
      const geo = new THREE.BoxGeometry(merlonDepth, merlonH, merlonW);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(posX, topY + merlonH / 2, z);
      castle.addWall(mesh);
    }
  }

  function createRoundBattlements(
    radius,
    posX,
    posZ,
    topY,
    segments = 16,
    mat = materialAmeia,
  ) {
    const angleStep = (Math.PI * 2) / segments;
    const merlonWidth = 2 * radius * Math.tan(angleStep / 2) * 0.85;

    for (let i = 0; i < segments; i += 2) {
      const angle = i * angleStep;
      const x = posX + Math.cos(angle) * radius;
      const z = posZ + Math.sin(angle) * radius;
      const geo = new THREE.BoxGeometry(merlonWidth, 0.6, 0.5);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, topY + 0.3, z);
      mesh.rotation.y = -angle + Math.PI / 2;
      castle.addWall(mesh);
    }
  }

  function createSquareBattlements(
    sizeX,
    sizeZ,
    topY,
    posX,
    posZ,
    mat = materialAmeia,
  ) {
    createBattlementsAlongX(sizeX, posX, posZ - sizeZ / 2, topY, mat);
    createBattlementsAlongX(sizeX, posX, posZ + sizeZ / 2, topY, mat);
    createBattlementsAlongZ(sizeZ, posX - sizeX / 2, posZ, topY, mat);
    createBattlementsAlongZ(sizeZ, posX + sizeX / 2, posZ, topY, mat);
  }

  // ==========================================================
  // HELPERS — Topos das torres (caps)
  // ==========================================================

  function createRoundCap(radius, topY, posX, posZ, mat = materialTorre) {
    const geo = new THREE.CylinderGeometry(radius, radius, 0.4, 16);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(posX, topY + 0.2, posZ);
    castle.addFloor(mesh);
  }

  function createSquareCap(
    sizeX,
    sizeZ,
    topY,
    posX,
    posZ,
    mat = materialTorre,
  ) {
    const geo = new THREE.BoxGeometry(sizeX, 0.4, sizeZ);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(posX, topY + 0.2, posZ);
    castle.addFloor(mesh);
  }

  // ==========================================================
  // HELPERS — Seteiras (arrow slits)
  // ==========================================================

  function createArrowSlit(posX, posZ, rotY, midY, mat = materialSeteira) {
    const geo = new THREE.BoxGeometry(0.3, 2.2, 0.3);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(posX, midY, posZ);
    mesh.rotation.y = rotY;
    castle.addWall(mesh);
  }

  function addRoundTowerSlits(
    radius,
    midY,
    posX,
    posZ,
    count = 4,
    mat = materialSeteira,
  ) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.PI / count;
      const x = posX + Math.cos(angle) * (radius + 0.1);
      const z = posZ + Math.sin(angle) * (radius + 0.1);
      createArrowSlit(x, z, -angle + Math.PI / 2, midY, mat);
    }
  }

  // ==========================================================
  // 1. TORRES CIRCULARES OCAS (CANTOS)
  // ==========================================================
  const cornerRadius = 4.5;
  const cornerHeight = 18.0;

  const corners = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [-halfW, halfD],
    [halfW, halfD],
  ];
  for (const [cx, cz] of corners) {
    createHollowRoundTower(cornerRadius, cornerHeight, cx, cz);
    createRoundBattlements(cornerRadius, cx, cz, cornerHeight);
    createRoundCap(cornerRadius, cornerHeight, cx, cz);
    addRoundTowerSlits(cornerRadius, cornerHeight * 0.55, cx, cz, 4);
  }

  // ==========================================================
  // 2. MURALHA OESTE
  // ==========================================================
  const westTowerSize = 6.0;
  const westTowerHeight = 15.0;

  {
    const posZ1 = -halfD / 2 + 1;
    const len1 = (castleDepth - westTowerSize) / 2 - cornerRadius;
    createWallSegment(wallThickness, len1, wallHeight, -halfW, posZ1);
  }

  createHollowSquareTower(
    westTowerSize,
    westTowerSize,
    westTowerHeight,
    -halfW,
    0,
  );
  createSquareBattlements(
    westTowerSize,
    westTowerSize,
    westTowerHeight,
    -halfW,
    0,
  );
  createSquareCap(westTowerSize, westTowerSize, westTowerHeight, -halfW, 0);

  {
    const posZ2 = halfD / 2 - 1;
    const len2 = (castleDepth - westTowerSize) / 2 - cornerRadius;
    createWallSegment(wallThickness, len2, wallHeight, -halfW, posZ2);
  }

  // ==========================================================
  // 3. MURALHA LESTE
  // ==========================================================
  const eastTowerSize = 6.0;
  const eastTowerHeight = 15.0;
  const offsetDistance = 3.5;

  createWallSegment(wallThickness, 8.0, wallHeight, halfW, -halfD + 8.5);

  createWallSegment(
    offsetDistance + wallThickness,
    wallThickness,
    wallHeight,
    halfW + offsetDistance / 2,
    -halfD + 12.5,
    0,
    materialMuralha,
  );

  createWallSegment(
    wallThickness,
    9.0,
    wallHeight,
    halfW + offsetDistance,
    -halfD + 17.0,
    0,
    materialMuralha,
  );

  createWallSegment(
    offsetDistance + wallThickness,
    wallThickness,
    wallHeight,
    halfW + offsetDistance / 2,
    -halfD + 21.5,
    0,
    materialMuralha,
  );

  createWallSegment(wallThickness, 5.0, wallHeight, halfW, -halfD + 24.0);

  createHollowSquareTower(
    eastTowerSize,
    eastTowerSize,
    eastTowerHeight,
    halfW,
    5.0,
  );
  createSquareBattlements(
    eastTowerSize,
    eastTowerSize,
    eastTowerHeight,
    halfW,
    5.0,
  );
  createSquareCap(eastTowerSize, eastTowerSize, eastTowerHeight, halfW, 5.0);

  createWallSegment(wallThickness, 12.0, wallHeight, halfW, halfD - 10.5);

  // ==========================================================
  // 4. FACHADA NORTE E ENTRADA PRINCIPAL (GATE HOUSE)
  // ==========================================================
  const gateTowerW = 5.0;
  const gateTowerD = 7.5;
  const gateTowerH = 17.0;
  const gateOpening = 5.0;
  const doorHeight = 5;

  const northSegmentLength =
    (castleWidth - (gateTowerW * 2 + gateOpening)) / 2 - cornerRadius;

  {
    const posX1 = -halfW + cornerRadius + northSegmentLength / 2;
    createWallSegment(
      northSegmentLength,
      wallThickness,
      wallHeight,
      posX1,
      -halfD,
    );
  }

  const gateTowerLeftX = -(gateOpening / 2 + gateTowerW / 2);
  createHollowSquareTower(
    gateTowerW,
    gateTowerD,
    gateTowerH,
    gateTowerLeftX,
    -halfD,
  );
  createSquareBattlements(
    gateTowerW,
    gateTowerD,
    gateTowerH,
    gateTowerLeftX,
    -halfD,
  );
  createSquareCap(gateTowerW, gateTowerD, gateTowerH, gateTowerLeftX, -halfD);
  createArrowSlit(
    gateTowerLeftX,
    -halfD - gateTowerD / 2 - 0.1,
    0,
    gateTowerH * 0.55,
  );

  createWallWithDoor(
    gateOpening,
    gateTowerH - 2,
    wallThickness,
    gateOpening - 1,
    doorHeight,
    0,
    -halfD,
    0,
    materialMuralha,
  );

  const gateTowerRightX = gateOpening / 2 + gateTowerW / 2;
  createHollowSquareTower(
    gateTowerW,
    gateTowerD,
    gateTowerH,
    gateTowerRightX,
    -halfD,
  );
  createSquareBattlements(
    gateTowerW,
    gateTowerD,
    gateTowerH,
    gateTowerRightX,
    -halfD,
  );
  createSquareCap(gateTowerW, gateTowerD, gateTowerH, gateTowerRightX, -halfD);
  createArrowSlit(
    gateTowerRightX,
    -halfD - gateTowerD / 2 - 0.1,
    0,
    gateTowerH * 0.55,
  );

  {
    const posX2 = halfW - cornerRadius - northSegmentLength / 2;
    createWallSegment(
      northSegmentLength,
      wallThickness,
      wallHeight,
      posX2,
      -halfD,
    );
  }

  // ==========================================================
  // 5. MURALHA SUL & TORRE
  // ==========================================================
  const southTowerW = 6.5;
  const southTowerD = 5.5;
  const southTowerH = 15.0;

  const southSegmentLength = (castleWidth - southTowerW) / 2 - cornerRadius;

  {
    const posX3 = -halfW + cornerRadius + southSegmentLength / 2;
    createWallSegment(
      southSegmentLength,
      wallThickness,
      wallHeight,
      posX3,
      halfD,
    );
  }

  createHollowSquareTower(southTowerW, southTowerD, southTowerH, 0, halfD);
  createSquareBattlements(southTowerW, southTowerD, southTowerH, 0, halfD);
  createSquareCap(southTowerW, southTowerD, southTowerH, 0, halfD);

  {
    const posX4 = halfW - cornerRadius - southSegmentLength / 2;
    createWallSegment(
      southSegmentLength,
      wallThickness,
      wallHeight,
      posX4,
      halfD,
    );
  }

  // ==========================================================
  // 6. INTERIOR: SAGUÃO, SALAS, PISO SUPERIOR E ESCADAS
  // ==========================================================

  const secondFloorHeight = 6.0; // altura do térreo / piso do andar superior
  const upperWallHeight = wallHeight - secondFloorHeight; // altura das salas do andar superior
  const floorThickness = 0.4;
  const innerHalfW = halfW - wallThickness; // 19.0
  const innerHalfD = halfD - wallThickness; // 22.0

  const hallDepth = 14.0;
  const hallSouthZ = -innerHalfD + hallDepth; // fim do saguão / início das salas
  const partitionThickness = 1.0;
  const interiorDoorWidth = 2.5;
  const interiorDoorHeight = 4.5;

  // Escadas: uma por sala, simétricas, posicionadas nos fundos de cada
  // sala, junto à muralha sul
  const stairWidth = 2.5;
  const stairDepth = 10.0;
  const numSteps = 32;
  const stairMargin = 2.0; // afastamento da muralha sul
  const stairStartZ = innerHalfD - stairDepth - stairMargin;

  const stairX_W = -innerHalfW + stairWidth / 2 + 1.5; // sala oeste
  const stairX_E = innerHalfW - stairWidth / 2 - 1.5; // sala leste

  return castle;
}

export function createGround(scene) {
  const plane = createGroundPlaneXZ(160, 160);
  scene.add(plane);
  return plane;
}