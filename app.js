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
const labelLayer = $("planet-label-layer");

let scene;
let camera;
let renderer;
let solarPlanets = [];
let moonPivot = null;
let stars = null;
let speedStreaks = null;
let speedStreakMaterial = null;
let sunSprite = null;

let gameStarted = false;
let helperUIVisible = true;

let yaw = 0;
let pitch = -0.08;
let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

let energy = 100;
let currentSpeedMode = "chill";

const clock = new THREE.Clock();

const pressedControls = new Set();
const pressedKeys = new Set();

const sunPosition = new THREE.Vector3(0, 0, 0);
const scratchDirection = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchWorld = new THREE.Vector3();
const scratchProjected = new THREE.Vector3();
const scratchToSun = new THREE.Vector3();

const raycaster = new THREE.Raycaster();
const sunOccluders = [];

const lookSensitivity = 0.0035;

/*
  ============================================================
  REALISTIC SOLAR SYSTEM SCALE
  ============================================================

  1 AU = 149,597,870.7 km.

  The game uses one consistent linear scale for BOTH:
    - orbital distances
    - physical body sizes

  This is deliberately much larger than the previous version so
  planets are no longer tiny dots when you approach them.

  At this scale:
    Earth radius  ≈ 4.26 game units
    Jupiter radius ≈ 46.7 game units
    Saturn radius  ≈ 38.9 game units
    Sun radius     ≈ 465 game units

  The ratios remain physically proportional.
*/

const KM_PER_AU = 149_597_870.7;
const GAME_UNITS_PER_AU = 100_000;

const GAME_UNITS_PER_KM =
  GAME_UNITS_PER_AU / KM_PER_AU;

/*
  Simulation time:
  1 simulated Earth day passes every real second.

  This means:
  Earth year  ≈ 365 real seconds
  Jupiter year ≈ 71.1 minutes
  Saturn year ≈ 3.0 hours? No:
  10759.22 seconds at this scale is about 179.3 minutes.

  Relative orbital rates are still based directly on their
  real-world orbital periods.
*/
const SIMULATION_DAYS_PER_SECOND = 1;

/*
  Planet rotation is intentionally much slower than the orbital
  animation, while still preserving real relative spin ratios.
*/
const VISUAL_SPIN_DAYS_PER_SECOND = 0.05;

/*
  CHILL is deliberately slow so the player can approach a planet
  and move around it without blasting past it.

  SONIC and POOP are the actual long-distance travel modes.
*/
const movementSpeed = 18;

const ENERGY_RECHARGE_RATE = 18;

const speedModes = {
  chill: {
    multiplier: 1,
    drainRate: 0
  },

  sonic: {
    multiplier: 60,
    drainRate: 4
  },

  poop: {
    multiplier: 300,
    drainRate: 12
  }
};

const controlKeys = {
  forward: ["w", "arrowup"],
  back: ["s", "arrowdown"],
  left: ["a", "arrowleft"],
  right: ["d", "arrowright"],
  up: [" ", "space"],
  down: ["shift", "control"]
};

const EARTH_RADIUS_KM = 6371;
const SUN_RADIUS_KM = 696_340;

const EARTH_GAME_RADIUS =
  EARTH_RADIUS_KM *
  GAME_UNITS_PER_KM;

const SUN_RADIUS =
  SUN_RADIUS_KM *
  GAME_UNITS_PER_KM;

const MOON_RADIUS =
  1737.4 *
  GAME_UNITS_PER_KM;

const MOON_ORBIT_RADIUS =
  384_400 *
  GAME_UNITS_PER_KM;

const MOON_ORBIT_PERIOD_DAYS = 27.322;

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

    semiMajorAxisAU: 9.5388,
    eccentricity: 0.0565,
    orbitalPeriodDays: 10759.22,

    radiusKm: 58232,
    rotationPeriodHours: 10.656,
    axialTiltDegrees: 26.73,

    orbitalInclinationDegrees: 2.485,
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

