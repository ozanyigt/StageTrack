import { useEffect, useState } from 'react';
import * as THREE from 'three';

export interface PlanTexture {
  texture: THREE.Texture;
  /** The drawing's own size on the ground, from its pixels and the scale it was given. */
  widthM: number;
  depthM: number;
}

/**
 * The venue's layout drawing as something three.js can lay on the floor. It only becomes a texture once the
 * drawing has been scaled: an unscaled sheet has no size on the ground, and guessing one would put columns in
 * the wrong place - worse than having no drawing at all.
 */
export function usePlanTexture(url: string | null, metresPerPixel: number | null | undefined): PlanTexture | null {
  const [plan, setPlan] = useState<PlanTexture | null>(null);

  useEffect(() => {
    if (!url || !metresPerPixel) {
      setPlan(null);
      return;
    }

    let texture: THREE.Texture | null = null;
    let cancelled = false;
    new THREE.TextureLoader().load(url, (loaded) => {
      if (cancelled) {
        loaded.dispose();
        return;
      }
      texture = loaded;
      loaded.colorSpace = THREE.SRGBColorSpace;
      const image = loaded.image as { width: number; height: number };
      setPlan({ texture: loaded, widthM: image.width * metresPerPixel, depthM: image.height * metresPerPixel });
    });

    return () => {
      cancelled = true;
      texture?.dispose();
      setPlan(null);
    };
  }, [url, metresPerPixel]);

  return plan;
}
