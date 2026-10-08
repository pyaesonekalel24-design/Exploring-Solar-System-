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

const CHILL_SPEED = 60;

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

const worldUp =
  new THREE.Vector3(
    0,
    1,
    0
  );

const raycaster =
  new THREE.Raycaster();

const sunOccluders = [];

const collisionStart =
  new THREE.Vector3();

const collisionDelta =
  new THREE.Vector3();

const collisionCenter =
  new THREE.Vector3();

const collisionClosest =
  new THREE.Vector3();

const collisionPush =
  new THREE.Vector3();

const collisionRemaining =
  new THREE.Vector3();

const collisionNormal =
  new THREE.Vector3();

const collisionContact =
  new THREE.Vector3();

const COLLISION_MARGIN =
  1.5;


/* =========================================================
   TEXTURE SYSTEM
   =========================================================

   Texture source:
   Solar System Scope planet texture pack.
   CC BY 4.0:
   https://creativecommons.org/licenses/by/4.0/

   Primary URLs use the official Solar System Scope
   download endpoint. The fallback mirror keeps the game
   resilient if the primary host is temporarily unavailable.
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
   ASTRONOMICAL DATE / EARTH ROTATION
   ========================================================= */

const J2000_EPOCH_MS =
  Date.UTC(2000, 0, 1, 12, 0, 0);

const DAY_MS =
  86_400_000;

const JULIAN_CENTURY_DAYS =
  36_525;


/* =========================================================
   MOON ASTRONOMICAL STATE
   ========================================================= */

const MOON_EARTH_RADIUS_RATIO =
  60.2666;

const MOON_ECCENTRICITY =
  0.054900;

const MOON_INCLINATION_DEGREES =
  5.1454;

const MOON_NODE_AT_J2000_DEGREES =
  125.1228;

const MOON_NODE_RATE_DEGREES_PER_DAY =
  -0.0529538083;

const MOON_PERIGEE_AT_J2000_DEGREES =
  318.0634;

const MOON_PERIGEE_RATE_DEGREES_PER_DAY =
  0.1643573223;

const MOON_MEAN_ANOMALY_AT_J2000_DEGREES =
  115.3654;

const MOON_MEAN_MOTION_DEGREES_PER_DAY =
  13.0649929509;


/* =========================================================
   MEEUS NEW MOON MODEL
   ========================================================= */

const NEW_MOON_BASE_JD =
  2451550.09765;

const SYNODIC_MONTH_DAYS =
  29.530588853;


function julianDateFromDate(date) {
  return (
    2440587.5 +
    date.getTime() / DAY_MS
  );
}


function dateFromJulianDate(julianDate) {
  return new Date(
    (
      julianDate -
      2440587.5
    ) * DAY_MS
  );
}


