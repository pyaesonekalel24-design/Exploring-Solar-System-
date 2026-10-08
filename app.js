import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const $ = (id) => document.getElementById(id);

const loadingScreen = $("loading-screen");
const startScreen = $("start-screen");
const errorScreen = $("error-screen");
const errorMessage = $("error-message");
const startButton = $("start-button");
const gameUI = $("game-ui");
const gameElement = $("game");
const uiToggle = $("ui-toggle");
const northButton = $("north-button");
const labelLayer = $("planet-label-layer");


/* =========================================================
   THREE.JS STATE
   ========================================================= */

let scene;
let camera;
let renderer;

let solarSystemRoot = null;

let solarPlanets = [];

let moonPivot = null;

let stars = null;

let sunSprite = null;

let sunLight = null;

let sunMesh = null;

let sunGlow = null;

let sunRecord = null;

let gameStarted = false;


/* =========================================================
   UI STATE
   ========================================================= */

let uiMenuVisible = false;

let planetLabelsVisible = true;

let orbitLinesVisible = true;

let distanceVisible = true;

let cinematicMode = false;

let currentSpeedMode = "chill";


/* =========================================================
   FLOATING ORIGIN
   ========================================================= */

const FLOATING_ORIGIN_THRESHOLD = 5_000;

const PLANET_COLLISION_PADDING = 1.035;

const SUN_COLLISION_PADDING = 1.015;


/* =========================================================
   CAMERA LOOK
   ========================================================= */

let yaw = 0;
let pitch = -0.08;

let dragging = false;

let lastPointerX = 0;
let lastPointerY = 0;

const lookSensitivity = 0.0035;


/* =========================================================
   CREATOR MOBILE PINCH ZOOM
   ========================================================= */

let activeTouchPointers = new Map();

let creatorPinching = false;

let pinchStartDistance = 0;

let pinchStartFov = 70;

const CREATOR_MIN_FOV = 35;

const CREATOR_MAX_FOV = 90;

const CREATOR_PINCH_SENSITIVITY = 0.12;


function getPointerDistance(
  pointerA,
  pointerB
) {
  const dx =
    pointerA.clientX -
    pointerB.clientX;

  const dy =
    pointerA.clientY -
    pointerB.clientY;

  return Math.sqrt(
    dx * dx +
    dy * dy
  );
}


function beginCreatorPinch() {
  if (
    currentSpeedMode !==
    "creator"
  ) {
    return;
  }

  const pointers =
    Array.from(
      activeTouchPointers.values()
    );

  if (
    pointers.length !== 2
  ) {
    return;
  }

  creatorPinching = true;

  dragging = false;

  pinchStartDistance =
    getPointerDistance(
      pointers[0],
      pointers[1]
    );

  pinchStartFov =
    camera.fov;
}


function updateCreatorPinch() {
  if (
    !creatorPinching ||
    currentSpeedMode !==
      "creator"
  ) {
    return;
  }

  const pointers =
    Array.from(
      activeTouchPointers.values()
    );

  if (
    pointers.length !== 2
  ) {
    return;
  }

  const currentDistance =
    getPointerDistance(
      pointers[0],
      pointers[1]
    );

  const distanceChange =
    currentDistance -
    pinchStartDistance;

  camera.fov =
    THREE.MathUtils.clamp(
      pinchStartFov -
        distanceChange *
        CREATOR_PINCH_SENSITIVITY,

      CREATOR_MIN_FOV,

      CREATOR_MAX_FOV
    );

  camera.updateProjectionMatrix();
}


function endCreatorPinch() {
  if (
    activeTouchPointers.size <
    2
  ) {
    creatorPinching = false;
  }
}


function resetCreatorPinch() {
  activeTouchPointers.clear();

  creatorPinching = false;

  dragging = false;
}


/* =========================================================
   ENERGY
   ========================================================= */

let energy = 100;

const ENERGY_RECHARGE_RATE = 18;


/* =========================================================
   SPEED SYSTEM
   ========================================================= */

const CHILL_SPEED = 120;

const SUPERMAN_SPEED = 750_000;

const SPEED_ACCELERATION = 450_000;

const speedModes = {
  chill: {
    speed: CHILL_SPEED,
    drainRate: 0
  },

  superman: {
    speed: SUPERMAN_SPEED,
    drainRate: 10
  },

  creator: {
    speed: CHILL_SPEED,
    drainRate: 0
  }
};

let currentMovementSpeed =
  CHILL_SPEED;


/* =========================================================
   INPUT
   ========================================================= */

const pressedControls = new Set();
const pressedKeys = new Set();

const controlKeys = {
  forward: [
    "w",
    "arrowup"
  ],

  back: [
    "s",
    "arrowdown"
  ],

  left: [
    "a",
    "arrowleft"
  ],

  right: [
    "d",
    "arrowright"
  ],

  up: [
    " ",
    "space"
  ],

  down: [
    "shift",
    "control"
  ]
};


/* =========================================================
   CLOCK
   ========================================================= */

const clock = new THREE.Clock();


/* =========================================================
   REUSABLE VECTORS
   ========================================================= */

const sunPosition =
  new THREE.Vector3(
    0,
    0,
    0
  );

const tempDirection =
  new THREE.Vector3();

const tempRight =
  new THREE.Vector3();

const tempWorld =
  new THREE.Vector3();

const tempProjected =
  new THREE.Vector3();

const tempToSun =
  new THREE.Vector3();

const tempShift =
  new THREE.Vector3();

const tempCollisionPosition =
  new THREE.Vector3();

const tempPreviousPosition =
  new THREE.Vector3();

const tempMovementVector =
  new THREE.Vector3();

const tempClosestPoint =
  new THREE.Vector3();

const tempStartToBody =
  new THREE.Vector3();

const tempBodyPosition =
  new THREE.Vector3();

const tempCollisionOffset =
  new THREE.Vector3();

const worldUp =
  new THREE.Vector3(
    0,
    1,
    0
  );

const raycaster =
  new THREE.Raycaster();

const sunOccluders = [];


/* =========================================================
   TEXTURE SYSTEM
   ========================================================= */

const textureLoader =
  new THREE.TextureLoader();

const TEXTURE_URLS = {
  earth:
    [
      "https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg",
      "https://cdn.jsdelivr.net/gh/elymas/solar-simulator@main/public/textures/2k_earth_daymap.jpg"
    ],

  earthClouds:
    [
      "https://www.solarsystemscope.com/textures/download/2k_earth_clouds.jpg",
      "https://cdn.jsdelivr.net/gh/elymas/solar-simulator@main/public/textures/2k_earth_clouds.jpg"
    ],

  jupiter:
    [
      "https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg",
      "https://cdn.jsdelivr.net/gh/elymas/solar-simulator@main/public/textures/2k_jupiter.jpg"
    ],

  saturn:
    [
      "https://www.solarsystemscope.com/textures/download/2k_saturn.jpg",
      "https://cdn.jsdelivr.net/gh/elymas/solar-simulator@main/public/textures/2k_saturn.jpg"
    ],

  saturnRing:
    [
      "https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png",
      "https://cdn.jsdelivr.net/gh/elymas/solar-simulator@main/public/textures/2k_saturn_ring_alpha.png"
    ]
};


