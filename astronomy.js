
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

// ============================================
// ASTRONOMY MODULE
// Julian dates, new Moon calculations, and
// lunar phase information.
// ============================================

const DAY_MS = 24 * 60 * 60 * 1000;

// ============================================
// MEEUS NEW MOON MODEL
// ============================================

export const NEW_MOON_BASE_JD = 2451550.09765;

export const SYNODIC_MONTH_DAYS = 29.530588853;

// ============================================
// DATE / JULIAN DATE CONVERSION
// ============================================

export function julianDateFromDate(date) {
  return (
    2440587.5 +
    date.getTime() / DAY_MS
  );
}

export function dateFromJulianDate(julianDate) {
  return new Date(
    (
      julianDate -
      2440587.5
    ) * DAY_MS
  );
}

// ============================================
// MEEUS NEW MOON JULIAN DATE
// ============================================

export function getMeeusNewMoonJulianDate(k) {
  const T = k / 1236.85;

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

// ============================================
// LUNAR PHASE STATE
// ============================================

export function getLunarPhaseState(date) {
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

  let previousK = approximateK;
  let nextK = approximateK + 1;

  let previousNewMoonJD =
    getMeeusNewMoonJulianDate(previousK);

  let nextNewMoonJD =
    getMeeusNewMoonJulianDate(nextK);

  while (previousNewMoonJD > julianDate) {
    previousK -= 1;

    previousNewMoonJD =
      getMeeusNewMoonJulianDate(previousK);
  }

  while (nextNewMoonJD <= julianDate) {
    nextK += 1;

    nextNewMoonJD =
      getMeeusNewMoonJulianDate(nextK);
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
    cycleFraction * Math.PI * 2;

  return {
    phaseAngle,

    illuminationFraction:
      (1 - Math.cos(phaseAngle)) * 0.5,

    previousNewMoon:
      dateFromJulianDate(previousNewMoonJD),

    nextNewMoon:
      dateFromJulianDate(nextNewMoonJD)
  };
}


/* =========================================================
   EARTH SIDEREAL ROTATION
   ========================================================= */

const JULIAN_CENTURY_DAYS = 36_525;

function normalizeDegrees(angle) {
  angle %= 360;

  if (angle < 0) {
    angle += 360;
  }

  return angle;
}

function normalizeRadians(angle) {
  const fullTurn = Math.PI * 2;

  angle %= fullTurn;

  if (angle < 0) {
    angle += fullTurn;
  }

  return angle;
}

export function getGreenwichSiderealTimeDegrees(date) {
  const julianDate =
    julianDateFromDate(date);

  const centuries =
    (julianDate - 2451545.0) /
    JULIAN_CENTURY_DAYS;

  const gmst =
    280.46061837 +
    360.98564736629 *
      (julianDate - 2451545.0) +
    0.000387933 *
      centuries *
      centuries -
    (centuries * centuries * centuries) /
      38_710_000;

  return normalizeDegrees(gmst);
}

export function getEarthRotationAngleRadians(date) {
  const siderealDegrees =
    getGreenwichSiderealTimeDegrees(date);

  return normalizeRadians(
    THREE.MathUtils.degToRad(
      siderealDegrees + 90
    )
  );
}
