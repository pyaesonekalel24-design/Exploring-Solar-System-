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
const sunIndicator = $("sun-indicator");

let scene, camera, renderer;
let solarPlanets = [];
let moonPivot = null;
let stars = null;
let speedStreaks = null;
let speedStreakMaterial = null;
let sunDot = null;
let gameStarted = false;
let helperUIVisible = true;
let dragging = false;
let lastPointerX = 0, lastPointerY = 0;
let yaw = 0, pitch = -0.08;
let energy = 100;
let currentSpeedMode = "chill";

const movementSpeed = 100;
const lookSensitivity = 0.0035;
const ENERGY_RECHARGE_RATE = 18;

const speedModes = {
  chill: { multiplier: 1, drainRate: 0 },
  sonic: { multiplier: 25, drainRate: 4 },
  poop: { multiplier: 120, drainRate: 12 }
};

const pressedControls = new Set();
const pressedKeys = new Set();

const controlKeys = {
  forward: ["w", "arrowup"],
  back: ["s", "arrowdown"],
  left: ["a", "arrowleft"],
  right: ["d", "arrowright"],
  up: [" ", "space"],
  down: ["shift", "control"]
};

const clock = new THREE.Clock();
const sunPosition = new THREE.Vector3();
const projectedSun = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const occluders = [];

const KM_PER_AU = 149_597_870.7;
const GAME_UNITS_PER_AU = 3000;
const GAME_UNITS_PER_KM =
  GAME_UNITS_PER_AU / KM_PER_AU;

const SIMULATION_DAYS_PER_SECOND = 15;
const VISUAL_SPIN_DAYS_PER_SECOND = 0.05;

const EARTH_RADIUS_KM = 6_371;
const EARTH_RADIUS =
  EARTH_RADIUS_KM *
  GAME_UNITS_PER_KM;

const SUN_RADIUS_KM = 696_340;
const SUN_RADIUS =
  SUN_RADIUS_KM *
  GAME_UNITS_PER_KM;

const MOON_RADIUS =
  1_737.4 *
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
  errorMessage.textContent = message;
  errorScreen.hidden = false;
}

function updateSpeedButtons() {
  document.querySelectorAll("[data-speed]").forEach((button) => {
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
  const rounded =
    Math.round(energy);

  $("energy-fill").style.width =
    `${energy}%`;

  $("energy-percent").textContent =
    `${rounded}%`;

  $("energy-bar").setAttribute(
    "aria-valuenow",
    String(rounded)
  );

  $("energy-fill").style.backgroundColor =
    energy <= 25
      ? "#ff665f"
      : energy <= 55
        ? "#ffd15c"
        : "#65e68a";
}

function createStarField() {
  const count = 2600;
  const positions =
    new Float32Array(
      count * 3
    );

  const direction =
    new THREE.Vector3();

  for (
    let i = 0;
    i < count;
    i++
  ) {
    direction.set(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize();

    const distance =
      70_000 +
      Math.random() * 60_000;

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

  stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 220,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.86,
      depthWrite: false
    })
  );

  scene.add(stars);
}

function createSunDot() {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
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
    0.2,
    "rgba(255,225,94,1)"
  );

  gradient.addColorStop(
    0.55,
    "rgba(255,162,35,0.7)"
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

  sunDot =
    new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false
      })
    );

  sunDot.position.copy(
    sunPosition
  );

  scene.add(
    sunDot
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
    i++
  ) {
    const x =
      (Math.random() - 0.5) *
      10;

    const y =
      (Math.random() - 0.5) *
      10;

    const z =
      -4 -
      Math.random() *
      24;

    const base =
      i * 6;

    positions[base] =
      positions[base + 3] =
      x;

    positions[base + 1] =
      positions[base + 4] =
      y;

    positions[base + 2] =
      z;

    positions[base + 5] =
      z - 3;
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
  a,
  e,
  E
) {
  const b =
    a *
    Math.sqrt(
      1 -
      e * e
    );

  return new THREE.Vector3(
    a *
      (
        Math.cos(E) -
        e
      ),
    0,
    b *
      Math.sin(E)
  );
}

function solveEccentricAnomaly(
  M,
  e
) {
  let E = M;

  for (
    let i = 0;
    i < 8;
    i++
  ) {
    const f =
      E -
      e *
      Math.sin(E) -
      M;

    const fp =
      1 -
      e *
      Math.cos(E);

    E -=
      f /
      fp;
  }

  return E;
}

