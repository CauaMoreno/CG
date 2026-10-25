import * as THREE from "three";

export class LightingSystem {
  constructor(scene, castle) {
    this.scene = scene;
    this.castle = castle;
    this.lighting = "day"; // Estado inicial da iluminação

    this.fillLight = null;
    this.ambientLight = null;

    this.sceneBox = this.computeCastleBounds();
    this.enableShadowsOnStructure();

    // Cria a iluminação inicial (dia)
    this.changeLightingToDay();
  }

  // Devolve o Object3D de um item (o próprio item ou o que ele guarda)
  toObject3D(item) {
    if (item?.isObject3D) return item;
    return item?.mesh ?? item?.object ?? item?.group ?? null; // ajuste conforme o console.log
  }

  // Todos os elementos da estrutura, já como Object3D
  getStructureItems() {
    const c = this.castle;
    return [
      ...(c.walls ?? []),
      ...(c.floors ?? []),
      ...(c.ramps ?? []),
      ...(c.decor ?? []),
      ...(c.cylinders ?? []),
      ...(c.doors ?? []),
    ]
      .map((item) => this.toObject3D(item))
      .filter(Boolean); // descarta o que não for Object3D
  }

  // Todos os objetos projetam E recebem sombra
  enableShadowsOnStructure() {
    for (const item of this.getStructureItems()) {
      item.traverse((o) => {
        //traverse
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
    }
    // O chão (createGround) normalmente não está nas listas: ele só recebe sombra
    this.scene.traverse((o) => {
      if (o.isMesh) o.receiveShadow = true;
    });
  }

  // Caixa envolvente do castelo, usada para dimensionar a câmera de sombra
  computeCastleBounds() {
    const box = new THREE.Box3();
    for (const item of this.getStructureItems()) box.expandByObject(item);
    return box;
  }

  // Remove tudo que foi criado pela iluminação anterior
  clearLights() {
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      this.ambientLight = null;
    }
    if (this.castle.light) {
      this.scene.remove(this.castle.light);
      if (this.castle.light.target) this.scene.remove(this.castle.light.target);
    }
    if (this.fillLight) {
      this.scene.remove(this.fillLight);
      if (this.fillLight.target) this.scene.remove(this.fillLight.target);
      this.fillLight = null;
    }
  }

  // Cria uma direcional com sombra cobrindo todo o castelo
  createShadowLight(color, intensity, direction) {
    const center = this.sceneBox.getCenter(new THREE.Vector3());
    const size = this.sceneBox.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.75 + 5;
    const dist = radius * 2;

    const light = new THREE.DirectionalLight(color, intensity);
    // posição = centro + direção (de onde a luz vem) * distância
    light.position
      .copy(center)
      .addScaledVector(direction.clone().normalize(), dist);
    light.target.position.copy(center);
    this.scene.add(light.target);

    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    const cam = light.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 0.5;
    cam.far = dist * 2 + radius;
    cam.updateProjectionMatrix();
    light.shadow.bias = -0.0005;
    light.shadow.normalBias = 0.05;
    return light;
  }

  // Direcional fraca, sem sombra, vinda do lado oposto
  createFillLight(color, intensity, mainDirection) {
    const center = this.sceneBox.getCenter(new THREE.Vector3());
    const dist = 100;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position
      .copy(center)
      .addScaledVector(mainDirection.clone().normalize().negate(), dist);
    light.target.position.copy(center);
    light.castShadow = false;
    this.scene.add(light.target);
    return light;
  }

  // ---------- Troca de horário ----------

  changeLighting() {
    this.clearLights(); // remove luz atual
    if (this.lighting === "day") {
      this.changeLightingToNight();
      this.lighting = "night";
    } else {
      this.changeLightingToDay();
      this.lighting = "day";
    }
  }

  // 10h da manhã: Sol alto (~55° de elevação) => sombras curtas
  changeLightingToDay() {
    const dir = new THREE.Vector3(-0.6, 1.0, 0.5);
    this.castle.light = this.createShadowLight(0xfff4d6, 1.8, dir);
    this.scene.add(this.castle.light);

    this.fillLight = this.createFillLight(0xbfd9ff, 0.8, dir);
    this.scene.add(this.fillLight);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(this.ambientLight);

    this.scene.background = new THREE.Color(0x87ceeb);
  }

  // 18h: Lua (~50° de elevação), luz azulada e mais fraca
  changeLightingToNight() {
    const dir = new THREE.Vector3(0.7, 1.0, -0.6);
    this.castle.light = this.createShadowLight(0xaec6ff, 0.9, dir);
    this.scene.add(this.castle.light);

    this.fillLight = this.createFillLight(0x334466, 0.4, dir);
    this.scene.add(this.fillLight);

    this.ambientLight = new THREE.AmbientLight(0x6677aa, 0.6);
    this.scene.add(this.ambientLight);

    this.scene.background = new THREE.Color(0x0a0f24);
  }
}
