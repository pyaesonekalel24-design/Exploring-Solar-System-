import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";


/* =========================================================
   DOM
   ========================================================= */

const $ = (id) =>
  document.getElementById(id);

const loadingScreen =
  $("loading-screen");

const startScreen =
  $("start-screen");

const errorScreen =
  $("error-screen");

const errorMessage =
  $("error-message");

const startButton =
  $("start-button");

const gameUI =
  $("game-ui");

const gameElement =
  $("game");

const uiToggle =
  $("ui-toggle");

const labelLayer =
  $("planet-label-layer");


/* =========================================================
   THREE.JS STATE
   ========================================================= */

let scene;
let camera;
let renderer;

let solarPlanets = [];

let moonPivot = null;

let stars = null;

let sunSprite = null;

let gameStarted = false;

let helperUIVisible = true;


/* =========================================================
   CAMERA LOOK
   ========================================================= */

let yaw = 0;
let pitch = -0.08;

let dragging = false;

let lastPointerX = 0;
let lastPointerY = 0;

const lookSensitivity =
  0.0035;


/* =========================================================
   ENERGY
   ========================================================= */

let energy = 100;

let currentSpeedMode =
  "chill";

const ENERGY_RECHARGE_RATE =
  18;


/* =========================================================
   FLIGHT SPEED
   =========================================================

   CHILL:
   slow enough to approach a giant planet carefully.

   SONIC:
   long-distance travel.

   POOP:
   ridiculously fast interplanetary travel.

   The planets' own orbital motion is completely
   separate from player movement speed.
   ========================================================= */

const movementSpeed = 8;

const speedModes = {
  chill: {
    multiplier: 1,
    drainRate: 0
  },

  sonic: {
    multiplier: 250,
    drainRate: 4
  },

  poop: {
    multiplier: 1000,
    drainRate: 12
  }
};


/* =========================================================
   INPUT
   ========================================================= */

const pressedControls =
  new Set();

const pressedKeys =
  new Set();

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

const clock =
  new THREE.Clock();


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

const worldUp =
  new THREE.Vector3(
    0,
    1,
    0
  );

const raycaster =
  new THREE.Raycaster();


/*
  Objects that can physically block
  the Sun from the player.
*/
const sunOccluders = [];


/* =========================================================
   REAL ASTRONOMICAL SCALE
   =========================================================

   ONE GAME UNIT = 1,000 KM.

   Therefore:

   Earth radius   = 6.371 units
   Jupiter radius = 69.911 units
   Saturn radius  = 58.232 units
   Sun radius     = 696.340 units

   1 AU =
   149,597.8707 game units

   This preserves the actual linear relationship between
   planetary dimensions and orbital distances.
   ========================================================= */

const KM_PER_AU =
  149_597_870.7;

const GAME_UNITS_PER_KM =
  0.001;

const GAME_UNITS_PER_AU =
  KM_PER_AU *
  GAME_UNITS_PER_KM;


/* =========================================================
   REAL-TIME ORBIT MOTION
   =========================================================

   1 real second =
   1 real second of Solar System time.

   Earth takes about one real year
   to complete an orbit.

   Saturn takes about 29.45 real years.

   No artificial "4x / 5x" orbital acceleration.
   ========================================================= */

const SECONDS_PER_DAY =
  86_400;

const SIMULATION_TIME_MULTIPLIER =
  1;


/* =========================================================
   REAL PHYSICAL RADII
   ========================================================= */

const SUN_RADIUS_KM =
  696_340;

const EARTH_RADIUS_KM =
  6_371;

const MOON_RADIUS_KM =
  1_737.4;

const SUN_RADIUS =
  SUN_RADIUS_KM *
  GAME_UNITS_PER_KM;

const EARTH_GAME_RADIUS =
  EARTH_RADIUS_KM *
  GAME_UNITS_PER_KM;

const MOON_RADIUS =
  MOON_RADIUS_KM *
  GAME_UNITS_PER_KM;

