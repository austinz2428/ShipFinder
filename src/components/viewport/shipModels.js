import * as THREE from 'three';

// ============================================================================
// NAVAL ARCHITECTURE GEOMETRY HELPERS
// ============================================================================

/**
 * Creates razor-straight, symmetrical tapered bow geometry.
 * Extrudes port and starboard hull plates that taper smoothly to a sharp
 * vertical stem cutwater at x = 0. Prevents diamond/crooked distortions.
 */
export function createTaperedBowGeometry(widthHalf, yBottom, yTop, zBack, zFront, yTopFront = yTop) {
  const geo = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -widthHalf, yTop, zBack,        // 0: back-top-port
     widthHalf, yTop, zBack,        // 1: back-top-starboard
    -widthHalf, yBottom, zBack,     // 2: back-bot-port
     widthHalf, yBottom, zBack,     // 3: back-bot-starboard
     0.0, yTopFront, zFront,        // 4: front-top-stem
     0.0, yBottom, zFront           // 5: front-bot-stem
  ]);

  const indices = [
    // Port (Left) Hull Plate
    0, 2, 4,
    2, 5, 4,

    // Starboard (Right) Hull Plate
    1, 4, 3,
    4, 5, 3,

    // Top Deck Plate
    0, 4, 1,

    // Bottom Keel Plate
    2, 3, 5,

    // Back Cap
    0, 1, 2,
    1, 3, 2
  ];

  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Categorizes any raw AIS type string into one of the 5 core fleet categories:
 * - 'cargo'
 * - 'tanker'
 * - 'pleasure'
 * - 'tug'
 * - 'fishing'
 */
export function getShipCategory(type) {
  const t = (type || '').toLowerCase();
  if (
    t.includes('tanker') ||
    t.includes('crude') ||
    t.includes('oil') ||
    t.includes('chemical') ||
    t.includes('gas') ||
    t.includes('lng') ||
    t.includes('lpg')
  ) {
    return 'tanker';
  }
  if (
    t.includes('pleasure') ||
    t.includes('yacht') ||
    t.includes('sail') ||
    t.includes('passenger') ||
    t.includes('cruise')
  ) {
    return 'pleasure';
  }
  if (
    t.includes('tug') ||
    t.includes('tow') ||
    t.includes('pilot') ||
    t.includes('dredg') ||
    t.includes('special') ||
    t.includes('work') ||
    t.includes('supply') ||
    t.includes('barge')
  ) {
    return 'tug';
  }
  if (t.includes('fish') || t.includes('trawl')) {
    return 'fishing';
  }
  return 'cargo';
}

export const SHIP_CATEGORY_META = {
  cargo: {
    label: 'CARGO // CONTAINER & BULK FREIGHTER',
    shortLabel: 'CONTAINER FREIGHTER',
    badgeClass: 'border-amber-500/50 text-amber-600 bg-amber-50/90 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-500/40',
    dotColor: 'bg-amber-500'
  },
  tanker: {
    label: 'TANKER // CRUDE & LIQUID PETROCHEM',
    shortLabel: 'CRUDE TANKER',
    badgeClass: 'border-orange-500/50 text-orange-600 bg-orange-50/90 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-500/40',
    dotColor: 'bg-orange-500'
  },
  pleasure: {
    label: 'YACHT // LUXURY MOTOR CRUISER',
    shortLabel: 'LUXURY SUPERYACHT',
    badgeClass: 'border-cyan-500/50 text-cyan-600 bg-cyan-50/90 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-500/40',
    dotColor: 'bg-cyan-500'
  },
  tug: {
    label: 'TUG // HARBOR & TOWING WORKBOAT',
    shortLabel: 'HARBOR ESCORT TUG',
    badgeClass: 'border-blue-500/50 text-blue-600 bg-blue-50/90 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-500/40',
    dotColor: 'bg-blue-500'
  },
  fishing: {
    label: 'FISHING // COMMERCIAL TRAWLER',
    shortLabel: 'OCEANIC TRAWLER',
    badgeClass: 'border-emerald-500/50 text-emerald-600 bg-emerald-50/90 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-500/40',
    dotColor: 'bg-emerald-500'
  }
};