function configureLoadedTexture(texture) {
  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.anisotropy =
    renderer
      ? Math.min(
          4,
          renderer.capabilities.getMaxAnisotropy()
        )
      : 1;

  texture.minFilter =
    THREE.LinearMipmapLinearFilter;

  texture.magFilter =
    THREE.LinearFilter;

  texture.needsUpdate =
    true;

  return texture;
}


function loadTextureWithFallback(
  urls,
  onLoad
) {
  let attemptIndex = 0;

  const attempt =
    () => {
      if (
        attemptIndex >=
        urls.length
      ) {
        return;
      }

      const url =
        urls[attemptIndex];

      textureLoader.load(
        url,

        (texture) => {
          configureLoadedTexture(
            texture
          );

          onLoad(
            texture
          );
        },

        undefined,

        () => {
          attemptIndex += 1;

          attempt();
        }
      );
    };

  attempt();
}


/* =========================================================
   REAL ASTRONOMICAL SCALE
   ========================================================= */

const KM_PER_AU =
  149_597_870.7;

const GAME_UNITS_PER_KM =
  0.001;

const GAME_UNITS_PER_AU =
  KM_PER_AU *
  GAME_UNITS_PER_KM;


/* =========================================================
   WHOLE SOLAR SYSTEM SPATIAL SCALE
   ========================================================= */

const SOLAR_SYSTEM_SCALE =
  3;


/* =========================================================
   REAL-TIME ORBITS
   ========================================================= */

const SECONDS_PER_DAY =
  86_400;

const SIMULATION_TIME_MULTIPLIER =
  1;


/* =========================================================
   BODY RADII
   ========================================================= */

const SUN_RADIUS_KM =
  696_340;

const EARTH_RADIUS_KM =
  6_371;

const MOON_RADIUS_KM =
  1_737.4;

const SUN_RADIUS =
  SUN_RADIUS_KM *
  GAME_UNITS_PER_KM *
  SOLAR_SYSTEM_SCALE;

const EARTH_GAME_RADIUS =
  EARTH_RADIUS_KM *
  GAME_UNITS_PER_KM *
  SOLAR_SYSTEM_SCALE;

const MOON_RADIUS =
  MOON_RADIUS_KM *
  GAME_UNITS_PER_KM *
  SOLAR_SYSTEM_SCALE;

const MOON_ORBIT_RADIUS =
  384_400 *
  GAME_UNITS_PER_KM *
  SOLAR_SYSTEM_SCALE;

const MOON_ORBIT_PERIOD_DAYS =
  27.322;


/* =========================================================
   PLANET DATA
   ========================================================= */

const planetDataList = [
  {
    name:
      "Mercury",

    radiusKm:
      2_439.7,

    semiMajorAxisAU:
      0.387098,

    orbitalPeriodDays:
      87.969,

    rotationPeriodHours:
      1407.6,

    color:
      0x9a8d7d
  },

  {
    name:
      "Venus",

    radiusKm:
      6_051.8,

    semiMajorAxisAU:
      0.723332,

    orbitalPeriodDays:
      224.701,

    rotationPeriodHours:
      -5832.5,

    color:
      0xb98b55
  },

  {
    name:
      "Earth",

    radiusKm:
      EARTH_RADIUS_KM,

    semiMajorAxisAU:
      1,

    orbitalPeriodDays:
      365.256,

    rotationPeriodHours:
      23.934,

    color:
      0x3f6fa5
  },

  {
    name:
      "Mars",

    radiusKm:
      3_389.5,

    semiMajorAxisAU:
      1.523679,

    orbitalPeriodDays:
      686.98,

    rotationPeriodHours:
      24.623,

    color:
      0xa44f32
  },

  {
    name:
      "Jupiter",

    radiusKm:
      69_911,

    semiMajorAxisAU:
      5.2044,

    orbitalPeriodDays:
      4332.59,

    rotationPeriodHours:
      9.925,

    color:
      0xc28f62
  },

  {
    name:
      "Saturn",

    radiusKm:
      58_232,

    semiMajorAxisAU:
      9.5826,

    orbitalPeriodDays:
      10759.22,

    rotationPeriodHours:
      10.656,

    color:
      0xc7ad7c
  },

  {
    name:
      "Uranus",

    radiusKm:
      25_362,

    semiMajorAxisAU:
      19.2184,

    orbitalPeriodDays:
      30688.5,

    rotationPeriodHours:
      -17.24,

    color:
      0x8eced4
  },

  {
    name:
      "Neptune",

    radiusKm:
      24_622,

    semiMajorAxisAU:
      30.1104,

    orbitalPeriodDays:
      60182,

    rotationPeriodHours:
      16.11,

    color:
      0x3f62c7
  }
];


/* =========================================================
   PLANET CREATION
   ========================================================= */

function createPlanet(
  planetData
) {
  const radius =
    planetData.radiusKm *
    GAME_UNITS_PER_KM *
    SOLAR_SYSTEM_SCALE;

  const distance =
    planetData.semiMajorAxisAU *
    GAME_UNITS_PER_AU *
    SOLAR_SYSTEM_SCALE;

  const orbitGroup =
    new THREE.Group();

  const planet =
    new THREE.Group();

  orbitGroup.rotation.y =
    Math.random() *
    Math.PI *
    2;

  planet.position.x =
    distance;

  const geometry =
    new THREE.SphereGeometry(
      radius,
      48,
      32
    );

  const material =
    new THREE.MeshStandardMaterial({
      color:
        planetData.color,

      roughness:
        0.9,

      metalness:
        0
    });

  const mesh =
    new THREE.Mesh(
      geometry,
      material
    );

  mesh.name =
    `${planetData.name} Surface`;

  planet.add(
    mesh
  );

  planet.userData =
    {
      bodyType:
        "planet",

      planetName:
        planetData.name,

      physicalRadius:
        radius,

      collisionRadius:
        radius *
        PLANET_COLLISION_PADDING
    };

  orbitGroup.add(
    planet
  );

  solarSystemRoot.add(
    orbitGroup
  );

  const record = {
    ...planetData,

    orbitGroup,

    planet,

    mesh,

    radius,

    distance,

    collisionRadius:
      radius *
      PLANET_COLLISION_PADDING,

    orbitalAngle:
      orbitGroup.rotation.y,

    rotationSpeed:
      (
        2 *
        Math.PI
      ) /
      (
        planetData.rotationPeriodHours *
        3600
      ),

    orbitalSpeed:
      (
        2 *
        Math.PI
      ) /
      (
        planetData.orbitalPeriodDays *
        SECONDS_PER_DAY
      ),

    label:
      createPlanetLabel(
        planetData.name
      ),

    orbitLine:
      createOrbitLine(
        distance
      )
  };

  applyDetailedPlanetAppearance(
    record
  );

  solarPlanets.push(
    record
  );

  if (
    planetData.name ===
    "Earth"
  ) {
    createMoon(
      record
    );
  }

  if (
    planetData.name ===
    "Sun"
  ) {
    sunOccluders.push(
      mesh
    );
  }

  return record;
}