const MOON_ORBIT_RADIUS =
  384_400 *
  GAME_UNITS_PER_KM;

const MOON_ORBIT_PERIOD_DAYS =
  27.322;


/* =========================================================
   PLANET DATA
   ========================================================= */

const planetDataList = [
  {
    name: "Mercury",

    color: 0x96928c,
    orbitColor: 0xa7a7a7,

    semiMajorAxisAU:
      0.387098,

    eccentricity:
      0.20564,

    orbitalPeriodDays:
      87.969,

    radiusKm:
      2_439.7,

    rotationPeriodHours:
      1_407.6,

    axialTiltDegrees:
      0.03,

    orbitalInclinationDegrees:
      7.005,

    longitudeOfAscendingNodeDegrees:
      48.331,

    argumentOfPeriapsisDegrees:
      29.124,

    startMeanAnomalyDegrees:
      174.796
  },

  {
    name: "Venus",

    color: 0xd8bd83,
    orbitColor: 0xcab98d,

    semiMajorAxisAU:
      0.723336,

    eccentricity:
      0.006776,

    orbitalPeriodDays:
      224.701,

    radiusKm:
      6_051.8,

    rotationPeriodHours:
      -5_832.5,

    axialTiltDegrees:
      177.36,

    orbitalInclinationDegrees:
      3.394,

    longitudeOfAscendingNodeDegrees:
      76.68,

    argumentOfPeriapsisDegrees:
      54.891,

    startMeanAnomalyDegrees:
      50.115
  },

  {
    name: "Earth",

    color: 0x347fe0,
    orbitColor: 0x63a9ff,

    semiMajorAxisAU:
      1,

    eccentricity:
      0.01671,

    orbitalPeriodDays:
      365.256,

    radiusKm:
      6_371,

    rotationPeriodHours:
      23.934,

    axialTiltDegrees:
      23.44,

    orbitalInclinationDegrees:
      0,

    longitudeOfAscendingNodeDegrees:
      0,

    argumentOfPeriapsisDegrees:
      102.937,

    startMeanAnomalyDegrees:
      357.529,

    hasMoon: true
  },

  {
    name: "Mars",

    color: 0xc9563d,
    orbitColor: 0xe07860,

    semiMajorAxisAU:
      1.523679,

    eccentricity:
      0.0934,

    orbitalPeriodDays:
      686.98,

    radiusKm:
      3_389.5,

    rotationPeriodHours:
      24.623,

    axialTiltDegrees:
      25.19,

    orbitalInclinationDegrees:
      1.85,

    longitudeOfAscendingNodeDegrees:
      49.558,

    argumentOfPeriapsisDegrees:
      286.502,

    startMeanAnomalyDegrees:
      19.373
  },

  {
    name: "Jupiter",

    color: 0xc58e5a,
    orbitColor: 0xd1a477,

    semiMajorAxisAU:
      5.2028,

    eccentricity:
      0.0489,

    orbitalPeriodDays:
      4_332.59,

    radiusKm:
      69_911,

    rotationPeriodHours:
      9.925,

    axialTiltDegrees:
      3.13,

    orbitalInclinationDegrees:
      1.304,

    longitudeOfAscendingNodeDegrees:
      100.454,

    argumentOfPeriapsisDegrees:
      273.877,

    startMeanAnomalyDegrees:
      20.02
  },

  {
    name: "Saturn",

    color: 0xd4c18a,
    orbitColor: 0xe0d2a6,

    semiMajorAxisAU:
      9.537,

    eccentricity:
      0.0565,

    orbitalPeriodDays:
      10_755.7,

    radiusKm:
      58_232,

    rotationPeriodHours:
      10.656,

    axialTiltDegrees:
      26.73,

    orbitalInclinationDegrees:
      2.486,

    longitudeOfAscendingNodeDegrees:
      113.663,

    argumentOfPeriapsisDegrees:
      339.392,

    startMeanAnomalyDegrees:
      317.021,

    hasRings: true
  },

  {
    name: "Uranus",

    color: 0x79d6dd,
    orbitColor: 0x91e8ed,

    semiMajorAxisAU:
      19.1914,

    eccentricity:
      0.0472,

    orbitalPeriodDays:
      30_688.5,

    radiusKm:
      25_362,

    rotationPeriodHours:
      -17.24,

    axialTiltDegrees:
      97.77,

    orbitalInclinationDegrees:
      0.773,

    longitudeOfAscendingNodeDegrees:
      74,

    argumentOfPeriapsisDegrees:
      96.661,

    startMeanAnomalyDegrees:
      141.05
  },

  {
    name: "Neptune",

    color: 0x3c68d8,
    orbitColor: 0x7794ff,

    semiMajorAxisAU:
      30.0611,

    eccentricity:
      0.0086,

    orbitalPeriodDays:
      60_182,

    radiusKm:
      24_622,

    rotationPeriodHours:
      16.11,

    axialTiltDegrees:
      28.32,

    orbitalInclinationDegrees:
      1.77,

    longitudeOfAscendingNodeDegrees:
      131.781,

    argumentOfPeriapsisDegrees:
      272.846,

    startMeanAnomalyDegrees:
      256.228
  }
];


