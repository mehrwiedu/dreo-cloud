import type { AuthTokens } from "./models/AuthTokens.js";
import type { DreoLogger } from "./DreoLogger.js";
import type {
    DreoSessionChangeReason,
    DreoSessionObserver,
    DreoSessionSnapshot,
} from "./DreoSessionObserver.js";

import { AuthManager } from "./auth/AuthManager.js";

export interface DreoSessionOptions {
    email: string;
    password: string;
    region: string;
    logger?: DreoLogger;
}

export type DreoSessionTokenHandler = (tokens: AuthTokens) => void;

export class DreoSession {
    private tokens?: AuthTokens;

    private readonly authManager: AuthManager;

    private readonly tokenHandlers = new Set<DreoSessionTokenHandler>();

    private readonly observers = new Set<DreoSessionObserver>();

    public constructor(private readonly options: DreoSessionOptions) {
        this.authManager = new AuthManager({
            logger: options.logger,
        });
    }

    public async login(): Promise<AuthTokens> {
        return this.loginWithReason("initial-login");
    }

    public async refresh(): Promise<AuthTokens> {
        return this.loginWithReason("http-401-relogin");
    }

    public async getAccessToken(): Promise<string> {
        if (!this.tokens) {
            await this.login();
        }

        return this.tokens!.accessToken;
    }

    public getRegion(): string | undefined {
        return this.tokens?.region;
    }

    public getCurrentTokens(): AuthTokens | undefined {
        return this.tokens;
    }

    public onTokenChanged(handler: DreoSessionTokenHandler): () => void {
        this.tokenHandlers.add(handler);

        return () => {
            this.tokenHandlers.delete(handler);
        };
    }

    public addObserver(observer: DreoSessionObserver): void {
        this.observers.add(observer);
    }

    public removeObserver(observer: DreoSessionObserver): void {
        this.observers.delete(observer);
    }

    public setAccessTokenForTesting(accessToken: string): void {
        if (!this.tokens) {
            throw new Error("No active session.");
        }

        this.tokens = {
            ...this.tokens,
            accessToken,
        };

        this.emitTokenChange(this.tokens);
    }

    private async loginWithReason(
        reason: DreoSessionChangeReason
    ): Promise<AuthTokens> {
        this.tokens = await this.authManager.login(this.options);
        this.emitTokenChange(this.tokens);
        await this.emitSessionChanged(this.tokens, reason);

        return this.tokens;
    }

    private emitTokenChange(tokens: AuthTokens): void {
        for (const handler of Array.from(this.tokenHandlers)) {
            handler(tokens);
        }
    }

    private async emitSessionChanged(
        tokens: AuthTokens,
        reason: DreoSessionChangeReason
    ): Promise<void> {
        const snapshot = this.createSnapshot(tokens);

        await Promise.all(
            Array.from(this.observers).map(async (observer) => {
                await observer.onSessionChanged?.(snapshot, reason);
            })
        );
    }

    private createSnapshot(tokens: AuthTokens): DreoSessionSnapshot {
        const extendedTokens = tokens as AuthTokens & {
            refreshToken?: string;
            accountId?: string;
        };

        return {
            accessToken: tokens.accessToken,
            refreshToken: extendedTokens.refreshToken,
            region: tokens.region,
            accountId: extendedTokens.accountId,
        };
    }
}
