import type { ResolvedCapabilityId } from "./models/ResolvedCapability.js";

export interface CapabilityDefinition {
    id: ResolvedCapabilityId;

    /**
     * Alle diese States müssen vorhanden sein.
     */
    required: string[];

    /**
     * Diese States gehören zu dieser Capability.
     */
    states: string[];
}

export const DREO_CAPABILITY_REGISTRY: CapabilityDefinition[] = [
    {
        id: "fan",
        required: ["poweron", "mode", "windlevel"],
        states: [
            "poweron",
            "mode",
            "windlevel",
            "fanon",
            "oscmode",
            "cruiseconf",
            "fixedconf",
        ],
    },

    {
        id: "mainLight",
        required: ["lighton", "brightness", "colortemp"],
        states: ["lighton", "brightness", "colortemp"],
    },

    {
        id: "ambientLight",
        required: ["atmon"],
        states: ["atmon", "atmbri", "rgbpresetsel", "rgbeffectid"],
    },

    {
        id: "configuration",
        required: ["muteon"],
        states: ["muteon", "childlockon"],
    },

    {
        id: "diagnostic",
        required: ["connected"],
        states: [
            "connected",
            "wifi_rssi",
            "wifi_ssid",
            "network_latency",
            "module_firmware_version",
            "mcu_firmware_version",
            "module_hardware_model",
            "mcu_hardware_model",
        ],
    },

    {
        id: "information",
        required: [],
        states: [
            "module_hardware_mac",
            "temperature",
            "timeron",
            "timeroff",
            "rgbpresetnum",
            "scenes",
        ],
    },
];
