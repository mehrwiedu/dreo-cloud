/**
 * Confirmed directional oscillation modes used by compatible DREO fans.
 *
 * The values form a bit mask:
 * - horizontal = 1
 * - vertical = 2
 * - both = 1 | 2 = 3
 */
export const DreoDirectionalOscillationMode = {
    Off: 0,
    Horizontal: 1,
    Vertical: 2,
    Both: 3,
} as const;

export type DreoDirectionalOscillationMode =
    (typeof DreoDirectionalOscillationMode)[
        keyof typeof DreoDirectionalOscillationMode
    ];
