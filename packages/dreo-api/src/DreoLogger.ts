export interface DreoLogger {
    debug?(message: string, data?: unknown): void;
    info?(message: string, data?: unknown): void;
    warn?(message: string, data?: unknown): void;
    error?(message: string, data?: unknown): void;
}

export const noopDreoLogger: Required<DreoLogger> = {
    debug() {
        // intentionally empty
    },

    info() {
        // intentionally empty
    },

    warn() {
        // intentionally empty
    },

    error() {
        // intentionally empty
    },
};
