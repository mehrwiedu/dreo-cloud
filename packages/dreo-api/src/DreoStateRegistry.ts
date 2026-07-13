import type { DiscoveredState } from "./models/DiscoveredState.js";

export type DreoStateDefinition = Omit<DiscoveredState, "key" | "valueType">;

export const DREO_STATE_REGISTRY: Record<string, DreoStateDefinition> = {
    // --------------------------------------------------
    // Control
    // --------------------------------------------------

    poweron: {
        known: true,
        writable: true,
        category: "control",
        description: "Device power",
        constraint: {
            type: "boolean",
        },
    },

    fanon: {
        known: true,
        writable: true,
        category: "control",
        description: "Fan power",
        constraint: {
            type: "boolean",
        },
    },

    lighton: {
        known: true,
        writable: true,
        category: "control",
        description: "Light power",
        constraint: {
            type: "boolean",
        },
    },

    atmon: {
        known: true,
        writable: true,
        category: "control",
        description: "Ambient light power",
        constraint: {
            type: "boolean",
        },
    },

    brightness: {
        known: true,
        writable: true,
        category: "control",
        description: "Light brightness",
        constraint: {
            type: "number",
            min: 0,
            max: 100,
            step: 1,
        },
    },

    atmbri: {
        known: true,
        writable: true,
        category: "control",
        description: "Ambient light brightness",
        constraint: {
            type: "number",
            min: 0,
            max: 100,
            step: 1,
        },
    },

    colortemp: {
        known: true,
        writable: true,
        category: "control",
        description: "Color temperature",
        constraint: {
            type: "number",
            min: 0,
            max: 100,
            step: 1,
        },
    },

    mode: {
        known: true,
        writable: true,
        category: "control",
        description: "Operating mode",
        constraint: {
            type: "number",
            step: 1,
        },
    },

    windlevel: {
        known: true,
        writable: true,
        category: "control",
        description: "Fan speed",
        constraint: {
            type: "number",
            min: 1,
            max: 12,
            step: 1,
        },
    },

    oscmode: {
        known: true,
        writable: true,
        category: "control",
        description: "Oscillation mode",
        constraint: {
            type: "number",
            step: 1,
        },
    },

    rgbpresetsel: {
        known: true,
        writable: true,
        category: "control",
        description: "RGB preset selection",
        constraint: {
            type: "number",
            min: 0,
            max: 4,
            step: 1,
        },
    },

    // --------------------------------------------------
    // Configuration
    // --------------------------------------------------

    muteon: {
        known: true,
        writable: true,
        category: "configuration",
        description: "Button sound",
        constraint: {
            type: "boolean",
        },
    },

    childlockon: {
        known: true,
        writable: true,
        category: "configuration",
        description: "Child lock",
        constraint: {
            type: "boolean",
        },
    },

    // --------------------------------------------------
    // Diagnostic
    // --------------------------------------------------

    connected: {
        known: true,
        writable: false,
        category: "diagnostic",
        description: "Cloud connectivity",
        constraint: {
            type: "boolean",
        },
    },

    wifi_rssi: {
        known: true,
        writable: false,
        category: "diagnostic",
        description: "WiFi signal",
        constraint: {
            type: "number",
        },
    },

    wifi_ssid: {
        known: true,
        writable: false,
        category: "diagnostic",
        description: "Connected WiFi",
        constraint: {
            type: "string",
        },
    },

    network_latency: {
        known: true,
        writable: false,
        category: "diagnostic",
        description: "Cloud latency",
        constraint: {
            type: "number",
        },
    },

    module_firmware_version: {
        known: true,
        writable: false,
        category: "diagnostic",
        description: "Module firmware",
        constraint: {
            type: "string",
        },
    },

    mcu_firmware_version: {
        known: true,
        writable: false,
        category: "diagnostic",
        description: "MCU firmware",
        constraint: {
            type: "string",
        },
    },

    module_hardware_model: {
        known: true,
        writable: false,
        category: "diagnostic",
        description: "Module hardware",
        constraint: {
            type: "string",
        },
    },

    mcu_hardware_model: {
        known: true,
        writable: false,
        category: "diagnostic",
        description: "MCU hardware",
        constraint: {
            type: "string",
        },
    },

    // --------------------------------------------------
    // Informational (bekannt, aber Bedeutung noch nicht vollständig geklärt)
    // --------------------------------------------------

    timeron: {
        known: true,
        writable: false,
        category: "information",
        description: "Timer configuration",
        constraint: {
            type: "object",
        },
    },

    timeroff: {
        known: true,
        writable: false,
        category: "information",
        description: "Timer configuration",
        constraint: {
            type: "object",
        },
    },

    temperature: {
        known: true,
        writable: false,
        category: "information",
        description: "Measured temperature",
        constraint: {
            type: "number",
        },
    },

    cruiseconf: {
        known: true,
        writable: false,
        category: "information",
        description: "Cruise mode configuration",
        constraint: {
            type: "string",
        },
    },

    fixedconf: {
        known: true,
        writable: false,
        category: "information",
        description: "Fixed mode configuration",
        constraint: {
            type: "string",
        },
    },

    rgbeffectid: {
        known: true,
        writable: false,
        category: "information",
        description: "Selected RGB effect",
        constraint: {
            type: "string",
        },
    },

    rgbpresetnum: {
        known: true,
        writable: false,
        category: "information",
        description: "Available RGB presets",
        constraint: {
            type: "number",
        },
    },

    scenes: {
        known: true,
        writable: false,
        category: "information",
        description: "Scene configuration",
        constraint: {
            type: "string",
        },
    },

    module_hardware_mac: {
        known: true,
        writable: false,
        category: "information",
        description: "Module MAC address",
        constraint: {
            type: "string",
        },
    },
};
