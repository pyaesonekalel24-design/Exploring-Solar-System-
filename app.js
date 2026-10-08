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
   VISUAL SIZE ASSIST
   =========================================================

   IMPORTANT:
   This system changes ONLY the rendered visual scale of
   individual bodies.

   It does NOT change:
   - orbital distance
   - physical radius used for collision
   - Moon orbit
   - Moon phase
   - lighting
   - teleport stand-off distance
   - astronomical calculations

   Each body independently checks its own distance from
   the camera.

   At or below 37,000 units:
     normal 1.0x visual size

   Above 37,000 units:
     smooth visual enlargement begins

   At 1,500,000 units and beyond:
     maximum 1.65x visual size
   ========================================================= */

const VISUAL_ASSIST_START_DISTANCE =
  37_000;

const VISUAL_ASSIST_MAX_DISTANCE =
  1_500_000;

const VISUAL_ASSIST_MAX_SCALE =
  1.65;


function getVisualAssistScale(
  distance
) {
  if (
    distance <=
    VISUAL_ASSIST_START_DISTANCE
  ) {
    return 1;
  }

  const clampedDistance =
    THREE.MathUtils.clamp(
      distance,

      VISUAL_ASSIST_START_DISTANCE,

      VISUAL_ASSIST_MAX_DISTANCE
    );

  const logStart =
    Math.log(
      VISUAL_ASSIST_START_DISTANCE
    );

  const logEnd =
    Math.log(
      VISUAL_ASSIST_MAX_DISTANCE
    );

  const logDistance =
    Math.log(
      clampedDistance
    );

  const normalizedDistance =
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

  /*
   * Smoothstep gives us a soft transition instead of a
   * noticeable size pop when crossing 37,000 units.
   */
  const smoothDistance =
    normalizedDistance *
    normalizedDistance *
    (
      3 -
      2 *
      normalizedDistance
    );

  return THREE.MathUtils.lerp(
    1,
    VISUAL_ASSIST_MAX_SCALE,
    smoothDistance
  );
}


function updateVisualAssistScale() {
  if (
    !camera
  ) {
    return;
  }

  /*
   * Every solar-system body gets evaluated independently.
   *
   * This means:
   *
   * 20,000 from Jupiter -> normal Jupiter
   * 50,000 from Jupiter -> enlarged Jupiter
   *
   * while another planet can have a completely different
   * visual scale at the exact same moment.
   */
  for (
    const planetData of
      solarPlanets
  ) {
    if (
      planetData.isSun ||
      !planetData.planet
    ) {
      continue;
    }

    planetData
      .planet
      .getWorldPosition(
        tempWorld
      );

    const distance =
      camera.position.distanceTo(
        tempWorld
      );

    const visualScale =
      getVisualAssistScale(
        distance
      );

    planetData
      .planet
      .scale
      .setScalar(
        visualScale
      );
  }

  /*
   * The Moon is not stored inside solarPlanets, so it gets
   * its own independent visual-assist check.
   */
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
      getVisualAssistScale(
        moonDistance
      );

    moonMesh
      .scale
      .setScalar(
        moonVisualScale
      );
  }
}


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
 * The browser's Date object is the host device clock.  We use UTC
 * internally so the same instant produces the same Solar System state
 * on every device, regardless of local timezone.
 */
