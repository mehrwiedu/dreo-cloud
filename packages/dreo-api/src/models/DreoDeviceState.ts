import type { DreoAirQualityLevel } from "./DreoAirQualityLevel.js";
import type { DreoAirPurifierMode } from "./DreoAirPurifierMode.js";
import type { DreoDirectionalOscillationConfiguration } from "./DreoDirectionalOscillationConfiguration.js";
import type { DreoDirectionalOscillationMode } from "./DreoDirectionalOscillationMode.js";
import type { DreoSceneConfiguration } from "./DreoSceneConfiguration.js";
import type { DreoTimerConfiguration } from "./DreoTimerConfiguration.js";

export interface DreoDeviceState {
    power?: boolean;

    fan?: boolean;
    mainLight?: boolean;
    atmosphereLight?: boolean;
    mute?: boolean;

    moodLightLevel?: number;
    displayLevel?: number;

    windLevel?: number;
    mode?: number;
    airPurifierMode?: DreoAirPurifierMode;
    airPurifierMoodLight?: boolean;
    airPurifierMoodLightLevel?: number;
    airPurifierDisplay?: boolean;
    airPurifierPowerRecovery?: boolean;
    airPurifierPm25?: number;
    airPurifierAirQualityLevel?: DreoAirQualityLevel;

    filterLifeRemaining?: number;

    humidifierWarmMist?: boolean;

    humidityIndicatorLowerThreshold?: number;
    humidityIndicatorUpperThreshold?: number;

    directionalOscillationMode?: DreoDirectionalOscillationMode;

    directionalOscillationConfiguration?:
        DreoDirectionalOscillationConfiguration;

    brightness?: number;
    colorTemperature?: number;

    rgbPreset?: number;
    rgbEffectId?: string;

    scene?: DreoSceneConfiguration;

    powerOnTimer?: DreoTimerConfiguration;
    powerOffTimer?: DreoTimerConfiguration;

    rssi?: unknown;

    raw: Record<string, unknown>;
}
