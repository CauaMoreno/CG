
import * as THREE from "three";

export class EnemySystem {
  constructor(scene, camera, spawnPoints = null) {
    this.scene = scene;
    this.camera = camera;

    this.enemies = [];
    this.keys = [];
    this.raycastTargets = [];

    this.keysCollected = 0;
    this.pickupDistance = 2.0;

    this.fadeDuration = 1.2;

    // Posições iniciais dos quatro inimigos
    this.spawnPoints = spawnPoints || [
      { type: "crawler", position: [-8, 0, -8] },
      { type: "crawler", position: [8, 0, 8] },
      { type: "wraith", position: [8, 0, -8] },
      { type: "wraith", position: [-8, 0, 8] }
    ];

    this.spawnEnemies();
  }

  // Cria os inimigos nas posições definidas em spawnPoints
  spawnEnemies() {
    for (const spawn of this.spawnPoints) {
      this.createEnemy(
        spawn.type,
        new THREE.Vector3(...spawn.position)
      );
    }
  }

  createEnemy(type, position) {
    const isWraith = type === "wraith";

    const enemy = {
      type,
      group: new THREE.Group(),

      hp: isWraith ? 5 : 3,
      maxHp: isWraith ? 5 : 3,

      dead: false,
      removed: false,

      meshes: [],
      fadeMaterials: [],

      baseY: position.y,
      elapsed: Math.random() * Math.PI * 2,

      light: null,
      baseLightIntensity: isWraith ? 100 : 500,

      healthBar: null,
      healthFill: null,
      healthMaterials: [],

      fadeTime: 0
    };

    enemy.group.position.copy(position);

    if (isWraith) {
      this.createWraith(enemy);
    } else {
      this.createCrawler(enemy);
    }

    this.createHealthBar(enemy);
    this.createEnemyLight(enemy);

    this.scene.add(enemy.group);

    this.enemies.push(enemy);

    // Registra as partes do inimigo que podem receber tiros.
    for (const mesh of enemy.meshes) {
      mesh.userData.enemy = enemy;
      this.raycastTargets.push(mesh);
    }

    return enemy;
  }

  // ==========================================
  // FUNÇÕES AUXILIARES DE MODELAGEM
  // ==========================================

  addMesh(enemy, geometry, material, position, scale = null) {
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(...position);

    if (scale) {
      mesh.scale.set(...scale);
    }

    // Materiais individuais permitem fazer fade
    // sem afetar outros inimigos.
    mesh.material = material.clone();
    mesh.material.transparent = true;
    mesh.material.opacity = 1;

    enemy.group.add(mesh);

    enemy.meshes.push(mesh);
    enemy.fadeMaterials.push(mesh.material);

    return mesh;
  }

