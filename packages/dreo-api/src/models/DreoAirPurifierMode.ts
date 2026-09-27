/** Confirmed native operating modes of the DR-HAP009S air purifier. */
export const DREO_AIR_PURIFIER_MODES = [
    "manual",
    "auto-regular",
    "turbo",
    "sleep",
] as const;

export type DreoAirPurifierMode =
    (typeof DREO_AIR_PURIFIER_MODES)[number];

/**
 * Checks whether a value is a confirmed DR-HAP009S operating mode.
 *
 * @param value Value reported by DREO or requested by a consumer.
 * @returns Whether the value is a confirmed air-purifier mode.
 */
export function isDreoAirPurifierMode(
    value: unknown
): value is DreoAirPurifierMode {
    return (
        typeof value === "string" &&
        (DREO_AIR_PURIFIER_MODES as readonly string[]).includes(value)
    );
}