function getMeeusNewMoonJulianDate(k) {
  const T =
    k / 1236.85;

  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T2 * T2;

  const E =
    1 -
    0.002516 * T -
    0.0000074 * T2;

  const M =
    THREE.MathUtils.degToRad(
      2.5534 +
      29.10535670 * k -
      0.0000014 * T2 -
      0.00000011 * T3
    );

  const MPrime =
    THREE.MathUtils.degToRad(
      201.5643 +
      385.81693528 * k +
      0.0107582 * T2 +
      0.00001238 * T3 -
      0.000000058 * T4
    );

  const F =
    THREE.MathUtils.degToRad(
      160.7108 +
      390.67050284 * k -
      0.0016118 * T2 -
      0.00000227 * T3 +
      0.000000011 * T4
    );

  const Omega =
    THREE.MathUtils.degToRad(
      124.7746 -
      1.56375580 * k +
      0.0020672 * T2 +
      0.00000215 * T3
    );

  const correction =
    -0.40720 * Math.sin(MPrime) +
    0.17241 * E * Math.sin(M) +
    0.01608 * Math.sin(2 * MPrime) +
    0.01039 * Math.sin(2 * F) +
    0.00739 * E * Math.sin(MPrime - M) -
    0.00514 * E * Math.sin(MPrime + M) +
    0.00208 * E * E * Math.sin(2 * M) -
    0.00111 * Math.sin(MPrime - 2 * F) -
    0.00057 * Math.sin(MPrime + 2 * F) +
    0.00056 * E * Math.sin(2 * MPrime + M) -
    0.00042 * Math.sin(3 * MPrime) -
    0.00042 * E * Math.sin(M + 2 * F) -
    0.00038 * E * Math.sin(M - 2 * F) +
    0.00024 * E * Math.sin(2 * MPrime - M) -
    0.00017 * Math.sin(Omega) -
    0.00007 * Math.sin(MPrime + 2 * M) +
    0.00004 * Math.sin(2 * MPrime - 2 * F) +
    0.00004 * Math.sin(3 * M) +
    0.00003 * Math.sin(MPrime + M - 2 * F) +
    0.00003 * Math.sin(2 * MPrime + 2 * F) -
    0.00003 * Math.sin(MPrime + M + 2 * F) +
    0.00003 * Math.sin(MPrime - M + 2 * F) -
    0.00002 * Math.sin(MPrime - M - 2 * F) -
    0.00002 * Math.sin(3 * MPrime + M) +
    0.00002 * Math.sin(4 * MPrime);

  return (
    NEW_MOON_BASE_JD +
    SYNODIC_MONTH_DAYS * k +
    0.0001337 * T2 -
    0.000000150 * T3 +
    0.00000000073 * T4 +
    correction
  );
}


function getLunarPhaseState(date) {
  const julianDate =
    julianDateFromDate(date);

  const approximateK =
    Math.floor(
      (
        julianDate -
        NEW_MOON_BASE_JD
      ) /
      SYNODIC_MONTH_DAYS
    );

  let previousK =
    approximateK;

  let nextK =
    approximateK + 1;

  let previousNewMoonJD =
    getMeeusNewMoonJulianDate(
      previousK
    );

  let nextNewMoonJD =
    getMeeusNewMoonJulianDate(
      nextK
    );

  while (
    previousNewMoonJD >
    julianDate
  ) {
    previousK -= 1;

    previousNewMoonJD =
      getMeeusNewMoonJulianDate(
        previousK
      );
  }

  while (
    nextNewMoonJD <=
    julianDate
  ) {
    nextK += 1;

    nextNewMoonJD =
      getMeeusNewMoonJulianDate(
        nextK
      );
  }

  const cycleFraction =
    THREE.MathUtils.clamp(
      (
        julianDate -
        previousNewMoonJD
      ) /
      (
        nextNewMoonJD -
        previousNewMoonJD
      ),
      0,
      1
    );

  const phaseAngle =
    cycleFraction *
    Math.PI *
    2;

  return {
    phaseAngle,

    illuminationFraction:
      (1 - Math.cos(phaseAngle)) *
      0.5,

    previousNewMoon:
      dateFromJulianDate(
        previousNewMoonJD
      ),

    nextNewMoon:
      dateFromJulianDate(
        nextNewMoonJD
      )
  };
}


/* =========================================================
   ASTRONOMICAL DATE STATE
   ========================================================= */

let astronomicalDate =
  new Date();

let moonMesh = null;

let moonOrbitalPosition =
  new THREE.Vector3();

let moonSunDirection =
  new THREE.Vector3();

let moonPhaseAngle =
  0;

let moonIlluminationFraction =
  1;


function getAstronomicalDays(
  date = new Date()
) {
  return (
    date.getTime() -
    J2000_EPOCH_MS
  ) / DAY_MS;
}


function normalizeRadians(angle) {
  const fullTurn =
    Math.PI * 2;

  angle %= fullTurn;

  if (
    angle < 0
  ) {
    angle += fullTurn;
  }

  return angle;
}


function normalizeDegrees(angle) {
  angle %= 360;

  if (
    angle < 0
  ) {
    angle += 360;
  }

  return angle;
}


