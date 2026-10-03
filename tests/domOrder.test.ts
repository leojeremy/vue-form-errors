import { describe, it, expect } from 'vitest';
import { defineComponent, ref } from 'vue';

import { useFormErrors, type ErrorSource } from '../src';
import { activeId, mountAttached, settle } from './helpers';

describe('page order read from the DOM (no `fields` given)', () => {
    function harness(rows: number[]) {
        const errors = ref<ErrorSource>({});

        const wrapper = mountAttached(
            defineComponent({
                setup() {
                    const form = useFormErrors(errors);

                    return { form, rows };
                },
                template: `
                    <form>
                        <input :id="form.fieldId('title')" />
                        <div v-for="row in rows" :key="row">
                            <input :id="form.fieldId('items.' + row + '.qty')" v-bind="form.fieldAttrs('items.' + row + '.qty')" />
                        </div>
                        <input :id="form.fieldId('notes')" />
                    </form>
                `,
            }),
        );

        return { errors, wrapper };
    }

    it('focuses the first rejected field on the page, whatever order the keys arrive in', async () => {
        const { errors } = harness([0, 1, 2]);

        errors.value = { notes: 'Too long.', 'items.2.qty': 'Must be at least 1.', 'items.1.qty': 'Required.' };
        await settle();

        expect(activeId()).toBe('items.1.qty');
    });

    it('handles keys for rows that only exist at runtime, dots and all', async () => {
        const { errors, wrapper } = harness([0, 1, 2]);

        errors.value = { 'items.2.qty': ['Must be at least 1.'] };
        await settle();

        const input = wrapper.find('[id="items.2.qty"]');
        expect(input.attributes('aria-invalid')).toBe('true');
        expect(input.attributes('aria-describedby')).toBe('items.2.qty-error');
        expect(activeId()).toBe('items.2.qty');
    });

    it('lists keys with no element on the page last, unlinked, and never focuses them', async () => {
        const { errors } = harness([0]);
        let form!: ReturnType<typeof useFormErrors>;

        mountAttached(
            defineComponent({
                setup() {
                    form = useFormErrors(errors, { idPrefix: 'other' });
                    return {};
                },
                template: '<div />',
            }),
        );

        errors.value = { general: 'The order could not be placed.', title: 'Required.' };
        await settle();

        expect(activeId()).toBe('title');
        // The second form has no elements, so nothing in it is linkable.
        expect(form.errorList().map((entry) => entry.targetId)).toEqual([null, null]);
    });

    it('orders rendered fields before unrendered ones in the error list', async () => {
        const errors = ref<ErrorSource>({ general: 'Server is busy.', notes: 'Too long.', title: 'Required.' });
        let form!: ReturnType<typeof useFormErrors>;

        mountAttached(
            defineComponent({
                setup() {
                    form = useFormErrors(errors);
                    return { form };
                },
                template: `<form><input id="title" /><input id="notes" /></form>`,
            }),
        );

        expect(form.errorList().map(({ field, targetId }) => [field, targetId])).toEqual([
            ['title', 'title'],
            ['notes', 'notes'],
            ['general', null],
        ]);
        expect(form.firstErroredField()).toBe('title');
        expect(form.errorCount()).toBe(3);
    });
});
