import { describe, it, expect } from 'vitest';

import { fromLaravel422, readValidationErrors } from '../src';

describe('fromLaravel422', () => {
    it("reads Laravel's JSON 422 shape: a list of messages per field", () => {
        const body = {
            message: 'The email field must be a valid email address. (and 1 more error)',
            errors: {
                email: ['The email field must be a valid email address.'],
                'items.0.qty': ['The items.0.qty field must be at least 1.', 'The items.0.qty field must be an integer.'],
            },
        };

        expect(fromLaravel422(body)).toEqual({
            email: ['The email field must be a valid email address.'],
            'items.0.qty': ['The items.0.qty field must be at least 1.', 'The items.0.qty field must be an integer.'],
        });
    });

    it('reads the flattened shape Inertia uses: one string per field', () => {
        expect(fromLaravel422({ errors: { name: 'The name field is required.' } })).toEqual({
            name: ['The name field is required.'],
        });
    });

    it('drops empty and non-string messages', () => {
        expect(fromLaravel422({ errors: { a: [], b: '', c: [null, 'Kept.', 3], d: null } })).toEqual({ c: ['Kept.'] });
    });

    it.each([null, undefined, 'Server Error', 42, {}, { errors: null }, { errors: ['x'] }, { errors: 'x' }])(
        'returns an empty object for a body that is not a validation response: %j',
        (body) => {
            expect(fromLaravel422(body)).toEqual({});
        },
    );
});

describe('readValidationErrors', () => {
    const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

    it('returns the field errors of a 422', async () => {
        await expect(
            readValidationErrors(json(422, { message: 'Invalid.', errors: { email: ['Taken.'] } })),
        ).resolves.toEqual({ email: ['Taken.'] });
    });

    it('returns null for anything that is not a validation failure, so errors are not silently cleared', async () => {
        await expect(readValidationErrors(json(500, { message: 'Server Error' }))).resolves.toBeNull();
        await expect(readValidationErrors(json(419, { message: 'CSRF token mismatch.' }))).resolves.toBeNull();
        await expect(readValidationErrors(json(200, { ok: true }))).resolves.toBeNull();
    });

    it('returns null for a 422 whose body is not JSON', async () => {
        await expect(readValidationErrors(new Response('<html>Unprocessable</html>', { status: 422 }))).resolves.toBeNull();
    });

    it('returns an empty object for a 422 with no field errors', async () => {
        await expect(readValidationErrors(json(422, { message: 'Invalid.' }))).resolves.toEqual({});
    });
});