/* =========================================================
   DETAILED PLANET APPEARANCE
   ========================================================= */

function applyDetailedPlanetAppearance(
  record
) {
  if (
    record.name ===
    "Earth"
  ) {
    record.mesh.material =
      new THREE.MeshStandardMaterial({
        color:
          0xffffff,

        roughness:
          0.95,

        metalness:
          0
      });

    loadTextureWithFallback(
      TEXTURE_URLS.earth,
      (texture) => {
        record.mesh.material.map =
          texture;

        record.mesh.material.needsUpdate =
          true;
      }
    );

    loadTextureWithFallback(
      TEXTURE_URLS.earthClouds,
      (texture) => {
        const cloudMaterial =
          new THREE.MeshStandardMaterial({
            map:
              texture,

            transparent:
              true,

            opacity:
              0.48,

            depthWrite:
              false,

            roughness:
              1,

            metalness:
              0
          });

        const cloudMesh =
          new THREE.Mesh(
            new THREE.SphereGeometry(
              record.radius *
                1.012,

              48,
              32
            ),
            cloudMaterial
          );

        cloudMesh.name =
          "Earth Clouds";

        record.planet.add(
          cloudMesh
        );

        record.cloudMesh =
          cloudMesh;
      }
    );

    return;
  }

  if (
    record.name ===
    "Jupiter"
  ) {
    record.mesh.material =
      new THREE.MeshStandardMaterial({
        color:
          0xffffff,

        roughness:
          1,

        metalness:
          0
      });

    loadTextureWithFallback(
      TEXTURE_URLS.jupiter,
      (texture) => {
        record.mesh.material.map =
          texture;

        record.mesh.material.needsUpdate =
          true;
      }
    );

    return;
  }

  if (
    record.name ===
    "Saturn"
  ) {
    record.mesh.material =
      new THREE.MeshStandardMaterial({
        color:
          0xffffff,

        roughness:
          1,

        metalness:
          0
      });

    loadTextureWithFallback(
      TEXTURE_URLS.saturn,
      (texture) => {
        record.mesh.material.map =
          texture;

        record.mesh.material.needsUpdate =
          true;
      }
    );

    createSaturnRings(
      record
    );

    return;
  }
}


/* =========================================================
   SATURN RINGS
   ========================================================= */

function createSaturnRings(
  record
) {
  const innerRadius =
    record.radius *
    1.35;

  const outerRadius =
    record.radius *
    2.35;

  const ringGeometry =
    new THREE.RingGeometry(
      innerRadius,
      outerRadius,
      128
    );

  const ringMaterial =
    new THREE.MeshStandardMaterial({
      color:
        0xd7c7a5,

      side:
        THREE.DoubleSide,

      transparent:
        true,

      opacity:
        0.82,

      roughness:
        1,

      metalness:
        0,

      depthWrite:
        false
    });

  const ring =
    new THREE.Mesh(
      ringGeometry,
      ringMaterial
    );

  ring.rotation.x =
    Math.PI / 2;

  ring.name =
    "Saturn Rings";

  record.planet.add(
    ring
  );

  record.ringMesh =
    ring;

  loadTextureWithFallback(
    TEXTURE_URLS.saturnRing,
    (texture) => {
      ring.material.map =
        texture;

      ring.material.alphaMap =
        texture;

      ring.material.needsUpdate =
        true;
    }
  );
}


/* =========================================================
   MOON
   ========================================================= */

function createMoon(
  earthRecord
) {
  moonPivot =
    new THREE.Group();

  earthRecord.planet.add(
    moonPivot
  );

  const moonGeometry =
    new THREE.SphereGeometry(
      MOON_RADIUS,
      32,
      24
    );

  const moonMaterial =
    new THREE.MeshStandardMaterial({
      color:
        0xb9b5aa,

      roughness:
        1,

      metalness:
        0
    });

  const moon =
    new THREE.Mesh(
      moonGeometry,
      moonMaterial
    );

  moon.position.x =
    MOON_ORBIT_RADIUS;

  moon.name =
    "Moon";

  moon.userData =
    {
      bodyType:
        "moon",

      physicalRadius:
        MOON_RADIUS,

      collisionRadius:
        MOON_RADIUS *
        PLANET_COLLISION_PADDING
    };

  moonPivot.add(
    moon
  );

  earthRecord.moon =
    moon;

  earthRecord.moonPivot =
    moonPivot;

  earthRecord.moonAngle =
    0;

  earthRecord.moonOrbitalSpeed =
    (
      2 *
      Math.PI
    ) /
    (
      MOON_ORBIT_PERIOD_DAYS *
      SECONDS_PER_DAY
    );

  earthRecord.moonCollisionRadius =
    MOON_RADIUS *
    PLANET_COLLISION_PADDING;

  createPlanetLabel(
    "Moon",
    moon
  );
}


/* =========================================================
   SUN
   ========================================================= */

function createSun() {
  sunMesh =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        SUN_RADIUS,
        48,
        32
      ),

      new THREE.MeshBasicMaterial({
        color:
          0xffa928
      })
    );

  sunMesh.position.set(
    0,
    0,
    0
  );

  sunMesh.name =
    "Sun Surface";

  sunMesh.userData =
    {
      bodyType:
        "sun",

      physicalRadius:
        SUN_RADIUS,

      collisionRadius:
        SUN_RADIUS *
        SUN_COLLISION_PADDING
    };

  solarSystemRoot.add(
    sunMesh
  );

  sunOccluders.push(
    sunMesh
  );

  sunGlow =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        SUN_RADIUS *
          1.08,

        32,
        24
      ),

      new THREE.MeshBasicMaterial({
        color:
          0xff9a27,

        transparent:
          true,

        opacity:
          0.10,

        side:
          THREE.BackSide,

        depthWrite:
          false
      })
    );

  sunGlow.position.set(
    0,
    0,
    0
  );

  solarSystemRoot.add(
    sunGlow
  );

  sunRecord = {
    name:
      "Sun",

    planet:
      sunMesh,

    mesh:
      sunMesh,

    radius:
      SUN_RADIUS,

    collisionRadius:
      SUN_RADIUS *
      SUN_COLLISION_PADDING,

    label:
      createPlanetLabel(
        "Sun",
        sunMesh
      )
  };

  return sunRecord;
}


/* =========================================================
   SUN SPRITE
   ========================================================= */