function getGreenwichSiderealTimeDegrees(
  date
) {
  const julianDate =
    julianDateFromDate(
      date
    );

  const centuries =
    (
      julianDate -
      2451545.0
    ) /
    JULIAN_CENTURY_DAYS;

  const gmst =
    280.46061837 +
    360.98564736629 *
      (
        julianDate -
        2451545.0
      ) +
    0.000387933 *
      centuries *
      centuries -
    (
      centuries *
      centuries *
      centuries
    ) /
      38_710_000;

  return normalizeDegrees(
    gmst
  );
}


function getEarthRotationAngleRadians(
  date
) {
  const siderealDegrees =
    getGreenwichSiderealTimeDegrees(
      date
    );

  return normalizeRadians(
    THREE.MathUtils.degToRad(
      siderealDegrees +
      90
    )
  );
}


function getPlanetMeanAnomalyAtDate(
  data,
  date
) {
  const days =
    getAstronomicalDays(
      date
    );

  const startingMeanAnomaly =
    THREE.MathUtils.degToRad(
      data.startMeanAnomalyDegrees
    );

  const meanMotionPerDay =
    Math.PI * 2 /
    data.orbitalPeriodDays;

  return normalizeRadians(
    startingMeanAnomaly +
    meanMotionPerDay *
    days
  );
}


function solveKeplerMeanAnomaly(
  meanAnomaly,
  eccentricity
) {
  let eccentricAnomaly =
    meanAnomaly;

  for (
    let i = 0;
    i < 10;
    i += 1
  ) {
    eccentricAnomaly -=
      (
        eccentricAnomaly -
        eccentricity *
          Math.sin(
            eccentricAnomaly
          ) -
        meanAnomaly
      ) /
      (
        1 -
        eccentricity *
          Math.cos(
            eccentricAnomaly
          )
      );
  }

  return eccentricAnomaly;
}


function getMoonEclipticPosition(
  daysSinceJ2000,
  phaseAngle,
  sunEclipticLongitude
) {
  const ascendingNode =
    THREE.MathUtils.degToRad(
      normalizeDegrees(
        MOON_NODE_AT_J2000_DEGREES +
        MOON_NODE_RATE_DEGREES_PER_DAY *
        daysSinceJ2000
      )
    );

  const argumentOfPerigee =
    THREE.MathUtils.degToRad(
      normalizeDegrees(
        MOON_PERIGEE_AT_J2000_DEGREES +
        MOON_PERIGEE_RATE_DEGREES_PER_DAY *
        daysSinceJ2000
      )
    );

  const meanAnomaly =
    THREE.MathUtils.degToRad(
      normalizeDegrees(
        MOON_MEAN_ANOMALY_AT_J2000_DEGREES +
        MOON_MEAN_MOTION_DEGREES_PER_DAY *
        daysSinceJ2000
      )
    );

  const eccentricAnomaly =
    solveKeplerMeanAnomaly(
      meanAnomaly,
      MOON_ECCENTRICITY
    );

  const semiMajorAxis =
    MOON_EARTH_RADIUS_RATIO;

  const xOrbital =
    semiMajorAxis *
    (
      Math.cos(
        eccentricAnomaly
      ) -
      MOON_ECCENTRICITY
    );

  const yOrbital =
    semiMajorAxis *
    Math.sqrt(
      1 -
      MOON_ECCENTRICITY *
        MOON_ECCENTRICITY
    ) *
    Math.sin(
      eccentricAnomaly
    );

  const xPerifocal =
    xOrbital *
      Math.cos(
        argumentOfPerigee
      ) -
    yOrbital *
      Math.sin(
        argumentOfPerigee
      );

  const yPerifocal =
    xOrbital *
      Math.sin(
        argumentOfPerigee
      ) +
    yOrbital *
      Math.cos(
        argumentOfPerigee
      );

  const cosNode =
    Math.cos(
      ascendingNode
    );

  const sinNode =
    Math.sin(
      ascendingNode
    );

  const cosInclination =
    Math.cos(
      THREE.MathUtils.degToRad(
        MOON_INCLINATION_DEGREES
      )
    );

  const sinInclination =
    Math.sin(
      THREE.MathUtils.degToRad(
        MOON_INCLINATION_DEGREES
      )
    );

  const rawX =
    xPerifocal *
      cosNode -
    yPerifocal *
      sinNode *
      cosInclination;

  const rawY =
    yPerifocal *
    sinInclination;

  const rawZ =
    xPerifocal *
      sinNode +
    yPerifocal *
      cosNode *
      cosInclination;

  const rawDistance =
    Math.sqrt(
      rawX * rawX +
      rawY * rawY +
      rawZ * rawZ
    );

  const rawLatitude =
    Math.asin(
      THREE.MathUtils.clamp(
        rawY /
          rawDistance,
        -1,
        1
      )
    );

  const targetLongitude =
    sunEclipticLongitude +
    phaseAngle;

  const distance =
    rawDistance *
    EARTH_GAME_RADIUS;

  return new THREE.Vector3(
    distance *
      Math.cos(
        rawLatitude
      ) *
      Math.cos(
        targetLongitude
      ),

    distance *
      Math.sin(
        rawLatitude
      ),

    distance *
      Math.cos(
        rawLatitude
      ) *
      Math.sin(
        targetLongitude
      )
  );
}


