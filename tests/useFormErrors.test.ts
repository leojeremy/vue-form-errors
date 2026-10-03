import { describe, it, expect, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';

import { useFormErrors, type FieldErrors } from '../src';

type Field = 'first_name' | 'last_name' | 'email';

// These mount into the real document so focus can be asserted, and focus is
// resolved by `getElementById`. Without teardown the ids from one test are
// still in the DOM during the next, and every lookup finds the FIRST match,
// which is the previous test's detached form.
const mounted: VueWrapper[] = [];

afterEach(() => {
    while (mounted.length > 0) {
        mounted.pop()?.unmount();
    }

    document.body.innerHTML = '';
});

/** A miniature three-field form wired the way the README shows. */
function harness() {
    const errors = ref<FieldErrors<Field>>({});

    const Component = defineComponent({
        setup() {
            const { errorId, describedBy, invalid, message } = useFormErrors(
                () => errors.value,
                ['first_name', 'last_name', 'email'] as const,
            );

            return { errorId, describedBy, invalid, message };
        },
        template: `
            <form>
                <input id="first_name" :aria-invalid="invalid('first_name')" :aria-describedby="describedBy('first_name')" />
                <p v-if="message('first_name')" :id="errorId('first_name')">{{ message('first_name') }}</p>
                <input id="last_name" :aria-invalid="invalid('last_name')" :aria-describedby="describedBy('last_name')" />
                <p v-if="message('last_name')" :id="errorId('last_name')">{{ message('last_name') }}</p>
                <input id="email" :aria-invalid="invalid('email')" :aria-describedby="describedBy('email')" />
                <p v-if="message('email')" :id="errorId('email')">{{ message('email') }}</p>
            </form>
        `,
    });

    const wrapper = mount(Component, { attachTo: document.body });
    mounted.push(wrapper);

    return { errors, wrapper };
}

/** Lets the watcher run, then the `nextTick` it awaits before focusing. */
async function settle(wrapper: VueWrapper): Promise<void> {
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
}

describe('useFormErrors', () => {
    it('says nothing about a field that has not been judged', () => {
        // Not `aria-invalid="false"`: an untouched field is unjudged, not
        // valid, and announcing every input as explicitly-not-invalid is
        // noise on a form with a dozen of them.
        const { wrapper } = harness();

        expect(wrapper.get('#email').attributes('aria-invalid')).toBeUndefined();
        expect(wrapper.get('#email').attributes('aria-describedby')).toBeUndefined();
    });

    it('points the rejected input at the message that explains it', async () => {
        const { errors, wrapper } = harness();

        errors.value = { email: 'That address is already in use.' };
        await wrapper.vm.$nextTick();

        const input = wrapper.get('#email');
        expect(input.attributes('aria-invalid')).toBe('true');

        // The reference must resolve. A describedby pointing at nothing is
        // the same silence as having no describedby at all.
        const describedBy = input.attributes('aria-describedby');
        expect(describedBy).toBe('email-error');
        expect(wrapper.get(`#${describedBy}`).text()).toBe('That address is already in use.');
    });

    it('leaves untouched fields alone when a sibling is rejected', async () => {
        const { errors, wrapper } = harness();

        errors.value = { email: 'Invalid.' };
        await wrapper.vm.$nextTick();

        expect(wrapper.get('#first_name').attributes('aria-invalid')).toBeUndefined();
    });

    it('focuses the first error in PAGE order, not in the order the server sent them', async () => {
        // The validator returns keys in whatever order it produced them.
        // "First error" has to mean first on the page, or focus jumps into
        // the middle of the form and the user cannot tell what moved.
        const { errors, wrapper } = harness();

        errors.value = { email: 'Invalid.', first_name: 'Required.' };
        await settle(wrapper);

        expect(document.activeElement).toBe(wrapper.get('#first_name').element);
    });

    it('does not steal the cursor while the error is being corrected', async () => {
        // Re-focusing on every keystroke would fight the person fixing the
        // field. Focus moves when the form goes from clean to rejected, and
        // not again while the same set of fields stays rejected.
        const { errors, wrapper } = harness();

        errors.value = { last_name: 'Required.' };
        await settle(wrapper);
        expect(document.activeElement).toBe(wrapper.get('#last_name').element);

        // The user tabs away to another field, the message text changes but
        // the same field is still the one at fault.
        (wrapper.get('#email').element as HTMLInputElement).focus();
        errors.value = { last_name: 'Still required.' };
        await settle(wrapper);

        expect(document.activeElement).toBe(wrapper.get('#email').element);
    });

    it('does not move focus when a rejected field is cleared while another stays rejected', async () => {
        // A common pattern clears a field's error as soon as the user edits
        // it. The set of rejected fields shrinks, but nothing new was
        // rejected, so the cursor must stay where the user is typing.
        const { errors, wrapper } = harness();

        errors.value = { first_name: 'Required.', email: 'Invalid.' };
        await settle(wrapper);
        expect(document.activeElement).toBe(wrapper.get('#first_name').element);

        // The user moves to the email field and starts fixing it.
        (wrapper.get('#email').element as HTMLInputElement).focus();
        errors.value = { first_name: 'Required.' };
        await settle(wrapper);

        expect(document.activeElement).toBe(wrapper.get('#email').element);
    });

    it('moves focus again when a later submit is rejected', async () => {
        const { errors, wrapper } = harness();

        errors.value = { email: 'Invalid.' };
        await settle(wrapper);
        expect(document.activeElement).toBe(wrapper.get('#email').element);

        // Corrected, resubmitted, rejected on a different field.
        errors.value = {};
        await wrapper.vm.$nextTick();
        errors.value = { last_name: 'Required.' };
        await settle(wrapper);

        expect(document.activeElement).toBe(wrapper.get('#last_name').element);
    });

    it('accepts a list of messages per field, as Laravel sends them', async () => {
        const { errors, wrapper } = harness();

        errors.value = { email: ['The email must be valid.', 'The email is too long.'] };
        await settle(wrapper);

        const input = wrapper.get('#email');
        expect(input.attributes('aria-invalid')).toBe('true');
        expect(wrapper.get('#email-error').text()).toBe('The email must be valid.');
        expect(document.activeElement).toBe(input.element);
    });

    it('treats an empty message list or empty string as no error', async () => {
        // `[]` is truthy. Checking the raw value would mark the field invalid
        // and point it at an error element that is never rendered.
        const { errors, wrapper } = harness();

        errors.value = { first_name: [], last_name: '', email: 'Invalid.' };
        await settle(wrapper);

        expect(wrapper.get('#first_name').attributes('aria-invalid')).toBeUndefined();
        expect(wrapper.get('#first_name').attributes('aria-describedby')).toBeUndefined();
        expect(wrapper.get('#last_name').attributes('aria-invalid')).toBeUndefined();
        expect(document.activeElement).toBe(wrapper.get('#email').element);
    });
});
