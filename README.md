# vue-form-errors

[![CI](https://github.com/leojeremy/vue-form-errors/actions/workflows/ci.yml/badge.svg)](https://github.com/leojeremy/vue-form-errors/actions/workflows/ci.yml)

A small Vue 3 composable that connects server-side validation errors (for example a Laravel 422) to the form fields they belong to, so they are accessible as well as visible.

- `aria-invalid="true"` on a rejected field, and **no** attribute on a field that has not been judged yet.
- `aria-describedby` pointing at the element that holds the message, only when that element exists.
- Focus moves to the **first rejected field in page order** when a submit comes back with a new rejection, and never while the user is correcting a field.

It has no runtime dependencies besides `vue`, and is not tied to any HTTP client or form library. It takes errors in the shape `Record<string, string | string[]>`, and ships an optional `fromLaravel422()` adapter for Laravel's JSON validation response.

## The problem

Rendering an error message under its input is not enough. A sighted user links the two by proximity, but nothing in the markup does: a screen reader announces the input with no hint that it was rejected or why. And on a long form, a rejected submit can look like nothing happened: the error may be above the fold or below it, with focus still on the submit button.

## Install

Not published to the npm registry. Install from GitHub (npm runs the build on install):

```bash
npm i github:leojeremy/vue-form-errors
```

Requires `vue` ^3.4 as a peer dependency.

## Usage

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue';
import { fromLaravel422, useFormErrors, type FieldErrors } from 'vue-form-errors';

type Field = 'name' | 'email';

const values = reactive({ name: '', email: '' });
const errors = ref<FieldErrors<Field>>({});

// The second argument is the order the fields appear on the page.
const { fieldId, errorId, invalid, describedBy, message } = useFormErrors(
    () => errors.value,
    ['name', 'email'] as const,
);

async function submit() {
    const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values),
    });

    errors.value = response.status === 422 ? fromLaravel422(await response.json()) : {};
}
</script>

<template>
    <form novalidate @submit.prevent="submit">
        <label :for="fieldId('name')">Name</label>
        <input
            :id="fieldId('name')"
            v-model="values.name"
            :aria-invalid="invalid('name')"
            :aria-describedby="describedBy('name')"
        />
        <p v-if="message('name')" :id="errorId('name')">{{ message('name') }}</p>

        <label :for="fieldId('email')">Email</label>
        <input
            :id="fieldId('email')"
            v-model="values.email"
            type="email"
            :aria-invalid="invalid('email')"
            :aria-describedby="describedBy('email')"
        />
        <p v-if="message('email')" :id="errorId('email')">{{ message('email') }}</p>

        <button type="submit">Register</button>
    </form>
</template>
```

After a 422 that rejects `email`, the email field renders as:

```html
<input id="email" type="email" aria-invalid="true" aria-describedby="email-error" />
<p id="email-error">The email has already been taken.</p>
```

and the untouched `name` input has neither attribute.

### Two forms on one page

If two forms share a field name, give each an `idPrefix`. Without it both inputs get `id="name"`, and focus and `aria-describedby` resolve to whichever comes first in the document.

```ts
const zone = useFormErrors(() => zoneErrors.value, ['name', 'region'] as const, { idPrefix: 'zone' });
const rate = useFormErrors(() => rateErrors.value, ['name', 'amount'] as const, { idPrefix: 'rate' });

zone.fieldId('name'); // 'zone-name'
rate.errorId('name'); // 'rate-name-error'
```

### With Inertia

Inertia's `useForm` already exposes `form.errors` as one string per field, which `useFormErrors` accepts directly. This snippet is not covered by the tests in this repo, which have no Inertia dependency.

```ts
const form = useForm({ name: '', email: '' });

