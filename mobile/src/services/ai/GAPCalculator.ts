/**
 * Grade Adjusted Pace (GAP) Calculator
 * 
 * Computes an adjusted pace that reflects the effort required 
 * to run/trek on hilly terrain compared to flat terrain.
 * 
 * Based on the Minetti et al. (2002) energy cost of walking/running on inclines.
 */

export class GAPCalculator {
  /**
   * Calculate Grade Adjusted Pace string (e.g. "5:30 /km").
   * @param speedMps Speed in meters per second
   * @param grade Grade as a decimal (e.g., 0.05 for 5%)
   * @returns Formatted pace string "MM:SS /km"
   */
  static calculateGAPString(speedMps: number, grade: number): string {
    const gapMps = this.calculateGAP(speedMps, grade);
    if (gapMps <= 0.1) return "--:-- /km";

    // seconds per km
    const paceSecPerKm = 1000 / gapMps;
    if (paceSecPerKm > 3600) return ">60:00 /km"; // Cap at 60 min/km

    const mins = Math.floor(paceSecPerKm / 60);
    const secs = Math.floor(paceSecPerKm % 60);
    
    return `${mins}:${secs.toString().padStart(2, "0")} /km`;
  }

  /**
   * Calculate Grade Adjusted Pace (in m/s).
   * @param speedMps Current speed in meters per second
   * @param grade Current slope grade (rise / run) as decimal
   * @returns Adjusted speed estimating the equivalent effort on flat terrain
   */
  static calculateGAP(speedMps: number, grade: number): number {
    if (speedMps <= 0) return 0;
    
    // Cap grade to realistic bounds for models (-45% to +45%)
    const clampedGrade = Math.max(-0.45, Math.min(0.45, grade));
    
    // Minetti's polynomial for cost of running/walking on inclines
    // Normalized cost C is relative to flat ground (grade = 0)
    // C(g) = 155.4g^5 - 30.4g^4 - 43.3g^3 + 46.3g^2 + 19.5g + 3.6 
    // Divided by flat cost (3.6 J/(kg*m))
    
    const g = clampedGrade;
    const costRunning = 155.4 * Math.pow(g, 5) 
                      - 30.4 * Math.pow(g, 4) 
                      - 43.3 * Math.pow(g, 3) 
                      + 46.3 * Math.pow(g, 2) 
                      + 19.5 * g 
                      + 3.6;
    
    const costFlat = 3.6;
    
    // Effort factor is how much harder it is than flat
    // If factor = 1.5, it's 1.5x harder, meaning your flat speed would be 1.5x higher
    const effortFactor = costRunning / costFlat;
    
    // Avoid extreme edge cases or negative costs
    if (effortFactor <= 0.2) return speedMps * 0.2;
    
    const gapSpeedMps = speedMps * effortFactor;
    return gapSpeedMps;
  }
}
