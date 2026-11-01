
import * as THREE from "three";

export class ShootingSystem {
  constructor(scene, camera, castle, enemySystem) {
    this.scene = scene;
    this.camera = camera;
    this.castle = castle;
    this.enemySystem = enemySystem;

    this.projectiles = []; // Vetor para armazenar os projéteis ativos

    // Configurações dos disparos
    this.projectileSpeed = 60;
    this.maxDistance = 100;
    this.fireRate = 0.25; // Tempo mínimo entre disparos em segundos
    this.timeSinceLastShot = this.fireRate;

    // Criação dos assets da besta e do dardo
    this.createWeapon();
    this.createDartGeometry();

    // Estado da besta
    this.loadedDart = null;
    this.isLoaded = false;

    // Cria o primeiro dardo encaixado na besta
    this.loadDart();

    // Vetores reutilizáveis
    this.direction = new THREE.Vector3(); // Direção do disparo
    this.muzzlePosition = new THREE.Vector3(); // Posição do cano da besta
    this.nextPosition = new THREE.Vector3(); // Próxima posição do projétil
    this.movement = new THREE.Vector3(); // Movimento do projétil
    this.localMuzzle = new THREE.Vector3(0.35, -0.28, -1.15); // Posição do cano da besta em relação à câmera
    this.forward = new THREE.Vector3(0, 0, 1); // Vetor de direção para frente +Z

    this.raycaster = new THREE.Raycaster(); // Raycaster para detecção de colisões
  }

  // Criação do modelo da besta
  createWeapon() {
    this.weapon = new THREE.Group();

    // Materiais
    const wood = new THREE.MeshLambertMaterial({
      color: 0x51301b,
      roughness: 0.85
    });

    const darkWood = new THREE.MeshLambertMaterial({
      color: 0x302016,
      roughness: 0.9
    });

    const metal = new THREE.MeshLambertMaterial({
      color: 0x555b61,
      metalness: 0.8,
      roughness: 0.3
    });

    const darkMetal = new THREE.MeshLambertMaterial({
      color: 0x24282c,
      metalness: 0.7,
      roughness: 0.4
    });

    // Função auxiliar para criar peças
    const addBox = (size, position, material, rotation = null) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(...size),
        material
      );

      mesh.position.set(...position);

      if (rotation) {
        mesh.rotation.set(...rotation);
      }

