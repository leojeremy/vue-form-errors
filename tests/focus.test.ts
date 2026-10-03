import { describe, it, expect, vi } from 'vitest';
import { defineComponent, ref } from 'vue';

import { useFormErrors, type AutoFocus, type ErrorSource, type LookupRoot } from '../src';
import { activeId, mountAttached, settle } from './helpers';

function formWith(template: string, errors = ref<ErrorSource>({}), options: { autoFocus?: AutoFocus } = {}) {
    let form!: ReturnType<typeof useFormErrors>;

    const wrapper = mountAttached(
        defineComponent({
            setup() {
                form = useFormErrors(errors, options);
                return { form };
            },
            template,
        }),
    );

    return { errors, wrapper, form: () => form };
}

describe('what receives focus', () => {
    it('focuses the control inside a wrapper that carries the id', async () => {
        // A custom input component that puts the id on its root <div>.
        const { errors } = formWith(`
            <form>
                <div id="colour" class="fancy-select"><span>Pick one</span><button type="button" id="colour-trigger">Open</button></div>
            </form>
        `);

        errors.value = { colour: 'Required.' };
        await settle();

        expect(activeId()).toBe('colour-trigger');
    });

    it('focuses the checked radio of a group, as Tab would', async () => {
        const { errors } = formWith(`
            <form>
                <fieldset id="plan">
                    <legend>Plan</legend>
                    <input type="radio" name="plan" id="plan-basic" value="basic" />
                    <input type="radio" name="plan" id="plan-pro" value="pro" checked />
                </fieldset>
            </form>
        `);

        errors.value = { plan: 'That plan is not available.' };
        await settle();

        expect(activeId()).toBe('plan-pro');
    });

    it('focuses the first enabled radio when none is checked', async () => {
        const { errors } = formWith(`
            <form>
                <fieldset id="plan">
                    <input type="radio" name="plan" id="plan-legacy" disabled />
                    <input type="radio" name="plan" id="plan-basic" />
                </fieldset>
            </form>
        `);

        errors.value = { plan: 'Required.' };
        await settle();

        expect(activeId()).toBe('plan-basic');
    });

    it('moves on to the next rejected field when the first cannot take focus', async () => {
        const { errors } = formWith(`
            <form>
                <div id="avatar"><span>Upload disabled</span></div>
                <input id="email" />
            </form>
        `);

        errors.value = { avatar: 'Too large.', email: 'Invalid.' };
        await settle();

        expect(activeId()).toBe('email');
    });

    it('passes focus options through, e.g. to stop the scroll jump', async () => {
        const errors = ref<ErrorSource>({});
        const focus = vi.spyOn(HTMLElement.prototype, 'focus');

        mountAttached(
            defineComponent({
                setup() {
                    useFormErrors(errors, { focusOptions: { preventScroll: true } });
                    return {};
                },
                template: '<form><input id="email" /></form>',
            }),
        );

        errors.value = { email: 'Invalid.' };
        await settle();

        expect(focus).toHaveBeenCalledWith({ preventScroll: true });
        focus.mockRestore();
    });
});

describe('when focus moves', () => {
    it('does not move focus at all with autoFocus: false', async () => {
        const { errors } = formWith('<form><input id="email" /><button id="submit">Go</button></form>', undefined, {
            autoFocus: false,
        });

        (document.getElementById('submit') as HTMLButtonElement).focus();
        errors.value = { email: 'Invalid.' };
        await settle();

        expect(activeId()).toBe('submit');
    });

    it('can be told to refocus when an identical resubmit is rejected again', async () => {
        // Same fields rejected twice: the automatic rule stays quiet so it
        // never fights the cursor, but the app can ask after each submit.
        const { errors, form } = formWith('<form><input id="email" /><button id="submit">Go</button></form>');

        errors.value = { email: 'Invalid.' };
        await settle();
        (document.getElementById('submit') as HTMLButtonElement).focus();

        errors.value = { email: 'Invalid.' };
        await settle();
        expect(activeId()).toBe('submit');

        await expect(form().focusFirstError()).resolves.toBe(true);
        expect(activeId()).toBe('email');
    });

    it('focuses on mount when asked, for a page that arrives already rejected', async () => {
        const errors = ref<ErrorSource>({ name: 'Required.', email: 'Invalid.' });

        mountAttached(
            defineComponent({
                setup() {
                    useFormErrors(errors, ['name', 'email'] as const, { focusOnMount: true });
                    return {};
                },
                template: '<form><input id="name" /><input id="email" /></form>',
            }),
        );
        await settle();

        expect(activeId()).toBe('name');
    });

    it('does not focus on mount by default', async () => {
        const errors = ref<ErrorSource>({ name: 'Required.' });

        mountAttached(
            defineComponent({
                setup() {
                    useFormErrors(errors, ['name'] as const);
                    return {};
                },
                template: '<form><input id="name" /></form>',
            }),
        );
        await settle();

        expect(activeId()).not.toBe('name');
    });

    it('focuses a single field on request', async () => {
        const { form } = formWith('<form><input id="name" /><input id="email" /></form>');

        await expect(form().focusField('email')).resolves.toBe(true);
        expect(activeId()).toBe('email');
        await expect(form().focusField('missing')).resolves.toBe(false);
    });
});

describe('lookup root', () => {
    it('finds and focuses fields inside a shadow root', async () => {
        const host = document.createElement('div');
        document.body.append(host);
        const shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = '<form><input id="name" /><input id="email" /></form>';

        const errors = ref<ErrorSource>({});
        const form = useFormErrors(errors, { root: shadow });

        errors.value = { email: 'Invalid.' };
        await settle();

        expect(shadow.activeElement?.id).toBe('email');
        expect(form.errorList()[0]?.targetId).toBe('email');
    });

    it('keeps lookups inside the given element when ids repeat elsewhere on the page', async () => {
        document.body.innerHTML = '<input id="email" data-where="outside" />';
        const scope = ref<LookupRoot | null>(null);
        const errors = ref<ErrorSource>({});

        mountAttached(
            defineComponent({
                setup() {
                    useFormErrors(errors, { root: scope });
                    return { scope };
                },
                template: '<form ref="scope"><input id="email" data-where="inside" /></form>',
            }),
        );

        errors.value = { email: 'Invalid.' };
        await settle();

        expect((document.activeElement as HTMLElement).dataset.where).toBe('inside');
    });
});
