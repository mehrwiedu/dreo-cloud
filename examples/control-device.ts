import "dotenv/config";

import { DreoClient, type DreoDevice } from "../packages/dreo-api/src/index.js";

type SupportedAction =
    | "power-on"
    | "power-off"
    | "fan-on"
    | "fan-off";

function readAction(value: string | undefined): SupportedAction {
    switch (value) {
        case "power-on":
        case "power-off":
        case "fan-on":
        case "fan-off":
            return value;
        default:
            throw new Error(
                "DREO_CONTROL_ACTION must be one of: power-on, power-off, fan-on, fan-off."
            );
    }
}

async function runAction(
    device: DreoDevice,
    action: SupportedAction
): Promise<void> {
    switch (action) {
        case "power-on":
            await device.setPower(true);
            return;
        case "power-off":
            await device.setPower(false);
            return;
        case "fan-on":
            await device.setFan(true);
            return;
        case "fan-off":
            await device.setFan(false);
            return;
    }
}

async function main(): Promise<void> {
    const email = process.env.DREO_EMAIL;
    const password = process.env.DREO_PASSWORD;
    const region = process.env.DREO_REGION ?? "EU";
    const serialNumber = process.env.DREO_DEVICE_SN?.trim();
    const action = readAction(process.env.DREO_CONTROL_ACTION?.trim());
    const confirmed = process.env.DREO_CONFIRM_WRITE === "YES";

    if (!email || !password) {
        throw new Error("DREO_EMAIL and DREO_PASSWORD must be set.");
    }

    if (!serialNumber) {
        throw new Error("DREO_DEVICE_SN must be set explicitly.");
    }

    if (!confirmed) {
        throw new Error(
            'Set DREO_CONFIRM_WRITE=YES to confirm that this example may change a real device.'
        );
    }

    const client = await DreoClient.login({
        email,
        password,
        region,
    });

    try {
        const device = client.getDevice(serialNumber);

        if (!device) {
            throw new Error(
                `No discovered DREO device matches serial number ${serialNumber}.`
            );
        }

        console.log(
            `Executing "${action}" on ${device.name} (${device.model}).`
        );

        await runAction(device, action);

        console.log("Command completed.");
    } finally {
        client.disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