const J2000_EPOCH_MS =
  Date.UTC(2000, 0, 1, 12, 0, 0);

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
 * This gives us a real astronomical phase timestamp rather than
 * guessing a 29.5-day cycle from a hard-coded game angle.
 */
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
  const T4 = T3 * T;

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
          Math.sin(eccentricAnomaly) -
        meanAnomaly
      ) /
      (
        1 -
        eccentricity *
          Math.cos(eccentricAnomaly)
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
      Math.cos(eccentricAnomaly) -
      MOON_ECCENTRICITY
    );

  const yOrbital =
    semiMajorAxis *
    Math.sqrt(
      1 -
      MOON_ECCENTRICITY *
      MOON_ECCENTRICITY
    ) *
    Math.sin(eccentricAnomaly);

  const xPerifocal =
    xOrbital * Math.cos(argumentOfPerigee) -
    yOrbital * Math.sin(argumentOfPerigee);

  const yPerifocal =
    xOrbital * Math.sin(argumentOfPerigee) +
    yOrbital * Math.cos(argumentOfPerigee);

  const cosNode =
    Math.cos(ascendingNode);

  const sinNode =
    Math.sin(ascendingNode);

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
    xPerifocal * cosNode -
    yPerifocal * sinNode *
    cosInclination;

  const rawY =
    yPerifocal *
    sinInclination;

  const rawZ =
    xPerifocal * sinNode +
    yPerifocal * cosNode *
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
        rawY / rawDistance,
        -1,
        1
      )
    );

  /*
   * The phase equation controls the Moon's longitude relative to
   * the Sun, while the orbital model supplies realistic distance
   * and a small 5.1°-class inclination above/below the ecliptic.
   */
  const targetLongitude =
    sunEclipticLongitude +
    phaseAngle;

  const distance =
    rawDistance *
    EARTH_GAME_RADIUS;

  return new THREE.Vector3(
    distance *
      Math.cos(rawLatitude) *
      Math.cos(targetLongitude),

    distance *
      Math.sin(rawLatitude),

    distance *
      Math.cos(rawLatitude) *
      Math.sin(targetLongitude)
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

  /*
   * Chill and Creator are intentionally instant and fixed.
   * This prevents Creator/Chill from inheriting a previous
   * Superman acceleration state.
   */
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
        color:
          0xffffff,

        size:
          900,

        sizeAttenuation:
          true,

        transparent:
          true,

        opacity:
          0.85,

        depthWrite:
          false
      })
    );

  scene.add(
    stars
  );
}


/* =========================================================
   DISTANT SUN SPRITE
   ========================================================= */

function createSunSprite() {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    64;

  canvas.height =
    64;

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
        map:
          texture,

        transparent:
          true,

        opacity:
          0,

        depthWrite:
          false,

        depthTest:
          true
      })
    );

  sunSprite.position.set(
    0,
    0,
    0
  );

  solarSystemRoot.add(
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
  const points =
    [];

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
    i <
    segments;
    i += 1
  ) {
    const angle =
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
              angle
            ) -
            eccentricity
          ),

        0,

        semiMinorAxis *
          Math.sin(
            angle
          )
      )
    );
  }

  const geometry =
    new THREE.BufferGeometry().setFromPoints(
      points
    );

  const material =
    new THREE.LineBasicMaterial({
      color:
        color,

      transparent:
        true,

      opacity:
        0.30
    });

  return new THREE.LineLoop(
    geometry,
    material
  );
}


/* =========================================================
   SATURN RING GEOMETRY
   ========================================================= */

function createSaturnRingGeometry(
  innerRadius,
  outerRadius,
  segments
) {
  const positions =
    [];

  const uvs =
    [];

  const indices =
    [];

  for (
    let i = 0;
    i <= segments;
    i += 1
  ) {
    const angle =
      (
        i /
        segments
      ) *
      Math.PI *
      2;

    const cos =
      Math.cos(
        angle
      );

    const sin =
      Math.sin(
        angle
      );

    positions.push(
      innerRadius *
        cos,
      0,
      innerRadius *
        sin,

      outerRadius *
        cos,
      0,
      outerRadius *
        sin
    );

    uvs.push(
      0,
      i / segments,

      1,
      i / segments
    );
  }

  for (
    let i = 0;
    i < segments;
    i += 1
  ) {
    const base =
      i * 2;

    indices.push(
      base,
      base + 1,
      base + 2,

      base + 1,
      base + 3,
      base + 2
    );
  }

  const geometry =
    new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      positions,
      3
    )
  );

  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      uvs,
      2
    )
  );

  geometry.setIndex(
    indices
  );

  geometry.computeVertexNormals();

  return geometry;
}


/* =========================================================
   LABELS
   ========================================================= */

