/**
 * Confirmed numeric air-quality categories reported by the DR-HAP009S.
 *
 * Human-readable category names are intentionally not encoded here because
 * the complete label mapping has not yet been confirmed.
 */
export const DREO_AIR_QUALITY_LEVELS = [
    1,
    2,
    3,
    4,
] as const;

export type DreoAirQualityLevel =
    (typeof DREO_AIR_QUALITY_LEVELS)[number];

/**
 * Checks whether a reported value is a confirmed numeric air-quality level.
 *
 * @param value Value reported by DREO.
 * @returns Whether the value is an air-quality level from 1 through 4.
 */
export function isDreoAirQualityLevel(
    value: unknown
): value is DreoAirQualityLevel {
    return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        (
            DREO_AIR_QUALITY_LEVELS as readonly number[]
        ).includes(value)
    );
}
