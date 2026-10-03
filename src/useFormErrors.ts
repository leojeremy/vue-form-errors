import { getCurrentInstance, nextTick, onMounted, toValue, watch, type MaybeRefOrGetter } from 'vue';

import { compareDocumentOrder, findById, focusElement, hasDom, toIdPart, type LookupRoot } from './dom.js';

/**
 * One field's errors as a server might send them: Laravel's JSON 422 gives a
 * list of messages per field, Inertia flattens that to a single string, and a
 * hand-rolled API might do either. Empty values mean "no error".
 */
export type ErrorValue = string | readonly string[] | null | undefined;

/** Errors keyed by field name. */
export type FieldErrors<TField extends string = string> = Partial<Record<TField, ErrorValue>>;

/** What the errors source may hold. Keys that match no field still reach the error list. */
export type ErrorSource = Readonly<Record<string, ErrorValue>>;

/** What to focus when a submit comes back with a new rejection. `false` turns automatic focus off. */
export type AutoFocus = 'field' | 'summary' | false;

/** Element ids to add to `aria-describedby`; falsy entries are skipped. */
export type IdList = string | null | undefined | false | readonly (string | null | undefined | false)[];

export interface UseFormErrorsOptions<TField extends string = string> {
    /**
     * The form's fields in page order. When omitted, every key in the errors
     * is a field and page order is read from the DOM, which suits forms with
     * dynamic rows (`items.0.qty`, `items.1.qty`, ...).
     */
    fields?: readonly TField[];

    /**
     * Prepended to every id, as `${idPrefix}-${field}`. Needed when two forms
     * on one page share a field name: without it both inputs get the same id,
     * and focus and `aria-describedby` resolve to whichever is first.
     */
    idPrefix?: string;

    /**
     * Where to look elements up. Defaults to `document`. Pass a shadow root,
     * or the form element, to keep lookups inside it.
     */
    root?: MaybeRefOrGetter<LookupRoot | null | undefined>;

    /** What to focus on a new rejection. Defaults to `'field'`. */
    autoFocus?: AutoFocus;

    /**
     * Also focus when the component mounts with errors already present, for
     * example a server-rendered page that arrives already rejected.
     * Defaults to `false`.
     */
    focusOnMount?: boolean;

    /** Passed to `element.focus()`, e.g. `{ preventScroll: true }`. */
    focusOptions?: FocusOptions;
}

export interface ErrorListItem {
    /** The key as the server sent it. */
    field: string;
    /** The first message. */
    message: string;
    messages: string[];
    /**
     * The id of the element this error belongs to, or `null` when the key
     * matches no rendered field (a form-level error, or a field not on the page).
     */
    targetId: string | null;
}

export interface FieldAttrs {
    id: string;
    'aria-invalid': 'true' | undefined;
    'aria-describedby': string | undefined;
}

export interface FormErrors<TField extends string = string> {
    /** The `autoFocus` option in effect. */
    readonly autoFocus: AutoFocus;
    /** The id `FormErrorSummary` renders with, and summary focus looks for. */
    readonly summaryId: string;

    /** The id the control must carry, so focus and labels can find it. */
    fieldId(field: TField): string;
    /** The id of the element that shows the field's messages. */
    errorId(field: TField): string;
    hasError(field: TField): boolean;
    /** Every non-empty message for the field, in the order the server sent them. */
    messages(field: TField): string[];
    /** The first message, or undefined. */
    message(field: TField): string | undefined;
    /** `'true'` when rejected, otherwise undefined so the attribute is omitted. */
    invalid(field: TField): 'true' | undefined;
    /**
     * `aria-describedby`: the given ids (e.g. a hint) plus the error id when
     * the field is rejected, or undefined when there is nothing to point at.
     */
    describedBy(field: TField, ...extraIds: IdList[]): string | undefined;
    /** `id`, `aria-invalid` and `aria-describedby` together, to `v-bind` onto a control. */
    fieldAttrs(field: TField, options?: { describedBy?: IdList }): FieldAttrs;

