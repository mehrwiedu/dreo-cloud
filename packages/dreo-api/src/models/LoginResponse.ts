export interface LoginResponse {
    code: number;
    message?: string;
    data: LoginResponseData;
}

export interface LoginResponseData {
    access_token: string;
    region: string;
}
