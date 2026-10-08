// ============================================================
// PLANET CREATION
// ============================================================

function createPlanet(data) {
  const group = new THREE.Group();

  const geometry = new THREE.SphereGeometry(
    data.radius * SOLAR_SYSTEM_SCALE,
    data.segments || 48,
    data.segments || 48
  );

  let material;

  if (data.isSun) {
    material = new THREE.MeshBasicMaterial({
      map: data.texture || null
    });
  } else {
    material = new THREE.MeshStandardMaterial({
      map: data.texture || null,
      roughness: data.roughness ?? 0.9,
      metalness: data.metalness ?? 0
    });
  }

  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  if (data.isSun) {
    const glowGeometry = new THREE.SphereGeometry(
      data.radius * SOLAR_SYSTEM_SCALE * 1.08,
      32,
      32
    );

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    group.add(glow);

    const spriteMaterial = new THREE.SpriteMaterial({
      map: sunGlowTexture,
      color: 0xffaa33,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(
      data.radius * SOLAR_SYSTEM_SCALE * 5,
      data.radius * SOLAR_SYSTEM_SCALE * 5,
      1
    );

    group.add(sprite);
  }

  if (data.ringTexture) {
    const ringGeometry = new THREE.RingGeometry(
      data.ringInnerRadius * SOLAR_SYSTEM_SCALE,
      data.ringOuterRadius * SOLAR_SYSTEM_SCALE,
      96
    );

    const ringMaterial = new THREE.MeshStandardMaterial({
      map: data.ringTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 1
    });

    const rings = new THREE.Mesh(ringGeometry, ringMaterial);

    rings.rotation.x = Math.PI / 2;

    group.add(rings);
  }

  group.userData.bodyData = data;
  group.userData.visualMesh = mesh;

  return group;
}


// ============================================================
// CREATE SOLAR SYSTEM
// ============================================================

for (const planet of solarPlanets) {
  planet.mesh = createPlanet(planet);

  if (planet.isSun) {
    planet.mesh.position.set(0, 0, 0);
    solarSystemRoot.add(planet.mesh);
  } else {
    solarSystemRoot.add(planet.mesh);
  }
}


// ============================================================
// MOON
// ============================================================

if (moonData) {
  moonData.mesh = createPlanet(moonData);
  solarSystemRoot.add(moonData.mesh);
}


// ============================================================
// UPDATE PLANET POSITIONS
// ============================================================

function updatePlanetPositions() {
  for (const planet of solarPlanets) {
    if (planet.isSun) {
      planet.mesh.position.set(0, 0, 0);
      continue;
    }

    const orbitRadius = planet.orbitRadius * SOLAR_SYSTEM_SCALE;

    const angle =
      planet.meanAnomalyAtJ2000 +
      (TWO_PI * astronomicalDays) / planet.orbitalPeriodDays;

    planet.mesh.position.set(
      Math.cos(angle) * orbitRadius,
      0,
      Math.sin(angle) * orbitRadius
    );

    planet.mesh.rotation.y =
      getPlanetRotationAngle(planet, astronomicalDate);
  }

  updateMoonPosition();
}


// ============================================================
// MOON POSITION
// ============================================================

function updateMoonPosition() {
  if (!moonData || !moonData.mesh) return;

  const lunarState = getLunarPhaseState(astronomicalDate);

  const moonAngle = lunarState.moonLongitudeRadians;

  const orbitRadius =
    moonData.orbitRadius * SOLAR_SYSTEM_SCALE;

  const earth = solarPlanets.find(
    (planet) => planet.name === "Earth"
  );

  if (!earth || !earth.mesh) return;

  const earthPosition = earth.mesh.position;

  moonData.mesh.position.set(
    earthPosition.x + Math.cos(moonAngle) * orbitRadius,
    earthPosition.y + Math.sin(moonData.inclinationRadians) *
      Math.sin(moonAngle) * orbitRadius,
    earthPosition.z + Math.sin(moonAngle) * orbitRadius
  );

  moonData.mesh.rotation.y =
    getMoonRotationAngle(astronomicalDate);
}


// ============================================================
// EARTH DAY / NIGHT ROTATION
// ============================================================

function updateEarthRotation() {
  const earth = solarPlanets.find(
    (planet) => planet.name === "Earth"
  );

  if (!earth || !earth.mesh) return;

  earth.mesh.rotation.y =
    getEarthRotationAngleRadians(astronomicalDate);
}


// ============================================================
// DISTANCE LABELS
// ============================================================

function updatePlanetLabels() {
  for (const planet of solarPlanets) {
    if (!planet.mesh || !planet.label) continue;

    const distance = camera.position.distanceTo(
      planet.mesh.getWorldPosition(tempVector)
    );

    planet.label.visible = !cinematicMode && distance < LABEL_MAX_DISTANCE;
  }

  if (moonData?.mesh && moonData.label) {
    const distance = camera.position.distanceTo(
      moonData.mesh.getWorldPosition(tempVector)
    );

    moonData.label.visible =
      !cinematicMode && distance < LABEL_MAX_DISTANCE;
  }
}


// ============================================================
// CAMERA / BODY DISTANCE
// ============================================================

function updateDistanceDisplay() {
  if (!distanceDisplay) return;

  let nearestDistance = Infinity;
  let nearestName = "";

  for (const planet of solarPlanets) {
    if (!planet.mesh) continue;

    const worldPosition = planet.mesh.getWorldPosition(tempVector);

    const distance = camera.position.distanceTo(worldPosition);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestName = planet.name;
    }
  }

  if (moonData?.mesh) {
    const worldPosition =
      moonData.mesh.getWorldPosition(tempVector);

    const distance =
      camera.position.distanceTo(worldPosition);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestName = "Moon";
    }
  }

  if (nearestName) {
    distanceDisplay.textContent =
      `${nearestName}: ${formatDistance(nearestDistance)}`;
  }
}


