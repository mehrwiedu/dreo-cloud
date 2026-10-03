import { DreoValidationError } from "./errors.js";
import { InputValidator } from "./InputValidator.js";
import type { Device } from "./models/Device.js";
import {
    isDreoAirQualityLevel,
    type DreoAirQualityLevel,
} from "./models/DreoAirQualityLevel.js";
import {
    DREO_AIR_PURIFIER_MODES,
    isDreoAirPurifierMode,
    type DreoAirPurifierMode,
} from "./models/DreoAirPurifierMode.js";
import type { DreoDirectionalOscillationConfiguration } from "./models/DreoDirectionalOscillationConfiguration.js";
import type { DreoDirectionalOscillationMode } from "./models/DreoDirectionalOscillationMode.js";
import type { DreoDeviceState } from "./models/DreoDeviceState.js";
import type { DreoSceneConfiguration } from "./models/DreoSceneConfiguration.js";
import type { DreoTimerConfiguration } from "./models/DreoTimerConfiguration.js";
import type { StateConstraint } from "./models/StateConstraint.js";
import { StateConstraintValidator } from "./StateConstraintValidator.js";
import { StateMapper } from "./StateMapper.js";
import type { DreoWebSocketClient } from "./websocket/DreoWebSocketClient.js";

export class DreoDevice {
    private currentState: DreoDeviceState = {
        raw: {},
    };

    private readonly stateMapper = new StateMapper();

    private readonly stateConstraintValidator = new StateConstraintValidator();

    public constructor(
        private readonly device: Device,
        private readonly websocket: DreoWebSocketClient,
        private readonly stateConstraints: ReadonlyMap<
            string,
            StateConstraint
        > = new Map(),
        initialRawState: Record<string, unknown> = {}
    ) {
        if (Object.keys(initialRawState).length > 0) {
            this.applyReport(initialRawState);
        }
    }

    public get sn(): string {
        return this.device.sn;
    }

    public get name(): string {
        return this.device.deviceName;
    }

    public get model(): string {
        return this.device.model;
    }

    public get state(): DreoDeviceState {
        return this.currentState;
    }

    /**
     * @internal
     *
     * Applies an incoming DREO WebSocket report to the local state cache.
     * This method is used internally by DreoClient.
     */
    public applyReport(reported: Record<string, unknown>): void {
        const power = this.readBoolean(
            reported,
            "poweron",
            this.currentState.power
        );
        const fan = this.readBoolean(
            reported,
            "fanon",
            this.currentState.fan
        );
        const mainLight = this.readBoolean(
            reported,
            "lighton",
            this.currentState.mainLight
        );
        const atmosphereLight = this.readBoolean(
            reported,
            "atmon",
            this.currentState.atmosphereLight
        );

        const powerOnTimerCompletionConfirmed =
            this.isTimerCompletionConfirmed(
                reported,
                "timeron",
                power,
                fan,
                mainLight,
                atmosphereLight
            );

        const powerOffTimerCompletionConfirmed =
            this.isTimerCompletionConfirmed(
                reported,
                "timeroff",
                power,
                fan,
                mainLight,
                atmosphereLight
            );

        const humidityIndicatorThresholds =
            this.readHumidityIndicatorThresholds(reported);

        this.currentState = {
            ...this.currentState,
            raw: {
                ...this.currentState.raw,
                ...reported,
            },
            power,
            fan,
            mainLight,
            atmosphereLight,
            moodLightLevel: this.readNumber(
                reported,
                "rgblevel",
                this.currentState.moodLightLevel
            ),
            displayLevel: this.readNumber(
                reported,
                "ledlevel",
                this.currentState.displayLevel
            ),
            mute: this.readBoolean(
                reported,
                "muteon",
                this.currentState.mute
            ),
            windLevel: this.readNumber(
                reported,
                "windlevel",
                this.currentState.windLevel
            ),
            mode: this.readNumber(
                reported,
                "mode",
                this.currentState.mode
            ),
            airPurifierMode: this.readAirPurifierMode(
                reported,
                this.currentState.airPurifierMode
            ),
            airPurifierMoodLight:
                this.readAirPurifierMoodLight(
                    reported,
                    this.currentState.airPurifierMoodLight
                ),
            airPurifierMoodLightLevel:
                this.readAirPurifierMoodLightLevel(
                    reported,
                    this.currentState.airPurifierMoodLightLevel
                ),
            airPurifierDisplay: this.readAirPurifierDisplay(
                reported,
                this.currentState.airPurifierDisplay
            ),
            airPurifierPowerRecovery:
                this.readAirPurifierPowerRecovery(
                    reported,
                    this.currentState.airPurifierPowerRecovery
                ),
            airPurifierPm25: this.readAirPurifierPm25(
                reported,
                this.currentState.airPurifierPm25
            ),
            airPurifierAirQualityLevel:
                this.readAirPurifierAirQualityLevel(
                    reported,
                    this.currentState.airPurifierAirQualityLevel
                ),
            filterLifeRemaining:
                this.readFilterLifeRemaining(
                    reported,
                    this.currentState.filterLifeRemaining
                ),
            humidifierWarmMist: this.readHumidifierWarmMist(
                reported,
                this.currentState.humidifierWarmMist
            ),
            humidityIndicatorLowerThreshold:
                humidityIndicatorThresholds?.lower ??
                this.currentState.humidityIndicatorLowerThreshold,
            humidityIndicatorUpperThreshold:
                humidityIndicatorThresholds?.upper ??
                this.currentState.humidityIndicatorUpperThreshold,
            directionalOscillationMode:
                this.readDirectionalOscillationMode(
                    reported,
                    this.currentState.directionalOscillationMode
                ),
            directionalOscillationConfiguration:
                this.readDirectionalOscillationConfiguration(
                    reported,
                    this.currentState
                        .directionalOscillationConfiguration
                ),
            brightness: this.readNumber(
                reported,
                "brightness",
                this.currentState.brightness
            ),
            colorTemperature: this.readNumber(
                reported,
                "colortemp",
                this.currentState.colorTemperature
            ),
            rgbPreset: this.readNumber(
                reported,
                "rgbpresetsel",
                this.currentState.rgbPreset
            ),
            rgbEffectId: this.readString(
                reported,
                "rgbeffectid",
                this.currentState.rgbEffectId
            ),
            scene: this.readSceneConfiguration(
                reported,
                "scenes",
                this.currentState.scene
            ),
            powerOnTimer: this.readTimerConfiguration(
                reported,
                "timeron",
                this.currentState.powerOnTimer,
                powerOnTimerCompletionConfirmed
            ),
            powerOffTimer: this.readTimerConfiguration(
                reported,
                "timeroff",
                this.currentState.powerOffTimer,
                powerOffTimerCompletionConfirmed
            ),
            rssi: this.readUnknown(
                reported,
                "rssi",
                this.currentState.rssi
            ),
        };
    }

