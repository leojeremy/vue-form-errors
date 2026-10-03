import { describe, it, expect, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, ref, type Ref } from 'vue';

import { useFormErrors, type FieldErrors } from '../src';

type Field = 'name' | 'email';

const mounted: VueWrapper[] = [];

afterEach(() => {
    while (mounted.length > 0) {
        mounted.pop()?.unmount();
    }

    document.body.innerHTML = '';
});

/** One form; two of these with the same field names sit on the same page. */
function mountForm(errors: Ref<FieldErrors<Field>>, idPrefix: string) {
    const Component = defineComponent({
        setup() {
            const form = useFormErrors(() => errors.value, ['name', 'email'] as const, { idPrefix });

            return { ...form };
        },
        template: `
            <form>
                <input :id="fieldId('name')" :aria-invalid="invalid('name')" :aria-describedby="describedBy('name')" />
                <p v-if="message('name')" :id="errorId('name')">{{ message('name') }}</p>
                <input :id="fieldId('email')" :aria-invalid="invalid('email')" :aria-describedby="describedBy('email')" />
                <p v-if="message('email')" :id="errorId('email')">{{ message('email') }}</p>
            </form>
        `,
    });

    const wrapper = mount(Component, { attachTo: document.body });
    mounted.push(wrapper);

    return wrapper;
}

describe('useFormErrors with two forms on one page', () => {
    it('focuses the rejected field in the form that was rejected, not its namesake', async () => {
        const zoneErrors = ref<FieldErrors<Field>>({});
        const rateErrors = ref<FieldErrors<Field>>({});
        mountForm(zoneErrors, 'zone');
        const rate = mountForm(rateErrors, 'rate');

        rateErrors.value = { name: 'Required.' };
        await rate.vm.$nextTick();
        await rate.vm.$nextTick();

        expect(document.activeElement).toBe(rate.get('#rate-name').element);
    });

    it('gives every field and error element a unique id that resolves within its own form', async () => {
        const zoneErrors = ref<FieldErrors<Field>>({ name: 'Zone name taken.' });
        const rateErrors = ref<FieldErrors<Field>>({ name: 'Rate name taken.' });
        const zone = mountForm(zoneErrors, 'zone');
        const rate = mountForm(rateErrors, 'rate');
        await rate.vm.$nextTick();

        const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
        expect(new Set(ids).size).toBe(ids.length);

        const rateInput = rate.get('#rate-name');
        expect(document.getElementById(rateInput.attributes('aria-describedby')!)?.textContent).toBe('Rate name taken.');
        const zoneInput = zone.get('#zone-name');
        expect(document.getElementById(zoneInput.attributes('aria-describedby')!)?.textContent).toBe('Zone name taken.');
    });

    it('keeps the unprefixed ids when no prefix is given', () => {
        const { fieldId, errorId } = useFormErrors(() => ({}), ['email'] as const);

        expect(fieldId('email')).toBe('email');
        expect(errorId('email')).toBe('email-error');
    });
});
