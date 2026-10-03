import { describe, it, expect } from 'vitest';
import { ref } from 'vue';

import { useFormErrors, type FieldErrors } from '../src';

describe('attribute helpers', () => {
    it('keeps a hint in aria-describedby when an error appears', () => {
        // Replacing the hint with the error loses the one sentence that says
        // what the field wants, exactly when the user needs it.
        const errors = ref<FieldErrors<'amount'>>({});
        const form = useFormErrors(errors, ['amount'] as const);

        expect(form.describedBy('amount', 'amount-hint')).toBe('amount-hint');

        errors.value = { amount: 'Must be a whole number.' };
        expect(form.describedBy('amount', 'amount-hint')).toBe('amount-hint amount-error');
    });

    it('skips empty and duplicate ids', () => {
        const form = useFormErrors(() => ({ amount: 'Bad.' }), ['amount'] as const);

        expect(form.describedBy('amount', null, undefined, false, '', ['a', 'a', null], 'amount-error')).toBe(
            'a amount-error',
        );
    });

    it('returns undefined when there is nothing to point at, so the attribute is omitted', () => {
        const form = useFormErrors(() => ({}), ['amount'] as const);

        expect(form.describedBy('amount')).toBeUndefined();
        expect(form.describedBy('amount', null)).toBeUndefined();
    });

    it('gives all three attributes together for v-bind', () => {
        const form = useFormErrors(() => ({ email: ['Taken.'] }), ['name', 'email'] as const, { idPrefix: 'signup' });

        expect(form.fieldAttrs('email', { describedBy: 'signup-email-hint' })).toEqual({
            id: 'signup-email',
            'aria-invalid': 'true',
            'aria-describedby': 'signup-email-hint signup-email-error',
        });
        expect(form.fieldAttrs('name')).toEqual({
            id: 'signup-name',
            'aria-invalid': undefined,
            'aria-describedby': undefined,
        });
    });

    it('never produces an id with whitespace in it', () => {
        const form = useFormErrors(() => ({}), ['first name'] as const, { idPrefix: 'billing address' });

        expect(form.fieldId('first name')).toBe('billing-address-first-name');
        expect(form.errorId('first name')).toBe('billing-address-first-name-error');
    });

    it('accepts a ref as well as a getter, and ignores non-string messages from the wire', () => {
        const errors = ref<Record<string, unknown>>({ email: ['Taken.', 42, null, ''] });
        const form = useFormErrors(errors as never, ['email'] as const);

        expect(form.messages('email')).toEqual(['Taken.']);
        expect(form.hasErrors()).toBe(true);
    });

    it('works with fields passed as an option', () => {
        const form = useFormErrors(() => ({ b: 'x', a: 'y' }), { fields: ['a', 'b'] as const });

        expect(form.firstErroredField()).toBe('a');
        expect(form.errorList().map((entry) => entry.field)).toEqual(['a', 'b']);
    });
});
