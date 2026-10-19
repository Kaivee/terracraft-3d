import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

// ── 💾 3D MODEL EXPORTERS ────────────────────────────────
export function exportOBJ(scene, filename = 'Terrain_3D') {
  if (!scene) return;
  const exporter = new OBJExporter();
  const result = exporter.parse(scene);
  download(`${filename}_Model.obj`, result, 'text/plain');
}

export function exportSTL(mesh, filename = 'Terrain_3D') {
  if (!mesh) return;
  const exporter = new STLExporter();
  // Parse target primary mesh
  const result = exporter.parse(mesh, { binary: true });
  download(`${filename}_Printable.stl`, result, 'application/octet-stream');
}

export function screenshot(renderer, scene, camera, filename = 'terrain') {
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function download(filename, data, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
