import { createHash } from "node:crypto";

export class PasswordHasher {
    public hash(password: string): string {
        return createHash("md5").update(password).digest("hex");
    }
}