function formatDistance(
  distance
) {
  if (
    distance >=
    GAME_UNITS_PER_AU
  ) {
    return (
      (
        distance /
        GAME_UNITS_PER_AU
      ).toFixed(2) +
      " AU"
    );
  }

  if (
    distance >=
    1_000
  ) {
    return (
      (
        distance /
        1_000
      ).toFixed(1) +
      "k"
    );
  }

  return (
    Math.round(
      distance
    ) +
    " u"
  );
}


function createLabel(
  name,
  planetData
) {
  const label =
    document.createElement(
      "div"
    );

  label.className =
    "planet-label";

  const nameElement =
    document.createElement(
      "span"
    );

  nameElement.className =
    "planet-label-name";

  nameElement.textContent =
    name;

  const distanceElement =
    document.createElement(
      "span"
    );

  distanceElement.className =
    "planet-label-distance";

  distanceElement.textContent =
    "";

  label.appendChild(
    nameElement
  );

  label.appendChild(
    distanceElement
  );

  label.addEventListener(
    "pointerdown",
    (event) => {
      if (
        currentSpeedMode !==
        "creator"
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    }
  );

  label.addEventListener(
    "click",
    (event) => {
      if (
        currentSpeedMode !==
        "creator"
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      teleportToPlanet(
        planetData
      );
    }
  );

  labelLayer.appendChild(
    label
  );

  planetData.labelDistance =
    distanceElement;

  return label;
}


/* =========================================================
   PLANET CREATION
   ========================================================= */

function createPlanet(data) {
  const semiMajorAxis =
    data.semiMajorAxisAU *
    GAME_UNITS_PER_AU *
    SOLAR_SYSTEM_SCALE;

  const planetRadius =
    data.radiusKm *
    GAME_UNITS_PER_KM *
    SOLAR_SYSTEM_SCALE;

  const ascendingNodeGroup =
    new THREE.Group();

  ascendingNodeGroup.rotation.y =
    THREE.MathUtils.degToRad(
      data.longitudeOfAscendingNodeDegrees
    );

  const inclinationGroup =
    new THREE.Group();

  inclinationGroup.rotation.x =
    THREE.MathUtils.degToRad(
      data.orbitalInclinationDegrees
    );

  const periapsisGroup =
    new THREE.Group();

  periapsisGroup.rotation.y =
    THREE.MathUtils.degToRad(
      data.argumentOfPeriapsisDegrees
    );

  ascendingNodeGroup.add(
    inclinationGroup
  );

  inclinationGroup.add(
    periapsisGroup
  );

  solarSystemRoot.add(
    ascendingNodeGroup
  );

  const orbitLine =
    createOrbitLine(
      semiMajorAxis,
      data.eccentricity,
      data.orbitColor
    );

  orbitLine.visible =
    orbitLinesVisible;

  periapsisGroup.add(
    orbitLine
  );

  const orbitalBodyGroup =
    new THREE.Group();

  periapsisGroup.add(
    orbitalBodyGroup
  );

  const axialTiltGroup =
    new THREE.Group();

  axialTiltGroup.rotation.z =
    THREE.MathUtils.degToRad(
      data.axialTiltDegrees
    );

  orbitalBodyGroup.add(
    axialTiltGroup
  );

  const heroPlanet =
    data.name === "Earth" ||
    data.name === "Jupiter" ||
    data.name === "Saturn";

  const sphereSegments =
    heroPlanet
      ? 48
      : 32;

  const sphereRings =
    heroPlanet
      ? 32
      : 20;

  const material =
    new THREE.MeshStandardMaterial({
      color:
        data.color,

      roughness:
        data.name === "Earth"
          ? 0.70
          : 0.90,

      metalness:
        0.02
    });

  const planet =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        planetRadius,
        sphereSegments,
        sphereRings
      ),
      material
    );

  axialTiltGroup.add(
    planet
  );

  sunOccluders.push(
    planet
  );


  /* =======================================================
     EARTH DETAIL
     ======================================================= */

  let cloudMesh =
    null;

  if (
    data.name ===
    "Earth"
  ) {
    loadTextureWithFallback(
      TEXTURE_URLS.earth,
      (texture) => {
        material.map =
          texture;

        material.color.set(
          0xffffff
        );

        material.roughness =
          0.72;

        material.needsUpdate =
          true;
      }
    );

    const cloudMaterial =
      new THREE.MeshStandardMaterial({
        color:
          0xffffff,

        transparent:
          true,

        opacity:
          0.48,

        depthWrite:
          false,

        roughness:
          1
      });

    cloudMesh =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          planetRadius *
            1.014,

          sphereSegments,
          sphereRings
        ),
        cloudMaterial
      );

    axialTiltGroup.add(
      cloudMesh
    );

    loadTextureWithFallback(
      TEXTURE_URLS.earthClouds,
      (texture) => {
        cloudMaterial.map =
          texture;

        cloudMaterial.needsUpdate =
          true;
      }
    );
  }


  /* =======================================================
     JUPITER DETAIL
     ======================================================= */

  if (
    data.name ===
    "Jupiter"
  ) {
    loadTextureWithFallback(
      TEXTURE_URLS.jupiter,
      (texture) => {
        material.map =
          texture;

        material.color.set(
          0xffffff
        );

        material.roughness =
          0.94;

        material.needsUpdate =
          true;
      }
    );
  }


  /* =======================================================
     SATURN DETAIL
     ======================================================= */

  if (
    data.name ===
    "Saturn"
  ) {
    loadTextureWithFallback(
      TEXTURE_URLS.saturn,
      (texture) => {
        material.map =
          texture;

        material.color.set(
          0xffffff
        );

        material.roughness =
          0.96;

        material.needsUpdate =
          true;
      }
    );
  }


  /* =======================================================
     SATURN RINGS
     ======================================================= */

  if (
    data.hasRings
  ) {
    const ringInnerRadius =
      planetRadius *
      1.12;

    const ringOuterRadius =
      planetRadius *
      2.32;

    const ringGeometry =
      createSaturnRingGeometry(
        ringInnerRadius,
        ringOuterRadius,
        256
      );

    const ringMaterial =
      new THREE.MeshStandardMaterial({
        color:
          0xd8c89f,

        side:
          THREE.DoubleSide,

        transparent:
          true,

        opacity:
          0.92,

        roughness:
          0.96,

        metalness:
          0,

        depthWrite:
          false
      });

    const rings =
      new THREE.Mesh(
        ringGeometry,
        ringMaterial
      );

    rings.rotation.x =
      Math.PI / 2;

    planet.add(
      rings
    );

    loadTextureWithFallback(
      TEXTURE_URLS.saturnRing,
      (texture) => {
        texture.wrapS =
          THREE.ClampToEdgeWrapping;

        texture.wrapT =
          THREE.RepeatWrapping;

        ringMaterial.alphaMap =
          texture;

        ringMaterial.needsUpdate =
          true;
      }
    );
  }


  /* =======================================================
     MOON
     ======================================================= */

  if (
    data.hasMoon
  ) {
    moonPivot =
      new THREE.Group();

    orbitalBodyGroup.add(
      moonPivot
    );

    moonMesh =
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

    moonMesh.position.set(
      MOON_ORBIT_RADIUS,
      0,
      0
    );

    moonPivot.add(
      moonMesh
    );

    sunOccluders.push(
      moonMesh
    );
  }


  /* =======================================================
     INITIAL ORBIT STATE
     ======================================================= */

  const startingMeanAnomaly =
    getPlanetMeanAnomalyAtDate(
      data,
      astronomicalDate
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

  const orbitalPeriodSeconds =
    data.orbitalPeriodDays *
    SECONDS_PER_DAY;

  const meanMotion =
    (
      Math.PI * 2 /
      orbitalPeriodSeconds
    ) *
    SIMULATION_TIME_MULTIPLIER;

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

  const elapsedSeconds =
    getAstronomicalDays(
      astronomicalDate
    ) *
    SECONDS_PER_DAY;

  planet.rotation.y =
    normalizeRadians(
      spinSpeed *
      elapsedSeconds
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

    label:
      null,

    labelDistance:
      null,

    radius:
      planetRadius
  };

  record.label =
    createLabel(
      data.name,
      record
    );

  solarPlanets.push(
    record
  );
}