/* =========================================================
   ERROR
   ========================================================= */

function showError(message) {
  loadingScreen.hidden = true;
  startScreen.hidden = true;
  gameUI.hidden = true;

  errorMessage.textContent =
    message;

  errorScreen.hidden = false;
}


/* =========================================================
   SPEED UI
   ========================================================= */

function updateSpeedButtons() {
  document
    .querySelectorAll(
      "[data-speed]"
    )
    .forEach(
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
          String(selected)
        );
      }
    );
}

function setSpeedMode(mode) {
  if (
    !speedModes[mode]
  ) {
    return;
  }

  if (
    energy <= 0 &&
    mode !== "chill"
  ) {
    mode = "chill";
  }

  currentSpeedMode =
    mode;

  updateSpeedButtons();
}


/* =========================================================
   ENERGY UI
   ========================================================= */

function updateEnergyDisplay() {
  const displayedEnergy =
    Math.round(
      energy
    );

  $("energy-fill").style.width =
    `${energy}%`;

  $("energy-percent").textContent =
    `${displayedEnergy}%`;

  $("energy-bar").setAttribute(
    "aria-valuenow",
    String(
      displayedEnergy
    )
  );

  if (
    energy <= 25
  ) {
    $("energy-fill").style.backgroundColor =
      "#ff665f";
  } else if (
    energy <= 55
  ) {
    $("energy-fill").style.backgroundColor =
      "#ffd15c";
  } else {
    $("energy-fill").style.backgroundColor =
      "#65e68a";
  }
}


/* =========================================================
   STAR FIELD
   ========================================================= */

function createStarField() {
  const starCount =
    2600;

  const positions =
    new Float32Array(
      starCount * 3
    );

  for (
    let i = 0;
    i < starCount;
    i += 1
  ) {
    const direction =
      new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize();

    const distance =
      7_000_000 +
      Math.random() *
        5_000_000;

    positions[
      i * 3
    ] =
      direction.x *
      distance;

    positions[
      i * 3 + 1
    ] =
      direction.y *
      distance;

    positions[
      i * 3 + 2
    ] =
      direction.z *
      distance;
  }

  const geometry =
    new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      positions,
      3
    )
  );

  stars =
    new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xffffff,

        size: 900,

        sizeAttenuation: true,

        transparent: true,

        opacity: 0.85,

        depthWrite: false
      })
    );

  scene.add(
    stars
  );
}


/* =========================================================
   DISTANT SUN SPRITE
   =========================================================

   This is a WORLD OBJECT.

   It is NOT UI.

   It remains visible when UI is turned off.

   It uses depth testing so a planet can physically
   block it.
   ========================================================= */