function showError(message) {
  loadingScreen.hidden = true;
  startScreen.hidden = true;
  gameUI.hidden = true;

  errorMessage.textContent =
    message;

  errorScreen.hidden = false;
}

function updateSpeedButtons() {
  document
    .querySelectorAll("[data-speed]")
    .forEach((button) => {
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
    });
}

function setSpeedMode(mode) {
  if (!speedModes[mode]) {
    return;
  }

  if (
    energy <= 0 &&
    mode !== "chill"
  ) {
    mode = "chill";
  }

  currentSpeedMode = mode;

  updateSpeedButtons();
}

function updateEnergyDisplay() {
  const displayedEnergy =
    Math.round(energy);

  $("energy-fill").style.width =
    `${energy}%`;

  $("energy-percent").textContent =
    `${displayedEnergy}%`;

  $("energy-bar").setAttribute(
    "aria-valuenow",
    String(displayedEnergy)
  );

  if (energy <= 25) {
    $("energy-fill").style.backgroundColor =
      "#ff665f";
  } else if (energy <= 55) {
    $("energy-fill").style.backgroundColor =
      "#ffd15c";
  } else {
    $("energy-fill").style.backgroundColor =
      "#65e68a";
  }
}

function createStarField() {
  const starCount = 2600;

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
      Math.random() * 5_000_000;

    positions[i * 3] =
      direction.x * distance;

    positions[i * 3 + 1] =
      direction.y * distance;

    positions[i * 3 + 2] =
      direction.z * distance;
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
        size: 1200,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.86,
        depthWrite: false
      })
    );

  scene.add(stars);
}

function createSunSprite() {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = 64;
  canvas.height = 64;

  const ctx =
    canvas.getContext("2d");

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
    0.2,
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

  /*
    This is a WORLD object, not UI.

    depthTest = true means a planet can actually
    pass in front of the Sun and visually block it.
  */
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

function createSpeedStreaks() {
  const count = 110;

  const positions =
    new Float32Array(
      count * 2 * 3
    );

  for (
    let i = 0;
    i < count;
    i += 1
  ) {
    const x =
      (
        Math.random() - 0.5
      ) * 12;

    const y =
      (
        Math.random() - 0.5
      ) * 8;

    const z =
      -6 -
      Math.random() * 32;

    const base =
      i * 6;

    positions[base] =
      x;

    positions[base + 1] =
      y;

    positions[base + 2] =
      z;

    positions[base + 3] =
      x;

    positions[base + 4] =
      y;

    positions[base + 5] =
      z - 4;
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

  speedStreakMaterial =
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false
    });

  speedStreaks =
    new THREE.LineSegments(
      geometry,
      speedStreakMaterial
    );

  speedStreaks.frustumCulled =
    false;

  camera.add(
    speedStreaks
  );
}

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

function createOrbitLine(
  semiMajorAxis,
  eccentricity,
  color
) {
  const points = [];

  const segments = 360;

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
      opacity: 0.26,
      depthWrite: false
    });

  return new THREE.LineLoop(
    geometry,
    material
  );
}

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

