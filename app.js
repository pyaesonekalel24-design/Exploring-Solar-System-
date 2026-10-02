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
let animationFrameId = 0;
let gameStarted = false;
let yaw = 0;
let pitch = -0.08;
let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

const movementSpeed = 110;
const lookSensitivity = 0.0035;
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

function showError(message) {
  loadingScreen.hidden = true;
  startScreen.hidden = true;
  gameUI.hidden = true;
  errorMessage.textContent = message;
  errorScreen.hidden = false;
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

    const distance = 900 + Math.random() * 900;

    positions[i * 3] = direction.x * distance;
    positions[i * 3 + 1] = direction.y * distance;
    positions[i * 3 + 2] = direction.z * distance;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });

  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
}

function createOrbit(radius, color) {
  const points = [];
  const segments = 180;

  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      )
    );
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.42
  });

  const orbitLine = new THREE.LineLoop(geometry, material);
  scene.add(orbitLine);
}

function createPlanet(data) {
  createOrbit(data.orbitRadius, data.orbitColor);

  const orbitGroup = new THREE.Group();
  scene.add(orbitGroup);

  const planetGeometry = new THREE.SphereGeometry(data.size, 32, 24);
  const planetMaterial = new THREE.MeshStandardMaterial({
    color: data.color,
    roughness: 0.88,
    metalness: 0
  });

  const planet = new THREE.Mesh(planetGeometry, planetMaterial);
  planet.position.x = data.orbitRadius;
  planet.rotation.z = data.tilt || 0;
  orbitGroup.add(planet);

  if (data.hasRings) {
    const ringGeometry = new THREE.RingGeometry(data.size * 1.35, data.size * 2.15, 72);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xc9b98e,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0
    });

    const rings = new THREE.Mesh(ringGeometry, ringMaterial);
    rings.rotation.x = Math.PI / 2.25;
    planet.add(rings);
  }

  if (data.hasMoon) {
    moonPivot = new THREE.Group();
    moonPivot.position.set(data.size + 3, 0, 0);
    planet.add(moonPivot);

    const moonGeometry = new THREE.SphereGeometry(2.6, 20, 16);
    const moonMaterial = new THREE.MeshStandardMaterial({
      color: 0xbfc4cf,
      roughness: 1
    });

    const moon = new THREE.Mesh(moonGeometry, moonMaterial);
    moon.position.x = 12;
    moonPivot.add(moon);
  }

  solarPlanets.push({
    orbitGroup,
    planet,
    orbitRadius: data.orbitRadius,
    orbitSpeed: data.orbitSpeed,
    angle: data.startAngle,
    spinSpeed: data.spinSpeed || 0.15
  });
}

