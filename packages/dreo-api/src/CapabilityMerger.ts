import type {
    ResolvedCapability,
    ResolvedCapabilityId,
} from "./models/ResolvedCapability.js";

export class CapabilityMerger {
    public merge(
        primary: ResolvedCapability[],
        secondary: ResolvedCapability[]
    ): ResolvedCapability[] {
        const merged = new Map<ResolvedCapabilityId, Set<string>>();

        //
        // Primary source wins.
        //
        for (const capability of primary) {
            merged.set(capability.id, new Set(capability.states));
        }

        //
        // Merge secondary source.
        //
        for (const capability of secondary) {
            const states = merged.get(capability.id);

            if (!states) {
                merged.set(capability.id, new Set(capability.states));
                continue;
            }

            for (const state of capability.states) {
                states.add(state);
            }
        }

        return [...merged.entries()]
            .map(([id, states]) => ({
                id,
                states: [...states].sort(),
            }))
            .sort((a, b) => a.id.localeCompare(b.id));
    }
}
