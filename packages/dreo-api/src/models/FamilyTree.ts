import type { Family } from "./Family.js";
import type { Device } from "./Device.js";

/**
 * Represents the complete Dreo home structure
 * visible to the authenticated account.
 */
export interface FamilyTree {
    /**
     * All visible families (homes).
     */
    families: Family[];

    /**
     * Flat index of all known devices.
     *
     * This is useful for quick lookup by deviceId
     * without traversing the family hierarchy.
     */
    devices: Device[];
}