function createSunSprite() {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = 64;
  canvas.height = 64;

  const ctx =
    canvas.getContext(
      "2d"
    );

  const gradient =
    ctx.createRadialGradient(
      32,
      32,
      1,
      32,
      32,
      32
    );

  gradient.addColorStop(
    0,
    "rgba(255,255,220,1)"
  );

  gradient.addColorStop(
    0.18,
    "rgba(255,225,94,1)"
  );

  gradient.addColorStop(
    0.55,
    "rgba(255,162,35,0.72)"
  );

  gradient.addColorStop(
    1,
    "rgba(255,145,25,0)"
  );

  ctx.fillStyle =
    gradient;

  ctx.fillRect(
    0,
    0,
    64,
    64
  );

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  texture.colorSpace =
    THREE.SRGBColorSpace;

  sunSprite =
    new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,

        transparent: true,

        opacity: 0,

        depthWrite: false,

        depthTest: true
      })
    );

  sunSprite.position.copy(
    sunPosition
  );

  scene.add(
    sunSprite
  );
}


/* =========================================================
   ORBIT POSITION
   ========================================================= */

function getEllipsePosition(
  semiMajorAxis,
  eccentricity,
  eccentricAnomaly
) {
  const semiMinorAxis =
    semiMajorAxis *
    Math.sqrt(
      1 -
        eccentricity *
          eccentricity
    );

  return new THREE.Vector3(
    semiMajorAxis *
      (
        Math.cos(
          eccentricAnomaly
        ) -
        eccentricity
      ),

    0,

    semiMinorAxis *
      Math.sin(
        eccentricAnomaly
      )
  );
}


/* =========================================================
   KEPLER SOLVER
   ========================================================= */

function solveEccentricAnomaly(
  meanAnomaly,
  eccentricity
) {
  let eccentricAnomaly =
    meanAnomaly;

  for (
    let i = 0;
    i < 8;
    i += 1
  ) {
    const difference =
      eccentricAnomaly -
      eccentricity *
        Math.sin(
          eccentricAnomaly
        ) -
      meanAnomaly;

    const derivative =
      1 -
      eccentricity *
        Math.cos(
          eccentricAnomaly
        );

    eccentricAnomaly -=
      difference /
      derivative;
  }

  return eccentricAnomaly;
}


/* =========================================================
   ORBIT LINE
   ========================================================= */