// ============================================================================
// 1. CARGO / CONTAINER / BULK FREIGHTER MODEL BUILDER
// Sleek charcoal navy hull, oxide red bottom, colorful stacks of shipping
// containers (Azure, Amber, Emerald, Crimson, White), multi-tier aft bridge.
// ============================================================================
export function buildCargoModel(group, isDark) {
  const hullTopMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x1e2530 : 0x1a202c,
    roughness: 0.45,
    metalness: 0.2
  });
  const hullBottomMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x661812 : 0x8f2015,
    roughness: 0.5,
    metalness: 0.1
  });
  const deckPlateMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x2b313d : 0x3d4452,
    roughness: 0.55
  });
  const whiteSuperstructureMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.28
  });
  const navGlassMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff4d15, roughness: 0.35 });
  const blackCapMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.5 });

  // Container Color Palette (Vibrant intermodal container lines)
  const containerMats = [
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }), // Azure Blue (Maersk)
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 }), // Amber / Orange (Hapag-Lloyd)
    new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.4 }), // Emerald Green (Evergreen)
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 }), // Crimson (ONE / K-Line)
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 }), // Polar White (Reefer)
    new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.4 })  // Indigo Blue (CMA CGM)
  ];

  // Lower Hull (Oxide Red)
  const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.7, 17.6), hullBottomMat);
  lowerHull.position.set(0, 0.35, 0);
  lowerHull.castShadow = true;
  lowerHull.receiveShadow = true;
  group.add(lowerHull);

  const lowerBow = new THREE.Mesh(
    createTaperedBowGeometry(1.8, 0, 0.7, -8.8, -12.5, 0.72),
    hullBottomMat
  );
  lowerBow.castShadow = true;
  lowerBow.receiveShadow = true;
  group.add(lowerBow);

  // Upper Hull (Charcoal Navy Steel Topsides)
  const upperHull = new THREE.Mesh(new THREE.BoxGeometry(3.7, 1.3, 17.6), hullTopMat);
  upperHull.position.set(0, 1.35, 0);
  upperHull.castShadow = true;
  upperHull.receiveShadow = true;
  group.add(upperHull);

  const upperBow = new THREE.Mesh(
    createTaperedBowGeometry(1.85, 0.7, 2.0, -8.8, -12.5, 2.22),
    hullTopMat
  );
  upperBow.castShadow = true;
  upperBow.receiveShadow = true;
  group.add(upperBow);

  // Transom Stern
  const transom = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.3, 2.2), hullTopMat);
  transom.position.set(0, 1.35, 9.8);
  transom.castShadow = true;
  group.add(transom);

  // Main Cargo Deck Plate
  const mainDeck = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.12, 16.5), deckPlateMat);
  mainDeck.position.set(0, 2.01, -0.6);
  mainDeck.receiveShadow = true;
  group.add(mainDeck);

  // Forecastle (Raised Bow Deck)
  const forecastle = new THREE.Mesh(
    createTaperedBowGeometry(1.75, 2.0, 2.24, -9.2, -12.3, 2.3),
    whiteSuperstructureMat
  );
  forecastle.castShadow = true;
  group.add(forecastle);

  // Bow Jackstaff Mast
  const bowMast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.6), steelMat);
  bowMast.position.set(0, 3.0, -12.1);
  bowMast.castShadow = true;
  group.add(bowMast);

  const navLight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  navLight.position.set(0, 3.8, -12.1);
  group.add(navLight);

  // Container Bay Stacks (5 bays, vibrant colorful stacks 2-wide, 2 to 3 tiers high)
  const bayZPositions = [-7.0, -4.2, -1.4, 1.4, 4.2];
  let matIdx = 0;

  bayZPositions.forEach((zPos, bayIdx) => {
    // Inter-bay lashing cell guides
    const cellGuide = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 0.1), steelMat);
    cellGuide.position.set(0, 2.15, zPos - 1.25);
    group.add(cellGuide);

    // Port and Starboard Stacks
    [-0.9, 0.9].forEach((xPos, colIdx) => {
      const tierCount = (bayIdx === 0 || bayIdx === 4) ? 2 : (colIdx === 0 ? 3 : 2);
      for (let t = 0; t < tierCount; t++) {
        const mat = containerMats[matIdx % containerMats.length];
        matIdx++;

        const cMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.72, 2.2), mat);
        cMesh.position.set(xPos, 2.42 + t * 0.76, zPos);
        cMesh.castShadow = true;
        cMesh.receiveShadow = true;
        group.add(cMesh);
      }
    });
  });

  // Aft Superstructure (Multi-tier Bridge Tower)
  // Tier 1: Living Quarters
  const accom1 = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.2, 3.2), whiteSuperstructureMat);
  accom1.position.set(0, 2.55, 6.8);
  accom1.castShadow = true;
  accom1.receiveShadow = true;
  group.add(accom1);

  // Tier 2: Officer Deck
  const accom2 = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.85, 2.8), whiteSuperstructureMat);
  accom2.position.set(0, 3.55, 6.7);
  accom2.castShadow = true;
  group.add(accom2);

  // Tier 3: Bridge Deck with Wings
  const bridgeWings = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 1.4), whiteSuperstructureMat);
  bridgeWings.position.set(0, 4.15, 6.4);
  bridgeWings.castShadow = true;
  group.add(bridgeWings);

  const wheelhouse = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.75, 1.8), whiteSuperstructureMat);
  wheelhouse.position.set(0, 4.45, 6.4);
  wheelhouse.castShadow = true;
  group.add(wheelhouse);

  // Wraparound Navigation Glass
  const winFront = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.32, 0.08), navGlassMat);
  winFront.position.set(0, 4.55, 5.48);
  group.add(winFront);

  const winSideL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 1.2), navGlassMat);
  winSideL.position.set(-1.56, 4.55, 6.1);
  group.add(winSideL);

  const winSideR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 1.2), navGlassMat);
  winSideR.position.set(1.56, 4.55, 6.1);
  group.add(winSideR);

  // Radar Mast & Rotating Radar Scanner
  const mainMast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 2.0), steelMat);
  mainMast.position.set(0, 5.65, 6.6);
  mainMast.castShadow = true;
  group.add(mainMast);

  const radarBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.12), steelMat);
  radarBar.position.set(0, 6.4, 6.6);
  radarBar.castShadow = true;
  group.add(radarBar);

  const satDome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), whiteSuperstructureMat);
  satDome.position.set(0.7, 5.0, 6.0);
  group.add(satDome);

  // Modern Marine Funnel / Smokestack
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 1.6, 16), orangeMat);
  funnel.position.set(0, 4.25, 8.1);
  funnel.rotation.x = 0.1;
  funnel.castShadow = true;
  group.add(funnel);

  const funnelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.35, 16), blackCapMat);
  funnelCap.position.set(0, 5.05, 8.18);
  funnelCap.rotation.x = 0.1;
  group.add(funnelCap);

  // Enclosed Lifeboats on Port & Starboard Davits
  const lifeboatMat = new THREE.MeshStandardMaterial({ color: 0xff6b35, roughness: 0.3 });
  [-1.85, 1.85].forEach(x => {
    const lb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 1.3), lifeboatMat);
    lb.position.set(x, 3.4, 7.3);
    lb.castShadow = true;
    group.add(lb);
  });
}