function createSunSprite() {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    256;

  canvas.height =
    256;

  const context =
    canvas.getContext(
      "2d"
    );

  const gradient =
    context.createRadialGradient(
      128,
      128,
      10,
      128,
      128,
      128
    );

  gradient.addColorStop(
    0,
    "rgba(255,255,220,1)"
  );

  gradient.addColorStop(
    0.18,
    "rgba(255,225,150,0.95)"
  );

  gradient.addColorStop(
    0.45,
    "rgba(255,170,60,0.38)"
  );

  gradient.addColorStop(
    1,
    "rgba(255,130,20,0)"
  );

  context.fillStyle =
    gradient;

  context.fillRect(
    0,
    0,
    256,
    256
  );

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  texture.colorSpace =
    THREE.SRGBColorSpace;

  const material =
    new THREE.SpriteMaterial({
      map:
        texture,

      transparent:
        true,

      depthWrite:
        false,

      blending:
        THREE.AdditiveBlending
    });

  sunSprite =
    new THREE.Sprite(
      material
    );

  sunSprite.scale.set(
    SUN_RADIUS * 5,
    SUN_RADIUS * 5,
    1
  );

  solarSystemRoot.add(
    sunSprite
  );
}


/* =========================================================
   STAR FIELD
   ========================================================= */

function createStarField() {
  const geometry =
    new THREE.BufferGeometry();

  const starCount =
    3000;

  const positions =
    new Float32Array(
      starCount * 3
    );

  for (
    let index = 0;
    index <
    starCount;
    index += 1
  ) {
    const offset =
      index * 3;

    const radius =
      5000 +
      Math.random() *
      10000;

    const theta =
      Math.random() *
      Math.PI *
      2;

    const phi =
      Math.acos(
        2 *
          Math.random() -
          1
      );

    positions[offset] =
      radius *
      Math.sin(phi) *
      Math.cos(theta);

    positions[offset + 1] =
      radius *
      Math.cos(phi);

    positions[offset + 2] =
      radius *
      Math.sin(phi) *
      Math.sin(theta);
  }

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      positions,
      3
    )
  );

  const material =
    new THREE.PointsMaterial({
      color:
        0xffffff,

      size:
        2,

      sizeAttenuation:
        false
    });

  stars =
    new THREE.Points(
      geometry,
      material
    );

  scene.add(
    stars
  );
}


/* =========================================================
   ORBIT LINES
   ========================================================= */

function createOrbitLine(
  radius
) {
  const points = [];

  const segments =
    256;

  for (
    let index = 0;
    index <= segments;
    index += 1
  ) {
    const angle =
      (
        index /
        segments
      ) *
      Math.PI *
      2;

    points.push(
      new THREE.Vector3(
        Math.cos(angle) *
          radius,

        0,

        Math.sin(angle) *
          radius
      )
    );
  }

  const geometry =
    new THREE.BufferGeometry()
      .setFromPoints(
        points
      );

  const material =
    new THREE.LineBasicMaterial({
      color:
        0x65718c,

      transparent:
        true,

      opacity:
        0.28
    });

  const line =
    new THREE.Line(
      geometry,
      material
    );

  solarSystemRoot.add(
    line
  );

  return line;
}


/* =========================================================
   PLANET LABELS
   ========================================================= */

function createPlanetLabel(
  name,
  object = null
) {
  const label =
    document.createElement(
      "button"
    );

  label.type =
    "button";

  label.className =
    "planet-label";

  label.textContent =
    name;

  label.dataset.planet =
    name;

  label.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      teleportToBody(
        name,
        object
      );
    }
  );

  labelLayer.appendChild(
    label
  );

  return label;
}


/* =========================================================
   TELEPORT TO BODY
   ========================================================= */

function teleportToBody(
  name,
  suppliedObject = null
) {
  if (
    currentSpeedMode !==
    "creator"
  ) {
    return;
  }

  let target =
    suppliedObject;

  let radius =
    null;

  if (
    name ===
    "Sun"
  ) {
    target =
      sunMesh;

    radius =
      SUN_RADIUS;
  }

  if (
    name ===
    "Moon"
  ) {
    const earth =
      solarPlanets.find(
        (planet) =>
          planet.name ===
          "Earth"
      );

    if (
      earth &&
      earth.moon
    ) {
      target =
        earth.moon;

      radius =
        MOON_RADIUS;
    }
  }

  if (
    !target
  ) {
    const record =
      solarPlanets.find(
        (planet) =>
          planet.name ===
          name
      );

    if (
      record
    ) {
      target =
        record.planet;

      radius =
        record.radius;
    }
  }

  if (
    !target
  ) {
    return;
  }

  target.getWorldPosition(
    tempWorld
  );

  camera.position.copy(
    tempWorld
  );

  camera.position.z +=
    Math.max(
      radius *
        4,

      120
    );

  camera.lookAt(
    tempWorld
  );

  const euler =
    new THREE.Euler()
      .setFromQuaternion(
        camera.quaternion,
        "YXZ"
      );

  pitch =
    euler.x;

  yaw =
    euler.y;

  updateSunWorldPosition();
}


/* =========================================================
   SUN WORLD POSITION
   ========================================================= */

function updateSunWorldPosition() {
  if (
    !sunMesh
  ) {
    return;
  }

  sunMesh.getWorldPosition(
    sunPosition
  );

  if (
    sunLight
  ) {
    sunLight.position.copy(
      sunPosition
    );
  }

  if (
    sunSprite
  ) {
    sunSprite.position.copy(
      sunPosition
    );
  }
}


/* =========================================================
   SOLAR SYSTEM CREATION
   ========================================================= */

function createSolarSystem() {
  scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(
      0x02030a
    );

  camera =
    new THREE.PerspectiveCamera(
      70,
      window.innerWidth /
        window.innerHeight,
      0.1,
      60_000_000
    );

  camera.rotation.order =
    "YXZ";

  solarSystemRoot =
    new THREE.Group();

  scene.add(
    solarSystemRoot
  );

  scene.add(
    new THREE.HemisphereLight(
      0x8ea6d4,
      0x16111c,
      0.45
    )
  );

  sunLight =
    new THREE.PointLight(
      0xffd69a,
      4.0e10,
      0,
      2
    );

  sunLight.position.set(
    0,
    0,
    0
  );

  solarSystemRoot.add(
    sunLight
  );

  createSun();

  createSunSprite();

  createStarField();

  for (
    const planetData of
      planetDataList
  ) {
    createPlanet(
      planetData
    );
  }

  renderer =
    new THREE.WebGLRenderer({
      antialias:
        true,

      alpha:
        false
    });

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      1.75
    )
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;

  renderer.toneMapping =
    THREE.ACESFilmicToneMapping;

  renderer.toneMappingExposure =
    1.05;

  gameElement.prepend(
    renderer.domElement
  );

  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive 3D Solar System"
  );

  renderer.domElement.setAttribute(
    "role",
    "application"
  );

  const earthData =
    solarPlanets.find(
      (planet) =>
        planet.name ===
        "Earth"
    );

  if (
    earthData
  ) {
    earthData.planet.getWorldPosition(
      tempWorld
    );

    camera.position.copy(
      tempWorld
    );

    camera.position.z +=
      140 *
      SOLAR_SYSTEM_SCALE;

  } else {
    camera.position.set(
      0,
      50 *
        SOLAR_SYSTEM_SCALE,
      GAME_UNITS_PER_AU *
        SOLAR_SYSTEM_SCALE
    );
  }

  if (
    camera.position.length() >
    FLOATING_ORIGIN_THRESHOLD
  ) {
    tempShift.copy(
      camera.position
    );

    solarSystemRoot.position.sub(
      tempShift
    );

    camera.position.sub(
      tempShift
    );
  }

  updateSunWorldPosition();

  window.addEventListener(
    "resize",
    handleResize
  );

  setupControls();

  updateSpeedButtons();

  updateVisualToggleButtons();

  updateEnergyDisplay();

  setUIMenuVisible(
    false
  );

  animate();
}


