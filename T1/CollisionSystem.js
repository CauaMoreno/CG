import * as THREE from 'three';

export class CollisionSystem {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.raycasterDown = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 3);
        this.raycasterForward = new THREE.Raycaster();
        this.playerRadius = 0.8; // importante pra checkwallcollision define o tamanho do player
    }

    checkGroundAndRamps(targetPosition, floors, ramps) { //retorna a altura do chao ou rampa se intersectar, senao retorna null
        this.raycasterDown.ray.origin.copy(targetPosition);
        this.raycasterDown.ray.origin.y += 1.0; // raio comeca acima dos pes
        const allObjects = [...floors, ...ramps];
        const intersects = this.raycasterDown.intersectObjects(allObjects, true); //verifica se intersecta com o chao ou rampas
        if (intersects.length > 0) {
            const hit = intersects[0]; //define o hit como o primeiro objeto que intersecta
            const desiredHeight = 2.0; 
            if (hit.distance < desiredHeight + 0.5) { // se a distancia do hit for menor que a altura desejada retorna a altura do hit + a altura desejada
                return hit.point.y + desiredHeight;
            }
        }
        return null; 
    }

    checkWallCollision(targetPosition, walls) { //retorna true se colidir
        const playerBox = new THREE.Box3(  // box do player, pega posicao e faz o tamanho da box com base no raio do player
            new THREE.Vector3(targetPosition.x - this.playerRadius, targetPosition.y - 2, targetPosition.z - this.playerRadius),
            new THREE.Vector3(targetPosition.x + this.playerRadius, targetPosition.y, targetPosition.z + this.playerRadius)
        );
        for (let wall of walls) { // para cada parede verifica se intersecta
            wall.updateMatrixWorld(); // acho que precisa disso, fiz o codigo e falou que faltou
            const wallBox = new THREE.Box3().setFromObject(wall);

            if (playerBox.intersectsBox(wallBox)) {
                return true; 
            }
        }
        return false;
    }
}
