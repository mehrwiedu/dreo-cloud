import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import { after, before, test } from 'node:test';

// Run after "npm run build" from the repository root.
// Destination: tools/HttpClient.timeout.test.mjs
import { HttpClient } from '../packages/dreo-api/dist/api/HttpClient.js';

let server;
let client;
const received = { noHeaders: 0, stalledBody: 0 };

before(async () => {
    server = createServer(async (request, response) => {
        const url = new URL(request.url ?? '/', 'http://localhost');

        if (url.pathname === '/never-respond') {
            received.noHeaders += 1;
            // Connection accepted; intentionally never send HTTP headers.
            return;
        }

        if (url.pathname === '/stalled-body') {
            received.stalledBody += 1;
            response.writeHead(200, { 'content-type': 'application/json' });
            response.write('{"partial":');
            // Headers and partial body sent; intentionally never finish JSON.
            return;
        }

        if (url.pathname === '/get') {
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(JSON.stringify({
                ok: true,
                probe: url.searchParams.get('probe'),
                hasTimestamp: url.searchParams.has('timestamp'),
            }));
            return;
        }

        if (url.pathname === '/post') {
            const chunks = [];
            for await (const chunk of request) chunks.push(chunk);
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(JSON.stringify({
                body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
                customHeader: request.headers['x-sdk-test'],
            }));
            return;
        }

        response.writeHead(503, 'Service Unavailable');
        response.end('Unavailable');
    });

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    client = new HttpClient({ baseUrl: `http://127.0.0.1:${address.port}/` });
});

after(async () => {
    if (!server) return;
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
    });
});

test('GET returns JSON and preserves query parameters', async () => {
    const data = await client.get('/get', { query: { probe: 'timeout-regression' } });
    assert.deepEqual(data, {
        ok: true,
        probe: 'timeout-regression',
        hasTimestamp: true,
    });
});

test('POST preserves JSON body and custom headers', async () => {
    const data = await client.post('/post', { value: 42 }, {
        headers: { 'x-sdk-test': 'present' },
    });
    assert.deepEqual(data, {
        body: { value: 42 },
        customHeader: 'present',
    });
});

test('Non-2xx HTTP responses still throw', async () => {
    await assert.rejects(client.get('/unavailable'), /HTTP 503/);
});

test('30-second timeout aborts both stalled headers and stalled JSON body',
    { timeout: 45_000 },
    async () => {
        // A second guard makes even a broken SDK test terminate predictably.
        const watchdog = setTimeout(() => {
            server.closeAllConnections();
        }, 40_000);

        async function expectTimeout(path) {
            const started = performance.now();
            let caught;
            try {
                await client.get(path);
            } catch (error) {
                caught = error;
            }
            const elapsed = Math.round(performance.now() - started);
            assert.ok(caught, `${path}: request unexpectedly succeeded`);
            assert.match(
                caught.name,
                /^(TimeoutError|AbortError)$/,
                `${path}: unexpected error after ${elapsed} ms: ${caught.message}`,
            );
            assert.ok(
                elapsed >= 28_000 && elapsed <= 38_000,
                `${path}: expected approximately 30 seconds, got ${elapsed} ms`,
            );
            console.log(`${path}: ${caught.name} after ${elapsed} ms`);
        }

        try {
            await Promise.all([
                expectTimeout('/never-respond'),
                expectTimeout('/stalled-body'),
            ]);
            assert.equal(received.noHeaders, 1);
            assert.equal(received.stalledBody, 1);
        } finally {
            clearTimeout(watchdog);
        }
    },
);