function createPlanet(data) {
  const semiMajorAxis =
    data.semiMajorAxisAU *
    GAME_UNITS_PER_AU;

  const planetRadius =
    data.radiusKm *
    GAME_UNITS_PER_KM;

  /*
    The orbital line and actual planet body
    share the same orbital transform.

    That means the body can NEVER drift away
    from its own orbit line.
  */

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

  scene.add(
    ascendingNodeGroup
  );

  const orbitLine =
    createOrbitLine(
      semiMajorAxis,
      data.eccentricity,
      data.orbitColor
    );

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

  const planet =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        planetRadius,
        32,
        20
      ),
      new THREE.MeshStandardMaterial({
        color: data.color,
        roughness: 0.9,
        metalness: 0
      })
    );

  axialTiltGroup.add(
    planet
  );

  sunOccluders.push(
    planet
  );

  if (data.hasRings) {
    const rings =
      new THREE.Mesh(
        new THREE.RingGeometry(
          planetRadius * 1.35,
          planetRadius * 2.35,
          128
        ),
        new THREE.MeshStandardMaterial({
          color: 0xc9b98e,
          side: THREE.DoubleSide,
          roughness: 0.95
        })
      );

    /*
      Saturn rings are attached to Saturn,
      so they stay correctly centered.
    */

    rings.rotation.x =
      Math.PI / 2.25;

    planet.add(
      rings
    );
  }

  if (data.hasMoon) {
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
          color: 0xbfc4cf,
          roughness: 1
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

  const meanMotion =
    (
      Math.PI * 2 /
      data.orbitalPeriodDays
    ) *
    SIMULATION_DAYS_PER_SECOND;

  const spinSpeed =
    (
      Math.PI * 2 /
      Math.abs(
        data.rotationPeriodHours /
        24
      )
    ) *
    VISUAL_SPIN_DAYS_PER_SECOND *
    (
      Math.sign(
        data.rotationPeriodHours
      ) || 1
    );

  solarPlanets.push({
    name: data.name,

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

function createSolarSystem() {
  scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(
      0x050711
    );

  camera =
    new THREE.PerspectiveCamera(
      70,

      window.innerWidth /
      window.innerHeight,

      0.01,

      20_000_000
    );

  /*
    Start around Earth's orbital distance
    and look back toward the Sun.
  */

  camera.position.set(
    0,

    EARTH_GAME_RADIUS * 25,

    GAME_UNITS_PER_AU
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
    Very subtle ambient fill.

    Most visible planet lighting comes from
    the giant Sun light.
  */

  scene.add(
    new THREE.HemisphereLight(
      0x8ea6d4,
      0x111118,
      0.22
    )
  );

  /*
    Large physical scale requires a much stronger
    point light than the previous compressed version.

    decay = 2 keeps the lighting falloff tied to distance.
  */

  const sunLight =
    new THREE.PointLight(
      0xffd69a,
      1.2e12,
      0,
      2
    );

  sunLight.position.copy(
    sunPosition
  );

  scene.add(
    sunLight
  );

  /*
    The physical Sun.

    This is a real 3D object and is NEVER hidden
    by the UI toggle.
  */

  const sun =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        SUN_RADIUS,
        48,
        32
      ),
      new THREE.MeshBasicMaterial({
        color: 0xffa928
      })
    );

  sun.position.copy(
    sunPosition
  );

  scene.add(
    sun
  );

  /*
    Small glow around the physical Sun.
  */

  const glow =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        SUN_RADIUS * 1.15,
        32,
        24
      ),
      new THREE.MeshBasicMaterial({
        color: 0xff9a27,
        transparent: true,
        opacity: 0.11,
        side: THREE.BackSide,
        depthWrite: false
      })
    );

  scene.add(
    glow
  );

  /*
    Distant Sun marker.

    This is a WORLD sprite, not UI.
    It stays when UI is turned off.
  */

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
      antialias: true,
      alpha: false
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
    1.1;

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

  createSpeedStreaks();

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

function isControlPressed(name) {
  if (
    pressedControls.has(name)
  ) {
    return true;
  }

  return controlKeys[name].some(
    (key) =>
      pressedKeys.has(key)
  );
}

function updateMovement(deltaTime) {
  if (!gameStarted) {
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
      scratchDirection
    );

    movement.addScaledVector(
      scratchDirection,
      forwardAmount
    );
  }

  if (
    rightAmount !== 0
  ) {
    camera.getWorldDirection(
      scratchDirection
    );

    scratchRight
      .crossVectors(
        scratchDirection,
        new THREE.Vector3(
          0,
          1,
          0
        )
      )
      .normalize();

    movement.addScaledVector(
      scratchRight,
      rightAmount
    );
  }

  movement.y +=
    verticalAmount;

  if (
    movement.lengthSq() === 0
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

function getSunScreenState() {
  scratchProjected
    .copy(
      sunPosition
    )
    .project(
      camera
    );

  const insideFrustum =
    scratchProjected.x >= -1 &&
    scratchProjected.x <= 1 &&
    scratchProjected.y >= -1 &&
    scratchProjected.y <= 1 &&
    scratchProjected.z >= -1 &&
    scratchProjected.z <= 1;

  if (!insideFrustum) {
    return {
      visible: false,
      screenX: 0,
      screenY: 0,
      pixels: 0
    };
  }

  scratchToSun
    .copy(
      sunPosition
    )
    .sub(
      camera.position
    );

  const distance =
    scratchToSun.length();

  if (
    distance <= 0.001
  ) {
    return {
      visible: true,

      screenX:
        (
          scratchProjected.x *
          0.5 +
          0.5
        ) *
        window.innerWidth,

      screenY:
        (
          -scratchProjected.y *
          0.5 +
          0.5
        ) *
        window.innerHeight,

      pixels:
        window.innerHeight
    };
  }

  scratchToSun.normalize();

  raycaster.set(
    camera.position,
    scratchToSun
  );

  /*
    This is important:

    If you fly behind Jupiter/Saturn/etc.,
    that planet can physically block the Sun.

    So the charging mechanic and the actual
    visual experience agree with each other.
  */

  const blocked =
    raycaster
      .intersectObjects(
        sunOccluders,
        false
      )
      .some(
        (hit) =>
          hit.distance <
          distance
      );

  return {
    visible:
      !blocked,

    screenX:
      (
        scratchProjected.x *
        0.5 +
        0.5
      ) *
      window.innerWidth,

    screenY:
      (
        -scratchProjected.y *
        0.5 +
        0.5
      ) *
      window.innerHeight,

    pixels:
      2 *
      Math.atan(
        SUN_RADIUS /
        Math.max(
          distance,
          SUN_RADIUS
        )
      ) *
      (
        window.innerHeight /
        THREE.MathUtils.degToRad(
          camera.fov
        )
      )
  };
}

function updateSunVisibilityAndRecharge(
  deltaTime
) {
  const state =
    getSunScreenState();

  /*
    The distant Sun sprite is not UI.

    It stays visible even when UI is OFF.
  */

  if (sunSprite) {
    const minimumVisiblePixels =
      3;

    if (state.visible) {
      const targetPixels =
        Math.max(
          minimumVisiblePixels,
          state.pixels
        );

      const distance =
        camera.position.distanceTo(
          sunPosition
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
        0.96;
    } else {
      sunSprite.material.opacity =
        0;
    }
  }

  /*
    Sun-in-view = solar recharge.

    This has NOTHING to do with the UI state.
    UI OFF does not disable recharge.
  */

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
    selectedSpeed.drainRate <= 0
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

function updateOrbits(
  deltaTime
) {
  for (
    const planetData of
    solarPlanets
  ) {
    /*
      Real orbital period -> real relative mean motion.

      No individual fake planet animation rates.
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
      Move the planet BODY along the same
      mathematical ellipse used by the orbit line.
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

    planetData.planet.rotation.y +=
      planetData.spinSpeed *
      deltaTime;
  }

  if (
    moonPivot
  ) {
    moonPivot.rotation.y +=
      (
        Math.PI * 2 /
        MOON_ORBIT_PERIOD_DAYS
      ) *
      SIMULATION_DAYS_PER_SECOND *
      deltaTime;
  }
}

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
        scratchWorld
      );

    scratchProjected
      .copy(
        scratchWorld
      )
      .project(
        camera
      );

    const visible =
      scratchProjected.z > -1 &&
      scratchProjected.z < 1 &&
      scratchProjected.x > -1.1 &&
      scratchProjected.x < 1.1 &&
      scratchProjected.y > -1.1 &&
      scratchProjected.y < 1.1;

    if (!visible) {
      planetData.label.style.opacity =
        "0";

      continue;
    }

    planetData.label.style.left =
      `${
        (
          scratchProjected.x *
          0.5 +
          0.5
        ) *
        window.innerWidth
      }px`;

    planetData.label.style.top =
      `${
        (
          -scratchProjected.y *
          0.5 +
          0.5
        ) *
        window.innerHeight
      }px`;

    planetData.label.style.opacity =
      "1";
  }
}

function updateSpeedEffect(
  isMoving
) {
  if (
    !speedStreakMaterial
  ) {
    return;
  }

  /*
    Purely visual.

    CHILL  = clean
    SONIC  = subtle
    POOP   = strong
  */

  const targetOpacity =
    !isMoving ||
    currentSpeedMode ===
      "chill"

      ? 0

      : currentSpeedMode ===
          "poop"

        ? 0.72

        : 0.34;

  speedStreakMaterial.opacity =
    THREE.MathUtils.lerp(
      speedStreakMaterial.opacity,
      targetOpacity,
      0.12
    );

  const positionAttribute =
    speedStreaks
      .geometry
      .attributes
      .position;

  const longEffect =
    currentSpeedMode ===
    "poop";

  for (
    let i = 0;
    i < positionAttribute.count;
    i += 2
  ) {
    const x =
      positionAttribute.getX(i);

    const y =
      positionAttribute.getY(i);

    const z =
      positionAttribute.getZ(i);

    const length =
      longEffect
        ? 8 +
          Math.random() *
          12
        : 4 +
          Math.random() *
          5;

    positionAttribute.setX(
      i + 1,
      x
    );

    positionAttribute.setY(
      i + 1,
      y
    );

    positionAttribute.setZ(
      i + 1,
      z -
        length
    );
  }

  positionAttribute.needsUpdate =
    true;
}

function setHelperVisibility(
  visible
) {
  helperUIVisible =
    visible;

  /*
    Only helper / information UI
    is hidden here.
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
    Hide orbit lines when UI is OFF.
  */

  for (
    const planetData of
    solarPlanets
  ) {
    planetData.orbitLine.visible =
      visible;
  }

  /*
    We intentionally DO NOT hide:

      - Sun
      - Sun sprite/dot
      - planets
      - Moon
      - Saturn rings
      - stars
      - speed streak effect
      - flight controls
  */
}

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

  updateEnergy(
    deltaTime,
    isMoving
  );

  updateSunVisibilityAndRecharge(
    deltaTime
  );

  updateSpeedEffect(
    isMoving
  );

  updateLabels();

  /*
    Move the star sphere with the player
    so the player always has a deep star background.
  */

  if (stars) {
    stars.position.copy(
      camera.position
    );
  }

  renderer.render(
    scene,
    camera
  );
}

function startGame() {
  if (
    gameStarted
  ) {
    return;
  }

  gameStarted = true;

  startScreen.hidden =
    true;

  gameUI.hidden =
    false;

  renderer.domElement.focus();
}

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

  uiToggle.addEventListener(
    "click",
    () => {
      setHelperVisibility(
        !helperUIVisible
      );
    }
  );

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
          // Pointer capture is optional.
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

  /*
    Touch/look controls.

    Both axes remain inverted:

      swipe RIGHT -> look LEFT
      swipe LEFT  -> look RIGHT
      swipe UP    -> look DOWN
      swipe DOWN  -> look UP
  */

  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (
        !gameStarted ||
        event.button !== 0
      ) {
        return;
      }

      dragging = true;

      lastPointerX =
        event.clientX;

      lastPointerY =
        event.clientY;

      try {
        canvas.setPointerCapture(
          event.pointerId
        );
      } catch {
        // Pointer capture is optional.
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
          -Math.PI / 2 + 0.05,
          Math.PI / 2 - 0.05
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
      dragging = false;
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

      dragging = false;
    }
  );
}

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
