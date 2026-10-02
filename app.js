import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const loadingScreen = document.getElementById("loading-screen");
const startScreen = document.getElementById("start-screen");
const errorScreen = document.getElementById("error-screen");
const errorMessage = document.getElementById("error-message");
const startButton = document.getElementById("start-button");
const gameUI = document.getElementById("game-ui");
const gameElement = document.getElementById("game");

let scene;
let camera;
let renderer;
let solarPlanets = [];
let moonPivot;
let gameStarted = false;
let yaw = 0;
let pitch = -0.08;
let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;
let energy = 100;
let currentSpeedMode = "chill";

const movementSpeed = 110;
const lookSensitivity = 0.0035;
const ENERGY_RECHARGE_RATE = 18;

const speedModes = {
  chill: {
    multiplier: 1,
    drainRate: 0
  },
  sonic: {
    multiplier: 2,
    drainRate: 4
  },
  poop: {
    multiplier: 4,
    drainRate: 12
  }
};

const pressedControls = new Set();
const pressedKeys = new Set();
const clock = new THREE.Clock();
const sunPosition = new THREE.Vector3(0, 0, 0);

const controlKeys = {
  forward: ["w", "arrowup"],
  back: ["s", "arrowdown"],
  left: ["a", "arrowleft"],
  right: ["d", "arrowright"],
  up: [" ", "space"],
  down: ["shift", "control"]
};

/*
  Gameplay scale notes:

  Approximate NASA reference values are used for each planet's semi-major
  axis, eccentricity, orbital period, equatorial radius, rotation period,
  and axial tilt. The values are deliberately rounded for this game.

  Distance mapping:
  game distance = 200 * (semi-major axis in AU ^ 0.45)

  This nonlinear compression preserves planet order and relative spacing
  trends without making Neptune unreachably far away.

  Size mapping:
  game radius = 8 * (real radius / Earth's radius ^ 0.35)

  This softens the real size differences so planets remain visible while
  keeping the Sun and gas giants noticeably larger.

  Orbital periods and rotation periods use real relative periods as their
  basis. The 0.4 and 0.35 time-compression exponents keep the speed
  differences recognizable while making motion practical to observe.
*/

const EARTH_RADIUS_KM = 6371;
const EARTH_ORBITAL_PERIOD_DAYS = 365.256;
const EARTH_ROTATION_PERIOD_HOURS = 23.934;
const EARTH_GAME_RADIUS = 8;

const ORBIT_DISTANCE_SCALE = 200;
const DISTANCE_COMPRESSION_EXPONENT = 0.45;
const SIZE_COMPRESSION_EXPONENT = 0.35;
const TIME_COMPRESSION_EXPONENT = 0.4;
const SPIN_COMPRESSION_EXPONENT = 0.35;

const BASE_EARTH_ORBIT_SPEED = 0.13;
const BASE_EARTH_SPIN_SPEED = 0.16;

const MOON_RADIUS_KM = 1737.4;
const MOON_ORBIT_DISTANCE_KM = 384400;
const MOON_ORBIT_PERIOD_DAYS = 27.322;
const SUN_RADIUS_KM = 696340;

const SUN_RADIUS =
  EARTH_GAME_RADIUS *
  Math.pow(
    SUN_RADIUS_KM / EARTH_RADIUS_KM,
    SIZE_COMPRESSION_EXPONENT
  );

const SUN_RECHARGE_RADIUS = SUN_RADIUS + 35;

