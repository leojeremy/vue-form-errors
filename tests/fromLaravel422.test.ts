import { describe, it, expect } from 'vitest';

import { fromLaravel422 } from '../src';

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