function createOrbitLine(
  a,
  e,
  color
) {
  const points = [];

  const b =
    a *
    Math.sqrt(
      1 -
      e * e
    );

  for (
    let i = 0;
    i < 360;
    i++
  ) {
    const E =
      (
        i /
        360
      ) *
      Math.PI *
      2;

    points.push(
      new THREE.Vector3(
        a *
          (
            Math.cos(E) -
            e
          ),
        0,
        b *
          Math.sin(E)
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
      transparent: true,
      opacity: 0.26,
      depthWrite: false
    })
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
  const a =
    data.semiMajorAxisAU *
    GAME_UNITS_PER_AU;

  const radius =
    data.radiusKm *
    GAME_UNITS_PER_KM;

  // The orbit itself stays centered on the Sun.
  // Only the planet's body moves along it.
  const node =
    new THREE.Group();

  node.rotation.y =
    THREE.MathUtils.degToRad(
      data.longitudeOfAscendingNodeDegrees
    );

  const inclination =
    new THREE.Group();

  inclination.rotation.x =
    THREE.MathUtils.degToRad(
      data.orbitalInclinationDegrees
    );

  const periapsis =
    new THREE.Group();

  periapsis.rotation.y =
    THREE.MathUtils.degToRad(
      data.argumentOfPeriapsisDegrees
    );

  node.add(
    inclination
  );

  inclination.add(
    periapsis
  );

  scene.add(
    node
  );

  const orbitLine =
    createOrbitLine(
      a,
      data.eccentricity,
      data.orbitColor
    );

  periapsis.add(
    orbitLine
  );

  const body =
    new THREE.Group();

  periapsis.add(
    body
  );

  const tilt =
    new THREE.Group();

  tilt.rotation.z =
    THREE.MathUtils.degToRad(
      data.axialTiltDegrees
    );

  body.add(
    tilt
  );

  const planet =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        radius,
        24,
        16
      ),
      new THREE.MeshStandardMaterial({
        color: data.color,
        roughness: 0.88,
        metalness: 0
      })
    );

  tilt.add(
    planet
  );

  occluders.push(
    planet
  );

  if (data.hasRings) {
    const rings =
      new THREE.Mesh(
        new THREE.RingGeometry(
          radius * 1.35,
          radius * 2.3,
          96
        ),
        new THREE.MeshStandardMaterial({
          color: 0xc9b98e,
          side: THREE.DoubleSide,
          roughness: 0.95
        })
      );

    rings.rotation.x =
      Math.PI / 2.25;

    planet.add(
      rings
    );
  }

  if (data.hasMoon) {
    moonPivot =
      new THREE.Group();

    body.add(
      moonPivot
    );

    const moon =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          MOON_RADIUS,
          20,
          14
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

    occluders.push(
      moon
    );
  }

  const M =
    THREE.MathUtils.degToRad(
      data.startMeanAnomalyDegrees
    );

  body.position.copy(
    getEllipsePosition(
      a,
      data.eccentricity,
      solveEccentricAnomaly(
        M,
        data.eccentricity
      )
    )
  );

  solarPlanets.push({
    name: data.name,
    semiMajorAxis: a,
    eccentricity:
      data.eccentricity,
    meanAnomaly: M,
    meanMotion:
      (
        Math.PI * 2 /
        data.orbitalPeriodDays
      ) *
      SIMULATION_DAYS_PER_SECOND,
    spinSpeed:
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
      ),
    body,
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
      0.03,
      150_000
    );

  // Roughly one AU from the Sun,
  // looking inward.
  camera.position.set(
    0,
    EARTH_RADIUS * 80,
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
    new THREE.HemisphereLight(
      0x8ea6d4,
      0x111118,
      0.28
    )
  );

  const sunLight =
    new THREE.PointLight(
      0xffd69a,
      1_500_000,
      0,
      2
    );

  sunLight.position.copy(
    sunPosition
  );

  scene.add(
    sunLight
  );

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

  const glow =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        SUN_RADIUS * 1.4,
        32,
        24
      ),
      new THREE.MeshBasicMaterial({
        color: 0xff9a27,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
        depthWrite: false
      })
    );

  scene.add(
    glow
  );

  createSunDot();
  createStarField();

  planetDataList.forEach(
    createPlanet
  );

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
    1.15;

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
  setHelperVisibility(true);
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

function isControlPressed(
  name
) {
  return (
    pressedControls.has(name) ||
    controlKeys[name].some(
      (key) =>
        pressedKeys.has(key)
    )
  );
}