const planetDataList = [
  {
    name: "Mercury",
    color: 0x96928c,
    orbitColor: 0xa7a7a7,
    semiMajorAxisAU: 0.3871,
    eccentricity: 0.2056,
    orbitalPeriodDays: 87.969,
    radiusKm: 2439.7,
    rotationPeriodHours: 1407.6,
    axialTiltDegrees: 0.03,
    orbitalInclinationDegrees: 7.0,
    startMeanAnomaly: 1.1
  },
  {
    name: "Venus",
    color: 0xd8bd83,
    orbitColor: 0xcab98d,
    semiMajorAxisAU: 0.7233,
    eccentricity: 0.0068,
    orbitalPeriodDays: 224.701,
    radiusKm: 6051.8,
    rotationPeriodHours: -5832.5,
    axialTiltDegrees: 177.36,
    orbitalInclinationDegrees: 3.39,
    startMeanAnomaly: 2.4
  },
  {
    name: "Earth",
    color: 0x347fe0,
    orbitColor: 0x63a9ff,
    semiMajorAxisAU: 1,
    eccentricity: 0.0167,
    orbitalPeriodDays: 365.256,
    radiusKm: 6371,
    rotationPeriodHours: 23.934,
    axialTiltDegrees: 23.44,
    orbitalInclinationDegrees: 0,
    startMeanAnomaly: 0.5,
    hasMoon: true
  },
  {
    name: "Mars",
    color: 0xc9563d,
    orbitColor: 0xe07860,
    semiMajorAxisAU: 1.5237,
    eccentricity: 0.0934,
    orbitalPeriodDays: 686.98,
    radiusKm: 3389.5,
    rotationPeriodHours: 24.623,
    axialTiltDegrees: 25.19,
    orbitalInclinationDegrees: 1.85,
    startMeanAnomaly: 3.2
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
    orbitalInclinationDegrees: 1.3,
    startMeanAnomaly: 2.1
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
    orbitalInclinationDegrees: 2.49,
    startMeanAnomaly: 4.2,
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
    orbitalInclinationDegrees: 0.77,
    startMeanAnomaly: 5.1
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
    startMeanAnomaly: 0.2
  }
];

function showError(message) {
  loadingScreen.hidden = true;
  startScreen.hidden = true;
  gameUI.hidden = true;
  errorMessage.textContent = message;
  errorScreen.hidden = false;
}

function getGameOrbitRadius(semiMajorAxisAU) {
  return (
    ORBIT_DISTANCE_SCALE *
    Math.pow(
      semiMajorAxisAU,
      DISTANCE_COMPRESSION_EXPONENT
    )
  );
}

function getGamePlanetRadius(radiusKm) {
  return (
    EARTH_GAME_RADIUS *
    Math.pow(
      radiusKm / EARTH_RADIUS_KM,
      SIZE_COMPRESSION_EXPONENT
    )
  );
}

function updateSpeedButtons() {
  const speedButtons =
    document.querySelectorAll("[data-speed]");

  for (const button of speedButtons) {
    const isSelected =
      button.dataset.speed === currentSpeedMode;

    button.classList.toggle(
      "is-selected",
      isSelected
    );

    button.setAttribute(
      "aria-pressed",
      String(isSelected)
    );
  }
}

function setSpeedMode(mode) {
  if (!speedModes[mode]) {
    return;
  }

  currentSpeedMode = mode;
  updateSpeedButtons();
}

function updateEnergyDisplay() {
  const energyFill =
    document.getElementById("energy-fill");

  const energyPercent =
    document.getElementById("energy-percent");

  const energyBar =
    document.getElementById("energy-bar");

  const displayedEnergy = Math.round(energy);

  energyFill.style.width = `${energy}%`;
  energyPercent.textContent = `${displayedEnergy}%`;

  energyBar.setAttribute(
    "aria-valuenow",
    String(displayedEnergy)
  );

  if (energy <= 25) {
    energyFill.style.backgroundColor = "#ff665f";
  } else if (energy <= 55) {
    energyFill.style.backgroundColor = "#ffd15c";
  } else {
    energyFill.style.backgroundColor = "#65e68a";
  }
}

function createStarField() {
  const starCount = 2400;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i += 1) {
    const direction = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize();

    const distance = 1100 + Math.random() * 1000;

    positions[i * 3] = direction.x * distance;
    positions[i * 3 + 1] = direction.y * distance;
    positions[i * 3 + 2] = direction.z * distance;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });

  scene.add(new THREE.Points(geometry, material));
}

function getEllipsePosition(semiMajorAxis, eccentricity, eccentricAnomaly) {
  const semiMinorAxis =
    semiMajorAxis *
    Math.sqrt(1 - eccentricity * eccentricity);

  return new THREE.Vector3(
    semiMajorAxis *
      (Math.cos(eccentricAnomaly) - eccentricity),
    0,
    semiMinorAxis * Math.sin(eccentricAnomaly)
  );
}