  createMaterial(color, options = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      transparent: true,
      ...options
    });
  }

  // Cria tentáculos ou membros alongados entre dois pontos.
  addSegment(enemy, start, end, radius, material) {
    const startVector = new THREE.Vector3(...start);
    const endVector = new THREE.Vector3(...end);

    const direction = new THREE.Vector3()
      .subVectors(endVector, startVector);

    const length = direction.length();

    const geometry = new THREE.CylinderGeometry(
      radius * 0.65,
      radius,
      length,
      8
    );

    const mesh = this.addMesh(
      enemy,
      geometry,
      material,
      [0, 0, 0]
    );

    mesh.position.copy(startVector).add(endVector).multiplyScalar(0.5);

    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize()
    );

    return mesh;
  }

  // ==========================================
  // MODELO 1: ESPECTRO FLUTUANTE
  // ==========================================

  createWraith(enemy) {
    const bodyMaterial = this.createMaterial(0x253a48, {
      metalness: 0.2
    });

    const cloakMaterial = this.createMaterial(0x101b28, {
      side: THREE.DoubleSide
    });

    const eyeMaterial = this.createMaterial(0x7df9ff, {
      emissive: 0x00cfff,
      emissiveIntensity: 3
    });

    // Corpo principal.
    this.addMesh(
      enemy,
      new THREE.SphereGeometry(0.42, 12, 10),
      bodyMaterial,
      [0, 1.35, 0],
      [0.85, 1.15, 0.7]
    );

    // Manto inferior.
    this.addMesh(
      enemy,
      new THREE.ConeGeometry(0.52, 1.05, 8, 1, true),
      cloakMaterial,
      [0, 0.85, 0]
    );

    // Cabeça.
    this.addMesh(
      enemy,
      new THREE.SphereGeometry(0.28, 10, 10),
      bodyMaterial,
      [0, 1.65, 0]
    );

    // Olhos luminosos.
    for (const side of [-1, 1]) {
      this.addMesh(
        enemy,
        new THREE.SphereGeometry(0.055, 8, 8),
        eyeMaterial,
        [side * 0.12, 1.68, 0.235]
      );
    }

    // Braços suspensos.
    this.addSegment(
      enemy,
      [-0.3, 1.3, 0],
      [-0.65, 0.75, 0.1],
      0.12,
      bodyMaterial
    );

    this.addSegment(
      enemy,
      [0.3, 1.3, 0],
      [0.65, 0.75, 0.1],
      0.12,
      bodyMaterial
    );

    // Extremidades inferiores do manto.
    for (const side of [-1, 1]) {
      this.addSegment(
        enemy,
        [side * 0.25, 0.55, 0],
        [side * 0.35, 0.1, 0.1],
        0.09,
        cloakMaterial
      );
    }

    enemy.floatHeight = 0.35;
    enemy.healthBarHeight = 2.25;
    enemy.lightColor = 0x32dfff;
  }

  // ==========================================
  // MODELO 2: ABERRAÇÃO RASTEJANTE
  // ==========================================

  createCrawler(enemy) {
    const bodyMaterial = this.createMaterial(0x38251f);
    const fleshMaterial = this.createMaterial(0x542b2b);

    const eyeMaterial = this.createMaterial(0xff4444, {
      emissive: 0xff0000,
      emissiveIntensity: 2.5
    });

    // Corpo alongado.
    this.addMesh(
      enemy,
      new THREE.SphereGeometry(0.5, 12, 10),
      bodyMaterial,
      [0, 0.4, 0],
      [1.4, 0.65, 0.85]
    );

    // Cabeça.
    this.addMesh(
      enemy,
      new THREE.SphereGeometry(0.32, 10, 10),
      fleshMaterial,
      [0, 0.45, 0.55],
      [1, 0.8, 1]
    );

    // Mandíbula.
    this.addMesh(
      enemy,
      new THREE.ConeGeometry(0.2, 0.4, 6),
      bodyMaterial,
      [0, 0.28, 0.8],
      [1, 1, 1]
    );

    // Olhos.
    for (const side of [-1, 1]) {
      this.addMesh(
        enemy,
        new THREE.SphereGeometry(0.065, 8, 8),
        eyeMaterial,
        [side * 0.17, 0.55, 0.76]
      );
    }

    // Tentáculos arrastados pelo chão.
    const tentacles = [
      {
        start: [-0.45, 0.35, -0.2],
        end: [-0.9, 0.08, -0.9]
      },
      {
        start: [0.45, 0.35, -0.2],
        end: [0.95, 0.08, -0.8]
      },
      {
        start: [-0.35, 0.3, 0.35],
        end: [-0.8, 0.06, 0.95]
      },
      {
        start: [0.35, 0.3, 0.35],
        end: [0.8, 0.06, 1.0]
      }
    ];

    for (const tentacle of tentacles) {
      this.addSegment(
        enemy,
        tentacle.start,
        tentacle.end,
        0.11,
        fleshMaterial
      );
    }

    // Pequenas protuberâncias nas costas.
    for (let i = 0; i < 3; i++) {
      this.addMesh(
        enemy,
        new THREE.ConeGeometry(0.12, 0.35, 6),
        fleshMaterial,
        [(i - 1) * 0.3, 0.78, -0.1]
      );
    }

    enemy.floatHeight = 0;
    enemy.healthBarHeight = 1.35;
    enemy.lightColor = 0xff3838;
  }

  // Iluminação do inimigo
  createEnemyLight(enemy) {
    enemy.light = new THREE.PointLight(
      enemy.lightColor,
      enemy.baseLightIntensity,
      5
    );

    enemy.light.position.set(
      0,
      enemy.type === "wraith" ? 1.3 : 0.8,
      0
    );

    enemy.group.add(enemy.light);

    // Núcleo luminoso visível para destacar a origem da luz.
    const coreMaterial = this.createMaterial(enemy.lightColor, {
      emissive: enemy.lightColor,
      emissiveIntensity: 2.5
    });

    this.addMesh(
      enemy,
      new THREE.SphereGeometry(0.08, 8, 8),
      coreMaterial,
      [
        0,
        enemy.type === "wraith" ? 1.3 : 0.5,
        0
      ]
    );
  }

  // Cria a barra de vida acima do inimigo
  createHealthBar(enemy) {
    const bar = new THREE.Group();

    const width = 0.9;
    const height = 0.10;

    const backgroundMaterial = new THREE.MeshBasicMaterial({
      color: 0x222222,
      transparent: true,
      depthTest: false
    });

    const fillMaterial = new THREE.MeshBasicMaterial({
      color: 0x35df65,
      transparent: true,
      depthTest: false
    });

    // Fundo da barra.
    const background = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      backgroundMaterial
    );

    // Preenchimento da barra.
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      fillMaterial
    );

    fill.position.z = 0.001;

    bar.add(background);
    bar.add(fill);

    bar.position.y = enemy.healthBarHeight;

    bar.renderOrder = 1000;

    // Os materiais da barra também participam do fade.
    enemy.healthMaterials = [
      backgroundMaterial,
      fillMaterial
    ];

    enemy.group.add(bar);

    enemy.healthBar = bar;
    enemy.healthFill = fill;

    this.updateHealthBar(enemy);
  }

  updateHealthBar(enemy) {
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);

    enemy.healthFill.scale.x = ratio;

    // Mantém a barra alinhada pela esquerda.
    enemy.healthFill.position.x =
      -(0.9 * (1 - ratio)) / 2;

    // Muda a cor conforme a vida restante.
    if (ratio > 0.5) {
      enemy.healthFill.material.color.set(0x35df65);
    } else if (ratio > 0.25) {
      enemy.healthFill.material.color.set(0xffb52e);
    } else {
      enemy.healthFill.material.color.set(0xff3333);
    }
  }

  // Lida o dano recebido pelo inimigo, atualiza a barra de vida e verifica se ele morreu.
  damageEnemy(enemy, damage = 1) {
    if (!enemy || enemy.dead) return;

    enemy.hp = Math.max(0, enemy.hp - damage);

    this.updateHealthBar(enemy);

    console.log(
      `${enemy.type}: ${enemy.hp}/${enemy.maxHp} HP`
    );

    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    }
  }

  // Marca o inimigo como morto, inicia o fade e remove-o da lista de alvos de tiro.
  killEnemy(enemy) {
    if (enemy.dead) return;

    enemy.dead = true;
    enemy.fadeTime = 0;

    // Impede que o inimigo continue recebendo tiros.
    this.raycastTargets = this.raycastTargets.filter(
      mesh => mesh.userData.enemy !== enemy
    );

    // Solta uma chave na posição do inimigo.
    this.createKey(enemy.group.position);
  }

  // Criação das chaves que o jogador pode coletar.
  createKey(position) {
    const key = new THREE.Group();

    const keyMaterial = new THREE.MeshStandardMaterial({
      color: 0x66ffcc,
      emissive: 0x00ffaa,
      emissiveIntensity: 3,
      metalness: 0.2,
      roughness: 0.2
    });

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 12),
      keyMaterial
    );

    key.add(sphere);

    // Luz própria da chave.
    const light = new THREE.PointLight(
      0x00ffaa,
      1.5,
      4
    );

    light.position.set(0, 0, 0);

    key.add(light);

    key.position.copy(position);
    key.position.y += 0.5;

    this.scene.add(key);

    this.keys.push({
      group: key,
      collected: false,
      elapsed: 0,
      baseY: key.position.y
    });
  }

  // Atualiza a posição e rotação das chaves e verifica se o jogador está próximo o suficiente para coletá-las.
  updateKeys(delta, playerPosition) {
    for (let i = this.keys.length - 1; i >= 0; i--) {
      const key = this.keys[i];

      if (key.collected) continue;

      key.elapsed += delta;

      // Flutuação e rotação da chave.
      key.group.rotation.y += delta * 1.5;

      key.group.position.y =
        key.baseY + Math.sin(key.elapsed * 2) * 0.12;

      // Verifica a proximidade do jogador.
      const distance = playerPosition.distanceTo(
        key.group.position
      );

      if (distance <= this.pickupDistance) {
        this.collectKey(i);
      }
    }
  }

  collectKey(index) {
    const key = this.keys[index];

    if (!key || key.collected) return;

    key.collected = true;

    this.scene.remove(key.group);

    this.keys.splice(index, 1);

    this.keysCollected++;

    console.log(
      `Chave coletada! Total: ${this.keysCollected}`
    );
  }

  // Update geral
  update(delta, playerPosition = this.camera.position, viewCamera = this.camera) {
    for (const enemy of this.enemies) {
      if (enemy.removed) continue;

      // Mantém a barra de vida voltada para a câmera.
      enemy.healthBar.quaternion.copy(
        viewCamera.quaternion
      );

      if (enemy.dead) {
        enemy.fadeTime += delta;

        const progress = Math.min(
          enemy.fadeTime / this.fadeDuration,
          1
        );

        const opacity = 1 - progress;

        // Transparência gradual.
        for (const material of enemy.fadeMaterials) {
          material.opacity = opacity;
        }

        for (const material of enemy.healthMaterials) {
          material.opacity = opacity;
        }

        // Reduz a iluminação até desaparecer.
        enemy.light.intensity =
          enemy.baseLightIntensity * opacity;

        if (progress >= 1) {
          this.scene.remove(enemy.group);
          enemy.removed = true;
        }

        continue;
      }

      // Flutuação suave do espectro.
      if (enemy.type === "wraith") {
        enemy.elapsed += delta;

        enemy.group.position.y =
          enemy.baseY +
          Math.sin(enemy.elapsed * 2) * enemy.floatHeight;
      }
    }

    // Verifica a coleta das chaves.
    this.updateKeys(delta, playerPosition);
  }
}