function createOrbitLine(
  semiMajorAxis,
  eccentricity,
  color
) {
  const points = [];

  const segments =
    360;

  const semiMinorAxis =
    semiMajorAxis *
    Math.sqrt(
      1 -
        eccentricity *
          eccentricity
    );

  for (
    let i = 0;
    i < segments;
    i += 1
  ) {
    const eccentricAnomaly =
      (
        i /
        segments
      ) *
      Math.PI *
      2;

    points.push(
      new THREE.Vector3(
        semiMajorAxis *
          (
            Math.cos(
              eccentricAnomaly
            ) -
            eccentricity
          ),

        0,

        semiMinorAxis *
          Math.sin(
            eccentricAnomaly
          )
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
      color,

      transparent: true,

      opacity: 0.24,

      depthWrite: false
    });

  return new THREE.LineLoop(
    geometry,
    material
  );
}


/* =========================================================
   LABEL
   ========================================================= */

function createLabel(name) {
  const label =
    document.createElement(
      "div"
    );

  label.className =
    "planet-label";

  label.textContent =
    name;

  labelLayer.appendChild(
    label
  );

  return label;
}


/* =========================================================
   CREATE PLANET
   ========================================================= */

function createPlanet(data) {
  /*
    One completely linear astronomical scale.

    No distance compression.
    No size compression.
  */

  const semiMajorAxis =
    data.semiMajorAxisAU *
    GAME_UNITS_PER_AU;

  const planetRadius =
    data.radiusKm *
    GAME_UNITS_PER_KM;


  /*
    ORBIT HIERARCHY

    Sun
      |
      +-- ascending node
            |
            +-- inclination
                  |
                  +-- periapsis
                        |
                        +-- orbit line
                        |
                        +-- planet body

    Therefore the orbit line and planet body
    always use the SAME orbital geometry.
  */

  const ascendingNodeGroup =
    new THREE.Group();

  ascendingNodeGroup.rotation.y =
    THREE.MathUtils.degToRad(
      data
        .longitudeOfAscendingNodeDegrees
    );


  const inclinationGroup =
    new THREE.Group();

  inclinationGroup.rotation.x =
    THREE.MathUtils.degToRad(
      data
        .orbitalInclinationDegrees
    );


  const periapsisGroup =
    new THREE.Group();

  periapsisGroup.rotation.y =
    THREE.MathUtils.degToRad(
      data
        .argumentOfPeriapsisDegrees
    );


  ascendingNodeGroup.add(
    inclinationGroup
  );

  inclinationGroup.add(
    periapsisGroup
  );

  scene.add(
    ascendingNodeGroup
  );


  /*
    Orbit line centered on Sun.
  */

  const orbitLine =
    createOrbitLine(
      semiMajorAxis,
      data.eccentricity,
      data.orbitColor
    );

  periapsisGroup.add(
    orbitLine
  );


  /*
    Actual planet body.
  */

  const orbitalBodyGroup =
    new THREE.Group();

  periapsisGroup.add(
    orbitalBodyGroup
  );


  /*
    Planet axial tilt.
  */

  const axialTiltGroup =
    new THREE.Group();

  axialTiltGroup.rotation.z =
    THREE.MathUtils.degToRad(
      data.axialTiltDegrees
    );

  orbitalBodyGroup.add(
    axialTiltGroup
  );


  /*
    Physical planet sphere.

    NO compressed radius.
  */

  const planet =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        planetRadius,
        32,
        20
      ),

      new THREE.MeshStandardMaterial({
        color:
          data.color,

        roughness:
          0.9,

        metalness:
          0
      })
    );

  axialTiltGroup.add(
    planet
  );


  /*
    Planet can block Sun visibility.
  */

  sunOccluders.push(
    planet
  );


  /* =======================================================
     SATURN RINGS
     ======================================================= */

  if (
    data.hasRings
  ) {
    const ringInnerRadius =
      planetRadius *
      1.35;

    const ringOuterRadius =
      planetRadius *
      2.35;

    const rings =
      new THREE.Mesh(
        new THREE.RingGeometry(
          ringInnerRadius,
          ringOuterRadius,
          128
        ),

        new THREE.MeshStandardMaterial({
          color:
            0xc9b98e,

          side:
            THREE.DoubleSide,

          roughness:
            0.95,

          metalness:
            0
        })
      );

    /*
      Ring lies around Saturn's equator.
      It inherits the planet's axial tilt.
    */

    rings.rotation.x =
      Math.PI / 2;

    planet.add(
      rings
    );
  }


  /* =======================================================
     EARTH MOON
     ======================================================= */

  if (
    data.hasMoon
  ) {
    moonPivot =
      new THREE.Group();

    orbitalBodyGroup.add(
      moonPivot
    );

    const moon =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          MOON_RADIUS,
          24,
          16
        ),

        new THREE.MeshStandardMaterial({
          color:
            0xbfc4cf,

          roughness:
            1
        })
      );

    moon.position.x =
      MOON_ORBIT_RADIUS;

    moonPivot.add(
      moon
    );

    sunOccluders.push(
      moon
    );
  }


  /* =======================================================
     STARTING ORBIT POSITION
     ======================================================= */

  const startingMeanAnomaly =
    THREE.MathUtils.degToRad(
      data
        .startMeanAnomalyDegrees
    );

  const initialEccentricAnomaly =
    solveEccentricAnomaly(
      startingMeanAnomaly,
      data.eccentricity
    );

  orbitalBodyGroup.position.copy(
    getEllipsePosition(
      semiMajorAxis,
      data.eccentricity,
      initialEccentricAnomaly
    )
  );


  /* =======================================================
     REAL-TIME MEAN MOTION
     ======================================================= */

  const orbitalPeriodSeconds =
    data.orbitalPeriodDays *
    SECONDS_PER_DAY;

  const meanMotion =
    (
      Math.PI * 2 /
      orbitalPeriodSeconds
    ) *
    SIMULATION_TIME_MULTIPLIER;


  /* =======================================================
     REAL-TIME SPIN
     ======================================================= */

  const rotationPeriodSeconds =
    Math.abs(
      data.rotationPeriodHours
    ) *
    3600;

  const spinSpeed =
    (
      Math.PI * 2 /
      rotationPeriodSeconds
    ) *
    (
      Math.sign(
        data.rotationPeriodHours
      ) || 1
    ) *
    SIMULATION_TIME_MULTIPLIER;


  /* =======================================================
     SAVE PLANET
     ======================================================= */

  solarPlanets.push({
    name:
      data.name,

    semiMajorAxis,

    eccentricity:
      data.eccentricity,

    meanAnomaly:
      startingMeanAnomaly,

    meanMotion,

    spinSpeed,

    orbitalBodyGroup,

    planet,

    orbitLine,

    label:
      createLabel(
        data.name
      )
  });
}


