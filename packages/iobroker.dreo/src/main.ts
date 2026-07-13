import { Adapter } from "@iobroker/adapter-core";
import {
    DreoClient,
    type DiscoveredState,
    type DreoDeviceDiscoveredEvent,
    type DreoDeviceDiscoveredUnsubscribe,
    type DreoDeviceStateChangeEvent,
    type DreoDeviceStateChangeUnsubscribe,
    type DreoLogger,
    type ResolvedDevice,
    VERSION as dreoApiVersion,
} from "@dreo/api";

interface DreoAdapterConfig {
    email?: string;
    password?: string;
    region?: string;
}

interface FriendlyStateDefinition {
    channelId: string;
    channelName: string;
    stateId: string;
    stateName: string;
    rawKey: string;
    type: "boolean" | "number" | "string";
    role: string;
    unit?: string;
}

const FRIENDLY_STATE_DEFINITIONS: FriendlyStateDefinition[] = [
    {
        channelId: "power",
        channelName: "Power",
        stateId: "on",
        stateName: "Power",
        rawKey: "poweron",
        type: "boolean",
        role: "switch.power",
    },
    {
        channelId: "fan",
        channelName: "Fan",
        stateId: "on",
        stateName: "Fan",
        rawKey: "fanon",
        type: "boolean",
        role: "switch",
    },
    {
        channelId: "fan",
        channelName: "Fan",
        stateId: "speed",
        stateName: "Speed",
        rawKey: "windlevel",
        type: "number",
        role: "level",
    },
    {
        channelId: "fan",
        channelName: "Fan",
        stateId: "mode",
        stateName: "Mode",
        rawKey: "mode",
        type: "number",
        role: "value",
    },
    {
        channelId: "fan",
        channelName: "Fan",
        stateId: "oscillationMode",
        stateName: "Oscillation mode",
        rawKey: "oscmode",
        type: "number",
        role: "value",
    },
    {
        channelId: "mainLight",
        channelName: "Main light",
        stateId: "on",
        stateName: "Main light",
        rawKey: "lighton",
        type: "boolean",
        role: "switch.light",
    },
    {
        channelId: "mainLight",
        channelName: "Main light",
        stateId: "brightness",
        stateName: "Brightness",
        rawKey: "brightness",
        type: "number",
        role: "level.dimmer",
        unit: "%",
    },
    {
        channelId: "mainLight",
        channelName: "Main light",
        stateId: "colorTemperature",
        stateName: "Color temperature",
        rawKey: "colortemp",
        type: "number",
        role: "level.color.temperature",
    },
    {
        channelId: "display",
        channelName: "Display",
        stateId: "on",
        stateName: "Display",
        rawKey: "lighton",
        type: "boolean",
        role: "switch",
    },
    {
        channelId: "rgb",
        channelName: "RGB",
        stateId: "on",
        stateName: "RGB",
        rawKey: "atmon",
        type: "boolean",
        role: "switch.light",
    },
    {
        channelId: "rgb",
        channelName: "RGB",
        stateId: "brightness",
        stateName: "Brightness",
        rawKey: "atmbri",
        type: "number",
        role: "level.dimmer",
        unit: "%",
    },
    {
        channelId: "rgb",
        channelName: "RGB",
        stateId: "preset",
        stateName: "Preset",
        rawKey: "rgbpresetsel",
        type: "number",
        role: "value",
    },
    {
        channelId: "settings",
        channelName: "Settings",
        stateId: "mute",
        stateName: "Mute",
        rawKey: "muteon",
        type: "boolean",
        role: "switch",
    },
    {
        channelId: "settings",
        channelName: "Settings",
        stateId: "childLock",
        stateName: "Child lock",
        rawKey: "childlockon",
        type: "boolean",
        role: "switch.lock",
    },
    {
        channelId: "settings",
        channelName: "Settings",
        stateId: "timerOn",
        stateName: "Timer on",
        rawKey: "timeron",
        type: "number",
        role: "value",
    },
    {
        channelId: "settings",
        channelName: "Settings",
        stateId: "timerOff",
        stateName: "Timer off",
        rawKey: "timeroff",
        type: "number",
        role: "value",
    },
];