function solveEccentricAnomaly(meanAnomaly, eccentricity) {
  let eccentricAnomaly = meanAnomaly;

  for (let i = 0; i < 5; i += 1) {
    const difference =
      eccentricAnomaly -
      eccentricity * Math.sin(eccentricAnomaly) -
      meanAnomaly;

    const derivative =
      1 -
      eccentricity * Math.cos(eccentricAnomaly);

    eccentricAnomaly -= difference / derivative;
  }

  return eccentricAnomaly;
}

function createOrbitLine(semiMajorAxis, eccentricity, color) {
  const points = [];
  const segments = 180;

  const semiMinorAxis =
    semiMajorAxis *
    Math.sqrt(1 - eccentricity * eccentricity);

  for (let i = 0; i < segments; i += 1) {
    const eccentricAnomaly =
      (i / segments) * Math.PI * 2;

    points.push(
      new THREE.Vector3(
        semiMajorAxis *
          (Math.cos(eccentricAnomaly) - eccentricity),
        0,
        semiMinorAxis * Math.sin(eccentricAnomaly)
      )
    );
  }

  const geometry =
    new THREE.BufferGeometry().setFromPoints(points);

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.42
  });

  return new THREE.LineLoop(geometry, material);
}

function createPlanet(data) {
  const orbitRadius =
    getGameOrbitRadius(data.semiMajorAxisAU);

  const planetRadius =
    getGamePlanetRadius(data.radiusKm);

  const orbitGroup = new THREE.Group();

  orbitGroup.rotation.x =
    THREE.MathUtils.degToRad(
      data.orbitalInclinationDegrees
    );

  scene.add(orbitGroup);

  const orbitLine = createOrbitLine(
    orbitRadius,
    data.eccentricity,
    data.orbitColor
  );

  orbitGroup.add(orbitLine);

  const axialGroup = new THREE.Group();

  axialGroup.rotation.z =
    THREE.MathUtils.degToRad(
      data.axialTiltDegrees
    );

  orbitGroup.add(axialGroup);

  const planetGeometry = new THREE.SphereGeometry(
    planetRadius,
    32,
    24
  );

  const planetMaterial = new THREE.MeshStandardMaterial({
    color: data.color,
    roughness: 0.88,
    metalness: 0
  });

  const planet = new THREE.Mesh(
    planetGeometry,
    planetMaterial
  );

  axialGroup.add(planet);

  if (data.hasRings) {
    const ringGeometry = new THREE.RingGeometry(
      planetRadius * 1.35,
      planetRadius * 2.15,
      72
    );

    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xc9b98e,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0
    });

    const rings = new THREE.Mesh(
      ringGeometry,
      ringMaterial
    );

    rings.rotation.x = Math.PI / 2.25;
    planet.add(rings);
  }

  if (data.hasMoon) {
    moonPivot = new THREE.Group();
    axialGroup.add(moonPivot);

    const moonGameRadius =
      EARTH_GAME_RADIUS *
      Math.pow(
        MOON_RADIUS_KM / EARTH_RADIUS_KM,
        SIZE_COMPRESSION_EXPONENT
      );

    const moonOrbitRadius =
      EARTH_GAME_RADIUS *
      Math.pow(
        MOON_ORBIT_DISTANCE_KM / EARTH_RADIUS_KM,
        SIZE_COMPRESSION_EXPONENT
      );

    const moonGeometry = new THREE.SphereGeometry(
      moonGameRadius,
      24,
      18
    );

    const moonMaterial = new THREE.MeshStandardMaterial({
      color: 0xbfc4cf,
      roughness: 1
    });

    const moon = new THREE.Mesh(
      moonGeometry,
      moonMaterial
    );

    moon.position.x = moonOrbitRadius;
    moonPivot.add(moon);
  }

  const rotationSign =
    Math.sign(data.rotationPeriodHours);

  const spinSpeed =
    BASE_EARTH_SPIN_SPEED *
    Math.pow(
      EARTH_ROTATION_PERIOD_HOURS /
        Math.abs(data.rotationPeriodHours),
      SPIN_COMPRESSION_EXPONENT
    ) *
    rotationSign;

  const meanMotion =
    BASE_EARTH_ORBIT_SPEED *
    Math.pow(
      EARTH_ORBITAL_PERIOD_DAYS /
        data.orbitalPeriodDays,
      TIME_COMPRESSION_EXPONENT
    );

  const initialEccentricAnomaly =
    solveEccentricAnomaly(
      data.startMeanAnomaly,
      data.eccentricity
    );

  const initialPosition =
    getEllipsePosition(
      orbitRadius,
      data.eccentricity,
      initialEccentricAnomaly
    );

  orbitGroup.position.copy(initialPosition);

  solarPlanets.push({
    name: data.name,
    orbitGroup,
    axialGroup,
    planet,
    orbitRadius,
    eccentricity: data.eccentricity,
    meanAnomaly: data.startMeanAnomaly,
    meanMotion,
    spinSpeed
  });
}

