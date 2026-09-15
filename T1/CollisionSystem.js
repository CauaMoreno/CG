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


    checkGroundAndRamps(targetPosition, floors, ramps) {

        this.raycasterDown.ray.origin.copy(targetPosition);

        // Começa o raio um pouco acima da câmera
        this.raycasterDown.ray.origin.y += 0.5;

        const allObjects = [
            ...floors,
            ...ramps
        ];

        const intersects =
            this.raycasterDown.intersectObjects(allObjects, true);

        if (intersects.length > 0) {

            const hit = intersects[0];

            // Altura dos olhos/câmera em relação ao chão
            return hit.point.y + this.playerHeight;
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
}