    public async setPower(enabled: boolean): Promise<void> {
        await this.applyStateChange({
            power: enabled,
        });
    }

    public async setFan(enabled: boolean): Promise<void> {
        await this.applyStateChange({
            fan: enabled,
        });
    }

    public async setMainLight(enabled: boolean): Promise<void> {
        await this.applyStateChange({
            mainLight: enabled,
        });
    }

    public async setAtmosphereLight(enabled: boolean): Promise<void> {
        await this.applyStateChange({
            atmosphereLight: enabled,
        });
    }

    /**
     * Switches the humidifier mood-light indicator.
     *
     * The native DREO values confirmed for this control are 0 for off and
     * 2 for on. The device only accepts changes while it is powered on.
     */
    public async setMoodLight(enabled: boolean): Promise<void> {
        this.requirePoweredOnLevelControl(
            "rgblevel",
            "Mood light"
        );

        await this.setStates({
            rgblevel: enabled ? 2 : 0,
        });
    }

    /**
     * Switches the humidifier's internal display.
     *
     * The native DREO values confirmed for this control are 0 for off and
     * 2 for on. The device only accepts changes while it is powered on.
     */
    public async setDisplay(enabled: boolean): Promise<void> {
        this.requirePoweredOnLevelControl(
            "ledlevel",
            "Display"
        );

        await this.setStates({
            ledlevel: enabled ? 2 : 0,
        });
    }

    public async setWindLevel(level: number): Promise<void> {
        InputValidator.requireWindLevel(level);

        await this.applyStateChange({
            windLevel: level,
        });
    }

    /**
     * Sets the confirmed native operating mode of the DR-HHM001S and
     * DR-HHM003S humidifiers.
     *
     * Confirmed values:
     * - 0: manual
     * - 1: automatic humidity control
     * - 2: sleep humidity control
     *
     * This method intentionally sends only `mode`.
     *
     * @param mode Confirmed native humidifier mode.
     */
    public async setHumidifierMode(mode: number): Promise<void> {
        this.requireConfirmedHumidifierState(
            "mode",
            "Humidifier mode"
        );

        await this.setConfirmedIntegerState(
            "mode",
            mode,
            0,
            2,
            "humidifierMode"
        );
    }

    /**
     * Sets the confirmed native operating mode of the DR-HAP009S air
     * purifier.
     *
     * Confirmed values:
     * - manual
     * - auto-regular
     * - turbo
     * - sleep
     *
     * This method intentionally sends only `mode`.
     *
     * @param mode Confirmed native air-purifier mode.
     */
    public async setAirPurifierMode(
        mode: DreoAirPurifierMode
    ): Promise<void> {
        this.requireConfirmedAirPurifierState(
            "mode",
            "Air purifier mode"
        );

        if (!isDreoAirPurifierMode(mode)) {
            throw new DreoValidationError(
                `Air purifier mode must be one of: ${DREO_AIR_PURIFIER_MODES.join(
                    ", "
                )}.`
            );
        }

        const confirmedConstraint: StateConstraint = {
            type: "string",
            allowedValues: [...DREO_AIR_PURIFIER_MODES],
        };

        await this.setStates(
            {
                mode,
            },
            new Map([
                [
                    "mode",
                    confirmedConstraint,
                ],
            ])
        );
    }

    /**
     * Sets the confirmed manual fan-speed level of the DR-HAP009S air
     * purifier.
     *
     * Confirmed values are 1 through 3. The control is available only while
     * native mode `manual` is active. This method intentionally sends only
     * `windlevel`; it does not synthesize `poweron`, `fanon`, or `mode`.
     *
     * @param level Confirmed native air-purifier speed level.
     */
    public async setAirPurifierWindLevel(level: number): Promise<void> {
        this.requireConfirmedAirPurifierState(
            "windlevel",
            "Air purifier wind level"
        );
        this.requireAirPurifierOperatingMode(
            "manual",
            "Air purifier wind level"
        );

        await this.setConfirmedIntegerState(
            "windlevel",
            level,
            1,
            3,
            "airPurifierWindLevel"
        );
    }

    /**
     * Switches the confirmed mood light of the DR-HAP009S air purifier.
     *
     * This method intentionally sends only `rgbalwayson`. The stored native
     * mood-light level remains unchanged when the light is switched off.
     *
     * @param enabled Whether the air-purifier mood light should be enabled.
     */
    public async setAirPurifierMoodLight(
        enabled: boolean
    ): Promise<void> {
        this.requireConfirmedAirPurifierState(
            "rgbalwayson",
            "Air purifier mood light"
        );

        const confirmedConstraint: StateConstraint = {
            type: "boolean",
        };

        await this.setStates(
            {
                rgbalwayson: enabled,
            },
            new Map([
                [
                    "rgbalwayson",
                    confirmedConstraint,
                ],
            ])
        );
    }

    /**
     * Sets the confirmed mood-light level of the DR-HAP009S air purifier.
     *
     * Confirmed values are 1 through 3. While the mood light is already on,
     * this method sends only `rgblevel`. While it is off, the confirmed app
     * behavior is reproduced by sending `rgbalwayson=true` together with the
     * new `rgblevel`.
     *
     * @param level Confirmed native mood-light level.
     */
    public async setAirPurifierMoodLightLevel(
        level: number
    ): Promise<void> {
        this.requireConfirmedAirPurifierState(
            "rgbalwayson",
            "Air purifier mood-light level"
        );
        this.requireConfirmedAirPurifierState(
            "rgblevel",
            "Air purifier mood-light level"
        );

        InputValidator.requireIntegerRange(
            level,
            1,
            3,
            "airPurifierMoodLightLevel"
        );

        const currentEnabled = this.currentState.raw.rgbalwayson;

        if (typeof currentEnabled !== "boolean") {
            throw new DreoValidationError(
                "Air purifier mood-light level requires a confirmed current mood-light state."
            );
        }

        const params: Record<string, unknown> = currentEnabled
            ? {
                  rgblevel: level,
              }
            : {
                  rgbalwayson: true,
                  rgblevel: level,
              };

        const confirmedConstraints = new Map<
            string,
            StateConstraint
        >([
            [
                "rgbalwayson",
                {
                    type: "boolean",
                },
            ],
            [
                "rgblevel",
                {
                    type: "number",
                    min: 1,
                    max: 3,
                    step: 1,
                },
            ],
        ]);

        await this.setStates(params, confirmedConstraints);
    }