// ============================================================================
// 2. TANKER (CRUDE OIL & CHEMICAL) MODEL BUILDER
// Signature high-gloss maritime international orange hull, white waterline,
// dark slate deck, elevated centerline catwalk, longitudinal pipeline complex,
// midships yellow hose cranes, manifold cross-valves, and split twin funnels.
// ============================================================================
export function buildTankerModel(group, isDark) {
  const tankerOrangeMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0xc2410c : 0xea580c, // Maritime International Orange
    roughness: 0.4,
    metalness: 0.15
  });
  const bottomRedMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x5a1810 : 0x7f1d1d, // Deep Anti-fouling Maroon
    roughness: 0.5
  });
  const slateDeckMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x1f242e : 0x334155, // Dark Non-skid Slate Deck
    roughness: 0.6
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.28
  });
  const pipelineMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8, // Galvanized Steel Pipeline
    roughness: 0.35,
    metalness: 0.4
  });
  const yellowCraneMat = new THREE.MeshStandardMaterial({
    color: 0xeab308, // High-vis Safety Yellow Hose Cranes
    roughness: 0.35
  });
  const navGlassMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.5 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4 });

  // 1. Lower Hull (Deep Maroon Red)
  const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.7, 17.8), bottomRedMat);
  lowerHull.position.set(0, 0.35, 0);
  lowerHull.castShadow = true;
  lowerHull.receiveShadow = true;
  group.add(lowerHull);

  const lowerBow = new THREE.Mesh(
    createTaperedBowGeometry(1.95, 0, 0.7, -8.9, -12.8, 0.72),
    bottomRedMat
  );
  lowerBow.castShadow = true;
  lowerBow.receiveShadow = true;
  group.add(lowerBow);

  // 2. Upper Hull Topsides (High-Gloss Maritime Orange)
  const upperHull = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.35, 17.8), tankerOrangeMat);
  upperHull.position.set(0, 1.37, 0);
  upperHull.castShadow = true;
  upperHull.receiveShadow = true;
  group.add(upperHull);

  const upperBow = new THREE.Mesh(
    createTaperedBowGeometry(2.0, 0.7, 2.05, -8.9, -12.8, 2.25),
    tankerOrangeMat
  );
  upperBow.castShadow = true;
  upperBow.receiveShadow = true;
  group.add(upperBow);

  // Transom Stern
  const transom = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.35, 2.2), tankerOrangeMat);
  transom.position.set(0, 1.37, 9.9);
  transom.castShadow = true;
  group.add(transom);

  // 3. Dark Slate Main Cargo Deck
  const mainDeck = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.12, 16.8), slateDeckMat);
  mainDeck.position.set(0, 2.06, -0.6);
  mainDeck.receiveShadow = true;
  group.add(mainDeck);

  // 4. Elevated Centerline Catwalk (Trunkway from Bridge to Bow)
  const catwalk = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 13.8), whiteMat);
  catwalk.position.set(0, 2.25, -1.8);
  catwalk.castShadow = true;
  group.add(catwalk);

  // Handrail supports along catwalk
  for (let z = -8.0; z <= 4.0; z += 1.8) {
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35), steelMat);
    postL.position.set(-0.3, 2.45, z);
    group.add(postL);
    const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35), steelMat);
    postR.position.set(0.3, 2.45, z);
    group.add(postR);
  }

  // 5. Longitudinal Pipeline Complex (Dual Silver Product Pipelines)
  [-1.0, 1.0].forEach(x => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 13.5, 12), pipelineMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, 2.2, -1.8);
    pipe.castShadow = true;
    group.add(pipe);
  });

  // Secondary smaller utility lines
  [-0.65, 0.65].forEach(x => {
    const smallPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 13.5, 8), steelMat);
    smallPipe.rotation.x = Math.PI / 2;
    smallPipe.position.set(x, 2.15, -1.8);
    group.add(smallPipe);
  });

  // 6. Midships Cargo Manifold (Loading Cross-Station at z = -1.5)
  const manifoldCoaming = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.22, 1.6), whiteMat);
  manifoldCoaming.position.set(0, 2.18, -1.5);
  group.add(manifoldCoaming);

  const crossPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 12), pipelineMat);
  crossPipe.rotation.z = Math.PI / 2;
  crossPipe.position.set(0, 2.45, -1.5);
  crossPipe.castShadow = true;
  group.add(crossPipe);

  // 7. Midships Hose Handling Cranes (Port & Starboard Safety Yellow Cranes)
  [-1.6, 1.6].forEach((x, idx) => {
    // Crane Pedestal
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.4, 12), yellowCraneMat);
    pedestal.position.set(x, 2.76, -1.5);
    pedestal.castShadow = true;
    group.add(pedestal);

    // Crane Jib (Angled outward over ship's side)
    const jib = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.2), yellowCraneMat);
    jib.position.set(x + (idx === 0 ? -0.4 : 0.4), 3.7, -1.5);
    jib.rotation.z = idx === 0 ? 0.35 : -0.35;
    jib.castShadow = true;
    group.add(jib);
  });

  // 8. Tank Access Hatches & Vapor Expansion Domes along Deck
  [-6.2, -3.8, 1.2, 3.6].forEach(zPos => {
    [-1.3, 1.3].forEach(xPos => {
      const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.25, 12), whiteMat);
      dome.position.set(xPos, 2.2, zPos);
      dome.castShadow = true;
      group.add(dome);
    });
  });

  // 9. Raised Forecastle & Bow Mast
  const forecastle = new THREE.Mesh(
    createTaperedBowGeometry(1.9, 2.05, 2.28, -9.2, -12.6, 2.34),
    whiteMat
  );
  forecastle.castShadow = true;
  group.add(forecastle);

  const bowJackstaff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.6), steelMat);
  bowJackstaff.position.set(0, 3.1, -12.3);
  group.add(bowJackstaff);

  // 10. Aft Superstructure (Modern White Bridge with Extended Wings)
  const accom1 = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.3, 3.2), whiteMat);
  accom1.position.set(0, 2.72, 6.8);
  accom1.castShadow = true;
  accom1.receiveShadow = true;
  group.add(accom1);

  const accom2 = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.9, 2.7), whiteMat);
  accom2.position.set(0, 3.82, 6.7);
  accom2.castShadow = true;
  group.add(accom2);

  // Wide Bridge Wings spanning the full beam
  const bridgeWings = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.38, 1.5), whiteMat);
  bridgeWings.position.set(0, 4.45, 6.3);
  bridgeWings.castShadow = true;
  group.add(bridgeWings);

  const wheelhouse = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.8, 1.9), whiteMat);
  wheelhouse.position.set(0, 4.75, 6.3);
  wheelhouse.castShadow = true;
  group.add(wheelhouse);

  const winFront = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.35, 0.08), navGlassMat);
  winFront.position.set(0, 4.85, 5.34);
  group.add(winFront);

  // Radar Mast & Satcom
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.8), steelMat);
  mast.position.set(0, 5.85, 6.5);
  group.add(mast);

  const radarBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.12), steelMat);
  radarBar.position.set(0, 6.55, 6.5);
  group.add(radarBar);

  const satDome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), whiteMat);
  satDome.position.set(0.8, 5.3, 5.9);
  group.add(satDome);

  // 11. Split Twin Streamlined Funnels (Maritime Orange with Black Exhaust Caps)
  [-0.95, 0.95].forEach(x => {
    const fMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.5, 14), tankerOrangeMat);
    fMesh.position.set(x, 4.45, 8.2);
    fMesh.rotation.x = 0.12;
    fMesh.castShadow = true;
    group.add(fMesh);

    const fCap = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.3, 14), blackMat);
    fCap.position.set(x, 5.2, 8.28);
    fCap.rotation.x = 0.12;
    group.add(fCap);
  });

  // 12. Centerline Stern Freefall Lifeboat (Safety Orange on Inclined Ramp)
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 1.8), steelMat);
  ramp.position.set(0, 3.4, 9.6);
  ramp.rotation.x = 0.35;
  group.add(ramp);

  const lifeboat = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.45, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xff6b35, roughness: 0.3 })
  );
  lifeboat.position.set(0, 3.75, 9.6);
  lifeboat.rotation.x = 0.35;
  lifeboat.castShadow = true;
  group.add(lifeboat);
}

