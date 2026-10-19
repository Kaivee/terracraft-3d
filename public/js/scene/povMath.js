export function thirdPersonCamTarget(pos, yaw, camHeight, dist, groundAt) {
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const x = pos.x + sin * dist;
  const z = pos.z + cos * dist;
  const y = Math.max(pos.y + camHeight, groundAt(x, z) + 0.5);
  return { x, y, z };
}