/* =========================================================
   CREATE SOLAR SYSTEM
   ========================================================= */

function createSolarSystem() {
  updateAstronomicalClock();

  scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(
      0x050711
    );

  solarSystemRoot =
    new THREE.Group();

  solarSystemRoot.position.set(
    0,
    0,
    0
  );

  scene.add(
    solarSystemRoot
  );

  camera =
    new THREE.PerspectiveCamera(
      70,

      window.innerWidth /
        window.innerHeight,

      0.05,

      60_000_000
    );

  camera.rotation.order =
    "YXZ";

  camera.rotation.set(
    pitch,
    yaw,
    0
  );

  scene.add(
    camera
  );

  /*
   * Low ambient fill keeps the night side readable without
   * washing out the actual direction of sunlight.
   */
  scene.add(
    new THREE.HemisphereLight(
      0x8ea6d4,
      0x16111c,
      0.08
    )
  );

  /*
   * The Sun is the actual solar-system light source.
   *
   * The light lives inside solarSystemRoot so the floating
   * origin system moves it together with the Sun.
   */
  sunLight =
    new THREE.PointLight(
      0xffd69a,

      2.0e12,

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

  solarSystemRoot.add(
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

  createSunSprite();


  /* =======================================================
     SUN BODY RECORD
     The Sun uses the same label + Creator teleport system
     as every planet, while remaining physically stationary
     at the solar-system origin.
     ======================================================= */

  const sunRecord = {
    name:
      "Sun",

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
      null,

    planet:
      sunMesh,

    orbitLine:
      null,

    cloudMesh:
      null,

    label:
      null,

    labelDistance:
      null,

    radius:
      SUN_RADIUS,

    isSun:
      true
  };

  sunRecord.label =
    createLabel(
      "Sun",
      sunRecord
    );

  solarPlanets.push(
    sunRecord
  );

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
     INITIAL CAMERA
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

    camera.position.copy(
      tempWorld
    );

    camera.position.z +=
      140 *
      SOLAR_SYSTEM_SCALE;
  }

  updateSunWorldPosition();

  updateSpeedButtons();
  updateVisualToggleButtons();
  updateEnergyDisplay();

  window.addEventListener(
    "resize",
    () => {
      camera.aspect =
        window.innerWidth /
        window.innerHeight;

      camera.updateProjectionMatrix();

      renderer.setSize(
        window.innerWidth,
        window.innerHeight
      );
    }
  );
}


/* =========================================================
   SUN VISIBILITY
   ========================================================= */

function getSunVisibilityState() {
  tempToSun
    .subVectors(
      sunPosition,
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

      pixels:
        100
    };
  }

  tempToSun.normalize();

  raycaster.set(
    camera.position,
    tempToSun
  );

  const hits =
    raycaster.intersectObjects(
      sunOccluders,
      false
    );

  const visible =
    hits.length === 0;

  const sunWorldPosition =
    sunPosition;

  tempProjected
    .copy(
      sunWorldPosition
    )
    .project(
      camera
    );

  const visibleOnScreen =
    tempProjected.z > -1 &&
    tempProjected.z < 1 &&
    tempProjected.x > -1 &&
    tempProjected.x < 1 &&
    tempProjected.y > -1 &&
    tempProjected.y < 1;

  const pixels =
    visibleOnScreen
      ? (
          SUN_RADIUS /
          distance
        ) *
        window.innerHeight *
        0.5
      : 0;

  return {
    visible:
      visible &&
      visibleOnScreen,

    pixels
  };
}


