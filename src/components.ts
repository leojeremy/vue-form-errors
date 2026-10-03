import { defineComponent, h, type PropType, type VNode } from 'vue';

import type { FieldAttrs, FormErrors } from './useFormErrors.js';

/**
 * Two optional, unstyled components built on `useFormErrors`. They exist so
 * a call site cannot forget part of the wiring: the label's `for`, the hint
 * in `aria-describedby`, the error element's id. Every element carries a
 * class for styling; there is no CSS.
 */

// Method parameters are bivariant, so a form typed for specific field names
// is accepted here.
type AnyFormErrors = FormErrors<string>;

export interface FormFieldSlotProps {
    /** `v-bind` these onto the control. Empty in `group` mode, where the fieldset carries them. */
    attrs: Partial<FieldAttrs>;
    invalid: boolean;
    messages: string[];
}

/**
 * One labelled control with an optional hint and its validation messages.
 *
 * ```vue
 * <FormField :form="form" name="email" label="Email" hint="We never share it.">
 *   <template #default="{ attrs }">
 *     <input v-bind="attrs" v-model="values.email" type="email" />
 *   </template>
 * </FormField>
 * ```
 *
 * With `group`, it renders a `<fieldset>` and `<legend>` for radio buttons or
 * checkboxes. The fieldset takes the id and `aria-describedby`; focus goes
 * to the checked radio, or the first control in the group.
 */
export const FormField = defineComponent({
    name: 'FormField',
    props: {
        form: { type: Object as PropType<AnyFormErrors>, required: true },
        name: { type: String, required: true },
        label: { type: String, default: undefined },
        hint: { type: String, default: undefined },
        group: { type: Boolean, default: false },
    },
    setup(props, { slots }) {
        return (): VNode => {
            const { form, name } = props;
            const fieldId = form.fieldId(name);
            const hintId = `${fieldId}-hint`;
            const hasHint = Boolean(props.hint) || slots.hint !== undefined;
            const messages = form.messages(name);
            const invalid = messages.length > 0;
            const describedBy = hasHint ? hintId : undefined;

            const slotProps: FormFieldSlotProps = {
                attrs: props.group ? {} : form.fieldAttrs(name, { describedBy }),
                invalid,
                messages,
            };

            const labelContent = slots.label?.() ?? props.label;

            const hint = hasHint
                ? h('p', { id: hintId, class: 'form-field-hint' }, slots.hint?.() ?? props.hint)
                : null;

            const error = invalid
                ? h(
                      'div',
                      { id: form.errorId(name), class: 'form-field-error' },
                      messages.map((text) => h('p', text)),
                  )
                : null;

            if (props.group) {
                return h(
                    'fieldset',
                    {
                        id: fieldId,
                        class: 'form-field form-field-group',
                        'aria-describedby': form.describedBy(name, describedBy),
                        'data-invalid': invalid ? '' : undefined,
                    },
                    [h('legend', { class: 'form-field-label' }, labelContent), hint, slots.default?.(slotProps), error],
                );
            }

            return h('div', { class: 'form-field', 'data-invalid': invalid ? '' : undefined }, [
                h('label', { for: fieldId, class: 'form-field-label' }, labelContent),
                hint,
                slots.default?.(slotProps),
                error,
            ]);
        };
    },
});

/**
 * A list of every error at the top of the form, each linking to its field.
 *
 * Renders nothing while there are no errors. Errors that belong to no field
 * on the page (a form-level message) are listed as plain text.
 *
 * When the form was created with `autoFocus: 'summary'`, the summary takes
 * focus on a new rejection and is a `role="alert"`, so it is announced
 * (the pattern used by GOV.UK's error summary). Otherwise focus goes to the
 * field, and the summary is a labelled region rather than an alert, so a
 * screen reader does not announce two things at once.
 */
export const FormErrorSummary = defineComponent({
    name: 'FormErrorSummary',
    props: {
        form: { type: Object as PropType<AnyFormErrors>, required: true },
        title: { type: String, default: 'There is a problem' },
        headingLevel: { type: Number as PropType<1 | 2 | 3 | 4 | 5 | 6>, default: 2 },
    },
    setup(props, { slots }) {
        return (): VNode | null => {
            const { form } = props;

            if (!form.hasErrors()) {
                return null;
            }

            const titleId = `${form.summaryId}-title`;

            const items = form.errorList().map((entry) =>
                h(
                    'li',
                    { key: entry.field },
                    entry.targetId === null
                        ? entry.message
                        : h(
                              'a',
                              {
                                  href: `#${entry.targetId}`,
                                  onClick: (event: MouseEvent) => {
                                      // The browser's own jump scrolls but does not
                                      // reliably focus the control; do it ourselves.
                                      event.preventDefault();
                                      void form.focusField(entry.field);
                                  },
                              },
                              entry.message,
                          ),
                ),
            );

            return h(
                'div',
                {
                    id: form.summaryId,
                    class: 'form-error-summary',
                    tabindex: '-1',
                    role: form.autoFocus === 'summary' ? 'alert' : 'region',
                    'aria-labelledby': titleId,
                },
                [
                    h(`h${props.headingLevel}`, { id: titleId, class: 'form-error-summary-title' }, slots.title?.() ?? props.title),
                    h('ul', { class: 'form-error-summary-list' }, items),
                ],
            );
        };
    },
});
