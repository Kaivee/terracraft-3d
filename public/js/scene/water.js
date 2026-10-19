import * as THREE from 'three';

// ── 🌊 3D VOLUMETRIC WATER LAYER ─────────────────────────
export function buildWaterLayer(scene, { G, BASE, MAX_H, isLake, waterOpacity, viewMode, waterLevel }) {
  // Determine exact water Y level.
  const waterY = BASE + (waterLevel / 50) * MAX_H;
  const waterBottomY = 0.5; // just above floor

  // Count faces
  let topFaces = 0;
  let sideFaces = 0;
  for (let z = 0; z < G; z++) {
    for (let x = 0; x < G; x++) {
      if (isLake[z * G + x]) {
        topFaces++;
        if (x === 0 || !isLake[z * G + (x - 1)]) sideFaces++; // Left
        if (x === G - 1 || !isLake[z * G + (x + 1)]) sideFaces++; // Right
        if (z === 0 || !isLake[(z - 1) * G + x]) sideFaces++; // Back
        if (z === G - 1 || !isLake[(z + 1) * G + x]) sideFaces++; // Front
      }
    }
  }

  if (topFaces === 0) return null; // No water to draw!

  // Create a custom BufferGeometry that ONLY draws water where isLake is 1.
  const vertices = new Float32Array((topFaces + sideFaces) * 6 * 3);
  const halfG = (G - 1) / 2;
  let vIdx = 0;

  for (let z = 0; z < G; z++) {
    for (let x = 0; x < G; x++) {
      const idx = z * G + x;
      if (isLake[idx]) {
        const wx = x - halfG;
        const wz = z - halfG;

        const x0 = wx - 0.5, x1 = wx + 0.5;
        const z0 = wz - 0.5, z1 = wz + 0.5;

        // TOP FACE (y = waterY)
        vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;
        vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;
        vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;

        vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;
        vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;
        vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;

        // LEFT FACE (x = x0)
        if (x === 0 || !isLake[idx - 1]) {
          vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;
          vertices[vIdx++] = x0; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z1;
          vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;

          vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;
          vertices[vIdx++] = x0; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z1;
          vertices[vIdx++] = x0; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z0;
        }

        // RIGHT FACE (x = x1)
        if (x === G - 1 || !isLake[idx + 1]) {
          vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;
          vertices[vIdx++] = x1; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z0;
          vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;

          vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;
          vertices[vIdx++] = x1; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z0;
          vertices[vIdx++] = x1; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z1;
        }

        // BACK FACE (z = z0)
        if (z === 0 || !isLake[(z - 1) * G + x]) {
          vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;
          vertices[vIdx++] = x0; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z0;
          vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;

          vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z0;
          vertices[vIdx++] = x0; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z0;
          vertices[vIdx++] = x1; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z0;
        }

        // FRONT FACE (z = z1)
        if (z === G - 1 || !isLake[(z + 1) * G + x]) {
          vertices[vIdx++] = x1; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;
          vertices[vIdx++] = x1; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z1;
          vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;

          vertices[vIdx++] = x0; vertices[vIdx++] = waterY; vertices[vIdx++] = z1;
          vertices[vIdx++] = x1; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z1;
          vertices[vIdx++] = x0; vertices[vIdx++] = waterBottomY; vertices[vIdx++] = z1;
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geo.computeVertexNormals();

  // Use a premium glass/water material with transmission
  // Revert to fixed transmission, but bind the slider to opacity so it correctly fades out
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x1da5cc,
    transmission: 0.85,
    opacity: waterOpacity,
    metalness: 0.05,
    roughness: 0.1,
    ior: 1.333,
    thickness: waterY * 0.5,
    attenuationColor: 0x0a3c85,
    attenuationDistance: waterY * 0.4,
    side: THREE.DoubleSide,
    transparent: true,
  });

  const waterMesh = new THREE.Mesh(geo, mat);
  waterMesh.receiveShadow = true;

  // We add an invisible underwater floor to ensure no "papery" look
  // The floor is now only as big as the grid
  const size = viewMode === 'voxel' ? G : G - 1;
  const floorGeo = new THREE.PlaneGeometry(size, size);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x36322e });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.set(0, 0.5, 0); // just above 0
  scene.add(floorMesh);

  scene.add(waterMesh);
  return [floorMesh, waterMesh];
}

export function waterLevelFromSlider(sliderVal, minElev, maxElev) {
  const relHeight = sliderVal / 50;
  const range = (maxElev - minElev) || 1;
  return minElev + relHeight * range;
}