/* =========================================================
   RESIZE
   ========================================================= */

function handleResize() {
  if (
    !camera ||
    !renderer
  ) {
    return;
  }

  camera.aspect =
    window.innerWidth /
    window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      1.75
    )
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
}


/* =========================================================
   INPUT CHECK
   ========================================================= */

function isControlPressed(
  name
) {
  if (
    pressedControls.has(
      name
    )
  ) {
    return true;
  }

  return controlKeys[
    name
  ].some(
    (key) =>
      pressedKeys.has(
        key
      )
  );
}


/* =========================================================
   PLAYER MOVEMENT
   ========================================================= */

function updateMovement(
  deltaTime
) {
  if (
    !gameStarted
  ) {
    return false;
  }

  const forwardAmount =
    Number(
      isControlPressed(
        "forward"
      )
    ) -
    Number(
      isControlPressed(
        "back"
      )
    );

  const rightAmount =
    Number(
      isControlPressed(
        "right"
      )
    ) -
    Number(
      isControlPressed(
        "left"
      )
    );

  const verticalAmount =
    Number(
      isControlPressed(
        "up"
      )
    ) -
    Number(
      isControlPressed(
        "down"
      )
    );

  const movement =
    new THREE.Vector3();

  if (
    forwardAmount !== 0
  ) {
    camera.getWorldDirection(
      tempDirection
    );

    movement.addScaledVector(
      tempDirection,
      forwardAmount
    );
  }

  if (
    rightAmount !== 0
  ) {
    camera.getWorldDirection(
      tempDirection
    );

    tempRight
      .crossVectors(
        tempDirection,
        worldUp
      )
      .normalize();

    movement.addScaledVector(
      tempRight,
      rightAmount
    );
  }

  movement.y +=
    verticalAmount;

  if (
    movement.lengthSq() ===
    0
  ) {
    return false;
  }

  if (
    energy <= 0 &&
    currentSpeedMode ===
      "superman"
  ) {
    setSpeedMode(
      "chill"
    );
  }

  movement.normalize();

  updateMovementSpeed(
    deltaTime
  );

  tempPreviousPosition.copy(
    camera.position
  );

  tempMovementVector.copy(
    movement
  );

  tempMovementVector.multiplyScalar(
    currentMovementSpeed *
      deltaTime
  );

  const collisionResult =
    resolvePlanetCollision(
      tempPreviousPosition,
      tempMovementVector
    );

  if (
    collisionResult
  ) {
    camera.position.copy(
      collisionResult.position
    );

    return true;
  }

  camera.position.add(
    tempMovementVector
  );

  return true;
}


/* =========================================================
   MOVEMENT SPEED
   ========================================================= */

function updateMovementSpeed(
  deltaTime
) {
  const targetSpeed =
    speedModes[
      currentSpeedMode
    ].speed;

  if (
    currentSpeedMode ===
    "superman"
  ) {
    currentMovementSpeed =
      THREE.MathUtils.damp(
        currentMovementSpeed,
        targetSpeed,
        8,
        deltaTime
      );

    return;
  }

  currentMovementSpeed =
    targetSpeed;
}


/* =========================================================
   COLLISION HELPERS
   ========================================================= */

function getBodyCollisionTargets() {
  const targets = [];

  if (
    sunMesh
  ) {
    targets.push({
      object:
        sunMesh,

      radius:
        SUN_RADIUS *
        SUN_COLLISION_PADDING,

      name:
        "Sun"
    });
  }

  for (
    const record of
      solarPlanets
  ) {
    targets.push({
      object:
        record.planet,

      radius:
        record.collisionRadius,

      name:
        record.name
    });

    if (
      record.moon
    ) {
      targets.push({
        object:
          record.moon,

        radius:
          record.moonCollisionRadius,

        name:
          "Moon"
      });
    }
  }

  return targets;
}


function resolvePlanetCollision(
  startPosition,
  movementVector
) {
  const endPosition =
    tempCollisionPosition
      .copy(startPosition)
      .add(movementVector);

  const targets =
    getBodyCollisionTargets();

  let bestHit = null;

  for (
    const target of
      targets
  ) {
    target.object.getWorldPosition(
      tempBodyPosition
    );

    const hit =
      sweepSphereAgainstBody(
        startPosition,
        endPosition,
        tempBodyPosition,
        target.radius
      );

    if (
      !hit
    ) {
      continue;
    }

    if (
      !bestHit ||
      hit.t <
        bestHit.t
    ) {
      bestHit = {
        ...hit,

        bodyPosition:
          tempBodyPosition.clone(),

        radius:
          target.radius,

        name:
          target.name
      };
    }
  }

  if (
    !bestHit
  ) {
    return null;
  }

  const contactPosition =
    new THREE.Vector3()
      .lerpVectors(
        startPosition,
        endPosition,
        Math.max(
          0,
          bestHit.t -
            0.001
        )
      );

  tempCollisionOffset
    .copy(
      contactPosition
    )
    .sub(
      bestHit.bodyPosition
    );

  if (
    tempCollisionOffset.lengthSq() <
    0.000001
  ) {
    tempCollisionOffset.set(
      0,
      0,
      1
    );
  }

  tempCollisionOffset.normalize();

  const safeDistance =
    bestHit.radius;

  const correctedPosition =
    bestHit.bodyPosition
      .clone()
      .addScaledVector(
        tempCollisionOffset,
        safeDistance
      );

  return {
    position:
      correctedPosition,

    name:
      bestHit.name
  };
}


function sweepSphereAgainstBody(
  start,
  end,
  body,
  radius
) {
  tempStartToBody
    .copy(start)
    .sub(body);

  const movement =
    new THREE.Vector3()
      .copy(end)
      .sub(start);

  const movementLengthSq =
    movement.lengthSq();

  const radiusSq =
    radius * radius;

  if (
    tempStartToBody.lengthSq() <=
    radiusSq
  ) {
    return {
      t:
        0
    };
  }

  if (
    movementLengthSq <=
    0.0000001
  ) {
    return null;
  }

  const a =
    movementLengthSq;

  const b =
    2 *
    tempStartToBody.dot(
      movement
    );

  const c =
    tempStartToBody.lengthSq() -
    radiusSq;

  const discriminant =
    b * b -
    4 *
    a *
    c;

  if (
    discriminant <
    0
  ) {
    return null;
  }

  const sqrtDiscriminant =
    Math.sqrt(
      discriminant
    );

  const t1 =
    (
      -b -
      sqrtDiscriminant
    ) /
    (
      2 *
      a
    );

  const t2 =
    (
      -b +
      sqrtDiscriminant
    ) /
    (
      2 *
      a
    );

  let hitT = null;

  if (
    t1 >= 0 &&
    t1 <= 1
  ) {
    hitT =
      t1;
  } else if (
    t2 >= 0 &&
    t2 <= 1
  ) {
    hitT =
      t2;
  }

  if (
    hitT === null
  ) {
    return null;
  }

  return {
    t:
      hitT
  };
}


