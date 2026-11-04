
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

    // Entrega das chaves no altar
    this.altar = null;
    this.altarKeys = []; // chaves voando para o pedestal ou já pousadas
    this.deliveredKeys = 0;
    this.arrivedKeys = 0;
    this.depositTimer = 0;
    this.keyRestOffset = 0.35; // folga entre o topo do pedestal e o centro da chave
    this.onAltarComplete = null;
    this.savedState = null;

    // Geometria e material compartilhados por todas as chaves
    this.keyGeometry = new THREE.SphereGeometry(0.18, 16, 12);
    this.keyMaterial = new THREE.MeshPhongMaterial({
      color: 0x66ffcc,
      emissive: 0x00ffaa,
      shininess: 100,
      specular: 0xffffff,
    });

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
        this.loader.loadAsync("./Models/Octopus.glb"),
        this.loader.loadAsync("./Models/Snail.glb")
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

  // Atalho de teste: derrota todos os inimigos e coleta todas as chaves de uma vez
  defeatAll() {
    this.enemiesSpawned = true; // inimigos ainda não criados (de dia) não nascem mais

    for (const enemy of this.enemies) {
      if (enemy.removed) continue;
      if (!enemy.dead) this.killEnemy(enemy); // solta a chave no chão

      // De dia o fade não roda, então remove na hora
      if (!this.isNight) {
        this.scene.remove(enemy.group);
        enemy.removed = true;
      }
    }

    // Coleta as chaves que acabaram de cair
    for (let i = this.keys.length - 1; i >= 0; i--) this.collectKey(i);

    // Garante o total mesmo que algum inimigo nunca tenha sido criado
    this.keysCollected = this.spawnPoints.length - this.deliveredKeys;
    this.updateKeyCounter();
  }

  // Alterna entre executar a derrota geral e restaurar o estado salvo
  toggleDefeatAll() {
    if (this.savedState) {
      this.restoreState();
    } else {
      this.saveState();
      this.defeatAll();
    }
  }

  saveState() {
    this.savedState = {
      enemiesSpawned: this.enemiesSpawned,
      keysCollected: this.keysCollected,
      raycastTargets: [...this.raycastTargets],
      enemies: this.enemies.map((enemy) => ({
        hp: enemy.hp,
        dead: enemy.dead,
        removed: enemy.removed,
        fadeTime: enemy.fadeTime,
        inScene: enemy.group.parent !== null,
      })),
      keys: this.keys.map((key) => ({
        group: key.group,
        collected: key.collected,
        elapsed: key.elapsed,
        baseY: key.baseY,
        inScene: key.group.parent !== null,
      })),
    };
  }

  restoreState() {
    if (!this.savedState) return;

    const state = this.savedState;

    this.enemiesSpawned = state.enemiesSpawned;

    for (const key of this.keys) {
      if (key.group && key.group.parent) {
        this.scene.remove(key.group);
      }
    }

    this.keys = state.keys.map((savedKey) => {
      if (savedKey.inScene && savedKey.group.parent === null) {
        this.scene.add(savedKey.group);
      }
      return {
        group: savedKey.group,
        collected: savedKey.collected,
        elapsed: savedKey.elapsed,
        baseY: savedKey.baseY,
      };
    });

    this.keysCollected = state.keysCollected;

    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      const savedEnemy = state.enemies[i];

      if (!savedEnemy) continue;

      enemy.hp = savedEnemy.hp;
      enemy.dead = savedEnemy.dead;
      enemy.removed = savedEnemy.removed;
      enemy.fadeTime = savedEnemy.fadeTime;

      for (const mat of enemy.fadeMaterials) mat.opacity = 1;
      for (const mat of enemy.healthMaterials) mat.opacity = 1;
      if (enemy.light) enemy.light.intensity = enemy.baseLightIntensity;

      if (savedEnemy.inScene && enemy.group.parent === null) {
        this.scene.add(enemy.group);
      } else if (!savedEnemy.inScene && enemy.group.parent !== null) {
        this.scene.remove(enemy.group);
      }

      if (!enemy.dead) {
        this.updateHealthBar(enemy);
        if (enemy.mixer) {
          enemy.mixer.stopAllAction();
          const clips = this.animations[enemy.type];
          if (clips && clips.length > 0) {
            enemy.mixer.clipAction(clips[0]).play();
          }
        }
      }
    }

    this.raycastTargets = [...state.raycastTargets];

    this.updateKeyCounter();
    this.savedState = null;
  }

  // Sistema de chaves
  buildKey() {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(this.keyGeometry, this.keyMaterial));
    group.add(new THREE.PointLight(0x00ffaa, 1.5, 4));
    return group;
  }

  createKey(position) {
    const group = this.buildKey();
    group.position.copy(position);
    group.position.y += 0.5;
    this.scene.add(group);

    this.keys.push({
      group,
      collected: false,
      elapsed: 0,
      baseY: group.position.y,
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

  // Define onde fica o altar: center (Vector3) e pedestals (topo de cada pedestal, em coordenadas de mundo)
  setAltar({ center, pedestals, deliverDistance = 7 }) {
    this.altar = { center, pedestals, deliverDistance };
  }

  // Entrega uma chave por vez quando o jogador, carregando chaves, chega perto do altar
  updateAltar(delta, playerPosition) {
    this.updateAltarKeys(delta);

    if (!this.altar || this.keysCollected === 0) return;

    this.depositTimer = Math.max(0, this.depositTimer - delta);
    if (this.depositTimer > 0) return;

    const { center, pedestals, deliverDistance } = this.altar;
    if (this.deliveredKeys >= pedestals.length) return;
    if (playerPosition.distanceTo(center) > deliverDistance) return;

    this.depositKey(playerPosition, pedestals[this.deliveredKeys]);
    this.depositTimer = 0.5; // intervalo entre chaves, para saírem em sequência
  }

  depositKey(from, pedestalTop) {
    const group = this.buildKey();
    const start = from.clone();
    start.y -= 0.5; // sai da altura do peito, não dos olhos
    group.position.copy(start);
    this.scene.add(group);

    this.altarKeys.push({
      group,
      from: start,
      to: pedestalTop.clone().setY(pedestalTop.y + this.keyRestOffset),
      elapsed: 0,
      duration: 1.0,
      arrived: false,
    });

    this.keysCollected--;
    this.deliveredKeys++;
    this.updateKeyCounter();
  }

  // Voo em arco até o pedestal; depois a chave fica girando e flutuando no lugar
  updateAltarKeys(delta) {
    for (const key of this.altarKeys) {
      key.elapsed += delta;

      if (key.arrived) {
        key.group.rotation.y += delta * 1.5;
        key.group.position.y = key.to.y + Math.sin(key.elapsed * 2) * 0.08;
        continue;
      }

      const t = Math.min(key.elapsed / key.duration, 1);
      const ease = t * t * (3 - 2 * t);

      key.group.position.lerpVectors(key.from, key.to, ease);
      key.group.position.y += Math.sin(Math.PI * t) * 1.5; // arco
      key.group.rotation.y += delta * 6;

      if (t >= 1) {
        key.arrived = true;
        key.elapsed = 0;
        if (++this.arrivedKeys === this.altar.pedestals.length) this.onAltarComplete?.();
      }
    }
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
    this.updateAltar(delta, playerPosition);
  }
}