class DreoAdapter extends Adapter {
    private client?: DreoClient;

    private unsubscribeDeviceStateChanged?: DreoDeviceStateChangeUnsubscribe;

    private unsubscribeDeviceDiscovered?: DreoDeviceDiscoveredUnsubscribe;

    private readonly resolvedDevicesBySerialNumber = new Map<
        string,
        ResolvedDevice
    >();

    private readonly deviceInitializationPromises = new Map<
        string,
        Promise<void>
    >();

    public constructor() {
        super({
            name: "dreo",
        });

        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    private async onReady(): Promise<void> {
        this.log.info("Dreo adapter started.");
        this.log.info(`Using @dreo/api ${dreoApiVersion}.`);

        const config = this.readConfig();

        if (!this.hasRequiredConfig(config)) {
            this.log.warn(
                "DREO credentials are not configured. Please configure email and password in the adapter settings."
            );
            return;
        }

        this.log.info(`DREO region configured: ${config.region ?? "EU"}.`);

        await this.connectDreo(config);
        await this.initializeResolvedDevices();
    }

    private async connectDreo(config: DreoAdapterConfig): Promise<void> {
        if (!config.email || !config.password) {
            throw new Error("DREO email and password are required.");
        }

        this.log.info("Connecting to DREO cloud...");

        const client = await DreoClient.login({
            email: config.email,
            password: config.password,
            region: config.region ?? "EU",
            logger: this.createDreoLogger(),
        });

        this.client = client;

        this.unsubscribeDeviceStateChanged = client.onDeviceStateChanged(
            (event) => {
                void this.handleDeviceStateChanged(event).catch((error) => {
                    this.log.warn(
                        `Failed to apply DREO live state update: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                });
            }
        );

        this.unsubscribeDeviceDiscovered = client.onDeviceDiscovered(
            (event) => {
                void this.handleDeviceDiscovered(event).catch((error) => {
                    this.log.warn(
                        `Failed to initialize discovered DREO device: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                });
            }
        );

        this.log.info("Connected to DREO cloud.");
    }

    private async handleDeviceDiscovered(
        event: DreoDeviceDiscoveredEvent
    ): Promise<void> {
        const serialNumber = event.resolvedDevice.device.sn;

        if (this.resolvedDevicesBySerialNumber.has(serialNumber)) {
            this.log.debug(
                `Ignoring duplicate runtime discovery event for ${serialNumber}.`
            );
            return;
        }

        this.log.info(
            `Received runtime discovery event for ${event.resolvedDevice.device.deviceName} ` +
                `(${event.resolvedDevice.device.model}, ${event.device.sn}).`
        );

        await this.initializeResolvedDevice(event.resolvedDevice);

        this.log.info(
            `Initialized discovered DREO device ${event.resolvedDevice.device.deviceName}.`
        );
    }

    private async initializeResolvedDevices(): Promise<void> {
        if (!this.client) {
            throw new Error("DREO client is not connected.");
        }

        const resolvedDevices = await this.client.getResolvedDevices();

        this.resolvedDevicesBySerialNumber.clear();

        this.log.info(`Resolved ${resolvedDevices.length} DREO device(s).`);

        await Promise.all(
            resolvedDevices.map((resolvedDevice) =>
                this.initializeResolvedDevice(resolvedDevice)
            )
        );

        this.subscribeStates("devices.*");
    }

    private async initializeResolvedDevice(
        resolvedDevice: ResolvedDevice
    ): Promise<void> {
        const serialNumber = resolvedDevice.device.sn;
        const existingInitialization =
            this.deviceInitializationPromises.get(serialNumber);

        if (existingInitialization) {
            await existingInitialization;
            return;
        }

        const initialization =
            this.performResolvedDeviceInitialization(resolvedDevice);

        this.deviceInitializationPromises.set(serialNumber, initialization);

        try {
            await initialization;
        } finally {
            this.deviceInitializationPromises.delete(serialNumber);
        }
    }

    private async performResolvedDeviceInitialization(
        resolvedDevice: ResolvedDevice
    ): Promise<void> {
        this.log.info(this.formatResolvedDeviceLogMessage(resolvedDevice));

        await this.createDevicesRootObject();
        await this.createDeviceObjects(resolvedDevice);
        await this.createFriendlyDeviceObjects(resolvedDevice);
        await this.setDeviceInfoStates(resolvedDevice);
        await this.setRawDeviceStates(resolvedDevice);
        await this.setFriendlyDeviceStates(resolvedDevice);

        this.resolvedDevicesBySerialNumber.set(
            resolvedDevice.device.sn,
            resolvedDevice
        );
    }

    private async createDevicesRootObject(): Promise<void> {
        await this.setObjectNotExistsAsync("devices", {
            type: "channel",
            common: {
                name: "DREO devices",
            },
            native: {},
        });
    }

    private async createDeviceObjects(
        resolvedDevice: ResolvedDevice
    ): Promise<void> {
        const deviceId = this.createDeviceObjectId(resolvedDevice);
        const { device } = resolvedDevice;

        await this.setObjectNotExistsAsync(`devices.${deviceId}`, {
            type: "device",
            common: {
                name: device.deviceName,
            },
            native: {
                sn: device.sn,
                model: device.model,
            },
        });

        await this.setObjectNotExistsAsync(`devices.${deviceId}.info`, {
            type: "channel",
            common: {
                name: "Device information",
            },
            native: {},
        });

        await this.setObjectNotExistsAsync(`devices.${deviceId}.raw`, {
            type: "channel",
            common: {
                name: "Raw device state",
            },
            native: {},
        });

        await this.setObjectNotExistsAsync(`devices.${deviceId}.info.name`, {
            type: "state",
            common: {
                name: "Name",
                type: "string",
                role: "info.name",
                read: true,
                write: false,
            },
            native: {},
        });

        await this.setObjectNotExistsAsync(`devices.${deviceId}.info.model`, {
            type: "state",
            common: {
                name: "Model",
                type: "string",
                role: "info.model",
                read: true,
                write: false,
            },
            native: {},
        });

        await this.setObjectNotExistsAsync(
            `devices.${deviceId}.info.serialNumber`,
            {
                type: "state",
                common: {
                    name: "Serial number",
                    type: "string",
                    role: "info.serial",
                    read: true,
                    write: false,
                },
                native: {},
            }
        );

        for (const state of resolvedDevice.states) {
            await this.createRawStateObject(deviceId, state);
        }
    }

    private async createRawStateObject(
        deviceId: string,
        state: DiscoveredState
    ): Promise<void> {
        const stateId = this.createRawStateObjectId(state.key);

        await this.setObjectNotExistsAsync(
            `devices.${deviceId}.raw.${stateId}`,
            {
                type: "state",
                common: {
                    name: state.description,
                    type: this.mapRawStateType(state),
                    role: this.mapRawStateRole(state),
                    read: true,
                    write: false,
                },
                native: {
                    key: state.key,
                    category: state.category,
                    known: state.known,
                    valueType: state.valueType,
                    constraint: state.constraint,
                },
            }
        );
    }

    private mapRawStateType(
        state: DiscoveredState
    ): "boolean" | "number" | "string" | "mixed" {
        switch (state.valueType) {
            case "boolean":
                return "boolean";

            case "number":
                return "number";

            case "string":
                return "string";

            case "object":
            case "unknown":
            default:
                return "string";
        }
    }

    private mapRawStateRole(state: DiscoveredState): string {
        if (state.category === "diagnostic") {
            return "value";
        }

        if (state.category === "information") {
            return "info";
        }

        if (state.valueType === "boolean") {
            return "indicator";
        }

        return "value";
    }

    private async createFriendlyDeviceObjects(
        resolvedDevice: ResolvedDevice
    ): Promise<void> {
        const deviceId = this.createDeviceObjectId(resolvedDevice);
        const definitions =
            this.getAvailableFriendlyStateDefinitions(resolvedDevice);
        const channelIds = new Set(
            definitions.map((definition) => definition.channelId)
        );

        for (const channelId of channelIds) {
            const channelDefinition = definitions.find(
                (definition) => definition.channelId === channelId
            );

            if (!channelDefinition) {
                continue;
            }

            await this.setObjectNotExistsAsync(
                `devices.${deviceId}.${channelId}`,
                {
                    type: "channel",
                    common: {
                        name: channelDefinition.channelName,
                    },
                    native: {},
                }
            );
        }

        for (const definition of definitions) {
            await this.createFriendlyStateObject(deviceId, definition);
        }
    }

    private async createFriendlyStateObject(
        deviceId: string,
        definition: FriendlyStateDefinition
    ): Promise<void> {
        const objectId = `devices.${deviceId}.${definition.channelId}.${definition.stateId}`;
        const writable = this.isWritableFriendlyStateDefinition(definition);

        await this.setObjectAsync(objectId, {
            type: "state",
            common: {
                name: definition.stateName,
                type: definition.type,
                role: definition.role,
                read: true,
                write: writable,
                unit: definition.unit,
            },
            native: {
                rawKey: definition.rawKey,
            },
        });
    }

    private async setFriendlyDeviceStates(
        resolvedDevice: ResolvedDevice
    ): Promise<void> {
        const deviceId = this.createDeviceObjectId(resolvedDevice);
        const definitions =
            this.getAvailableFriendlyStateDefinitions(resolvedDevice);

        for (const definition of definitions) {
            const rawValue = this.readRawStateValue(
                resolvedDevice,
                definition.rawKey
            );

            if (rawValue === undefined) {
                continue;
            }

            await this.setStateAsync(
                `devices.${deviceId}.${definition.channelId}.${definition.stateId}`,
                {
                    val: this.normalizeFriendlyStateValue(
                        rawValue,
                        definition,
                        resolvedDevice
                    ),
                    ack: true,
                }
            );
        }
    }

    private getAvailableFriendlyStateDefinitions(
        resolvedDevice: ResolvedDevice
    ): FriendlyStateDefinition[] {
        const availableRawKeys = new Set(
            resolvedDevice.states.map((state) => state.key)
        );

        const hasMainLight =
            availableRawKeys.has("lighton") &&
            availableRawKeys.has("brightness") &&
            availableRawKeys.has("colortemp");

        const hasAmbientLight =
            availableRawKeys.has("atmon") ||
            availableRawKeys.has("atmbri") ||
            availableRawKeys.has("rgbpresetsel");

        return FRIENDLY_STATE_DEFINITIONS.filter((definition) => {
            if (!availableRawKeys.has(definition.rawKey)) {
                return false;
            }

            if (definition.channelId === "mainLight") {
                return hasMainLight;
            }

            if (definition.channelId === "display") {
                return definition.rawKey === "lighton" && !hasMainLight;
            }

            if (definition.channelId === "rgb") {
                return hasAmbientLight;
            }

            return true;
        });
    }

    private normalizeFriendlyStateValue(
        value: unknown,
        definition: FriendlyStateDefinition,
        resolvedDevice: ResolvedDevice
    ): string | number | boolean | null {
        if (value === null) {
            return null;
        }

        if (this.isPowerScopedFriendlyOnState(definition)) {
            const powerValue = this.readRawStateValue(
                resolvedDevice,
                "poweron"
            );
            const isPowered =
                typeof powerValue === "boolean"
                    ? powerValue
                    : Boolean(powerValue);

            const isTargetEnabled =
                typeof value === "boolean" ? value : Boolean(value);

            return isPowered && isTargetEnabled;
        }

        switch (definition.type) {
            case "boolean":
                return typeof value === "boolean" ? value : Boolean(value);

            case "number":
                return typeof value === "number" ? value : Number(value);

            case "string":
            default:
                return typeof value === "string" ? value : String(value);
        }
    }

    private isPowerScopedFriendlyOnState(
        definition: FriendlyStateDefinition
    ): boolean {
        return (
            definition.stateId === "on" &&
            ["fan", "mainLight", "display", "rgb"].includes(
                definition.channelId
            )
        );
    }

    private isWritableFriendlyStateDefinition(
        definition: FriendlyStateDefinition
    ): boolean {
        const writableStates = new Set<string>([
            "power.on",
            "fan.on",
            "fan.speed",
            "mainLight.on",
            "mainLight.brightness",
            "mainLight.colorTemperature",
            "display.on",
            "rgb.on",
            "rgb.brightness",
        ]);

        return writableStates.has(
            `${definition.channelId}.${definition.stateId}`
        );
    }

    private async setDeviceInfoStates(
        resolvedDevice: ResolvedDevice
    ): Promise<void> {
        const deviceId = this.createDeviceObjectId(resolvedDevice);
        const { device } = resolvedDevice;

        await this.setStateAsync(`devices.${deviceId}.info.name`, {
            val: device.deviceName,
            ack: true,
        });

        await this.setStateAsync(`devices.${deviceId}.info.model`, {
            val: device.model,
            ack: true,
        });

        await this.setStateAsync(`devices.${deviceId}.info.serialNumber`, {
            val: device.sn,
            ack: true,
        });
    }

    private async setRawDeviceStates(
        resolvedDevice: ResolvedDevice
    ): Promise<void> {
        const deviceId = this.createDeviceObjectId(resolvedDevice);

        for (const state of resolvedDevice.states) {
            const rawValue = this.readRawStateValue(resolvedDevice, state.key);

            if (rawValue === undefined) {
                continue;
            }

            await this.setStateAsync(
                `devices.${deviceId}.raw.${this.createRawStateObjectId(
                    state.key
                )}`,
                {
                    val: this.normalizeRawStateValue(rawValue, state),
                    ack: true,
                }
            );
        }
    }

    private readRawStateValue(
        resolvedDevice: ResolvedDevice,
        key: string
    ): unknown {
        const mixedState = resolvedDevice.state.data.mixed[key];

        if (!mixedState) {
            return undefined;
        }

        return mixedState.state;
    }

    private normalizeRawStateValue(
        value: unknown,
        state: DiscoveredState
    ): string | number | boolean | null {
        if (value === null) {
            return null;
        }

        switch (state.valueType) {
            case "boolean":
                return typeof value === "boolean" ? value : Boolean(value);

            case "number":
                return typeof value === "number" ? value : Number(value);

            case "string":
                return typeof value === "string" ? value : String(value);

            case "object":
            case "unknown":
            default:
                return this.stringifyRawStateValue(value);
        }
    }

    private stringifyRawStateValue(value: unknown): string {
        if (typeof value === "string") {
            return value;
        }

        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    private createDeviceObjectId(resolvedDevice: ResolvedDevice): string {
        return this.sanitizeObjectId(resolvedDevice.device.sn);
    }

    private createRawStateObjectId(key: string): string {
        return this.sanitizeObjectId(key);
    }

    private sanitizeObjectId(value: string): string {
        return value
            .trim()
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "");
    }

    private formatResolvedDeviceLogMessage(
        resolvedDevice: ResolvedDevice
    ): string {
        const { device } = resolvedDevice;

        return `DREO device: ${device.deviceName} (${device.model}, ${device.sn})`;
    }

    private async handleDeviceStateChanged(
        event: DreoDeviceStateChangeEvent
    ): Promise<void> {
        const initialization = this.deviceInitializationPromises.get(
            event.device.sn
        );

        if (initialization) {
            await initialization;
        }

        const resolvedDevice = this.resolvedDevicesBySerialNumber.get(
            event.device.sn
        );

        if (!resolvedDevice) {
            this.log.debug(
                `Received DREO live update for unknown device ${event.device.sn}.`
            );
            return;
        }

        this.applyReportedStateToResolvedDevice(resolvedDevice, event.reported);

        await this.setRawDeviceStates(resolvedDevice);
        await this.setFriendlyDeviceStates(resolvedDevice);

        this.log.debug(
            `Applied DREO live update for ${resolvedDevice.device.deviceName}.`
        );
    }

    private applyReportedStateToResolvedDevice(
        resolvedDevice: ResolvedDevice,
        reported: Record<string, unknown>
    ): void {
        const mixedStates = resolvedDevice.state.data.mixed as Record<
            string,
            { state: unknown }
        >;

        for (const [key, value] of Object.entries(reported)) {
            const mixedState = mixedStates[key];

            if (!mixedState) {
                continue;
            }

            mixedState.state = value;
        }
    }

    private async onStateChange(
        id: string,
        state: ioBroker.State | null | undefined
    ): Promise<void> {
        if (!state || state.ack) {
            return;
        }

        const parsedStateId = this.parseFriendlyStateId(id);

        if (!parsedStateId) {
            return;
        }

        const resolvedDevice = this.findResolvedDeviceByObjectId(
            parsedStateId.deviceId
        );

        if (!resolvedDevice || !this.client) {
            return;
        }

        const device = this.client.getDevice(resolvedDevice.device.sn);

        if (!device) {
            this.log.warn(
                `Cannot write DREO state for ${resolvedDevice.device.deviceName}: device is not registered.`
            );
            return;
        }

        try {
            const writtenValue = await this.writeFriendlyState(
                device,
                parsedStateId.channelId,
                parsedStateId.stateId,
                state.val
            );

            if (writtenValue === undefined) {
                return;
            }

            this.log.info(
                `Wrote DREO state ${parsedStateId.channelId}.${parsedStateId.stateId}=${writtenValue} for ${resolvedDevice.device.deviceName}.`
            );
        } catch (error) {
            this.log.warn(
                `Failed to write DREO state ${parsedStateId.channelId}.${
                    parsedStateId.stateId
                } for ${resolvedDevice.device.deviceName}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    private async writeFriendlyState(
        device: import("@dreo/api").DreoDevice,
        channelId: string,
        stateId: string,
        value: ioBroker.StateValue
    ): Promise<boolean | number | undefined> {
        if (stateId === "on") {
            const booleanValue = Boolean(value);

            switch (channelId) {
                case "power":
                    await device.setPower(booleanValue);
                    return booleanValue;

                case "fan":
                    await device.setFan(booleanValue);
                    return booleanValue;

                case "mainLight":
                case "display":
                    await device.setMainLight(booleanValue);
                    return booleanValue;

                case "rgb":
                    await device.setAtmosphereLight(booleanValue);
                    return booleanValue;

                default:
                    return undefined;
            }
        }

        const numberValue = this.normalizeWritableNumber(value);

        if (numberValue === undefined) {
            throw new Error(`Invalid numeric value: ${String(value)}`);
        }

        if (channelId === "fan" && stateId === "speed") {
            await device.setWindLevel(numberValue);
            return numberValue;
        }

        if (channelId === "mainLight" && stateId === "brightness") {
            await device.setBrightness(numberValue);
            return numberValue;
        }

        if (channelId === "mainLight" && stateId === "colorTemperature") {
            await device.setColorTemperature(numberValue);
            return numberValue;
        }

        if (channelId === "rgb" && stateId === "brightness") {
            await device.setAtmosphereBrightness(numberValue);
            return numberValue;
        }

        return undefined;
    }

    private normalizeWritableNumber(
        value: ioBroker.StateValue
    ): number | undefined {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === "string" && value.trim().length > 0) {
            const parsed = Number(value);

            return Number.isFinite(parsed) ? parsed : undefined;
        }

        return undefined;
    }

    private parseFriendlyStateId(
        id: string
    ): { deviceId: string; channelId: string; stateId: string } | undefined {
        const namespacePrefix = `${this.namespace}.`;
        const relativeId = id.startsWith(namespacePrefix)
            ? id.slice(namespacePrefix.length)
            : id;

        const parts = relativeId.split(".");

        if (parts.length !== 4 || parts[0] !== "devices") {
            return undefined;
        }

        const [, deviceId, channelId, stateId] = parts;

        if (
            !["power", "fan", "mainLight", "display", "rgb"].includes(channelId)
        ) {
            return undefined;
        }

        if (
            stateId !== "on" &&
            !(channelId === "fan" && stateId === "speed") &&
            !(
                channelId === "mainLight" &&
                ["brightness", "colorTemperature"].includes(stateId)
            ) &&
            !(channelId === "rgb" && stateId === "brightness")
        ) {
            return undefined;
        }

        return {
            deviceId,
            channelId,
            stateId,
        };
    }

    private findResolvedDeviceByObjectId(
        deviceId: string
    ): ResolvedDevice | undefined {
        return Array.from(this.resolvedDevicesBySerialNumber.values()).find(
            (resolvedDevice) =>
                this.createDeviceObjectId(resolvedDevice) === deviceId
        );
    }

    private createDreoLogger(): DreoLogger {
        return {
            debug: (message, data) => {
                this.log.debug(this.formatSdkLogMessage(message, data));
            },
            info: (message, data) => {
                this.log.info(this.formatSdkLogMessage(message, data));
            },
            warn: (message, data) => {
                this.log.warn(this.formatSdkLogMessage(message, data));
            },
            error: (message, data) => {
                this.log.error(this.formatSdkLogMessage(message, data));
            },
        };
    }

    private formatSdkLogMessage(message: string, data?: unknown): string {
        if (data === undefined) {
            return `[SDK] ${message}`;
        }

        return `[SDK] ${message} ${this.stringifyLogData(data)}`;
    }

    private stringifyLogData(data: unknown): string {
        try {
            return JSON.stringify(data);
        } catch {
            return String(data);
        }
    }

    private readConfig(): DreoAdapterConfig {
        const nativeConfig = this.config as Record<string, unknown>;

        return {
            email: this.readString(nativeConfig.email),
            password: this.readString(nativeConfig.password),
            region: this.readString(nativeConfig.region),
        };
    }

    private readString(value: unknown): string | undefined {
        return typeof value === "string" ? value : undefined;
    }

    private hasRequiredConfig(config: DreoAdapterConfig): boolean {
        return (
            typeof config.email === "string" &&
            config.email.trim().length > 0 &&
            typeof config.password === "string" &&
            config.password.length > 0
        );
    }

    private onUnload(callback: () => void): void {
        try {
            this.unsubscribeDeviceDiscovered?.();
            this.unsubscribeDeviceDiscovered = undefined;

            this.unsubscribeDeviceStateChanged?.();
            this.unsubscribeDeviceStateChanged = undefined;

            this.client?.disconnect();
            this.client = undefined;
            this.deviceInitializationPromises.clear();
            this.resolvedDevicesBySerialNumber.clear();

            this.log.info("Dreo adapter stopped.");
            callback();
        } catch {
            callback();
        }
    }
}

export default DreoAdapter;

if (!process.argv.includes("--install")) {
    new DreoAdapter();
}
