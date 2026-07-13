export type DreoRegion = "EU" | "US" | "CN" | string;

export interface DreoSessionSnapshot {
    accessToken: string;
    refreshToken?: string;
    region: DreoRegion;
    accountId?: string;
}

export type DreoSessionChangeReason =
    | "initial-login"
    | "http-401-relogin"
    | "manual-relogin"
    | "logout";

export interface DreoSessionObserver {
    onSessionChanged?(
        snapshot: DreoSessionSnapshot,
        reason: DreoSessionChangeReason
    ): void | Promise<void>;

    onSessionInvalidated?(
        reason: DreoSessionChangeReason
    ): void | Promise<void>;
}
