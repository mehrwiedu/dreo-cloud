export interface HttpClientOptions {
    baseUrl: string;
}

export interface RequestOptions {
    headers?: Record<string, string>;
    query?: Record<string, string | number | boolean>;
    body?: unknown;
}

export class HttpClient {
    public constructor(private readonly options: HttpClientOptions) {}

    public async get<TResponse>(
        path: string,
        options: RequestOptions = {}
    ): Promise<TResponse> {
        return this.request<TResponse>("GET", path, options);
    }

    public async post<TResponse>(
        path: string,
        body?: unknown,
        options: RequestOptions = {}
    ): Promise<TResponse> {
        return this.request<TResponse>("POST", path, {
            ...options,
            body,
        });
    }

    private async request<TResponse>(
        method: string,
        path: string,
        options: RequestOptions
    ): Promise<TResponse> {
        const url = new URL(path, this.options.baseUrl);
        url.searchParams.set("timestamp", Date.now().toString());

        for (const [key, value] of Object.entries(options.query ?? {})) {
            url.searchParams.set(key, String(value));
        }

        const response = await fetch(url, {
            method,
            headers: {
                ua: "dreo/2.8.2",
                lang: "en",
                "content-type": "application/json; charset=UTF-8",
                "accept-encoding": "gzip",
                "user-agent": "okhttp/4.9.1",
                ...options.headers,
            },
            body:
                options.body === undefined
                    ? undefined
                    : JSON.stringify(options.body),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        return (await response.json()) as TResponse;
    }
}