function createSolarSystem() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050711);

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    5000
  );

  camera.position.set(0, 45, 310);
  camera.rotation.order = "YXZ";

  yaw = 0;
  pitch = -0.08;

  camera.rotation.set(
    pitch,
    yaw,
    0
  );

  const ambientLight = new THREE.HemisphereLight(
    0xa8bbff,
    0x17121c,
    1.45
  );

  scene.add(ambientLight);

  const sunLight = new THREE.PointLight(
    0xffd69a,
    30000,
    0,
    2
  );

  sunLight.position.copy(sunPosition);
  scene.add(sunLight);

  const sunGeometry = new THREE.SphereGeometry(
    SUN_RADIUS,
    48,
    32
  );

  const sunMaterial = new THREE.MeshStandardMaterial({
    color: 0xffa928,
    emissive: 0xff7900,
    emissiveIntensity: 2.5,
    roughness: 0.65
  });

  scene.add(
    new THREE.Mesh(sunGeometry, sunMaterial)
  );

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(
      SUN_RADIUS * 1.3,
      32,
      24
    ),
    new THREE.MeshBasicMaterial({
      color: 0xff9a27,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
      depthWrite: false
    })
  );

  scene.add(glow);

  createStarField();

  for (const planetData of planetDataList) {
    createPlanet(planetData);
  }

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 2)
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  gameElement.prepend(renderer.domElement);

  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive 3D Solar System"
  );

  renderer.domElement.setAttribute(
    "role",
    "application"
  );

  window.addEventListener("resize", handleResize);

  setupControls();
  updateSpeedButtons();
  updateEnergyDisplay();
  animate();
}

function handleResize() {
  if (!camera || !renderer) {
    return;
  }

  camera.aspect =
    window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 2)
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
}

function isControlPressed(name) {
  if (pressedControls.has(name)) {
    return true;
  }

  return controlKeys[name].some(
    (key) => pressedKeys.has(key)
  );
}

function updateMovement(deltaTime) {
  if (!gameStarted) {
    return false;
  }

  const forwardAmount =
    Number(isControlPressed("forward")) -
    Number(isControlPressed("back"));

  const rightAmount =
    Number(isControlPressed("right")) -
    Number(isControlPressed("left"));

  const verticalAmount =
    Number(isControlPressed("up")) -
    Number(isControlPressed("down"));

  const movement = new THREE.Vector3();

  if (forwardAmount !== 0) {
    const forward = new THREE.Vector3();

    camera.getWorldDirection(forward);

    movement.addScaledVector(
      forward,
      forwardAmount
    );
  }

  if (rightAmount !== 0) {
    const forward = new THREE.Vector3();

    camera.getWorldDirection(forward);

    const right = new THREE.Vector3()
      .crossVectors(
        forward,
        new THREE.Vector3(0, 1, 0)
      )
      .normalize();

    movement.addScaledVector(
      right,
      rightAmount
    );
  }

  movement.y += verticalAmount;

  if (movement.lengthSq() === 0) {
    return false;
  }

  if (
    energy <= 0 &&
    currentSpeedMode !== "chill"
  ) {
    setSpeedMode("chill");
  }

  movement.normalize();

  const selectedSpeed =
    speedModes[currentSpeedMode];

  const actualSpeed =
    movementSpeed *
    selectedSpeed.multiplier;

  camera.position.addScaledVector(
    movement,
    actualSpeed * deltaTime
  );

  return true;
}