const { fieldId, errorId, invalid, describedBy, message } = useFormErrors(
    () => form.errors,
    ['name', 'email'] as const,
);
```

For a named error bag, pass that bag instead, e.g. `() => usePage().props.errors.zone`.

## Accessibility behaviour

| Situation | What happens |
|---|---|
| Field never submitted | No `aria-invalid`, no `aria-describedby`. Unjudged is not the same as valid, and announcing every untouched input as `aria-invalid="false"` is noise. |
| Field rejected | `aria-invalid="true"`, `aria-describedby="<errorId>"`. |
| Submit rejected | After the DOM updates, focus moves to the first rejected field **in the order you passed**, not the order the server listed the keys. Focus also brings the field into view. |
| Same fields still rejected, messages reworded | Focus does not move. |
| One error cleared while another remains (e.g. you clear a field's error as the user edits it) | Focus does not move. |
| A field that was not rejected before is now rejected | Focus moves to the first rejected field. |
| Field's message is `''` or `[]` | Treated as no error. |

## API

### `useFormErrors(errors, fieldOrder, options?)`

Call it inside `setup()` (it registers a `watch`).

- `errors: () => FieldErrors<TField> | undefined`: a getter for the current errors. Each value may be a string, an array of strings, `null` or `undefined`.
- `fieldOrder: readonly TField[]`: every field of the form, in page order. Errors for keys not in this list are ignored.
- `options.idPrefix?: string`: prepended to every id as `${idPrefix}-${field}`.

Returns:

| Function | Returns |
|---|---|
| `fieldId(field)` | The id to put on the input. Focus looks the input up by this id. |
| `errorId(field)` | The id to put on the element that shows the message (`${fieldId}-error`). |
| `invalid(field)` | `'true'` or `undefined` (so Vue omits the attribute). |
| `describedBy(field)` | `errorId(field)` or `undefined`. |
| `message(field)` | The first message, or `undefined`. |
| `messages(field)` | All non-empty messages, as an array. |
| `firstErroredField()` | The first rejected field in `fieldOrder`, or `undefined`. |

### `fromLaravel422(body: unknown): Record<string, string[]>`

Takes a parsed response body and returns its `errors` as `string[]` per field. Accepts Laravel's JSON shape (`{ message, errors: { field: string[] } }`) and the flattened `{ errors: { field: string } }` shape. Drops empty and non-string messages. Returns `{}` for anything else, including `null`, an HTML error page string, or a body without `errors`.

## Example

```bash
npm install
npm run example
```

This opens a Vite page with a long form and a second form that shares field names. A small Vite middleware (`example/fakeServer.ts`) plays the server and answers with Laravel-shaped 422s. Submit the long form empty, then scroll up and fix everything except the postcode: focus jumps down to the postcode. `taken@example.com` triggers a server-only "already taken" error.

## Limitations

- **You supply page order.** `fieldOrder` is not read from the DOM. If the form's layout changes order, update the list.
- **Errors for unknown keys are ignored.** A key not in `fieldOrder` (for example a form-level error, or `items.3.qty` in a dynamic list you did not list) gets no attributes and never receives focus. Render those yourself.
- **`describedBy` returns only the error id.** If the input also has a hint, combine them yourself: `[hintId, describedBy('email')].filter(Boolean).join(' ')`.
- **The input must carry `fieldId(field)` and be focusable.** If a custom input component puts the id on a wrapper `<div>`, focus lands on nothing useful.
- **Errors present when the component mounts do not move focus.** Only changes after mount do. A server-rendered page that arrives already rejected needs its own initial focus.
- **Resubmitting with exactly the same rejected fields does not move focus**, by design (see the table above). The fields are already marked invalid.
- **Focus needs a browser DOM.** It uses `document.getElementById`, so it does not reach into shadow DOM. Without a `document` (server-side code, a Node test) focusing is skipped; the attribute helpers still work.
- **Not a validator.** There are no client-side rules. It only presents errors that something else produced.
- **No live-region announcement** of a summary such as "3 errors". Moving focus to the field is what screen readers announce; add a summary yourself if you need one.

## Background

This was generalised from a composable I wrote for a larger private project: a Laravel + Inertia + Vue 3 admin app that is pre-launch and has not been run at scale. For this repo I removed the Inertia-specific parts, accepted both string and array messages, and fixed three problems, each with a test:

- ids could collide when two forms on one page share a field name (`idPrefix`);
- an empty message list `[]` counted as an error;
- clearing one field's error while another stayed rejected moved focus away from the field being edited.

## Development

```bash
npm ci
npm run typecheck   # vue-tsc, strict
npm test            # Vitest + jsdom
npm run build       # tsc to dist/ (ESM + .d.ts)
```

## License

[MIT](./LICENSE) © Jeremy Leo
