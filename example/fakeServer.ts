import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

/**
 * A stand-in for a Laravel backend, so the example has a real HTTP 422 to
 * handle. It answers two endpoints with Laravel's JSON validation shape:
 * `{ message, errors: { field: string[] } }`. Nothing is stored.
 */

type Body = Record<string, unknown>;
type Rules = Record<string, (value: string, body: Body) => string[]>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(body: Body, field: string): string {
    const value = body[field];

    return typeof value === 'string' ? value.trim() : '';
}

const required = (label: string) => (value: string) => (value === '' ? [`The ${label} field is required.`] : []);

const registerRules: Rules = {
    name: required('name'),
    email: (value) => {
        if (value === '') return ['The email field is required.'];
        if (!EMAIL.test(value)) return ['The email field must be a valid email address.'];
        if (value.toLowerCase() === 'taken@example.com') return ['The email has already been taken.'];
        return [];
    },
    phone: (value) => (value !== '' && !/^\+?[0-9 ]{7,15}$/.test(value) ? ['The phone field format is invalid.'] : []),
    address: required('address'),
    city: required('city'),
    postcode: (value) => {
        if (value === '') return ['The postcode field is required.'];
        if (!/^[0-9]{5}$/.test(value)) return ['The postcode field must be 5 digits.'];
        return [];
    },
    password: (value) => {
        const messages: string[] = [];
        if (value.length < 8) messages.push('The password field must be at least 8 characters.');
        if (!/[0-9]/.test(value)) messages.push('The password field must contain at least one number.');
        return messages;
    },
    password_confirmation: (value, body) =>
        value !== text(body, 'password') ? ['The password field confirmation does not match.'] : [],
};

const newsletterRules: Rules = {
    name: required('name'),
    email: (value) => (EMAIL.test(value) ? [] : ['The email field must be a valid email address.']),
};

function validate(body: Body, rules: Rules): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    for (const [field, rule] of Object.entries(rules)) {
        const messages = rule(text(body, field), body);
        if (messages.length > 0) errors[field] = messages;
    }

    return errors;
}

/** Laravel's summary line: the first message, plus a count of the rest. */
function summary(errors: Record<string, string[]>): string {
    const all = Object.values(errors).flat();
    const rest = all.length - 1;

    return rest > 0 ? `${all[0]} (and ${rest} more error${rest === 1 ? '' : 's'})` : (all[0] ?? '');
}

function readJson(req: IncomingMessage): Promise<Body> {
    return new Promise((resolve) => {
        let raw = '';
        req.on('data', (chunk: Buffer) => {
            raw += chunk.toString();
        });
        req.on('end', () => {
            try {
                const parsed: unknown = JSON.parse(raw);
                resolve(typeof parsed === 'object' && parsed !== null ? (parsed as Body) : {});
            } catch {
                resolve({});
            }
        });
    });
}

function send(res: ServerResponse, status: number, payload: unknown): void {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
}

const endpoints: Record<string, Rules> = {
    '/api/register': registerRules,
    '/api/newsletter': newsletterRules,
};

async function handle(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> {
    const rules = req.url ? endpoints[req.url] : undefined;

    if (req.method !== 'POST' || rules === undefined) {
        next();
        return;
    }

    // A little latency, so the submit button's busy state is visible.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const errors = validate(await readJson(req), rules);

    if (Object.keys(errors).length > 0) {
        send(res, 422, { message: summary(errors), errors });
        return;
    }

    send(res, 201, { message: 'Saved.' });
}

export function fakeServer(): Plugin {
    return {
        name: 'example-fake-server',
        configureServer(server) {
            server.middlewares.use((req, res, next) => void handle(req, res, next));
        },
        configurePreviewServer(server) {
            server.middlewares.use((req, res, next) => void handle(req, res, next));
        },
    };
}
