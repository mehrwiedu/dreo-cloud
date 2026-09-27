/**
 * Structured representation of a native DREO power timer.
 */
export interface DreoTimerConfiguration {
    /**
     * Configured duration in minutes.
     *
     * A value of zero means that the timer is inactive.
     */
    du: number;

    /**
     * Last known Unix timestamp in seconds for this timer.
     *
     * When DREO omits `ts` from a confirmed natural-completion report,
     * the SDK retains the preceding valid timestamp while setting `du`
     * to zero.
     */
    ts: number;
}