    /**
     * Switches the confirmed display of the DR-HAP009S air purifier.
     *
     * This method intentionally sends only `ledalwayson`. It does not
     * synthesize `poweron`, `mode`, `windlevel`, or mood-light values.
     *
     * @param enabled Whether the air-purifier display should be enabled.
     */
    public async setAirPurifierDisplay(
        enabled: boolean
    ): Promise<void> {
        this.requireConfirmedAirPurifierState(
            "ledalwayson",
            "Air purifier display"
        );

        const confirmedConstraint: StateConstraint = {
            type: "boolean",
        };

        await this.setStates(
            {
                ledalwayson: enabled,
            },
            new Map([
                [
                    "ledalwayson",
                    confirmedConstraint,
                ],
            ])
        );
    }

    /**
     * Configures the confirmed power-recovery behavior of the DR-HAP009S
     * air purifier.
     *
     * This method intentionally sends only `autoon`. It does not synthesize
     * `poweron`, `mode`, `windlevel`, display, or mood-light values.
     *
     * @param enabled Whether the purifier should resume after power returns.
     */
    public async setAirPurifierPowerRecovery(
        enabled: boolean
    ): Promise<void> {
        this.requireConfirmedAirPurifierState(
            "autoon",
            "Air purifier power recovery"
        );

        const confirmedConstraint: StateConstraint = {
            type: "boolean",
        };

        await this.setStates(
            {
                autoon: enabled,
            },
            new Map([
                [
                    "autoon",
                    confirmedConstraint,
                ],
            ])
        );
    }

    /**
     * Sets the manual fog-output level of the DR-HHM001S and DR-HHM003S.
     *
     * The control is available only while native mode 0 is active. This
     * method does not switch the operating mode automatically.
     *
     * @param level Confirmed manual fog level from 1 through 6.
     */
    public async setHumidifierFogLevel(level: number): Promise<void> {
        this.requireConfirmedHumidifierState(
            "foglevel",
            "Humidifier fog level"
        );
        this.requireHumidifierOperatingMode(
            0,
            "Humidifier fog level"
        );

        await this.setConfirmedIntegerState(
            "foglevel",
            level,
            1,
            6,
            "humidifierFogLevel"
        );
    }

    /**
     * Sets the automatic-mode target humidity of the DR-HHM001S and
     * DR-HHM003S.
     *
     * The control is available only while native mode 1 is active. The
     * confirmed writable range is 30 through 90 percent. This deliberately
     * overrides incomplete device metadata that may report a maximum of 80.
     *
     * @param humidity Target relative humidity in percent.
     */
    public async setHumidifierAutoTargetHumidity(
        humidity: number
    ): Promise<void> {
        this.requireConfirmedHumidifierState(
            "rhautolevel",
            "Humidifier automatic target humidity"
        );
        this.requireHumidifierOperatingMode(
            1,
            "Humidifier automatic target humidity"
        );

        await this.setConfirmedIntegerState(
            "rhautolevel",
            humidity,
            30,
            90,
            "humidifierAutoTargetHumidity"
        );
    }

    /**
     * Sets the sleep-mode target humidity of the DR-HHM001S and
     * DR-HHM003S.
     *
     * The control is available only while native mode 2 is active. This
     * method does not switch the operating mode automatically.
     *
     * @param humidity Target relative humidity in percent.
     */
    public async setHumidifierSleepTargetHumidity(
        humidity: number
    ): Promise<void> {
        this.requireConfirmedHumidifierState(
            "rhsleeplevel",
            "Humidifier sleep target humidity"
        );
        this.requireHumidifierOperatingMode(
            2,
            "Humidifier sleep target humidity"
        );

        await this.setConfirmedIntegerState(
            "rhsleeplevel",
            humidity,
            30,
            90,
            "humidifierSleepTargetHumidity"
        );
    }

    /**
     * Switches the warm-mist heater of the DR-HHM003S humidifier.
     *
     * The confirmed native command changes only `hotfogon`.
     *
     * @param enabled Whether warm mist should be enabled.
     */
    public async setHumidifierWarmMist(enabled: boolean): Promise<void> {
        this.requireConfirmedHhm003sState(
            "hotfogon",
            "Humidifier warm mist"
        );

        await this.setStates(
            {
                hotfogon: enabled,
            },
            new Map([
                [
                    "hotfogon",
                    {
                        type: "boolean",
                    },
                ],
            ])
        );
    }

    /**
     * Sets the mood-light indicator level of the DR-HHM003S humidifier.
     *
     * Confirmed native values are:
     * - 0: off
     * - 1: low
     * - 2: high
     *
     * The device accepts changes only while it is powered on.
     *
     * @param level Confirmed native mood-light level.
     */
    public async setHumidifierMoodLightLevel(level: number): Promise<void> {
        this.requireConfirmedHhm003sState(
            "rgblevel",
            "Humidifier mood-light level"
        );
        this.requirePoweredOnLevelControl(
            "rgblevel",
            "Humidifier mood-light level"
        );

        await this.setConfirmedIntegerState(
            "rgblevel",
            level,
            0,
            2,
            "humidifierMoodLightLevel"
        );
    }

    /**
     * Sets the internal display level of the DR-HHM003S humidifier.
     *
     * Confirmed native values are:
     * - 0: off
     * - 1: low
     * - 2: high
     *
     * The device accepts changes only while it is powered on.
     *
     * @param level Confirmed native display level.
     */
    public async setHumidifierDisplayLevel(level: number): Promise<void> {
        this.requireConfirmedHhm003sState(
            "ledlevel",
            "Humidifier display level"
        );
        this.requirePoweredOnLevelControl(
            "ledlevel",
            "Humidifier display level"
        );

        await this.setConfirmedIntegerState(
            "ledlevel",
            level,
            0,
            2,
            "humidifierDisplayLevel"
        );
    }