// ============================================================================
// 3. PLEASURE CRAFT / LUXURY SUPERYACHT MODEL BUILDER
// Ultra-glossy pearl white displacement superyacht, metallic cyan waterline
// boot-stripe, vertical axe bow, natural teak decks, dark smoked panoramic
// ribbon glass, flybridge hardtop arch, and cascading aft teak beach club.
// ============================================================================
export function buildYachtModel(group, isDark) {
  const pearlWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xfafbfc,
    roughness: 0.18,
    metalness: 0.1
  });
  const cyanStripeMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4, // Brilliant Cyan Waterline Stripe
    roughness: 0.3,
    metalness: 0.2
  });
  const darkHullBottomMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x0f172a : 0x1e293b,
    roughness: 0.4
  });
  const teakDeckMat = new THREE.MeshStandardMaterial({
    color: 0xc28542, // Warm Golden Teak Wood
    roughness: 0.65,
    metalness: 0.05
  });
  const darkSmokedGlassMat = new THREE.MeshStandardMaterial({
    color: 0x090d16, // Dark Tinted Panoramic Ribbon Glazing
    roughness: 0.1,
    metalness: 0.8
  });
  const jacuzziMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.15,
    metalness: 0.2
  });
  const navyCushionMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    roughness: 0.7
  });

  // 1. Lower Keel / Bottom (Navy/Charcoal Anti-fouling)
  const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.5, 15.0), darkHullBottomMat);
  lowerHull.position.set(0, 0.25, 0.5);
  lowerHull.castShadow = true;
  lowerHull.receiveShadow = true;
  group.add(lowerHull);

  const lowerBow = new THREE.Mesh(
    createTaperedBowGeometry(1.65, 0, 0.5, -7.0, -11.2, 0.52),
    darkHullBottomMat
  );
  lowerBow.castShadow = true;
  group.add(lowerBow);

  // 2. Waterline Cyan Boot-Stripe Accent Belt
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.36, 0.15, 15.0), cyanStripeMat);
  stripe.position.set(0, 0.58, 0.5);
  group.add(stripe);

  const stripeBow = new THREE.Mesh(
    createTaperedBowGeometry(1.68, 0.5, 0.65, -7.0, -11.25, 0.67),
    cyanStripeMat
  );
  group.add(stripeBow);

  // 3. Main Topsides (High-Gloss Pearl White Axe Bow)
  const upperHull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 15.0), pearlWhiteMat);
  upperHull.position.set(0, 1.35, 0.5);
  upperHull.castShadow = true;
  upperHull.receiveShadow = true;
  group.add(upperHull);

  // Sleek Vertical Axe Bow (Modern Superyacht Cutwater)
  const axeBow = new THREE.Mesh(
    createTaperedBowGeometry(1.7, 0.65, 2.05, -7.0, -11.3, 2.15),
    pearlWhiteMat
  );
  axeBow.castShadow = true;
  axeBow.receiveShadow = true;
  group.add(axeBow);

  // 4. Main Teak Foredeck with Sunken Jacuzzi & Lounge Pad
  const foredeckTeak = new THREE.Mesh(
    createTaperedBowGeometry(1.6, 2.05, 2.07, -7.0, -10.8, 2.12),
    teakDeckMat
  );
  foredeckTeak.receiveShadow = true;
  group.add(foredeckTeak);

  // Sunken Foredeck Jacuzzi
  const jacuzzi = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 16), jacuzziMat);
  jacuzzi.position.set(0, 2.12, -7.8);
  group.add(jacuzzi);

  const jacuzziRim = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.06, 8, 24), pearlWhiteMat);
  jacuzziRim.rotation.x = Math.PI / 2;
  jacuzziRim.position.set(0, 2.15, -7.8);
  group.add(jacuzziRim);

  // Foredeck Sunpad Lounge Cushion
  const sunpad = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 1.2), navyCushionMat);
  sunpad.position.set(0, 2.14, -6.0);
  group.add(sunpad);

  // 5. Tier 1: Main Salon & Master Stateroom Superstructure
  const mainSalon = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.1, 9.8), pearlWhiteMat);
  mainSalon.position.set(0, 2.6, 0.5);
  mainSalon.castShadow = true;
  mainSalon.receiveShadow = true;
  group.add(mainSalon);

  // Continuous Smoked Ribbon Glass Windows (Port & Starboard)
  [-1.56, 1.56].forEach(x => {
    const winRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 8.4), darkSmokedGlassMat);
    winRibbon.position.set(x, 2.65, 0.5);
    group.add(winRibbon);
  });

  // 6. Tier 2: Upper Bridge Deck & Navigation Wheelhouse
  const upperDeckTeak = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.08, 8.0), teakDeckMat);
  upperDeckTeak.position.set(0, 3.19, 0.3);
  group.add(upperDeckTeak);

  const upperCabin = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.95, 6.6), pearlWhiteMat);
  upperCabin.position.set(0, 3.72, -0.1);
  upperCabin.castShadow = true;
  group.add(upperCabin);

  // Reverse-Raked Aerodynamic Wheelhouse Windows
  const bridgeWinFront = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.45, 0.06), darkSmokedGlassMat);
  bridgeWinFront.position.set(0, 3.85, -3.42);
  bridgeWinFront.rotation.x = -0.22;
  group.add(bridgeWinFront);

  [-1.36, 1.36].forEach(x => {
    const bridgeWinSide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 4.6), darkSmokedGlassMat);
    bridgeWinSide.position.set(x, 3.82, -0.6);
    group.add(bridgeWinSide);
  });

  // 7. Tier 3: Flybridge Sundeck & Hardtop Aero Canopy
  const flybridgeTeak = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 5.2), teakDeckMat);
  flybridgeTeak.position.set(0, 4.24, 0.2);
  group.add(flybridgeTeak);

  // Sleek composite Hardtop T-Top Roof
  const hardtop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 3.8), pearlWhiteMat);
  hardtop.position.set(0, 4.95, 0.1);
  hardtop.castShadow = true;
  group.add(hardtop);

  // Hardtop Struts / Pillars
  [-1.15, 1.15].forEach(x => {
    [-1.2, 1.2].forEach(z => {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7), pearlWhiteMat);
      strut.position.set(x, 4.6, z);
      group.add(strut);
    });
  });

  // Aero Communications Arch with Dual White Satcom Domes
  const arch = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 0.7), pearlWhiteMat);
  arch.position.set(0, 5.12, 1.2);
  arch.castShadow = true;
  group.add(arch);

  [-0.65, 0.65].forEach(x => {
    const satDome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), pearlWhiteMat);
    satDome.position.set(x, 5.42, 1.2);
    group.add(satDome);
  });

  const radarBar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.1), pearlWhiteMat);
  radarBar.position.set(0, 5.65, 1.2);
  group.add(radarBar);

  // 8. Cascading Aft Beach Club & Teak Swim Platform
  // Main Aft Cockpit Teak Area
  const aftCockpitTeak = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.1, 2.4), teakDeckMat);
  aftCockpitTeak.position.set(0, 2.1, 6.5);
  aftCockpitTeak.receiveShadow = true;
  group.add(aftCockpitTeak);

  // Aft Sun Loungers
  const aftLounger = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 1.2), navyCushionMat);
  aftLounger.position.set(0, 2.22, 6.4);
  group.add(aftLounger);

  // Cascading Twin Teak Steps (Port & Starboard)
  [-1.2, 1.2].forEach(x => {
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.6), teakDeckMat);
    step1.position.set(x, 1.6, 7.8);
    group.add(step1);

    const step2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.6), teakDeckMat);
    step2.position.set(x, 1.1, 8.4);
    group.add(step2);
  });

  // Lower Extended Swim Platform / Beach Club (Floating near waterline)
  const swimPlatform = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 1.6), teakDeckMat);
  swimPlatform.position.set(0, 0.6, 8.8);
  swimPlatform.receiveShadow = true;
  group.add(swimPlatform);

  const swimCoaming = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.28, 0.2), pearlWhiteMat);
  swimCoaming.position.set(0, 0.75, 8.0);
  group.add(swimCoaming);
}

