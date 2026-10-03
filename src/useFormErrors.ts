import { nextTick, watch } from 'vue';

/**
 * One field's errors as a server might send them: Laravel's JSON 422 gives a
 * list of messages per field, Inertia flattens that to a single string, and a
 * hand-rolled API might do either. Empty values mean "no error".
 */
export type ErrorValue = string | readonly string[] | null | undefined;

/** Errors keyed by field name. Keys that are not fields of the form are ignored. */
export type FieldErrors<TField extends string = string> = Partial<Record<TField, ErrorValue>>;

function messagesOf(value: ErrorValue): string[] {
    if (typeof value === 'string') {
        return value === '' ? [] : [value];
    }

    return value ? value.filter((message) => message !== '') : [];
}

/**
 * Wires validation errors to the inputs they belong to, and moves focus to
 * the first one when a submit comes back rejected.
 *
 * Rendering the error text under its field is not enough. A sighted user
 * infers the link from proximity, but nothing in the markup says so: a
 * screen reader announces the input with no hint that it was rejected or
 * why, because there is no `aria-invalid` and no `aria-describedby`. And
 * anyone submitting a long form gets a page that looks unchanged: the error
 * might be above the fold, below it, or on a field they have already
 * scrolled past, with focus still on the submit button.
 *
 * Focus is moved rather than the page scrolled, because focus takes the
 * scroll with it and also puts the caret where the correction has to be
 * typed. It is deliberately only moved when the SET of rejected fields
 * changes. Re-focusing on every keystroke while somebody is fixing the field
 * would fight them for the cursor.
 *
 * `fieldOrder` is passed in rather than derived from the error object: the
 * server returns errors keyed in whatever order the validator produced, and
 * "first error" has to mean first ON THE PAGE, or focus jumps to the middle
 * of the form and the user cannot tell what happened.
 */
export interface UseFormErrorsOptions {
    /**
     * Prepended to every id, as `${idPrefix}-${field}`. Needed when two forms
     * on one page share a field name: without it both inputs get the same
     * id, and focus and `aria-describedby` resolve to whichever is first in
     * the document.
     */
    idPrefix?: string;
}

export function useFormErrors<TField extends string>(
    errors: () => FieldErrors<TField> | undefined,
    fieldOrder: readonly TField[],
    options: UseFormErrorsOptions = {},
) {
    const prefix = options.idPrefix ? `${options.idPrefix}-` : '';

    /** The id the input must carry, so focus can find it. */
    function fieldId(field: TField): string {
        return `${prefix}${field}`;
    }

    /** Every non-empty message for the field, in the order the server sent them. */
    function messages(field: TField): string[] {
        return messagesOf(errors()?.[field]);
    }

    /** The first message for the field, or undefined when it has none. */
    function message(field: TField): string | undefined {
        return messages(field)[0];
    }

    function hasError(field: TField): boolean {
        return messages(field).length > 0;
    }

    /** The id the error element carries, and the input points at. */
    function errorId(field: TField): string {
        return `${fieldId(field)}-error`;
    }

    /** `aria-describedby`, or undefined so the attribute is omitted entirely. */
    function describedBy(field: TField): string | undefined {
        return hasError(field) ? errorId(field) : undefined;
    }

    /**
     * `aria-invalid`, or undefined.
     *
     * Not `'false'` when valid: a field that has never been submitted is not
     * "valid", it is unjudged, and announcing every untouched input as
     * explicitly-not-invalid is noise.
     */
    function invalid(field: TField): 'true' | undefined {
        return hasError(field) ? 'true' : undefined;
    }

    function firstErroredField(): TField | undefined {
        return fieldOrder.find((field) => hasError(field));
    }

    /**
     * A fingerprint of WHICH fields are rejected, not of the messages.
     *
     * Watching the error object itself would re-fire on every reworded
     * message, and watching a boolean "has errors" would not fire when the
     * failure moves from one field to another. `'0101'` changes in exactly
     * the cases focus should move and no others.
     */
    function rejectedFields(): string {
        return fieldOrder.map((field) => (hasError(field) ? '1' : '0')).join('');
    }

    watch(rejectedFields, async (next, previous) => {
        if (next === previous || !next.includes('1')) {
            return;
        }

        const field = firstErroredField();

        if (field === undefined) {
            return;
        }

        // The error element is rendered by the same update that set the
        // errors, so the element being focused may not exist yet.
        await nextTick();

        document.getElementById(fieldId(field))?.focus();
    });

    return { fieldId, errorId, describedBy, invalid, message, messages, firstErroredField };
}