function updateAstronomicalClock() {
  astronomicalDate =
    new Date();

  return getAstronomicalDays(
    astronomicalDate
  );
}


/* =========================================================
   PLANET DATA
   ========================================================= */

const planetDataList = [
  {
    name: "Mercury",
    color: 0x96928c,
    orbitColor: 0xa7a7a7,
    semiMajorAxisAU: 0.387098,
    eccentricity: 0.20564,
    orbitalPeriodDays: 87.969,
    radiusKm: 2439.7,
    rotationPeriodHours: 1407.6,
    axialTiltDegrees: 0.03,
    orbitalInclinationDegrees: 7.005,
    longitudeOfAscendingNodeDegrees: 48.331,
    argumentOfPeriapsisDegrees: 29.124,
    startMeanAnomalyDegrees: 174.796
  },

  {
    name: "Venus",
    color: 0xd8bd83,
    orbitColor: 0xcab98d,
    semiMajorAxisAU: 0.723336,
    eccentricity: 0.006776,
    orbitalPeriodDays: 224.701,
    radiusKm: 6051.8,
    rotationPeriodHours: -5832.5,
    axialTiltDegrees: 177.36,
    orbitalInclinationDegrees: 3.394,
    longitudeOfAscendingNodeDegrees: 76.68,
    argumentOfPeriapsisDegrees: 54.891,
    startMeanAnomalyDegrees: 50.115
  },

  {
    name: "Earth",
    color: 0x347fe0,
    orbitColor: 0x63a9ff,
    semiMajorAxisAU: 1,
    eccentricity: 0.01671,
    orbitalPeriodDays: 365.256,
    radiusKm: 6371,
    rotationPeriodHours: 23.934,
    axialTiltDegrees: 23.44,
    orbitalInclinationDegrees: 0,
    longitudeOfAscendingNodeDegrees: 0,
    argumentOfPeriapsisDegrees: 102.937,
    startMeanAnomalyDegrees: 357.529,
    hasMoon: true
  },

  {
    name: "Mars",
    color: 0xc9563d,
    orbitColor: 0xe07860,
    semiMajorAxisAU: 1.523679,
    eccentricity: 0.0934,
    orbitalPeriodDays: 686.98,
    radiusKm: 3389.5,
    rotationPeriodHours: 24.623,
    axialTiltDegrees: 25.19,
    orbitalInclinationDegrees: 1.85,
    longitudeOfAscendingNodeDegrees: 49.558,
    argumentOfPeriapsisDegrees: 286.502,
    startMeanAnomalyDegrees: 19.373
  },

  {
    name: "Jupiter",
    color: 0xc58e5a,
    orbitColor: 0xd1a477,
    semiMajorAxisAU: 5.2028,
    eccentricity: 0.0489,
    orbitalPeriodDays: 4332.59,
    radiusKm: 69911,
    rotationPeriodHours: 9.925,
    axialTiltDegrees: 3.13,
    orbitalInclinationDegrees: 1.304,
    longitudeOfAscendingNodeDegrees: 100.454,
    argumentOfPeriapsisDegrees: 273.877,
    startMeanAnomalyDegrees: 20.02
  },

  {
    name: "Saturn",
    color: 0xd4c18a,
    orbitColor: 0xe0d2a6,
    semiMajorAxisAU: 9.537,
    eccentricity: 0.0565,
    orbitalPeriodDays: 10755.7,
    radiusKm: 58232,
    rotationPeriodHours: 10.656,
    axialTiltDegrees: 26.73,
    orbitalInclinationDegrees: 2.486,
    longitudeOfAscendingNodeDegrees: 113.663,
    argumentOfPeriapsisDegrees: 339.392,
    startMeanAnomalyDegrees: 317.021,
    hasRings: true
  },

  {
    name: "Uranus",
    color: 0x79d6dd,
    orbitColor: 0x91e8ed,
    semiMajorAxisAU: 19.1914,
    eccentricity: 0.0472,
    orbitalPeriodDays: 30688.5,
    radiusKm: 25362,
    rotationPeriodHours: -17.24,
    axialTiltDegrees: 97.77,
    orbitalInclinationDegrees: 0.773,
    longitudeOfAscendingNodeDegrees: 74,
    argumentOfPeriapsisDegrees: 96.661,
    startMeanAnomalyDegrees: 141.05
  },

  {
    name: "Neptune",
    color: 0x3c68d8,
    orbitColor: 0x7794ff,
    semiMajorAxisAU: 30.0611,
    eccentricity: 0.0086,
    orbitalPeriodDays: 60182,
    radiusKm: 24622,
    rotationPeriodHours: 16.11,
    axialTiltDegrees: 28.32,
    orbitalInclinationDegrees: 1.77,
    longitudeOfAscendingNodeDegrees: 131.781,
    argumentOfPeriapsisDegrees: 272.846,
    startMeanAnomalyDegrees: 256.228
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
   UPDATE SUN WORLD POSITION
   ========================================================= */

function updateSunWorldPosition() {
  if (
    !solarSystemRoot
  ) {
    sunPosition.set(
      0,
      0,
      0
    );

    return;
  }

  sunPosition.copy(
    solarSystemRoot.position
  );
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

  const distanceFromOrigin =
    camera.position.length();

  if (
    distanceFromOrigin <
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

  camera.position.sub(
    tempShift
  );

  updateSunWorldPosition();
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

  gameUI.classList.toggle(
    "superman-mode",
    currentSpeedMode ===
      "superman"
  );

  updateCreatorLabelMode();
}


function setSpeedMode(mode) {
  if (
    !speedModes[mode]
  ) {
    return;
  }

  if (
    energy <= 0 &&
    mode === "superman"
  ) {
    mode = "chill";
  }

  currentSpeedMode =
    mode;

  if (
    mode === "chill" ||
    mode === "creator"
  ) {
    currentMovementSpeed =
      CHILL_SPEED;
  }

  updateSpeedButtons();
  updateEnergyDisplay();
}


function updateCreatorLabelMode() {
  labelLayer.classList.toggle(
    "creator-enabled",
    planetLabelsVisible &&
      currentSpeedMode ===
      "creator" &&
      !cinematicMode
  );
}


/* =========================================================
   ENERGY DISPLAY
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
    String(displayedEnergy)
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

  const lowEnergy =
    currentSpeedMode ===
      "superman" &&
    energy < 20;

  gameUI.classList.toggle(
    "superman-low-energy",
    lowEnergy
  );
}


/* =========================================================
   MOVEMENT SPEED
   ========================================================= */

function updateMovementSpeed(
  deltaTime
) {
  const mode =
    speedModes[
      currentSpeedMode
    ] ||
    speedModes.chill;

  const targetSpeed =
    mode.speed;

  if (
    currentSpeedMode ===
      "chill" ||
    currentSpeedMode ===
      "creator"
  ) {
    currentMovementSpeed =
      CHILL_SPEED;

    return;
  }

  const difference =
    targetSpeed -
    currentMovementSpeed;

  const maximumChange =
    SPEED_ACCELERATION *
    deltaTime;

  if (
    Math.abs(difference) <=
    maximumChange
  ) {
    currentMovementSpeed =
      targetSpeed;

    return;
  }

  currentMovementSpeed +=
    Math.sign(difference) *
    maximumChange;
}


/* =========================================================
   VISUAL TOGGLES
   ========================================================= */

function updateVisualToggleButtons() {
  const labelButton =
    $("labels-toggle");

  const orbitButton =
    $("orbits-toggle");

  const distanceButton =
    $("distance-toggle");

  if (labelButton) {
    labelButton.querySelector(
      ".toggle-state"
    ).textContent =
      planetLabelsVisible
        ? "ON"
        : "OFF";

    labelButton.setAttribute(
      "aria-pressed",
      String(planetLabelsVisible)
    );
  }

  if (orbitButton) {
    orbitButton.querySelector(
      ".toggle-state"
    ).textContent =
      orbitLinesVisible
        ? "ON"
        : "OFF";

    orbitButton.setAttribute(
      "aria-pressed",
      String(orbitLinesVisible)
    );
  }

  if (distanceButton) {
    distanceButton.querySelector(
      ".toggle-state"
    ).textContent =
      distanceVisible
        ? "ON"
        : "OFF";

    distanceButton.setAttribute(
      "aria-pressed",
      String(distanceVisible)
    );
  }

  const cinematicButton =
    $("cinematic-toggle");

  if (cinematicButton) {
    cinematicButton.querySelector(
      ".toggle-state"
    ).textContent =
      cinematicMode
        ? "ON"
        : "OFF";

    cinematicButton.setAttribute(
      "aria-pressed",
      String(cinematicMode)
    );
  }
}


function setPlanetLabelsVisible(
  visible
) {
  planetLabelsVisible =
    visible;

  updateVisualToggleButtons();
  updateCreatorLabelMode();
}


function setOrbitLinesVisible(
  visible
) {
  orbitLinesVisible =
    visible;

  for (
    const planetData of
      solarPlanets
  ) {
    if (planetData.orbitLine) {
      planetData.orbitLine.visible =
        orbitLinesVisible &&
        !cinematicMode;
    }
  }

  updateVisualToggleButtons();
}


function setDistanceVisible(
  visible
) {
  distanceVisible =
    visible;

  for (
    const planetData of
      solarPlanets
  ) {
    if (
      planetData.labelDistance
    ) {
      planetData.labelDistance.style.display =
        distanceVisible
          ? ""
          : "none";
    }
  }

  updateVisualToggleButtons();
}


function setCinematicMode(
  enabled
) {
  cinematicMode =
    enabled;

  if (
    cinematicMode
  ) {
    uiMenuVisible =
      false;

    $("visual-panel").hidden =
      true;

    uiToggle.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  for (
    const planetData of
      solarPlanets
  ) {
    if (planetData.orbitLine) {
      planetData.orbitLine.visible =
        orbitLinesVisible &&
        !cinematicMode;
    }
  }

  gameUI.classList.toggle(
    "cinematic-mode",
    cinematicMode
  );

  labelLayer.classList.toggle(
    "cinematic-hidden",
    cinematicMode
  );

  updateVisualToggleButtons();
  updateCreatorLabelMode();
}


/* =========================================================
   UI MENU
   ========================================================= */

function setUIMenuVisible(
  visible
) {
  if (
    cinematicMode &&
    visible
  ) {
    setCinematicMode(
      false
    );
  }

  uiMenuVisible =
    visible;

  const visualPanel =
    $("visual-panel");

  visualPanel.hidden =
    !uiMenuVisible;

  uiToggle.setAttribute(
    "aria-expanded",
    String(uiMenuVisible)
  );
}


/* =========================================================
   NORTH / HEADING
   ========================================================= */

function setNorthHeading() {
  if (
    !camera
  ) {
    return;
  }

  yaw = 0;

  pitch = 0;

  camera.rotation.set(
    pitch,
    yaw,
    0
  );
}