    /**
     * Confirms whether the demineralization filter is installed in the
     * DR-HHM001S or DR-HHM003S humidifier.
     *
     * The confirmed native command changes only `filteron`. The filter-life
     * counter and operating-time values are reported by the device and are
     * not synthesized or reset by the SDK.
     *
     * @param enabled Whether the installed filter should be marked active.
     */
    public async setHumidifierFilterInstalled(
        enabled: boolean
    ): Promise<void> {
        this.requireConfirmedHumidifierState(
            "filteron",
            "Humidifier filter confirmation"
        );

        await this.setStates({
            filteron: enabled,
        });
    }

    /**
     * Sets the lower humidity threshold used by the three-color humidity
     * indicator of the DR-HHM001S and DR-HHM003S humidifiers.
     *
     * The absolute confirmed range is 15 through 80 percent. The lower
     * threshold must remain at least five percentage points below the
     * current upper threshold.
     *
     * @param threshold Lower humidity-indicator threshold in percent.
     */
    public async setHumidifierLowerHumidityThreshold(
        threshold: number
    ): Promise<void> {
        await this.setHumidifierHumidityThreshold(
            "lower",
            threshold
        );
    }

    /**
     * Sets the upper humidity threshold used by the three-color humidity
     * indicator of the DR-HHM001S and DR-HHM003S humidifiers.
     *
     * The absolute confirmed range is 20 through 85 percent. The upper
     * threshold must remain at least five percentage points above the
     * current lower threshold.
     *
     * @param threshold Upper humidity-indicator threshold in percent.
     */
    public async setHumidifierUpperHumidityThreshold(
        threshold: number
    ): Promise<void> {
        await this.setHumidifierHumidityThreshold(
            "upper",
            threshold
        );
    }

    /**
     * Sets a confirmed native fan operating mode.
     *
     * Confirmed values:
     * - DR-HCF007S and DR-HCF001S: 1 through 4
     * - DR-HPF002S: 1 through 6
     *
     * This method intentionally sends only `mode`. It does not synthesize
     * changes to `poweron`, `fanon`, or `windlevel`.
     *
     * @param mode Confirmed native fan-mode value.
     */
    public async setFanMode(mode: number): Promise<void> {
        const modeRange = this.getConfirmedFanModeRange();

        if (
            !modeRange ||
            !Object.prototype.hasOwnProperty.call(
                this.currentState.raw,
                "mode"
            )
        ) {
            throw new DreoValidationError(
                "Fan mode control is not confirmed for this device."
            );
        }

        const [minimum, maximum] = modeRange;

        InputValidator.requireIntegerRange(
            mode,
            minimum,
            maximum,
            "fanMode"
        );

        await this.setStates({
            mode,
        });
    }

    /**
     * Sets the confirmed directional oscillation mode.
     *
     * The currently confirmed values for DR-HPF002S are:
     * - 0: off
     * - 1: horizontal
     * - 2: vertical
     * - 3: horizontal and vertical
     *
     * This method intentionally does not power on the device or fan because
     * that side effect has not yet been confirmed.
     */
    public async setDirectionalOscillationMode(
        mode: number
    ): Promise<void> {
        InputValidator.requireIntegerRange(
            mode,
            0,
            3,
            "directionalOscillationMode"
        );

        if (!this.supportsDirectionalOscillationMode()) {
            throw new DreoValidationError(
                "Directional oscillation mode is not confirmed for this device."
            );
        }

        await this.setStates({
            oscmode: mode,
        });
    }

    /**
     * Sets a confirmed horizontal oscillation-angle preset.
     *
     * The horizontal direction must already be active. This method does not
     * change `oscmode` and preserves the complete vertical range.
     *
     * @param angle One of 30, 60, 90, or 120 degrees.
     */
    public async setHorizontalOscillationAngle(
        angle: number
    ): Promise<void> {
        this.requireDirectionalOscillationAngle(
            angle,
            "horizontalOscillationAngle"
        );

        if (!this.isHorizontalOscillationActive()) {
            throw new DreoValidationError(
                "Horizontal oscillation angle can only be changed while horizontal oscillation is active."
            );
        }

        const configuration =
            this.requireDirectionalOscillationConfiguration();

        const halfAngle = angle / 2;

        await this.setStates({
            cruiseconf:
                this.formatDirectionalOscillationConfiguration({
                    ...configuration,
                    horizontalRight: halfAngle,
                    horizontalLeft: -halfAngle,
                    horizontalAngle: angle,
                }),
        });
    }

    /**
     * Sets a confirmed vertical oscillation-angle preset.
     *
     * The vertical direction must already be active. This method does not
     * change `oscmode` and preserves the complete horizontal range.
     *
     * The confirmed quick presets use -30 degrees as the lower endpoint
     * and adjust the upper endpoint to produce the selected angle.
     *
     * @param angle One of 30, 60, 90, or 120 degrees.
     */
    public async setVerticalOscillationAngle(
        angle: number
    ): Promise<void> {
        this.requireDirectionalOscillationAngle(
            angle,
            "verticalOscillationAngle"
        );

        if (!this.isVerticalOscillationActive()) {
            throw new DreoValidationError(
                "Vertical oscillation angle can only be changed while vertical oscillation is active."
            );
        }

        const configuration =
            this.requireDirectionalOscillationConfiguration();

        await this.setStates({
            cruiseconf:
                this.formatDirectionalOscillationConfiguration({
                    ...configuration,
                    verticalUpper: angle - 30,
                    verticalLower: -30,
                    verticalAngle: angle,
                }),
        });
    }

    public async setBrightness(value: number): Promise<void> {
        InputValidator.requirePercentage(value, "brightness");

        await this.applyStateChange({
            brightness: value,
        });
    }

    public async setColorTemperature(value: number): Promise<void> {
        InputValidator.requirePercentage(value, "colorTemperature");

        await this.applyStateChange({
            colorTemperature: value,
        });
    }

    public async setRgbPreset(value: number): Promise<void> {
        InputValidator.requireRgbPreset(value);

        await this.applyStateChange({
            rgbPreset: value,
        });
    }

    public async setAtmosphereBrightness(value: number): Promise<void> {
        InputValidator.requirePercentage(value, "atmosphereBrightness");

        await this.applyStateChange({
            atmosphereBrightness: value,
        });
    }