// ============================================================================
// 4. TUG / TOW / WORKBOAT MODEL BUILDER
// Muscular royal ocean blue hull, high-vis safety yellow sheer bulwarks,
// thick matte black rubber bow push fender, low aft working deck, industrial
// towing winch drum, curved towing arch, 360° panoramic wheelhouse, twin stacks.
// ============================================================================
export function buildTugModel(group, isDark) {
  const tugBlueMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x0270a6 : 0x0284c7, // Royal Ocean Blue Hull
    roughness: 0.42,
    metalness: 0.15
  });
  const safetyYellowMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15, // High-visibility Safety Yellow
    roughness: 0.35
  });
  const bottomRedMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x5a1810 : 0x822419,
    roughness: 0.5
  });
  const rubberFenderMat = new THREE.MeshStandardMaterial({
    color: 0x141416, // Heavy Matte Industrial Rubber
    roughness: 0.85,
    metalness: 0.05
  });
  const deckPlateMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x242831 : 0x374151, // Heavy Working Deck Plate
    roughness: 0.7
  });
  const whiteCabMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.3
  });
  const navGlassMat = new THREE.MeshBasicMaterial({ color: 0x070b12 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45 });
  const hawserMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 }); // Coiled tow wire

  // 1. Lower Hull (Deep Draft Anti-fouling Maroon)
  const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.65, 11.2), bottomRedMat);
  lowerHull.position.set(0, 0.32, 0.6);
  lowerHull.castShadow = true;
  lowerHull.receiveShadow = true;
  group.add(lowerHull);

  const lowerBow = new THREE.Mesh(
    createTaperedBowGeometry(1.9, 0, 0.65, -5.0, -8.6, 0.68),
    bottomRedMat
  );
  lowerBow.castShadow = true;
  group.add(lowerBow);

  // 2. Upper Hull Topsides (Muscular Royal Blue with High Flared Bow)
  const upperHull = new THREE.Mesh(new THREE.BoxGeometry(3.9, 1.35, 11.2), tugBlueMat);
  upperHull.position.set(0, 1.32, 0.6);
  upperHull.castShadow = true;
  upperHull.receiveShadow = true;
  group.add(upperHull);

  const upperBow = new THREE.Mesh(
    createTaperedBowGeometry(1.95, 0.65, 2.0, -5.0, -8.6, 2.45),
    tugBlueMat
  );
  upperBow.castShadow = true;
  upperBow.receiveShadow = true;
  group.add(upperBow);

  // Rounded Heavy Stern Transom
  const sternTransom = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 1.35, 16, 1, false, 0, Math.PI), tugBlueMat);
  sternTransom.position.set(0, 1.32, 6.2);
  sternTransom.castShadow = true;
  group.add(sternTransom);

  // 3. Safety Yellow Sheer Bulwark Cap Line
  const sheerYellow = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.22, 11.2), safetyYellowMat);
  sheerYellow.position.set(0, 2.05, 0.6);
  group.add(sheerYellow);

  const sheerYellowBow = new THREE.Mesh(
    createTaperedBowGeometry(2.0, 1.95, 2.15, -5.0, -8.65, 2.55),
    safetyYellowMat
  );
  group.add(sheerYellowBow);

  // 4. Heavy Rubber Bow Push Fender (Cylindrical Stem Wrap for Barges/Ships)
  const bowFender = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 14), rubberFenderMat);
  bowFender.position.set(0, 1.7, -8.75);
  bowFender.rotation.x = -0.15;
  bowFender.castShadow = true;
  group.add(bowFender);

  const bowFenderTop = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 14), rubberFenderMat);
  bowFenderTop.position.set(0, 2.7, -8.9);
  group.add(bowFenderTop);

  // Side Rubbing Strakes / D-Fenders along port and starboard
  [-2.02, 2.02].forEach(x => {
    const sideFender = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 10.4), rubberFenderMat);
    sideFender.position.set(x, 1.6, 0.6);
    group.add(sideFender);
  });

  // 5. Main Aft Working Deck
  const aftDeck = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.15, 6.8), deckPlateMat);
  aftDeck.position.set(0, 1.95, 3.2);
  aftDeck.receiveShadow = true;
  group.add(aftDeck);

  // 6. Industrial Towing Winch (Center of Working Deck)
  const winchBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 1.4), steelMat);
  winchBase.position.set(0, 2.15, 1.4);
  winchBase.castShadow = true;
  group.add(winchBase);

  // Winch Drum with Hawser Tow Cable
  const winchDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 16), hawserMat);
  winchDrum.rotation.z = Math.PI / 2;
  winchDrum.position.set(0, 2.7, 1.4);
  winchDrum.castShadow = true;
  group.add(winchDrum);

  // Safety Yellow Winch Flanges
  [-0.75, 0.75].forEach(x => {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.1, 16), safetyYellowMat);
    flange.rotation.z = Math.PI / 2;
    flange.position.set(x, 2.7, 1.4);
    group.add(flange);
  });

  // 7. Tubular Towing Arch (Gob-Eye / Towline Guide over Aft Deck)
  const towArch = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.08, 10, 24, Math.PI), safetyYellowMat);
  towArch.rotation.x = Math.PI / 2;
  towArch.position.set(0, 2.45, 4.4);
  towArch.castShadow = true;
  group.add(towArch);

  // Stern Guide Roller (Transom Lip)
  const sternRoller = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.2, 14), steelMat);
  sternRoller.rotation.z = Math.PI / 2;
  sternRoller.position.set(0, 2.05, 6.5);
  group.add(sternRoller);

  // 8. Superstructure & 360° Panoramic Elevated Wheelhouse
  const deckhouse = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, 4.2), whiteCabMat);
  deckhouse.position.set(0, 2.5, -2.0);
  deckhouse.castShadow = true;
  deckhouse.receiveShadow = true;
  group.add(deckhouse);

  // Elevated Panoramic Wheelhouse Cab
  const wheelhouse = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.15, 2.6), whiteCabMat);
  wheelhouse.position.set(0, 3.55, -2.1);
  wheelhouse.castShadow = true;
  group.add(wheelhouse);

  // 360° Panoramic Floor-to-Ceiling Angled Windows
  const winFront = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.65, 0.08), navGlassMat);
  winFront.position.set(0, 3.65, -3.42);
  group.add(winFront);

  const winBack = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.65, 0.08), navGlassMat);
  winBack.position.set(0, 3.65, -0.78);
  group.add(winBack);

  [-1.36, 1.36].forEach(x => {
    const winSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 2.4), navGlassMat);
    winSide.position.set(x, 3.65, -2.1);
    group.add(winSide);
  });

  // Wheelhouse Roof Equipment: Dual Searchlights & Radar
  const radarMast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.3), steelMat);
  radarMast.position.set(0, 4.75, -2.1);
  group.add(radarMast);

  const radarBar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.1), steelMat);
  radarBar.position.set(0, 5.35, -2.1);
  group.add(radarBar);

  [-0.8, 0.8].forEach(x => {
    const spotlight = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 12), safetyYellowMat);
    spotlight.rotation.x = Math.PI / 2;
    spotlight.position.set(x, 4.3, -3.2);
    group.add(spotlight);
  });

  // 9. Twin High-Rise Exhaust Stacks (Behind Wheelhouse)
  [-0.9, 0.9].forEach(x => {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 2.2, 14), safetyYellowMat);
    stack.position.set(x, 3.75, 0.1);
    stack.castShadow = true;
    group.add(stack);

    const stackBand = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 14), tugBlueMat);
    stackBand.position.set(x, 4.1, 0.1);
    group.add(stackBand);

    const stackCap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.25, 14), rubberFenderMat);
    stackCap.position.set(x, 4.85, 0.1);
    group.add(stackCap);
  });
}

