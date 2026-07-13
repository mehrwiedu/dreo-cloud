import { PasswordHasher } from "../crypto/PasswordHasher.js";

import type { LoginOptions } from "./AuthManager.js";

export class LoginRequestBuilder {
    private readonly passwordHasher = new PasswordHasher();

    public build(options: LoginOptions): Record<string, unknown> {
        return {
            acceptLanguage: "en",
            client_id: "7de37c362ee54dcf9c4561812309347a",
            client_secret: "32dfa0764f25451d99f94e1693498791",
            email: options.email,
            encrypt: "ciphertext",
            grant_type: "email-password",
            himei: "faede31549d649f58864093158787ec9",
            password: this.passwordHasher.hash(options.password),
            scope: "all",
        };
    }
}
