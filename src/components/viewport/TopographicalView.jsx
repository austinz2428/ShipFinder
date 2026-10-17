import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Eye, Map as MapIcon, Compass, Navigation, FileText } from 'lucide-react';
import MiniGpsScreen from './MiniGpsScreen';
import { buildShipModel, getShipCategory, SHIP_CATEGORY_META } from './shipModels';

export default function TopographicalView({
  vessel,
  allVessels = [],
  onReturnToGlobe,
  onToggleDrawer,
  showDrawer = false,
  layers = { tracks: true, anchorage: true, aisDark: false, bathymetry: false, weather: false }
}) {
  const containerRef = useRef(null);
  const [reticlePos, setReticlePos] = useState({ x: 0, y: 0, visible: true });
  const [liveMetrics, setLiveMetrics] = useState({ sog: 0, heading: 0, name: '' });
  const [activeCategory, setActiveCategory] = useState(() => getShipCategory(vessel?.type));

  const vesselGroupRef = useRef(null);
  const activeCategoryRef = useRef(getShipCategory(vessel?.type));

  // Real data references
  const vesselRef = useRef(vessel);
  useEffect(() => {
    vesselRef.current = vessel;
    if (vessel) {
      const cat = getShipCategory(vessel.type);
      setActiveCategory(cat);
      if (vesselGroupRef.current && activeCategoryRef.current !== cat) {
        activeCategoryRef.current = cat;
        buildShipModel(cat, vesselGroupRef.current, layers.aisDark);
      }
      setLiveMetrics({
        sog: vessel.sog ?? 10.0,
        heading: vessel.heading ?? vessel.cog ?? 11.0,
        name: vessel.name || 'VESSEL'
      });
    }
  }, [vessel, layers.aisDark]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene setup
    const scene = new THREE.Scene();
    const bgColor = layers.aisDark ? '#14171d' : '#e4e6ea';
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(bgColor, 0.007);

    // Camera setup (Elevated tactical isometric perspective matching reference image)
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 450);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, layers.aisDark ? 0.6 : 0.95);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, layers.aisDark ? 0.9 : 1.35);
    dirLight.position.set(40, 60, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 180;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Terrain Channel Formula: channel runs straight along Z with gentle fairway curvature
    const getChannelCenter = (z) => Math.sin(z * 0.025) * 5.0;
    const channelHalfWidth = 9.5;

    // Generate Point Cloud Topographical Terrain (Contoured Dot-Matrix Heightfield)
    const gridSizeX = 140;
    const gridSizeZ = 200;
    const spacing = 0.8;
    const halfX = (gridSizeX * spacing) / 2;
    const halfZ = (gridSizeZ * spacing) / 2;

    const positions = [];
    const colors = [];
    const baseColor = new THREE.Color(layers.aisDark ? '#8a92a0' : '#ffffff');
    const shadowColor = new THREE.Color(layers.aisDark ? '#3b4352' : '#bcc3cf');
    const waterDotColor = new THREE.Color(layers.aisDark ? '#1a2230' : '#d2d6df');

    for (let iz = 0; iz < gridSizeZ; iz++) {
      const z = iz * spacing - halfZ;
      const channelX = getChannelCenter(z);

      for (let ix = 0; ix < gridSizeX; ix++) {
        const x = ix * spacing - halfX;
        const distFromCenter = Math.abs(x - channelX);

        let y = 0;
        let isLand = false;

        if (distFromCenter > channelHalfWidth) {
          isLand = true;
          const bankDist = distFromCenter - channelHalfWidth;
          const baseHeight = Math.pow(bankDist * 0.28, 1.25);
          const ridgeNoise =
            Math.sin(x * 0.12 + z * 0.08) * 2.2 +
            Math.cos(x * 0.22 - z * 0.15) * 1.5 +
            Math.sin(z * 0.2) * 1.1;

          let rawHeight = Math.max(0.4, baseHeight + ridgeNoise);
          const contourStep = 0.9;
          y = Math.floor(rawHeight / contourStep) * contourStep + (rawHeight % contourStep) * 0.35;
        } else {
          y = layers.bathymetry ? -(1.0 - distFromCenter / channelHalfWidth) * 4.0 : 0.0;
        }

        positions.push(x, y, z);

        const c = isLand
          ? baseColor.clone().lerp(shadowColor, THREE.MathUtils.clamp((18 - y) / 22, 0, 0.8))
          : waterDotColor;
        colors.push(c.r, c.g, c.b);
      }
    }

    const topoGeo = new THREE.BufferGeometry();
    topoGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    topoGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const topoMat = new THREE.PointsMaterial({
      size: 0.48,
      vertexColors: true,
      transparent: true,
      opacity: layers.aisDark ? 0.75 : 0.95,
      sizeAttenuation: true
    });
    const topoPoints = new THREE.Points(topoGeo, topoMat);
    topoPoints.receiveShadow = true;
    scene.add(topoPoints);

    // Solid Terrain Base (Under points for ambient occlusion & depth)
    const baseTerrainGeo = new THREE.PlaneGeometry(gridSizeX * spacing, gridSizeZ * spacing, 60, 60);
    baseTerrainGeo.rotateX(-Math.PI / 2);
    const basePos = baseTerrainGeo.attributes.position;
    for (let i = 0; i < basePos.count; i++) {
      const bx = basePos.getX(i);
      const bz = basePos.getZ(i);
      const chX = getChannelCenter(bz);
      const dist = Math.abs(bx - chX);
      if (dist > channelHalfWidth) {
        const bd = dist - channelHalfWidth;
        basePos.setY(i, Math.pow(bd * 0.28, 1.25) * 0.95);
      } else {
        basePos.setY(i, -0.2);
      }
    }
    baseTerrainGeo.computeVertexNormals();
    const baseTerrainMat = new THREE.MeshStandardMaterial({
      color: layers.aisDark ? 0x222834 : 0xd6d9df,
      roughness: 0.9,
      metalness: 0.05
    });
    const baseTerrainMesh = new THREE.Mesh(baseTerrainGeo, baseTerrainMat);
    baseTerrainMesh.receiveShadow = true;
    scene.add(baseTerrainMesh);

    // Reflective Water Plane
    const waterGeo = new THREE.PlaneGeometry(gridSizeX * spacing * 1.3, gridSizeZ * spacing * 1.3);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: layers.aisDark ? 0x111620 : 0xe0e3e8,
      roughness: 0.22,
      metalness: 0.15,
      transparent: true,
      opacity: 0.92
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = 0.08;
    waterMesh.receiveShadow = true;
    scene.add(waterMesh);

    // =========================================================================
    // DYNAMIC SLEEK 3D VESSEL MODEL (Cargo, Tanker, Yacht, Tug, Fishing)
    // Automatically selects and builds the authentic naval-architecture model
    // matching this vessel's AIS fleet classification.
    // =========================================================================
    const vesselGroup = new THREE.Group();
    scene.add(vesselGroup);
    vesselGroupRef.current = vesselGroup;

    const initialCategory = getShipCategory(vesselRef.current?.type);
    activeCategoryRef.current = initialCategory;
    buildShipModel(initialCategory, vesselGroup, layers.aisDark);

    // LIVE MOVEMENT & CHANNEL ALIGNMENT STATE
    // Position vessel in the center of the waterway heading straight down the channel
    let vesselZ = 12.0;

    // Orbit Controls Setup (Smooth Camera Navigation)
    let isOrbiting = false;
    let prevMouse = { x: 0, y: 0 };
    let cameraSpherical = {
      radius: 68,
      theta: 0.65, // Tactical angled view
      phi: 1.05
    };

    const onMouseDown = (e) => {
      isOrbiting = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (isOrbiting) {
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        cameraSpherical.theta += dx * 0.006;
        cameraSpherical.phi -= dy * 0.006;
        cameraSpherical.phi = Math.max(0.25, Math.min(Math.PI / 2.05, cameraSpherical.phi));
        prevMouse = { x: e.clientX, y: e.clientY };
      }
    };

    const onMouseUp = () => { isOrbiting = false; };

    const onWheel = (e) => {
      e.preventDefault();
      cameraSpherical.radius += e.deltaY * 0.05;
      cameraSpherical.radius = Math.max(22, Math.min(120, cameraSpherical.radius));
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // iPhone & Mobile Touch Controls (Single-finger orbit, Two-finger pinch zoom)
    let prevTouch = null;
    let prevPinchDist = null;

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        prevTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        prevPinchDist = Math.hypot(dx, dy);
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 1 && prevTouch) {
        const dx = e.touches[0].clientX - prevTouch.x;
        const dy = e.touches[0].clientY - prevTouch.y;
        cameraSpherical.theta += dx * 0.008;
        cameraSpherical.phi -= dy * 0.008;
        cameraSpherical.phi = Math.max(0.25, Math.min(Math.PI / 2.05, cameraSpherical.phi));
        prevTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2 && prevPinchDist) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = (prevPinchDist - dist) * 0.15;
        cameraSpherical.radius += factor;
        cameraSpherical.radius = Math.max(20, Math.min(130, cameraSpherical.radius));
        prevPinchDist = dist;
      }
    };

    const onTouchEnd = () => {
      prevTouch = null;
      prevPinchDist = null;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    // Animation & Render Loop
    let animId;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Retrieve actual live vessel data
      const currentVessel = vesselRef.current;
      const realSog = currentVessel?.sog !== undefined ? currentVessel.sog : 10.0;
      const isUnderway = realSog >= 0.5;

      // 1. LIVE FORWARD PROPULSION DOWN THE WATER
      if (isUnderway) {
        // Speed scaling based on actual AIS speed (knots)
        const unitsPerSec = Math.max(1.8, Math.min(7.0, realSog * 0.38));
        vesselZ -= delta * unitsPerSec;

        // Continuous channel stream looping
        if (vesselZ < -55.0) {
          vesselZ = 45.0;
        }
      }

      // 2. POSITION BOAT DEAD CENTER IN THE WATERWAY
      const currentX = getChannelCenter(vesselZ);

      // Tangent angle calculation: guarantees the ship is pointing STRAIGHT DOWN THE WATER
      const lookAheadZ = vesselZ - 2.0;
      const lookAheadX = getChannelCenter(lookAheadZ);
      const fairwayAngle = Math.atan2(lookAheadX - currentX, lookAheadZ - vesselZ);

      // Boat pitch/roll bobbing in the water
      const pitchBob = Math.sin(elapsedTime * 2.2) * 0.015;
      const rollBob = Math.cos(elapsedTime * 1.8) * 0.012;

      vesselGroup.position.set(currentX, 0, vesselZ);
      // Aligned straight down the fairway with realistic hydrodynamics
      vesselGroup.rotation.set(pitchBob, fairwayAngle + Math.PI, rollBob);

      // Water surface wave shimmer
      waterMesh.position.y = 0.08 + Math.sin(elapsedTime * 1.5) * 0.015;

      // 3. SMOOTH CAMERA TRACKING (Ship stays centered in frame)
      const target = new THREE.Vector3(currentX, 3.2, vesselZ);
      const camX = target.x + cameraSpherical.radius * Math.sin(cameraSpherical.phi) * Math.sin(cameraSpherical.theta);
      const camY = target.y + cameraSpherical.radius * Math.cos(cameraSpherical.phi);
      const camZ = target.z + cameraSpherical.radius * Math.sin(cameraSpherical.phi) * Math.cos(cameraSpherical.theta);

      camera.position.set(camX, camY, camZ);
      camera.lookAt(target);

      // 4. SCREEN PROJECTION FOR TACTICAL RETICLE HUD LOCK
      const vScreenPos = target.clone();
      vScreenPos.project(camera);
      const sx = ((vScreenPos.x + 1) * width) / 2;
      const sy = ((-vScreenPos.y + 1) * height) / 2;
      setReticlePos({ x: sx, y: sy, visible: vScreenPos.z < 1 });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      vesselGroupRef.current = null;
      activeCategoryRef.current = null;
      renderer.dispose();
    };
  }, [layers]);

  const catMeta = SHIP_CATEGORY_META[activeCategory] || SHIP_CATEGORY_META.cargo;

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-crosshair" />

      {/* TACTICAL RETICLE & CROSSHAIR OVERLAY (Matching Reference Image Exactly) */}
      {reticlePos.visible && (
        <div
          className="absolute pointer-events-none transition-transform duration-75"
          style={{
            left: `${reticlePos.x}px`,
            top: `${reticlePos.y}px`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          {/* Outer Corner Reticle Brackets */}
          <div className="relative w-44 h-44 flex items-center justify-center">
            {/* Top-Left Bracket */}
            <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-tactical-text/60" />
            {/* Top-Right Bracket */}
            <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-tactical-text/60" />
            {/* Bottom-Left Bracket */}
            <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-tactical-text/60" />
            {/* Bottom-Right Bracket */}
            <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-tactical-text/60" />

            {/* Center Crosshair Lines */}
            <div className="absolute w-full h-[1px] bg-tactical-text/30" />
            <div className="absolute h-full w-[1px] bg-tactical-text/30" />

            {/* Subtle Arc Guideline */}
            <div className="absolute w-24 h-24 border border-dashed border-tactical-text/35 rounded-full" />
          </div>

          {/* North Heading Indicator & Degree Readout directly above the vessel */}
          <div className="absolute top-[-44px] left-1/2 -translate-x-1/2 flex flex-col items-center">
            <span className="text-xs font-bold text-tactical-text/80 tracking-widest font-mono">N</span>
            <div className="w-[1px] h-3 bg-tactical-text/60 my-0.5" />
            <span className="text-[11px] font-semibold text-tactical-text/90 tracking-wider font-mono">
              ↑ {String(Math.round(liveMetrics.heading)).padStart(3, '0')}°T
            </span>
          </div>

          {/* Horizontal Coordinate Axis Ticks */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 text-[10px] font-mono text-tactical-text/60">
            <span className="opacity-40">35</span>
            <span className="opacity-60">00</span>
            <span className="font-bold text-tactical-text">01</span>
            <span className="opacity-60">02</span>
            <span className="opacity-40">03</span>
          </div>
        </div>
      )}

      {/* Live Speed, Vessel Category & Propulsion HUD Readout */}
      <div className="absolute bottom-6 left-8 pointer-events-none bg-white/95 backdrop-blur-md border border-tactical-border px-4 py-2.5 rounded shadow-lg flex items-center gap-3.5 font-mono">
        <div className={`w-3 h-3 rounded-full ${catMeta.dotColor} animate-pulse shrink-0`} />
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-tactical-text uppercase tracking-wider">
              {liveMetrics.name}
            </span>
            <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${catMeta.badgeClass}`}>
              {catMeta.shortLabel}
            </span>
          </div>
          <div className="text-xs font-semibold text-tactical-dim flex items-center gap-2">
            <span className="text-sm font-bold text-tactical-text">{liveMetrics.sog} KN</span>
            <span className="text-[10px] text-tactical-muted">({(liveMetrics.sog * 1.852).toFixed(1)} km/h)</span>
            <span className="text-[10px] text-emerald-600 font-semibold uppercase">● {catMeta.label}</span>
          </div>
        </div>
      </div>

      {/* Tactical Vertical Coordinate Ticks along viewport left side */}
      <div className="absolute left-8 top-1/2 -translate-y-1/2 pointer-events-none flex flex-col gap-8 text-[10px] font-mono text-tactical-text/50">
        <div className="flex items-center gap-1.5"><span className="w-2 h-[1px] bg-tactical-text/40" />01</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-[1px] bg-tactical-text/60" />00</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-[1px] bg-tactical-text/40" />-01</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-[1px] bg-tactical-text/40" />-02</div>
      </div>

      {/* Top Right: Return to Live Map & Sector Indicator & Toggle Dossier */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-6 flex items-center gap-1.5 sm:gap-2 z-20">
        <button
          onClick={onReturnToGlobe}
          className="flex items-center gap-1.5 bg-white/95 hover:bg-[#ff4d15] hover:text-white text-tactical-text border border-tactical-border px-2.5 sm:px-3 py-1.5 rounded shadow-sm text-xs font-medium font-mono transition-all active:scale-95"
          title="Return to Live Map"
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">RETURN TO LIVE MAP</span>
          <span className="sm:hidden font-bold">MAP</span>
        </button>

        {onToggleDrawer && (
          <button
            onClick={onToggleDrawer}
            className={`flex items-center gap-1.5 border px-2 sm:px-2.5 py-1.5 rounded shadow-sm text-xs font-medium font-mono transition-all ${
              showDrawer
                ? 'bg-tactical-orange text-white border-tactical-orange'
                : 'bg-white/95 hover:bg-gray-100 text-tactical-text border-tactical-border'
            }`}
            title="Toggle Vessel AIS Dossier"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">DOSSIER // SPECS</span>
            <span className="sm:hidden font-bold">SPECS</span>
          </button>
        )}

        <div className={`hidden md:flex border rounded px-2.5 py-1.5 items-center gap-2 text-xs font-mono font-medium shadow-sm ${catMeta.badgeClass}`}>
          <div className={`w-2 h-2 rounded-full ${catMeta.dotColor}`} />
          <span>CLASS: {catMeta.shortLabel}</span>
        </div>

        <div className="hidden lg:flex bg-white/95 border border-tactical-border rounded px-2.5 py-1.5 items-center gap-2 text-xs font-mono text-tactical-muted shadow-sm">
          <Eye className="w-3.5 h-3.5 text-tactical-orange" />
          <span>3D TOPO FAIRWAY</span>
        </div>
      </div>

      {/* Live Mini GPS Screen Widget off to the right side (Tracking this specific boat live) */}
      {!showDrawer && (
        <MiniGpsScreen
          vessel={vessel}
          onExpandToFullMap={onReturnToGlobe}
        />
      )}
    </div>
  );
}
