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
    this.doors = [];

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

  addDoor(pivots, options = {}) {
    const { triggerDistance = 6, openSpeed = Math.PI * 0.8 } = options;

    const door = {
      pivots: pivots.map((p) => ({
        group: p.group,
        closedAngle: 0,
        openAngle: p.openAngle,
      })), //salva angulo de abertura e qua pivo do grupo
      triggerDistance,
      openSpeed,
      isOpen: false,
    };

    this.doors.push(door);
    return door;
  }
}

export function createCastle(
  scene,
  position = new THREE.Vector3(0, 0, 0),
  rotation = 0,
) {
  const castle = new Structure(scene, position, rotation);

  // Dimensões gerais
  const wallHeight = 20;
  const wallThickness = 1.0;
  const castleWidth = 70; // Eixo X
  const castleDepth = 80; // Eixo Z

  const sTowerSize = castleDepth/6;
  const towerHeight = 30;
  const cornerRadius = 7;
  const cornerHeight = towerHeight;
  const offset = sTowerSize/2;

  const platformHeight = 1.0;
  const platformDepth = sTowerSize/3;
  const platformY = wallHeight - 2;

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

  function createWall(
    width,
    depth,
    height,
    posX,
    posZ,
    rotY = 0,
    mat = materialMuralha,
    addAmeias = true,
  ) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(posX, height / 2, posZ);
    mesh.rotation.y = rotY * (Math.PI / 180);

    if (addAmeias) {
      // Adiciona ameias
      const ameiaHeight = 0.8;
      const ameiaDepth = 1.0;
      const ameiasQTD = Math.floor(width / 2);
      const gap = width / ameiasQTD;

      for (let i = 0; i < ameiasQTD; i++) {
        const x = -width / 2 + (i + 0.5) * gap;
        const geoAmeia = new THREE.BoxGeometry(
          gap * 0.75,
          ameiaHeight,
          ameiaDepth,
        );
        const meshAmeia = new THREE.Mesh(geoAmeia, mat);
        meshAmeia.position.set(x, (ameiaHeight + height) / 2, 0);
        mesh.add(meshAmeia);
      }
    }

    castle.addWall(mesh);
    return mesh;
  }

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
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(posX, posY, posZ);
    mesh.rotation.y = rotY * (Math.PI / 180);

    castle.addFloor(mesh);
    return mesh;
  }

  function createArch(radius, thickness, mat, jambH = 0, segments = 24) {
    const r0 = radius - 0.01; // margem mínima: evita z-fighting com os pilares
    const r1 = radius + radius * 0.42; // borda externa da moldura
    const h = (thickness * 1.05) / 2; // meia espessura (relevo de 5%, como antes)

    // Perfil retangular. Os cantos duplicados mantêm as arestas vivas (normais planas)
    const P = (x, y) => new THREE.Vector2(x, y);
    const profile = [
      P(r0, -h),
      P(r1, -h),
      P(r1, -h),
      P(r1, h),
      P(r1, h),
      P(r0, h),
      P(r0, h),
      P(r0, -h),
    ];

    const group = new THREE.Group();

    // Meia-coroa: metade do círculo, deitada para ficar de pé no plano XY
    const ring = new THREE.Mesh(
      new THREE.LatheGeometry(profile, segments, Math.PI / 2, Math.PI),
      mat,
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // Batentes retos, do arranque até o chão
    if (jambH > 0) {
      const jambGeo = new THREE.BoxGeometry(r1 - r0, jambH, h * 2);
      for (const s of [-1, 1]) {
        const jamb = new THREE.Mesh(jambGeo, mat);
        jamb.position.set((s * (r0 + r1)) / 2, -jambH / 2, 0);
        group.add(jamb);
      }
    }

    return group;
  }

  function createFrontDoor(
    width,
    height,
    thickness,
    posX,
    posZ,
    rotY = 0,
    mat = materialMadeira,
  ) {
    const group = new THREE.Group();

    const halfWidth = width / 2;
    const straightHeight = height - halfWidth;

    // FOLHA ESQUERDA
    // Local: x=0 é a dobradiça (borda externa), x=halfWidth é o centro
    const leftShape = new THREE.Shape();
    leftShape.moveTo(0, 0); // base da dobradiça
    leftShape.lineTo(0, straightHeight); // sobe reto até a linha de arranque do arco
    leftShape.absarc(
      halfWidth,
      straightHeight, // centro do arco = ponto central da porta, na altura de arranque
      halfWidth, // raio = metade da largura da folha
      Math.PI,
      Math.PI / 2, // varre da dobradiça até o topo central
      true, // sentido horário
    );
    leftShape.lineTo(halfWidth, 0); // desce reto no corte central até a base
    leftShape.lineTo(0, 0); // fecha na dobradiça

    const leftGeometry = new THREE.ExtrudeGeometry(leftShape, {
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 16,
    });
    leftGeometry.translate(0, 0, -thickness / 2);
    const leftDoor = new THREE.Mesh(leftGeometry, mat);

    // FOLHA DIREITA (espelhada)
    // Local: x=0 é a dobradiça, x=-halfWidth é o centro
    const rightShape = new THREE.Shape();
    rightShape.moveTo(0, 0);
    rightShape.lineTo(0, straightHeight);
    rightShape.absarc(
      -halfWidth,
      straightHeight,
      halfWidth,
      0,
      Math.PI / 2,
      false, // sentido anti-horário (espelhado)
    );
    rightShape.lineTo(-halfWidth, 0);
    rightShape.lineTo(0, 0);

    const rightGeometry = new THREE.ExtrudeGeometry(rightShape, {
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 16,
    });
    rightGeometry.translate(0, 0, -thickness / 2);
    const rightDoor = new THREE.Mesh(rightGeometry, mat);

    const leftPivot = new THREE.Group();
    leftPivot.position.set(posX - halfWidth, 0, posZ);
    leftDoor.position.set(0, 0, 0);
    leftPivot.add(leftDoor);

    const rightPivot = new THREE.Group();
    rightPivot.position.set(posX + halfWidth, 0, posZ);
    rightDoor.position.set(0, 0, 0);
    rightPivot.add(rightDoor);

    group.add(leftPivot);
    group.add(rightPivot);
    group.rotation.y = rotY;

    castle.addDoor(
      [
        { group: leftPivot, openAngle: -Math.PI / 2 },
        { group: rightPivot, openAngle: Math.PI / 2 },
      ],
      { triggerDistance: 6, openSpeed: Math.PI * 0.8 },
    );

    castle.addDecor(group);
  }

  function createHouseDoor(
    width,
    height,
    thickness,
    posX,
    posZ,
    rotY = 0,
    mat = materialMadeira,
    openAngle = -Math.PI / 2,
  ) {
    const straightHeight = height - width / 2;
    const halfWidth = width / 2;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0, straightHeight);
    shape.absarc(halfWidth, straightHeight, halfWidth, Math.PI, 0, true);
    shape.lineTo(width, 0);
    shape.lineTo(0, 0);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 16,
    });
    geometry.translate(0, 0, -thickness / 2);
    const doorMesh = new THREE.Mesh(geometry, mat);

    const pivot = new THREE.Group();
    pivot.position.set(-halfWidth, 0, 0); // deslocamento LOCAL, antes da rotação
    doorMesh.position.set(0, 0, 0);
    pivot.add(doorMesh);

    const group = new THREE.Group();
    group.position.set(posX, 0, posZ); // centro real da porta no mundo
    group.rotation.y = rotY;
    group.add(pivot);

    castle.addDoor([{ group: pivot, openAngle }], {
      triggerDistance: 6,
      openSpeed: Math.PI * 0.8,
    });

    castle.addDecor(group);
  }

  function createWallWithDoor(
    wallW,
    thickness,
    wallH,
    doorW,
    doorH,
    posX,
    posZ,
    rotY = 0,
    mat = materialMuralha,
    doorMaterial = mat,
    addAmeias = true,
  ) {
    const rad = (rotY * Math.PI) / 180;
    const cos = Math.cos(rad),
      sin = Math.sin(rad);
    const side = (wallW - doorW) / 2;
    const off = (doorW + side) / 2;
    const r = doorW / 2;

    const part = (w, h, dx, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, thickness), mat);
      m.position.set(posX + dx * cos, y + h / 2, posZ - dx * sin);
      m.rotation.y = rad;
      castle.addWall(m);
    };

    part(side, wallH, -off, 0);
    part(side, wallH, off, 0);
    part(doorW, wallH - doorH, 0, doorH);

    // Arco
    const arch = createArch(r, thickness, doorMaterial, doorH - r);
    arch.position.set(posX, doorH - r, posZ);
    arch.rotation.y = rad;
    castle.addDecor(arch);

    if (addAmeias) {
      const ameiaH = 0.8;
      const ameiaD = 1.0;
      const qtd = Math.max(1, Math.floor(wallW / 2));
      const gap = wallW / qtd;
      const ameiaGeo = new THREE.BoxGeometry(gap * 0.75, ameiaH, ameiaD);

      const ameias = new THREE.Group();
      ameias.position.set(posX, wallH, posZ);
      ameias.rotation.y = rad;

      for (let i = 0; i < qtd; i++) {
        const a = new THREE.Mesh(ameiaGeo, doorMaterial);
        a.position.set(-wallW / 2 + (i + 0.5) * gap, ameiaH / 2, 0);
        ameias.add(a);
      }
      castle.addDecor(ameias);
    }
  }

  function createWallWithWindow(
    width, depth, height,
    winW, winH, winX, winY,
    posX, posY, posZ, rotY = 0,
    mat = materialMuralha,
  ) {
    const hw = width / 2;
    const x0 = winX - winW / 2, x1 = winX + winW / 2;   // vão da janela em X (local)
    const y0 = winY,            y1 = winY + winH;       // vão da janela em Y

    const group = new THREE.Group();

    // Caixa definida por intervalos locais [xa, xb] e [ya, yb]
    const box = (xa, xb, ya, yb) => {
      const w = xb - xa, h = yb - ya;
      if (w <= 0.01 || h <= 0.01) return;               // ignora caixas sem tamanho
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), mat);
      m.position.set((xa + xb) / 2, (ya + yb) / 2, 0);
      group.add(m);
    };

    box(-hw, hw, 0, y0);        // abaixo
    box(-hw, hw, y1, height);   // acima
    box(-hw, x0, y0, y1);       // esquerda
    box(x1, hw, y0, y1);        // direita

    group.position.set(posX, posY, posZ);
    group.rotation.y = rotY * Math.PI / 180;

    castle.addWall(group);
    return group;
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
    const geoTop = new THREE.CylinderGeometry(
      outerRadius,
      outerRadius,
      depth,
      16,
    );
    const top = new THREE.Mesh(geoTop, mat);
    top.position.set(0, height-2, 0);
    castle.addFloor(top);
    wall.add(top);

    // Adiciona ameias
    const ameiaHeight = 0.8;
    const ameiaDepth = 1.0;
    const ameiasQTD = Math.floor((2 * Math.PI * outerRadius) / 2);
    const ameiaGap = (2 * Math.PI * outerRadius) / ameiasQTD;

    for (let i = 0; i < ameiasQTD; i++) {
      const angle = (i / ameiasQTD) * Math.PI * 2;
      const x = Math.cos(angle) * (outerRadius - 0.65);
      const z = Math.sin(angle) * (outerRadius - 0.65);

      const geoAmeia = new THREE.BoxGeometry(
        ameiaGap * 0.75,
        ameiaHeight,
        ameiaDepth,
      );
      const meshAmeia = new THREE.Mesh(geoAmeia, mat);
      meshAmeia.position.set(x, ameiaHeight/2+height, z);
      meshAmeia.rotation.y = -angle + Math.PI / 2;
      wall.add(meshAmeia);
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
    top.position.set(posX, height -2, posZ);
    castle.addFloor(top);
  }

  function createPlatform(
    width,
    depth,
    height,
    posX,
    posY,
    posZ,
    rotY,
    mat = materialMadeira,
  ) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(posX, posY, posZ);
    mesh.rotation.y = rotY * (Math.PI / 180);

    castle.addFloor(mesh);
  }

  function createRoundPlatform(
    radius,
    height,
    posX,
    posY,
    posZ,
    segments = 32,
    tStart,
    mat = materialMadeira,
  ) {
    const geo = new THREE.CylinderGeometry(
      radius,
      radius,
      height,
      segments,
      1,
      false,
      tStart,
      Math.PI / 2,
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(posX, posY, posZ);
    castle.addFloor(mesh);
  }

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
    const wallThickness = 0.01;
    const invisibleMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

  const playerRadius = 0.8; // mesmo valor de CollisionSystem.playerRadius
  const railHeight = 0.9;   // altura do corrimão acima do degrau
  const railSize = 0.1;     // espessura da barra e dos postes
  const sideExtra = railHeight; // paredes invisíveis da altura do corrimão

  for (let i = 0; i < numSteps; i++) {
    const currentHeight = (i + 1) * stepHeight;
    const geo = new THREE.BoxGeometry(width, currentHeight, stepDepth);
    const mesh = new THREE.Mesh(geo, mat);

    const zPos = startZ + directionZ * (i * stepDepth + stepDepth / 2);
    const yPos = currentHeight / 2 + startY;

    mesh.position.set(startX, yPos, zPos);
    castle.addRamp(mesh);

    // Paredes invisíveis laterais
    const wallHeight = currentHeight + sideExtra;
    const geoWall = new THREE.BoxGeometry(wallThickness, wallHeight, stepDepth);
    const sideOffset = width / 2 + wallThickness / 2;

    for (const side of [-1, 1]) {
      const wallMesh = new THREE.Mesh(geoWall, invisibleMaterial);
      wallMesh.position.set(
        startX + side * sideOffset,
        startY + wallHeight / 2,
        zPos,
      );
      castle.addWall(wallMesh);
    }
  }

  if (closeBack) {
    const backHeight = totalHeight - 0.3;
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(width + wallThickness * 2, backHeight, wallThickness),
      invisibleMaterial,
    );
    backWall.position.set(
      startX,
      startY + backHeight / 2,
      startZ + directionZ * (totalDepth + playerRadius + wallThickness / 2),
    );
    castle.addWall(backWall);
  }

  const railAngle = Math.atan2(totalHeight, totalDepth);
  const railLength = Math.hypot(totalDepth, totalHeight);
  const railX = width / 2 - railSize / 2; // rente à borda do degrau

  const postGeo = new THREE.BoxGeometry(railSize, railHeight, railSize);
  const barGeo = new THREE.BoxGeometry(railSize, railSize, railLength);

  for (const side of [-1, 1]) {
    const x = startX + side * railX;

    // Postes: um a cada 2 degraus, mais o último
    for (let i = 0; i < numSteps; i++) {
      if (i % 2 !== 0 && i !== numSteps - 1) continue;

      const post = new THREE.Mesh(postGeo, mat);
      post.position.set(
        x,
        startY + (i + 1) * stepHeight + railHeight / 2,
        startZ + directionZ * (i * stepDepth + stepDepth / 2),
      );
      castle.addDecor(post);
    }

    // Barra do corrimão, paralela à inclinação da escada
    const bar = new THREE.Mesh(barGeo, mat);
    bar.rotation.x = directionZ === 1 ? -railAngle : railAngle;
    bar.position.set(
      x,
      startY + totalHeight / 2 + stepHeight / 2 + railHeight,
      startZ + directionZ * (totalDepth / 2),
    );
    castle.addDecor(bar);
  }

  // Rampa invisível
  const extension = 0.1; // folga só na base
  const topInset = stepDepth; // termina um degrau antes do topo (ajuste se precisar)
  const angle = Math.atan2(totalHeight, totalDepth);
  const slopeLength = Math.hypot(totalDepth, totalHeight);

  const rampStart = -extension;
  const rampEnd = slopeLength - topInset / Math.cos(angle);
  const rampLength = rampEnd - rampStart;
  const rampCenter = (rampStart + rampEnd) / 2; // distância ao longo da inclinação
  const rampThickness = 0.4;

  const ramp = new THREE.Mesh(
    new THREE.BoxGeometry(width, rampThickness, rampLength),
    invisibleMaterial,
  );
  ramp.rotation.x = directionZ === 1 ? -angle : angle;
  ramp.position.set(
    startX,
    startY + rampCenter * Math.sin(angle) + 0.08,
    startZ + directionZ * rampCenter * Math.cos(angle),
  );
  castle.addRamp(ramp);
  }

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
  // 1. TORRES CIRCULARES
  // ==========================================================

  const corners = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [-halfW, halfD],
    [halfW, halfD],
  ];
  for (const [cx, cz] of corners) {
    createRoundTower(cornerRadius, cornerHeight, cx, cz);
    addRoundTowerSlits(cornerRadius, cornerHeight * 0.7, cx, cz, 4);
    createRoundPlatform(cornerRadius+platformDepth, platformHeight, cx, platformY, cz, 32, Math.atan2(-cx, -cz)-Math.PI/4+(cx/halfW*cz/halfD)*0.1);
  }

  // ==========================================================
  // 2. MURALHA OESTE
  // ==========================================================

  const posZ1 = wallThickness/5-halfD/2;
  const width = (castleDepth - sTowerSize) / 2 - cornerRadius;
  const tower2PosX = -halfW-sTowerSize/2+wallThickness/2;
  const tower2PosZ = 0;

  createWall(width, wallThickness, wallHeight, -halfW, posZ1, 90);
  createWall(width, wallThickness, wallHeight, -halfW, -posZ1, 90);
  createSquareTower(sTowerSize, sTowerSize, towerHeight, tower2PosX, tower2PosZ);
  createPlatform(halfD, platformDepth, platformHeight, tower2PosX+(sTowerSize/2)+(platformDepth/2), platformY,-halfD/2+cornerRadius, 90);


  // ==========================================================
  // 3. MURALHA LESTE
  // ==========================================================
    const tower1PosX = halfW+sTowerSize/2-wallThickness/2;
    const tower1PosZ = 0;
    const firstWallWidth = offset;
    const posZ2 = halfD/2-wallThickness/5;

    createWall(width, wallThickness, wallHeight, halfW, posZ2, 90);
    createWall(firstWallWidth, wallThickness, wallHeight, halfW, -halfD+firstWallWidth/2+cornerRadius, 90);
    createWall(offset+wallThickness, wallThickness, wallHeight, halfW+(offset)/2, -halfD+firstWallWidth+cornerRadius, 0, materialMuralha);
    createWall(halfD-cornerRadius-firstWallWidth-sTowerSize/2, wallThickness, wallHeight, offset+halfW, -(halfD-cornerRadius)/2, 90, materialMuralha);
    
    createPlatform(width+sTowerSize+platformDepth, platformDepth, platformHeight,halfW-platformDepth/2-wallThickness/2 , platformY, posZ2-sTowerSize/2-platformDepth/2, 90);

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
  const posX1 = -halfW + cornerRadius + northSegmentLength / 2;
  const posX2 = halfW - cornerRadius - northSegmentLength / 2;

  createWall(northSegmentLength, wallThickness, wallHeight, posX1, -halfD);
  createWall(northSegmentLength, wallThickness, wallHeight, posX2, -halfD);

  const gateTowerX = -(gateOpening / 2 + gateTowerSize / 2);
  
  createArrowSlit(gateTowerX, gateZ-gateTowerSize/2-gateTowerSize/3-wallThickness - 0.1, 0, towerHeight * 0.55);
  createArrowSlit(-gateTowerX, gateZ-gateTowerSize/2-gateTowerSize/3-wallThickness - 0.1, 0, towerHeight * 0.55);

  createPlatform(halfW-cornerRadius-gateTowerSize/2+wallThickness/2-0.1, platformDepth, platformHeight, halfW/2-cornerRadius/2+gateTowerSize/4-wallThickness/4+0.2, platformY, platformDepth/2-halfD+wallThickness/2, 0);
  createPlatform(halfW-cornerRadius-gateTowerSize/2+wallThickness/2-0.1, platformDepth, platformHeight, -halfW/2+cornerRadius/2-gateTowerSize/4+wallThickness/4-0.2, platformY, platformDepth/2-halfD+wallThickness/2, 0);
  createPlatform(gateTowerSize + 2*platformDepth, platformDepth, platformHeight, 0, platformY, platformDepth/2-halfD+gateTowerSize/3, 0);

  // Barra superior central
  createWallWithDoor(gateTowerSize, wallThickness, towerHeight, 5, 8, 0, gateZ+gateTowerSize/3, 0, materialTorre);
  createFrontDoor(5, 8, 0.3, 0, gateZ + gateTowerSize/3, 0, materialMadeira);  // Paredes do recorte central de cima
  createWall(gateTowerSize/3, wallThickness, towerHeight, gateTowerSize/2, gateZ+gateTowerSize/6, 90, materialTorre);
  createWall(gateTowerSize/3, wallThickness, towerHeight,  -gateTowerSize/2, gateZ+gateTowerSize/6, 90, materialTorre);

  // // Barras superiores esquerda e direita
  createWall(gateTowerSize/1.5, wallThickness, towerHeight, gateTowerSize/3+gateTowerSize/2, gateZ, 0, materialTorre);
  createWall(gateTowerSize/1.5, wallThickness, towerHeight,  -gateTowerSize/3-gateTowerSize/2, gateZ, 0, materialTorre);

  // // Barra interna central (a que fecha o "recorte" de baixo)
  createWallWithDoor(gateTowerSize-2*wallThickness, wallThickness, towerHeight, 5, 8, 0, gateZ-gateTowerSize/2-gateTowerSize/3+2*wallThickness, 0, materialTorre);
  createFrontDoor(5, 8, 0.3, 0, gateZ - gateTowerSize/2 - gateTowerSize/3 + 2*wallThickness, 0, materialMadeira);  
  // // Barras inferiores esquerda e direita
  createWall(gateTowerSize-2*wallThickness, wallThickness, towerHeight, gateTowerSize/2+gateTowerSize/3-wallThickness, gateZ-gateTowerSize/3-gateTowerSize/2, 0, materialTorre);
  createWall(gateTowerSize-2*wallThickness, wallThickness, towerHeight, -gateTowerSize/2-gateTowerSize/3+wallThickness, gateZ-gateTowerSize/3-gateTowerSize/2, 0, materialTorre);

  // Laterais esquerda e direita
  createWall(gateTowerSize/1.5, wallThickness, towerHeight, gateTowerSize+2*wallThickness, gateZ-gateTowerSize/3+wallThickness/2, 90, materialTorre);
  createWall(gateTowerSize/1.5, wallThickness, towerHeight,  -gateTowerSize-2*wallThickness, gateZ-gateTowerSize/3+wallThickness/2, 90, materialTorre);

  // // Pequenas paredes externas da parte de baixo
  createWall(gateTowerSize/4, wallThickness, towerHeight, gateTowerSize/1.5+gateTowerSize/3+wallThickness, gateZ-gateTowerSize/1.5, 90, materialTorre);
  createWall(gateTowerSize/4, wallThickness, towerHeight,  -gateTowerSize/1.5-gateTowerSize/3-wallThickness, gateZ-gateTowerSize/1.5, 90, materialTorre);

  // Paredes do recorte central de baixo
  createWall(wallThickness*2, wallThickness, towerHeight, gateTowerSize/2-wallThickness, gateZ-gateTowerSize/2-gateTowerSize/3+wallThickness, 90, materialTorre);
  createWall(wallThickness*2, wallThickness, towerHeight,  -gateTowerSize/2+wallThickness, gateZ-gateTowerSize/2-gateTowerSize/3+wallThickness, 90, materialTorre);

  // Cria o teto da entrada
  const topY = towerHeight - 2;
  const topParts = [
    [gateTowerSize, gateTowerSize/3, 0, gateZ + gateTowerSize / 6],

    [gateTowerSize, wallThickness, 0, gateZ],

    [gateTowerSize*(7/3), gateTowerSize*0.75-wallThickness, 0, gateZ - gateTowerSize/5 - wallThickness],

    [gateTowerSize-2*wallThickness, gateTowerSize/4, -gateTowerSize/1.5-wallThickness, gateZ - gateTowerSize/3-gateTowerSize/2+1.5*wallThickness],
    [gateTowerSize-2*wallThickness, gateTowerSize/4,  gateTowerSize/1.5+wallThickness, gateZ - gateTowerSize/3-gateTowerSize/2+1.5*wallThickness],
  ];

  topParts.forEach(([w, d, x, z]) => {
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(w, wallThickness, d),
      materialTorre,
    );
    top.position.set(x, topY, z);
    castle.addFloor(top);
  });

  // ==========================================================
  // 5. MURALHA SUL & TORRE
  // ==========================================================

  const southSegmentLength = (castleWidth - sTowerSize) / 2 - cornerRadius;
  const tower3PosX = 0;
  const tower3PosZ = halfD + sTowerSize / 2 - wallThickness / 2;

  const posX3 = -halfW + cornerRadius + southSegmentLength / 2;
  const posX4 = halfW - cornerRadius - southSegmentLength / 2;

  createWall(southSegmentLength, wallThickness, wallHeight, posX3, halfD);
  createWall(southSegmentLength, wallThickness, wallHeight, posX4, halfD);
  createPlatform(
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
  // 6. CONSTRUÇÃO DOS APOSENTOS PRINCIPAIS (CASA)
  // ==========================================================
 
  const innerWallHeight = platformY-platformHeight/2;
  // Parede da Porta
  createWallWithDoor(sTowerSize, wallThickness, innerWallHeight,3 ,5 ,tower3PosX, tower3PosZ-sTowerSize, 90, materialMuralha, materialMadeira,false);
  createHouseDoor(3, 5, 0.3, tower3PosX, tower3PosZ - sTowerSize, Math.PI / 2, materialMadeira, Math.PI / 2); 
  
  // Parede do fundo
  createWallWithWindow(halfW-sTowerSize+wallThickness, wallThickness, innerWallHeight/2, 8, 3, 0, 1.5, sTowerSize/2-halfW/2, 0, halfD-sTowerSize, 0, materialMuralha, false);
  createWallWithWindow(halfW-sTowerSize+wallThickness, wallThickness, innerWallHeight/2, 8, 3, 0, 1.5, sTowerSize/2-halfW/2, innerWallHeight/2,halfD-sTowerSize, 0, materialMuralha, false);
  
  // Parede lateral
  createWall(halfD-sTowerSize+wallThickness, wallThickness, innerWallHeight, sTowerSize-halfW, halfD/2-sTowerSize/2, 90, materialMuralha, false);
  
  // Parede da frente
  createWallWithWindow(sTowerSize, wallThickness, innerWallHeight/2, 5, 3, 0, 1.5, tower2PosX+sTowerSize, 0,tower2PosZ, 0, materialMuralha, false);
  createWallWithWindow(sTowerSize, wallThickness, innerWallHeight/2, 5, 3, 0, 1.5, tower2PosX+sTowerSize, innerWallHeight/2,tower2PosZ, 0, materialMuralha, false);

  // Primeiro andar
  createFloor(halfW, sTowerSize, 0.01, -halfW/2, 0, halfD-sTowerSize/2);
  createFloor(sTowerSize, halfD, 0.01, sTowerSize/2-halfW, 0, halfD/2);

  // Segundo andar
  createFloor(halfW, sTowerSize, platformHeight, -halfW/2, platformY/2, halfD-sTowerSize/2);
  createFloor(sTowerSize-platformDepth+wallThickness-1, halfD, platformHeight, platformDepth-halfW+wallThickness/2-0.5, platformY/2, halfD/2);
  createFloor(platformDepth+1, halfD-cornerRadius-sTowerSize/2-platformY/2, platformHeight, sTowerSize-halfW-platformDepth/2-wallThickness/2, platformY/2, sTowerSize/2+platformY/2+(halfD-cornerRadius-sTowerSize/2-platformY/2)/2);
  createFloor(platformDepth+1, sTowerSize/2, platformHeight, sTowerSize-halfW-platformDepth/2-wallThickness/2, platformY/2, sTowerSize/4);

  // Teto
  createFloor(halfW, sTowerSize, platformHeight, wallThickness/2-halfW/2, platformY, halfD-sTowerSize/2-wallThickness/2);
  createFloor(sTowerSize-platformDepth+wallThickness-1, halfD, platformHeight, 2*platformDepth-halfW+0.5, platformY, halfD/2-wallThickness/2);
  createFloor(platformDepth+1, halfD-cornerRadius-sTowerSize/2-platformY/2, platformHeight, platformDepth/2-halfW+0.5, platformY, sTowerSize/2+platformY/2+(halfD-cornerRadius-sTowerSize/2-platformY/4)/2);

  createStairs(platformDepth, platformY/2+platformHeight/2, platformY/2, platformY, 2*wallThickness-halfW, platformY/2, sTowerSize/2+platformY/2, -1);
  createStairs(platformDepth, platformY/2+platformHeight/2, platformY/2, platformY, sTowerSize-halfW-2*wallThickness, 0, sTowerSize/2, 1);

  // ==========================================================
  // 7. CONSTRUÇÃO DO ARMAZEM
  // ==========================================================
  const warehouseWidth = halfW-sTowerSize-wallThickness;
  const warehouseDepth = halfD;

  createWallWithDoor(warehouseWidth, wallThickness/2, innerWallHeight, 3, 5, halfW-warehouseWidth/2-wallThickness/2, 0, 0, materialMuralha, materialMadeira,false);
  createHouseDoor(3, 5, 0.3, halfW-warehouseWidth/2-wallThickness/2, 0, 0, materialMadeira, Math.PI / 2); 
  createWallWithWindow(warehouseDepth/2, wallThickness, innerWallHeight/2, 7, 3, 0, 1.5,halfW-warehouseWidth, 0,-warehouseDepth/4, 90, materialMuralha,false);
  createWallWithWindow(warehouseDepth/2, wallThickness, innerWallHeight/2, 7, 3, 0, 1.5,halfW-warehouseWidth, 0,-3*warehouseDepth/4, 90, materialMuralha,false);
  createWallWithWindow(warehouseDepth/2, wallThickness, innerWallHeight/2, 7, 3, 0, 1.5,halfW-warehouseWidth, innerWallHeight/2,-warehouseDepth/4, 90, materialMuralha,false);
  createWallWithWindow(warehouseDepth/2, wallThickness, innerWallHeight/2, 7, 3, 0, 1.5,halfW-warehouseWidth, innerWallHeight/2,-3*warehouseDepth/4, 90, materialMuralha,false);

  // Primeiro andar
  createFloor(warehouseWidth, warehouseDepth, 0.01, halfW-warehouseWidth/2, 0, -warehouseDepth/2);
  createFloor(offset, halfD-cornerRadius-firstWallWidth-sTowerSize/2, 0.01, halfW+offset/2, 0, -(halfD-cornerRadius)/2);

  // Segundo andar
  createFloor(warehouseWidth, warehouseDepth, platformHeight, halfW-warehouseWidth/2, platformY/2, -warehouseDepth/2);
  createFloor(offset, platformDepth-wallThickness, platformHeight, halfW+offset/2-wallThickness/2, platformY/2,-halfD+firstWallWidth+cornerRadius+platformDepth/2, 0);
  createFloor(offset, offset, platformHeight, halfW+offset/2-wallThickness/2, platformY/2,-sTowerSize/2-offset/2, 0);
  
  // Teto
  createFloor(warehouseWidth, warehouseDepth, platformHeight, halfW-warehouseWidth/2-wallThickness/2, platformY, -warehouseDepth/2+wallThickness/4);
  createFloor(offset, platformDepth-wallThickness, platformHeight, halfW+offset/2-wallThickness/2, platformY,-halfD+firstWallWidth+cornerRadius+platformDepth/2, 0);
  
  createStairs(platformDepth-wallThickness*2, platformY/2, platformY/2+0.1, platformY, halfW+offset-platformDepth/2, platformY/2+platformHeight/2, -sTowerSize, -1);
  createStairs(platformDepth-wallThickness*2, platformY/2+platformHeight/2, platformY/2, platformY, halfW+platformDepth/2-wallThickness*0.5, 0, -sTowerSize-platformY/2, 1);

  return castle;
}

export function createGround(scene) {
  const plane = createGroundPlaneXZ(500, 500);
  scene.add(plane);
  return plane;
}
