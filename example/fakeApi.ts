/**
 * A stand-in for a Laravel backend that runs in the browser, so the example
 * works on static hosting. It returns real `Response` objects with Laravel's
 * JSON validation shape: `{ message, errors: { field: string[] } }`.
 * Nothing is stored or sent anywhere.
 */

type Body = Record<string, unknown>;
type Errors = Record<string, string[]>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(body: Body, field: string): string {
    const value = body[field];

    return typeof value === 'string' ? value.trim() : '';
}

function add(errors: Errors, field: string, message: string): void {
    (errors[field] ??= []).push(message);
}

function validateOrder(body: Body): Errors {
    const errors: Errors = {};

    if (text(body, 'name') === '') add(errors, 'name', 'The name field is required.');

    const email = text(body, 'email');
    if (email === '') add(errors, 'email', 'The email field is required.');
    else if (!EMAIL.test(email)) add(errors, 'email', 'The email field must be a valid email address.');
    else if (email.toLowerCase() === 'taken@example.com') add(errors, 'email', 'The email has already been taken.');

    const plan = text(body, 'plan');
    if (plan === '') add(errors, 'plan', 'The plan field is required.');
    else if (plan === 'team') add(errors, 'plan', 'The selected plan is not available yet.');

    const items = Array.isArray(body.items) ? (body.items as Body[]) : [];
    if (items.length === 0) add(errors, 'items', 'Add at least one item.');

    let total = 0;
    items.forEach((row, index) => {
        if (text(row, 'product') === '') add(errors, `items.${index}.product`, `The items.${index}.product field is required.`);

        const qty = Number(text(row, 'qty'));
        if (!Number.isInteger(qty)) add(errors, `items.${index}.qty`, `The items.${index}.qty field must be an integer.`);
        else if (qty < 1) add(errors, `items.${index}.qty`, `The items.${index}.qty field must be at least 1.`);
        else total += qty;
    });

    // A rule about the whole order, not any one field: Laravel keys these
    // however the app chooses. It matches no input, so it appears in the
    // summary as plain text.
    if (total > 50) add(errors, 'order', 'Orders over 50 units need a sales quote.');

    if (text(body, 'address') === '') add(errors, 'address', 'The address field is required.');

    const postcode = text(body, 'postcode');
    if (postcode === '') add(errors, 'postcode', 'The postcode field is required.');
    else if (!/^[0-9]{5}$/.test(postcode)) add(errors, 'postcode', 'The postcode field must be 5 digits.');

    if (body.terms !== true) add(errors, 'terms', 'The terms field must be accepted.');

    return errors;
}

function validateNewsletter(body: Body): Errors {
    const errors: Errors = {};

    if (text(body, 'name') === '') add(errors, 'name', 'The name field is required.');
    if (!EMAIL.test(text(body, 'email'))) add(errors, 'email', 'The email field must be a valid email address.');

    return errors;
}

/** Laravel's summary line: the first message, plus a count of the rest. */
function summary(errors: Errors): string {
    const all = Object.values(errors).flat();
    const rest = all.length - 1;

    return rest > 0 ? `${all[0]} (and ${rest} more error${rest === 1 ? '' : 's'})` : (all[0] ?? '');
}

function json(status: number, payload: unknown): Response {
    return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

const validators: Record<string, (body: Body) => Errors> = {
    '/api/orders': validateOrder,
    '/api/newsletter': validateNewsletter,
};

export async function fakePost(url: string, body: Body, options: { serverError?: boolean } = {}): Promise<Response> {
    // A little latency, so the busy state is visible.
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (options.serverError) {
        return json(500, { message: 'Server Error' });
    }

    const validate = validators[url];

    if (validate === undefined) {
        return json(404, { message: 'Not Found' });
    }

    const errors = validate(body);

    return Object.keys(errors).length > 0 ? json(422, { message: summary(errors), errors }) : json(201, { message: 'Saved.' });
}
