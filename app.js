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

const COLLISION_MARGIN =
  1.5;


/* =========================================================
   DISTANCE-BASED VISUAL BODY BOOST
   =========================================================

   This is render-only.

   Physical radii, collision radii, orbital distances,
   orbital mechanics, Moon geometry and lighting are
   completely untouched.

   At 37,000 game units and closer:
       TRUE physical visual size = 1.0x

   Beyond 37,000:
       planets gradually become easier to see.

   At 1,500,000 game units:
       maximum visual readability boost = 1.65x

   The transition is logarithmic and smooth so there is
   no obvious "switch" when crossing the 37,000 boundary.
   ========================================================= */

const VISUAL_BOOST_END_DISTANCE =
  37_000;

const VISUAL_BOOST_FULL_DISTANCE =
  1_500_000;

const VISUAL_BOOST_MAX_SCALE =
  1.65;


function getVisualBodyScale(
  distance
) {
  if (
    distance <=
    VISUAL_BOOST_END_DISTANCE
  ) {
    return 1;
  }

  const logStart =
    Math.log(
      VISUAL_BOOST_END_DISTANCE
    );

  const logEnd =
    Math.log(
      VISUAL_BOOST_FULL_DISTANCE
    );

  const logDistance =
    Math.log(
      Math.max(
        distance,
        VISUAL_BOOST_END_DISTANCE
      )
    );

  const t =
    THREE.MathUtils.clamp(
      (
        logDistance -
        logStart
      ) /
      (
        logEnd -
        logStart
      ),
      0,
      1
    );

  const smoothT =
    t *
    t *
    (3 - 2 * t);

  return THREE.MathUtils.lerp(
    1,
    VISUAL_BOOST_MAX_SCALE,
    smoothT
  );
}


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


/*
 * Astronomical clock / date state.
 * The browser's Date object is the host device clock.
 * UTC is used internally so the same instant produces
 * the same Solar System state on every device.
 */

const J2000_EPOCH_MS =
  Date.UTC(
    2000,
    0,
    1,
    12,
    0,
    0
  );

const DAY_MS =
  86_400_000;

const JULIAN_CENTURY_DAYS =
  36_525;

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


/*
 * Meeus new-moon model.
 */

const NEW_MOON_BASE_JD =
  2451550.09765;

const SYNODIC_MONTH_DAYS =
  29.530588853;


function julianDateFromDate(
  date
) {
  return (
    2440587.5 +
    date.getTime() /
      DAY_MS
  );
}


function dateFromJulianDate(
  julianDate
) {
  return new Date(
    (
      julianDate -
      2440587.5
    ) *
    DAY_MS
  );
}


function getMeeusNewMoonJulianDate(
  k
) {
  const T =
    k / 1236.85;

  const T2 =
    T * T;

  const T3 =
    T2 * T;

  const T4 =
    T3 * T;

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
    -0.40720 *
      Math.sin(MPrime) +

    0.17241 *
      E *
      Math.sin(M) +

    0.01608 *
      Math.sin(2 * MPrime) +

    0.01039 *
      Math.sin(2 * F) +

    0.00739 *
      E *
      Math.sin(MPrime - M) -

    0.00514 *
      E *
      Math.sin(MPrime + M) +

    0.00208 *
      E *
      E *
      Math.sin(2 * M) -

    0.00111 *
      Math.sin(MPrime - 2 * F) -

    0.00057 *
      Math.sin(MPrime + 2 * F) +

    0.00056 *
      E *
      Math.sin(2 * MPrime + M) -

    0.00042 *
      Math.sin(3 * MPrime) -

    0.00042 *
      E *
      Math.sin(M + 2 * F) -

    0.00038 *
      E *
      Math.sin(M - 2 * F) +

    0.00024 *
      E *
      Math.sin(2 * MPrime - M) -

    0.00017 *
      Math.sin(Omega) -

    0.00007 *
      Math.sin(MPrime + 2 * M) +

    0.00004 *
      Math.sin(2 * MPrime - 2 * F) +

    0.00004 *
      Math.sin(3 * M) +

    0.00003 *
      Math.sin(MPrime + M - 2 * F) +

    0.00003 *
      Math.sin(2 * MPrime + 2 * F) -

    0.00003 *
      Math.sin(MPrime + M + 2 * F) +

    0.00003 *
      Math.sin(MPrime - M + 2 * F) -

    0.00002 *
      Math.sin(MPrime - M - 2 * F) -

    0.00002 *
      Math.sin(3 * MPrime + M) +

    0.00002 *
      Math.sin(4 * MPrime);

  return (
    NEW_MOON_BASE_JD +
    SYNODIC_MONTH_DAYS *
      k +
    0.0001337 * T2 -
    0.000000150 * T3 +
    0.00000000073 * T4 +
    correction
  );
}


function getLunarPhaseState(
  date
) {
  const julianDate =
    julianDateFromDate(
      date
    );

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
      (
        1 -
        Math.cos(
          phaseAngle
        )
      ) *
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
  ) /
  DAY_MS;
}


