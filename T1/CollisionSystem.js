import * as THREE from 'three';

export class CollisionSystem {

    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.raycasterDown = new THREE.Raycaster(
            new THREE.Vector3(),
            new THREE.Vector3(0, -1, 0),
            0,
            10
        );
        this.raycasterForward = new THREE.Raycaster();
        this.playerRadius = 0.8;
        this.playerHeight = 2.0;
    }

    checkGround(targetPosition, floors) {
    this.raycasterDown.ray.origin.copy(targetPosition);
    // Começa o raio um pouco acima da câmera
    this.raycasterDown.ray.origin.y += 0.5;
    const intersects =
        this.raycasterDown.intersectObjects(floors, true);
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
        const intersects =
            this.raycasterDown.intersectObjects(ramps, true);
        if (intersects.length > 0) {
            const hit = intersects[0];
            // Normal da superfície da rampa em coordenadas de mundo
            const normal = hit.face.normal.clone();
            normal.applyNormalMatrix(
                new THREE.Matrix3().getNormalMatrix(
                    hit.object.matrixWorld
                )
            );
            normal.normalize();
            return {
                height: hit.point.y + this.playerHeight,
                normal: normal,
                point: hit.point.clone()
            };
        }
        return null;
    }

    checkWallCollision(targetPosition, walls) {

        const playerBox = new THREE.Box3(
            new THREE.Vector3(
                targetPosition.x - this.playerRadius,
                targetPosition.y - this.playerHeight,
                targetPosition.z - this.playerRadius
            ),

            new THREE.Vector3(
                targetPosition.x + this.playerRadius,
                targetPosition.y,
                targetPosition.z + this.playerRadius
            )
        );


        for (let wall of walls) {

            wall.updateMatrixWorld();

            const wallBox =
                new THREE.Box3().setFromObject(wall);

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
}