/* =========================================================
   CREATE SOLAR SYSTEM
   ========================================================= */

function createSolarSystem() {
  scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(
      0x050711
    );


  /* =======================================================
     CAMERA
     ======================================================= */

  camera =
    new THREE.PerspectiveCamera(
      70,

      window.innerWidth /
        window.innerHeight,

      0.05,

      20_000_000
    );

  camera.rotation.order =
    "YXZ";

  yaw = 0;
  pitch = -0.08;

  camera.rotation.set(
    pitch,
    yaw,
    0
  );

  scene.add(
    camera
  );


  /* =======================================================
     AMBIENT FILL
     ======================================================= */

  const ambientLight =
    new THREE.HemisphereLight(
      0x8ea6d4,
      0x111118,
      0.12
    );

  scene.add(
    ambientLight
  );


  /* =======================================================
     SUN LIGHT
     =======================================================

     Much more physically distance-aware than the old
     compressed system.

     Earth gets strong illumination.
     Saturn receives substantially less.
  */

  const sunLight =
    new THREE.PointLight(
      0xffd69a,

      4.0e10,

      0,

      2
    );

  sunLight.position.copy(
    sunPosition
  );

  scene.add(
    sunLight
  );


  /* =======================================================
     PHYSICAL SUN
     ======================================================= */

  const sun =
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

  sun.position.copy(
    sunPosition
  );

  scene.add(
    sun
  );


  /* =======================================================
     SUN GLOW
     ======================================================= */

  const glow =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        SUN_RADIUS * 1.08,
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

  scene.add(
    glow
  );


  /* =======================================================
     DISTANT SUN DOT
     ======================================================= */

  createSunSprite();


  /* =======================================================
     STARS
     ======================================================= */

  createStarField();


  /* =======================================================
     PLANETS
     ======================================================= */

  for (
    const planetData
      of planetDataList
  ) {
    createPlanet(
      planetData
    );
  }


  /* =======================================================
     RENDERER
     ======================================================= */

  renderer =
    new THREE.WebGLRenderer({
      antialias:
        true,

      alpha:
        false
    });

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio ||
        1,

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


  /* =======================================================
     START CAMERA NEAR EARTH
     ======================================================= */

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

    /*
      140,000 km from Earth's center.

      This makes the initial scene actually
      feel like you're in the Solar System,
      rather than starting in an arbitrary
      empty coordinate.
    */

    camera.position.copy(
      tempWorld
    );

    camera.position.z +=
      140;
  } else {
    camera.position.set(
      0,
      50,
      GAME_UNITS_PER_AU
    );
  }


  /* =======================================================
     CONTROLS
     ======================================================= */

  setupControls();

  updateSpeedButtons();

  updateEnergyDisplay();

  setHelperVisibility(
    true
  );


  /* =======================================================
     START LOOP
     ======================================================= */

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
      window.devicePixelRatio ||
        1,

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
    currentSpeedMode !==
      "chill"
  ) {
    setSpeedMode(
      "chill"
    );
  }


  movement.normalize();


  const selectedSpeed =
    speedModes[
      currentSpeedMode
    ];


  const actualSpeed =
    movementSpeed *
    selectedSpeed.multiplier;


  camera.position.addScaledVector(
    movement,
    actualSpeed *
      deltaTime
  );


  return true;
}


