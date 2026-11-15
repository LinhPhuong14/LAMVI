# Phòng thư — foreground model sources

Scope: downloaded foreground props only. The approved generated Vietnamese room background/layout is retained by the integrating session. The rejected procedural surface kit (`surfaceMaterials.js` and its test) has been removed from the working tree and archived under `/tmp/lamvi-rejected-surface-kit/`. This documentation update does not modify scene lighting/camera/flow or replace the background.

## Ready to load: KayKit wooden table

| Field | Value |
| --- | --- |
| Local runtime asset | `public/letter-room/models/kaykit-furniture/table-medium-long-geometry.glb` (derived by main) |
| Preserved original textured GLB | `public/letter-room/models/kaykit-furniture/table-medium-long.glb` |
| Browser URL | `/letter-room/models/kaykit-furniture/table-medium-long-geometry.glb` |
| Upstream object | `table_medium_long` from **KayKit: Furniture Bits 1.0**, FREE pack |
| Creator | Kay Lousberg / KayKit |
| Official pack / license page | https://kaylousberg.itch.io/furniture-bits |
| Official repository | https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0 |
| Pinned revision | `96d5930a8dbdb363409bbc2d3341718b00e17c9c` |
| Primary license file | https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0/blob/96d5930a8dbdb363409bbc2d3341718b00e17c9c/LICENSE.txt |
| Preserved original notice | `public/letter-room/models/kaykit-furniture/LICENSE.txt` (unmodified upstream bytes) |
| License | CC0 1.0 Universal; https://creativecommons.org/publicdomain/zero/1.0/ |
| Download / verification date | 2026-11-13 |
| Runtime file size | **26,052 bytes** (25.44 KiB); original textured GLB: 26,252 bytes |
| Geometry | 260 vertices, 168 triangles, one mesh primitive / material / draw call |
| Texture | Original GLB uses embedded 1024×1024 PNG gradient atlas (15,605 bytes). Runtime derivative has no image/texture references; engine applies existing LAMVI wood material/tint. |
| Dependencies | Both GLBs are self-contained. Derivative retains the full original BIN chunk, including unused PNG bytes, but requests no image. |

The pack's primary page identifies the free assets as CC0 and explicitly allows commercial use without mandatory attribution. The pinned repository license confirms CC0 for this pack. No EXTRA/SOURCE paid content, Quaternius QAL content, Sketchfab account, or unverified mirror was used. The preserved license includes the creator's original acknowledgements; these are asset provenance, not project contributor credits.

The original is a clean stylized wood table with simple game proportions and broad warm brown gradient shading rather than a photoreal scan or a dense grain texture. The runtime derivative preserves its geometry but uses the engine’s existing LAMVI wood material/tint instead of the authored gradient atlas. Suitable as an economical foreground table against the generated room background. Its aesthetic fit with the actual background still needs renderer QA; this acquisition does not claim a rendered scene review. One model is supplied within the requested 1–2 model scope; no ceramic mug is included.

### Exact source mapping

All three inputs were downloaded directly from this immutable official source directory:

https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0/tree/96d5930a8dbdb363409bbc2d3341718b00e17c9c/addons/kaykit_furniture_bits/Assets/gltf

- `table_medium_long.gltf` → GLB JSON metadata (external URIs replaced with embedded buffer references).
- `table_medium_long.bin` → GLB binary geometry, byte-for-byte unchanged.
- `furniturebits_texture.png` → GLB embedded PNG image, byte-for-byte unchanged.
- Root `LICENSE.txt` → local `kaykit-furniture/LICENSE.txt`, byte-for-byte unchanged.

`public/letter-room/models/kaykit-furniture/provenance.json` records upstream paths, pinned revision, byte counts, input SHA-256 hashes and the output SHA-256 hash. For the preserved original `table-medium-long.glb`, this is a lossless container conversion, not a remodel: geometry, UV mapping, normals, atlas colors, texture resolution and material parameters remain upstream originals. No Draco/KTX/decoder dependency is required.

### Runtime derivative and CSP

Main created `table-medium-long-geometry.glb` from the preserved textured GLB to avoid an embedded-image loading path: GLTFLoader fetches a `blob:` URL for that image, which the deployment’s `connect-src self` CSP blocks. This is the integration reason supplied by main, not a new browser/CSP verification in this documentation task.

The derivative removes top-level `images`, `textures`, `samplers`, and the material’s `baseColorTexture` reference. The material record remains (`furniture_texture`, metallic=0, roughness=0.5), but the engine replaces it with the existing LAMVI wood material/tint. The derivative therefore does **not** preserve the original visible atlas shading. It is still derived from the same CC0 asset; the original license remains alongside both files.

Geometry, UVs, normals, mesh primitives, nodes, scene, accessors and buffer views are unchanged. The entire BIN chunk is byte-for-byte identical, including the now-unused atlas PNG payload. This is not a texture-byte removal or a geometry optimization. `provenance.json` retains the original inputs/output and adds a separate derivative record with its parent hash, size, SHA-256, transformation and checks.

### Integration notes for main

Load the browser URL with `GLTFLoader`. The asset is Y-up, feet at approximately Y=0, top at Y=1; source bounds are X=[-1.5,1.5], Y=[~0,1], Z=[-1,1]. Thus width:height:depth = **3:1:2**, centered horizontally. Long edge follows local X. Uniform scaling preserves its toy proportions; choose world scale from the existing room geometry rather than assuming real metres. Set the table group position to the desired floor height. Keep lamp, envelope and switch on the resulting top plane `position.y + scale.y`.

Load the geometry derivative for the current integration and apply the existing LAMVI wood material/tint. The preserved original material is `furniture_texture`, metallic=0, roughness=0.5, using the embedded gradient atlas; only the original textured file retains that appearance. If that original is used later, GLTFLoader handles its color texture’s sRGB space and its embedded-image loading path needs appropriate CSP support. It contains no baked room lighting, lights, animations or cameras. Main can enable cast/receive shadows on the mesh after loading. Avoid adding a second full-sized table if the generated backdrop already visibly supplies one; camera alignment/occlusion must be resolved during integration.

### Validation performed

Khronos `gltf-validator` **2.0.0-dev.3.10**, `validateBytes` on the original textured `table-medium-long.glb`: **0 errors, 0 warnings, 0 infos, 0 hints**. Validator confirms an embedded 1024×1024 sRGB PNG, embedded binary buffer, one material, 168 triangles and a default scene. No browser/WebGL rendering was performed in this asset-only task. The validator was downloaded/executed in `/tmp`; project dependencies and lockfile were not changed.

The derivative documentation check verified its SHA-256 and size, absence of image/texture/sampler references, identical geometry metadata and identical full BIN chunk against the original. The preserved original still matches its recorded SHA-256. No new renderer/CSP test or validator run was performed for the derivative in this update.

## Alternate source researched: Kenney Furniture Kit

Primary page https://kenney.nl/assets/furniture-kit lists **Creative Commons CC0** and 140 models. This remains a verified alternative, but downloads from this execution environment returned **HTTP 403** at both URLs:

- https://kenney.nl/assets/furniture-kit
- https://kenney.nl/media/pages/assets/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip

The web research tool could read the primary license listing, but its ZIP fetch also failed as a restricted URL. No Kenney binary is bundled, and no mirror was substituted. Proxy access for these exact URLs is only needed if main wants an additional Kenney candidate; it does not block the delivered KayKit GLB.