    hasErrors(): boolean;
    /** How many keys are rejected. */
    errorCount(): number;
    /** Every rejected key in page order; keys with no field come last, in server order. */
    errorList(): ErrorListItem[];
    /** The first rejected field on the page, or undefined. */
    firstErroredField(): TField | undefined;

    /**
     * Focuses the summary or the first rejected field, after the DOM updates.
     * Resolves to whether anything took focus.
     */
    focusFirstError(target?: 'field' | 'summary'): Promise<boolean>;
    /** Focuses one field's control. Resolves to whether it took focus. */
    focusField(field: TField): Promise<boolean>;
}

function messagesOf(value: unknown): string[] {
    if (typeof value === 'string') {
        return value === '' ? [] : [value];
    }

    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((message): message is string => typeof message === 'string' && message !== '');
}

function joinIds(ids: readonly IdList[]): string | undefined {
    const flat = ids.flat().filter((id): id is string => typeof id === 'string' && id !== '');
    const unique = [...new Set(flat)];

    return unique.length > 0 ? unique.join(' ') : undefined;
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
 * typed. It is deliberately only moved when a field is newly rejected.
 * Re-focusing on every keystroke while somebody is fixing the field, or
 * when the error on the field they are fixing is cleared, would fight them
 * for the cursor.
 *
 * "First error" means first ON THE PAGE, never first in the response: the
 * server returns errors keyed in whatever order the validator produced, and
 * focus jumping into the middle of the form leaves the user unable to tell
 * what happened. Page order comes from `fields` when given, otherwise from
 * the DOM.
 */
export function useFormErrors<TField extends string>(
    errors: MaybeRefOrGetter<ErrorSource | null | undefined>,
    fields: readonly TField[],
    options?: Omit<UseFormErrorsOptions<TField>, 'fields'>,
): FormErrors<TField>;
export function useFormErrors<TField extends string = string>(
    errors: MaybeRefOrGetter<ErrorSource | null | undefined>,
    options?: UseFormErrorsOptions<TField>,
): FormErrors<TField>;
export function useFormErrors<TField extends string>(
    errors: MaybeRefOrGetter<ErrorSource | null | undefined>,
    fieldsOrOptions?: readonly TField[] | UseFormErrorsOptions<TField>,
    maybeOptions: Omit<UseFormErrorsOptions<TField>, 'fields'> = {},
): FormErrors<TField> {
    const options: UseFormErrorsOptions<TField> = Array.isArray(fieldsOrOptions)
        ? { ...maybeOptions, fields: fieldsOrOptions as readonly TField[] }
        : ((fieldsOrOptions as UseFormErrorsOptions<TField> | undefined) ?? {});

    const fields = options.fields;
    const autoFocus: AutoFocus = options.autoFocus ?? 'field';
    const prefix = options.idPrefix ? `${toIdPart(options.idPrefix)}-` : '';
    const summaryId = `${prefix}error-summary`;

    function source(): ErrorSource {
        return toValue(errors) ?? {};
    }

    function root(): LookupRoot | null | undefined {
        return toValue(options.root);
    }

    function fieldId(field: string): string {
        return `${prefix}${toIdPart(field)}`;
    }

    function errorId(field: string): string {
        return `${fieldId(field)}-error`;
    }

    function messages(field: string): string[] {
        return messagesOf(source()[field]);
    }

    function message(field: string): string | undefined {
        return messages(field)[0];
    }

    function hasError(field: string): boolean {
        return messages(field).length > 0;
    }

    function invalid(field: string): 'true' | undefined {
        // Not `'false'` when valid: a field that has never been submitted is
        // not "valid", it is unjudged, and announcing every untouched input
        // as explicitly-not-invalid is noise.
        return hasError(field) ? 'true' : undefined;
    }

    function describedBy(field: string, ...extraIds: IdList[]): string | undefined {
        return joinIds([...extraIds, hasError(field) ? errorId(field) : undefined]);
    }

    function fieldAttrs(field: string, attrOptions: { describedBy?: IdList } = {}): FieldAttrs {
        return {
            id: fieldId(field),
            'aria-invalid': invalid(field),
            'aria-describedby': describedBy(field, attrOptions.describedBy),
        };
    }

    /** Every key with at least one message, in the order the server sent them. */
    function rejectedKeys(): string[] {
        return Object.keys(source()).filter(hasError);
    }

    function item(field: string, targetId: string | null): ErrorListItem {
        const all = messages(field);

        return { field, message: all[0] ?? '', messages: all, targetId };
    }

    function errorList(): ErrorListItem[] {
        const rejected = rejectedKeys();

        if (fields !== undefined) {
            const known = new Set<string>(fields);

            return [
                ...fields.filter(hasError).map((field) => item(field, fieldId(field))),
                ...rejected.filter((key) => !known.has(key)).map((key) => item(key, null)),
            ];
        }

        // Without a DOM there is no page order to read; keep the server's
        // order and assume every field is rendered.
        if (!hasDom()) {
            return rejected.map((key) => item(key, fieldId(key)));
        }

        const lookupRoot = root();
        const placed: { key: string; element: HTMLElement }[] = [];
        const unplaced: string[] = [];

        for (const key of rejected) {
            const element = findById(lookupRoot, fieldId(key));

            if (element) {
                placed.push({ key, element });
            } else {
                unplaced.push(key);
            }
        }

        placed.sort((a, b) => compareDocumentOrder(a.element, b.element));

        return [...placed.map(({ key }) => item(key, fieldId(key))), ...unplaced.map((key) => item(key, null))];
    }

    function firstErroredField(): TField | undefined {
        return errorList().find((entry) => entry.targetId !== null)?.field as TField | undefined;
    }

    async function focusFirstError(target: 'field' | 'summary' = 'field'): Promise<boolean> {
        // The elements are rendered by the same update that set the errors,
        // so what is being focused may not exist yet.
        await nextTick();

        if (!hasDom()) {
            return false;
        }

        const lookupRoot = root();

        if (target === 'summary' && focusElement(findById(lookupRoot, summaryId), options.focusOptions)) {
            return true;
        }

        // Try each rejected field in page order, so a field that is missing
        // or cannot take focus does not leave focus on the submit button.
        for (const entry of errorList()) {
            if (entry.targetId !== null && focusElement(findById(lookupRoot, entry.targetId), options.focusOptions)) {
                return true;
            }
        }

        return false;
    }

    async function focusField(field: string): Promise<boolean> {
        await nextTick();

        return hasDom() && focusElement(findById(root(), fieldId(field)), options.focusOptions);
    }

    /**
     * A fingerprint of WHICH keys are rejected, not of the messages.
     *
     * Watching the error object itself would re-fire on every reworded
     * message, and watching a boolean "has errors" would not fire when the
     * failure moves from one field to another.
     */
    function fingerprint(): string {
        return rejectedKeys().sort().join('\n');
    }

    /**
     * Only a NEW rejection moves focus. When the set merely shrinks (the app
     * clears a field's error as the user edits it, while another field is
     * still rejected), moving focus would pull the cursor out of the field
     * being typed in.
     */
    function newlyRejected(next: string, previous: string): boolean {
        const before = new Set(previous === '' ? [] : previous.split('\n'));

        return next !== '' && next.split('\n').some((key) => !before.has(key));
    }

    if (autoFocus !== false) {
        watch(fingerprint, (next, previous) => {
            if (newlyRejected(next, previous)) {
                void focusFirstError(autoFocus);
            }
        });

        if (options.focusOnMount && getCurrentInstance()) {
            onMounted(() => {
                if (rejectedKeys().length > 0) {
                    void focusFirstError(autoFocus);
                }
            });
        }
    }

    return {
        autoFocus,
        summaryId,
        fieldId,
        errorId,
        hasError,
        messages,
        message,
        invalid,
        describedBy,
        fieldAttrs,
        hasErrors: () => rejectedKeys().length > 0,
        errorCount: () => rejectedKeys().length,
        errorList,
        firstErroredField,
        focusFirstError,
        focusField,
    };
}
