import type { DeviceCapabilities } from "./models/DeviceCapabilities.js";
import type { StateConstraint } from "./models/StateConstraint.js";

interface ControlsConfiguration {
    schedule?: {
        modes?: ScheduleModeConfiguration[];
    };

    control?: ControlConfiguration[];

    preference?: PreferenceConfiguration[];
}

interface ScheduleModeConfiguration {
    cmd?: string;
    value?: unknown;
    valueType?: unknown;
    controls?: ScheduleControlConfiguration[];
}

interface ScheduleControlConfiguration {
    cmd?: string[];
    startValue?: unknown;
    endValue?: unknown;
    step?: unknown;
}

interface ControlConfiguration {
    type?: string;
    items?: ControlItemConfiguration[];
}

interface ControlItemConfiguration {
    cmd?: string;
    value?: unknown;
}

interface PreferenceConfiguration {
    cmd?: string;
}

export class StateConstraintResolver {
    public resolve(
        capabilities?: DeviceCapabilities
    ): Map<string, StateConstraint> {
        const constraints = new Map<string, StateConstraint>();

        const controlsConf = capabilities?.controlsConf as
            | ControlsConfiguration
            | undefined;

        this.resolveScheduleModes(controlsConf, constraints);
        this.resolveScheduleControls(controlsConf, constraints);
        this.resolveControlItems(controlsConf, constraints);
        this.resolvePreferenceControls(controlsConf, constraints);

        return constraints;
    }

    private resolveScheduleModes(
        controlsConf: ControlsConfiguration | undefined,
        constraints: Map<string, StateConstraint>
    ): void {
        if (!Array.isArray(controlsConf?.schedule?.modes)) {
            return;
        }

        const valuesByCommand = new Map<string, number[]>();

        for (const mode of controlsConf.schedule.modes) {
            if (typeof mode.cmd !== "string") {
                continue;
            }

            if (typeof mode.value !== "number") {
                continue;
            }

            const values = valuesByCommand.get(mode.cmd) ?? [];
            values.push(mode.value);
            valuesByCommand.set(mode.cmd, values);
        }

        for (const [command, values] of valuesByCommand) {
            this.mergeNumberConstraint(constraints, command, {
                type: "number",
                step: 1,
                allowedValues: this.uniqueSortedNumbers(values),
            });
        }
    }

    private resolveScheduleControls(
        controlsConf: ControlsConfiguration | undefined,
        constraints: Map<string, StateConstraint>
    ): void {
        if (!Array.isArray(controlsConf?.schedule?.modes)) {
            return;
        }

        for (const mode of controlsConf.schedule.modes) {
            if (!Array.isArray(mode.controls)) {
                continue;
            }

            for (const control of mode.controls) {
                if (!Array.isArray(control.cmd)) {
                    continue;
                }

                const startValue = this.readNumber(control.startValue);
                const endValue = this.readNumber(control.endValue);
                const step = this.readNumber(control.step) ?? 1;

                if (startValue === undefined && endValue === undefined) {
                    continue;
                }

                for (const command of control.cmd) {
                    this.mergeNumberConstraint(constraints, command, {
                        type: "number",
                        min: startValue,
                        max: endValue,
                        step,
                    });
                }
            }
        }
    }

    private resolveControlItems(
        controlsConf: ControlsConfiguration | undefined,
        constraints: Map<string, StateConstraint>
    ): void {
        if (!Array.isArray(controlsConf?.control)) {
            return;
        }

        for (const control of controlsConf.control) {
            if (!Array.isArray(control.items)) {
                continue;
            }

            const valuesByCommand = new Map<string, number[]>();

            for (const item of control.items) {
                if (typeof item.cmd !== "string") {
                    continue;
                }

                if (typeof item.value !== "number") {
                    continue;
                }

                const values = valuesByCommand.get(item.cmd) ?? [];
                values.push(item.value);
                valuesByCommand.set(item.cmd, values);
            }

            for (const [command, values] of valuesByCommand) {
                const uniqueValues = this.uniqueSortedNumbers(values);

                if (control.type === "Speed" && uniqueValues.length >= 2) {
                    this.mergeNumberConstraint(constraints, command, {
                        type: "number",
                        min: Math.min(...uniqueValues),
                        max: Math.max(...uniqueValues),
                        step: 1,
                    });

                    continue;
                }

                this.mergeNumberConstraint(constraints, command, {
                    type: "number",
                    step: 1,
                    allowedValues: uniqueValues,
                });
            }
        }
    }

    private resolvePreferenceControls(
        controlsConf: ControlsConfiguration | undefined,
        constraints: Map<string, StateConstraint>
    ): void {
        if (!Array.isArray(controlsConf?.preference)) {
            return;
        }

        for (const preference of controlsConf.preference) {
            if (typeof preference.cmd !== "string") {
                continue;
            }

            if (constraints.has(preference.cmd)) {
                continue;
            }

            constraints.set(preference.cmd, {
                type: "boolean",
            });
        }
    }

    private mergeNumberConstraint(
        constraints: Map<string, StateConstraint>,
        command: string,
        constraint: Extract<StateConstraint, { type: "number" }>
    ): void {
        const existing = constraints.get(command);

        if (!existing || existing.type !== "number") {
            constraints.set(command, constraint);
            return;
        }

        constraints.set(command, {
            type: "number",
            min: this.mergeMin(existing.min, constraint.min),
            max: this.mergeMax(existing.max, constraint.max),
            step: constraint.step ?? existing.step,
            allowedValues: this.mergeAllowedValues(
                existing.allowedValues,
                constraint.allowedValues
            ),
        });
    }

    private mergeMin(
        existing: number | undefined,
        next: number | undefined
    ): number | undefined {
        if (existing === undefined) {
            return next;
        }

        if (next === undefined) {
            return existing;
        }

        return Math.max(existing, next);
    }

    private mergeMax(
        existing: number | undefined,
        next: number | undefined
    ): number | undefined {
        if (existing === undefined) {
            return next;
        }

        if (next === undefined) {
            return existing;
        }

        return Math.min(existing, next);
    }

    private mergeAllowedValues(
        existing: number[] | undefined,
        next: number[] | undefined
    ): number[] | undefined {
        if (!existing?.length) {
            return next;
        }

        if (!next?.length) {
            return existing;
        }

        return this.uniqueSortedNumbers([...existing, ...next]);
    }

    private readNumber(value: unknown): number | undefined {
        return typeof value === "number" && Number.isFinite(value)
            ? value
            : undefined;
    }

    private uniqueSortedNumbers(values: number[]): number[] {
        return [...new Set(values)].sort((a, b) => a - b);
    }
}