/* =========================================================
   FLOATING ORIGIN
   ========================================================= */

function rebaseSolarSystemIfNeeded() {
  if (
    !camera ||
    !solarSystemRoot
  ) {
    return;
  }

  if (
    camera.position.length() <=
    FLOATING_ORIGIN_THRESHOLD
  ) {
    return;
  }

  tempShift.copy(
    camera.position
  );

  solarSystemRoot.position.sub(
    tempShift
  );

  camera.position.set(
    0,
    0,
    0
  );

  updateSunWorldPosition();
}


/* =========================================================
   ORBITS
   ========================================================= */

function updateOrbits(
  deltaTime
) {
  for (
    const planet of
      solarPlanets
  ) {
    planet.orbitalAngle +=
      planet.orbitalSpeed *
      deltaTime *
      SIMULATION_TIME_MULTIPLIER;

    planet.orbitGroup.rotation.y =
      planet.orbitalAngle;

    planet.planet.rotation.y +=
      planet.rotationSpeed *
      deltaTime;

    if (
      planet.cloudMesh
    ) {
      planet.cloudMesh.rotation.y +=
        planet.rotationSpeed *
        deltaTime *
        1.05;
    }

    if (
      planet.moonPivot
    ) {
      planet.moonAngle +=
        planet.moonOrbitalSpeed *
        deltaTime;

      planet.moonPivot.rotation.y =
        planet.moonAngle;

      if (
        planet.moon
      ) {
        planet.moon.rotation.y +=
          (
            2 *
            Math.PI
          ) /
          (
            27.322 *
            SECONDS_PER_DAY
          ) *
          deltaTime;
      }
    }
  }
}


/* =========================================================
   SPEED MODE
   ========================================================= */

function setSpeedMode(
  mode
) {
  if (
    !speedModes[
      mode
    ]
  ) {
    return;
  }

  currentSpeedMode =
    mode;

  if (
    mode !==
    "superman"
  ) {
    currentMovementSpeed =
      speedModes[
        mode
      ].speed;
  }

  if (
    mode ===
    "superman" &&
    energy <= 0
  ) {
    currentSpeedMode =
      "chill";

    currentMovementSpeed =
      CHILL_SPEED;
  }

  updateSpeedButtons();

  if (
    mode ===
    "creator"
  ) {
    resetCreatorPinch();
  }
}


function updateSpeedButtons() {
  const buttons =
    document.querySelectorAll(
      "[data-speed]"
    );

  buttons.forEach(
    (button) => {
      const selected =
        button.dataset.speed ===
        currentSpeedMode;

      button.classList.toggle(
        "is-selected",
        selected
      );

      button.setAttribute(
        "aria-pressed",
        selected
          ? "true"
          : "false"
      );
    }
  );
}


/* =========================================================
   ENERGY
   ========================================================= */

function updateEnergy(
  deltaTime,
  isMoving
) {
  if (
    currentSpeedMode ===
    "superman" &&
    isMoving
  ) {
    energy -=
      speedModes.superman.drainRate *
      deltaTime;

    energy =
      Math.max(
        0,
        energy
      );
  } else if (
    currentSpeedMode !==
    "superman"
  ) {
    energy +=
      ENERGY_RECHARGE_RATE *
      deltaTime;

    energy =
      Math.min(
        100,
        energy
      );
  }

  if (
    energy <= 0 &&
    currentSpeedMode ===
      "superman"
  ) {
    setSpeedMode(
      "chill"
    );
  }

  updateEnergyDisplay();
}


function updateEnergyDisplay() {
  const fill =
    $("energy-fill");

  const percent =
    $("energy-percent");

  const warning =
    $("superman-low-energy");

  if (
    fill
  ) {
    fill.style.width =
      `${energy}%`;
  }

  if (
    percent
  ) {
    percent.textContent =
      `${Math.round(
        energy
      )}%`;
  }

  if (
    warning
  ) {
    warning.classList.toggle(
      "is-visible",
      currentSpeedMode ===
        "superman" &&
        energy <
          20
    );
  }
}


/* =========================================================
   UI MENU
   ========================================================= */

function setUIMenuVisible(
  visible
) {
  uiMenuVisible =
    visible;

  const visualPanel =
    $("visual-panel");

  if (
    visualPanel
  ) {
    visualPanel.hidden =
      !visible;
  }

  if (
    uiToggle
  ) {
    uiToggle.setAttribute(
      "aria-expanded",
      visible
        ? "true"
        : "false"
    );

    uiToggle.classList.toggle(
      "is-active",
      visible
    );
  }
}


/* =========================================================
   VISUAL TOGGLES
   ========================================================= */

function updateVisualToggleButtons() {
  const labelsToggle =
    $("labels-toggle");

  const orbitsToggle =
    $("orbits-toggle");

  const distanceToggle =
    $("distance-toggle");

  if (
    labelsToggle
  ) {
    labelsToggle.setAttribute(
      "aria-pressed",
      planetLabelsVisible
        ? "true"
        : "false"
    );

    const state =
      labelsToggle.querySelector(
        ".toggle-state"
      );

    if (
      state
    ) {
      state.textContent =
        planetLabelsVisible
          ? "ON"
          : "OFF";
    }
  }

  if (
    orbitsToggle
  ) {
    orbitsToggle.setAttribute(
      "aria-pressed",
      orbitLinesVisible
        ? "true"
        : "false"
    );

    const state =
      orbitsToggle.querySelector(
        ".toggle-state"
      );

    if (
      state
    ) {
      state.textContent =
        orbitLinesVisible
          ? "ON"
          : "OFF";
    }
  }

  if (
    distanceToggle
  ) {
    distanceToggle.setAttribute(
      "aria-pressed",
      distanceVisible
        ? "true"
        : "false"
    );

    const state =
      distanceToggle.querySelector(
        ".toggle-state"
      );

    if (
      state
    ) {
      state.textContent =
        distanceVisible
          ? "ON"
          : "OFF";
    }
  }
}


function setPlanetLabelsVisible(
  visible
) {
  planetLabelsVisible =
    visible;

  labelLayer.classList.toggle(
    "is-hidden",
    !visible
  );

  updateVisualToggleButtons();
}


function setOrbitLinesVisible(
  visible
) {
  orbitLinesVisible =
    visible;

  solarPlanets.forEach(
    (planet) => {
      if (
        planet.orbitLine
      ) {
        planet.orbitLine.visible =
          visible;
      }
    }
  );

  updateVisualToggleButtons();
}


function setDistanceVisible(
  visible
) {
  distanceVisible =
    visible;

  document.body.classList.toggle(
    "hide-distance",
    !visible
  );

  updateVisualToggleButtons();
}


