/**
 * Structured representation of the DREO `scenes` state used by sleep light.
 */
export interface DreoSceneConfiguration {
    /**
     * DREO scene mode.
     *
     * Observed values:
     * - 0: scene inactive
     * - 3: sleep light active
     */
    mode: number;

    /**
     * Configured duration in seconds.
     */
    du: number;

    /**
     * Minimum brightness reached during dimming.
     */
    minbri: number;

    /**
     * Main-light brightness at the start of the scene.
     */
    maxbri: number;
}
