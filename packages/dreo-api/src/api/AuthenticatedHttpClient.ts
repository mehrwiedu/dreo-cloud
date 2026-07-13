import type { DreoLogger } from "../DreoLogger.js";
import type { DreoSession } from "../DreoSession.js";

import { HttpClient, type RequestOptions } from "./HttpClient.js";

export class AuthenticatedHttpClient {
    public constructor(
        private readonly http: HttpClient,
        private readonly session: DreoSession,
        private readonly logger?: DreoLogger
    ) {}

    public async get<TResponse>(
        path: string,
        options: RequestOptions = {}
    ): Promise<TResponse> {
        return this.requestWithAuth<TResponse>("GET", path, undefined, options);
    }

    public async post<TResponse>(
        path: string,
        body?: unknown,
        options: RequestOptions = {}
    ): Promise<TResponse> {
        return this.requestWithAuth<TResponse>("POST", path, body, options);
    }

    private async requestWithAuth<TResponse>(
        method: "GET" | "POST",
        path: string,
        body: unknown,
        options: RequestOptions
    ): Promise<TResponse> {
        const accessToken = await this.session.getAccessToken();

        try {
            return await this.send<TResponse>(method, path, body, {
                ...options,
                headers: {
                    ...options.headers,
                    authorization: `Bearer ${accessToken}`,
                },
            });
        } catch (error) {
            if (!this.isUnauthorizedError(error)) {
                throw error;
            }

            this.logger?.warn?.(
                `Received HTTP 401 for ${method} ${path}. Refreshing session.`
            );

            const refreshedTokens = await this.session.refresh();

            this.logger?.info?.(
                `Session refreshed after HTTP 401. Retrying ${method} ${path}.`
            );

            return this.send<TResponse>(method, path, body, {
                ...options,
                headers: {
                    ...options.headers,
                    authorization: `Bearer ${refreshedTokens.accessToken}`,
                },
            });
        }
    }

    private async send<TResponse>(
        method: "GET" | "POST",
        path: string,
        body: unknown,
        options: RequestOptions
    ): Promise<TResponse> {
        this.logger?.debug?.(
            `Sending authenticated ${method} request to ${path}.`
        );

        if (method === "GET") {
            return this.http.get<TResponse>(path, options);
        }

        return this.http.post<TResponse>(path, body, options);
    }

    private isUnauthorizedError(error: unknown): boolean {
        return error instanceof Error && error.message.startsWith("HTTP 401");
    }
}