// ============================================================
// CINEMATIC MODE
// ============================================================

function setCinematicMode(enabled) {
  cinematicMode = enabled;

  document.body.classList.toggle(
    "cinematic-mode",
    cinematicMode
  );

  for (const planet of solarPlanets) {
    if (planet.label) {
      planet.label.visible = !cinematicMode;
    }

    if (planet.orbitLine) {
      planet.orbitLine.visible = !cinematicMode;
    }
  }

  if (moonData?.label) {
    moonData.label.visible = !cinematicMode;
  }

  if (moonData?.orbitLine) {
    moonData.orbitLine.visible = !cinematicMode;
  }
}


// ============================================================
// NORTH BUTTON
// ============================================================

function pointCameraNorth() {
  camera.rotation.order = "YXZ";
  camera.rotation.x = 0;
  camera.rotation.y = 0;
  camera.rotation.z = 0;
}


// ============================================================
// TELEPORT TO PLANET
// ============================================================

function teleportToPlanet(planet) {
  if (!planet || !planet.mesh) return;

  const targetPosition =
    planet.mesh.getWorldPosition(new THREE.Vector3());

  const direction = new THREE.Vector3(
    1,
    0.15,
    1
  ).normalize();

  const safeDistance =
    (planet.radius || 1) *
    SOLAR_SYSTEM_SCALE *
    8;

  camera.position.copy(
    targetPosition
  ).addScaledVector(
    direction,
    safeDistance
  );

  camera.lookAt(targetPosition);

  resetVirtualJoystick();
}


// ============================================================
// MOVEMENT SPEED
// ============================================================

// CHILL IS NOW 50% SLOWER THAN THE OLD 120.
// 120 -> 60.
//
// Superman remains completely separate.

const CHILL_SPEED = 60;
const SUPERMAN_SPEED = 750_000;
const SPEED_ACCELERATION = 450_000;

let currentMovementSpeed = CHILL_SPEED;
let supermanMode = false;


// ============================================================
// VIRTUAL JOYSTICK STATE
// ============================================================

const virtualJoystickState = {
  x: 0,
  y: 0,
  active: false,
  pointerId: null
};


// ============================================================
// MOVEMENT SPEED UPDATE
// ============================================================

function updateMovementSpeed(deltaTime) {
  if (supermanMode) {
    currentMovementSpeed = Math.min(
      SUPERMAN_SPEED,
      currentMovementSpeed + SPEED_ACCELERATION * deltaTime
    );
  } else {
    currentMovementSpeed = CHILL_SPEED;
  }
}


// ============================================================
// CONTROL STATE
// ============================================================

const controlState = {
  up: false,
  down: false,
  forward: false,
  back: false,
  left: false,
  right: false
};

function isControlPressed(control) {
  return !!controlState[control];
}


// ============================================================
// MOVEMENT
// ============================================================

