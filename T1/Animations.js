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