/* =========================================================
   SUN VISIBILITY
   =========================================================

   The Sun is visible if:

   1. It is inside the camera view.
   2. It is in front of the camera.
   3. No planet blocks the line of sight.

   This is NOT tied to the UI state.
   ========================================================= */

function getSunVisibilityState() {
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
    distance <= 0.001
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


  /*
    Make sure Sun is actually in front of us.
  */

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


  /*
    Physical occlusion test.

    Fly behind Saturn and Saturn can block the Sun.
  */

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


  /*
    Calculate actual apparent Sun size.
  */

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
   SUN APPEARANCE + ENERGY
   ========================================================= */

function updateSunAndEnergy(
  deltaTime
) {
  const state =
    getSunVisibilityState();


  /* =======================================================
     DISTANT SUN DOT
     ======================================================= */

  if (
    sunSprite
  ) {
    if (
      state.visible
    ) {
      const distance =
        camera.position.distanceTo(
          sunPosition
        );


      /*
        Make distant Sun at least a tiny
        visible point.

        But still let it naturally grow
        when we get close.
      */

      const minimumPixels =
        2.5;

      const targetPixels =
        Math.max(
          minimumPixels,
          state.pixels
        );


      const fovRadians =
        THREE.MathUtils.degToRad(
          camera.fov
        );


      const worldSize =
        2 *
        distance *
        Math.tan(
          (
            targetPixels /
            window.innerHeight
          ) *
          fovRadians /
          2
        );


      sunSprite.scale.set(
        worldSize,
        worldSize,
        1
      );


      sunSprite.material.opacity =
        state.pixels <
        minimumPixels
          ? 0.96
          : 0.34;
    } else {
      sunSprite.material.opacity =
        0;
    }
  }


  /* =======================================================
     SOLAR RECHARGE
     =======================================================

     Sun visible =
     energy regenerates.

     Sun hidden/blocked =
     no regeneration.

     UI ON/OFF makes no difference.
     ======================================================= */

  if (
    state.visible
  ) {
    energy =
      Math.min(
        100,

        energy +
          ENERGY_RECHARGE_RATE *
          deltaTime
      );
  }


  updateEnergyDisplay();
}


/* =========================================================
   ENERGY DRAIN
   ========================================================= */

function updateEnergy(
  deltaTime,
  isMoving
) {
  if (
    !gameStarted ||
    !isMoving
  ) {
    return;
  }

  const selectedSpeed =
    speedModes[
      currentSpeedMode
    ];


  if (
    selectedSpeed.drainRate <=
    0
  ) {
    return;
  }


  energy =
    Math.max(
      0,

      energy -
        selectedSpeed.drainRate *
        deltaTime
    );


  if (
    energy === 0
  ) {
    setSpeedMode(
      "chill"
    );
  }
}


/* =========================================================
   REAL-TIME ORBIT UPDATE
   ========================================================= */

function updateOrbits(
  deltaTime
) {
  for (
    const planetData of
      solarPlanets
  ) {
    /*
      Mean anomaly advances according to
      the actual orbital period.

      No gameplay acceleration.
    */

    planetData.meanAnomaly +=
      planetData.meanMotion *
      deltaTime;


    if (
      planetData.meanAnomaly >
      Math.PI * 2
    ) {
      planetData.meanAnomaly -=
        Math.PI * 2;
    }


    const eccentricAnomaly =
      solveEccentricAnomaly(
        planetData.meanAnomaly,
        planetData.eccentricity
      );


    /*
      IMPORTANT:

      This EXACT SAME ellipse formula is
      used by createOrbitLine().

      Therefore the planet cannot drift away
      from the path.
    */

    planetData
      .orbitalBodyGroup
      .position.copy(
        getEllipsePosition(
          planetData.semiMajorAxis,
          planetData.eccentricity,
          eccentricAnomaly
        )
      );


    /*
      Real-time planetary rotation.
    */

    planetData.planet.rotation.y +=
      planetData.spinSpeed *
      deltaTime;
  }


  /* =======================================================
     MOON
     ======================================================= */

  if (
    moonPivot
  ) {
    moonPivot.rotation.y +=
      (
        Math.PI * 2 /
        (
          MOON_ORBIT_PERIOD_DAYS *
          SECONDS_PER_DAY
        )
      ) *
      deltaTime;
  }
}


/* =========================================================
   PLANET LABEL UPDATE
   ========================================================= */

function updateLabels() {
  for (
    const planetData of
      solarPlanets
  ) {
    if (
      !helperUIVisible
    ) {
      planetData.label.style.opacity =
        "0";

      continue;
    }


    planetData
      .planet
      .getWorldPosition(
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
}


/* =========================================================
   UI TOGGLE
   =========================================================

   UI OFF removes ONLY:

   - energy bar
   - speed buttons
   - planet labels
   - orbit lines

   UI OFF DOES NOT remove:

   - Sun
   - Sun distant dot
   - planets
   - Moon
   - Saturn rings
   - stars
   - flight controls
   ========================================================= */

function setHelperVisibility(
  visible
) {
  helperUIVisible =
    visible;


  gameUI.classList.toggle(
    "ui-hidden",
    !visible
  );


  labelLayer.classList.toggle(
    "ui-hidden",
    !visible
  );


  uiToggle.textContent =
    visible
      ? "UI OFF"
      : "UI ON";


  uiToggle.setAttribute(
    "aria-pressed",
    String(!visible)
  );


  for (
    const planetData of
      solarPlanets
  ) {
    planetData.orbitLine.visible =
      visible;


    if (
      !visible
    ) {
      planetData.label.style.opacity =
        "0";
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


  /*
    Planets continue orbiting in real time.
  */

  updateOrbits(
    deltaTime
  );


  /*
    Player flight.
  */

  const isMoving =
    updateMovement(
      deltaTime
    );


  /*
    Speed energy drain.
  */

  updateEnergy(
    deltaTime,
    isMoving
  );


  /*
    Sun visibility +
    solar recharge.
  */

  updateSunAndEnergy(
    deltaTime
  );


  /*
    Planet labels only exist as UI.
  */

  updateLabels();


  /*
    Stars follow the player so the
    background always surrounds us.
  */

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


  const controlButtons =
    document.querySelectorAll(
      "[data-control]"
    );


  const speedButtons =
    document.querySelectorAll(
      "[data-speed]"
    );


  /* =======================================================
     SPEED BUTTONS
     ======================================================= */

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
     UI TOGGLE
     ======================================================= */

  uiToggle.addEventListener(
    "click",
    () => {
      setHelperVisibility(
        !helperUIVisible
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
     CAMERA TOUCH LOOK
     =======================================================

     Both axes remain inverted:

     swipe RIGHT -> look LEFT
     swipe LEFT  -> look RIGHT

     swipe UP   -> look DOWN
     swipe DOWN -> look UP

     Flight UP/DOWN buttons are NOT inverted.
     ======================================================= */

  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (
        !gameStarted ||
        event.button !== 0
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
        !dragging ||
        !gameStarted
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
    () => {
      dragging =
        false;
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
     KEYBOARD
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


  /* =======================================================
     WINDOW BLUR
     ======================================================= */

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

      dragging =
        false;
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
} catch (error) {
  console.error(
    "Could not initialize the Solar System game:",
    error
  );

  showError(
    "The 3D scene could not be initialized. Please check that WebGL is available and reload the page."
  );
}
