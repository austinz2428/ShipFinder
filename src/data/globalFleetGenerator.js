// High-density realistic global maritime fleet generator
// Matches the visual distribution of MarineTraffic / VesselFinder shown in reference images

export function generateGlobalFleet() {
  const fleet = [];
  let mmsiCounter = 300000000;

  // 1. Top 20 Biggest Ships on the Great Lakes (Authentic Fleet Roster sorted by length)
  const greatLakesVessels = [
    { name: "PAUL R. TREGURTHA", mmsi: 366904930, imo: 7729057, type: "Cargo Ship", flag: "USA", cargo: "Low Sulfur Coal", lat: 43.15, lon: -82.42, sog: 10.2, cog: 182, heading: 182, draft: 8.9, length: 308.9, width: 32.0, last_port: "SUPERIOR", eta: "ST. CLAIR 14:00", strait: "Great Lakes", direction: "Southbound", lake: "Lake Huron", rank: 1, is_great_lakes: true },
    { name: "EDWIN H. GOTT", mmsi: 366904880, imo: 7606504, type: "Cargo Ship", flag: "USA", cargo: "Iron Ore", lat: 44.10, lon: -83.40, sog: 12.8, cog: 330, heading: 330, draft: 9.1, length: 306.0, width: 32.0, last_port: "GARY", eta: "DULUTH 11:00", strait: "Great Lakes", direction: "Northbound", lake: "Lake Huron", rank: 2, is_great_lakes: true },
    { name: "JAMES R. BARKER", mmsi: 366904940, imo: 7502447, type: "Cargo Ship", flag: "USA", cargo: "Taconite Pellets", lat: 47.25, lon: -88.10, sog: 12.1, cog: 285, heading: 285, draft: 9.0, length: 306.0, width: 32.0, last_port: "CLEVELAND", eta: "TWO HARBORS 07:00", strait: "Great Lakes", direction: "Westbound", lake: "Lake Superior", rank: 3, is_great_lakes: true },
    { name: "MESABI MINER", mmsi: 366904950, imo: 7525384, type: "Cargo Ship", flag: "USA", cargo: "Iron Ore Pellets", lat: 46.75, lon: -84.95, sog: 11.4, cog: 310, heading: 310, draft: 8.9, length: 306.0, width: 32.0, last_port: "DETROIT", eta: "DULUTH 22:30", strait: "Great Lakes", direction: "Northbound", lake: "Lake Superior", rank: 4, is_great_lakes: true },
    { name: "EDGAR B. SPEER", mmsi: 366904890, imo: 7625952, type: "Cargo Ship", flag: "USA", cargo: "Taconite", lat: 43.80, lon: -87.10, sog: 13.0, cog: 175, heading: 175, draft: 9.1, length: 306.0, width: 32.0, last_port: "TWO HARBORS", eta: "GARY 19:00", strait: "Great Lakes", direction: "Southbound", lake: "Lake Michigan", rank: 5, is_great_lakes: true },
    { name: "AMERICAN SPIRIT", mmsi: 366904920, imo: 7423392, type: "Cargo Ship", flag: "USA", cargo: "Low Sulfur Coal", lat: 41.75, lon: -82.50, sog: 11.9, cog: 72, heading: 72, draft: 8.8, length: 306.0, width: 32.0, last_port: "TOLEDO", eta: "BUFFALO 16:30", strait: "Great Lakes", direction: "Eastbound", lake: "Lake Erie", rank: 6, is_great_lakes: true },
    { name: "INDIANA HARBOR", mmsi: 366972000, imo: 7715367, type: "Cargo Ship", flag: "USA", cargo: "Taconite", lat: 42.10, lon: -87.10, sog: 11.5, cog: 345, heading: 345, draft: 8.6, length: 304.8, width: 32.0, last_port: "BURNS HARBOR", eta: "MARQUETTE 19:30", strait: "Great Lakes", direction: "Northbound", lake: "Lake Michigan", rank: 7, is_great_lakes: true },
    { name: "BURNS HARBOR", mmsi: 366972010, imo: 7826178, type: "Cargo Ship", flag: "USA", cargo: "Iron Ore Pellets", lat: 43.05, lon: -87.40, sog: 12.3, cog: 20, heading: 20, draft: 8.7, length: 304.8, width: 32.0, last_port: "BURNS HARBOR", eta: "SUPERIOR 12:00", strait: "Great Lakes", direction: "Northbound", lake: "Lake Michigan", rank: 8, is_great_lakes: true },
    { name: "STEWART J. CORT", mmsi: 366904820, imo: 7105348, type: "Cargo Ship", flag: "USA", cargo: "Pellets", lat: 45.85, lon: -84.80, sog: 10.9, cog: 92, heading: 92, draft: 8.7, length: 304.8, width: 32.0, last_port: "DULUTH", eta: "BURNS HARBOR 15:00", strait: "Great Lakes", direction: "Eastbound", lake: "Mackinac", rank: 9, is_great_lakes: true },
    { name: "AMERICAN CENTURY", mmsi: 366904980, imo: 7923196, type: "Cargo Ship", flag: "USA", cargo: "Coal", lat: 47.10, lon: -89.80, sog: 12.6, cog: 65, heading: 65, draft: 8.8, length: 304.8, width: 32.0, last_port: "SUPERIOR", eta: "DETROIT 18:00", strait: "Great Lakes", direction: "Eastbound", lake: "Lake Superior", rank: 10, is_great_lakes: true },
    { name: "AMERICAN INTEGRITY", mmsi: 366904910, imo: 7514696, type: "Cargo Ship", flag: "USA", cargo: "Iron Ore", lat: 44.80, lon: -82.90, sog: 11.7, cog: 160, heading: 160, draft: 8.8, length: 304.8, width: 32.0, last_port: "DULUTH", eta: "NANTICOKE 20:30", strait: "Great Lakes", direction: "Southbound", lake: "Lake Huron", rank: 11, is_great_lakes: true },
    { name: "WALTER J. MCCARTHY JR.", mmsi: 366904960, imo: 7514684, type: "Cargo Ship", flag: "USA", cargo: "Low Sulfur Coal", lat: 46.90, lon: -91.20, sog: 10.5, cog: 75, heading: 75, draft: 8.7, length: 304.8, width: 32.0, last_port: "SUPERIOR", eta: "ST. CLAIR 08:00", strait: "Great Lakes", direction: "Eastbound", lake: "Lake Superior", rank: 12, is_great_lakes: true },
    { name: "PRESQUE ISLE", mmsi: 366904830, imo: 7303853, type: "Cargo Ship", flag: "USA", cargo: "Stone & Pellets", lat: 45.30, lon: -83.45, sog: 11.2, cog: 145, heading: 145, draft: 8.6, length: 304.8, width: 31.7, last_port: "TWO HARBORS", eta: "GARY 14:00", strait: "Great Lakes", direction: "Southbound", lake: "Lake Huron", rank: 13, is_great_lakes: true },
    { name: "LEE A. TREGURTHA", mmsi: 366904860, imo: 5073953, type: "Cargo Ship", flag: "USA", cargo: "Iron Ore", lat: 41.90, lon: -81.70, sog: 12.0, cog: 250, heading: 250, draft: 8.4, length: 251.8, width: 22.9, last_port: "ESCANABA", eta: "ASHTABULA 11:30", strait: "Great Lakes", direction: "Westbound", lake: "Lake Erie", rank: 14, is_great_lakes: true },
    { name: "HON. JAMES L. OBERSTAR", mmsi: 366904840, imo: 5322518, type: "Cargo Ship", flag: "USA", cargo: "Iron Ore", lat: 46.78, lon: -92.05, sog: 8.5, cog: 235, heading: 235, draft: 8.4, length: 245.7, width: 22.9, last_port: "CONNEAUT", eta: "DULUTH 15:00", strait: "Great Lakes", direction: "Inbound", lake: "Lake Superior", rank: 15, is_great_lakes: true },
    { name: "JOHN G. MUNSON", mmsi: 366904850, imo: 5173670, type: "Cargo Ship", flag: "USA", cargo: "Limestone", lat: 44.20, lon: -86.95, sog: 13.2, cog: 190, heading: 190, draft: 8.3, length: 234.1, width: 21.9, last_port: "CALCITE", eta: "INDIANA HARBOR 17:00", strait: "Great Lakes", direction: "Southbound", lake: "Lake Michigan", rank: 16, is_great_lakes: true },
    { name: "ARTHUR M. ANDERSON", mmsi: 366914590, imo: 5025706, type: "Cargo Ship", flag: "USA", cargo: "Stone", lat: 46.80, lon: -89.50, sog: 11.8, cog: 78, heading: 78, draft: 8.2, length: 233.8, width: 21.3, last_port: "TWO HARBORS", eta: "GARY 22:00", strait: "Great Lakes", direction: "Eastbound", lake: "Lake Superior", rank: 17, is_great_lakes: true },
    { name: "CASON J. CALLAWAY", mmsi: 366904870, imo: 5065471, type: "Cargo Ship", flag: "USA", cargo: "Iron Ore Pellets", lat: 45.10, lon: -83.20, sog: 12.5, cog: 340, heading: 340, draft: 8.2, length: 233.8, width: 21.3, last_port: "LORAIN", eta: "DULUTH 09:00", strait: "Great Lakes", direction: "Northbound", lake: "Lake Huron", rank: 18, is_great_lakes: true },
    { name: "AMERICAN MARINER", mmsi: 366904970, imo: 7812543, type: "Cargo Ship", flag: "USA", cargo: "Coal", lat: 45.45, lon: -84.22, sog: 13.1, cog: 125, heading: 125, draft: 8.8, length: 222.5, width: 23.8, last_port: "SUPERIOR", eta: "DETROIT 06:30", strait: "Great Lakes", direction: "Southbound", lake: "Mackinac", rank: 19, is_great_lakes: true },
    { name: "SAM LAUD", mmsi: 367123450, imo: 7390208, type: "Cargo Ship", flag: "USA", cargo: "Iron Ore Pellets", lat: 44.62, lon: -86.85, sog: 12.4, cog: 42, heading: 42, draft: 8.5, length: 198.0, width: 20.7, last_port: "DULUTH", eta: "CLEVELAND 18:00", strait: "Great Lakes", direction: "Eastbound", lake: "Lake Michigan", rank: 20, is_great_lakes: true },
    // Additional Active Great Lakes Freighters, Tugs & Cutters
    { name: "KAYE E. BARKER", mmsi: 366904790, imo: 5217593, type: "Cargo Ship", flag: "USA", cargo: "Taconite", lat: 47.12, lon: -89.40, sog: 11.2, cog: 80, heading: 80, draft: 8.3, length: 233.8, width: 21.3, last_port: "SUPERIOR", eta: "TOLEDO 09:00", strait: "Great Lakes", direction: "Eastbound", lake: "Lake Superior", is_great_lakes: true },
    { name: "JOSEPH L. BLOCK", mmsi: 366972020, imo: 7525372, type: "Cargo Ship", flag: "USA", cargo: "Iron Ore", lat: 42.45, lon: -87.25, sog: 12.5, cog: 350, heading: 350, draft: 8.6, length: 221.9, width: 20.7, last_port: "INDIANA HARBOR", eta: "ESCANABA 08:30", strait: "Great Lakes", direction: "Northbound", lake: "Lake Michigan", is_great_lakes: true },
    { name: "WILFRED SYKES", mmsi: 366972030, imo: 5389528, type: "Cargo Ship", flag: "USA", cargo: "Pellets", lat: 43.50, lon: -87.30, sog: 11.8, cog: 175, heading: 175, draft: 8.1, length: 207.3, width: 21.3, last_port: "ESCANABA", eta: "BURNS HARBOR 14:00", strait: "Great Lakes", direction: "Southbound", lake: "Lake Michigan", is_great_lakes: true },
    { name: "HERBERT C. JACKSON", mmsi: 366904810, imo: 5148649, type: "Cargo Ship", flag: "USA", cargo: "Limestone", lat: 44.50, lon: -83.10, sog: 12.0, cog: 165, heading: 165, draft: 8.2, length: 210.3, width: 20.7, last_port: "STONEPORT", eta: "DETROIT 21:00", strait: "Great Lakes", direction: "Southbound", lake: "Lake Huron", is_great_lakes: true },
    { name: "GREAT REPUBLIC", mmsi: 367098410, imo: 7904097, type: "Cargo Ship", flag: "USA", cargo: "Grain", lat: 41.80, lon: -82.10, sog: 11.5, cog: 68, heading: 68, draft: 7.9, length: 193.2, width: 20.7, last_port: "TOLEDO", eta: "BUFFALO 19:30", strait: "Great Lakes", direction: "Eastbound", lake: "Lake Erie", is_great_lakes: true },
    { name: "AMERICAN COURAGE", mmsi: 366904990, imo: 7634226, type: "Cargo Ship", flag: "USA", cargo: "Sand & Stone", lat: 41.50, lon: -81.70, sog: 10.4, cog: 240, heading: 240, draft: 7.8, length: 193.5, width: 20.7, last_port: "CLEVELAND", eta: "SANDUSKY 17:00", strait: "Great Lakes", direction: "Westbound", lake: "Lake Erie", is_great_lakes: true },
    { name: "ALGOMA SAULT", mmsi: 316035171, imo: 9619282, type: "Cargo Ship", flag: "Canada", cargo: "Wheat", lat: 46.50, lon: -84.35, sog: 9.8, cog: 115, heading: 115, draft: 8.5, length: 225.5, width: 23.8, last_port: "THUNDER BAY", eta: "MONTREAL 12:00", strait: "Great Lakes", direction: "Downbound", lake: "Lake Superior", is_great_lakes: true },
    { name: "ALGOMA NIAGARA", mmsi: 316035172, imo: 9619294, type: "Cargo Ship", flag: "Canada", cargo: "Iron Ore", lat: 44.20, lon: -83.25, sog: 13.0, cog: 345, heading: 345, draft: 8.4, length: 225.5, width: 23.8, last_port: "HAMILTON", eta: "SUPERIOR 23:00", strait: "Great Lakes", direction: "Upbound", lake: "Lake Huron", is_great_lakes: true },
    { name: "CSL WELLAND", mmsi: 316031758, imo: 9694103, type: "Cargo Ship", flag: "Canada", cargo: "Corn", lat: 43.60, lon: -77.80, sog: 12.6, cog: 85, heading: 85, draft: 8.3, length: 225.5, width: 23.8, last_port: "TORONTO", eta: "QUEBEC 16:00", strait: "Great Lakes", direction: "Eastbound", lake: "Lake Ontario", is_great_lakes: true },
    { name: "ALPENA", mmsi: 366904780, imo: 5011707, type: "Cargo Ship", flag: "USA", cargo: "Dry Cement", lat: 45.05, lon: -83.40, sog: 11.0, cog: 155, heading: 155, draft: 6.9, length: 158.2, width: 16.8, last_port: "ALPENA", eta: "DETROIT 04:00", strait: "Great Lakes", direction: "Southbound", lake: "Lake Huron", is_great_lakes: true },
    { name: "USCGC MACKINAW", mmsi: 369843000, imo: 9271054, type: "Tug / Tow", flag: "USA", cargo: "Icebreaking & Security", lat: 45.78, lon: -84.72, sog: 14.5, cog: 270, heading: 270, draft: 5.2, length: 73.2, width: 17.7, last_port: "CHEBOYGAN", eta: "PATROL", strait: "Great Lakes", direction: "Patrol", lake: "Mackinac", is_great_lakes: true },
    { name: "USCGC ALDER", mmsi: 369842000, imo: 9271042, type: "Tug / Tow", flag: "USA", cargo: "Buoy Tender & SAR", lat: 46.75, lon: -92.10, sog: 12.0, cog: 90, heading: 90, draft: 4.0, length: 69.0, width: 14.0, last_port: "DULUTH", eta: "SUPERIOR BAY", strait: "Great Lakes", direction: "Patrol", lake: "Lake Superior", is_great_lakes: true }
  ];
  fleet.push(...greatLakesVessels);

  // Helper for generating realistic ship corridors
  const addShip = (name, type, flag, lat, lon, sog, cog, cargo, length = 180, width = 28) => {
    mmsiCounter += 1;
    fleet.push({
      name,
      mmsi: mmsiCounter,
      imo: Math.floor(9000000 + Math.random() * 800000),
      type,
      flag,
      cargo,
      lat,
      lon,
      sog: Math.round(sog * 10) / 10,
      cog: Math.round(cog),
      heading: Math.round(cog),
      draft: +(6 + Math.random() * 8).toFixed(1),
      length,
      width,
      last_port: "EN ROUTE",
      eta: "NORMAL",
      ais_status: "LIVE",
      score: Math.floor(75 + Math.random() * 25),
      track: [[lat - 0.05, lon - 0.05], [lat, lon]]
    });
  };

  // 2. Pleasure craft & yachts all along US East Coast & Florida & Great Lakes (Magenta)
  const pleasureClusters = [
    // Florida & Miami / Keys / Bahamas
    { baseLat: 25.8, baseLon: -80.1, count: 65, radius: 2.2 },
    { baseLat: 27.9, baseLon: -82.5, count: 45, radius: 1.8 },
    { baseLat: 26.5, baseLon: -78.5, count: 35, radius: 2.0 },
    // Lake Michigan & Chicago shore
    { baseLat: 42.0, baseLon: -87.5, count: 30, radius: 1.2 },
    // Lake Huron, Erie, Ontario, St. Lawrence, Mackinac
    { baseLat: 43.5, baseLon: -86.5, count: 45, radius: 1.5 },
    { baseLat: 41.8, baseLon: -82.8, count: 40, radius: 1.4 },
    { baseLat: 44.5, baseLon: -81.5, count: 35, radius: 1.6 },
    { baseLat: 43.8, baseLon: -77.5, count: 30, radius: 1.8 },
    // Long Island / New York / Chesapeake Bay / Boston
    { baseLat: 40.6, baseLon: -73.8, count: 85, radius: 1.5 },
    { baseLat: 38.5, baseLon: -76.3, count: 70, radius: 1.6 },
    { baseLat: 42.3, baseLon: -70.9, count: 45, radius: 1.2 },
    // Mediterranean (Monaco, Côte d'Azur, Balearics, Greece)
    { baseLat: 43.5, baseLon: 6.9, count: 75, radius: 2.0 },
    { baseLat: 39.5, baseLon: 2.5, count: 60, radius: 2.0 },
    { baseLat: 37.5, baseLon: 24.5, count: 65, radius: 2.5 }
  ];

  pleasureClusters.forEach(cluster => {
    for (let i = 0; i < cluster.count; i++) {
      const lat = cluster.baseLat + (Math.random() - 0.5) * cluster.radius;
      const lon = cluster.baseLon + (Math.random() - 0.5) * cluster.radius;
      const isMoored = Math.random() < 0.35;
      const sog = isMoored ? 0 : 4 + Math.random() * 16;
      const cog = Math.random() * 360;
      addShip(`YACHT-${Math.floor(Math.random() * 9000 + 1000)}`, "Pleasure Craft", "USA", lat, lon, sog, cog, "Passengers", 24, 6);
    }
  });

  // 3. Mississippi River & Inland Waterways Tug & Barge fleet (Blue)
  const mississippiPoints = [
    { lat: 44.9, lon: -93.1 }, { lat: 41.5, lon: -90.5 }, { lat: 38.6, lon: -90.2 },
    { lat: 37.0, lon: -89.2 }, { lat: 35.1, lon: -90.0 }, { lat: 33.4, lon: -91.0 },
    { lat: 32.3, lon: -90.9 }, { lat: 30.4, lon: -91.2 }, { lat: 29.9, lon: -90.0 }
  ];
  for (let i = 0; i < mississippiPoints.length - 1; i++) {
    const p1 = mississippiPoints[i];
    const p2 = mississippiPoints[i + 1];
    for (let step = 0; step < 18; step++) {
      const t = step / 18;
      const lat = p1.lat + (p2.lat - p1.lat) * t + (Math.random() - 0.5) * 0.15;
      const lon = p1.lon + (p2.lon - p1.lon) * t + (Math.random() - 0.5) * 0.15;
      const isSouthbound = Math.random() > 0.45;
      const cog = isSouthbound ? 165 + Math.random() * 30 : 345 + Math.random() * 30;
      const isMoored = Math.random() < 0.25;
      const sog = isMoored ? 0 : 5 + Math.random() * 6;
      addShip(`TUG ${['DELTA', 'RIVER', 'VALLEY', 'DIXIE', 'CAJUN', 'CRESCENT', 'MISSISSIPPI', 'OHIO'][Math.floor(Math.random() * 8)]} ${step + 1}`, "Tug / Tow", "USA", lat, lon, sog, cog, "Barge Tow", 38, 10);
    }
  }

  // 4. Gulf of Mexico Tankers & Offshore Supply (Orange Tankers & Blue Support)
  for (let i = 0; i < 180; i++) {
    const lat = 25.5 + Math.random() * 4.5;
    const lon = -96.0 + Math.random() * 8.5;
    const isTanker = Math.random() > 0.35;
    const type = isTanker ? "Tanker" : "Tug / Tow";
    const cargo = isTanker ? "Crude Oil" : "Offshore Supply";
    const sog = Math.random() < 0.2 ? 0 : 7 + Math.random() * 8;
    const cog = Math.random() * 360;
    addShip(`${isTanker ? 'PETRO' : 'OSV'} GULF ${i + 1}`, type, "USA", lat, lon, sog, cog, cargo, isTanker ? 240 : 65, isTanker ? 40 : 14);
  }

  // 5. Transatlantic Shipping Lanes (US East Coast to Europe)
  for (let i = 0; i < 280; i++) {
    const t = Math.random();
    const lat = 34.0 + t * 16.0 + (Math.random() - 0.5) * 6.0;
    const lon = -74.0 + t * 62.0 + (Math.random() - 0.5) * 4.0;
    const isEastbound = Math.random() > 0.45;
    const cog = isEastbound ? 65 + (Math.random() - 0.5) * 20 : 245 + (Math.random() - 0.5) * 20;
    const isTanker = Math.random() > 0.6;
    const type = isTanker ? "Tanker" : "Cargo Ship";
    const cargo = isTanker ? "Refined Products" : "TEU Containers";
    const sog = 12 + Math.random() * 8;
    addShip(`ATLANTIC ${isTanker ? 'EXPRESS' : 'VOYAGER'} ${i + 1}`, type, ['Panama', 'Liberia', 'Marshall Isl', 'Singapore', 'USA'][Math.floor(Math.random() * 5)], lat, lon, sog, cog, cargo, 280, 38);
  }

  // 6. US Pacific Coast Shipping (Seattle, SF, LA/Long Beach, Alaska)
  for (let i = 0; i < 160; i++) {
    const lat = 30.0 + Math.random() * 24.0;
    const lon = -128.0 + (lat - 30.0) * 0.18 + (Math.random() - 0.5) * 3.5;
    const isNorthbound = Math.random() > 0.5;
    const cog = isNorthbound ? 320 + (Math.random() - 0.5) * 20 : 140 + (Math.random() - 0.5) * 20;
    const type = Math.random() > 0.5 ? "Cargo Ship" : "Tanker";
    const sog = 10 + Math.random() * 8;
    addShip(`PACIFIC ${type === 'Tanker' ? 'STAR' : 'PIONEER'} ${i + 1}`, type, "Liberia", lat, lon, sog, cog, "Commercial Cargo", 260, 36);
  }

  // 7. Caribbean & Panama Canal Corridor
  for (let i = 0; i < 120; i++) {
    const lat = 8.5 + Math.random() * 16.0;
    const lon = -84.0 + Math.random() * 20.0;
    const type = Math.random() > 0.4 ? "Cargo Ship" : (Math.random() > 0.5 ? "Passenger" : "Tanker");
    const cog = Math.random() * 360;
    const sog = 11 + Math.random() * 8;
    addShip(`CARIBBEAN ${type === 'Passenger' ? 'ROYAL' : (type === 'Tanker' ? 'ENERGY' : 'TRADER')} ${i + 1}`, type, "Bahamas", lat, lon, sog, cog, "Commercial", 220, 32);
  }

  // 8. Commercial Fishing Trawler Fleets
  const fishingClusters = [
    { baseLat: 43.5, baseLon: -66.5, count: 40, radius: 2.0 }, // Georges Bank
    { baseLat: 47.0, baseLon: -52.0, count: 40, radius: 2.5 }, // Grand Banks
    { baseLat: 56.0, baseLon: 3.5, count: 50, radius: 2.2 },   // North Sea
    { baseLat: 56.0, baseLon: -164.0, count: 45, radius: 3.5 }, // Bering Sea
    { baseLat: 28.0, baseLon: -92.0, count: 35, radius: 2.5 }  // Gulf Shrimpers
  ];
  fishingClusters.forEach(cluster => {
    for (let i = 0; i < cluster.count; i++) {
      const lat = cluster.baseLat + (Math.random() - 0.5) * cluster.radius;
      const lon = cluster.baseLon + (Math.random() - 0.5) * cluster.radius;
      const sog = 3 + Math.random() * 8;
      const cog = Math.random() * 360;
      addShip(`TRAWLER ${['NORTHERN', 'OCEANIC', 'PACIFIC', 'ATLANTIC', 'SILVER', 'ARCTIC'][Math.floor(Math.random() * 6)]} ${i + 1}`, "Fishing", "USA", lat, lon, sog, cog, "Fresh Catch", 42, 9);
    }
  });

  // 9. European Corridors (Bosphorus, Dover, Mediterranean, Gibraltar)
  fleet.push(
    { name: "MV ORION", mmsi: 938472200, imo: 9384722, type: "Tanker", flag: "Malta", cargo: "Crude Oil", lat: 41.1685, lon: 29.0558, sog: 9.4, cog: 11, heading: 11, draft: 14.2, length: 245, width: 42, last_port: "CONSTANTA", eta: "N-GATE 15:10", strait: "Bosphorus", direction: "Northbound", ais_status: "GAP 18M", score: 74, track: [[41.112, 29.048], [41.1685, 29.0558]] },
    { name: "MV KARA", mmsi: 215883000, imo: 9214739, type: "Cargo Ship", flag: "Panama", cargo: "General Cargo", lat: 41.2150, lon: 29.0980, sog: 11.8, cog: 38, heading: 38, draft: 11.5, length: 220, width: 32, last_port: "PIRAEUS", eta: "ODESSA 19:40", strait: "Bosphorus", direction: "Northbound", ais_status: "LIVE", score: 88, track: [[41.168, 29.058], [41.215, 29.098]] },
    { name: "MV MIRA", mmsi: 271044120, imo: 9152341, type: "Cargo Ship", flag: "Turkey", cargo: "Grain", lat: 41.1350, lon: 29.0505, sog: 9.4, cog: 16, heading: 15, draft: 12.1, length: 198, width: 30, last_port: "IZMIR", eta: "VARNA 21:00", strait: "Bosphorus", direction: "Northbound", ais_status: "LIVE", score: 94, track: [[41.090, 29.030], [41.135, 29.0505]] }
  );

  // English Channel & Dover
  for (let i = 0; i < 110; i++) {
    const lat = 49.5 + Math.random() * 2.2;
    const lon = -3.0 + Math.random() * 5.5;
    const isEastbound = Math.random() > 0.5;
    const cog = isEastbound ? 55 + (Math.random() - 0.5) * 15 : 235 + (Math.random() - 0.5) * 15;
    const type = Math.random() > 0.6 ? "Tanker" : "Cargo Ship";
    const sog = 11 + Math.random() * 7;
    addShip(`CHANNEL ${type === 'Tanker' ? 'CARRIER' : 'HAULER'} ${i + 1}`, type, "United Kingdom", lat, lon, sog, cog, "Commercial", 210, 30);
  }

  // Strait of Gibraltar & Western Med
  for (let i = 0; i < 80; i++) {
    const lat = 35.7 + Math.random() * 0.8;
    const lon = -6.2 + Math.random() * 2.0;
    const isEastbound = Math.random() > 0.5;
    const cog = isEastbound ? 85 + (Math.random() - 0.5) * 15 : 265 + (Math.random() - 0.5) * 15;
    const type = Math.random() > 0.5 ? "Cargo Ship" : "Tanker";
    const sog = 12 + Math.random() * 6;
    addShip(`GIBRALTAR ${type === 'Tanker' ? 'VOYAGER' : 'MERCHANT'} ${i + 1}`, type, "Panama", lat, lon, sog, cog, "Container / Oil", 250, 34);
  }

  // 10. Persian Gulf / Strait of Hormuz VLCC Supertankers
  for (let i = 0; i < 120; i++) {
    const lat = 24.5 + Math.random() * 4.0;
    const lon = 52.0 + Math.random() * 5.5;
    const isTanker = Math.random() > 0.2;
    const type = isTanker ? "Tanker" : "Cargo Ship";
    const cog = Math.random() * 360;
    const sog = 11 + Math.random() * 5;
    addShip(`ARABIAN ${isTanker ? 'TITAN VLCC' : 'NAVIGATOR'} ${i + 1}`, type, ['Saudi Arabia', 'UAE', 'Liberia', 'Marshall Isl'][Math.floor(Math.random() * 4)], lat, lon, sog, cog, "Crude Oil", 330, 60);
  }

  // 11. Malacca & Singapore Strait
  for (let i = 0; i < 140; i++) {
    const lat = 1.0 + Math.random() * 3.5;
    const lon = 101.5 + Math.random() * 3.5;
    const isEastbound = Math.random() > 0.5;
    const cog = isEastbound ? 120 + (Math.random() - 0.5) * 15 : 300 + (Math.random() - 0.5) * 15;
    const type = Math.random() > 0.5 ? "Cargo Ship" : "Tanker";
    const sog = 10 + Math.random() * 6;
    addShip(`MALACCA ${type === 'Tanker' ? 'TITAN' : 'LEADER'} ${i + 1}`, type, "Singapore", lat, lon, sog, cog, "Bulk Commodities", 270, 42);
  }

  // 12. East Asia Shipping (South China Sea, Taiwan Strait, Tokyo Bay)
  for (let i = 0; i < 180; i++) {
    const lat = 20.0 + Math.random() * 16.0;
    const lon = 118.0 + Math.random() * 18.0;
    const isNorthbound = Math.random() > 0.5;
    const cog = isNorthbound ? 30 + (Math.random() - 0.5) * 20 : 210 + (Math.random() - 0.5) * 20;
    const type = Math.random() > 0.6 ? "Cargo Ship" : "Tanker";
    const sog = 12 + Math.random() * 7;
    addShip(`ORIENT ${type === 'Tanker' ? 'ENERGY' : 'PEARL'} ${i + 1}`, type, ['Panama', 'Liberia', 'Singapore', 'Hong Kong'][Math.floor(Math.random() * 4)], lat, lon, sog, cog, "Export TEU", 290, 40);
  }

  return fleet;
}
