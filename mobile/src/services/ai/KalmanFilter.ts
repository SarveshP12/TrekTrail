/**
 * KalmanFilter.ts
 *
 * 2D Extended Kalman Filter (EKF) for GPS noise reduction.
 *
 * State vector:  x = [lat, lon, vLat, vLon]
 *   - lat, lon: position in decimal degrees
 *   - vLat, vLon: velocity in degrees/second
 *
 * Motion model: constant-velocity
 *   lat' = lat + vLat * dt
 *   lon' = lon + vLon * dt
 *   vLat' = vLat
 *   vLon' = vLon
 *
 * Measurement: GPS provides [lat, lon] with accuracy (in meters).
 * We convert the GPS accuracy to approximate degrees for the
 * measurement noise covariance R.
 */

import { GPSReading } from '../location/LocationProvider';

// ─── Tiny linear-algebra helpers for 4×4 matrices ────────────────────────────
// Matrices are stored as flat Float64Array[16] in row-major order.

type Mat4 = Float64Array;
type Vec4 = Float64Array;

/** Create a 4×4 identity matrix. */
function eye4(): Mat4 {
  const m = new Float64Array(16);
  m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
  return m;
}

/** Create a 4×4 matrix from values (row-major). */
function mat4(
  a00: number, a01: number, a02: number, a03: number,
  a10: number, a11: number, a12: number, a13: number,
  a20: number, a21: number, a22: number, a23: number,
  a30: number, a31: number, a32: number, a33: number,
): Mat4 {
  const m = new Float64Array(16);
  m[0] = a00; m[1] = a01; m[2] = a02; m[3] = a03;
  m[4] = a10; m[5] = a11; m[6] = a12; m[7] = a13;
  m[8] = a20; m[9] = a21; m[10] = a22; m[11] = a23;
  m[12] = a30; m[13] = a31; m[14] = a32; m[15] = a33;
  return m;
}

/** Element-at (row, col) for a 4×4 row-major matrix. */
function el(m: Mat4, r: number, c: number): number {
  return m[r * 4 + c];
}

/** Multiply two 4×4 matrices: C = A × B. */
function mul4(A: Mat4, B: Mat4): Mat4 {
  const C = new Float64Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += el(A, r, k) * el(B, k, c);
      }
      C[r * 4 + c] = sum;
    }
  }
  return C;
}

/** Matrix + Matrix (4×4). */
function add4(A: Mat4, B: Mat4): Mat4 {
  const C = new Float64Array(16);
  for (let i = 0; i < 16; i++) C[i] = A[i] + B[i];
  return C;
}

/** Matrix - Matrix (4×4). */
function sub4(A: Mat4, B: Mat4): Mat4 {
  const C = new Float64Array(16);
  for (let i = 0; i < 16; i++) C[i] = A[i] - B[i];
  return C;
}

/** Transpose a 4×4 matrix. */
function transpose4(A: Mat4): Mat4 {
  const T = new Float64Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      T[c * 4 + r] = el(A, r, c);
    }
  }
  return T;
}

/** Scale a 4×4 matrix by scalar s. */
function scale4(A: Mat4, s: number): Mat4 {
  const C = new Float64Array(16);
  for (let i = 0; i < 16; i++) C[i] = A[i] * s;
  return C;
}

/** Matrix × vector (4×4 × 4×1 → 4×1). */
function mulVec4(A: Mat4, v: Vec4): Vec4 {
  const out = new Float64Array(4);
  for (let r = 0; r < 4; r++) {
    let sum = 0;
    for (let c = 0; c < 4; c++) {
      sum += el(A, r, c) * v[c];
    }
    out[r] = sum;
  }
  return out;
}

/**
 * Invert a 4×4 matrix using the adjugate method.
 * Returns null if the matrix is singular (det ≈ 0).
 */