/* =========================================================
   CINEMATIC MODE
   ========================================================= */

function setCinematicMode(
  enabled
) {
  cinematicMode =
    enabled;

  if (
    cinematicMode
  ) {
    if (
      orbitLinesVisible
    ) {
      setOrbitLinesVisible(
        false
      );
    }

    setUIMenuVisible(
      false
    );
  }

  document.body.classList.toggle(
    "cinematic-mode",
    cinematicMode
  );

  const button =
    $("cinematic-toggle");

  if (
    button
  ) {
    button.setAttribute(
      "aria-pressed",
      cinematicMode
        ? "true"
        : "false"
    );

    const state =
      button.querySelector(
        ".toggle-state"
      );

    if (
      state
    ) {
      state.textContent =
        cinematicMode
          ? "ON"
          : "OFF";
    }
  }

  updateVisualToggleButtons();
}


/* =========================================================
   NORTH SETTER
   ========================================================= */

function setNorthHeading() {
  yaw = 0;

  pitch = 0;

  camera.rotation.set(
    pitch,
    yaw,
    0
  );
}


/* =========================================================
   SUN VISIBILITY
   ========================================================= */

function getSunVisibilityState() {
  updateSunWorldPosition();

  tempProjected
    .copy(
      sunPosition
    )
    .project(
      camera
    );

  const inFrustum =
    tempProjected.x >= -1 &&
    tempProjected.x <= 1 &&
    tempProjected.y >= -1 &&
    tempProjected.y <= 1 &&
    tempProjected.z >= -1 &&
    tempProjected.z <= 1;

  if (
    !inFrustum
  ) {
    return {
      visible:
        false,

      screenX:
        0,

      screenY:
        0,

      pixels:
        0
    };
  }

  tempToSun
    .copy(
      sunPosition
    )
    .sub(
      camera.position
    );

  const distance =
    tempToSun.length();

  if (
    distance <=
    0.001
  ) {
    return {
      visible:
        true,

      screenX:
        (
          tempProjected.x *
            0.5 +
          0.5
        ) *
        window.innerWidth,

      screenY:
        (
          -tempProjected.y *
            0.5 +
          0.5
        ) *
        window.innerHeight,

      pixels:
        window.innerHeight
    };
  }

  tempToSun.normalize();

  camera.getWorldDirection(
    tempDirection
  );

  if (
    tempDirection.dot(
      tempToSun
    ) <= 0
  ) {
    return {
      visible:
        false,

      screenX:
        0,

      screenY:
        0,

      pixels:
        0
    };
  }

  raycaster.set(
    camera.position,
    tempToSun
  );

  const hits =
    raycaster.intersectObjects(
      sunOccluders,
      false
    );

  const blocked =
    hits.some(
      (hit) =>
        hit.distance <
        distance
    );

  if (
    blocked
  ) {
    return {
      visible:
        false,

      screenX:
        0,

      screenY:
        0,

      pixels:
        0
    };
  }

  const angularDiameter =
    2 *
    Math.atan(
      SUN_RADIUS /
      distance
    );

  const fovRadians =
    THREE.MathUtils.degToRad(
      camera.fov
    );

  const pixels =
    angularDiameter *
    (
      window.innerHeight /
      fovRadians
    );

  return {
    visible:
      true,

    screenX:
      (
        tempProjected.x *
          0.5 +
        0.5
      ) *
      window.innerWidth,

    screenY:
      (
        -tempProjected.y *
          0.5 +
        0.5
      ) *
      window.innerHeight,

    pixels
  };
}


/* =========================================================
   SUN + ENERGY UI
   ========================================================= */

function updateSunAndEnergy(
  deltaTime
) {
  updateEnergyDisplay();

  if (
    !sunSprite
  ) {
    return;
  }

  const sunState =
    getSunVisibilityState();

  if (
    sunState.visible
  ) {
    const targetScale =
      THREE.MathUtils.clamp(
        sunState.pixels *
          4,

        SUN_RADIUS *
          2,

        SUN_RADIUS *
          8
      );

    sunSprite.scale.lerp(
      new THREE.Vector3(
        targetScale,
        targetScale,
        1
      ),
      Math.min(
        1,
        deltaTime * 4
      )
    );
  }
}


/* =========================================================
   LABEL UPDATE
   ========================================================= */

function updateLabels() {
  if (
    !planetLabelsVisible
  ) {
    return;
  }

  for (
    const planetData of
      solarPlanets
  ) {
    planetData.planet.getWorldPosition(
      tempWorld
    );

    tempProjected
      .copy(
        tempWorld
      )
      .project(
        camera
      );

    const visible =
      tempProjected.z > -1 &&
      tempProjected.z < 1 &&
      tempProjected.x > -1.1 &&
      tempProjected.x < 1.1 &&
      tempProjected.y > -1.1 &&
      tempProjected.y < 1.1;

    if (
      !visible
    ) {
      planetData.label.style.opacity =
        "0";

      continue;
    }

    planetData.label.style.left =
      `${
        (
          tempProjected.x *
            0.5 +
          0.5
        ) *
        window.innerWidth
      }px`;

    planetData.label.style.top =
      `${
        (
          -tempProjected.y *
            0.5 +
          0.5
        ) *
        window.innerHeight
      }px`;

    planetData.label.style.opacity =
      "1";
  }

  if (
    sunRecord
  ) {
    sunRecord.planet.getWorldPosition(
      tempWorld
    );

    tempProjected
      .copy(
        tempWorld
      )
      .project(
        camera
      );

    const visible =
      tempProjected.z > -1 &&
      tempProjected.z < 1 &&
      tempProjected.x > -1.1 &&
      tempProjected.x < 1.1 &&
      tempProjected.y > -1.1 &&
      tempProjected.y < 1.1;

    if (
      !visible
    ) {
      sunRecord.label.style.opacity =
        "0";
    } else {
      sunRecord.label.style.left =
        `${
          (
            tempProjected.x *
              0.5 +
            0.5
          ) *
          window.innerWidth
        }px`;

      sunRecord.label.style.top =
        `${
          (
            -tempProjected.y *
              0.5 +
            0.5
          ) *
          window.innerHeight
        }px`;

      sunRecord.label.style.opacity =
        "1";
    }
  }
}


/* =========================================================
   ANIMATION LOOP
   ========================================================= */

function animate() {
  requestAnimationFrame(
    animate
  );

  const deltaTime =
    Math.min(
      clock.getDelta(),
      0.05
    );

  updateOrbits(
    deltaTime
  );

  const isMoving =
    updateMovement(
      deltaTime
    );

  rebaseSolarSystemIfNeeded();

  updateEnergy(
    deltaTime,
    isMoving
  );

  updateSunAndEnergy(
    deltaTime
  );

  updateLabels();

  if (
    stars
  ) {
    stars.position.copy(
      camera.position
    );
  }

  renderer.render(
    scene,
    camera
  );
}


/* =========================================================
   START GAME
   ========================================================= */