      this.weapon.add(mesh);
      return mesh;
    };

    // Corpo principal da besta
    addBox(
      [0.17, 0.16, 0.85],
      [0, 0, 0],
      wood
    );

    // Acabamento superior do corpo
    addBox(
      [0.20, 0.045, 0.55],
      [0, 0.10, -0.03],
      darkWood
    );

    // Trilho metálico superior
    addBox(
      [0.055, 0.025, 0.75],
      [0, 0.115, -0.03],
      metal
    );

    // Empunhadura
    const grip = addBox(
      [0.15, 0.38, 0.19],
      [0, -0.23, 0.24],
      darkWood,
      [-0.2, 0, 0]
    );

    // Base da empunhadura
    addBox(
      [0.19, 0.045, 0.23],
      [0, -0.43, 0.27],
      metal
    );

    // Gatilho
    const trigger = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.012, 8, 16, Math.PI),
      darkMetal
    );

    trigger.position.set(0, -0.12, 0.31);
    trigger.rotation.x = Math.PI / 2;
    this.weapon.add(trigger);

    addBox(
      [0.035, 0.12, 0.035],
      [0, -0.08, 0.22],
      metal
    );

    // Arco transversal da besta
    const bow = addBox(
      [1.0, 0.085, 0.12],
      [0, 0.025, -0.34],
      darkMetal
    );

    // Revestimento de madeira nas extremidades
    addBox(
      [0.27, 0.105, 0.14],
      [-0.37, 0.025, -0.34],
      wood,
      [0, 0, -0.12]
    );

    addBox(
      [0.27, 0.105, 0.14],
      [0.37, 0.025, -0.34],
      wood,
      [0, 0, 0.12]
    );

    // Reforço metálico central
    addBox(
      [0.15, 0.15, 0.16],
      [0, 0.025, -0.34],
      metal
    );

    // Corda do arco
    const stringGeometry = new THREE.BufferGeometry();

    // Pontos da corda
    const stringPoints = [
      // Parafuso esquerdo
      new THREE.Vector3(-0.39, 0.085, -0.34),

      // Encontro com a parte traseira do dardo
      new THREE.Vector3(0, 0.15, 0.235),

      // Parafuso direito
      new THREE.Vector3(0.39, 0.085, -0.34)
    ];

    stringGeometry.setFromPoints(stringPoints);

    const bowString = new THREE.Line(
      stringGeometry,
      new THREE.MeshLambertMaterial({
        color: 0xd6c5a0
      })
    );

    this.weapon.add(bowString);

    // Pequenos parafusos metálicos
    for (const side of [-1, 1]) {
      const screw = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.015, 12),
        metal
      );

      screw.rotation.z = Math.PI / 2;
      screw.position.set(side * 0.39, 0.085, -0.34);

      this.weapon.add(screw);
    }

    // Posição da arma em relação à câmera
    this.weapon.position.set(0.35, -0.30, -0.65);

    this.camera.add(this.weapon);
  }

  // Criação do modelo do dardo
  createDartGeometry() {
    this.dartMaterial = {
      shaft: new THREE.MeshLambertMaterial({
        color: 0x49301e,
        roughness: 0.8
      }),

      metal: new THREE.MeshLambertMaterial({
        color: 0x9ca5aa,
        metalness: 0.9,
        roughness: 0.25
      }),

      feather: new THREE.MeshLambertMaterial({
        color: 0x8b2525,
        side: THREE.DoubleSide,
        roughness: 0.8
      })
    };

    this.dartGeometry = new THREE.Group();

    // Haste principal
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.75, 8),
      this.dartMaterial.shaft
    );

    shaft.rotation.x = Math.PI / 2;
    this.dartGeometry.add(shaft);

    // Ponta metálica
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.20, 8),
      this.dartMaterial.metal
    );

    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.46;
    this.dartGeometry.add(tip);

    // Anel metálico próximo à ponta
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.033, 0.033, 0.035, 8),
      this.dartMaterial.metal
    );

    ring.rotation.x = Math.PI / 2;
    ring.position.z = 0.34;
    this.dartGeometry.add(ring);

    // Penas
    for (let i = 0; i < 3; i++) {
      const feather = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, 0.12, 0.19),
        this.dartMaterial.feather
      );

      feather.position.set(0, 0, -0.27);

      // Distribui as penas ao redor da haste
      feather.rotation.z = (Math.PI * 2 * i) / 3;

      this.dartGeometry.add(feather);
    }
  }

  createDart() {
    // Cada disparo possui seu próprio grupo visual
    const dart = this.dartGeometry.clone();

    dart.traverse((child) => {
      if (child.isMesh) {
        child.geometry = child.geometry;
        child.material = child.material;
      }
    });

    return dart;
  }

  loadDart() {
    if (this.isLoaded) return;

    const dart = this.createDart();

    dart.scale.setScalar(0.75);

    dart.position.set(0, 0.15, -0.05);

    // A ponta do modelo originalmente aponta para +Z.
    dart.rotation.set(0, Math.PI, 0);

    this.weapon.add(dart);

    this.loadedDart = dart;
    this.isLoaded = true;
  }

  // Função para disparar o dardo
  shoot() {
    // Só dispara se houver um dardo carregado
    if (!this.isLoaded || !this.loadedDart) {
      return;
    }

    if (this.timeSinceLastShot < this.fireRate) {
      return;
    }

    this.timeSinceLastShot = 0;

    // Obtém a direção da câmera
    this.camera.getWorldDirection(this.direction);

    // Guarda a posição mundial do dardo antes de removê-lo da arma
    const dart = this.loadedDart;

    dart.getWorldPosition(this.muzzlePosition);

    // Retira o dardo da besta
    this.weapon.remove(dart);

    this.loadedDart = null;
    this.isLoaded = false;

    // Transfere o mesmo objeto para a cena
    this.scene.add(dart);

    dart.position.copy(this.muzzlePosition);

    // Orienta o dardo na direção da câmera
    dart.quaternion.setFromUnitVectors(
      this.forward,
      this.direction
    );

    // Define a velocidade do projétil
    dart.userData.velocity = this.direction
      .clone()
      .multiplyScalar(this.projectileSpeed);

    dart.userData.distanceTraveled = 0;

    this.projectiles.push(dart);
  }

  // Atualiza a posição dos projéteis e verifica colisões
  update(delta) {
    this.timeSinceLastShot += delta;

    // Recarrega a besta quando a cadência permitir
    if (!this.isLoaded && this.timeSinceLastShot >= this.fireRate) {
      this.loadDart();
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];

      const oldPosition = projectile.position.clone();

      this.movement
        .copy(projectile.userData.velocity)
        .multiplyScalar(delta);

      this.nextPosition
        .copy(oldPosition)
        .add(this.movement);

      const movementDistance = this.movement.length();

      // Verifica colisões utilizando Raycast
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
          ...this.enemySystem.raycastTargets
        ];

        const intersections = this.raycaster.intersectObjects(
          objects,
          true
        );

        if (intersections.length > 0) {
          const hit = intersections[0];

          const enemy = hit.object.userData.enemy;

          if(enemy) {
            this.enemySystem.damageEnemy(enemy, 1);
          }
          
          this.removeProjectile(i);
          continue;
        }
      }

      projectile.position.copy(this.nextPosition);

      projectile.userData.distanceTraveled += movementDistance;

      if (
        projectile.userData.distanceTraveled >= this.maxDistance
      ) {
        this.removeProjectile(i);
      }
    }
  }

  // Remove o projétil da cena e do vetor de projéteis ativos
  removeProjectile(index) {
    const projectile = this.projectiles[index];

    this.scene.remove(projectile);

    // Os modelos compartilham geometrias e materiais, então não é necessário descartar explicitamente

    this.projectiles.splice(index, 1);
  }
}