    public async setMute(value: boolean): Promise<void> {
        await this.setStates({
            muteon: value,
        });
    }

    /**
     * Enables or disables the native child lock.
     *
     * The confirmed native command changes only `childlockon`. No additional
     * device-state side effects are synthesized by the SDK.
     *
     * @param enabled Whether the child lock should be enabled.
     */
    public async setChildLock(enabled: boolean): Promise<void> {
        await this.setStates({
            childlockon: enabled,
        });
    }

    /**
     * Activates the native DREO sleep-light scene.
     *
     * The scene starts at the last reported main-light brightness and
     * dims down to level 1. DREO may retain this brightness while the light
     * or the complete device is currently switched off.
     *
     * @param durationMinutes Duration from 10 to 60 whole minutes.
     */
    public async setSleepLight(
        durationMinutes: number
    ): Promise<void> {
        InputValidator.requireIntegerRange(
            durationMinutes,
            10,
            60,
            "sleepLightDurationMinutes"
        );

        const maximumBrightness = this.currentState.brightness;

        if (
            typeof maximumBrightness !== "number" ||
            !Number.isFinite(maximumBrightness) ||
            maximumBrightness < 1 ||
            maximumBrightness > 100
        ) {
            throw new DreoValidationError(
                "Sleep light requires a valid reported main-light brightness."
            );
        }

        const scene: DreoSceneConfiguration = {
            mode: 3,
            du: durationMinutes * 60,
            minbri: 1,
            maxbri: maximumBrightness,
        };

        await this.setSceneConfiguration(scene);
    }

    /**
     * Disables the native DREO sleep-light scene.
     *
     * The last reported duration and brightness values are preserved while
     * only the scene mode is reset to zero.
     */
    public async disableSleepLight(): Promise<void> {
        const currentScene = this.currentState.scene;

        if (!currentScene) {
            throw new DreoValidationError(
                "Cannot disable sleep light without a reported scene configuration."
            );
        }

        await this.setSceneConfiguration({
            ...currentScene,
            mode: 0,
        });
    }

    /**
     * Starts the native DREO power-on timer.
     *
     * Devices with a `poweron` state must currently be powered off. Devices
     * without `poweron` must have all available switchable components off.
     *
     * @param durationMinutes Duration from 1 to 719 whole minutes.
     */
    public async setPowerOnTimer(durationMinutes: number): Promise<void> {
        InputValidator.requireIntegerRange(
            durationMinutes,
            1,
            719,
            "powerOnTimerDurationMinutes"
        );

        if (!this.canStartPowerOnTimer()) {
            throw new DreoValidationError(
                "Power-on timer requires the device to be in a known effectively powered-off state."
            );
        }

        await this.setTimerConfiguration("timeron", durationMinutes);
    }

    /**
     * Cancels the native DREO power-on timer.
     */
    public async cancelPowerOnTimer(): Promise<void> {
        await this.setTimerConfiguration("timeron", 0);
    }

    /**
     * Starts the native DREO power-off timer.
     *
     * Devices with separate operating-component states require at least
     * one active component. Power-only devices require `poweron` to be true.
     *
     * @param durationMinutes Duration from 1 to 719 whole minutes.
     */
    public async setPowerOffTimer(durationMinutes: number): Promise<void> {
        InputValidator.requireIntegerRange(
            durationMinutes,
            1,
            719,
            "powerOffTimerDurationMinutes"
        );

        if (!this.canStartPowerOffTimer()) {
            throw new DreoValidationError(
                "Power-off timer requires the device to be in a known effectively active state."
            );
        }

        await this.setTimerConfiguration("timeroff", durationMinutes);
    }

    /**
     * Cancels the native DREO power-off timer.
     */
    public async cancelPowerOffTimer(): Promise<void> {
        await this.setTimerConfiguration("timeroff", 0);
    }

    private async setSceneConfiguration(
        scene: DreoSceneConfiguration
    ): Promise<void> {
        await this.setStates({
            scenes: JSON.stringify(scene),
        });
    }

    private async setTimerConfiguration(
        timerKey: "timeron" | "timeroff",
        durationMinutes: number
    ): Promise<void> {
        const timer: DreoTimerConfiguration = {
            du: durationMinutes,
            ts: Math.floor(Date.now() / 1000),
        };

        await this.setStates({
            [timerKey]: timer,
        });
    }

    private canStartPowerOnTimer(): boolean {
        if (
            Object.prototype.hasOwnProperty.call(
                this.currentState.raw,
                "poweron"
            )
        ) {
            return this.currentState.power === false;
        }

        const componentStates =
            this.getAvailableSwitchableComponentStates();

        return (
            componentStates.length > 0 &&
            componentStates.every((state) => state === false)
        );
    }

    private canStartPowerOffTimer(): boolean {
        const componentStates =
            this.getAvailableSwitchableComponentStates();

        if (
            Object.prototype.hasOwnProperty.call(
                this.currentState.raw,
                "poweron"
            )
        ) {
            if (this.currentState.power !== true) {
                return false;
            }

            /*
             * Devices such as humidifiers may expose poweron without
             * separate operating-component switches. Optional indicators
             * such as rgblevel do not determine whether the device is active.
             */
            if (componentStates.length === 0) {
                return true;
            }
        }

        return componentStates.some((state) => state === true);
    }

    private getAvailableSwitchableComponentStates(): Array<
        boolean | undefined
    > {
        const candidates: Array<
            readonly [string, boolean | undefined]
        > = [
            ["fanon", this.currentState.fan],
            ["lighton", this.currentState.mainLight],
            ["atmon", this.currentState.atmosphereLight],
        ];

        return candidates
            .filter(([rawKey]) =>
                Object.prototype.hasOwnProperty.call(
                    this.currentState.raw,
                    rawKey
                )
            )
            .map(([, state]) => state);
    }

    private requirePoweredOnLevelControl(
        stateKey: "rgblevel" | "ledlevel",
        controlName: string
    ): void {
        if (
            !Object.prototype.hasOwnProperty.call(
                this.currentState.raw,
                stateKey
            )
        ) {
            throw new DreoValidationError(
                `${controlName} is not available on this device.`
            );
        }

        if (
            !Object.prototype.hasOwnProperty.call(
                this.currentState.raw,
                "poweron"
            ) ||
            this.currentState.power !== true
        ) {
            throw new DreoValidationError(
                `${controlName} can only be changed while the device is powered on.`
            );
        }
    }

