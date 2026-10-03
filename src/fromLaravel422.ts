/**
 * Pulls the `errors` object out of a Laravel validation response body.
 *
 * Laravel's JSON 422 is `{ message, errors: { field: string[] } }`. Inertia
 * flattens the same errors to `{ field: string }`. Both are accepted and
 * normalised to a list of messages per field, which `useFormErrors` reads
 * directly. Anything else (a 500 page, `null`, a body without `errors`)
 * gives an empty object, so a caller can always assign the result.
 */
export function fromLaravel422(body: unknown): Record<string, string[]> {
    if (typeof body !== 'object' || body === null) {
        return {};
    }

    const errors = (body as { errors?: unknown }).errors;

    if (typeof errors !== 'object' || errors === null || Array.isArray(errors)) {
        return {};
    }

    const result: Record<string, string[]> = {};

    for (const [field, value] of Object.entries(errors)) {
        const messages = (Array.isArray(value) ? value : [value]).filter(
            (message): message is string => typeof message === 'string' && message !== '',
        );

        if (messages.length > 0) {
            result[field] = messages;
        }
    }

    return result;
}

/**
 * Reads the field errors from a `fetch` response, or returns `null` when the
 * response is not a validation failure.
 *
 * `null` is the important case. Treating every failed response as "no field
 * errors" clears the form's errors on a 500 or a 419 and leaves the user
 * looking at an unchanged form; `null` tells the caller to handle it as a
 * general failure instead.
 *
 * Only a 422 with a JSON body counts. The body is consumed, so pass
 * `response.clone()` if you need to read it again.
 */
export async function readValidationErrors(response: Response): Promise<Record<string, string[]> | null> {
    if (response.status !== 422) {
        return null;
    }

    let body: unknown;

    try {
        body = await response.json();
    } catch {
        return null;
    }

    return fromLaravel422(body);
}