function createSolarSystem() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050711);

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    4000
  );

  camera.position.set(0, 45, 310);
  camera.rotation.order = "YXZ";
  yaw = 0;
  pitch = -0.08;
  camera.rotation.set(pitch, yaw, 0);

  const ambientLight = new THREE.HemisphereLight(0xa8bbff, 0x17121c, 1.45);
  scene.add(ambientLight);

  const sunLight = new THREE.PointLight(0xffd69a, 30000, 0, 2);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  const sunGeometry = new THREE.SphereGeometry(30, 48, 32);
  const sunMaterial = new THREE.MeshStandardMaterial({
    color: 0xffa928,
    emissive: 0xff7900,
    emissiveIntensity: 2.5,
    roughness: 0.65
  });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  scene.add(sun);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(39, 32, 24),
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

  const planets = [
    {
      name: "Mercury",
      color: 0x96928c,
      orbitColor: 0xa7a7a7,
      size: 4,
      orbitRadius: 100,
      orbitSpeed: 0.23,
      startAngle: 1.1,
      spinSpeed: 0.2
    },
    {
      name: "Venus",
      color: 0xd8bd83,
      orbitColor: 0xcab98d,
      size: 7,
      orbitRadius: 140,
      orbitSpeed: 0.17,
      startAngle: 2.4,
      spinSpeed: 0.12
    },
    {
      name: "Earth",
      color: 0x347fe0,
      orbitColor: 0x63a9ff,
      size: 8,
      orbitRadius: 190,
      orbitSpeed: 0.13,
      startAngle: 0.5,
      spinSpeed: 0.55,
      hasMoon: true,
      tilt: 0.08
    },
    {
      name: "Mars",
      color: 0xc9563d,
      orbitColor: 0xe07860,
      size: 6,
      orbitRadius: 240,
      orbitSpeed: 0.1,
      startAngle: 3.2,
      spinSpeed: 0.4
    },
    {
      name: "Jupiter",
      color: 0xc58e5a,
      orbitColor: 0xd1a477,
      size: 18,
      orbitRadius: 380,
      orbitSpeed: 0.055,
      startAngle: 2.1,
      spinSpeed: 0.8
    },
    {
      name: "Saturn",
      color: 0xd4c18a,
      orbitColor: 0xe0d2a6,
      size: 15,
      orbitRadius: 500,
      orbitSpeed: 0.04,
      startAngle: 4.2,
      spinSpeed: 0.65,
      hasRings: true
    },
    {
      name: "Uranus",
      color: 0x79d6dd,
      orbitColor: 0x91e8ed,
      size: 12,
      orbitRadius: 650,
      orbitSpeed: 0.025,
      startAngle: 5.1,
      spinSpeed: 0.4
    },
    {
      name: "Neptune",
      color: 0x3c68d8,
      orbitColor: 0x7794ff,
      size: 12,
      orbitRadius: 800,
      orbitSpeed: 0.018,
      startAngle: 0.2,
      spinSpeed: 0.38
    }
  ];

  for (const planetData of planets) {
    createPlanet(planetData);
  }

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  gameElement.prepend(renderer.domElement);

  renderer.domElement.setAttribute("aria-label", "Interactive 3D Solar System");
  renderer.domElement.setAttribute("role", "application");

  window.addEventListener("resize", handleResize);
  setupControls();
  animate();
}

function handleResize() {
  if (!camera || !renderer) {
    return;
  }

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function isControlPressed(name) {
  if (pressedControls.has(name)) {
    return true;
  }

  const keys = controlKeys[name];
  return keys.some((key) => pressedKeys.has(key));
}

function updateMovement(deltaTime) {
  if (!gameStarted) {
    return;
  }

  const forwardAmount =
    Number(isControlPressed("forward")) - Number(isControlPressed("back"));
  const rightAmount =
    Number(isControlPressed("right")) - Number(isControlPressed("left"));
  const verticalAmount =
    Number(isControlPressed("up")) - Number(isControlPressed("down"));

  if (forwardAmount === 0 && rightAmount === 0 && verticalAmount === 0) {
    return;
  }

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);

  const right = new THREE.Vector3()
    .crossVectors(forward, new THREE.Vector3(0, 1, 0))
    .normalize();

  const movement = new THREE.Vector3();
  movement.addScaledVector(forward, forwardAmount);
  movement.addScaledVector(right, rightAmount);
  movement.y += verticalAmount;

  if (movement.lengthSq() > 0) {
    movement.normalize();
    camera.position.addScaledVector(movement, movementSpeed * deltaTime);
  }
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);

  const deltaTime = Math.min(renderer.info ? 0.05 : 0.05, 0.05);

  for (const planetData of solarPlanets) {
    planetData.angle += planetData.orbitSpeed * deltaTime;
    planetData.orbitGroup.rotation.y = planetData.angle;
    planetData.planet.rotation.y += planetData.spinSpeed * deltaTime;
  }

  if (moonPivot) {
    moonPivot.rotation.y += 0.8 * deltaTime;
  }

  updateMovement(deltaTime);
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
  const controlButtons = document.querySelectorAll("[data-control]");

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
        // Pointer capture is optional; the control still works without it.
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

    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    yaw += deltaX * lookSensitivity;
    pitch -= deltaY * lookSensitivity;
    pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);

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
    const allControlKeys = Object.values(controlKeys).flat();

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
  console.error("Could not initialize the Solar System game:", error);
  showError("The 3D scene could not be initialized. Please check that WebGL is available and reload the page.");
}