    private requireConfirmedAirPurifierState(
        stateKey: string,
        controlName: string
    ): void {
        if (
            this.model !== "DR-HAP009S" ||
            !Object.prototype.hasOwnProperty.call(
                this.currentState.raw,
                stateKey
            )
        ) {
            throw new DreoValidationError(
                `${controlName} is not confirmed for this device.`
            );
        }
    }

    private requireAirPurifierOperatingMode(
        requiredMode: DreoAirPurifierMode,
        controlName: string
    ): void {
        if (
            this.currentState.airPurifierMode !== requiredMode ||
            this.currentState.raw.mode !== requiredMode
        ) {
            throw new DreoValidationError(
                `${controlName} requires air purifier mode ${requiredMode}.`
            );
        }
    }

    private readHumidifierWarmMist(
        source: Record<string, unknown>,
        previous: boolean | undefined
    ): boolean | undefined {
        if (this.model !== "DR-HHM003S") {
            return undefined;
        }

        return this.readBoolean(
            source,
            "hotfogon",
            previous
        );
    }

    private requireConfirmedHhm003sState(
        stateKey: string,
        controlName: string
    ): void {
        if (
            this.model !== "DR-HHM003S" ||
            !Object.prototype.hasOwnProperty.call(
                this.currentState.raw,
                stateKey
            )
        ) {
            throw new DreoValidationError(
                `${controlName} is not confirmed for this device.`
            );
        }
    }

    private requireConfirmedHumidifierState(
        stateKey: string,
        controlName: string
    ): void {
        if (
            !["DR-HHM001S", "DR-HHM003S"].includes(this.model) ||
            !Object.prototype.hasOwnProperty.call(
                this.currentState.raw,
                stateKey
            )
        ) {
            throw new DreoValidationError(
                `${controlName} is not confirmed for this device.`
            );
        }
    }

    private requireHumidifierOperatingMode(
        requiredMode: 0 | 1 | 2,
        controlName: string
    ): void {
        if (this.currentState.mode !== requiredMode) {
            throw new DreoValidationError(
                `${controlName} requires humidifier mode ${requiredMode}.`
            );
        }
    }

    private async setHumidifierHumidityThreshold(
        side: "lower" | "upper",
        threshold: number
    ): Promise<void> {
        this.requireConfirmedHumidifierState(
            "rgbth",
            "Humidifier humidity-indicator threshold"
        );

        const minimum = side === "lower" ? 15 : 20;
        const maximum = side === "lower" ? 80 : 85;

        InputValidator.requireIntegerRange(
            threshold,
            minimum,
            maximum,
            `humidifier${side === "lower" ? "Lower" : "Upper"}HumidityThreshold`
        );

        const lower =
            this.currentState.humidityIndicatorLowerThreshold;
        const upper =
            this.currentState.humidityIndicatorUpperThreshold;

        if (lower === undefined || upper === undefined) {
            throw new DreoValidationError(
                "Humidifier humidity-indicator thresholds require a confirmed current rgbth value."
            );
        }

        const nextLower = side === "lower" ? threshold : lower;
        const nextUpper = side === "upper" ? threshold : upper;

        if (nextUpper - nextLower < 5) {
            throw new DreoValidationError(
                "Humidifier humidity-indicator thresholds must remain at least 5 percentage points apart."
            );
        }

        await this.setStates(
            {
                rgbth: `${nextLower},${nextUpper}`,
            },
            new Map([
                [
                    "rgbth",
                    {
                        type: "string",
                    },
                ],
            ])
        );
    }

    private async setConfirmedIntegerState(
        stateKey: string,
        value: number,
        minimum: number,
        maximum: number,
        parameterName: string
    ): Promise<void> {
        InputValidator.requireIntegerRange(
            value,
            minimum,
            maximum,
            parameterName
        );

        const confirmedConstraint: StateConstraint = {
            type: "number",
            min: minimum,
            max: maximum,
            step: 1,
        };

        await this.setStates(
            {
                [stateKey]: value,
            },
            new Map([
                [
                    stateKey,
                    confirmedConstraint,
                ],
            ])
        );
    }

    private getConfirmedFanModeRange():
        | readonly [minimum: number, maximum: number]
        | undefined {
        switch (this.model) {
            case "DR-HCF007S":
            case "DR-HCF001S":
                return [1, 4];

            case "DR-HPF002S":
                return [1, 6];

            default:
                return undefined;
        }
    }

    private supportsDirectionalOscillationMode(): boolean {
        return (
            this.model === "DR-HPF002S" &&
            Object.prototype.hasOwnProperty.call(
                this.currentState.raw,
                "oscmode"
            )
        );
    }

    private readAirPurifierMode(
        source: Record<string, unknown>,
        fallback: DreoAirPurifierMode | undefined
    ): DreoAirPurifierMode | undefined {
        if (this.model !== "DR-HAP009S") {
            return fallback;
        }

        const value = source.mode;

        return isDreoAirPurifierMode(value) ? value : fallback;
    }

    private readAirPurifierMoodLight(
        source: Record<string, unknown>,
        fallback: boolean | undefined
    ): boolean | undefined {
        if (this.model !== "DR-HAP009S") {
            return fallback;
        }

        const value = source.rgbalwayson;

        return typeof value === "boolean" ? value : fallback;
    }

    private readAirPurifierMoodLightLevel(
        source: Record<string, unknown>,
        fallback: number | undefined
    ): number | undefined {
        if (this.model !== "DR-HAP009S") {
            return fallback;
        }

        const value = source.rgblevel;

        if (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            !Number.isInteger(value) ||
            value < 1 ||
            value > 3
        ) {
            return fallback;
        }

        return value;
    }

    private readAirPurifierDisplay(
        source: Record<string, unknown>,
        fallback: boolean | undefined
    ): boolean | undefined {
        if (this.model !== "DR-HAP009S") {
            return fallback;
        }

        const value = source.ledalwayson;

        return typeof value === "boolean" ? value : fallback;
    }

    private readAirPurifierPowerRecovery(
        source: Record<string, unknown>,
        fallback: boolean | undefined
    ): boolean | undefined {
        if (this.model !== "DR-HAP009S") {
            return fallback;
        }

        const value = source.autoon;

        return typeof value === "boolean" ? value : fallback;
    }

