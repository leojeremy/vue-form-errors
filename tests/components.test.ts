import { describe, it, expect } from 'vitest';
import { defineComponent, ref } from 'vue';

import { FormErrorSummary, FormField, useFormErrors, type AutoFocus, type ErrorSource } from '../src';
import { activeId, mountAttached, settle } from './helpers';

function signup(autoFocus: AutoFocus = 'field') {
    const errors = ref<ErrorSource>({});

    const wrapper = mountAttached(
        defineComponent({
            components: { FormField, FormErrorSummary },
            setup() {
                const form = useFormErrors(errors, ['name', 'email', 'plan'] as const, { autoFocus, idPrefix: 'signup' });
                return { form };
            },
            template: `
                <form>
                    <FormErrorSummary :form="form" />
                    <FormField :form="form" name="name" label="Name">
                        <template #default="{ attrs }"><input v-bind="attrs" /></template>
                    </FormField>
                    <FormField :form="form" name="email" label="Email" hint="We never share it.">
                        <template #default="{ attrs }"><input v-bind="attrs" type="email" /></template>
                    </FormField>
                    <FormField :form="form" name="plan" label="Plan" group>
                        <input type="radio" name="plan" id="plan-basic" />
                        <input type="radio" name="plan" id="plan-pro" />
                    </FormField>
                    <button id="submit">Sign up</button>
                </form>
            `,
        }),
    );

    return { errors, wrapper };
}

describe('FormField', () => {
    it('connects the label, and keeps the hint described while clean', () => {
        const { wrapper } = signup();

        expect(wrapper.get('label[for="signup-email"]').text()).toBe('Email');
        const input = wrapper.get('#signup-email');
        expect(input.attributes('aria-describedby')).toBe('signup-email-hint');
        expect(wrapper.get('#signup-email-hint').text()).toBe('We never share it.');
        expect(input.attributes('aria-invalid')).toBeUndefined();
        expect(wrapper.find('#signup-email-error').exists()).toBe(false);
    });

    it('renders every message and points the control at both hint and error', async () => {
        const { errors, wrapper } = signup();

        errors.value = { email: ['The email must be valid.', 'The email is too long.'] };
        await settle();

        const input = wrapper.get('#signup-email');
        expect(input.attributes('aria-invalid')).toBe('true');
        expect(input.attributes('aria-describedby')).toBe('signup-email-hint signup-email-error');
        expect(wrapper.findAll('#signup-email-error p').map((p) => p.text())).toEqual([
            'The email must be valid.',
            'The email is too long.',
        ]);
        expect(wrapper.find('#signup-email').element.closest('.form-field')?.hasAttribute('data-invalid')).toBe(true);
        expect(activeId()).toBe('signup-email');
    });

    it('renders a group as a fieldset whose description resolves, and focuses its first radio', async () => {
        const { errors, wrapper } = signup();

        errors.value = { plan: 'Choose a plan.' };
        await settle();

        const fieldset = wrapper.get('fieldset#signup-plan');
        expect(fieldset.get('legend').text()).toBe('Plan');
        expect(fieldset.attributes('aria-describedby')).toBe('signup-plan-error');
        expect(wrapper.get('#signup-plan-error').text()).toBe('Choose a plan.');
        expect(activeId()).toBe('plan-basic');
    });
});

describe('FormErrorSummary', () => {
    it('renders nothing until there are errors', () => {
        const { wrapper } = signup();

        expect(wrapper.find('.form-error-summary').exists()).toBe(false);
    });

    it('lists errors in page order, linking each to its field, form-level ones as text', async () => {
        const { errors, wrapper } = signup();

        errors.value = { general: 'Sign-ups are paused.', email: 'Invalid.', name: 'Required.' };
        await settle();

        const summary = wrapper.get('#signup-error-summary');
        expect(summary.attributes('role')).toBe('region');
        expect(summary.attributes('aria-labelledby')).toBe('signup-error-summary-title');
        expect(summary.get('h2').text()).toBe('There is a problem');

        const items = summary.findAll('li');
        expect(items.map((li) => li.text())).toEqual(['Required.', 'Invalid.', 'Sign-ups are paused.']);
        expect(items[0]?.get('a').attributes('href')).toBe('#signup-name');
        expect(items[2]?.find('a').exists()).toBe(false);
    });

    it('focuses the field when a summary link is clicked', async () => {
        const { errors, wrapper } = signup();

        errors.value = { name: 'Required.', email: 'Invalid.' };
        await settle();
        (document.getElementById('submit') as HTMLButtonElement).focus();

        await wrapper.get('a[href="#signup-email"]').trigger('click');
        await settle();

        expect(activeId()).toBe('signup-email');
    });

    it("takes focus itself, as an alert, with autoFocus: 'summary'", async () => {
        const { errors, wrapper } = signup('summary');

        errors.value = { email: 'Invalid.' };
        await settle();

        const summary = wrapper.get('#signup-error-summary');
        expect(summary.attributes('role')).toBe('alert');
        expect(summary.attributes('tabindex')).toBe('-1');
        expect(activeId()).toBe('signup-error-summary');
    });

    it("falls back to the field when autoFocus is 'summary' but no summary is rendered", async () => {
        const errors = ref<ErrorSource>({});

        mountAttached(
            defineComponent({
                setup() {
                    useFormErrors(errors, { autoFocus: 'summary' });
                    return {};
                },
                template: '<form><input id="email" /></form>',
            }),
        );

        errors.value = { email: 'Invalid.' };
        await settle();

        expect(activeId()).toBe('email');
    });
});
