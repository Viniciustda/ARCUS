/**
 * @file drone-model.js
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief A small quadcopter built from simple shapes, with a line and a shadow that show its height.
 */

import * as THREE from 'three';

// Drawn size in metres, much larger than a real UAV so it stays visible over 1.5 km
const DRONE_SPAN_M = 30;
const ROTOR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x9aa3b2, transparent: true, opacity: 0.55 });

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Builds one quadcopter: a body and two crossed arms that take the colour of the UAV, and four rotors.
 *
 * @param material - first material of the body and arms
 * @return the drone group, its origin at the centre of the body, and the meshes that take the colour
 */
export function buildDrone(material) {
  const drone = new THREE.Group();
  const half = DRONE_SPAN_M / 2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(DRONE_SPAN_M * 0.32, DRONE_SPAN_M * 0.14, DRONE_SPAN_M * 0.32), material);
  const coloured = [body];
  drone.add(body);
  const armGeometry = new THREE.BoxGeometry(DRONE_SPAN_M * 1.05, DRONE_SPAN_M * 0.05, DRONE_SPAN_M * 0.07);
  for (const angle of [Math.PI / 4, -Math.PI / 4]) {
    const arm = new THREE.Mesh(armGeometry, material);
    arm.rotation.y = angle;
    coloured.push(arm);
    drone.add(arm);
  }
  const rotorGeometry = new THREE.CylinderGeometry(DRONE_SPAN_M * 0.2, DRONE_SPAN_M * 0.2, DRONE_SPAN_M * 0.02, 20);
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const rotor = new THREE.Mesh(rotorGeometry, ROTOR_MATERIAL);
    rotor.position.set(x * half * 0.74, DRONE_SPAN_M * 0.06, z * half * 0.74);
    drone.add(rotor);
  }
  return { drone, coloured };
}

/**
 * @author Vinicius Trindade
 * @date Nov 19, 2026
 *
 * @brief Builds the vertical line from a UAV to the ground and its round shadow.
 *
 * @param material - line material shared by every UAV
 * @param shadowMaterial - shadow material shared by every UAV
 * @return the line and the shadow, to be placed under the UAV every frame
 */
export function buildHeightMarks(material, shadowMaterial) {
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]);
  const line = new THREE.Line(geometry, material);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(DRONE_SPAN_M * 0.35, 20), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  return { line, shadow };
}
