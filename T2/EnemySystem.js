
import * as THREE from "three";
import { GLTFLoader } from "../build/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "../build/jsm/utils/SkeletonUtils.js";

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

    this.groundHeight = 0.5; // Altura do chão para posicionar os inimigos corretamente

    // Posições iniciais dos quatro inimigos
    this.spawnPoints = spawnPoints || [
      // Térreo do castelo
      { type: "snail", position: [-10, 1, -10] },
      { type: "snail", position: [10, 1, 10] },

      { type: "octopus", position: [15, 20, -37] },
      { type: "octopus", position: [-33, 1.5, 15] }
    ];

    // Carregamento dos modelos 3D.
    this.loader = new GLTFLoader();

    this.models = {
      octopus: null,
      snail: null
    };

    this.animations = {
      octopus: [],
      snail: []
    };

    this.modelsLoaded = false;
    this.isNightMode = false; // Inicialmente, o modo noturno está desativado
    this.enemiesSpawned = false; // Flag para indicar se os inimigos já foram criados

    // Os inimigos só são criados depois que os modelos carregarem
    this.loadModels();
  }

  // Carrega os modelos GLB dos inimigos e suas animações
  async loadModels() {
    try {
      const [octopusGLTF, snailGLTF] = await Promise.all([
        this.loader.loadAsync("./models/Octopus.glb"),
        this.loader.loadAsync("./models/Snail.glb")
      ]);

      // Associa cada modelo ao tipo de inimigo.
      this.models.octopus = octopusGLTF.scene;
      this.models.snail = snailGLTF.scene;

      // Guarda as animações, caso existam.
      this.animations.octopus = octopusGLTF.animations || [];
      this.animations.snail = snailGLTF.animations || [];

      this.modelsLoaded = true;

      console.log("Modelos dos inimigos carregados!");

    } catch (error) {
      console.error("Erro ao carregar os modelos dos inimigos:", error);
    }
  }

  // Cria os inimigos nas posições definidas em spawnPoints
  spawnEnemies() {
    if (!this.modelsLoaded) {
      console.warn("Os modelos dos inimigos ainda não foram carregados.");
      return;
    }

    if (this.enemiesSpawned) { // Verifica se os inimigos já foram criados
      console.warn("Os inimigos já foram criados.");
      return;
    }

    for (const spawn of this.spawnPoints) {
      this.createEnemy(
        spawn.type,
        new THREE.Vector3(...spawn.position)
      );
    }

    this.enemiesSpawned = true; // Marca que os inimigos foram criados
  }

  setNightMode(isNight) {
    this.isNight = isNight;

    // Caso modelos ainda não tenham sido carregados
    if (!this.modelsLoaded) return;

    // Cria os inimigos apenas na primeira noite
    if (isNight && !this.enemiesSpawned) {
      this.spawnEnemies();
    }

    for (const enemy of this.enemies) {
      if (enemy.removed) continue;

      // Mostra ou esconde o inimigo sem destruir seu estado
      enemy.group.visible = isNight;

      // Atualiza os alvos que podem receber tiros
      if (isNight && !enemy.dead) {
        for (const mesh of enemy.meshes) {
          if (!this.raycastTargets.includes(mesh)) {
            this.raycastTargets.push(mesh);
          }
        }
      } else {
        this.raycastTargets = this.raycastTargets.filter(
          mesh => mesh.userData.enemy !== enemy
        );
      }
    }
  }


  // Cria um inimigo do tipo especificado na posição fornecida
  createEnemy(type, position) {
    const isOctopus = type === "octopus";

    if (!this.models[type]) {
      console.error(`Modelo não encontrado para o inimigo: ${type}`);
      return null;
    }

    const enemy = {
      type,
      group: new THREE.Group(),

      hp: isOctopus ? 5 : 3,
      maxHp: isOctopus ? 5 : 3,

      dead: false,
      removed: false,

      meshes: [],
      fadeMaterials: [],

      model: null,
      mixer: null,

      baseY: position.y,
      elapsed: Math.random() * Math.PI * 2,

      floatHeight: isOctopus ? 0.35 : 0,
      healthBarHeight: isOctopus ? 2.25 : 1.35,

      light: null,
      baseLightIntensity: 50,
      lightColor: isOctopus ? 0x32dfff : 0xff3838,

      healthBar: null,
      healthFill: null,
      healthMaterials: [],

      fadeTime: 0
    };

    enemy.group.position.copy(position);

    // Adiciona o modelo GLB ao inimigo
    this.attachModel(enemy);

    // Cria os elementos auxiliares
    this.createHealthBar(enemy);
    this.createEnemyLight(enemy);

    this.scene.add(enemy.group);

    this.enemies.push(enemy);

    // Registra as partes do inimigo que podem receber tiros
    for (const mesh of enemy.meshes) {
      mesh.userData.enemy = enemy;
      this.raycastTargets.push(mesh);
    }

    return enemy;
  }

  // Adiciona o modelo GLB ajustado ao inimigo
  attachModel(enemy) {
    // Clona o modelo original
    // SkeletonUtils preserva corretamente os esqueletos
    const model = SkeletonUtils.clone(
      this.models[enemy.type]
    );

    enemy.model = model;

    // Calcula as dimensões originais do modelo
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    // Altura desejada de cada tipo de inimigo.
    const desiredHeight =
      enemy.type === "octopus" ? 2.0 : 1.2;

    // Evita divisão por zero caso o modelo esteja vazio
    if (size.y <= 0) {
      console.error(
        `O modelo ${enemy.type} possui altura inválida.`
      );
      return;
    }

    // Ajusta a escala proporcionalmente
    const scale = desiredHeight / size.y;

    // Aplica a escala ao modelo
    model.scale.setScalar(scale);

    // Atualiza as matrizes para que o bounding box considere a escala
    model.updateMatrixWorld(true);

    // Calcula os limites reais do modelo já escalado
    const scaledBox = new THREE.Box3().setFromObject(model);

    // Centraliza horizontalmente e alinha a base do modelo ao Y = 0
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

    model.position.x -= scaledCenter.x;
    model.position.y -= scaledBox.min.y;
    model.position.z -= scaledCenter.z;

    model.updateMatrixWorld(true);

    // Ativa sombras e prepara os materiais para o fade
    model.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      // Clona os materiais individualmente
      // Assim, o fade de um inimigo não afeta os outros
      const originalMaterials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      const clonedMaterials = originalMaterials.map((material) => {
        if (!material) return material;

        const lambert = new THREE.MeshLambertMaterial({
          color: material.color ? material.color.clone() : 0xffffff,

          map: material.map || null,

          transparent: true,
          opacity: 1,

          side: material.side,
          depthWrite: true
        });

        enemy.fadeMaterials.push(lambert);

        return lambert;
      });

      child.material = Array.isArray(child.material)
        ? clonedMaterials
        : clonedMaterials[0];

      // Guarda as meshes para o sistema de tiros
      enemy.meshes.push(child);
    });

    enemy.group.add(model);

    // Configura as animações, se o GLB possuir alguma
    const clips = this.animations[enemy.type];

    if (clips && clips.length > 0) {
      enemy.mixer = new THREE.AnimationMixer(model);

      // Executa a primeira animação disponível
      const action = enemy.mixer.clipAction(clips[0]);
      action.play();
    }
  }

  // Cria uma mesh auxiliar
  // Mantida para o núcleo luminoso dos inimigos
  addMesh(enemy, geometry, material, position, scale = null) {
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(...position);

    if (scale) {
      mesh.scale.set(...scale);
    }

    mesh.material = material.clone();
    mesh.material.transparent = true;
    mesh.material.opacity = 1;

    enemy.group.add(mesh);

    enemy.meshes.push(mesh);
    enemy.fadeMaterials.push(mesh.material);

    return mesh;
  }

  createMaterial(color, options = {}) {
    return new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      ...options
    });
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
      enemy.type === "octopus" ? 1.3 : 0.8,
      0
    );

    enemy.group.add(enemy.light);

    // Núcleo luminoso visível para destacar a origem da luz
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
        enemy.type === "octopus" ? 1.3 : 0.5,
        0
      ]
    );
  }

  // Barra de vida
  createHealthBar(enemy) {
    const bar = new THREE.Group();

    const width = 0.9;
    const height = 0.10;

    const backgroundMaterial = new THREE.MeshLambertMaterial({
      color: 0x222222,
      transparent: true,
      depthTest: true
    });

    const fillMaterial = new THREE.MeshLambertMaterial({
      color: 0x35df65,
      transparent: true,
      depthTest: true
    });

    // Fundo da barra
    const background = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      backgroundMaterial
    );

    // Preenchimento da barra
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      fillMaterial
    );

    fill.position.z = 0.001;

    bar.add(background);
    bar.add(fill);

    bar.position.y = enemy.healthBarHeight;
    bar.renderOrder = 1000;

    // Os materiais da barra também participam do fade
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

    // Mantém a barra alinhada pela esquerda
    enemy.healthFill.position.x =
      -(0.9 * (1 - ratio)) / 2;

    // Muda a cor conforme a vida restante
    if (ratio > 0.5) {
      enemy.healthFill.material.color.set(0x35df65);
    } else if (ratio > 0.25) {
      enemy.healthFill.material.color.set(0xffb52e);
    } else {
      enemy.healthFill.material.color.set(0xff3333);
    }
  }

  // Sistema de dano e morte dos inimigos
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

  killEnemy(enemy) {
    if (enemy.dead) return;

    enemy.dead = true;
    enemy.fadeTime = 0;

    // Impede que o inimigo continue recebendo tiros
    this.raycastTargets = this.raycastTargets.filter(
      mesh => mesh.userData.enemy !== enemy
    );

    // Para a animação quando o inimigo morre
    if (enemy.mixer) {
      enemy.mixer.stopAllAction();
    }

    // Solta uma chave na posição do inimigo
    this.createKey(enemy.group.position);
  }

  // Sistema de chaves
  createKey(position) {
    const key = new THREE.Group();

    const keyMaterial = new THREE.MeshPhongMaterial({
      color: 0x66ffcc,
      emissive: 0x00ffaa,
      shininess: 100,
      specular: 0xffffff
    });

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 12),
      keyMaterial
    );

    key.add(sphere);

    // Luz própria da chave
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

  updateKeys(delta, playerPosition) {
    for (let i = this.keys.length - 1; i >= 0; i--) {
      const key = this.keys[i];

      if (key.collected) continue;

      key.elapsed += delta;

      // Flutuação e rotação da chave
      key.group.rotation.y += delta * 1.5;

      key.group.position.y =
        key.baseY + Math.sin(key.elapsed * 2) * 0.12;

      // Verifica a proximidade do jogador
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

    this.updateKeyCounter();

    console.log(
      `Chave coletada! Total: ${this.keysCollected}`
    );
  }

  updateKeyCounter() {
    const counter = document.getElementById("key-counter");
    const count = document.getElementById("key-count");

    if (!counter || !count) return;

    count.textContent = this.keysCollected;

    // Esconde o contador quando não há chaves
    counter.style.display =
      this.keysCollected > 0 ? "flex" : "none";
  }

  // Update geral
  update(
    delta,
    playerPosition = this.camera.position,
    viewCamera = this.camera
  ) {
    if (this.isNight) {
      for (const enemy of this.enemies) {
        if (enemy.removed) continue;

        // Mantém a barra de vida voltada para a câmera
        enemy.healthBar.quaternion.copy(
          viewCamera.quaternion
        );

        // Atualiza as animações enquanto o inimigo está vivo
        if (!enemy.dead && enemy.mixer) {
          enemy.mixer.update(delta);
        }

        // Fade gradual do inimigo morto
        if (enemy.dead) {
          enemy.fadeTime += delta;

          const progress = Math.min(
            enemy.fadeTime / this.fadeDuration,
            1
          );

          const opacity = 1 - progress;

          // Transparência gradual do modelo
          for (const material of enemy.fadeMaterials) {
            material.opacity = opacity;
          }

          // Transparência gradual da barra de vida
          for (const material of enemy.healthMaterials) {
            material.opacity = opacity;
          }

          // Reduz a iluminação até desaparecer
          enemy.light.intensity =
            enemy.baseLightIntensity * opacity;

          if (progress >= 1) {
            this.scene.remove(enemy.group);
            enemy.removed = true;
          }

          continue;
        }

        // Flutuação do espectro
        if (enemy.type === "octopus") {
          enemy.elapsed += delta;

          enemy.group.position.y =
            enemy.baseY +
            Math.sin(enemy.elapsed * 2) * enemy.floatHeight;
        }
      }
    }

    // Verifica a coleta das chaves
    this.updateKeys(delta, playerPosition);
  }
}
