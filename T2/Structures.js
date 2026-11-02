import { CSG } from "../libs/other/CSGMesh.js";
import * as THREE from "three";

// ============================================================
// MATERIAIS
// ============================================================

  const materialMuralha = new THREE.MeshLambertMaterial({ color: "gray" });
  const materialTorre = new THREE.MeshLambertMaterial({ color: "dimgray" });
  const materialMadeira = new THREE.MeshLambertMaterial({ color: "brown" });
  const materialAltar = new THREE.MeshLambertMaterial({ color: "darkred" });
  const materialGrama = new THREE.MeshLambertMaterial({ color: "green" });
  const materialAgua = new THREE.MeshLambertMaterial({ color: "lightblue" });
  const materialInvisivel = new THREE.MeshBasicMaterial({ visible: false });

// ============================================================
// CONSTANTES
// ============================================================

const toRad = THREE.MathUtils.degToRad;

const AMEIAS = { height: 0.8, depth: 1.0, spacing: 2, fill: 0.75 };

const CORNER_SLITS = [
  { altura: 0.2, posicoes: [90, 150, 280] },
  { altura: 0.5, posicoes: [90, 230] },
  { altura: 0.8, posicoes: [150, 280] },
];

const SLIT = { W: 0.5, H: 1.8 };

// ============================================================
// ESTRUTURA
// ============================================================

export class Structure {
  constructor(scene, position = new THREE.Vector3(0, 0, 0), rotation = 0) {
    this.scene = scene;
    this.position = position;
    this.rotation = rotation;

    this.walls = [];
    this.floors = [];
    this.ramps = [];
    this.decor = [];
    this.doors = [];
    this.altarObjects = [];

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

  addDoor(pivots, { triggerDistance = 6, openSpeed = Math.PI * 0.8 } = {}) {
    const door = {
      pivots: pivots.map(({ group, openAngle }) => ({
        group,
        closedAngle: 0,
        openAngle,
      })),
      triggerDistance,
      openSpeed,
      isOpen: false,
    };

    this.doors.push(door);
    return door;
  }

  remove(object) {
    for (const list of [this.walls, this.floors, this.ramps, this.decor]) {
      const i = list.indexOf(object);
      if (i !== -1) list.splice(i, 1);
    }
    this.group.remove(object);
  }
}

// ============================================================
// GEOMETRIA AUXILIAR
// ============================================================

// Criador de malhas para CSG
function csgOperand(geometry, x, y, z, rotX = 0, rotY = 0) {
  const mesh = new THREE.Mesh(geometry);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rotX, rotY, 0);
  mesh.updateMatrix();
  return mesh;
}

// Criador de 'arco pleno' (Retângilo + Semicírculo)
function semicircularArch(width, height, thickness, posX = 0, posZ = 0, segments = 32) {
  const radius = width / 2;
  const straightHeight = height - radius;

  const rect = csgOperand(
    new THREE.BoxGeometry(width, straightHeight, thickness),
    posX,
    straightHeight / 2,
    posZ,
  );
  const arch = csgOperand(
    new THREE.CylinderGeometry(radius, radius, thickness, segments),
    posX,
    straightHeight,
    posZ,
    Math.PI / 2,
  );

  return CSG.fromMesh(rect).union(CSG.fromMesh(arch));
}

// Criador de ameias retas (adiciona direto no pai)
function addStraightBattlements(parent, width, baseY, mat) {
  const count = Math.max(1, Math.floor(width / AMEIAS.spacing));
  const gap = width / count;
  const geo = new THREE.BoxGeometry(
    gap * AMEIAS.fill,
    AMEIAS.height,
    AMEIAS.depth,
  );

  for (let i = 0; i < count; i++) {
    const merlao = new THREE.Mesh(geo, mat);
    merlao.position.set(
      -width / 2 + (i + 0.5) * gap,
      baseY + AMEIAS.height / 2,
      0,
    );
    parent.add(merlao);
  }
}

// Criador de ameias circulares (adiciona direto no pai)
function addRoundBattlements(towerMesh, radius, height, mat) {
  const inset = 0.65;
  const perimeter = 2 * Math.PI * radius;
  const count = Math.floor(perimeter / AMEIAS.spacing);
  const geo = new THREE.BoxGeometry(
    (perimeter / count) * AMEIAS.fill,
    AMEIAS.height,
    AMEIAS.depth,
  );

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const merlao = new THREE.Mesh(geo, mat);
    merlao.position.set(
      Math.cos(angle) * (radius - inset),
      height / 2 + AMEIAS.height / 2,
      Math.sin(angle) * (radius - inset),
    );
    merlao.rotation.y = Math.PI / 2 - angle;
    towerMesh.add(merlao);
  }
}

// Criador de seteiras
function slitCutter(width, height, depth, x, y, z, radius, theta) {
    const slitMesh = CSG.toMesh(
      semicircularArch(width, height, depth, 0, 0, 8),
      new THREE.Matrix4(),
      materialInvisivel
    );

  return csgOperand(
    slitMesh.geometry,
    x + radius * Math.sin(theta),
    y,
    z + radius * Math.cos(theta),
    0,
    theta,
  );
}