function invert4(m: Mat4): Mat4 | null {
  const [
    a00, a01, a02, a03,
    a10, a11, a12, a13,
    a20, a21, a22, a23,
    a30, a31, a32, a33,
  ] = m;

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  const det =
    b00 * b11 - b01 * b10 + b02 * b09 +
    b03 * b08 - b04 * b07 + b05 * b06;

  if (Math.abs(det) < 1e-20) return null;

  const invDet = 1.0 / det;
  const inv = new Float64Array(16);

  inv[0]  = ( a11 * b11 - a12 * b10 + a13 * b09) * invDet;
  inv[1]  = (-a01 * b11 + a02 * b10 - a03 * b09) * invDet;
  inv[2]  = ( a31 * b05 - a32 * b04 + a33 * b03) * invDet;
  inv[3]  = (-a21 * b05 + a22 * b04 - a23 * b03) * invDet;
  inv[4]  = (-a10 * b11 + a12 * b08 - a13 * b07) * invDet;
  inv[5]  = ( a00 * b11 - a02 * b08 + a03 * b07) * invDet;
  inv[6]  = (-a30 * b05 + a32 * b02 - a33 * b01) * invDet;
  inv[7]  = ( a20 * b05 - a22 * b02 + a23 * b01) * invDet;
  inv[8]  = ( a10 * b10 - a11 * b08 + a13 * b06) * invDet;
  inv[9]  = (-a00 * b10 + a01 * b08 - a03 * b06) * invDet;
  inv[10] = ( a30 * b04 - a31 * b02 + a33 * b00) * invDet;
  inv[11] = (-a20 * b04 + a21 * b02 - a23 * b00) * invDet;
  inv[12] = (-a10 * b09 + a11 * b07 - a12 * b06) * invDet;
  inv[13] = ( a00 * b09 - a01 * b07 + a02 * b06) * invDet;
  inv[14] = (-a30 * b03 + a31 * b01 - a32 * b00) * invDet;
  inv[15] = ( a20 * b03 - a21 * b01 + a22 * b00) * invDet;

  return inv;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Approximate meters per degree of latitude (constant everywhere). */
const METERS_PER_DEG_LAT = 111_320;

/** Meters per degree of longitude at a given latitude. */
function metersPerDegLon(latDeg: number): number {
  return METERS_PER_DEG_LAT * Math.cos((latDeg * Math.PI) / 180);
}

// ─── GPS Kalman Filter Config ─────────────────────────────────────────────────

export interface KalmanFilterConfig {
  /** Process noise standard deviation in m/s² (how erratic the motion is).
   *  Larger values → filter trusts measurements more.
   *  Typical: 1.0 for walking, 3.0 for running, 5.0 for cycling */
  processNoiseSigma: number;

  /** Minimum GPS accuracy (meters) used in the R matrix to prevent
   *  over-trusting unrealistically high-precision fixes. */
  minMeasurementNoise: number;

  /** Maximum dt (seconds) before the filter resets.
   *  If two readings are further apart than this, we reinitialise. */
  maxDtSeconds: number;

  /** Maximum acceptable GPS accuracy (meters).
   *  Readings with accuracy worse than this are rejected entirely. */
  maxAccuracy: number;
}

const DEFAULT_CONFIG: KalmanFilterConfig = {
  processNoiseSigma: 2.0,
  minMeasurementNoise: 3.0,
  maxDtSeconds: 30,
  maxAccuracy: 100,
};

// ─── Smoothed output type ─────────────────────────────────────────────────────

export interface SmoothedGPSReading extends GPSReading {
  /** The raw (pre-filter) latitude */
  rawLatitude: number;
  /** The raw (pre-filter) longitude */
  rawLongitude: number;
  /** True if the Kalman filter produced this result; false if it was a pass-through */
  isFiltered: boolean;
  /** Estimated position uncertainty from filter covariance (meters) */
  estimatedAccuracy: number;
}

// ─── Extended Kalman Filter ───────────────────────────────────────────────────

/**
 * 2D Extended Kalman Filter for GPS noise reduction.
 *
 * Uses a constant-velocity motion model in WGS84 coordinates.
 * The "extended" aspect comes from the non-linearity of converting
 * GPS accuracy (meters) into coordinate-space noise (degrees), which
 * depends on the current latitude.
 *
 * Usage:
 * ```ts
 * const ekf = new KalmanFilter();
 * locationProvider.on('location', (raw) => {
 *   const smoothed = ekf.filter(raw);
 *   if (smoothed) { // null if reading was rejected
 *     // use smoothed.latitude, smoothed.longitude
 *   }
 * });
 * ```
 */
export class KalmanFilter {
  private config: KalmanFilterConfig;

  /** State vector: [lat, lon, vLat, vLon] */
  private x: Vec4 | null = null;

  /** Error covariance matrix P (4×4) */
  private P: Mat4 | null = null;

  /** Timestamp of the last processed reading (ms). */
  private lastTimestamp: number = 0;

  /** Count of readings processed (for diagnostics). */
  private readingCount: number = 0;

  constructor(config: Partial<KalmanFilterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── Public API ───────────────────────────────────────────────────────

  /**
   * Feed a raw GPS reading into the filter.
   *
   * @returns A smoothed GPS reading, or `null` if the reading was rejected
   *          (e.g., accuracy too poor).
   */
  filter(reading: GPSReading): SmoothedGPSReading | null {
    // Reject readings with unacceptable accuracy
    if (reading.accuracy > this.config.maxAccuracy) {
      return null;
    }

    this.readingCount++;

    // ── First reading: initialise state ──
    if (this.x === null || this.P === null) {
      return this.initialise(reading);
    }

    // ── Compute dt ──
    const dtMs = reading.timestamp - this.lastTimestamp;
    const dtSec = dtMs / 1000;

    // If gap is too large, reinitialise
    if (dtSec > this.config.maxDtSeconds || dtSec <= 0) {
      return this.initialise(reading);
    }

    // ── PREDICT ──
    this.predict(dtSec, reading.latitude);

    // ── UPDATE ──
    return this.update(reading);
  }

  /**
   * Reset the filter state. Call when starting a new trek session.
   */
  reset(): void {
    this.x = null;
    this.P = null;
    this.lastTimestamp = 0;
    this.readingCount = 0;
  }

  /**
   * Get the current estimated position without feeding a new reading.
   * Returns null if the filter has not been initialised.
   */
  getEstimate(): { latitude: number; longitude: number; vLat: number; vLon: number } | null {
    if (!this.x) return null;
    return {
      latitude: this.x[0],
      longitude: this.x[1],
      vLat: this.x[2],
      vLon: this.x[3],
    };
  }

  /**
   * Get the number of readings processed since last reset.
   */
  getReadingCount(): number {
    return this.readingCount;
  }

  // ─── Internal: Initialise ─────────────────────────────────────────────

  private initialise(reading: GPSReading): SmoothedGPSReading {
    // Initial state: position from GPS, velocity = 0
    this.x = new Float64Array([reading.latitude, reading.longitude, 0, 0]);

    // Initial covariance: high uncertainty for velocity,
    // position uncertainty from GPS accuracy
    const accDegLat = reading.accuracy / METERS_PER_DEG_LAT;
    const accDegLon = reading.accuracy / metersPerDegLon(reading.latitude);
    const posVar = Math.max(accDegLat, accDegLon) ** 2;
    const velVar = (0.001) ** 2; // ~1 m/s expressed in deg/s, squared

    this.P = mat4(
      posVar, 0,      0,      0,
      0,      posVar, 0,      0,
      0,      0,      velVar, 0,
      0,      0,      0,      velVar,
    );

    this.lastTimestamp = reading.timestamp;

    return this.buildOutput(reading, false);
  }

  // ─── Internal: Predict step ───────────────────────────────────────────

  private predict(dtSec: number, currentLat: number): void {
    const x = this.x!;
    const P = this.P!;

    // ── State transition: F = I + [[0,0,dt,0],[0,0,0,dt],[0,0,0,0],[0,0,0,0]]
    const F = mat4(
      1, 0, dtSec, 0,
      0, 1, 0,     dtSec,
      0, 0, 1,     0,
      0, 0, 0,     1,
    );

    // ── Predicted state ──
    this.x = mulVec4(F, x);

    // ── Process noise Q ──
    // Convert process noise from m/s² to deg/s²
    const sigmaLat = this.config.processNoiseSigma / METERS_PER_DEG_LAT;
    const sigmaLon = this.config.processNoiseSigma / metersPerDegLon(currentLat);

    // Piece-wise white noise jerk model:
    // Q = G * G^T * sigma²  where G = [dt²/2, dt²/2, dt, dt]
    const dt2 = dtSec * dtSec;
    const dt3 = dt2 * dtSec;
    const dt4 = dt3 * dtSec;
    const sLat2 = sigmaLat * sigmaLat;
    const sLon2 = sigmaLon * sigmaLon;

    const Q = mat4(
      dt4 / 4 * sLat2,   0,                  dt3 / 2 * sLat2,   0,
      0,                  dt4 / 4 * sLon2,    0,                  dt3 / 2 * sLon2,
      dt3 / 2 * sLat2,   0,                  dt2 * sLat2,        0,
      0,                  dt3 / 2 * sLon2,    0,                  dt2 * sLon2,
    );

    // ── Predicted covariance: P = F * P * F^T + Q ──
    const Ft = transpose4(F);
    this.P = add4(mul4(mul4(F, P), Ft), Q);
  }

  // ─── Internal: Update step ────────────────────────────────────────────

  private update(reading: GPSReading): SmoothedGPSReading {
    const x = this.x!;
    const P = this.P!;

    // ── Measurement vector z = [lat, lon] ──
    const zLat = reading.latitude;
    const zLon = reading.longitude;

    // ── Measurement matrix H (2×4 → embedded in 4×4 with zeros) ──
    // H = [[1,0,0,0],[0,1,0,0]]  but we work in 4×4 space
    // Innovation (residual): y = z - H * x
    const yLat = zLat - x[0];
    const yLon = zLon - x[1];

    // ── Measurement noise R (2×2 diagonal, embedded in the S matrix) ──
    const accuracy = Math.max(reading.accuracy, this.config.minMeasurementNoise);
    const rLat = (accuracy / METERS_PER_DEG_LAT) ** 2;
    const rLon = (accuracy / metersPerDegLon(reading.latitude)) ** 2;

    // ── Innovation covariance: S = H * P * H^T + R ──
    // Since H selects the top-left 2×2 of P, S is:
    const s00 = el(P, 0, 0) + rLat;
    const s01 = el(P, 0, 1);
    const s10 = el(P, 1, 0);
    const s11 = el(P, 1, 1) + rLon;

    // ── Invert 2×2 S matrix ──
    const detS = s00 * s11 - s01 * s10;
    if (Math.abs(detS) < 1e-30) {
      // Degenerate: skip update, return predicted state
      this.lastTimestamp = reading.timestamp;
      return this.buildOutput(reading, true);
    }
    const invDetS = 1.0 / detS;
    const si00 =  s11 * invDetS;
    const si01 = -s01 * invDetS;
    const si10 = -s10 * invDetS;
    const si11 =  s00 * invDetS;

    // ── Kalman gain: K = P * H^T * S^{-1} ──
    // P * H^T gives columns 0,1 of P (4×2).  Then multiply by S^{-1} (2×2).
    // K is 4×2.  We store as K[row][col].
    const K = new Float64Array(8); // 4 rows × 2 cols
    for (let r = 0; r < 4; r++) {
      const ph0 = el(P, r, 0); // P * H^T col 0
      const ph1 = el(P, r, 1); // P * H^T col 1
      K[r * 2 + 0] = ph0 * si00 + ph1 * si10;
      K[r * 2 + 1] = ph0 * si01 + ph1 * si11;
    }

    // ── Updated state: x = x + K * y ──
    const xNew = new Float64Array(4);
    for (let r = 0; r < 4; r++) {
      xNew[r] = x[r] + K[r * 2] * yLat + K[r * 2 + 1] * yLon;
    }
    this.x = xNew;

    // ── Updated covariance: P = (I - K * H) * P ──
    // K*H is 4×4 where (K*H)[r][c] = K[r][0]*H[0][c] + K[r][1]*H[1][c]
    //                                = K[r][0] if c==0, K[r][1] if c==1, 0 otherwise
    const KH = mat4(
      K[0], K[1], 0, 0,
      K[2], K[3], 0, 0,
      K[4], K[5], 0, 0,
      K[6], K[7], 0, 0,
    );
    const I_KH = sub4(eye4(), KH);
    this.P = mul4(I_KH, P);

    // Enforce symmetry to prevent numerical drift
    this.enforceSymmetry();

    this.lastTimestamp = reading.timestamp;
    return this.buildOutput(reading, true);
  }

  // ─── Internal: Helpers ────────────────────────────────────────────────

  /** Enforce symmetry on P to prevent numerical drift. */
  private enforceSymmetry(): void {
    const P = this.P!;
    for (let r = 0; r < 4; r++) {
      for (let c = r + 1; c < 4; c++) {
        const avg = (el(P, r, c) + el(P, c, r)) / 2;
        P[r * 4 + c] = avg;
        P[c * 4 + r] = avg;
      }
    }
  }

  /** Build the output SmoothedGPSReading from current state. */
  private buildOutput(reading: GPSReading, isFiltered: boolean): SmoothedGPSReading {
    const x = this.x!;
    const P = this.P!;

    // Estimated accuracy from covariance diagonal (position terms)
    const posVarLat = el(P, 0, 0);
    const posVarLon = el(P, 1, 1);
    const estAccLat = Math.sqrt(Math.abs(posVarLat)) * METERS_PER_DEG_LAT;
    const estAccLon = Math.sqrt(Math.abs(posVarLon)) * metersPerDegLon(x[0]);
    const estimatedAccuracy = Math.sqrt(estAccLat ** 2 + estAccLon ** 2) / Math.SQRT2;

    return {
      ...reading,
      latitude: x[0],
      longitude: x[1],
      rawLatitude: reading.latitude,
      rawLongitude: reading.longitude,
      isFiltered,
      estimatedAccuracy,
      accuracy: Math.min(reading.accuracy, estimatedAccuracy),
    };
  }
}
