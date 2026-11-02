import * as THREE from "three";

/**
 * Anima todas as portas de uma lista, abrindo/fechando conforme
 * a distância do jogador. Funciona para portas de 1 ou N pivôs.
 * Chame isso uma vez por frame, passando a posição da câmera/jogador.
 */
export function animateDoors(doors, playerPosition, delta) {
  const worldPos = new THREE.Vector3();

  for (const door of doors) {
    door.pivots[0].group.getWorldPosition(worldPos);

    const dx = playerPosition.x - worldPos.x;
    const dz = playerPosition.z - worldPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    door.isOpen = distance <= door.triggerDistance;

    for (const pivot of door.pivots) {
      const targetAngle = door.isOpen ? pivot.openAngle : pivot.closedAngle;
      const currentAngle = pivot.group.rotation.y;
      const diff = targetAngle - currentAngle;
      const maxStep = door.openSpeed * delta;

      if (Math.abs(diff) <= maxStep) {
        pivot.group.rotation.y = targetAngle;
      } else {
        pivot.group.rotation.y += Math.sign(diff) * maxStep;
      }
    }
  }
}


const activeFades = [];

// Faz os objetos (e suas luzes) sumirem gradualmente e chama onDone no fim.
// Os materiais são clonados, então objetos que compartilham material não são afetados.
export function fadeOut(objects, { duration = 2, onDone } = {}) {
  const materials = [];
  const lights = [];

  for (const root of objects) {
    root.traverse((o) => {
      if (o.isLight) lights.push({ light: o, base: o.intensity });
      if (!o.isMesh) return;

      const prepare = (material) => {
        const clone = material.clone();
        clone.transparent = true;
        materials.push({ material: clone, base: clone.opacity });
        return clone;
      };
      o.material = Array.isArray(o.material)
        ? o.material.map(prepare)
        : prepare(o.material);
    });
  }

  activeFades.push({ materials, lights, duration, elapsed: 0, onDone });
}

// Chame uma vez por frame
export function updateFades(delta) {
  for (let i = activeFades.length - 1; i >= 0; i--) {
    const fade = activeFades[i];
    fade.elapsed += delta;
    const k = 1 - Math.min(fade.elapsed / fade.duration, 1);

    for (const { material, base } of fade.materials) material.opacity = base * k;
    for (const { light, base } of fade.lights) light.intensity = base * k;

    if (k === 0) {
      activeFades.splice(i, 1);
      fade.onDone?.();
    }
  }
}