/* =========================================================
   SUN + RECHARGE
   ========================================================= */

function updateSunAndEnergy(
  deltaTime
) {
  const state =
    getSunVisibilityState();

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

      const minimumPixels =
        2.5;

      const targetPixels =
        Math.max(
          minimumPixels,
          Math.min(
            180,
            (
              SUN_RADIUS /
              distance
            ) *
            window.innerHeight *
            0.72
          )
        );

      sunSprite.scale.set(
        targetPixels,
        targetPixels,
        1
      );

      sunSprite.material.opacity =
        state.pixels <
        minimumPixels
          ? 0.95
          : 0.32;
    } else {
      sunSprite.material.opacity =
        0;
    }
  }

  if (
    currentSpeedMode ===
      "superman" &&
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
    !isMoving ||
    currentSpeedMode !==
      "superman"
  ) {
    return;
  }

  energy =
    Math.max(
      0,

      energy -
        speedModes.superman
          .drainRate *
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
   MOVEMENT
   ========================================================= */

function isControlPressed(
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

  for (
    const key of
      keys
  ) {
    if (
      pressedControls.has(
        controlName
      ) ||
      pressedKeys.has(
        key
      )
    ) {
      return true;
    }
  }

  return false;
}


function getCollisionBodies() {
  const bodies = [];

  for (
    const planetData of
      solarPlanets
  ) {
    if (
      !planetData.planet ||
      !planetData.radius
    ) {
      continue;
    }

    bodies.push({
      mesh:
        planetData.planet,

      radius:
        planetData.radius
    });
  }

  if (
    moonMesh
  ) {
    bodies.push({
      mesh:
        moonMesh,

      radius:
        MOON_RADIUS
    });
  }

  return bodies;
}


function resolveBodyCollisions(
  previousPosition,
  proposedPosition
) {
  const bodies =
    getCollisionBodies();

  collisionStart.copy(
    previousPosition
  );

  collisionDelta
    .subVectors(
      proposedPosition,
      previousPosition
    );

  const movementLengthSq =
    collisionDelta.lengthSq();

  if (
    movementLengthSq <
    0.000001
  ) {
    return;
  }

  for (
    const body of bodies
  ) {
    body.mesh.getWorldPosition(
      collisionCenter
    );

    /*
     * IMPORTANT:
     * Collision continues to use the original physical radius.
     * The visual-assist scale never enters this calculation.
     */
    const radius =
      body.radius +
      COLLISION_MARGIN;

    const startOffset =
      new THREE.Vector3()
        .subVectors(
          collisionStart,
          collisionCenter
        );

    const startDistance =
      startOffset.length();

    if (
      startDistance < radius
    ) {
      collisionPush
        .copy(startOffset)
        .normalize();

      if (
        collisionPush.lengthSq() <
        0.000001
      ) {
        collisionPush.set(
          0,
          0,
          1
        );
      }

      proposedPosition
        .copy(collisionCenter)
        .addScaledVector(
          collisionPush,
          radius
        );

      continue;
    }

    const toCenter =
      new THREE.Vector3()
        .subVectors(
          collisionCenter,
          collisionStart
        );

    const t =
      THREE.MathUtils.clamp(
        toCenter.dot(collisionDelta) /
        movementLengthSq,
        0,
        1
      );

    collisionClosest
      .copy(collisionStart)
      .addScaledVector(
        collisionDelta,
        t
      );

    const closestDistance =
      collisionClosest.distanceTo(
        collisionCenter
      );

    if (
      closestDistance >
      radius
    ) {
      continue;
    }

    collisionPush
      .subVectors(
        collisionClosest,
        collisionCenter
      );

    if (
      collisionPush.lengthSq() <
      0.000001
    ) {
      collisionPush
        .copy(
          collisionStart
        )
        .sub(
          collisionCenter
        );
    }

    collisionPush.normalize();

    const safeT =
      Math.max(
        0,
        t -
          radius /
          Math.sqrt(
            movementLengthSq
          )
      );

    proposedPosition
      .copy(collisionStart)
      .addScaledVector(
        collisionDelta,
        safeT
      );

    proposedPosition
      .sub(
        collisionCenter
      )
      .normalize()
      .multiplyScalar(
        radius
      )
      .add(
        collisionCenter
      );
  }
}


function updateMovement(
  deltaTime
) {
  updateMovementSpeed(
    deltaTime
  );

  if (
    !gameStarted
  ) {
    return false;
  }

  tempDirection.set(
    0,
    0,
    0
  );

  camera.getWorldDirection(
    tempDirection
  );

  tempRight.crossVectors(
    tempDirection,
    worldUp
  ).normalize();

  const movingForward =
    isControlPressed(
      "forward"
    );

  const movingBack =
    isControlPressed(
      "back"
    );

  const movingLeft =
    isControlPressed(
      "left"
    );

  const movingRight =
    isControlPressed(
      "right"
    );

  const movingUp =
    isControlPressed(
      "up"
    );

  const movingDown =
    isControlPressed(
      "down"
    );

  if (
    !movingForward &&
    !movingBack &&
    !movingLeft &&
    !movingRight &&
    !movingUp &&
    !movingDown
  ) {
    return false;
  }

  const previousPosition =
    camera.position.clone();

  const proposedPosition =
    camera.position.clone();

  if (
    movingForward
  ) {
    proposedPosition.addScaledVector(
      tempDirection,
      currentMovementSpeed *
        deltaTime
    );
  }

  if (
    movingBack
  ) {
    proposedPosition.addScaledVector(
      tempDirection,
      -currentMovementSpeed *
        deltaTime
    );
  }

  if (
    movingRight
  ) {
    proposedPosition.addScaledVector(
      tempRight,
      currentMovementSpeed *
        deltaTime
    );
  }

  if (
    movingLeft
  ) {
    proposedPosition.addScaledVector(
      tempRight,
      -currentMovementSpeed *
        deltaTime
    );
  }

  if (
    movingUp
  ) {
    proposedPosition.addScaledVector(
      worldUp,
      currentMovementSpeed *
        deltaTime
    );
  }

  if (
    movingDown
  ) {
    proposedPosition.addScaledVector(
      worldUp,
      -currentMovementSpeed *
        deltaTime
    );
  }

  resolveBodyCollisions(
    previousPosition,
    proposedPosition
  );

  camera.position.copy(
    proposedPosition
  );

  return true;
}


/* =========================================================
   REAL-TIME ORBITS
   ========================================================= */

function updateOrbits(
  deltaTime
) {
  const daysSinceJ2000 =
    updateAstronomicalClock();

  for (
    const planetData of
      solarPlanets
  ) {
    if (
      planetData.isSun
    ) {
      continue;
    }

    /*
     * Planetary orbital state is tied to the host clock.
     * The existing startMeanAnomaly values are the J2000
     * reference states, so the same Kepler model now advances
     * from the actual device date instead of from page load.
     */
    planetData.meanAnomaly =
      getPlanetMeanAnomalyAtDate(
        planetData.sourceData,
        astronomicalDate
      );

    const eccentricAnomaly =
      solveEccentricAnomaly(
        planetData.meanAnomaly,
        planetData.eccentricity
      );

    planetData
      .orbitalBodyGroup
      .position.copy(
        getEllipsePosition(
          planetData.semiMajorAxis,
          planetData.eccentricity,
          eccentricAnomaly
        )
      );

    const elapsedSeconds =
      daysSinceJ2000 *
      SECONDS_PER_DAY;

    planetData.planet.rotation.y =
      normalizeRadians(
        planetData.spinSpeed *
        elapsedSeconds
      );

    if (
      planetData.cloudMesh
    ) {
      planetData.cloudMesh.rotation.y =
        normalizeRadians(
          planetData.spinSpeed *
          0.94 *
          elapsedSeconds
        );
    }
  }

  if (
    moonPivot &&
    moonMesh
  ) {
    const phaseState =
      getLunarPhaseState(
        astronomicalDate
      );

    moonPhaseAngle =
      phaseState.phaseAngle;

    moonIlluminationFraction =
      phaseState.illuminationFraction;

    /*
     * Recover the Sun's geocentric ecliptic longitude from the
     * already-date-synchronized Earth orbit.  Our game maps the
     * ecliptic +Z axis to game -Z.
     */
    const earthRecord =
      solarPlanets.find(
        (planetData) =>
          planetData.name ===
          "Earth"
      );

    let sunEclipticLongitude =
      0;

    if (
      earthRecord
    ) {
      earthRecord
        .orbitalBodyGroup
        .getWorldPosition(
          collisionCenter
        );

      const sunFromEarthX =
        -collisionCenter.x;

      const sunFromEarthZ =
        -collisionCenter.z;

      sunEclipticLongitude =
        Math.atan2(
          -sunFromEarthZ,
          sunFromEarthX
        );
    }

    moonOrbitalPosition.copy(
      getMoonEclipticPosition(
        daysSinceJ2000,
        moonPhaseAngle,
        sunEclipticLongitude
      )
    );

    moonMesh.position.set(
      moonOrbitalPosition.x,
      moonOrbitalPosition.y,
      -moonOrbitalPosition.z
    );

    const moonWorldPosition =
      moonMesh.getWorldPosition(
        tempWorld
      );

    /*
     * Approximate tidal locking so the near side remains aimed
     * generally toward Earth as the Moon travels around it.
     */
    moonMesh.rotation.y =
      Math.atan2(
        -moonMesh.position.x,
        -moonMesh.position.z
      );

    moonSunDirection
      .subVectors(
        sunPosition,
        moonWorldPosition
      )
      .normalize();

    const earthWorldPosition =
      moonPivot.parent
        ? moonPivot.parent.getWorldPosition(
            collisionCenter
          )
        : collisionCenter.set(
            0,
            0,
            0
          );

    const moonToEarth =
      new THREE.Vector3()
        .subVectors(
          earthWorldPosition,
          moonWorldPosition
        )
        .normalize();

    /*
     * Physical illumination check from the actual three-body
     * geometry.  The visible renderer is still produced by the
     * Sun's PointLight hitting the Moon's StandardMaterial.
     */
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
      (1 -
        Math.cos(
          physicalPhaseAngle
        )) *
      0.5;
  }
}


/* =========================================================
   CREATOR TELEPORT
   ========================================================= */

function teleportToPlanet(
  planetData
) {
  if (
    currentSpeedMode !==
    "creator"
  ) {
    return;
  }

  planetData
    .planet
    .getWorldPosition(
      tempWorld
    );

  const away =
    new THREE.Vector3()
      .subVectors(
        camera.position,
        tempWorld
      );

  if (
    away.lengthSq() <
    0.001
  ) {
    away.set(
      0,
      1,
      0
    );
  } else {
    away.normalize();
  }

  const standOff =
    Math.max(
      planetData.radius *
        3.5,

      30
    );

  camera.position
    .copy(
      tempWorld
    )
    .addScaledVector(
      away,
      standOff
    );

  tempDirection
    .subVectors(
      tempWorld,
      camera.position
    )
    .normalize();

  yaw =
    Math.atan2(
      -tempDirection.x,
      -tempDirection.z
    );

  pitch =
    Math.asin(
      THREE.MathUtils.clamp(
        tempDirection.y,
        -1,
        1
      )
    );

  pitch =
    THREE.MathUtils.clamp(
      pitch,
      -Math.PI / 2 + 0.05,
      Math.PI / 2 - 0.05
    );

  camera.rotation.set(
    pitch,
    yaw,
    0
  );

  rebaseSolarSystemIfNeeded();
}


/* =========================================================
   LABEL UPDATE
   ========================================================= */

function updateLabels() {
  for (
    const planetData of
      solarPlanets
  ) {
    if (
      !planetLabelsVisible ||
      cinematicMode
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

    const distanceFromCamera =
      camera.position.distanceTo(
        tempWorld
      );

    if (
      planetData.labelDistance
    ) {
      planetData.labelDistance.textContent =
        formatDistance(
          distanceFromCamera
        );

      planetData.labelDistance.style.display =
        distanceVisible
          ? ""
          : "none";
    }

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

  /*
   * Visual size assist happens AFTER movement/origin rebasing
   * so each body's distance is calculated from its current,
   * correct world position.
   *
   * This changes only planet/Moon rendering scale.
   */
  updateVisualAssistScale();

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


setupControls();

animate();
