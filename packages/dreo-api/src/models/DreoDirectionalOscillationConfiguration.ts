/**
 * Parsed directional cruise configuration used by compatible DREO fans.
 *
 * The native `cruiseconf` tuple is ordered as:
 * vertical upper, horizontal right, vertical lower, horizontal left.
 */
export interface DreoDirectionalOscillationConfiguration {
    verticalUpper: number;

    horizontalRight: number;

    verticalLower: number;

    horizontalLeft: number;

    horizontalAngle: number;

    verticalAngle: number;
}
