import type { Room } from "./Room.js";

/**
 * Represents a Dreo family/home visible to the authenticated account.
 */
export interface Family {
    familyId: string;
    familyName: string;

    owner: boolean;

    userId: string | null;
    userName: string | null;

    avatarType: string;
    avatarValue: string;

    rooms: Room[];
}