function updateMovement(dt) {
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

  if (forwardAmount) {
    camera.getWorldDirection(
      cameraDirection
    );

    movement.addScaledVector(
      cameraDirection,
      forwardAmount
    );
  }

  if (rightAmount) {
    camera.getWorldDirection(
      cameraDirection
    );

    movement.addScaledVector(
      new THREE.Vector3()
        .crossVectors(
          cameraDirection,
          new THREE.Vector3(
            0,
            1,
            0
          )
        )
        .normalize(),
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

  camera.position.addScaledVector(
    movement,
    movementSpeed *
      speedModes[
        currentSpeedMode
      ].multiplier *
      dt
  );

  return true;
}

function sunIsVisible() {
  projectedSun
    .copy(sunPosition)
    .project(camera);

  if (
    projectedSun.x < -1 ||
    projectedSun.x > 1 ||
    projectedSun.y < -1 ||
    projectedSun.y > 1 ||
    projectedSun.z < -1 ||
    projectedSun.z > 1
  ) {
    return false;
  }

  camera.getWorldDirection(
    cameraDirection
  );

  const toSun =
    sunPosition
      .clone()
      .sub(
        camera.position
      );

  const distance =
    toSun.length();

  if (
    distance <= 0.001
  ) {
    return true;
  }

  toSun.normalize();

  if (
    cameraDirection.dot(
      toSun
    ) <= 0
  ) {
    return false;
  }

  raycaster.set(
    camera.position,
    toSun
  );

  return !raycaster
    .intersectObjects(
      occluders,
      false
    )
    .some(
      (hit) =>
        hit.distance <
        distance
    );
}

function updateSunAndEnergy(dt) {
  const charging =
    sunIsVisible();

  const distance =
    camera.position.distanceTo(
      sunPosition
    );

  const angularDiameter =
    2 *
    Math.atan(
      SUN_RADIUS /
      Math.max(
        distance,
        SUN_RADIUS
      )
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

  if (sunDot) {
    if (
      projectedSun.x >= -1 &&
      projectedSun.x <= 1 &&
      projectedSun.y >= -1 &&
      projectedSun.y <= 1 &&
      projectedSun.z >= -1 &&
      projectedSun.z <= 1 &&
      pixels < 3
    ) {
      const minAngular =
        3 *
        fovRadians /
        window.innerHeight;

      const size =
        Math.min(
          320,
          Math.max(
            SUN_RADIUS,
            2 *
              distance *
              Math.tan(
                minAngular /
                2
              )
          )
        );

      sunDot.scale.set(
        size,
        size,
        1
      );

      sunDot.material.opacity =
        0.92;
    } else {
      sunDot.material.opacity =
        0;
    }
  }

  if (charging) {
    energy =
      Math.min(
        100,
        energy +
        ENERGY_RECHARGE_RATE *
        dt
      );
  }

  updateEnergyDisplay();

  const onScreen =
    projectedSun.x >= -1 &&
    projectedSun.x <= 1 &&
    projectedSun.y >= -1 &&
    projectedSun.y <= 1 &&
    projectedSun.z >= -1 &&
    projectedSun.z <= 1;

  if (
    charging &&
    helperUIVisible &&
    onScreen
  ) {
    sunIndicator.style.left =
      `${
        (
          projectedSun.x *
          0.5 +
          0.5
        ) *
        window.innerWidth
      }px`;

    sunIndicator.style.top =
      `${
        (
          -projectedSun.y *
          0.5 +
          0.5
        ) *
        window.innerHeight
      }px`;

    sunIndicator.classList.add(
      "is-visible",
      "is-charging"
    );
  } else {
    sunIndicator.classList.remove(
      "is-visible",
      "is-charging"
    );
  }
}

function updateEnergy(
  dt,
  moving
) {
  if (!gameStarted) {
    return;
  }

  const mode =
    speedModes[
      currentSpeedMode
    ];

  if (
    !moving ||
    mode.drainRate <= 0
  ) {
    return;
  }

  energy =
    Math.max(
      0,
      energy -
      mode.drainRate *
      dt
    );

  if (
    energy === 0
  ) {
    setSpeedMode(
      "chill"
    );
  }
}

function updateOrbits(dt) {
  for (
    const p of solarPlanets
  ) {
    p.meanAnomaly +=
      p.meanMotion *
      dt;

    if (
      p.meanAnomaly >
      Math.PI * 2
    ) {
      p.meanAnomaly -=
        Math.PI * 2;
    }

    const E =
      solveEccentricAnomaly(
        p.meanAnomaly,
        p.eccentricity
      );

    p.body.position.copy(
      getEllipsePosition(
        p.semiMajorAxis,
        p.eccentricity,
        E
      )
    );

    p.planet.rotation.y +=
      p.spinSpeed *
      dt;
  }

  if (moonPivot) {
    moonPivot.rotation.y +=
      (
        Math.PI * 2 /
        MOON_ORBIT_PERIOD_DAYS
      ) *
      SIMULATION_DAYS_PER_SECOND *
      dt;
  }
}

function updateLabels() {
  if (!helperUIVisible) {
    return;
  }

  const world =
    new THREE.Vector3();

  const projected =
    new THREE.Vector3();

  for (
    const p of solarPlanets
  ) {
    p.planet.getWorldPosition(
      world
    );

    projected
      .copy(world)
      .project(camera);

    const visible =
      projected.z > -1 &&
      projected.z < 1 &&
      projected.x > -1.1 &&
      projected.x < 1.1 &&
      projected.y > -1.1 &&
      projected.y < 1.1;

    if (!visible) {
      p.label.style.opacity =
        "0";

      continue;
    }

    p.label.style.left =
      `${
        (
          projected.x *
          0.5 +
          0.5
        ) *
        window.innerWidth
      }px`;

    p.label.style.top =
      `${
        (
          -projected.y *
          0.5 +
          0.5
        ) *
        window.innerHeight
      }px`;

    p.label.style.opacity =
      "1";
  }
}

function updateSpeedEffect(
  moving
) {
  if (
    !speedStreakMaterial
  ) {
    return;
  }

  const target =
    !moving
      ? 0
      : currentSpeedMode ===
          "poop"
        ? 0.62
        : currentSpeedMode ===
            "sonic"
          ? 0.32
          : 0;

  speedStreakMaterial.opacity =
    THREE.MathUtils.lerp(
      speedStreakMaterial.opacity,
      target,
      0.12
    );

  const positions =
    speedStreaks
      .geometry
      .attributes
      .position;

  const long =
    currentSpeedMode ===
    "poop";

  for (
    let i = 0;
    i < positions.count;
    i += 2
  ) {
    const x =
      positions.getX(i);

    const y =
      positions.getY(i);

    const z =
      positions.getZ(i);

    const length =
      long
        ? 6 +
          Math.random() * 8
        : 3 +
          Math.random() * 4;

    positions.setX(
      i + 1,
      x
    );

    positions.setY(
      i + 1,
      y
    );

    positions.setZ(
      i + 1,
      z - length
    );
  }

  positions.needsUpdate =
    true;
}

function setHelperVisibility(
  visible
) {
  helperUIVisible =
    visible;

  gameUI.classList.toggle(
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
    const p of solarPlanets
  ) {
    p.orbitLine.visible =
      visible;

    if (!visible) {
      p.label.style.opacity =
        "0";
    }
  }

  if (!visible) {
    sunIndicator.classList.remove(
      "is-visible",
      "is-charging"
    );
  }
}

function animate() {
  requestAnimationFrame(
    animate
  );

  const dt =
    Math.min(
      clock.getDelta(),
      0.05
    );

  updateOrbits(dt);

  const moving =
    updateMovement(dt);

  updateEnergy(
    dt,
    moving
  );

  updateSunAndEnergy(
    dt
  );

  updateSpeedEffect(
    moving
  );

  updateLabels();

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
  if (gameStarted) {
    return;
  }

  gameStarted = true;
  startScreen.hidden = true;
  gameUI.hidden = false;
  renderer.domElement.focus();
}

function setupControls() {
  const canvas =
    renderer.domElement;

  const controlButtons =
    document.querySelectorAll(
      "[data-control]"
    );

  document
    .querySelectorAll(
      "[data-speed]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () =>
            setSpeedMode(
              button.dataset.speed
            )
        );
      }
    );

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
    const name =
      button.dataset.control;

    const release =
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        pressedControls.delete(
          name
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
          name
        );

        button.classList.add(
          "is-pressed"
        );

        try {
          button.setPointerCapture(
            event.pointerId
          );
        } catch {}
      }
    );

    button.addEventListener(
      "pointerup",
      release
    );

    button.addEventListener(
      "pointercancel",
      release
    );

    button.addEventListener(
      "lostpointercapture",
      () => {
        pressedControls.delete(
          name
        );

        button.classList.remove(
          "is-pressed"
        );
      }
    );

    button.addEventListener(
      "contextmenu",
      (event) =>
        event.preventDefault()
    );
  }

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
      } catch {}
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

      // Inverted touch-look only.
      // UP/DOWN flight buttons stay normal.
      yaw -=
        dx *
        lookSensitivity;

      pitch -=
        dy *
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

      if (
        Object.values(
          controlKeys
        )
          .flat()
          .includes(key)
      ) {
        event.preventDefault();
        pressedKeys.add(key);
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
        (button) =>
          button.classList.remove(
            "is-pressed"
          )
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
  loadingScreen.hidden = true;
  startScreen.hidden = false;
} catch (error) {
  console.error(
    "Could not initialize the Solar System game:",
    error
  );

  showError(
    "The 3D scene could not be initialized. Please check that WebGL is available and reload the page."
  );
}
