/**
 * The small amount of DOM work the composable needs: finding an element by id
 * inside a chosen root, putting elements in page order, and deciding what
 * inside a field should actually receive focus.
 */

/** Anything an element can be looked up in: the document, a shadow root, or an element. */
export type LookupRoot = Document | DocumentFragment | Element;

const FOCUSABLE = [
    'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable=""]',
    '[contenteditable="true"]',
].join(', ');

export function hasDom(): boolean {
    return typeof document !== 'undefined';
}

/** `getElementById`, scoped to a root. Ids are matched exactly, never as a CSS selector. */
export function findById(root: LookupRoot | null | undefined, id: string): HTMLElement | null {
    const scope = root ?? (hasDom() ? document : null);

    if (scope === null) {
        return null;
    }

    if ('getElementById' in scope) {
        return scope.getElementById(id) as HTMLElement | null;
    }

    // An Element has no getElementById. Compare ids directly so that ids
    // containing dots or brackets (`items.0.qty`) need no escaping.
    for (const candidate of scope.querySelectorAll<HTMLElement>('[id]')) {
        if (candidate.id === id) {
            return candidate;
        }
    }

    return null;
}

/** Sorts in document order. Elements in different trees keep their relative input order. */
export function compareDocumentOrder(a: Node, b: Node): number {
    if (a === b) {
        return 0;
    }

    const position = a.compareDocumentPosition(b);

    if (position & Node.DOCUMENT_POSITION_DISCONNECTED) {
        return 0;
    }

    return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

/**
 * The element inside `element` that should take focus.
 *
 * The id is not always on something focusable: a radio group puts it on the
 * `<fieldset>`, and a custom input component may put it on its wrapper.
 * Focusing those does nothing useful, so this finds the control the user
 * would have tabbed to: the checked radio of a group, otherwise the first
 * enabled control inside.
 */
export function focusTarget(element: HTMLElement): HTMLElement | null {
    if (element.matches(FOCUSABLE) || element.hasAttribute('tabindex')) {
        return element;
    }

    const checkedRadio = element.querySelector<HTMLElement>('input[type="radio"]:checked:not([disabled])');

    return checkedRadio ?? element.querySelector<HTMLElement>(FOCUSABLE);
}

/** Focuses the element (or the control inside it) and reports whether focus landed. */
export function focusElement(element: HTMLElement | null, options?: FocusOptions): boolean {
    const target = element ? focusTarget(element) : null;

    if (target === null) {
        return false;
    }

    target.focus(options);

    const root = target.getRootNode() as Document | ShadowRoot;

    return root.activeElement === target;
}

/** HTML ids may not contain whitespace. */
export function toIdPart(value: string): string {
    return value.trim().replace(/\s+/g, '-');
}
