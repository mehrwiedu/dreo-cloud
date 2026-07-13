import { HttpClient } from "../api/HttpClient.js";
import type { DreoLogger } from "../DreoLogger.js";
import { noopDreoLogger } from "../DreoLogger.js";
import type { AuthTokens } from "../models/AuthTokens.js";
import type { LoginResponse } from "../models/LoginResponse.js";

import { LoginRequestBuilder } from "./LoginRequestBuilder.js";

export interface LoginOptions {
    email: string;
    password: string;
    region: string;
}

export interface AuthManagerOptions {
    logger?: DreoLogger;
}

export class AuthManager {
    private readonly logger: DreoLogger;

    private readonly loginRequestBuilder = new LoginRequestBuilder();

    public constructor(options: AuthManagerOptions = {}) {
        this.logger = options.logger ?? noopDreoLogger;
    }

    public async login(options: LoginOptions): Promise<AuthTokens> {
        const baseUrl = `https://app-api-${options.region}.dreo-tech.com`;

        const http = new HttpClient({
            baseUrl,
        });

        const body = this.loginRequestBuilder.build(options);

        this.logger.info?.(`Logging in against region ${options.region}`);

        const response = await http.post<LoginResponse>(
            "/api/oauth/login",
            body
        );

        if (response.code !== 0) {
            throw new Error(
                `Dreo login failed: ${response.message ?? "Unknown error"}`
            );
        }

        return {
            accessToken: response.data.access_token,
            region: response.data.region,
        };
    }
}