// ============================================================================
// 5. FISHING TRAWLER MODEL BUILDER
// Oceanic emerald green topsides, oxide maroon bottom, flared high-sheer bow,
// forward white wheelhouse, open working aft deck with fish hold hatch,
// towering bright yellow stern A-frame trawl gantry, twin net drums, and
// port/starboard outrigger stabilizer booms.
// ============================================================================
export function buildFishingModel(group, isDark) {
  const emeraldGreenMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x15803d : 0x16a34a, // Oceanic Emerald Green
    roughness: 0.45,
    metalness: 0.15
  });
  const maroonBottomMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x5a1810 : 0x7f1d1d,
    roughness: 0.5
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.3
  });
  const safetyYellowMat = new THREE.MeshStandardMaterial({
    color: 0xeab308, // Bright Safety Yellow Trawl Gantry & Gear
    roughness: 0.35
  });
  const darkDeckMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x22262e : 0x333b47,
    roughness: 0.7
  });
  const netMat = new THREE.MeshStandardMaterial({
    color: 0x064e3b, // Dark Spooled Trawl Netting
    roughness: 0.8
  });
  const navGlassMat = new THREE.MeshBasicMaterial({ color: 0x080c14 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45 });

  // 1. Lower Hull (Maroon Oxide Red)
  const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.65, 13.8), maroonBottomMat);
  lowerHull.position.set(0, 0.32, 0.4);
  lowerHull.castShadow = true;
  lowerHull.receiveShadow = true;
  group.add(lowerHull);

  const lowerBow = new THREE.Mesh(
    createTaperedBowGeometry(1.75, 0, 0.65, -6.5, -10.2, 0.68),
    maroonBottomMat
  );
  lowerBow.castShadow = true;
  group.add(lowerBow);

  // 2. Upper Hull Topsides (Oceanic Emerald Green with High Flared Bow)
  const upperHull = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.35, 13.8), emeraldGreenMat);
  upperHull.position.set(0, 1.32, 0.4);
  upperHull.castShadow = true;
  upperHull.receiveShadow = true;
  group.add(upperHull);

  const upperBow = new THREE.Mesh(
    createTaperedBowGeometry(1.8, 0.65, 2.0, -6.5, -10.2, 2.48),
    emeraldGreenMat
  );
  upperBow.castShadow = true;
  upperBow.receiveShadow = true;
  group.add(upperBow);

  // Transom Stern
  const transom = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.35, 1.8), emeraldGreenMat);
  transom.position.set(0, 1.32, 7.3);
  transom.castShadow = true;
  group.add(transom);

  // White Waterline Sheer Stripe
  const sheerStripe = new THREE.Mesh(new THREE.BoxGeometry(3.64, 0.12, 13.8), whiteMat);
  sheerStripe.position.set(0, 1.95, 0.4);
  group.add(sheerStripe);

  // 3. Working Aft Trawl Deck
  const mainDeck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 8.8), darkDeckMat);
  mainDeck.position.set(0, 2.0, 3.0);
  mainDeck.receiveShadow = true;
  group.add(mainDeck);

  // Fish Hold Raised Coaming Hatch
  const fishHold = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.28, 1.8), whiteMat);
  fishHold.position.set(0, 2.14, 2.4);
  fishHold.castShadow = true;
  group.add(fishHold);

  const hatchCover = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.6), safetyYellowMat);
  hatchCover.position.set(0, 2.32, 2.4);
  group.add(hatchCover);

  // 4. Forward Superstructure & Commercial Fishing Wheelhouse
  const forecastleDeck = new THREE.Mesh(
    createTaperedBowGeometry(1.7, 2.0, 2.22, -6.8, -10.0, 2.45),
    whiteMat
  );
  forecastleDeck.castShadow = true;
  group.add(forecastleDeck);

  const forwardCabin = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.1, 3.8), whiteMat);
  forwardCabin.position.set(0, 2.55, -3.2);
  forwardCabin.castShadow = true;
  forwardCabin.receiveShadow = true;
  group.add(forwardCabin);

  // Wheelhouse with Forward-Raked Windows (Classic trawler glare-reducing angle)
  const wheelhouse = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.95, 2.4), whiteMat);
  wheelhouse.position.set(0, 3.55, -3.4);
  wheelhouse.castShadow = true;
  group.add(wheelhouse);

  const winFront = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.45, 0.08), navGlassMat);
  winFront.position.set(0, 3.65, -4.62);
  winFront.rotation.x = 0.18; // Forward reverse rake
  group.add(winFront);

  [-1.26, 1.26].forEach(x => {
    const winSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 2.0), navGlassMat);
    winSide.position.set(x, 3.65, -3.4);
    group.add(winSide);
  });

  // Roof Mast & Searchlights
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.8), steelMat);
  mast.position.set(0, 4.85, -3.2);
  group.add(mast);

  const radarBar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.1), whiteMat);
  radarBar.position.set(0, 5.5, -3.2);
  group.add(radarBar);

  // 5. Twin Net Winch Drums (Mid-deck for handling trawl cables and nets)
  [-0.8, 0.8].forEach(x => {
    const winchFrame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65, 0.8), steelMat);
    winchFrame.position.set(x, 2.32, 4.6);
    group.add(winchFrame);

    const netDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.65, 14), netMat);
    netDrum.rotation.z = Math.PI / 2;
    netDrum.position.set(x, 2.48, 4.6);
    netDrum.castShadow = true;
    group.add(netDrum);
  });

  // 6. Towering Stern A-Frame Trawl Gantry (Signature Trawler Feature)
  // Left and Right A-Frame legs (Safety Yellow)
  const gantryLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 3.5), safetyYellowMat);
  gantryLeft.position.set(-1.4, 3.45, 7.2);
  gantryLeft.rotation.z = -0.15;
  gantryLeft.castShadow = true;
  group.add(gantryLeft);

  const gantryRight = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 3.5), safetyYellowMat);
  gantryRight.position.set(1.4, 3.45, 7.2);
  gantryRight.rotation.z = 0.15;
  gantryRight.castShadow = true;
  group.add(gantryRight);

  // Overhead Crossbeam with Net Blocks / Sheaves
  const crossbeam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.22), safetyYellowMat);
  crossbeam.position.set(0, 5.1, 7.2);
  crossbeam.castShadow = true;
  group.add(crossbeam);

  // Trawl Pulley Blocks
  [-0.7, 0.7].forEach(x => {
    const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 12), steelMat);
    pulley.rotation.x = Math.PI / 2;
    pulley.position.set(x, 4.85, 7.2);
    group.add(pulley);
  });

  // 7. Port & Starboard Outrigger Stabilizer Booms
  // Long steel booms hinged at midships and angled out over the water
  const boomGeo = new THREE.CylinderGeometry(0.04, 0.07, 4.6);
  const boomLeft = new THREE.Mesh(boomGeo, steelMat);
  boomLeft.position.set(-2.5, 3.6, -1.2);
  boomLeft.rotation.z = -0.85; // Angled out to port
  boomLeft.rotation.x = -0.1;
  boomLeft.castShadow = true;
  group.add(boomLeft);

  const boomRight = new THREE.Mesh(boomGeo, steelMat);
  boomRight.position.set(2.5, 3.6, -1.2);
  boomRight.rotation.z = 0.85; // Angled out to starboard
  boomRight.rotation.x = -0.1;
  boomRight.castShadow = true;
  group.add(boomRight);

  // Funnel on aft cabin corner
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 1.4, 12), emeraldGreenMat);
  funnel.position.set(0.9, 3.4, -1.6);
  funnel.castShadow = true;
  group.add(funnel);

  const funnelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 12), steelMat);
  funnelCap.position.set(0.9, 4.15, -1.6);
  group.add(funnelCap);
}

// ============================================================================
// MASTER BUILDER DISPATCHER
// Cleans up existing meshes and builds the requested category model.
// ============================================================================
export function buildShipModel(category, group, isDark = false) {
  if (!group) return;

  // Dispose and remove all existing child meshes to prevent memory leaks
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  }

  // Build the corresponding generalized model
  switch (category) {
    case 'tanker':
      buildTankerModel(group, isDark);
      break;
    case 'pleasure':
      buildYachtModel(group, isDark);
      break;
    case 'tug':
      buildTugModel(group, isDark);
      break;
    case 'fishing':
      buildFishingModel(group, isDark);
      break;
    case 'cargo':
    default:
      buildCargoModel(group, isDark);
      break;
  }
}
