import * as THREE from "three";

export class ShootingSystem {
  constructor(scene, camera, castle) {
    this.scene = scene;
    this.camera = camera;
    this.castle = castle;

    this.projectiles = []; // Vetor para armazenar os projéteis ativos

    // Configurações do tiro
    this.projectileSpeed = 60;
    this.maxDistance = 100;
    this.projectileRadius = 0.12;

    // Cadência de tiro
    this.fireRate = 0.2; // segundos entre tiros
    this.timeSinceLastShot = this.fireRate; // Tempo do último tiro

    // Geometria/material provisórios
    this.projectileGeometry = new THREE.SphereGeometry(
      this.projectileRadius,
      12,
      12
    );

    this.projectileMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
    });

    // Cria a arma e adiciona à câmera
    this.createWeapon();

    // Vetores reutilizados para evitar criar objetos a cada frame
    this.direction = new THREE.Vector3();
    this.muzzlePosition = new THREE.Vector3();
    this.nextPosition = new THREE.Vector3();
    this.movement = new THREE.Vector3();

    this.raycaster = new THREE.Raycaster();
  }

  createWeapon() {
    const weaponGeometry = new THREE.CylinderGeometry(
      0.12, // raio superior
      0.16, // raio inferior
      1.2,  // comprimento
      16
    );

    const weaponMaterial = new THREE.MeshBasicMaterial({
      color: 0x333333,
    });

    this.weapon = new THREE.Mesh(
      weaponGeometry,
      weaponMaterial
    );

    // Rotaciona a arma para que fique apontando para frente
    this.weapon.rotation.x = -Math.PI / 2;

    // Posição relativa da arma em relação à câmera
    this.weapon.position.set(
      0.0,  // direita
      -0.35, // baixo
      -0.5   // frente

      /*
      0.35,  // direita
      -0.35, // baixo
      -0.8   // frente
      */
    );

    this.camera.add(this.weapon);
  }

  shoot() {

    // Verifica se o tempo desde o último tiro é suficiente
    if (this.timeSinceLastShot < this.fireRate) {
      return; // Não atira se ainda não passou o tempo necessário
    }

    this.timeSinceLastShot = 0; // Reseta o tempo desde o último tiro

    // A direção do tiro é a direção que a câmera está olhando
    this.camera.getWorldDirection(this.direction);

    // Calcula a posição inicial do projétil (muzzle position)
    this.muzzlePosition
      .copy(this.camera.position)
      .addScaledVector(this.direction, 1.0); // Começa 1 unidade à frente da câmera

    const projectile = new THREE.Mesh(
      this.projectileGeometry,
      this.projectileMaterial
    );

    projectile.position.copy(this.muzzlePosition);

    // Informações sobre o projétil
    projectile.userData.velocity =
      this.direction.clone().multiplyScalar(this.projectileSpeed);

    projectile.userData.distanceTraveled = 0;

    this.scene.add(projectile);

    this.projectiles.push(projectile);
  }

  update(delta) {

    // Atualiza o tempo desde o último tiro
    this.timeSinceLastShot += delta;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];

      // Posição anterior do projétil
      const oldPosition = projectile.position.clone();

      // Movimento realizado neste frame
      this.movement
        .copy(projectile.userData.velocity)
        .multiplyScalar(delta);

      // Nova posição
      this.nextPosition
        .copy(oldPosition)
        .add(this.movement);

      // Distância percorrida
      const movementDistance = this.movement.length();

      // Raycast entre a posição anterior e a nova posição
      // Evita que projéteis muito rápidos atravessem paredes entre frames
      if (movementDistance > 0) {
        this.raycaster.set(
          oldPosition,
          this.movement.clone().normalize()
        );

        this.raycaster.far = movementDistance;

        const objects = [
          ...this.castle.walls,
          ...this.castle.floors,
          ...this.castle.ramps,
        ];

        const intersections =
          this.raycaster.intersectObjects(objects, true);

        if (intersections.length > 0) {
          this.removeProjectile(i);
          continue;
        }
      }

      // Move o projétil
      projectile.position.copy(this.nextPosition);

      projectile.userData.distanceTraveled += movementDistance;

      // Remove caso tenha ultrapassado a distância máxima
      if (
        projectile.userData.distanceTraveled >=
        this.maxDistance
      ) {
        this.removeProjectile(i);
      }
    }
  }

  removeProjectile(index) {
    const projectile = this.projectiles[index];

    this.scene.remove(projectile);

    // Geometria e material são compartilhados pelos projéteis, então não dá pra destruir aqui
    // Remove o projétil da lista de projéteis ativos

    this.projectiles.splice(index, 1);
  }
}