    private readAirPurifierPm25(
        source: Record<string, unknown>,
        fallback: number | undefined
    ): number | undefined {
        if (this.model !== "DR-HAP009S") {
            return fallback;
        }

        const value = source.pm25;

        if (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            !Number.isInteger(value) ||
            value < 0
        ) {
            return fallback;
        }

        return value;
    }

    private readAirPurifierAirQualityLevel(
        source: Record<string, unknown>,
        fallback: DreoAirQualityLevel | undefined
    ): DreoAirQualityLevel | undefined {
        if (this.model !== "DR-HAP009S") {
            return fallback;
        }

        const value = source.aq;

        return isDreoAirQualityLevel(value) ? value : fallback;
    }

    private readHumidityIndicatorThresholds(
        source: Record<string, unknown>
    ): { lower: number; upper: number } | undefined {
        if (
            this.model !== "DR-HHM001S" &&
            this.model !== "DR-HHM003S"
        ) {
            return undefined;
        }

        const value = source.rgbth;

        if (typeof value !== "string") {
            return undefined;
        }

        const match = /^(\d+),(\d+)$/.exec(value);

        if (!match) {
            return undefined;
        }

        const lower = Number(match[1]);
        const upper = Number(match[2]);

        if (
            !Number.isInteger(lower) ||
            !Number.isInteger(upper) ||
            lower < 15 ||
            lower > 80 ||
            upper < 20 ||
            upper > 85 ||
            upper - lower < 5
        ) {
            return undefined;
        }

        return {
            lower,
            upper,
        };
    }

    private readFilterLifeRemaining(
        source: Record<string, unknown>,
        fallback: number | undefined
    ): number | undefined {
        let value: unknown;

        if (this.model === "DR-HAP009S") {
            value = source.lifetime;
        } else if (
            this.model === "DR-HHM001S" ||
            this.model === "DR-HHM003S"
        ) {
            value = source.filtertime;
        } else {
            return fallback;
        }

        if (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            !Number.isInteger(value) ||
            value < 0 ||
            value > 100
        ) {
            return fallback;
        }

        return value;
    }

    private readDirectionalOscillationMode(
        source: Record<string, unknown>,
        fallback: DreoDirectionalOscillationMode | undefined
    ): DreoDirectionalOscillationMode | undefined {
        if (this.model !== "DR-HPF002S") {
            return fallback;
        }

        return (
            this.parseDirectionalOscillationMode(
                source.oscmode
            ) ?? fallback
        );
    }

    private parseDirectionalOscillationMode(
        value: unknown
    ): DreoDirectionalOscillationMode | undefined {
        if (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            !Number.isInteger(value) ||
            value < 0 ||
            value > 3
        ) {
            return undefined;
        }

        return value as DreoDirectionalOscillationMode;
    }

    private readDirectionalOscillationConfiguration(
        source: Record<string, unknown>,
        fallback:
            | DreoDirectionalOscillationConfiguration
            | undefined
    ): DreoDirectionalOscillationConfiguration | undefined {
        if (
            this.model !== "DR-HPF002S" ||
            !this.hasOwnState(source, "cruiseconf")
        ) {
            return fallback;
        }

        return (
            this.parseDirectionalOscillationConfiguration(
                source.cruiseconf
            ) ?? fallback
        );
    }

    private parseDirectionalOscillationConfiguration(
        value: unknown
    ): DreoDirectionalOscillationConfiguration | undefined {
        if (typeof value !== "string") {
            return undefined;
        }

        const parts = value.split(",");

        if (parts.length !== 4) {
            return undefined;
        }

        const values = parts.map((part) => {
            const normalizedPart = part.trim();

            return normalizedPart.length > 0
                ? Number(normalizedPart)
                : Number.NaN;
        });

        if (
            values.some(
                (entry) =>
                    !Number.isFinite(entry) ||
                    !Number.isInteger(entry)
            )
        ) {
            return undefined;
        }

        const [
            verticalUpper,
            horizontalRight,
            verticalLower,
            horizontalLeft,
        ] = values as [number, number, number, number];

        const horizontalAngle =
            horizontalRight - horizontalLeft;
        const verticalAngle =
            verticalUpper - verticalLower;

        if (
            horizontalAngle <= 0 ||
            verticalAngle <= 0
        ) {
            return undefined;
        }

        return {
            verticalUpper,
            horizontalRight,
            verticalLower,
            horizontalLeft,
            horizontalAngle,
            verticalAngle,
        };
    }

    private requireDirectionalOscillationAngle(
        angle: number,
        parameterName: string
    ): void {
        if (
            ![30, 60, 90, 120].includes(angle)
        ) {
            throw new DreoValidationError(
                `${parameterName} must be one of 30, 60, 90, or 120.`
            );
        }
    }

    private requireDirectionalOscillationConfiguration():
        DreoDirectionalOscillationConfiguration {
        if (
            this.model !== "DR-HPF002S" ||
            !this.hasOwnState(
                this.currentState.raw,
                "cruiseconf"
            )
        ) {
            throw new DreoValidationError(
                "Directional oscillation angles are not confirmed for this device."
            );
        }

        const configuration =
            this.parseDirectionalOscillationConfiguration(
                this.currentState.raw.cruiseconf
            );

        if (!configuration) {
            throw new DreoValidationError(
                "Directional oscillation angle requires a valid current reported cruise configuration."
            );
        }

        return configuration;
    }

    private isHorizontalOscillationActive(): boolean {
        if (this.model !== "DR-HPF002S") {
            return false;
        }

        const mode =
            this.parseDirectionalOscillationMode(
                this.currentState.raw.oscmode
            );

        return mode === 1 || mode === 3;
    }

    private isVerticalOscillationActive(): boolean {
        if (this.model !== "DR-HPF002S") {
            return false;
        }

        const mode =
            this.parseDirectionalOscillationMode(
                this.currentState.raw.oscmode
            );

        return mode === 2 || mode === 3;
    }

    private formatDirectionalOscillationConfiguration(
        configuration:
            DreoDirectionalOscillationConfiguration
    ): string {
        return [
            configuration.verticalUpper,
            configuration.horizontalRight,
            configuration.verticalLower,
            configuration.horizontalLeft,
        ].join(",");
    }

    private async applyStateChange(
        change: Parameters<StateMapper["build"]>[1]
    ): Promise<void> {
        const payload = this.stateMapper.build(
            this.currentState,
            change,
            this.model
        );

        await this.setStates(payload);
    }

