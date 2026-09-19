import * as THREE from "three";

export class CollisionSystem {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.raycasterDown = new THREE.Raycaster(
      new THREE.Vector3(),
      new THREE.Vector3(0, -1, 0),
      0,
      10,
    );
    this.raycasterForward = new THREE.Raycaster();
    this.playerRadius = 0.8;
    this.playerHeight = 2.0;

    // Estado físico — precisa existir antes do primeiro calculateCollision
    this.gravity = 9.8;
    this.verticalVelocity = 0;
    this.isGrounded = false;
    this.currentRamp = null;
  }

  checkGround(targetPosition, floors) {
    this.raycasterDown.ray.origin.copy(targetPosition);
    // Começa o raio um pouco acima da câmera
    this.raycasterDown.ray.origin.y += 0.5;
    const intersects = this.raycasterDown.intersectObjects(floors, true);
    if (intersects.length > 0) {
      const hit = intersects[0];
      return hit.point.y + this.playerHeight;
    }
    return null;
  }

  checkRamp(targetPosition, ramps) {
    this.raycasterDown.ray.origin.copy(targetPosition);
    // Começa o raio um pouco acima da câmera
    this.raycasterDown.ray.origin.y += 0.5;
    const intersects = this.raycasterDown.intersectObjects(ramps, true);
    if (intersects.length > 0) {
      const hit = intersects[0];
      // Normal da superfície da rampa em coordenadas de mundo
      const normal = hit.face.normal.clone();
      normal.applyNormalMatrix(
        new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld),
      );
      normal.normalize();
      return {
        height: hit.point.y + this.playerHeight,
        normal: normal,
        point: hit.point.clone(),
      };
    }
    return null;
  }

  checkWallCollision(targetPosition, walls) {
    const playerBox = new THREE.Box3(
      new THREE.Vector3(
        targetPosition.x - this.playerRadius,
        targetPosition.y - this.playerHeight,
        targetPosition.z - this.playerRadius,
      ),

      new THREE.Vector3(
        targetPosition.x + this.playerRadius,
        targetPosition.y,
        targetPosition.z + this.playerRadius,
      ),
    );

    for (let wall of walls) {
      wall.updateMatrixWorld();

      const wallBox = new THREE.Box3().setFromObject(wall);

      if (playerBox.intersectsBox(wallBox)) {
        return true;
      }
    }

    return false;
  }

  checkCylinderCollision(targetPosition, cylinders) {
    const resolved = targetPosition.clone();
    let collided = false;

    for (const cyl of cylinders) {
      if (targetPosition.y - this.playerHeight > cyl.height) continue;

      const dx = targetPosition.x - cyl.x;
      const dz = targetPosition.z - cyl.z;
      const dist = Math.hypot(dx, dz);
      const minDist = cyl.outerRadius + this.playerRadius;

      if (dist < minDist && dist > 1e-4) {
        const push = minDist - dist;
        const nx = dx / dist;
        const nz = dz / dist;
        resolved.x += nx * push;
        resolved.z += nz * push;
        collided = true;
      }
    }

    return { position: resolved, collided };
  }

  calculateCollision(castle, controls, oldPosition, delta) {
    const walls = castle.walls;
    const floors = castle.floors;
    const ramps = castle.ramps;
    const cylinders = castle.cylinders;

    this.applyRampSlideMovement(controls, oldPosition);
    this.resolveCylinderCollision(controls, oldPosition, cylinders);
    this.resolveWallCollision(controls, oldPosition, walls);

    const { surfaceHeight, surfaceType, ramp } = this.detectSurface(
      controls.object.position,
      floors,
      ramps,
    );

    if (surfaceType === "ramp" && this.isGrounded) {
      this.snapToRamp(controls, ramp);
      return;
    }

    this.resolveVerticalMovement(
      controls,
      delta,
      surfaceHeight,
      surfaceType,
      ramp,
    );
  }


   // Se o jogador está sobre uma rampa, projeta o movimento planar
   // (X/Z) sobre o plano inclinado, em vez de deixá-lo "flutuar" reto.
   
  applyRampSlideMovement(controls, oldPosition) {
    if (!this.isGrounded || this.currentRamp === null) return;

    const targetPosition = controls.object.position.clone();
    const movement = new THREE.Vector3(
      targetPosition.x - oldPosition.x,
      0,
      targetPosition.z - oldPosition.z,
    ).projectOnPlane(this.currentRamp.normal);

    controls.object.position.copy(oldPosition);
    controls.object.position.add(movement);
  }

   // Empurra o jogador para fora de torres/colunas cilíndricas.
   // Mantém a altura (Y) inalterada — só resolve X/Z.
   
  resolveCylinderCollision(controls, oldPosition, cylinders) {
    const cylinderResult = this.checkCylinderCollision(
      controls.object.position,
      cylinders,
    );
    controls.object.position.set(
      cylinderResult.position.x,
      oldPosition.y,
      cylinderResult.position.z,
    );
  }

   //Testa e resolve colisão contra paredes, eixo por eixo (X depois Z),
  resolveWallCollision(controls, oldPosition, walls) {
    const targetPositionAfterCylinder = controls.object.position.clone();

    // Colisão Eixo X
    controls.object.position.set(
      targetPositionAfterCylinder.x,
      oldPosition.y,
      oldPosition.z,
    );
    if (this.checkWallCollision(controls.object.position, walls)) {
      controls.object.position.x = oldPosition.x;
    }

    // Colisão Eixo Z
    const xAfterCollision = controls.object.position.x;
    controls.object.position.set(
      xAfterCollision,
      oldPosition.y,
      targetPositionAfterCylinder.z,
    );
    if (this.checkWallCollision(controls.object.position, walls)) {
      controls.object.position.z = oldPosition.z;
    }
  }

   //Verifica chão e rampa na posição atual e decide qual "vence"
   //(a de maior altura, para não afundar sob uma rampa quando há chão embaixo).
  detectSurface(position, floors, ramps) {
    const groundHeight = this.checkGround(position, floors);
    const ramp = this.checkRamp(position, ramps);

    let surfaceHeight = null;
    let surfaceType = null;

    if (groundHeight !== null) {
      surfaceHeight = groundHeight;
      surfaceType = "ground";
    }

    if (
      ramp !== null &&
      (surfaceHeight === null || ramp.height > surfaceHeight)
    ) {
      surfaceHeight = ramp.height;
      surfaceType = "ramp";
    }

    return { surfaceHeight, surfaceType, ramp };
  }
  
   //Gruda o jogador na altura da rampa quando ele já está apoiado nela   
  snapToRamp(controls, ramp) {
    controls.object.position.y = ramp.height;
    this.verticalVelocity = 0;
    this.currentRamp = ramp;
  }

  // Aplica gravidade e resolve aterrissagem em chão/rampa.
  resolveVerticalMovement(controls, delta, surfaceHeight, surfaceType, ramp) {
    this.verticalVelocity -= this.gravity * delta;
    controls.object.position.y += this.verticalVelocity * delta;

    const hasLanded =
      surfaceHeight !== null &&
      controls.object.position.y <= surfaceHeight &&
      this.verticalVelocity <= 0;

    if (hasLanded) {
      controls.object.position.y = surfaceHeight;
      this.verticalVelocity = 0;
      this.isGrounded = true;
      this.currentRamp = surfaceType === "ramp" ? ramp : null;
    } else {
      this.isGrounded = false;
      this.currentRamp = null;
    }
  }
}
