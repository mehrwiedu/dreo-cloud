export class DreoError extends Error {
    public constructor(message: string) {
        super(message);

        this.name = "DreoError";
    }
}

export class DreoValidationError extends DreoError {
    public constructor(message: string) {
        super(message);

        this.name = "DreoValidationError";
    }
}

export class DreoAuthenticationError extends DreoError {
    public constructor(message: string) {
        super(message);

        this.name = "DreoAuthenticationError";
    }
}

export class DreoWebSocketError extends DreoError {
    public constructor(message: string) {
        super(message);

        this.name = "DreoWebSocketError";
    }
}
