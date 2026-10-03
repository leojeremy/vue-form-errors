// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { nextTick, ref } from 'vue';

import { useFormErrors, type FieldErrors } from '../src';

describe('useFormErrors without a DOM', () => {
    it('still reports field state, and skips focusing instead of throwing', async () => {
        // Server-side code and tests run in environments with no `document`.
        // The attributes are still useful there; focus simply has nowhere
        // to go.
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const errors = ref<FieldErrors<'name' | 'email'>>({});
        const form = useFormErrors(() => errors.value, ['name', 'email'] as const);

        errors.value = { email: ['Taken.'] };
        await nextTick();
        await nextTick();

        expect(typeof document).toBe('undefined');
        expect(form.invalid('email')).toBe('true');
        expect(form.firstErroredField()).toBe('email');
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });
});
