import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CHOKEPOINTS } from '../../data/mockVessels';

export default function GlobalGlobeView({
  vessels = [],
  selectedVessel,
  onSelectVessel,
  onSwitchToTopographical,
  layers = { tracks: true, anchorage: true }
}) {
  const containerRef = useRef(null);
  const [hoveredVessel, setHoveredVessel] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d1117'); // Deep tactical space background

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 8, 26);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Subtle starfield / tactical particle grid in space
    const starsCount = 1200;
    const starsGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 200;
      starPositions[i + 1] = (Math.random() - 0.5) * 200;
      starPositions[i + 2] = (Math.random() - 0.5) * 200;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0x445566, size: 0.6, transparent: true, opacity: 0.6 });
    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);

    // Create high-detail canvas Earth Texture (procedural satellite relief + continents + lat/lon grid)
    const earthCanvas = document.createElement('canvas');
    earthCanvas.width = 2048;
    earthCanvas.height = 1024;
    const ctx = earthCanvas.getContext('2d');

    // Ocean deep slate base
    ctx.fillStyle = '#111b27';
    ctx.fillRect(0, 0, earthCanvas.width, earthCanvas.height);

    // Draw stylized continents and landmasses
    ctx.fillStyle = '#223242';
    // North America
    ctx.beginPath();
    ctx.ellipse(450, 320, 240, 160, 0, 0, Math.PI * 2);
    ctx.fill();
    // South America
    ctx.beginPath();
    ctx.ellipse(650, 680, 150, 220, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Europe & Asia
    ctx.beginPath();
    ctx.ellipse(1250, 300, 380, 180, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(1550, 420, 260, 160, 0, 0, Math.PI * 2);
    ctx.fill();
    // Africa
    ctx.beginPath();
    ctx.ellipse(1120, 560, 190, 220, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Australia
    ctx.beginPath();
    ctx.ellipse(1720, 720, 140, 110, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lat/Long Graticule Grid
    ctx.strokeStyle = 'rgba(70, 95, 120, 0.25)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= earthCanvas.width; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, earthCanvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= earthCanvas.height; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(earthCanvas.width, y);
      ctx.stroke();
    }

    // Equator & Prime Meridian highlight
    ctx.strokeStyle = 'rgba(255, 77, 21, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, earthCanvas.height / 2);
    ctx.lineTo(earthCanvas.width, earthCanvas.height / 2);
    ctx.stroke();

    const earthTexture = new THREE.CanvasTexture(earthCanvas);
    const globeRadius = 10;
    const earthGeo = new THREE.SphereGeometry(globeRadius, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.65,
      metalness: 0.2
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    // Atmospheric Glow Outer Layer
    const glowGeo = new THREE.SphereGeometry(globeRadius * 1.025, 48, 48);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x3388cc,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glowMesh);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(30, 20, 25);
    scene.add(dirLight);

    // Helpers to convert Lat/Lon to 3D Cartesian coords
    const latLonToVector3 = (lat, lon, radius = globeRadius) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      const x = -(radius * Math.sin(phi) * Math.cos(theta));
      const z = (radius * Math.sin(phi) * Math.sin(theta));
      const y = (radius * Math.cos(phi));
      return new THREE.Vector3(x, y, z);
    };

    // Group for vessels and interactive markers
    const vesselsGroup = new THREE.Group();
    scene.add(vesselsGroup);

    const interactiveMeshes = [];

    // Render Vessels on the Globe
    vessels.forEach(v => {
      const pos = latLonToVector3(v.lat, v.lon, globeRadius + 0.08);
      const isSelected = selectedVessel && selectedVessel.mmsi === v.mmsi;

      // Vessel Marker Group
      const markerGroup = new THREE.Group();
      markerGroup.position.copy(pos);
      markerGroup.lookAt(new THREE.Vector3(0, 0, 0)); // Orient radially away from Earth center

      // Directional arrow / chevron
      const arrowGeo = new THREE.ConeGeometry(0.2, 0.5, 3);
      arrowGeo.rotateX(Math.PI / 2);
      // Rotate by heading
      const hdgRad = THREE.MathUtils.degToRad(v.heading || v.cog || 0);
      arrowGeo.rotateZ(-hdgRad);

      const color = isSelected ? 0xff4d15 : (v.ais_status?.includes('GAP') ? 0xff4422 : 0x00e5ff);
      const arrowMat = new THREE.MeshBasicMaterial({ color });
      const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
      markerGroup.add(arrowMesh);

      // Core pulsating ping dot
      const dotGeo = new THREE.SphereGeometry(isSelected ? 0.22 : 0.15, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.userData = { vessel: v };
      markerGroup.add(dotMesh);
      interactiveMeshes.push(dotMesh);

      // Radar Ring for selected or alert vessels
      if (isSelected || v.ais_status?.includes('GAP')) {
        const ringGeo = new THREE.RingGeometry(0.35, 0.45, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xff4d15, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        markerGroup.add(ringMesh);
      }

      // Breadcrumb Track
      if (layers.tracks && v.track && v.track.length > 1) {
        const points = v.track.map(pt => latLonToVector3(pt[0], pt[1], globeRadius + 0.05));
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({
          color: isSelected ? 0xff4d15 : 0x00aacc,
          transparent: true,
          opacity: 0.6,
          linewidth: 2
        });
        const line = new THREE.Line(lineGeo, lineMat);
        scene.add(line);
      }

      vesselsGroup.add(markerGroup);
    });

    // Chokepoint strategic markers
    const chokepointsGroup = new THREE.Group();
    scene.add(chokepointsGroup);
    CHOKEPOINTS.forEach(cp => {
      const cpPos = latLonToVector3(cp.lat, cp.lon, globeRadius + 0.12);
      const cpGeo = new THREE.RingGeometry(0.3, 0.4, 16);
      const cpMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
      const cpMesh = new THREE.Mesh(cpGeo, cpMat);
      cpMesh.position.copy(cpPos);
      cpMesh.lookAt(new THREE.Vector3(0, 0, 0));
      chokepointsGroup.add(cpMesh);
    });

    // Orbit and Drag Interaction
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let targetRotationX = 0;
    let targetRotationY = 0;

    // Center on selected vessel if available
    if (selectedVessel) {
      const phi = (90 - selectedVessel.lat) * (Math.PI / 180);
      const theta = (selectedVessel.lon + 180) * (Math.PI / 180);
      earthMesh.rotation.y = -theta + Math.PI / 2;
      earthMesh.rotation.x = phi - Math.PI / 2;
      vesselsGroup.rotation.copy(earthMesh.rotation);
      chokepointsGroup.rotation.copy(earthMesh.rotation);
    }

    const onMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / width) * 2 - 1,
        -((e.clientY - rect.top) / height) * 2 + 1
      );

      // Raycast for hover
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes);

      if (intersects.length > 0) {
        const found = intersects[0].object.userData.vessel;
        setHoveredVessel(found);
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        container.style.cursor = 'pointer';
      } else {
        setHoveredVessel(null);
        container.style.cursor = isDragging ? 'grabbing' : 'grab';
      }

      if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        earthMesh.rotation.y += deltaX * 0.005;
        earthMesh.rotation.x += deltaY * 0.005;
        earthMesh.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, earthMesh.rotation.x));

        vesselsGroup.rotation.copy(earthMesh.rotation);
        chokepointsGroup.rotation.copy(earthMesh.rotation);

        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };

    const onMouseUp = () => {
      isDragging = false;
      container.style.cursor = 'grab';
    };

    const onClick = (e) => {
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / width) * 2 - 1,
        -((e.clientY - rect.top) / height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes);

      if (intersects.length > 0) {
        const v = intersects[0].object.userData.vessel;
        if (onSelectVessel) {
          onSelectVessel(v);
        }
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      camera.position.z += e.deltaY * 0.015;
      camera.position.z = Math.max(14, Math.min(42, camera.position.z));
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('click', onClick);
    container.addEventListener('wheel', onWheel, { passive: false });

    // Animation Loop
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Subtle atmospheric auto-spin when idle
      if (!isDragging) {
        earthMesh.rotation.y += 0.0006;
        vesselsGroup.rotation.copy(earthMesh.rotation);
        chokepointsGroup.rotation.copy(earthMesh.rotation);
      }

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
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('click', onClick);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [vessels, selectedVessel, layers]);

  return (
    <div className="relative w-full h-full bg-[#0b0e14] overflow-hidden select-none">
      {/* 3D Canvas Mount */}
      <div ref={containerRef} className="w-full h-full cursor-grab" />

      {/* Global Satellite Tactical HUD Overlay */}
      <div className="absolute top-4 left-6 pointer-events-none flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">
            GLOBAL SATELLITE ORBITAL SURVEILLANCE // ACTIVE
          </span>
        </div>
        <div className="text-[11px] text-gray-400 font-mono">
          COVERAGE: 180° W TO 180° E | RESOLUTION: 0.5M/PX TACTICAL SYNTHETIC APERTURE
        </div>
      </div>

      {/* Chokepoint Quick Navigation Pills */}
      <div className="absolute top-4 right-6 flex items-center gap-1.5 bg-[#141a24]/90 backdrop-blur-md p-1.5 rounded border border-[#2d3748]">
        <span className="text-[10px] text-gray-400 px-2 uppercase font-medium">QUICK SECTOR:</span>
        {CHOKEPOINTS.map(cp => (
          <button
            key={cp.id}
            onClick={() => {
              const matched = vessels.find(v => v.strait?.toLowerCase().includes(cp.name.toLowerCase()) || v.name.includes("ORION"));
              if (matched && onSelectVessel) onSelectVessel(matched);
            }}
            className="text-[11px] px-2.5 py-1 bg-[#1e2736] hover:bg-[#ff4d15] hover:text-white text-gray-200 rounded transition-colors"
          >
            {cp.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Hover Tooltip */}
      {hoveredVessel && (
        <div
          className="absolute z-30 pointer-events-none bg-[#111620]/95 backdrop-blur-md border border-[#ff4d15]/60 text-white p-2.5 rounded shadow-2xl flex flex-col gap-1 min-w-[200px]"
          style={{
            left: `${tooltipPos.x + 15}px`,
            top: `${tooltipPos.y - 40}px`
          }}
        >
          <div className="flex items-center justify-between border-b border-[#2d3748] pb-1">
            <span className="font-bold text-xs tracking-wide text-white">{hoveredVessel.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-[#ff4d15]/20 text-[#ff4d15] font-mono rounded">
              {hoveredVessel.type}
            </span>
          </div>
          <div className="grid grid-cols-2 text-[10px] gap-x-2 gap-y-0.5 text-gray-300 font-mono mt-0.5">
            <div>SOG: <span className="text-white font-semibold">{hoveredVessel.sog} KN</span></div>
            <div>HDG: <span className="text-white font-semibold">{hoveredVessel.heading}°T</span></div>
            <div>FLAG: <span className="text-white">{hoveredVessel.flag}</span></div>
            <div>STATUS: <span className="text-emerald-400">{hoveredVessel.ais_status || 'LIVE'}</span></div>
          </div>
          <div className="mt-1 pt-1 border-t border-[#2d3748] text-[9px] text-[#ff4d15] font-semibold flex items-center justify-between">
            <span>CLICK TO ENTER 3D TOPO VIEW</span>
            <span>▶</span>
          </div>
        </div>
      )}

      {/* Bottom Switch Bar to Topographical View */}
      {selectedVessel && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#141a24]/95 backdrop-blur-md border border-[#ff4d15] text-white px-5 py-2.5 rounded-lg shadow-2xl flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">TARGET ACQUIRED</span>
            <span className="text-sm font-bold text-white tracking-wide">{selectedVessel.name}</span>
          </div>
          <div className="h-6 w-px bg-gray-600" />
          <button
            onClick={onSwitchToTopographical}
            className="flex items-center gap-2 bg-[#ff4d15] hover:bg-[#e03d07] text-white px-4 py-1.5 rounded font-medium text-xs tracking-wider uppercase transition-all shadow-lg shadow-[#ff4d15]/30 active:scale-95"
          >
            <span>ENTER TOPOGRAPHICAL 3D VIEW</span>
            <span>➔</span>
          </button>
        </div>
      )}
    </div>
  );
}
