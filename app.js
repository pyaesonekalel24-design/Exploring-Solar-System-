import * as THREE from
  "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";


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
   THREE STATE
   ========================================================= */

let scene;
let camera;
let renderer;

let solarPlanets = [];

let moonPivot = null;

let stars = null;

let sun = null;
let sunFlameA = null;
let sunFlameB = null;
let sunSprite = null;

let gameStarted = false;

let helperUIVisible = true;

let currentSpeedMode =
  "chill";


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

const ENERGY_RECHARGE_RATE =
  18;


/* =========================================================
   SPEED SYSTEM
   =========================================================

   CHILL:
   old fastest speed.

   SUPERMAN:
   exactly 8x CHILL.
   Energy system applies ONLY here.

   CREATOR:
   normal chill movement,
   no energy,
   planet-label teleport.
   ========================================================= */

const CHILL_SPEED =
  8_000;

const speedModes = {
  chill: {
    multiplier: 1,
    drainRate: 0
  },

  superman: {
    multiplier: 8,
    drainRate: 4
  },

  creator: {
    multiplier: 1,
    drainRate: 0
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
  Physical objects that can block
  the Sun from the player.
*/
const sunOccluders =
  [];


/* =========================================================
   REAL SOLAR SYSTEM SCALE
   =========================================================

   THIS SCALE IS NOT BEING CHANGED.

   1 GAME UNIT = 1,000 KM

   Therefore:

   Earth radius   = 6.371
   Jupiter radius = 69.911
   Saturn radius  = 58.232
   Sun radius     = 696.340

   1 AU =
   149,597.8707 game units
   ========================================================= */

const KM_PER_AU =
  149_597_870.7;

const GAME_UNITS_PER_KM =
  0.001;

const GAME_UNITS_PER_AU =
  KM_PER_AU *
  GAME_UNITS_PER_KM;


/* =========================================================
   REAL ORBIT TIME
   =========================================================

   No accelerated planet motion.

   One real second =
   one real second of simulation.

   The planets therefore move at the same
   relative rates as their real orbital periods.
   ========================================================= */

const SECONDS_PER_DAY =
  86_400;

const SIMULATION_TIME_MULTIPLIER =
  1;


/* =========================================================
   PHYSICAL BODY RADII
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
   TEXTURE URLS
   ========================================================= */

const TEXTURES = {
  /*
    Three.js example Earth + Moon textures.
  */

  Earth:
    "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg",

  EarthNormal:
    "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg",

  EarthClouds:
    "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png",

  Moon:
    "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg",


  /*
    Solar System Scope maps hosted through Wikimedia Commons.
  */

  Mercury:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Solarsystemscope_texture_2k_mercury.jpg/1024px-Solarsystemscope_texture_2k_mercury.jpg",

  Venus:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Solarsystemscope_texture_2k_venus_surface.jpg/1024px-Solarsystemscope_texture_2k_venus_surface.jpg",

  Mars:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Solarsystemscope_texture_2k_mars.jpg/1024px-Solarsystemscope_texture_2k_mars.jpg",

  Jupiter:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Solarsystemscope_texture_2k_jupiter.jpg/1024px-Solarsystemscope_texture_2k_jupiter.jpg",

  Saturn:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Solarsystemscope_texture_2k_saturn.jpg/1024px-Solarsystemscope_texture_2k_saturn.jpg",

  Uranus:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Solarsystemscope_texture_2k_uranus.jpg/1024px-Solarsystemscope_texture_2k_uranus.jpg",

  Neptune:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Solarsystemscope_texture_2k_neptune.jpg/1024px-Solarsystemscope_texture_2k_neptune.jpg",

  Sun:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Solarsystemscope_texture_2k_sun.jpg/1024px-Solarsystemscope_texture_2k_sun.jpg"
};


const textureLoader =
  new THREE.TextureLoader();

textureLoader.setCrossOrigin(
  "anonymous"
);


/* =========================================================
   PLANET DATA
   ========================================================= */

const planetDataList = [

  {
    name: "Mercury",

    color: 0x96928c,

    orbitColor:
      0xa7a7a7,

    texture:
      TEXTURES.Mercury,

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

    orbitColor:
      0xcab98d,

    texture:
      TEXTURES.Venus,

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

    color: 0xffffff,

    orbitColor:
      0x63a9ff,

    texture:
      TEXTURES.Earth,

    normalTexture:
      TEXTURES.EarthNormal,

    cloudTexture:
      TEXTURES.EarthClouds,

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

    hasMoon:
      true
  },


  {
    name: "Mars",

    color: 0xffffff,

    orbitColor:
      0xe07860,

    texture:
      TEXTURES.Mars,

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

    color: 0xffffff,

    orbitColor:
      0xd1a477,

    texture:
      TEXTURES.Jupiter,

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

    color: 0xffffff,

    orbitColor:
      0xe0d2a6,

    texture:
      TEXTURES.Saturn,

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

    hasRings:
      true
  },


  {
    name: "Uranus",

    color: 0xffffff,

    orbitColor:
      0x91e8ed,

    texture:
      TEXTURES.Uranus,

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

    color: 0xffffff,

    orbitColor:
      0x7794ff,

    texture:
      TEXTURES.Neptune,

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

  loadingScreen.hidden =
    true;

  startScreen.hidden =
    true;

  gameUI.hidden =
    true;

  errorMessage.textContent =
    message;

  errorScreen.hidden =
    false;
}


/* =========================================================
   TEXTURE LOADER
   ========================================================= */

function loadTexture(
  url
) {
  const texture =
    textureLoader.load(
      url,
      (loadedTexture) => {

        loadedTexture.colorSpace =
          THREE.SRGBColorSpace;

        loadedTexture.anisotropy =
          renderer
            ? renderer.capabilities.getMaxAnisotropy()
            : 1;
      },

      undefined,

      () => {
        console.warn(
          "Texture failed to load:",
          url
        );
      }
    );

  texture.colorSpace =
    THREE.SRGBColorSpace;

  return texture;
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


  updateCreatorLabelMode();
}


function setSpeedMode(
  mode
) {

  if (
    !speedModes[mode]
  ) {
    return;
  }


  /*
    Only Superman can be blocked by energy.
  */

  if (
    energy <= 0 &&
    mode ===
      "superman"
  ) {
    mode =
      "chill";
  }


  currentSpeedMode =
    mode;


  updateSpeedButtons();
}


function updateCreatorLabelMode() {

  labelLayer.classList.toggle(
    "creator-enabled",
    helperUIVisible &&
      currentSpeedMode ===
        "creator"
  );
}


/* =========================================================
   ENERGY
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


function updateEnergy(
  deltaTime,
  isMoving
) {

  if (
    !gameStarted
  ) {
    return;
  }


  /*
    Energy system works ONLY in Superman.
  */

  if (
    currentSpeedMode !==
    "superman"
  ) {
    return;
  }


  if (
    isMoving
  ) {

    energy =
      Math.max(
        0,

        energy -
          speedModes.superman
            .drainRate *
          deltaTime
      );


    if (
      energy <= 0
    ) {

      energy =
        0;

      setSpeedMode(
        "chill"
      );

      updateEnergyDisplay();

      return;
    }
  }
}


/* =========================================================
   STARS
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
      )
        .normalize();


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
   SUN SPRITE
   =========================================================

   This is a 3D world object.

   It is NOT UI.

   It stays visible when UI is OFF.

   A planet can physically block it.
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


  sunSprite.position.copy(
    sunPosition
  );


  scene.add(
    sunSprite
  );
}


/* =========================================================
   ORBIT MATH
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


  return new THREE.LineLoop(

    geometry,

    new THREE.LineBasicMaterial({
      color,

      transparent:
        true,

      opacity:
        0.24,

      depthWrite:
        false
    })
  );
}


/* =========================================================
   SATURN DUST RINGS
   ========================================================= */

function createSaturnDustRings(
  planetRadius
) {

  const particleCount =
    5000;


  const positions =
    new Float32Array(
      particleCount * 3
    );


  const colors =
    new Float32Array(
      particleCount * 3
    );


  const colorChoices = [
    new THREE.Color(
      0xb8aa91
    ),

    new THREE.Color(
      0xd0c4aa
    ),

    new THREE.Color(
      0x8c8373
    ),

    new THREE.Color(
      0xe2d8c3
    )
  ];


  for (
    let i = 0;
    i < particleCount;
    i += 1
  ) {

    /*
      Ring extends roughly from
      1.3 Saturn radii to 2.35 Saturn radii.
    */

    let ringRadius =
      THREE.MathUtils.lerp(
        planetRadius * 1.28,
        planetRadius * 2.35,
        Math.random()
      );


    /*
      Add a visible Cassini-like gap.
    */

    if (
      ringRadius >
        planetRadius * 1.72 &&
      ringRadius <
        planetRadius * 1.84
    ) {

      ringRadius =
        Math.random() < 0.5

          ? THREE.MathUtils.lerp(
              planetRadius * 1.28,
              planetRadius * 1.70,
              Math.random()
            )

          : THREE.MathUtils.lerp(
              planetRadius * 1.86,
              planetRadius * 2.35,
              Math.random()
            );
    }


    const angle =
      Math.random() *
      Math.PI *
      2;


    const thickness =
      (
        Math.random() -
        0.5
      ) *
      planetRadius *
      0.018;


    positions[
      i * 3
    ] =
      Math.cos(angle) *
      ringRadius;


    positions[
      i * 3 + 1
    ] =
      thickness;


    positions[
      i * 3 + 2
    ] =
      Math.sin(angle) *
      ringRadius;


    const chosen =
      colorChoices[
        Math.floor(
          Math.random() *
            colorChoices.length
        )
      ];


    colors[
      i * 3
    ] =
      chosen.r;


    colors[
      i * 3 + 1
    ] =
      chosen.g;


    colors[
      i * 3 + 2
    ] =
      chosen.b;
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


  geometry.setAttribute(
    "color",

    new THREE.BufferAttribute(
      colors,
      3
    )
  );


  const material =
    new THREE.PointsMaterial({
      size:
        Math.max(
          0.08,
          planetRadius *
            0.003
        ),

      sizeAttenuation:
        true,

      vertexColors:
        true,

      transparent:
        true,

      opacity:
        0.82,

      depthWrite:
        false
    });


  return new THREE.Points(
    geometry,
    material
  );
}


/* =========================================================
   LABEL
   ========================================================= */

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


  label.textContent =
    name;


  label.dataset.planet =
    name;


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


  return label;
}


/* =========================================================
   CREATE PLANET
   ========================================================= */

function createPlanet(
  data
) {

  /*
    IMPORTANT:
    This section keeps the same astronomical
    scale as the previous working version.
  */

  const semiMajorAxis =
    data.semiMajorAxisAU *
    GAME_UNITS_PER_AU;


  const planetRadius =
    data.radiusKm *
    GAME_UNITS_PER_KM;


  /* =======================================================
     ORBIT HIERARCHY
     ======================================================= */

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


  /* =======================================================
     ORBIT LINE
     ======================================================= */

  const orbitLine =
    createOrbitLine(
      semiMajorAxis,
      data.eccentricity,
      data.orbitColor
    );


  periapsisGroup.add(
    orbitLine
  );


  /* =======================================================
     PLANET BODY
     ======================================================= */

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


  const planetTexture =
    loadTexture(
      data.texture
    );


  const materialOptions = {

    map:
      planetTexture,

    color:
      data.color,

    roughness:
      0.88,

    metalness:
      0
  };


  /*
    Earth gets actual surface normals.
  */

  if (
    data.normalTexture
  ) {

    materialOptions.normalMap =
      loadTexture(
        data.normalTexture
      );

    materialOptions.normalScale =
      new THREE.Vector2(
        0.35,
        0.35
      );
  }


  const planetMaterial =
    new THREE.MeshStandardMaterial(
      materialOptions
    );


  const planet =
    new THREE.Mesh(

      new THREE.SphereGeometry(
        planetRadius,
        40,
        24
      ),

      planetMaterial
    );


  axialTiltGroup.add(
    planet
  );


  /*
    Planet can physically block the Sun.
  */

  sunOccluders.push(
    planet
  );


  /* =======================================================
     EARTH CLOUDS
     ======================================================= */

  let clouds = null;


  if (
    data.cloudTexture
  ) {

    const cloudMaterial =
      new THREE.MeshStandardMaterial({
        map:
          loadTexture(
            data.cloudTexture
          ),

        transparent:
          true,

        opacity:
          0.42,

        depthWrite:
          false,

        roughness:
          1
      });


    clouds =
      new THREE.Mesh(

        new THREE.SphereGeometry(
          planetRadius *
            1.009,
          40,
          24
        ),

        cloudMaterial
      );


    axialTiltGroup.add(
      clouds
    );
  }


  /* =======================================================
     SATURN RINGS
     ======================================================= */

  let rings = null;


  if (
    data.hasRings
  ) {

    rings =
      createSaturnDustRings(
        planetRadius
      );


    axialTiltGroup.add(
      rings
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


    const moonMaterial =
      new THREE.MeshStandardMaterial({
        map:
          loadTexture(
            TEXTURES.Moon
          ),

        color:
          0xffffff,

        roughness:
          1,

        metalness:
          0
      });


    const moon =
      new THREE.Mesh(

        new THREE.SphereGeometry(
          MOON_RADIUS,
          28,
          18
        ),

        moonMaterial
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
      data.startMeanAnomalyDegrees
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
     REAL ORBITAL RATE
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
     REAL SPIN RATE
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


  const planetRecord = {

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

    clouds,

    rings,

    orbitLine,

    label:
      null,

    radius:
      planetRadius
  };


  planetRecord.label =
    createLabel(
      data.name,
      planetRecord
    );


  solarPlanets.push(
    planetRecord
  );
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


  camera.rotation.set(
    pitch,
    yaw,
    0
  );


  scene.add(
    camera
  );


  /* =======================================================
     LIGHTING
     ======================================================= */

  scene.add(

    new THREE.HemisphereLight(
      0x8ea6d4,
      0x111118,
      0.12
    )

  );


  /*
    Strong point light whose brightness
    naturally falls off with distance.
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
     SUN
     ======================================================= */

  const sunTexture =
    loadTexture(
      TEXTURES.Sun
    );


  const sunMaterial =
    new THREE.MeshBasicMaterial({
      map:
        sunTexture,

      color:
        0xffffff
    });


  sun =
    new THREE.Mesh(

      new THREE.SphereGeometry(
        SUN_RADIUS,
        64,
        40
      ),

      sunMaterial
    );


  sun.position.copy(
    sunPosition
  );


  scene.add(
    sun
  );


  /*
    Extra translucent fire shells.
  */

  sunFlameA =
    new THREE.Mesh(

      new THREE.SphereGeometry(
        SUN_RADIUS * 1.025,
        40,
        28
      ),

      new THREE.MeshBasicMaterial({
        map:
          sunTexture,

        color:
          0xffb53d,

        transparent:
          true,

        opacity:
          0.20,

        blending:
          THREE.AdditiveBlending,

        depthWrite:
          false
      })
    );


  scene.add(
    sunFlameA
  );


  sunFlameB =
    new THREE.Mesh(

      new THREE.SphereGeometry(
        SUN_RADIUS * 1.055,
        40,
        28
      ),

      new THREE.MeshBasicMaterial({
        map:
          sunTexture,

        color:
          0xff7620,

        transparent:
          true,

        opacity:
          0.11,

        blending:
          THREE.AdditiveBlending,

        depthWrite:
          false
      })
    );


  scene.add(
    sunFlameB
  );


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
     START NEAR EARTH
     ======================================================= */

  const earth =
    solarPlanets.find(
      (planet) =>
        planet.name ===
        "Earth"
    );


  if (
    earth
  ) {

    earth.planet.getWorldPosition(
      tempWorld
    );


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


  window.addEventListener(
    "resize",
    handleResize
  );


  setupControls();


  updateSpeedButtons();


  updateEnergyDisplay();


  setHelperVisibility(
    true
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
   CONTROL STATE
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


  /*
    Superman cannot move once its
    energy has completely run out.
  */

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


  const selectedSpeed =
    speedModes[
      currentSpeedMode
    ];


  const actualSpeed =
    CHILL_SPEED *
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


  /*
    A planet can block direct sight
    of the Sun.
  */

  raycaster.set(
    camera.position,
    tempToSun
  );


  const hits =
    raycaster
      .intersectObjects(
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
   SUN DISPLAY + RECHARGE
   ========================================================= */

function updateSunAndRecharge(
  deltaTime
) {

  const state =
    getSunVisibilityState();


  /*
    Distant Sun marker is a WORLD object.
    It is independent of helper UI.
  */

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
          ? 0.95
          : 0.32;

    } else {

      sunSprite.material.opacity =
        0;
    }
  }


  /*
    Energy recharge ONLY in Superman.

    Sun visible in camera:
    recharge.

    Sun outside camera:
    no recharge.
  */

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
   ORBIT UPDATE
   ========================================================= */

function updateOrbits(
  deltaTime
) {

  for (
    const planetData of
      solarPlanets
  ) {

    /*
      Real-time orbital motion.
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
      EXACT SAME ellipse used by
      the visible orbit line.
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
      Real-time body rotation.
    */

    planetData.planet.rotation.y +=
      planetData.spinSpeed *
      deltaTime;


    if (
      planetData.clouds
    ) {

      planetData.clouds.rotation.y +=
        planetData.spinSpeed *
        deltaTime *
        0.95;
    }
  }


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
   PLANET LABELS
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


  /*
    Use current direction from the Sun/scene
    so the player arrives outside the planet,
    not inside it.

    Around large gas giants this distance gives
    a proper "float beside the world" view.
  */

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
      planetData.radius * 3.5,
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


  /*
    Immediately point the camera
    toward the planet.
  */

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


/* =========================================================
   UI VISIBILITY
   ========================================================= */

function setHelperVisibility(
  visible
) {

  helperUIVisible =
    visible;


  /*
    Only helper / information UI disappears.

    3D objects do not get touched.
  */

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


  /*
    Orbit lines are helper UI.
  */

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


  updateCreatorLabelMode();
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
    Real-time planets.
  */

  updateOrbits(
    deltaTime
  );


  /*
    Player.
  */

  const isMoving =
    updateMovement(
      deltaTime
    );


  /*
    Superman energy drain.
  */

  updateEnergy(
    deltaTime,
    isMoving
  );


  /*
    Solar recharge.
  */

  updateSunAndRecharge(
    deltaTime
  );


  /*
    Fireball animation.
    Purely visual.
  */

  if (
    sun
  ) {

    sun.rotation.y +=
      0.018;

  }


  if (
    sunFlameA
  ) {

    sunFlameA.rotation.y -=
      0.011;

    sunFlameA.rotation.x +=
      0.003;

  }


  if (
    sunFlameB
  ) {

    sunFlameB.rotation.y +=
      0.007;

    sunFlameB.rotation.z +=
      0.002;

  }


  /*
    Labels.
  */

  updateLabels();


  /*
    Keep stars around player.
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
     TOUCH LOOK
     =======================================================

     Keep BOTH axes inverted:

     RIGHT -> LEFT
     LEFT  -> RIGHT

     UP   -> DOWN
     DOWN -> UP
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