function normalizeRadians(
  angle
) {
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


function normalizeDegrees(
  angle
) {
  angle %= 360;

  if (
    angle < 0
  ) {
    angle += 360;
  }

  return angle;
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

  const rawLongitude =
    Math.atan2(
      rawZ,
      rawX
    );

  const phaseLongitude =
    THREE.MathUtils.degToRad(
      normalizeDegrees(
        THREE.MathUtils.radToDeg(
          sunEclipticLongitude +
          phaseAngle
        )
      )
    );

  const longitudeCorrection =
    normalizeRadians(
      phaseLongitude -
      rawLongitude
    );

  const correctedX =
    rawDistance *
    Math.cos(
      rawLatitude
    ) *
    Math.cos(
      rawLongitude +
      longitudeCorrection
    );

  const correctedY =
    rawDistance *
    Math.sin(
      rawLatitude
    );

  const correctedZ =
    rawDistance *
    Math.cos(
      rawLatitude
    ) *
    Math.sin(
      rawLongitude +
      longitudeCorrection
    );

  return new THREE.Vector3(
    correctedX,
    correctedY,
    correctedZ
  );
}


/* =========================================================
   PLANET DATA
   ========================================================= */

const planetData = [
  {
    name: "Mercury",
    radiusKm: 2_439.7,
    orbitalRadiusAU: 0.387098,
    eccentricity: 0.20563,
    orbitalPeriodDays: 87.969,
    rotationPeriodHours: 1407.6,
    startMeanAnomalyDegrees: 174.796,
    color: 0x9a806b
  },

  {
    name: "Venus",
    radiusKm: 6_051.8,
    orbitalRadiusAU: 0.723332,
    eccentricity: 0.006772,
    orbitalPeriodDays: 224.701,
    rotationPeriodHours: -5832.5,
    startMeanAnomalyDegrees: 50.115,
    color: 0xc99f6c
  },

  {
    name: "Earth",
    radiusKm: 6_371,
    orbitalRadiusAU: 1,
    eccentricity: 0.0167086,
    orbitalPeriodDays: 365.256,
    rotationPeriodHours: 23.9345,
    startMeanAnomalyDegrees: 357.529,
    color: 0x3c78c8
  },

  {
    name: "Mars",
    radiusKm: 3_389.5,
    orbitalRadiusAU: 1.523679,
    eccentricity: 0.0934,
    orbitalPeriodDays: 686.98,
    rotationPeriodHours: 24.6229,
    startMeanAnomalyDegrees: 19.412,
    color: 0xb85c3c
  },

  {
    name: "Jupiter",
    radiusKm: 69_911,
    orbitalRadiusAU: 5.2044,
    eccentricity: 0.0489,
    orbitalPeriodDays: 4332.59,
    rotationPeriodHours: 9.925,
    startMeanAnomalyDegrees: 20.020,
    color: 0xb98f6b
  },

  {
    name: "Saturn",
    radiusKm: 58_232,
    orbitalRadiusAU: 9.5826,
    eccentricity: 0.0565,
    orbitalPeriodDays: 10759.22,
    rotationPeriodHours: 10.656,
    startMeanAnomalyDegrees: 317.020,
    color: 0xd1b78d,
    hasRings: true
  },

  {
    name: "Uranus",
    radiusKm: 25_362,
    orbitalRadiusAU: 19.2184,
    eccentricity: 0.046381,
    orbitalPeriodDays: 30688.5,
    rotationPeriodHours: -17.24,
    startMeanAnomalyDegrees: 142.2386,
    color: 0x83c7d7
  },

  {
    name: "Neptune",
    radiusKm: 24_622,
    orbitalRadiusAU: 30.11,
    eccentricity: 0.009456,
    orbitalPeriodDays: 60182,
    rotationPeriodHours: 16.11,
    startMeanAnomalyDegrees: 256.228,
    color: 0x466ed6
  }
];


/* =========================================================
   HELPERS
   ========================================================= */

function createLabel(
  text
) {
  const label =
    document.createElement(
      "div"
    );

  label.className =
    "planet-label";

  label.textContent =
    text;

  labelLayer.appendChild(
    label
  );

  return label;
}


function formatDistance(
  distance
) {
  if (
    distance < 1000
  ) {
    return (
      distance.toFixed(0) +
      " km"
    );
  }

  if (
    distance <
    GAME_UNITS_PER_AU
  ) {
    return (
      (
        distance /
        GAME_UNITS_PER_KM
      ).toLocaleString(
        undefined,
        {
          maximumFractionDigits:
            0
        }
      ) +
      " km"
    );
  }

  return (
    (
      distance /
      GAME_UNITS_PER_AU
    ).toFixed(2) +
    " AU"
  );
}


function clamp(
  value,
  min,
  max
) {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}


/* =========================================================
   CREATE PLANET
   ========================================================= */

function createPlanet(
  data
) {
  const planetRadius =
    data.radiusKm *
    GAME_UNITS_PER_KM *
    SOLAR_SYSTEM_SCALE;

  const semiMajorAxis =
    data.orbitalRadiusAU *
    GAME_UNITS_PER_AU *
    SOLAR_SYSTEM_SCALE;

  const startingMeanAnomaly =
    THREE.MathUtils.degToRad(
      data.startMeanAnomalyDegrees
    );

  const meanMotion =
    Math.PI * 2 /
    (
      data.orbitalPeriodDays *
      SECONDS_PER_DAY
    );

  const spinSpeed =
    (
      Math.PI * 2
    ) /
    (
      Math.abs(
        data.rotationPeriodHours
      ) *
      3600
    );

  const orbitalBodyGroup =
    new THREE.Group();

  orbitalBodyGroup.name =
    data.name +
    " Orbit";

  solarSystemRoot.add(
    orbitalBodyGroup
  );

  const geometry =
    new THREE.SphereGeometry(
      planetRadius,
      48,
      32
    );

  const material =
    new THREE.MeshStandardMaterial(
      {
        color:
          data.color,

        roughness:
          0.9,

        metalness:
          0
      }
    );

  const planet =
    new THREE.Mesh(
      geometry,
      material
    );

  planet.name =
    data.name;

  orbitalBodyGroup.add(
    planet
  );

  let cloudMesh = null;

  if (
    data.name ===
    "Earth"
  ) {
    loadTextureWithFallback(
      TEXTURE_URLS.earth,
      (texture) => {
        planet.material.map =
          texture;

        planet.material.color.set(
          0xffffff
        );

        planet.material.needsUpdate =
          true;
      }
    );

    const cloudGeometry =
      new THREE.SphereGeometry(
        planetRadius *
          1.008,
        48,
        32
      );

    const cloudMaterial =
      new THREE.MeshStandardMaterial(
        {
          transparent:
            true,

          opacity:
            0.75,

          depthWrite:
            false,

          roughness:
            1
        }
      );

    cloudMesh =
      new THREE.Mesh(
        cloudGeometry,
        cloudMaterial
      );

    cloudMesh.name =
      "Earth Clouds";

    orbitalBodyGroup.add(
      cloudMesh
    );

    loadTextureWithFallback(
      TEXTURE_URLS.earthClouds,
      (texture) => {
        cloudMaterial.map =
          texture;

        cloudMaterial.color.set(
          0xffffff
        );

        cloudMaterial.needsUpdate =
          true;
      }
    );
  }

  if (
    data.name ===
    "Jupiter"
  ) {
    loadTextureWithFallback(
      TEXTURE_URLS.jupiter,
      (texture) => {
        planet.material.map =
          texture;

        planet.material.color.set(
          0xffffff
        );

        planet.material.needsUpdate =
          true;
      }
    );
  }

  if (
    data.name ===
    "Saturn"
  ) {
    loadTextureWithFallback(
      TEXTURE_URLS.saturn,
      (texture) => {
        planet.material.map =
          texture;

        planet.material.color.set(
          0xffffff
        );

        planet.material.needsUpdate =
          true;
      }
    );

    const ringGeometry =
      new THREE.RingGeometry(
        planetRadius *
          1.25,

        planetRadius *
          2.35,

        128
      );

    const ringMaterial =
      new THREE.MeshStandardMaterial(
        {
          color:
            0xffffff,

          transparent:
            true,

          side:
            THREE.DoubleSide,

          roughness:
            1,

          depthWrite:
            false
        }
      );

    const rings =
      new THREE.Mesh(
        ringGeometry,
        ringMaterial
      );

    rings.rotation.x =
      Math.PI / 2;

    rings.name =
      "Saturn Rings";

    planet.add(
      rings
    );

    loadTextureWithFallback(
      TEXTURE_URLS.saturnRing,
      (texture) => {
        ringMaterial.map =
          texture;

        ringMaterial.alphaMap =
          texture;

        ringMaterial.color.set(
          0xffffff
        );

        ringMaterial.needsUpdate =
          true;
      }
    );
  }

  const orbitGeometry =
    new THREE.BufferGeometry();

  const orbitPoints = [];

  const orbitSegments =
    256;

  for (
    let i = 0;
    i <= orbitSegments;
    i += 1
  ) {
    const theta =
      (
        i /
        orbitSegments
      ) *
      Math.PI *
      2;

    const r =
      semiMajorAxis *
      (
        1 -
        data.eccentricity *
          data.eccentricity
      ) /
      (
        1 +
        data.eccentricity *
          Math.cos(theta)
      );

    orbitPoints.push(
      new THREE.Vector3(
        r *
          Math.cos(theta),

        0,

        r *
          Math.sin(theta)
      )
    );
  }

  orbitGeometry.setFromPoints(
    orbitPoints
  );

  const orbitMaterial =
    new THREE.LineBasicMaterial(
      {
        color:
          0x6f86a8,

        transparent:
          true,

        opacity:
          0.22
      }
    );

  const orbitLine =
    new THREE.Line(
      orbitGeometry,
      orbitMaterial
    );

  solarSystemRoot.add(
    orbitLine
  );

  const label =
    createLabel(
      data.name
    );

  const record = {
    name:
      data.name,

    sourceData:
      data,

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

    cloudMesh,

    label,

    labelDistance:
      null,

    radius:
      planetRadius
  };

  solarPlanets.push(
    record
  );

  return record;
}


/* =========================================================
   CREATE SUN
   ========================================================= */

function createSun() {
  const sunGeometry =
    new THREE.SphereGeometry(
      SUN_RADIUS,
      64,
      48
    );

  const sunMaterial =
    new THREE.MeshBasicMaterial(
      {
        color:
          0xffd66b
      }
    );

  sunMesh =
    new THREE.Mesh(
      sunGeometry,
      sunMaterial
    );

  sunMesh.name =
    "Sun";

  solarSystemRoot.add(
    sunMesh
  );

  const sunLabel =
    createLabel(
      "Sun"
    );

  solarPlanets.push(
    {
      name:
        "Sun",

      sourceData:
        {
          name:
            "Sun"
        },

      semiMajorAxis:
        0,

      eccentricity:
        0,

      meanAnomaly:
        0,

      meanMotion:
        0,

      spinSpeed:
        0,

      orbitalBodyGroup:
        solarSystemRoot,

      planet:
        sunMesh,

      orbitLine:
        null,

      cloudMesh:
        null,

      label:
        sunLabel,

      labelDistance:
        null,

      radius:
        SUN_RADIUS,

      isSun:
        true
    }
  );

  sunLight =
    new THREE.PointLight(
      0xffffff,
      2.5,
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

  const glowGeometry =
    new THREE.SphereGeometry(
      SUN_RADIUS *
        1.12,
      32,
      24
    );

  const glowMaterial =
    new THREE.MeshBasicMaterial(
      {
        color:
          0xffb347,

        transparent:
          true,

        opacity:
          0.16,

        depthWrite:
          false
      }
    );

  sunGlow =
    new THREE.Mesh(
      glowGeometry,
      glowMaterial
    );

  solarSystemRoot.add(
    sunGlow
  );
}


/* =========================================================
   CREATE MOON
   ========================================================= */

function createMoon() {
  moonPivot =
    new THREE.Group();

  moonPivot.name =
    "Moon Pivot";

  solarSystemRoot.add(
    moonPivot
  );

  const moonGeometry =
    new THREE.SphereGeometry(
      MOON_RADIUS,
      48,
      32
    );

  const moonMaterial =
    new THREE.MeshStandardMaterial(
      {
        color:
          0xb7b7b7,

        roughness:
          1
      }
    );

  moonMesh =
    new THREE.Mesh(
      moonGeometry,
      moonMaterial
    );

  moonMesh.name =
    "Moon";

  moonPivot.add(
    moonMesh
  );

  const moonLabel =
    createLabel(
      "Moon"
    );

  solarPlanets.push(
    {
      name:
        "Moon",

      sourceData:
        {
          name:
            "Moon"
        },

      semiMajorAxis:
        MOON_ORBIT_RADIUS,

      eccentricity:
        MOON_ECCENTRICITY,

      meanAnomaly:
        0,

      meanMotion:
        Math.PI * 2 /
        (
          MOON_ORBIT_PERIOD_DAYS *
          SECONDS_PER_DAY
        ),

      spinSpeed:
        0,

      orbitalBodyGroup:
        moonPivot,

      planet:
        moonMesh,

      orbitLine:
        null,

      cloudMesh:
        null,

      label:
        moonLabel,

      labelDistance:
        null,

      radius:
        MOON_RADIUS,

      isMoon:
        true
    }
  );
}


/* =========================================================
   ASTRONOMICAL ORBIT UPDATE
   ========================================================= */

function updateAstronomicalClock() {
  astronomicalDate =
    new Date();
}


function updateMoonOrbit(
  date
) {
  if (
    !moonMesh ||
    solarPlanets.length === 0
  ) {
    return;
  }

  const earthData =
    solarPlanets.find(
      (item) =>
        item.name ===
        "Earth"
    );

  if (
    !earthData
  ) {
    return;
  }

  const days =
    getAstronomicalDays(
      date
    );

  const lunarState =
    getLunarPhaseState(
      date
    );

  moonPhaseAngle =
    lunarState.phaseAngle;

  moonIlluminationFraction =
    lunarState.illuminationFraction;

  earthData.planet
    .getWorldPosition(
      tempWorld
    );

  const earthPosition =
    tempWorld.clone();

  const earthSunVector =
    earthPosition
      .clone()
      .sub(
        sunPosition
      );

  const sunEclipticLongitude =
    Math.atan2(
      earthSunVector.z,
      earthSunVector.x
    ) +
    Math.PI;

  moonOrbitalPosition =
    getMoonEclipticPosition(
      days,
      moonPhaseAngle,
      sunEclipticLongitude
    );

  moonOrbitalPosition
    .multiplyScalar(
      GAME_UNITS_PER_KM *
      SOLAR_SYSTEM_SCALE
    );

  moonMesh.position.copy(
    moonOrbitalPosition
  );

  /*
   * Approximate tidal locking.
   * The Moon keeps approximately the same face toward Earth.
   */

  moonMesh.rotation.y =
    Math.atan2(
      moonOrbitalPosition.z,
      moonOrbitalPosition.x
    ) +
    Math.PI / 2;

  /*
   * Physical three-body illumination check.
   *
   * This does not fake the Moon phase with a texture.
   * The Moon remains a real lit sphere.
   */

  moonMesh.getWorldPosition(
    tempWorld
  );

  moonSunDirection
    .copy(
      sunPosition
    )
    .sub(
      tempWorld
    )
    .normalize();

  const moonToEarth =
    earthPosition
      .clone()
      .sub(
        tempWorld
      )
      .normalize();

  const physicalPhaseAngle =
    Math.acos(
      THREE.MathUtils.clamp(
        moonSunDirection.dot(
          moonToEarth
        ),
        -1,
        1
      )
    );

  moonIlluminationFraction =
    (
      1 -
      Math.cos(
        physicalPhaseAngle
      )
    ) *
    0.5;
}


function updateOrbits(
  deltaTime
) {
  updateAstronomicalClock();

  for (
    const planet of
      solarPlanets
  ) {
    if (
      planet.isSun ||
      planet.isMoon
    ) {
      continue;
    }

    const data =
      planet.sourceData;

    planet.meanAnomaly =
      getPlanetMeanAnomalyAtDate(
        data,
        astronomicalDate
      );

    const eccentricAnomaly =
      solveKeplerMeanAnomaly(
        planet.meanAnomaly,
        planet.eccentricity
      );

    const semiMajorAxis =
      planet.semiMajorAxis;

    const x =
      semiMajorAxis *
      (
        Math.cos(
          eccentricAnomaly
        ) -
        planet.eccentricity
      );

    const z =
      semiMajorAxis *
      Math.sqrt(
        1 -
        planet.eccentricity *
          planet.eccentricity
      ) *
      Math.sin(
        eccentricAnomaly
      );

    planet.orbitalBodyGroup
      .position.set(
        x,
        0,
        z
      );

    const elapsedSeconds =
      (
        astronomicalDate.getTime() -
        J2000_EPOCH_MS
      ) /
      1000;

    const rotationSign =
      data.rotationPeriodHours <
      0
        ? -1
        : 1;

    planet.planet.rotation.y =
      rotationSign *
      elapsedSeconds *
      planet.spinSpeed;

    if (
      planet.cloudMesh
    ) {
      planet.cloudMesh.rotation.y =
        planet.planet.rotation.y *
        1.02;
    }
  }

  updateMoonOrbit(
    astronomicalDate
  );
}


/* =========================================================
   VISUAL BODY SCALE UPDATE
   ========================================================= */

function updateVisualBodyScales() {
  for (
    const planetData of
      solarPlanets
  ) {
    if (
      !planetData.planet ||
      planetData.isSun
    ) {
      continue;
    }

    planetData.planet
      .getWorldPosition(
        tempWorld
      );

    const distance =
      camera.position.distanceTo(
        tempWorld
      );

    const visualScale =
      getVisualBodyScale(
        distance
      );

    planetData.planet
      .scale.set(
        visualScale,
        visualScale,
        visualScale
      );

    if (
      planetData.cloudMesh
    ) {
      planetData.cloudMesh
        .scale.set(
          visualScale,
          visualScale,
          visualScale
        );
    }
  }

  if (
    moonMesh
  ) {
    moonMesh.getWorldPosition(
      tempWorld
    );

    const moonDistance =
      camera.position.distanceTo(
        tempWorld
      );

    const moonVisualScale =
      getVisualBodyScale(
        moonDistance
      );

    moonMesh.scale.set(
      moonVisualScale,
      moonVisualScale,
      moonVisualScale
    );
  }
}


/* =========================================================
   COLLISION SYSTEM
   ========================================================= */

function getCollisionBodies() {
  const bodies = [];

  for (
    const planetData of
      solarPlanets
  ) {
    if (
      !planetData.planet
    ) {
      continue;
    }

    planetData.planet
      .getWorldPosition(
        collisionCenter
      );

    bodies.push(
      {
        name:
          planetData.name,

        position:
          collisionCenter.clone(),

        radius:
          planetData.radius
      }
    );
  }

  return bodies;
}


function closestPointOnSegment(
  point,
  segmentStart,
  segmentEnd,
  target
) {
  collisionDelta
    .copy(
      segmentEnd
    )
    .sub(
      segmentStart
    );

  const lengthSquared =
    collisionDelta.lengthSq();

  if (
    lengthSquared <=
    0.000001
  ) {
    target.copy(
      segmentStart
    );

    return;
  }

  const t =
    THREE.MathUtils.clamp(
      point
        .clone()
        .sub(
          segmentStart
        )
        .dot(
          collisionDelta
        ) /
        lengthSquared,

      0,

      1
    );

  target.copy(
    segmentStart
  ).addScaledVector(
    collisionDelta,
    t
  );
}


function resolveBodyCollisions(
  previousPosition,
  proposedPosition
) {
  const bodies =
    getCollisionBodies();

  const result =
    proposedPosition.clone();

  for (
    const body of bodies
  ) {
    closestPointOnSegment(
      body.position,
      previousPosition,
      result,
      collisionClosest
    );

    collisionPush
      .copy(
        collisionClosest
      )
      .sub(
        body.position
      );

    const distance =
      collisionPush.length();

    const minimumDistance =
      body.radius +
      COLLISION_MARGIN;

    if (
      distance >=
      minimumDistance
    ) {
      continue;
    }

    if (
      distance < 0.000001
    ) {
      collisionPush.set(
        0,
        1,
        0
      );
    } else {
      collisionPush
        .normalize();
    }

    result
      .copy(
        collisionClosest
      )
      .addScaledVector(
        collisionPush,
        minimumDistance
      );
  }

  return result;
}


/* =========================================================
   MOVEMENT
   ========================================================= */

function getMovementInput() {
  const movement =
    new THREE.Vector3();

  if (
    pressedControls.has(
      "forward"
    )
  ) {
    movement.z -= 1;
  }

  if (
    pressedControls.has(
      "back"
    )
  ) {
    movement.z += 1;
  }

  if (
    pressedControls.has(
      "left"
    )
  ) {
    movement.x -= 1;
  }

  if (
    pressedControls.has(
      "right"
    )
  ) {
    movement.x += 1;
  }

  if (
    pressedControls.has(
      "up"
    )
  ) {
    movement.y += 1;
  }

  if (
    pressedControls.has(
      "down"
    )
  ) {
    movement.y -= 1;
  }

  if (
    movement.lengthSq() >
    0
  ) {
    movement.normalize();
  }

  return movement;
}


function updateMovement(
  deltaTime
) {
  if (
    !camera
  ) {
    return;
  }

  if (
    currentSpeedMode ===
    "creator"
  ) {
    return;
  }

  const movementInput =
    getMovementInput();

  if (
    movementInput.lengthSq() <=
    0
  ) {
    return;
  }

  const forward =
    new THREE.Vector3(
      0,
      0,
      -1
    );

  forward.applyQuaternion(
    camera.quaternion
  );

  const right =
    new THREE.Vector3(
      1,
      0,
      0
    );

  right.applyQuaternion(
    camera.quaternion
  );

  const up =
    new THREE.Vector3(
      0,
      1,
      0
    );

  up.applyQuaternion(
    camera.quaternion
  );

  const movement =
    new THREE.Vector3();

  movement
    .addScaledVector(
      right,
      movementInput.x
    )
    .addScaledVector(
      up,
      movementInput.y
    )
    .addScaledVector(
      forward,
      -movementInput.z
    );

  if (
    movement.lengthSq() >
    0
  ) {
    movement.normalize();
  }

  if (
    currentSpeedMode ===
    "superman"
  ) {
    currentMovementSpeed =
      THREE.MathUtils.lerp(
        currentMovementSpeed,
        SUPERMAN_SPEED,
        Math.min(
          1,
          SPEED_ACCELERATION *
            deltaTime /
            SUPERMAN_SPEED
        )
      );
  } else {
    currentMovementSpeed =
      CHILL_SPEED;
  }

  const movementDistance =
    currentMovementSpeed *
    deltaTime;

  const previousPosition =
    camera.position.clone();

  const proposedPosition =
    previousPosition
      .clone()
      .addScaledVector(
        movement,
        movementDistance
      );

  const resolvedPosition =
    resolveBodyCollisions(
      previousPosition,
      proposedPosition
    );

  camera.position.copy(
    resolvedPosition
  );
}


/* =========================================================
   SPEED MODE
   ========================================================= */

function setSpeedMode(
  mode
) {
  if (
    !speedModes[mode]
  ) {
    return;
  }

  currentSpeedMode =
    mode;

  currentMovementSpeed =
    speedModes[mode].speed;

  if (
    mode !==
    "superman"
  ) {
    energy = 100;
  }

  updateSpeedUI();
}


function updateSpeedUI() {
  const speedModeElement =
    $("speed-mode");

  const speedValueElement =
    $("speed-value");

  if (
    speedModeElement
  ) {
    speedModeElement.textContent =
      currentSpeedMode
        .toUpperCase();
  }

  if (
    speedValueElement
  ) {
    speedValueElement.textContent =
      Math.round(
        currentMovementSpeed
      ).toLocaleString();
  }
}


/* =========================================================
   ENERGY
   ========================================================= */

function updateEnergy(
  deltaTime
) {
  if (
    currentSpeedMode ===
    "superman"
  ) {
    energy -=
      speedModes.superman
        .drainRate *
      deltaTime;

    if (
      energy <=
      0
    ) {
      energy = 0;

      setSpeedMode(
        "chill"
      );
    }
  } else {
    energy +=
      ENERGY_RECHARGE_RATE *
      deltaTime;

    energy =
      Math.min(
        100,
        energy
      );
  }

  const energyFill =
    $("energy-fill");

  const energyText =
    $("energy-text");

  if (
    energyFill
  ) {
    energyFill.style.width =
      energy +
      "%";
  }

  if (
    energyText
  ) {
    energyText.textContent =
      Math.round(
        energy
      ) +
      "%";
  }
}


/* =========================================================
   SUN / ENERGY UI
   ========================================================= */

function updateSunAndEnergy(
  deltaTime
) {
  updateEnergy(
    deltaTime
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

  if (
    camera.position.length() <
    FLOATING_ORIGIN_THRESHOLD
  ) {
    return;
  }

  tempShift
    .copy(
      camera.position
    );

  solarSystemRoot.position
    .sub(
      tempShift
    );

  camera.position.set(
    0,
    0,
    0
  );
}


/* =========================================================
   CAMERA ROTATION
   ========================================================= */

function updateCameraRotation() {
  camera.rotation.order =
    "YXZ";

  camera.rotation.y =
    yaw;

  camera.rotation.x =
    pitch;
}


/* =========================================================
   LABELS
   ========================================================= */

function updateLabels() {
  if (
    !camera
  ) {
    return;
  }

  for (
    const planetData of
      solarPlanets
  ) {
    if (
      !planetData.label ||
      !planetData.planet
    ) {
      continue;
    }

    planetData.planet
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

    const distance =
      camera.position.distanceTo(
        tempWorld
      );

    planetData.labelDistance =
      distance;

    const visible =
      planetLabelsVisible &&
      tempProjected.z <
        1;

    if (
      !visible
    ) {
      planetData.label.style.display =
        "none";

      continue;
    }

    const x =
      (
        tempProjected.x *
        0.5 +
        0.5
      ) *
      window.innerWidth;

    const y =
      (
        -tempProjected.y *
        0.5 +
        0.5
      ) *
      window.innerHeight;

    planetData.label.style.display =
      "block";

    planetData.label.style.left =
      x +
      "px";

    planetData.label.style.top =
      y +
      "px";

    planetData.label.style.opacity =
      clamp(
        1 -
          distance /
            (
              GAME_UNITS_PER_AU *
              20
            ),
        0.2,
        1
      );
  }
}


/* =========================================================
   DISTANCE UI
   ========================================================= */

function updateDistanceUI() {
  const distanceElement =
    $("distance-value");

  if (
    !distanceElement ||
    !distanceVisible
  ) {
    return;
  }

  let nearestDistance =
    Infinity;

  let nearestName =
    "";

  for (
    const planetData of
      solarPlanets
  ) {
    if (
      !planetData.planet
    ) {
      continue;
    }

    planetData.planet
      .getWorldPosition(
        tempWorld
      );

    const distance =
      camera.position.distanceTo(
        tempWorld
      );

    if (
      distance <
      nearestDistance
    ) {
      nearestDistance =
        distance;

      nearestName =
        planetData.name;
    }
  }

  if (
    nearestDistance !==
    Infinity
  ) {
    distanceElement.textContent =
      nearestName +
      " · " +
      formatDistance(
        nearestDistance
      );
  }
}


/* =========================================================
   ORBIT VISIBILITY
   ========================================================= */

function updateOrbitVisibility() {
  for (
    const planetData of
      solarPlanets
  ) {
    if (
      planetData.orbitLine
    ) {
      planetData.orbitLine.visible =
        orbitLinesVisible;
    }
  }
}


/* =========================================================
   NORTH / HEADING RESET
   ========================================================= */

function resetNorth() {
  yaw = 0;
  pitch = 0;

  updateCameraRotation();
}


/* =========================================================
   CINEMATIC MODE
   ========================================================= */

function updateCinematicMode() {
  if (
    !gameUI
  ) {
    return;
  }

  if (
    cinematicMode
  ) {
    gameUI.classList.add(
      "cinematic"
    );
  } else {
    gameUI.classList.remove(
      "cinematic"
    );
  }
}


/* =========================================================
   CREATOR TELEPORT
   ========================================================= */

function teleportToBody(
  bodyName
) {
  const target =
    solarPlanets.find(
      (item) =>
        item.name ===
        bodyName
    );

  if (
    !target ||
    !target.planet
  ) {
    return;
  }

  target.planet
    .getWorldPosition(
      tempWorld
    );

  camera.position.copy(
    tempWorld
  );

  camera.position.z +=
    target.radius *
    12;

  camera.lookAt(
    tempWorld
  );

  camera.rotation
    .reorder(
      "YXZ"
    );

  yaw =
    camera.rotation.y;

  pitch =
    camera.rotation.x;
}


/* =========================================================
   CREATOR MODE
   ========================================================= */

function enterCreatorMode() {
  setSpeedMode(
    "creator"
  );

  resetCreatorPinch();

  const earth =
    solarPlanets.find(
      (item) =>
        item.name ===
        "Earth"
    );

  if (
    earth
  ) {
    earth.planet
      .getWorldPosition(
        tempWorld
      );

    camera.position.copy(
      tempWorld
    );

    camera.position.z +=
      EARTH_GAME_RADIUS *
      20;

    camera.lookAt(
      tempWorld
    );

    camera.rotation
      .reorder(
        "YXZ"
      );

    yaw =
      camera.rotation.y;

    pitch =
      camera.rotation.x;
  }
}


/* =========================================================
   INPUT HELPERS
   ========================================================= */

function controlPressed(
  controlName
) {
  const keys =
    controlKeys[
      controlName
    ];

  if (
    !keys
  ) {
    return false;
  }

  return keys.some(
    (key) =>
      pressedKeys.has(
        key
      )
  );
}


function refreshPressedControls() {
  pressedControls.clear();

  for (
    const controlName of
      Object.keys(
        controlKeys
      )
  ) {
    if (
      controlPressed(
        controlName
      )
    ) {
      pressedControls.add(
        controlName
      );
    }
  }
}


/* =========================================================
   POINTER INPUT
   ========================================================= */

function handlePointerDown(
  event
) {
  activeTouchPointers.set(
    event.pointerId,
    event
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

  dragging = true;

  lastPointerX =
    event.clientX;

  lastPointerY =
    event.clientY;
}


function handlePointerMove(
  event
) {
  if (
    activeTouchPointers.has(
      event.pointerId
    )
  ) {
    activeTouchPointers.set(
      event.pointerId,
      event
    );
  }

  if (
    creatorPinching
  ) {
    updateCreatorPinch();
    return;
  }

  if (
    !dragging
  ) {
    return;
  }

  const dx =
    event.clientX -
    lastPointerX;

  const dy =
    event.clientY -
    lastPointerY;

  lastPointerX =
    event.clientX;

  lastPointerY =
    event.clientY;

  yaw -=
    dx *
    lookSensitivity;

  pitch -=
    dy *
    lookSensitivity;

  pitch =
    THREE.MathUtils.clamp(
      pitch,
      -Math.PI / 2,
      Math.PI / 2
    );

  updateCameraRotation();
}


function handlePointerUp(
  event
) {
  activeTouchPointers.delete(
    event.pointerId
  );

  if (
    creatorPinching
  ) {
    endCreatorPinch();
    return;
  }

  dragging = false;
}


/* =========================================================
   KEYBOARD INPUT
   ========================================================= */

function handleKeyDown(
  event
) {
  const key =
    event.key.toLowerCase();

  pressedKeys.add(
    key
  );

  refreshPressedControls();

  if (
    [
      " ",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright"
    ].includes(
      key
    )
  ) {
    event.preventDefault();
  }

  if (
    key === "1"
  ) {
    setSpeedMode(
      "chill"
    );
  }

  if (
    key === "2"
  ) {
    setSpeedMode(
      "superman"
    );
  }

  if (
    key === "3"
  ) {
    enterCreatorMode();
  }
}


function handleKeyUp(
  event
) {
  const key =
    event.key.toLowerCase();

  pressedKeys.delete(
    key
  );

  refreshPressedControls();
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

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
}


/* =========================================================
   THREE.JS INIT
   ========================================================= */

function initializeThree() {
  scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(
      0x000000
    );

  camera =
    new THREE.PerspectiveCamera(
      70,

      window.innerWidth /
        window.innerHeight,

      0.1,

      60_000_000
    );

  camera.position.set(
    0,
    0,
    EARTH_GAME_RADIUS *
      65
  );

  camera.rotation.order =
    "YXZ";

  camera.rotation.x =
    pitch;

  camera.rotation.y =
    yaw;

  renderer =
    new THREE.WebGLRenderer(
      {
        antialias:
          true,

        logarithmicDepthBuffer:
          true
      }
    );

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio,
      2
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
    1;

  gameElement.appendChild(
    renderer.domElement
  );

  solarSystemRoot =
    new THREE.Group();

  scene.add(
    solarSystemRoot
  );

  createSun();

  for (
    const data of
      planetData
  ) {
    createPlanet(
      data
    );
  }

  createMoon();

  createStars();

  window.addEventListener(
    "resize",
    handleResize
  );

  renderer.domElement.addEventListener(
    "pointerdown",
    handlePointerDown
  );

  renderer.domElement.addEventListener(
    "pointermove",
    handlePointerMove
  );

  renderer.domElement.addEventListener(
    "pointerup",
    handlePointerUp
  );

  renderer.domElement.addEventListener(
    "pointercancel",
    handlePointerUp
  );

  window.addEventListener(
    "keydown",
    handleKeyDown
  );

  window.addEventListener(
    "keyup",
    handleKeyUp
  );

  updateOrbits(
    0
  );

  updateVisualBodyScales();

  updateCameraRotation();

  updateOrbitVisibility();

  updateSpeedUI();

  loadingScreen.style.display =
    "none";
}


/* =========================================================
   STARS
   ========================================================= */

function createStars() {
  const starCount =
    5000;

  const positions =
    new Float32Array(
      starCount * 3
    );

  for (
    let i = 0;
    i < starCount;
    i += 1
  ) {
    const radius =
      THREE.MathUtils.randFloat(
        5_000,
        25_000
      );

    const theta =
      Math.random() *
      Math.PI *
      2;

    const phi =
      Math.acos(
        THREE.MathUtils.randFloat(
          -1,
          1
        )
      );

    positions[
      i * 3
    ] =
      radius *
      Math.sin(phi) *
      Math.cos(theta);

    positions[
      i * 3 + 1
    ] =
      radius *
      Math.cos(phi);

    positions[
      i * 3 + 2
    ] =
      radius *
      Math.sin(phi) *
      Math.sin(theta);
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

  const material =
    new THREE.PointsMaterial(
      {
        color:
          0xffffff,

        size:
          2,

        sizeAttenuation:
          false
      }
    );

  stars =
    new THREE.Points(
      geometry,
      material
    );

  scene.add(
    stars
  );
}


function updateStars() {
  if (
    !stars ||
    !camera
  ) {
    return;
  }

  stars.position.copy(
    camera.position
  );
}


/* =========================================================
   UI EVENTS
   ========================================================= */

function setupUI() {
  if (
    startButton
  ) {
    startButton.addEventListener(
      "click",
      () => {
        gameStarted =
          true;

        startScreen.style.display =
          "none";

        gameElement.style.display =
          "block";

        gameUI.style.display =
          "block";

        if (
          !scene
        ) {
          initializeThree();
        }

        clock.start();

        animate();
      }
    );
  }

  if (
    uiToggle
  ) {
    uiToggle.addEventListener(
      "click",
      () => {
        uiMenuVisible =
          !uiMenuVisible;

        gameUI.classList.toggle(
          "menu-open",
          uiMenuVisible
        );
      }
    );
  }

  if (
    northButton
  ) {
    northButton.addEventListener(
      "click",
      resetNorth
    );
  }

  const chillButton =
    $("speed-chill");

  const supermanButton =
    $("speed-superman");

  const creatorButton =
    $("speed-creator");

  if (
    chillButton
  ) {
    chillButton.addEventListener(
      "click",
      () =>
        setSpeedMode(
          "chill"
        )
    );
  }

  if (
    supermanButton
  ) {
    supermanButton.addEventListener(
      "click",
      () =>
        setSpeedMode(
          "superman"
        )
    );
  }

  if (
    creatorButton
  ) {
    creatorButton.addEventListener(
      "click",
      () =>
        enterCreatorMode()
    );
  }

  const labelsButton =
    $("toggle-labels");

  if (
    labelsButton
  ) {
    labelsButton.addEventListener(
      "click",
      () => {
        planetLabelsVisible =
          !planetLabelsVisible;
      }
    );
  }

  const orbitButton =
    $("toggle-orbits");

  if (
    orbitButton
  ) {
    orbitButton.addEventListener(
      "click",
      () => {
        orbitLinesVisible =
          !orbitLinesVisible;

        updateOrbitVisibility();
      }
    );
  }

  const distanceButton =
    $("toggle-distance");

  if (
    distanceButton
  ) {
    distanceButton.addEventListener(
      "click",
      () => {
        distanceVisible =
          !distanceVisible;
      }
    );
  }

  const cinematicButton =
    $("cinematic-button");

  if (
    cinematicButton
  ) {
    cinematicButton.addEventListener(
      "click",
      () => {
        cinematicMode =
          !cinematicMode;

        updateCinematicMode();
      }
    );
  }
}


/* =========================================================
   ERROR HANDLING
   ========================================================= */

window.addEventListener(
  "error",
  (event) => {
    if (
      !errorScreen ||
      !errorMessage
    ) {
      return;
    }

    errorMessage.textContent =
      event.error?.message ||
      event.message ||
      "Unknown error";

    errorScreen.style.display =
      "block";
  }
);


window.addEventListener(
  "unhandledrejection",
  (event) => {
    if (
      !errorScreen ||
      !errorMessage
    ) {
      return;
    }

    errorMessage.textContent =
      event.reason?.message ||
      String(
        event.reason
      );

    errorScreen.style.display =
      "block";
  }
);


/* =========================================================
   MAIN LOOP
   ========================================================= */

function animate() {
  requestAnimationFrame(
    animate
  );

  const deltaTime =
    Math.min(
      clock.getDelta(),
      0.1
    );

  updateOrbits(
    deltaTime
  );

  updateMovement(
    deltaTime
  );

  updateSunAndEnergy(
    deltaTime
  );

  /*
   * Render-only planet readability system.
   *
   * IMPORTANT:
   * This happens after physics/orbits/movement.
   * It does NOT alter physical radii or collision bodies.
   */

  updateVisualBodyScales();

  rebaseSolarSystemIfNeeded();

  updateStars();

  updateLabels();

  updateDistanceUI();

  renderer.render(
    scene,
    camera
  );
}


/* =========================================================
   STARTUP
   ========================================================= */

setupUI();

gameElement.style.display =
  "none";

gameUI.style.display =
  "none";

loadingScreen.style.display =
  "none";