function startGame() {
  if (
    gameStarted
  ) {
    return;
  }

  gameStarted =
    true;

  startScreen.hidden =
    true;

  gameUI.hidden =
    false;

  renderer.domElement.focus();
}


/* =========================================================
   CONTROLS
   ========================================================= */

function setupControls() {
  const canvas =
    renderer.domElement;

  canvas.style.touchAction =
    "none";

  const controlButtons =
    document.querySelectorAll(
      "[data-control]"
    );

  const speedButtons =
    document.querySelectorAll(
      "[data-speed]"
    );

  for (
    const button of
      speedButtons
  ) {
    button.addEventListener(
      "click",
      () => {
        setSpeedMode(
          button.dataset.speed
        );
      }
    );
  }


  /* =======================================================
     UI MENU
     ======================================================= */

  uiToggle.addEventListener(
    "click",
    () => {
      if (
        cinematicMode
      ) {
        setCinematicMode(
          false
        );

        setUIMenuVisible(
          true
        );

        return;
      }

      setUIMenuVisible(
        !uiMenuVisible
      );
    }
  );


  /* =======================================================
     NORTH BUTTON
     ======================================================= */

  northButton.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      setNorthHeading();
    }
  );


  const labelsToggle =
    $("labels-toggle");

  const orbitsToggle =
    $("orbits-toggle");

  const distanceToggle =
    $("distance-toggle");

  const cinematicToggle =
    $("cinematic-toggle");


  labelsToggle.addEventListener(
    "click",
    () => {
      setPlanetLabelsVisible(
        !planetLabelsVisible
      );
    }
  );


  orbitsToggle.addEventListener(
    "click",
    () => {
      setOrbitLinesVisible(
        !orbitLinesVisible
      );
    }
  );


  distanceToggle.addEventListener(
    "click",
    () => {
      setDistanceVisible(
        !distanceVisible
      );
    }
  );


  cinematicToggle.addEventListener(
    "click",
    () => {
      setCinematicMode(
        !cinematicMode
      );
    }
  );


  /* =======================================================
     FLIGHT BUTTONS
     ======================================================= */

  for (
    const button of
      controlButtons
  ) {
    const controlName =
      button.dataset.control;

    const releaseButton =
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        pressedControls.delete(
          controlName
        );

        button.classList.remove(
          "is-pressed"
        );
      };

    button.addEventListener(
      "pointerdown",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        pressedControls.add(
          controlName
        );

        button.classList.add(
          "is-pressed"
        );

        try {
          button.setPointerCapture(
            event.pointerId
          );
        } catch {
          // Optional.
        }
      }
    );

    button.addEventListener(
      "pointerup",
      releaseButton
    );

    button.addEventListener(
      "pointercancel",
      releaseButton
    );

    button.addEventListener(
      "lostpointercapture",
      () => {
        pressedControls.delete(
          controlName
        );

        button.classList.remove(
          "is-pressed"
        );
      }
    );

    button.addEventListener(
      "contextmenu",
      (event) => {
        event.preventDefault();
      }
    );
  }


  /* =======================================================
     CAMERA LOOK + CREATOR PINCH
     ======================================================= */

  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (
        !gameStarted ||
        event.pointerType ===
          "mouse" &&
        event.button !== 0
      ) {
        return;
      }

      if (
        event.pointerType ===
        "touch"
      ) {
        activeTouchPointers.set(
          event.pointerId,
          {
            clientX:
              event.clientX,

            clientY:
              event.clientY
          }
        );

        if (
          activeTouchPointers.size ===
          2 &&
          currentSpeedMode ===
            "creator"
        ) {
          beginCreatorPinch();
          return;
        }

        if (
          activeTouchPointers.size >
          1
        ) {
          dragging =
            false;

          return;
        }
      }

      if (
        creatorPinching
      ) {
        return;
      }

      dragging =
        true;

      lastPointerX =
        event.clientX;

      lastPointerY =
        event.clientY;

      try {
        canvas.setPointerCapture(
          event.pointerId
        );
      } catch {
        // Optional.
      }
    }
  );


  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (
        event.pointerType ===
        "touch" &&
        activeTouchPointers.has(
          event.pointerId
        )
      ) {
        activeTouchPointers.set(
          event.pointerId,
          {
            clientX:
              event.clientX,

            clientY:
              event.clientY
          }
        );

        if (
          activeTouchPointers.size ===
            2 &&
          currentSpeedMode ===
            "creator"
        ) {
          updateCreatorPinch();
          return;
        }
      }

      if (
        !dragging ||
        !gameStarted ||
        creatorPinching
      ) {
        return;
      }

      const deltaX =
        event.clientX -
        lastPointerX;

      const deltaY =
        event.clientY -
        lastPointerY;

      lastPointerX =
        event.clientX;

      lastPointerY =
        event.clientY;

      yaw -=
        deltaX *
        lookSensitivity;

      pitch -=
        deltaY *
        lookSensitivity;

      pitch =
        THREE.MathUtils.clamp(
          pitch,

          -Math.PI / 2 +
            0.05,

          Math.PI / 2 -
            0.05
        );

      camera.rotation.set(
        pitch,
        yaw,
        0
      );
    }
  );


  const stopDragging =
    (event) => {
      if (
        event &&
        event.pointerType ===
          "touch"
      ) {
        activeTouchPointers.delete(
          event.pointerId
        );

        if (
          activeTouchPointers.size <
          2
        ) {
          endCreatorPinch();
        }
      }

      if (
        activeTouchPointers.size ===
        0
      ) {
        dragging =
          false;
      }
    };


  canvas.addEventListener(
    "pointerup",
    stopDragging
  );

  canvas.addEventListener(
    "pointercancel",
    stopDragging
  );

  canvas.addEventListener(
    "lostpointercapture",
    stopDragging
  );


  /* =======================================================
     KEYBOARD SUPPORT
     ======================================================= */

  window.addEventListener(
    "keydown",
    (event) => {
      const key =
        event.key.toLowerCase();

      const allControlKeys =
        Object.values(
          controlKeys
        ).flat();

      if (
        allControlKeys.includes(
          key
        )
      ) {
        event.preventDefault();

        pressedKeys.add(
          key
        );
      }
    }
  );


  window.addEventListener(
    "keyup",
    (event) => {
      pressedKeys.delete(
        event.key.toLowerCase()
      );
    }
  );


  window.addEventListener(
    "blur",
    () => {
      pressedControls.clear();

      pressedKeys.clear();

      controlButtons.forEach(
        (button) => {
          button.classList.remove(
            "is-pressed"
          );
        }
      );

      resetCreatorPinch();
    }
  );
}


/* =========================================================
   STARTUP
   ========================================================= */

startButton.addEventListener(
  "click",
  startGame
);


try {
  createSolarSystem();

  loadingScreen.hidden =
    true;

  startScreen.hidden =
    false;

} catch (
  error
) {
  console.error(
    "Could not initialize the Solar System game:",
    error
  );

  showError(
    "The 3D scene could not be initialized. Please check that WebGL is available and reload the page."
  );
}
