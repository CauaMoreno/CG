import * as THREE from "three";
import { Octree } from "../build/jsm/math/Octree.js";
import { Capsule } from "../build/jsm/math//Capsule.js";


export class CollisionSystem {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;

    // Jogador (a câmera fica na altura dos olhos)
    this.playerRadius = 0.8;
    this.playerHeight = 2.0;

    // Estado físico
    this.gravity = 25;
    this.verticalVelocity = 0;
    this.isGrounded = false;

    // Ajustes
    this.maxIterations = 4; // iterações de resolução por sub-passo (cantos)
    this.maxSubSteps = 8; // limite de sub-passos por frame (evita atravessar paredes)
    this.groundSnapDistance = 0.35; // "cola" no chão ao descer rampas/degraus
    this.cylinderSegments = 32; // resolução dos cilindros auxiliares
    this.maxDelta = 1 / 30; // limite do delta por frame (evita saltos após travadas)
    this.maxFallSpeed = 40; // velocidade máxima de queda
    this.debug = false; // true: imprime no console o que entrou na Octree
    this._stats = {};

    // Octree e controle de reconstrução
    this.worldOctree = null;
    this._signature = "";

    // Objetos reutilizados (evita criar lixo a cada frame)
    this._capsule = new Capsule(
      new THREE.Vector3(),
      new THREE.Vector3(),
      this.playerRadius,
    );
    this._move = new THREE.Vector3();
    this._ray = new THREE.Ray(
      new THREE.Vector3(),
      new THREE.Vector3(0, -1, 0),
    );
    this._normal = new THREE.Vector3();
  }

  // ---------------------------------------------------------------
  // OCTREE
  // ---------------------------------------------------------------

  /** Força a reconstrução da Octree no próximo frame. */
  invalidate() {
    this.worldOctree = null;
    this._signature = "";
  }

  /** Aceita um item, um array ou null e devolve sempre um array. */
  _asArray(value) {
    if (value === null || value === undefined) return [];
    return Array.isArray(value) ? value : [value];
  }

  _computeSignature(structures, grounds) {
    const parts = structures.map((s) =>
      [
        s.walls.length,
        s.floors.length,
        s.ramps.length,
        s.cylinders.length,
      ].join(","),
    );
    parts.push(grounds.map((g) => g.uuid).join(","));
    return parts.join("|");
  }

  ensureWorldOctree(structures, grounds) {
    const signature = this._computeSignature(structures, grounds);
    if (this.worldOctree === null || signature !== this._signature) {
      this.buildWorldOctree(structures, grounds);
      this._signature = signature;
    }
  }

  /**
   * Constrói a Octree antecipadamente (chame uma vez depois de criar a cena).
   * Assim a montagem, que pode demorar, não acontece dentro do loop de render.
   */
  prepare(structures, ground) {
    this.ensureWorldOctree(this._asArray(structures), this._asArray(ground));
  }

  buildWorldOctree(structures, grounds) {
    const octree = new Octree();
    this._stats = {};

    for (const structure of structures) {
      for (const obj of structure.walls) this._addObject(octree, obj, "walls");
      for (const obj of structure.floors) this._addObject(octree, obj, "floors");
      for (const obj of structure.ramps) this._addObject(octree, obj, "ramps");
      for (const cyl of structure.cylinders) this._addCylinder(octree, cyl);
    }

    for (const ground of grounds) this._addObject(octree, ground, "ground");

    octree.build();
    this.worldOctree = octree;

    if (this.debug) this._printStats(octree);
  }

  _printStats(octree) {
    const { min, max } = octree.box;
    console.log(
      "[Colisão] caixa da Octree:",
      min.toArray().map((v) => +v.toFixed(2)),
      max.toArray().map((v) => +v.toFixed(2)),
    );
    for (const [label, s] of Object.entries(this._stats)) {
      const avgNormalY = s.triangles > 0 ? s.normalYSum / s.triangles : 0;
      console.log(
        "[Colisão] " + label + ": " + s.triangles + " triângulos, " +
          s.skipped + " ignorados (NaN), " + s.filtered +
          " descartados (só face de cima), normal Y média = " +
          avgNormalY.toFixed(2),
      );
    }
  }

  /** Adiciona os triângulos reais de todas as malhas de um objeto. */
  _addObject(octree, root, label = "other") {
    root.traverse((child) => {
      if (!child.isMesh || child.userData.noCollision) return;
      const matrix = this._computeWorldMatrix(child);

      // Rampas em caixa (ex.: a rampa invisível das escadas): só a face de cima
      // é superfície de caminhada. As pontas e a face de baixo, quando a caixa
      // está inclinada, parecem rampas/degraus e faziam o jogador "subir por trás".
      const topOnly =
        label === "ramps" && child.geometry.type === "BoxGeometry";

      this._addGeometry(octree, child.geometry, matrix, label, topOnly);
    });
  }

  /**
   * Calcula a matriz de mundo a partir das matrizes locais, subindo pelos pais.
   * Não depende de matrixWorld estar atualizado (objetos com matrixAutoUpdate = false
   * e matrix montada à mão, como o chão, podem estar com matrixWorld desatualizado).
   */
  _computeWorldMatrix(object) {
    const chain = [];
    for (let o = object; o !== null; o = o.parent) chain.push(o);

    const world = new THREE.Matrix4();
    for (let i = chain.length - 1; i >= 0; i--) {
      const o = chain[i];
      if (o.matrixAutoUpdate) o.updateMatrix();
      world.multiply(o.matrix);
    }
    return world;
  }

  /** Cria um cilindro auxiliar (só para colisão, não vai para a cena). */
  _addCylinder(octree, cyl) {
    const baseY = cyl.baseY ?? 0;
    const geometry = new THREE.CylinderGeometry(
      cyl.outerRadius,
      cyl.outerRadius,
      cyl.height,
      this.cylinderSegments,
    );
    const matrix = new THREE.Matrix4().makeTranslation(
      cyl.x,
      baseY + cyl.height / 2,
      cyl.z,
    );
    this._addGeometry(octree, geometry, matrix, "cylinders");
    geometry.dispose();
  }

  _addGeometry(octree, geometry, matrix, label = "other", topOnly = false) {
    const stats = (this._stats[label] ??= {
      triangles: 0,
      skipped: 0,
      filtered: 0,
      normalYSum: 0,
    });
    // "Cima" local da malha, em coordenadas de mundo (usado só com topOnly)
    const up = new THREE.Vector3(0, 1, 0).transformDirection(matrix);
    const position = geometry.getAttribute("position");
    const index = geometry.index;
    const triCount = (index ? index.count : position.count) / 3;

    for (let i = 0; i < triCount; i++) {
      const i0 = index ? index.getX(i * 3) : i * 3;
      const i1 = index ? index.getX(i * 3 + 1) : i * 3 + 1;
      const i2 = index ? index.getX(i * 3 + 2) : i * 3 + 2;

      const a = new THREE.Vector3().fromBufferAttribute(position, i0);
      const b = new THREE.Vector3().fromBufferAttribute(position, i1);
      const c = new THREE.Vector3().fromBufferAttribute(position, i2);

      a.applyMatrix4(matrix);
      b.applyMatrix4(matrix);
      c.applyMatrix4(matrix);

      // Triângulos com NaN/Infinity corrompem a caixa da Octree (nada colide mais)
      const sum =
        a.x + a.y + a.z + b.x + b.y + b.z + c.x + c.y + c.z;
      if (!Number.isFinite(sum)) {
        stats.skipped++;
        continue;
      }

      const triangle = new THREE.Triangle(a, b, c);
      triangle.getNormal(this._normal);

      if (topOnly && this._normal.dot(up) < 0.99) {
        stats.filtered++;
        continue;
      }

      stats.normalYSum += this._normal.y;
      stats.triangles++;

      octree.addTriangle(triangle);
    }
  }

  // ---------------------------------------------------------------
  // CÁPSULA
  // ---------------------------------------------------------------

  /** Posiciona a cápsula a partir da posição da câmera (olhos). */
  _updateCapsule(position) {
    const feetY = position.y - this.playerHeight;
    const bottomY = feetY + this.playerRadius;
    const topY = Math.max(bottomY, position.y - this.playerRadius);

    this._capsule.start.set(position.x, bottomY, position.z);
    this._capsule.end.set(position.x, topY, position.z);
    this._capsule.radius = this.playerRadius;
  }

  // ---------------------------------------------------------------
  // LOOP PRINCIPAL
  // ---------------------------------------------------------------

  /**
   * Chamado a cada frame, depois que os controles já moveram a câmera.
   * oldPosition = posição antes do movimento deste frame.
   */
  calculateCollision(structures, ground, controls, oldPosition, delta) {
    const structureList = this._asArray(structures);
    const groundList = this._asArray(ground);
    this.ensureWorldOctree(structureList, groundList);

    const pos = controls.object.position;
    const wasGrounded = this.isGrounded;

    // Deslocamento horizontal pedido pelos controles neste frame
    this._move.set(pos.x - oldPosition.x, 0, pos.z - oldPosition.z);

    // Limita o delta: uma travada (ex.: montar a Octree) não pode virar uma queda gigante
    const dt = Math.min(delta, this.maxDelta);

    // Divide o frame em sub-passos: movimentos grandes (horizontais ou de queda)
    // não atravessam paredes finas nem o chão
    const travel = Math.max(
      this._move.length(),
      Math.abs(this.verticalVelocity * dt),
    );
    const steps = THREE.MathUtils.clamp(
      Math.ceil(travel / (this.playerRadius * 0.5)),
      1,
      this.maxSubSteps,
    );
    const stepX = this._move.x / steps;
    const stepZ = this._move.z / steps;
    const stepDelta = dt / steps;

    // A altura é responsabilidade deste sistema: parte da altura anterior
    pos.copy(oldPosition);

    for (let i = 0; i < steps; i++) {
      pos.x += stepX;
      pos.z += stepZ;
      this._step(pos, stepDelta);
    }

    // Ao descer rampas/degraus, evita "voar" alguns frames antes de cair
    if (!this.isGrounded && wasGrounded && this.verticalVelocity <= 0) {
      this._snapToGround(pos);
    }
  }

  /** Um sub-passo: gravidade + resolução de colisões. */
  _step(pos, delta) {
    this.verticalVelocity -= this.gravity * delta;
    if (this.verticalVelocity < -this.maxFallSpeed) {
      this.verticalVelocity = -this.maxFallSpeed;
    }
    pos.y += this.verticalVelocity * delta;

    this.isGrounded = false;

    for (let i = 0; i < this.maxIterations; i++) {
      this._updateCapsule(pos);
      const hit = this.worldOctree.capsuleIntersect(this._capsule);
      if (!hit) break;

      const { normal, depth } = hit;

      if (normal.y > 0.5) {
        // Chão ou rampa: empurra só para cima (não escorrega em rampas)
        pos.y += depth / normal.y;
        this.isGrounded = true;
        if (this.verticalVelocity < 0) this.verticalVelocity = 0;
      } else if (normal.y < -0.5) {
        // Teto
        pos.addScaledVector(normal, depth);
        if (this.verticalVelocity > 0) this.verticalVelocity = 0;
      } else {
        // Parede / torre: empurra para fora e desliza naturalmente
        pos.addScaledVector(normal, depth);
      }
    }
  }

  /** Cola o jogador no chão logo abaixo dos pés, se estiver perto o bastante. */
  _snapToGround(pos) {
    const feetY = pos.y - this.playerHeight;

    this._ray.origin.set(pos.x, feetY + 0.1, pos.z);
    const result = this.worldOctree.rayIntersect(this._ray);
    if (!result) return;

    const distanceBelowFeet = result.distance - 0.1;
    if (distanceBelowFeet > this.groundSnapDistance) return;

    result.triangle.getNormal(this._normal);
    if (this._normal.y < 0.5) return;

    pos.y = result.position.y + this.playerHeight;
    this.verticalVelocity = 0;
    this.isGrounded = true;
  }
}