    private async setStates(
        params: Record<string, unknown>,
        constraintOverrides: ReadonlyMap<
            string,
            StateConstraint
        > = new Map()
    ): Promise<void> {
        this.validateStateParams(params, constraintOverrides);

        const reply = await this.websocket.sendCommandParams(this.sn, params);

        if (reply.reported) {
            this.applyReport(reply.reported);
        }
    }

    private validateStateParams(
        params: Record<string, unknown>,
        constraintOverrides: ReadonlyMap<
            string,
            StateConstraint
        > = new Map()
    ): void {
        for (const [stateKey, value] of Object.entries(params)) {
            this.stateConstraintValidator.validate(
                stateKey,
                value,
                constraintOverrides.get(stateKey) ??
                    this.stateConstraints.get(stateKey)
            );
        }
    }

    private readBoolean(
        source: Record<string, unknown>,
        key: string,
        fallback: boolean | undefined
    ): boolean | undefined {
        const value = source[key];

        return typeof value === "boolean" ? value : fallback;
    }

    private readNumber(
        source: Record<string, unknown>,
        key: string,
        fallback: number | undefined
    ): number | undefined {
        const value = source[key];

        return typeof value === "number" ? value : fallback;
    }

    private readString(
        source: Record<string, unknown>,
        key: string,
        fallback: string | undefined
    ): string | undefined {
        const value = source[key];

        return typeof value === "string" ? value : fallback;
    }

    private hasOwnState(
        source: Record<string, unknown>,
        key: string
    ): boolean {
        return Object.prototype.hasOwnProperty.call(source, key);
    }

    private hasAvailableRawState(
        reported: Record<string, unknown>,
        key: string
    ): boolean {
        return (
            this.hasOwnState(this.currentState.raw, key) ||
            this.hasOwnState(reported, key)
        );
    }

    private isTimerCompletionConfirmed(
        reported: Record<string, unknown>,
        timerKey: "timeron" | "timeroff",
        power: boolean | undefined,
        fan: boolean | undefined,
        mainLight: boolean | undefined,
        atmosphereLight: boolean | undefined
    ): boolean {
        if (!this.hasOwnState(reported, timerKey)) {
            return false;
        }

        const timerTurnsDeviceOn = timerKey === "timeron";

        if (this.hasAvailableRawState(reported, "poweron")) {
            return (
                this.hasOwnState(reported, "poweron") &&
                typeof reported.poweron === "boolean" &&
                power === timerTurnsDeviceOn
            );
        }

        const componentStates: Array<
            readonly [string, boolean | undefined]
        > = [
            ["fanon", fan],
            ["lighton", mainLight],
            ["atmon", atmosphereLight],
        ];

        const availableComponentStates = componentStates.filter(
            ([rawKey]) =>
                this.hasAvailableRawState(reported, rawKey)
        );

        const reportedComponentStates =
            availableComponentStates.filter(([rawKey]) =>
                this.hasOwnState(reported, rawKey)
            );

        if (
            availableComponentStates.length === 0 ||
            reportedComponentStates.length === 0 ||
            reportedComponentStates.some(
                ([rawKey]) =>
                    typeof reported[rawKey] !== "boolean"
            )
        ) {
            return false;
        }

        const states = availableComponentStates.map(
            ([, state]) => state
        );

        return timerTurnsDeviceOn
            ? states.some((state) => state === true)
            : states.every((state) => state === false);
    }

    private readTimerConfiguration(
        source: Record<string, unknown>,
        key: string,
        fallback: DreoTimerConfiguration | undefined,
        completionConfirmed = false
    ): DreoTimerConfiguration | undefined {
        if (!this.hasOwnState(source, key)) {
            return fallback;
        }

        const value = source[key];
        let parsed: unknown = value;

        if (typeof value === "string") {
            try {
                parsed = JSON.parse(value);
            } catch {
                return fallback;
            }
        }

        if (
            typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)
        ) {
            return fallback;
        }

        const candidate = parsed as Record<string, unknown>;
        const durationPresent = this.hasOwnState(
            candidate,
            "du"
        );
        const timestampPresent = this.hasOwnState(
            candidate,
            "ts"
        );

        if (
            durationPresent &&
            (
                !this.isFiniteNumber(candidate.du) ||
                !Number.isInteger(candidate.du) ||
                candidate.du < 0 ||
                candidate.du > 719
            )
        ) {
            return fallback;
        }

        if (
            timestampPresent &&
            (
                !this.isFiniteNumber(candidate.ts) ||
                !Number.isInteger(candidate.ts) ||
                candidate.ts < 0
            )
        ) {
            return fallback;
        }

        if (durationPresent && timestampPresent) {
            return {
                du: candidate.du as number,
                ts: candidate.ts as number,
            };
        }

        if (
            !durationPresent &&
            !timestampPresent
        ) {
            return fallback;
        }

        if (
            !completionConfirmed ||
            !fallback ||
            fallback.du <= 0
        ) {
            return fallback;
        }

        return {
            du: 0,
            ts: timestampPresent
                ? candidate.ts as number
                : fallback.ts,
        };
    }

    private readSceneConfiguration(
        source: Record<string, unknown>,
        key: string,
        fallback: DreoSceneConfiguration | undefined
    ): DreoSceneConfiguration | undefined {
        const value = source[key];

        if (typeof value !== "string") {
            return fallback;
        }

        try {
            const parsed: unknown = JSON.parse(value);

            if (
                typeof parsed !== "object" ||
                parsed === null ||
                Array.isArray(parsed)
            ) {
                return fallback;
            }

            const candidate = parsed as Record<string, unknown>;

            if (
                !this.isFiniteNumber(candidate.mode) ||
                !this.isFiniteNumber(candidate.du) ||
                !this.isFiniteNumber(candidate.minbri) ||
                !this.isFiniteNumber(candidate.maxbri)
            ) {
                return fallback;
            }

            return {
                mode: candidate.mode,
                du: candidate.du,
                minbri: candidate.minbri,
                maxbri: candidate.maxbri,
            };
        } catch {
            return fallback;
        }
    }

    private isFiniteNumber(value: unknown): value is number {
        return typeof value === "number" && Number.isFinite(value);
    }

    private readUnknown(
        source: Record<string, unknown>,
        key: string,
        fallback: unknown
    ): unknown {
        return key in source ? source[key] : fallback;
    }
}