function updateEnergy(deltaTime, isMoving) {
  if (!gameStarted) {
    return;
  }

  const selectedSpeed =
    speedModes[currentSpeedMode];

  if (
    isMoving &&
    selectedSpeed.drainRate > 0
  ) {
    energy -=
      selectedSpeed.drainRate *
      deltaTime;

    energy = Math.max(0, energy);

    if (energy === 0) {
      setSpeedMode("chill");
    }
  }

  const distanceFromSun =
    camera.position.distanceTo(sunPosition);

  if (distanceFromSun <= SUN_RECHARGE_RADIUS) {
    energy +=
      ENERGY_RECHARGE_RATE *
      deltaTime;

    energy = Math.min(100, energy);
  }

  updateEnergyDisplay();
}

function updateMoon(deltaTime) {
  if (!moonPivot) {
    return;
  }

  const moonMeanMotion =
    BASE_EARTH_ORBIT_SPEED *
    Math.pow(
      EARTH_ORBITAL_PERIOD_DAYS /
        MOON_ORBIT_PERIOD_DAYS,
      TIME_COMPRESSION_EXPONENT
    );

  moonPivot.rotation.y +=
    moonMeanMotion * deltaTime;
}

function animate() {
  requestAnimationFrame(animate);

  const deltaTime =
    Math.min(clock.getDelta(), 0.05);

  for (const planetData of solarPlanets) {
    planetData.meanAnomaly +=
      planetData.meanMotion *
      deltaTime;

    if (planetData.meanAnomaly > Math.PI * 2) {
      planetData.meanAnomaly -= Math.PI * 2;
    }

    const eccentricAnomaly =
      solveEccentricAnomaly(
        planetData.meanAnomaly,
        planetData.eccentricity
      );

    const position =
      getEllipsePosition(
        planetData.orbitRadius,
        planetData.eccentricity,
        eccentricAnomaly
      );

    planetData.orbitGroup.position.copy(position);

    planetData.planet.rotation.y +=
      planetData.spinSpeed *
      deltaTime;
  }

  updateMoon(deltaTime);

  const isMoving =
    updateMovement(deltaTime);

  updateEnergy(
    deltaTime,
    isMoving
  );

  renderer.render(scene, camera);
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
  const canvas = renderer.domElement;

  const controlButtons =
    document.querySelectorAll("[data-control]");

  const speedButtons =
    document.querySelectorAll("[data-speed]");

  for (const button of speedButtons) {
    button.addEventListener("click", () => {
      setSpeedMode(button.dataset.speed);
    });
  }

  for (const button of controlButtons) {
    const controlName = button.dataset.control;

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();

      pressedControls.add(controlName);
      button.classList.add("is-pressed");

      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional.
      }
    });

    const releaseButton = (event) => {
      event.preventDefault();
      event.stopPropagation();

      pressedControls.delete(controlName);
      button.classList.remove("is-pressed");
    };

    button.addEventListener("pointerup", releaseButton);
    button.addEventListener("pointercancel", releaseButton);

    button.addEventListener("lostpointercapture", () => {
      pressedControls.delete(controlName);
      button.classList.remove("is-pressed");
    });

    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!gameStarted || event.button !== 0) {
      return;
    }

    dragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional.
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragging || !gameStarted) {
      return;
    }

    const deltaX =
      event.clientX - lastPointerX;

    const deltaY =
      event.clientY - lastPointerY;

    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    // Invert both camera-look axes only.
    yaw -= deltaX * lookSensitivity;
    pitch -= deltaY * lookSensitivity;

    pitch = THREE.MathUtils.clamp(
      pitch,
      -Math.PI / 2 + 0.05,
      Math.PI / 2 - 0.05
    );

    camera.rotation.set(pitch, yaw, 0);
  });

  const stopDragging = () => {
    dragging = false;
  };

  canvas.addEventListener("pointerup", stopDragging);
  canvas.addEventListener("pointercancel", stopDragging);
  canvas.addEventListener("lostpointercapture", stopDragging);

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    const allControlKeys =
      Object.values(controlKeys).flat();

    if (allControlKeys.includes(key)) {
      event.preventDefault();
      pressedKeys.add(key);
    }
  });

  window.addEventListener("keyup", (event) => {
    pressedKeys.delete(event.key.toLowerCase());
  });

  window.addEventListener("blur", () => {
    pressedControls.clear();
    pressedKeys.clear();

    for (const button of controlButtons) {
      button.classList.remove("is-pressed");
    }

    dragging = false;
  });
}

startButton.addEventListener("click", startGame);

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
