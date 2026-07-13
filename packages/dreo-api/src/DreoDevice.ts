import { InputValidator } from "./InputValidator.js";
import type { Device } from "./models/Device.js";
import type { DreoDeviceState } from "./models/DreoDeviceState.js";
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
        this.currentState = {
            ...this.currentState,
            raw: {
                ...this.currentState.raw,
                ...reported,
            },
            power: this.readBoolean(
                reported,
                "poweron",
                this.currentState.power
            ),
            fan: this.readBoolean(reported, "fanon", this.currentState.fan),
            mainLight: this.readBoolean(
                reported,
                "lighton",
                this.currentState.mainLight
            ),
            atmosphereLight: this.readBoolean(
                reported,
                "atmon",
                this.currentState.atmosphereLight
            ),
            mute: this.readBoolean(reported, "muteon", this.currentState.mute),
            windLevel: this.readNumber(
                reported,
                "windlevel",
                this.currentState.windLevel
            ),
            mode: this.readNumber(reported, "mode", this.currentState.mode),
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
            rssi: this.readUnknown(reported, "rssi", this.currentState.rssi),
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

    public async setWindLevel(level: number): Promise<void> {
        InputValidator.requireWindLevel(level);

        await this.applyStateChange({
            windLevel: level,
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

    private async applyStateChange(
        change: Parameters<StateMapper["build"]>[1]
    ): Promise<void> {
        const payload = this.stateMapper.build(this.currentState, change);

        await this.setStates(payload);
    }

    private async setStates(params: Record<string, unknown>): Promise<void> {
        this.validateStateParams(params);

        const reply = await this.websocket.sendCommandParams(this.sn, params);

        if (reply.reported) {
            this.applyReport(reply.reported);
        }
    }

    private validateStateParams(params: Record<string, unknown>): void {
        for (const [stateKey, value] of Object.entries(params)) {
            this.stateConstraintValidator.validate(
                stateKey,
                value,
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

    private readUnknown(
        source: Record<string, unknown>,
        key: string,
        fallback: unknown
    ): unknown {
        return key in source ? source[key] : fallback;
    }
}