function updateMovement(deltaTime) {
  updateMovementSpeed(deltaTime);

  if (!gameStarted) return false;

  tempDirection.set(0, 0, 0);

  camera.getWorldDirection(tempDirection);

  tempRight.crossVectors(
    tempDirection,
    worldUp
  ).normalize();

  const joystickX =
    virtualJoystickState.x;

  const joystickY =
    virtualJoystickState.y;

  const joystickActive =
    Math.hypot(joystickX, joystickY) > 0.001;

  const movingUp =
    isControlPressed("up");

  const movingDown =
    isControlPressed("down");

  const movingForward =
    isControlPressed("forward");

  const movingBack =
    isControlPressed("back");

  const movingLeft =
    isControlPressed("left");

  const movingRight =
    isControlPressed("right");

  if (
    !joystickActive &&
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


  // ==========================================================
  // JOYSTICK
  //
  // IMPORTANT:
  // The joystick does NOT control speed based on how far
  // you push it.
  //
  // Any meaningful push = current movement speed.
  //
  // Chill = 60 units/sec.
  // Superman = existing Superman speed system.
  // ==========================================================

  if (joystickActive) {
    const joystickLength =
      Math.hypot(joystickX, joystickY);

    const normalizedX =
      joystickX / joystickLength;

    const normalizedY =
      joystickY / joystickLength;

    proposedPosition.addScaledVector(
      tempDirection,
      -normalizedY * currentMovementSpeed * deltaTime
    );

    proposedPosition.addScaledVector(
      tempRight,
      normalizedX * currentMovementSpeed * deltaTime
    );
  }


  // ==========================================================
  // EXISTING KEYBOARD HORIZONTAL CONTROLS
  // ==========================================================

  if (movingForward) {
    proposedPosition.addScaledVector(
      tempDirection,
      currentMovementSpeed * deltaTime
    );
  }

  if (movingBack) {
    proposedPosition.addScaledVector(
      tempDirection,
      -currentMovementSpeed * deltaTime
    );
  }

  if (movingRight) {
    proposedPosition.addScaledVector(
      tempRight,
      currentMovementSpeed * deltaTime
    );
  }

  if (movingLeft) {
    proposedPosition.addScaledVector(
      tempRight,
      -currentMovementSpeed * deltaTime
    );
  }


  // ==========================================================
  // UP / DOWN
  // ==========================================================

  if (movingUp) {
    proposedPosition.addScaledVector(
      worldUp,
      currentMovementSpeed * deltaTime
    );
  }

  if (movingDown) {
    proposedPosition.addScaledVector(
      worldUp,
      -currentMovementSpeed * deltaTime
    );
  }


  // ==========================================================
  // COLLISION
  //
  // DO NOT CHANGE THIS.
  // This is the working tangent/sliding collision system.
  // ==========================================================

  resolveBodyCollisions(
    previousPosition,
    proposedPosition
  );

  camera.position.copy(
    proposedPosition
  );

  return true;
}


// ============================================================
// JOYSTICK POSITION
// ============================================================

function updateVirtualJoystickFromPointer(
  clientX,
  clientY
) {
  const joystick =
    $("movement-joystick");

  const joystickThumb =
    $("joystick-thumb");

  if (!joystick || !joystickThumb) return;

  const joystickRect =
    joystick.getBoundingClientRect();

  const thumbRect =
    joystickThumb.getBoundingClientRect();

  const centerX =
    joystickRect.left +
    joystickRect.width * 0.5;

  const centerY =
    joystickRect.top +
    joystickRect.height * 0.5;

  const rawX =
    clientX - centerX;

  const rawY =
    clientY - centerY;

  const thumbRadius =
    thumbRect.width * 0.5;

  const maxDistance =
    Math.max(
      1,
      joystickRect.width * 0.5 -
      thumbRadius
    );

  const distance =
    Math.hypot(rawX, rawY);

  let scale = 1;

  if (distance > maxDistance) {
    scale =
      maxDistance / distance;
  }

  const offsetX =
    rawX * scale;

  const offsetY =
    rawY * scale;

  virtualJoystickState.x =
    THREE.MathUtils.clamp(
      offsetX / maxDistance,
      -1,
      1
    );

  virtualJoystickState.y =
    THREE.MathUtils.clamp(
      offsetY / maxDistance,
      -1,
      1
    );

  joystickThumb.style.transform =
    `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
}


// ============================================================
// RESET JOYSTICK
// ============================================================

function resetVirtualJoystick() {
  virtualJoystickState.active = false;
  virtualJoystickState.pointerId = null;
  virtualJoystickState.x = 0;
  virtualJoystickState.y = 0;

  const joystickThumb =
    $("joystick-thumb");

  if (joystickThumb) {
    joystickThumb.style.transform =
      "translate(-50%, -50%)";

    joystickThumb.classList.remove(
      "active"
    );
  }
}


// ============================================================
// CONTROLS SETUP
// ============================================================

function setupControls() {

  // ----------------------------------------------------------
  // VERTICAL BUTTONS ONLY
  //
  // This deliberately selects ONLY Up and Down.
  // The old horizontal D-pad is no longer used.
  // ----------------------------------------------------------

  const controlButtons =
    document.querySelectorAll(
      '[data-control="up"], [data-control="down"]'
    );

  controlButtons.forEach((button) => {
    const control =
      button.dataset.control;

    const press = (event) => {
      event.preventDefault();

      if (!gameStarted) return;

      controlState[control] = true;

      button.classList.add("active");

      try {
        button.setPointerCapture(
          event.pointerId
        );
      } catch {}
    };

    const release = (event) => {
      event.preventDefault();

      controlState[control] = false;

      button.classList.remove("active");
    };

    button.addEventListener(
      "pointerdown",
      press
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
        controlState[control] = false;
        button.classList.remove("active");
      }
    );

    button.addEventListener(
      "contextmenu",
      (event) => {
        event.preventDefault();
      }
    );
  });


  // ----------------------------------------------------------
  // VIRTUAL JOYSTICK
  // ----------------------------------------------------------

  const joystick =
    $("movement-joystick");

  const joystickThumb =
    $("joystick-thumb");

  if (joystick && joystickThumb) {

    joystick.style.touchAction =
      "none";

    joystick.addEventListener(
      "pointerdown",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!gameStarted) return;

        if (
          virtualJoystickState.active
        ) {
          return;
        }

        virtualJoystickState.active =
          true;

        virtualJoystickState.pointerId =
          event.pointerId;

        joystickThumb.classList.add(
          "active"
        );

        try {
          joystick.setPointerCapture(
            event.pointerId
          );
        } catch {}

        updateVirtualJoystickFromPointer(
          event.clientX,
          event.clientY
        );
      }
    );

    joystick.addEventListener(
      "pointermove",
      (event) => {
        if (
          !virtualJoystickState.active
        ) {
          return;
        }

        if (
          event.pointerId !==
          virtualJoystickState.pointerId
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        updateVirtualJoystickFromPointer(
          event.clientX,
          event.clientY
        );
      }
    );

    const releaseJoystick = (
      event
    ) => {
      if (
        virtualJoystickState.active &&
        event.pointerId !== undefined &&
        event.pointerId !==
          virtualJoystickState.pointerId
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      resetVirtualJoystick();
    };

    joystick.addEventListener(
      "pointerup",
      releaseJoystick
    );

    joystick.addEventListener(
      "pointercancel",
      releaseJoystick
    );

    joystick.addEventListener(
      "lostpointercapture",
      () => {
        resetVirtualJoystick();
      }
    );

    joystick.addEventListener(
      "contextmenu",
      (event) => {
        event.preventDefault();
      }
    );
  }
}


// ============================================================
// KEYBOARD CONTROLS
// ============================================================

window.addEventListener(
  "keydown",
  (event) => {
    switch (event.code) {

      case "KeyW":
      case "ArrowUp":
        controlState.forward = true;
        break;

      case "KeyS":
      case "ArrowDown":
        controlState.back = true;
        break;

      case "KeyA":
      case "ArrowLeft":
        controlState.left = true;
        break;

      case "KeyD":
      case "ArrowRight":
        controlState.right = true;
        break;

      case "Space":
        controlState.up = true;
        break;

      case "ShiftLeft":
      case "ShiftRight":
        controlState.down = true;
        break;
    }
  }
);


window.addEventListener(
  "keyup",
  (event) => {
    switch (event.code) {

      case "KeyW":
      case "ArrowUp":
        controlState.forward = false;
        break;

      case "KeyS":
      case "ArrowDown":
        controlState.back = false;
        break;

      case "KeyA":
      case "ArrowLeft":
        controlState.left = false;
        break;

      case "KeyD":
      case "ArrowRight":
        controlState.right = false;
        break;

      case "Space":
        controlState.up = false;
        break;

      case "ShiftLeft":
      case "ShiftRight":
        controlState.down = false;
        break;
    }
  }
);


// ============================================================
// WINDOW BLUR SAFETY
// ============================================================

window.addEventListener(
  "blur",
  () => {
    for (const key in controlState) {
      controlState[key] = false;
    }

    resetVirtualJoystick();
  }
);


// ============================================================
// CREATOR / SUPERMAN
// ============================================================

function setSupermanMode(enabled) {
  supermanMode = enabled;

  if (supermanMode) {
    currentMovementSpeed =
      CHILL_SPEED;
  } else {
    currentMovementSpeed =
      CHILL_SPEED;
  }
}


// ============================================================
// START GAME
// ============================================================

function startGame() {
  gameStarted = true;

  currentMovementSpeed =
    CHILL_SPEED;

  resetVirtualJoystick();

  if (startScreen) {
    startScreen.style.display =
      "none";
  }

  setupControls();

  animate();
}


// ============================================================
// INITIALIZE
// ============================================================

setupControls();

updatePlanetPositions();
updateEarthRotation();

animate();