// Criador de passagens entre muralhas e torres
function passageCutter(
  { dir: [dx, dz], offset = 0, width, height, y },
  radius,
  wallDepth,
  x,
  z,
) {
  const alongX = dx !== 0;
  const reach = radius - wallDepth * 1.5;
  const cutDepth = wallDepth * 5;

  return csgOperand(
    new THREE.BoxGeometry(
      alongX ? cutDepth : width,
      height,
      alongX ? width : cutDepth,
    ),
    x + dx * reach + (alongX ? 0 : offset),
    y + height / 2,
    z + dz * reach + (alongX ? offset : 0),
  );
}

// Conversor de ângulo relativo ao canto do castelo para ângulo absoluto (graus)
function centerRelativeToAbsolute(cx, cz, graus) {
  const ix = -Math.sign(cx);
  const iz = -Math.sign(cz);
  const ang = Math.PI / 4 - toRad(graus);

  const dx = Math.cos(ang) * ix;
  const dz = Math.sin(ang) * iz;
  return (Math.atan2(dx, dz) * 180) / Math.PI;
}

// ============================================================
// CASTELO
// ============================================================

export function createCastle(
  scene,
  position = new THREE.Vector3(0, 0, 0),
  rotation = 0,
) {
  const castle = new Structure(scene, position, rotation);

  // Dimensões gerais
  const wallHeight = 20;
  const wallThickness = 1.0;
  const castleWidth = 70;
  const castleDepth = 80;

  const towerHeight = 30;
  const cornerRadius = 7;
  const sTowerSize = castleDepth / 6; // torres quadradas
  const offset = sTowerSize / 2;

  const platformHeight = 1.0;
  const platformDepth = sTowerSize / 3;
  const platformY = wallHeight - 2;
  const innerWallHeight = platformY - platformHeight / 2;

  const halfW = castleWidth / 2;
  const halfD = castleDepth / 2;

  // ==========================================================
  // FUNÇÕES AUXILIARES PARA CRIAÇÃO DE PAREDES
  // ==========================================================

  // Criador de paredes
  function createWall(
    width,
    depth,
    height,
    posX,
    posZ,
    rotY = 0,
    mat = materialMuralha,
    addAmeias = true,
    slits = [],
  ) {
    let mesh;

    if (slits.length === 0) {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
      mesh.position.set(posX, height / 2, posZ);
    } else {
      const base = csgOperand(
        new THREE.BoxGeometry(width, height, depth),
        posX,
        height / 2,
        posZ,
      );
      let wallCSG = CSG.fromMesh(base);

      for (const { altura, posicoes } of slits) {
        for (const pos of posicoes) {
          const cutter = slitCutter(
            SLIT.W,
            SLIT.H,
            depth * 3,
            posX + (pos - 0.5) * width,
            height * altura,
            posZ,
            0,
            0,
          );
          wallCSG = wallCSG.subtract(CSG.fromMesh(cutter));
        }
      }

      mesh = CSG.toMesh(wallCSG, base.matrix, mat);
    }

    mesh.rotation.y = toRad(rotY);

    if (addAmeias) addStraightBattlements(mesh, width, height / 2, mat);

    castle.addWall(mesh);
  }

  // Criador de parede com portal
  function createWallWithPortal(
    wallW,
    thickness,
    wallH,
    doorW,
    doorH,
    posX,
    posZ,
    rotY = 0,
    mat = materialMuralha,
    addAmeias = true,
  ) {
    const wallMesh = csgOperand(
      new THREE.BoxGeometry(wallW, wallH, thickness),
      posX,
      wallH / 2,
      posZ,
    );
    const wallCSG = CSG.fromMesh(wallMesh).subtract(
      semicircularArch(doorW, doorH, thickness, posX, posZ),
    );

    const wall = CSG.toMesh(wallCSG, wallMesh.matrix, mat);
    wall.rotateY(toRad(rotY));
    castle.addWall(wall);

    if (addAmeias) {
      const ameias = new THREE.Group();
      ameias.position.set(posX, wallH, posZ);
      ameias.rotation.y = toRad(rotY);
      addStraightBattlements(ameias, wallW, 0, mat);
      castle.addDecor(ameias);
    }
  }

  // Criador de parede interna com porta
  function createInnerDoorway(wallW, thickness, posX, posZ, rotY) {
    createWallWithPortal(
      wallW,
      thickness,
      innerWallHeight,
      3,
      5,
      posX,
      posZ,
      rotY,
      materialMuralha,
      false,
    );
    createSimpleDoor(3, 5, 0.3, posX, posZ, rotY, materialMadeira, Math.PI / 2);
  }

  // Criador de parede com janela
  function createWallWithWindow(
    width,
    depth,
    height,
    winW,
    winH,
    winX,
    winY,
    posX,
    posY,
    posZ,
    rotY = 0,
    mat = materialMuralha,
  ) {
    const wallMesh = csgOperand(
      new THREE.BoxGeometry(width, height, depth),
      posX,
      posY + height / 2,
      posZ,
    );

    // O corte é mais fundo que a parede para não deixar faces coplanares
    const windowMesh = csgOperand(
      new THREE.BoxGeometry(winW, winH, depth * 2),
      posX + winX,
      posY + winY + winH / 2,
      posZ,
    );

    const wallCSG = CSG.fromMesh(wallMesh).subtract(CSG.fromMesh(windowMesh));

    const wall = CSG.toMesh(wallCSG, wallMesh.matrix, mat);
    wall.rotateY(toRad(rotY));
    castle.addWall(wall);
  }

  // Criador de parede com dois andares de janelas
  function createDoubleWindowedWall(width, winW, posX, posZ, rotY = 0) {
    for (const posY of [0, innerWallHeight / 2]) {
      createWallWithWindow(
        width,
        wallThickness,
        innerWallHeight / 2,
        winW,
        3,
        0,
        1.5,
        posX,
        posY,
        posZ,
        rotY,
      );
    }
  }

  // ==========================================================
  // FUNÇÕES AUXILIARES PARA CRIAÇÃO DE PISOS E ESCADAS
  // ==========================================================

  // Criador de pisos (plataformas, passarelas, tetos)
  function createFloor(
    width,
    depth,
    height,
    posX,
    posY,
    posZ,
    rotY = 0,
    mat = materialMadeira,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
    mesh.position.set(posX, posY, posZ);
    mesh.rotation.y = toRad(rotY);

    castle.addFloor(mesh);

    return mesh;
  }

  // Criador de piso circular
  function createRoundFloor({
    radius,
    x,
    y,
    z,
    start,
    length = Math.PI / 2,
    height = platformHeight,
    segments = 32,
    mat = materialMadeira,
  }) {
    const geo = new THREE.CylinderGeometry(
      radius,
      radius,
      height,
      segments,
      1,
      false,
      start,
      length,
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    castle.addFloor(mesh);
  }

  // Criador de escadas
  function createStairs(
    width,
    totalHeight,
    totalDepth,
    numSteps,
    startX,
    startY,
    startZ,
    directionZ = 1,
    mat = materialMadeira,
    closeBack = true, // false se o topo da escada se conecta a um piso/passarela
  ) {
    const stepHeight = totalHeight / numSteps;
    const stepDepth = totalDepth / numSteps;

    const sideThickness = 0.01; // paredes invisíveis laterais e traseira
    const railHeight = 0.9;
    const railSize = 0.1;

    const slopeAngle = Math.atan2(totalHeight, totalDepth);
    const slopeLength = Math.hypot(totalDepth, totalHeight);
    const tilt = directionZ === 1 ? -slopeAngle : slopeAngle;

    const stepZ = (i) => startZ + directionZ * (i * stepDepth + stepDepth / 2);

    // Degraus + paredes laterais invisíveis
    for (let i = 0; i < numSteps; i++) {
      const currentHeight = (i + 1) * stepHeight;
      const zPos = stepZ(i);

      const step = new THREE.Mesh(
        new THREE.BoxGeometry(width, currentHeight, stepDepth),
        mat,
      );
      step.position.set(startX, startY + currentHeight / 2, zPos);
      castle.addDecor(step);

      const sideHeight = currentHeight + railHeight;
      const sideGeo = new THREE.BoxGeometry(sideThickness, sideHeight, stepDepth);
      const sideOffset = width / 2 + sideThickness / 2;

      for (const side of [-1, 1]) {
        const sideWall = new THREE.Mesh(sideGeo, materialInvisivel);
        sideWall.position.set(
          startX + side * sideOffset,
          startY + sideHeight / 2,
          zPos,
        );
        castle.addWall(sideWall);
      }
    }

    // Parede invisível no fim da escada
    if (closeBack) {
      const backHeight = totalHeight - 0.3;
      const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(width + sideThickness * 2, backHeight, sideThickness),
        materialInvisivel,
      );
      backWall.position.set(
        startX,
        startY + backHeight / 2,
        startZ + directionZ * (totalDepth + sideThickness / 2),
      );
      castle.addWall(backWall);
    }

    // Corrimãos
    const postGeo = new THREE.BoxGeometry(railSize, railHeight, railSize);
    const barGeo = new THREE.BoxGeometry(railSize, railSize, slopeLength);
    const railX = width / 2 - railSize / 2;

    for (const side of [-1, 1]) {
      const x = startX + side * railX;

      for (let i = 0; i < numSteps; i++) {
        if (i % 2 !== 0 && i !== numSteps - 1) continue;

        const post = new THREE.Mesh(postGeo, mat);
        post.position.set(
          x,
          startY + (i + 1) * stepHeight + railHeight / 2,
          stepZ(i),
        );
        castle.addDecor(post);
      }

      const bar = new THREE.Mesh(barGeo, mat);
      bar.rotation.x = tilt;
      bar.position.set(
        x,
        startY + totalHeight / 2 + stepHeight / 2 + railHeight,
        startZ + directionZ * (totalDepth / 2),
      );
      castle.addDecor(bar);
    }

    // Rampa invisível por onde o jogador sobe (folga só nas pontas)
    const extension = 0.1;
    const rampThickness = 0.4;
    const rampCenter = slopeLength / 2;

    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(width, rampThickness, slopeLength + 2 * extension),
      materialInvisivel,
    );
    ramp.rotation.x = tilt;
    ramp.position.set(
      startX,
      startY + rampCenter * Math.sin(slopeAngle) + 0.08,
      startZ + directionZ * rampCenter * Math.cos(slopeAngle),
    );
    castle.addRamp(ramp);
  }

  // ==========================================================
  // FUNÇÕES AUXILIARES PARA CRIAÇÃO DE PORTAS
  // ==========================================================

  // Criador de porta de uma folha
  function createSimpleDoor(
    width,
    height,
    thickness,
    posX,
    posZ,
    rotY = 0,
    mat = materialMadeira,
    openAngle = -Math.PI / 2,
  ) {
    const halfWidth = width / 2;

    const doorMesh = CSG.toMesh(
      semicircularArch(width, height, thickness),
      new THREE.Matrix4(),
      mat,
    );
    doorMesh.geometry.translate(halfWidth, 0, 0);

    const pivot = new THREE.Group();
    pivot.position.set(-halfWidth, 0, 0);
    pivot.add(doorMesh);

    const group = new THREE.Group();
    group.position.set(posX, 0, posZ);
    group.rotation.y = toRad(rotY);
    group.add(pivot);

    castle.addDoor([{ group: pivot, openAngle }]);
    castle.addDecor(group);
  }

  // Criador de porta com duas folhas
  function createDoubleDoor(
    width,
    height,
    thickness,
    posX,
    posZ,
    rotY = 0,
    mat = materialMadeira,
  ) {
    const halfWidth = width / 2;
    const body = semicircularArch(width, height, thickness);

    // Criador de folhas para porta central
    function makeLeaf(side) {
      const half = csgOperand(
        new THREE.BoxGeometry(halfWidth, height * 2, thickness * 2),
        (side * halfWidth) / 2,
        height,
        0,
      );

      const folha = CSG.toMesh(
        body.intersect(CSG.fromMesh(half)),
        new THREE.Matrix4(),
        mat,
      );
      folha.geometry.translate(-side * halfWidth, 0, 0);
      return folha;
    }

    const leftPivot = new THREE.Group();
    leftPivot.position.set(posX - halfWidth, 0, posZ);
    leftPivot.add(makeLeaf(-1));

    const rightPivot = new THREE.Group();
    rightPivot.position.set(posX + halfWidth, 0, posZ);
    rightPivot.add(makeLeaf(1));

    const group = new THREE.Group();
    group.add(leftPivot, rightPivot);
    group.rotation.y = toRad(rotY);

    castle.addDoor([
      { group: leftPivot, openAngle: -Math.PI / 2 },
      { group: rightPivot, openAngle: Math.PI / 2 },
    ]);
    castle.addDecor(group);
  }

  // ==========================================================
  // FUNÇÕES AUXILIARES PARA CRIAÇÃO DE TORRES
  // ==========================================================

  // Criador de torre quadrada
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
    const halfT = depth / 2;

    createWall(sizeX, depth, height, posX, posZ - halfZ + halfT, 0, mat, true, 
      [{altura: 0.2, posicoes: [0.5]}, {altura: 0.5, posicoes: [0.5]}, {altura: 0.7, posicoes: [0.5]}]);
    createWall(sizeX, depth, height, posX, posZ + halfZ - halfT, 0, mat, true, 
      [{altura: 0.2, posicoes: [0.5]}, {altura: 0.5, posicoes: [0.5]}, {altura: 0.7, posicoes: [0.5]}]);
    createWall(sizeZ, depth, height, posX + halfX - halfT, posZ, 90, mat, true, 
      [{altura: 0.2, posicoes: [0.5]}, {altura: 0.5, posicoes: [0.5]}, {altura: 0.7, posicoes: [0.5]}]);
    createWall(sizeZ, depth, height, posX - halfX + halfT, posZ, 90, mat, true, 
      [{altura: 0.2, posicoes: [0.5]}, {altura: 0.5, posicoes: [0.7]}, {altura: 0.7, posicoes: [0.3]}]);

    createFloor(sizeX, sizeZ, depth, posX, height - 2, posZ, 0, mat);
  }

  // Criador de torre redonda
  function createRoundTower({
    radius,
    height,
    x,
    z,
    wallDepth = wallThickness,
    segments = 32,
    slits = [],
    passages = [],
    mat = materialTorre,
  }) {
    const innerRadius = radius - wallDepth;

    const outer = csgOperand(
      new THREE.CylinderGeometry(radius, radius, height, segments),
      x,
      height / 2,
      z,
    );
    const inner = csgOperand(
      new THREE.CylinderGeometry(innerRadius, innerRadius, height - wallDepth, segments),
      x,
      height / 2,
      z,
    );

    let shell = CSG.fromMesh(outer).subtract(CSG.fromMesh(inner));

    // Seteiras
    for (const { altura, posicoes } of slits) {
      for (const graus of posicoes) {
        const cutter = slitCutter(
          SLIT.W,
          SLIT.H,
          wallDepth * 3,
          x,
          height * altura,
          z,
          radius,
          toRad(graus),
        );
        shell = shell.subtract(CSG.fromMesh(cutter));
      }
    }

    // Passagens para as muralhas
    for (const passage of passages) {
      const cutter = passageCutter(passage, radius, wallDepth, x, z);
      shell = shell.subtract(CSG.fromMesh(cutter));
    }

    const tower = CSG.toMesh(shell, outer.matrix, mat);
    addRoundBattlements(tower, radius, height, mat);
    castle.addWall(tower);
  }

  // Criador de torre redonda no canto do castelo
  function createCornerTower(cx, cz) {
    // Sentido do canto para o centro do castelo
    const sx = -Math.sign(cx);
    const sz = -Math.sign(cz);

    const lateral = wallThickness / 2 + platformDepth / 2;
    const passage = { width: platformDepth * 0.7, height: 5, y: platformY };

    createRoundTower({
      radius: cornerRadius,
      height: towerHeight,
      x: cx,
      z: cz,
      slits: CORNER_SLITS.map(({ altura, posicoes }) => ({
        altura,
        posicoes: posicoes.map((p) => centerRelativeToAbsolute(cx, cz, p)),
      })),
      passages: [
        { ...passage, dir: [sx, 0], offset: sz * lateral },
        { ...passage, dir: [0, sz], offset: sx * lateral },
      ],
    });

    // Plataforma arredondada no canto da torre (1/4 do círculo)
    const facingStart =
      Math.atan2(-cx, -cz) - Math.PI / 4 + ((cx / halfW) * (cz / halfD)) * 0.1;

    createRoundFloor({
      radius: cornerRadius + platformDepth,
      x: cx,
      y: platformY,
      z: cz,
      start: facingStart,
    });

    // Restante do interior da torre (3/4 do círculo)
    createRoundFloor({
      radius: cornerRadius - wallThickness,
      x: cx,
      y: platformY,
      z: cz,
      start: facingStart + Math.PI / 2,
      length: (3 * Math.PI) / 2,
    });
  }

  // ==========================================================
  // FUNÇÃO AUXILIAR PARA CRIAÇÃO DE PEDESTAIS
  // ==========================================================

  // Criador de pedestal para o altar
  function createPedestal(posX, posZ, width, depth, height, mat = materialMadeira) {
    const baseH = height * 0.15;
    const capH = height * 0.1;
    const shaftH = height - baseH - capH;

    // base e tampo são um pouco maiores que o fuste
    const parts = [
      { w: width, d: depth, h: baseH, y: baseH / 2 },
      { w: width * 0.8, d: depth * 0.8, h: shaftH, y: baseH + shaftH / 2 },
      { w: width, d: depth, h: capH, y: baseH + shaftH + capH / 2 },
    ];

    const pedestal = new THREE.Group();
    for (const p of parts) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mat);
      mesh.position.set(0, p.y, 0);
      pedestal.add(mesh);
    }

    pedestal.position.set(posX, 0, posZ);
    castle.addWall(pedestal);

    return pedestal;
  }

  // ==========================================================
  // 1. TORRES CIRCULARES
  // ==========================================================

  const corners = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [-halfW, halfD],
    [halfW, halfD],
  ];
  corners.forEach(([cx, cz]) => createCornerTower(cx, cz));

  // ==========================================================
  // 2. MURALHA OESTE
  // ==========================================================
  const sideSegmentLength = (castleDepth - sTowerSize) / 2 - cornerRadius;
  const posZ1 = wallThickness / 5 - halfD / 2;
  const tower2PosX = -halfW - sTowerSize / 2 + wallThickness / 2;
  const tower2PosZ = 0;

  createWall(sideSegmentLength, wallThickness, wallHeight, -halfW, posZ1, 90);
  createWall(sideSegmentLength, wallThickness, wallHeight, -halfW, -posZ1, 90);
  createSquareTower(sTowerSize, sTowerSize, towerHeight, tower2PosX, tower2PosZ);
  createFloor(
    halfD,
    platformDepth,
    platformHeight,
    tower2PosX + sTowerSize / 2 + platformDepth / 2,
    platformY,
    -halfD / 2 + cornerRadius,
    90,
  );

  // ==========================================================
  // 3. MURALHA LESTE
  // ==========================================================
  const tower1PosX = halfW + sTowerSize / 2 - wallThickness / 2;
  const tower1PosZ = 0;
  const firstWallWidth = offset;
  const posZ2 = halfD / 2 - wallThickness / 5;

  createWall(sideSegmentLength, wallThickness, wallHeight, halfW, posZ2, 90);
  createWall(
    firstWallWidth,
    wallThickness,
    wallHeight,
    halfW,
    -halfD + firstWallWidth / 2 + cornerRadius,
    90,
  );
  createWall(
    offset + wallThickness,
    wallThickness,
    wallHeight,
    halfW + offset / 2,
    -halfD + firstWallWidth + cornerRadius,
    0,
  );
  createWall(
    halfD - cornerRadius - firstWallWidth - sTowerSize / 2,
    wallThickness,
    wallHeight,
    offset + halfW,
    -(halfD - cornerRadius) / 2,
    90,
  );

  createFloor(
    sideSegmentLength + sTowerSize + platformDepth,
    platformDepth,
    platformHeight,
    halfW - platformDepth / 2 - wallThickness / 2,
    platformY,
    posZ2 - sTowerSize / 2 - platformDepth / 2,
    90,
  );

  createSquareTower(sTowerSize, sTowerSize, towerHeight, tower1PosX, tower1PosZ);

  // ==========================================================
  // 4. FACHADA NORTE E ENTRADA PRINCIPAL
  // ==========================================================

  const gateTowerSize = 10;
  const gateOpening = 6.0;
  const gateZ = -halfD;

  const northSegmentLength =
    (castleWidth - (gateTowerSize * 2 + gateOpening)) / 2 -
    cornerRadius +
    wallThickness / 2;
  const northWallX = halfW - cornerRadius - northSegmentLength / 2;

  for (const s of [-1, 1]) {
    createWall(northSegmentLength, wallThickness, wallHeight, s * northWallX, -halfD);
  }

  // Abreviações só para as expressões densas da entrada
  const G = gateTowerSize;
  const T = wallThickness;

  // Plataformas ao lado da entrada (espelhadas) e a central
  for (const s of [-1, 1]) {
    createFloor(
      halfW - cornerRadius - G / 2 + T / 2 - 0.1,
      platformDepth,
      platformHeight,
      s * (halfW / 2 - cornerRadius / 2 + G / 4 - T / 4 + 0.2),
      platformY,
      platformDepth / 2 - halfD + T / 2,
      0,
    );
  }
  createFloor(
    G + 2 * platformDepth,
    platformDepth,
    platformHeight,
    0,
    platformY,
    platformDepth / 2 - halfD + G / 3,
    0,
  );

  // Duas passagens em arco com portão duplo
  const gateDoorway = (width, z) => {
    createWallWithPortal(width, T, towerHeight, 5, 8, 0, z, 0, materialTorre);
    createDoubleDoor(5, 8, 0.3, 0, z, 0, materialMadeira);
  };
  gateDoorway(G, gateZ + G / 3);
  gateDoorway(G - 2 * T, gateZ - G / 2 - G / 3 + 2 * T);

  // Paredes do portão, definidas só para x > 0 e espelhadas em -x
  const gateWalls = [
    // [largura, x, z, rotY]
    [G / 3, G / 2, gateZ + G / 6, 90, []], // recorte central de dentro
    [G / 1.5, G / 3 + G / 2, gateZ, 0, []], // barras internas
    [G - 2 * T, G / 2 + G / 3 - T, gateZ - G / 3 - G / 2, 0, [{altura: 0.8, posicoes: [0.75]}, {altura: 0.5, posicoes: [0.35]}]], // barras externas
    [G / 1.5, G + 2 * T, gateZ - G / 3 + T / 2, 90, []], // laterais
    [G / 4, G / 1.5 + G / 3 + T, gateZ - G / 1.5, 90, []], // pequenas paredes externas
    [T * 2, G / 2 - T, gateZ - G / 2 - G / 3 + T, 90, []], // recorte central de fora
  ];
  for (const [w, x, z, rotY, slits] of gateWalls) {
    for (const s of [-1, 1]) {
      let correctSlits = slits.map(({ altura, posicoes }) => ({
        altura,
        posicoes: posicoes.map((p) => ((2 * p - 1) * s + 1) / 2),
      }));
      createWall(w, T, towerHeight, s * x, z, rotY, materialTorre, true, correctSlits);
    }
  }

  const gateRoofY = towerHeight - 2;
  const gateRoof = [
    [G, G / 3, 0, gateZ + G / 6],
    [G, T, 0, gateZ],
    [G * (7 / 3), G * 0.75 - T, 0, gateZ - G / 5 - T],
    [G - 2 * T, G / 4, -G / 1.5 - T, gateZ - G / 3 - G / 2 + 1.5 * T],
    [G - 2 * T, G / 4, G / 1.5 + T, gateZ - G / 3 - G / 2 + 1.5 * T],
  ];
  for (const [w, d, x, z] of gateRoof) {
    createFloor(w, d, T, x, gateRoofY, z, 0, materialTorre);
  }

  // ==========================================================
  // 5. MURALHA SUL & TORRE
  // ==========================================================

  const southSegmentLength = (castleWidth - sTowerSize) / 2 - cornerRadius;
  const southWallX = halfW - cornerRadius - southSegmentLength / 2;
  const tower3PosX = 0;
  const tower3PosZ = halfD + sTowerSize / 2 - wallThickness / 2;

  for (const s of [-1, 1]) {
    createWall(southSegmentLength, wallThickness, wallHeight, s * southWallX, halfD);
  }
  createFloor(
    castleWidth - 2 * cornerRadius,
    platformDepth,
    platformHeight,
    tower3PosX,
    platformY,
    tower3PosZ - sTowerSize / 2 - platformDepth / 2,
    0,
  );

  createSquareTower(sTowerSize, sTowerSize, towerHeight, tower3PosX, tower3PosZ);

  // ==========================================================
  // 6. APOSENTOS PRINCIPAIS (CASA)
  // ==========================================================

  // Parede da porta
  createInnerDoorway(sTowerSize, wallThickness, tower3PosX, tower3PosZ - sTowerSize, 90);

  // Parede do fundo
  createDoubleWindowedWall(
    halfW - sTowerSize + wallThickness,
    8,
    sTowerSize / 2 - halfW / 2,
    halfD - sTowerSize,
  );

  // Parede lateral
  createWall(
    halfD - sTowerSize + wallThickness,
    wallThickness,
    innerWallHeight,
    sTowerSize - halfW,
    halfD / 2 - sTowerSize / 2,
    90,
    materialMuralha,
    false,
  );

  // Parede da frente
  createDoubleWindowedWall(sTowerSize, 5, tower2PosX + sTowerSize, tower2PosZ);

  // Primeiro andar
  createFloor(halfW, sTowerSize, 0.01, -halfW / 2, 0, halfD - sTowerSize / 2);
  createFloor(sTowerSize, halfD, 0.01, sTowerSize / 2 - halfW, 0, halfD / 2);

  // Segundo andar
  createFloor(halfW, sTowerSize, platformHeight, -halfW / 2, platformY / 2, halfD - sTowerSize / 2);
  createFloor(
    sTowerSize - platformDepth + wallThickness - 1,
    halfD,
    platformHeight,
    platformDepth - halfW + wallThickness / 2 - 0.5,
    platformY / 2,
    halfD / 2,
  );
  createFloor(
    platformDepth + 1,
    halfD - cornerRadius - sTowerSize / 2 - platformY / 2,
    platformHeight,
    sTowerSize - halfW - platformDepth / 2 - wallThickness / 2,
    platformY / 2,
    sTowerSize / 2 + platformY / 2 + (halfD - cornerRadius - sTowerSize / 2 - platformY / 2) / 2,
  );
  createFloor(
    platformDepth + 1,
    sTowerSize / 2,
    platformHeight,
    sTowerSize - halfW - platformDepth / 2 - wallThickness / 2,
    platformY / 2,
    sTowerSize / 4,
  );

  // Teto
  createFloor(
    halfW,
    sTowerSize,
    platformHeight,
    wallThickness / 2 - halfW / 2,
    platformY,
    halfD - sTowerSize / 2 - wallThickness / 2,
  );
  createFloor(
    sTowerSize - platformDepth + wallThickness - 1,
    halfD,
    platformHeight,
    2 * platformDepth - halfW + 0.5,
    platformY,
    halfD / 2 - wallThickness / 2,
  );
  createFloor(
    platformDepth + 1,
    halfD - cornerRadius - sTowerSize / 2 - platformY / 2,
    platformHeight,
    platformDepth / 2 - halfW + 0.5,
    platformY,
    sTowerSize / 2 + platformY / 2 + (halfD - cornerRadius - sTowerSize / 2 - platformY / 4) / 2,
  );

  createStairs(
    platformDepth,
    platformY / 2 + platformHeight / 2,
    platformY / 2,
    platformY,
    2 * wallThickness - halfW,
    platformY / 2,
    sTowerSize / 2 + platformY / 2,
    -1,
  );
  createStairs(
    platformDepth,
    platformY / 2 + platformHeight / 2,
    platformY / 2,
    platformY,
    sTowerSize - halfW - 2 * wallThickness,
    0,
    sTowerSize / 2,
    1,
  );

  // ==========================================================
  // 7. ARMAZÉM
  // ==========================================================

  const warehouseWidth = halfW - sTowerSize - wallThickness;
  const warehouseDepth = halfD;

  createInnerDoorway(
    warehouseWidth,
    wallThickness / 2,
    halfW - warehouseWidth / 2 - wallThickness / 2,
    0,
    0,
  );
  createDoubleWindowedWall(warehouseDepth / 2, 7, halfW - warehouseWidth, -warehouseDepth / 4, 90);
  createDoubleWindowedWall(warehouseDepth / 2, 7, halfW - warehouseWidth, (-3 * warehouseDepth) / 4, 90);

  // Primeiro andar
  createFloor(warehouseWidth, warehouseDepth, 0.01, halfW - warehouseWidth / 2, 0, -warehouseDepth / 2);
  createFloor(
    offset,
    halfD - cornerRadius - firstWallWidth - sTowerSize / 2,
    0.01,
    halfW + offset / 2,
    0,
    -(halfD - cornerRadius) / 2,
  );

  // Segundo andar
  createFloor(
    warehouseWidth,
    warehouseDepth,
    platformHeight,
    halfW - warehouseWidth / 2,
    platformY / 2,
    -warehouseDepth / 2,
  );
  createFloor(
    offset,
    platformDepth - wallThickness,
    platformHeight,
    halfW + offset / 2 - wallThickness / 2,
    platformY / 2,
    -halfD + firstWallWidth + cornerRadius + platformDepth / 2,
  );
  createFloor(
    offset,
    offset,
    platformHeight,
    halfW + offset / 2 - wallThickness / 2,
    platformY / 2,
    -sTowerSize / 2 - offset / 2,
  );

  // Teto
  createFloor(
    warehouseWidth,
    warehouseDepth,
    platformHeight,
    halfW - warehouseWidth / 2 - wallThickness / 2,
    platformY,
    -warehouseDepth / 2 + wallThickness / 4,
  );
  createFloor(
    offset,
    platformDepth - wallThickness,
    platformHeight,
    halfW + offset / 2 - wallThickness / 2,
    platformY,
    -halfD + firstWallWidth + cornerRadius + platformDepth / 2,
  );

  createStairs(
    platformDepth - wallThickness * 2,
    platformY / 2,
    platformY / 2 + 0.1,
    platformY,
    halfW + offset - platformDepth / 2,
    platformY / 2 + platformHeight / 2,
    -sTowerSize,
    -1,
  );
  createStairs(
    platformDepth - wallThickness * 2,
    platformY / 2 + platformHeight / 2,
    platformY / 2,
    platformY,
    halfW + platformDepth / 2 - wallThickness * 0.5,
    0,
    -sTowerSize - platformY / 2,
    1,
  );

  // ==========================================================
  // 8. ALTAR
  // ==========================================================

  const pedestalHeight = 1.5;
  const pedestalPositions = [
    [5, -5],
    [-5, 5],
    [5, 5],
    [-5, -5],
  ];
  for (const [x, z] of pedestalPositions) createPedestal(x, z, 1, 1, pedestalHeight);
  castle.pedestals = pedestalPositions.map(([x, z]) => new THREE.Vector3(x, pedestalHeight, z));

  for (const [x, z] of pedestalPositions) {
    castle.altarObjects.push(createPedestal(x, z, 1, 1, pedestalHeight));
  }

  // ==========================================================
  // 9. PONTE E CHÃO DO CASTELO
  // ==========================================================

    const floorBase = csgOperand(
      new THREE.BoxGeometry(castleWidth, wallThickness, castleDepth),
      0,
      -wallThickness / 2,
      0,
    );

  const hole = csgOperand(new THREE.CylinderGeometry(5, 5, 2, 32), 0, -0.25, 0);

  const floor = CSG.toMesh(
    CSG.fromMesh(floorBase).subtract(CSG.fromMesh(hole)),
    floorBase.matrix,
    materialMuralha,
  );

  castle.addFloor(floor);

  const altar = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 1, 32),
    materialAltar,
  );
  altar.position.set(0, -0.25, 0);
  altar.updateMatrix();
  altar.matrixAutoUpdate = false;
  castle.addFloor(altar);
  castle.altarObjects.push(altar);

  // Torres quadradas
  createFloor(sTowerSize, sTowerSize, T, tower1PosX, -T/2, tower1PosZ, 0, materialMuralha);
  createFloor(sTowerSize, sTowerSize, T, tower2PosX, -T/2, tower2PosZ, 0, materialMuralha);
  createFloor(sTowerSize, sTowerSize, T, tower3PosX, -T/2, tower3PosZ, 0, materialMuralha);

  // Torres circulares nos cantos
  corners.forEach(([cx, cz]) =>     
    createRoundFloor({
      radius: cornerRadius,
      x: cx,
      y: -T/2,
      z: cz,
      start: 0,
      length: 2 * Math.PI,
      height: T,
      segments: 32,
      mat: materialMuralha,
    })
  );

  // Ponte do portão
  createFloor(gateOpening, castleDepth, T, 0, -T/2, -castleDepth, 0, materialMuralha);
  createFloor(gateOpening+2, castleDepth, T, 0, -T/2-0.1, -castleDepth, 0, materialGrama);

  for (const [w, d, x, z] of gateRoof) {
    createFloor(w+wallThickness, d+wallThickness, T, x, -T/2, z-wallThickness/2, 0, materialMuralha);
  }


  return castle;
}





// ============================================================
// CHÃO
// ============================================================

export function createGround(scene) {
  // Chão 500x500 (y de -0.5 a 0) com um furo circular de raio 5 na origem
  const groundBase = csgOperand(new THREE.BoxGeometry(500, 0.5, 500), 0, -0.25, 0);
  const hole = csgOperand(new THREE.CylinderGeometry(5, 5, 2, 32), 0, -0.25, 0);

  const ground = CSG.toMesh(
    CSG.fromMesh(groundBase).subtract(CSG.fromMesh(hole)),
    groundBase.matrix,
    materialAgua,
  );
  scene.add(ground);

  return ground;
}