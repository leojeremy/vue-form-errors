# vue-form-errors

[![CI](https://github.com/leojeremy/vue-form-errors/actions/workflows/ci.yml/badge.svg)](https://github.com/leojeremy/vue-form-errors/actions/workflows/ci.yml)
[![Demo](https://github.com/leojeremy/vue-form-errors/actions/workflows/pages.yml/badge.svg)](https://leojeremy.github.io/vue-form-errors/)

Accessible server-side validation errors for Vue 3. When a submit comes back rejected (a Laravel 422, Inertia's `form.errors`, or any `{ field: message }` object), it:

- marks each rejected control with `aria-invalid="true"`, and leaves untouched controls unmarked;
- points `aria-describedby` at the message, keeping any hint the control already had;
- moves focus to the **first problem in page order**, or to an error summary, and never while the user is fixing a field;
- lists every error, including ones that belong to no field, for an error summary.

It is headless: a composable plus two optional, unstyled components. The only runtime dependency is `vue`.

**[Live demo](https://leojeremy.github.io/vue-form-errors/)** (runs entirely in your browser; a fake API answers with Laravel-shaped 422s).

## The problem

Rendering an error message under its input is not enough. A sighted user links the two by proximity, but nothing in the markup does: a screen reader announces the input with no hint that it was rejected or why. On a long form a rejected submit can look like nothing happened: the error may be above the fold or below it, with focus still on the submit button. Server errors also arrive keyed in whatever order the validator produced, so "the first error" has to be worked out from the page, not the response.

## Install

Not published to the npm registry. Install from GitHub (npm builds it on install):

```bash
npm i github:leojeremy/vue-form-errors#v0.2.0
```

Requires `vue` ^3.4 as a peer dependency.

## Quick start

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue';
import { FormErrorSummary, FormField, readValidationErrors, useFormErrors, type ErrorSource } from 'vue-form-errors';

const values = reactive({ name: '', email: '' });
const errors = ref<ErrorSource>({});
const form = useFormErrors(errors);

async function submit() {
    const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values),
    });

    const fieldErrors = await readValidationErrors(response); // null unless it is a 422

    if (fieldErrors) {
        errors.value = fieldErrors;
    } else if (response.ok) {
        errors.value = {};
    } else {
        // A 500, 419, ...: not a validation failure. Keep the errors showing and report it.
    }
}
</script>

<template>
    <form novalidate @submit.prevent="submit">
        <FormErrorSummary :form="form" />

        <FormField :form="form" name="name" label="Name">
            <template #default="{ attrs }"><input v-bind="attrs" v-model="values.name" /></template>
        </FormField>

        <FormField :form="form" name="email" label="Email" hint="We never share it.">
            <template #default="{ attrs }"><input v-bind="attrs" v-model="values.email" type="email" /></template>
        </FormField>

        <button type="submit">Register</button>
    </form>
</template>
```

After a 422 that rejects `email`, the email field renders as:

```html
<div class="form-field" data-invalid="">
  <label for="email" class="form-field-label">Email</label>
  <p id="email-hint" class="form-field-hint">We never share it.</p>
  <input id="email" type="email" aria-invalid="true" aria-describedby="email-hint email-error" />
  <div id="email-error" class="form-field-error"><p>The email has already been taken.</p></div>
</div>
```

The untouched name input has no `aria-invalid` and no `aria-describedby`, and focus has moved to the email input.

## Without the components

The components only call the composable. Wire it yourself when your markup or component library needs it:

```vue
<label :for="form.fieldId('email')">Email</label>
<p :id="form.fieldId('email') + '-hint'">We never share it.</p>
<input v-bind="form.fieldAttrs('email', { describedBy: form.fieldId('email') + '-hint' })" v-model="values.email" />
<p v-if="form.message('email')" :id="form.errorId('email')">{{ form.message('email') }}</p>
```

`fieldAttrs()` returns `{ id, 'aria-invalid', 'aria-describedby' }`, so a control cannot get one attribute and miss another.

## Recipes

### Page order: from the DOM, or a list

Without a `fields` option, every key in the errors is a field and page order is read from the DOM when focus moves. This is what makes dynamic rows work: keys such as `items.0.qty` and `items.1.qty` exist only at runtime.

```vue
<div v-for="(item, i) in items" :key="item.key">
    <input v-bind="form.fieldAttrs(`items.${i}.qty`)" v-model="item.qty" />
    <p v-if="form.message(`items.${i}.qty`)" :id="form.errorId(`items.${i}.qty`)">{{ form.message(`items.${i}.qty`) }}</p>
</div>
```

With `fields`, that list is the page order and the type of the field names. The positional form from 0.1.0 still works:

```ts
const form = useFormErrors(errors, ['name', 'email'] as const);
// same as
const form = useFormErrors(errors, { fields: ['name', 'email'] as const });
```

Keys that match no field (a form-level message such as `order`, or a field not on the page) are never focused. They appear at the end of `errorList()` with `targetId: null`, and the summary shows them as plain text.

### Radio groups and checkboxes

```vue
<FormField :form="form" name="plan" label="Plan" group>
    <label><input v-model="values.plan" type="radio" name="plan" value="basic" /> Basic</label>
    <label><input v-model="values.plan" type="radio" name="plan" value="pro" /> Pro</label>
</FormField>
```

`group` renders a `<fieldset>` and `<legend>`. The fieldset carries the id and `aria-describedby`. Focus goes to the checked radio, or the first enabled control in the group. The same fallback applies to any element whose id is on a wrapper rather than the control itself.

### An error summary, and where focus goes

`<FormErrorSummary :form="form" />` lists every error in page order, each linking to its field (clicking focuses the control). It renders nothing while there are no errors.

`autoFocus` decides what takes focus on a new rejection:

| `autoFocus` | Focus goes to | Summary is |
|---|---|---|
| `'field'` (default) | the first rejected control | a labelled region, so it does not compete with the focused field for announcement |
| `'summary'` | the summary (falls back to the field if no summary is rendered) | `role="alert"`, as in the GOV.UK error summary pattern |
| `false` | nowhere; call `focusFirstError()` yourself | a labelled region |

### Clearing an error as the user edits

The library never owns your errors, so clearing is yours. Focus stays where the user is typing: it only moves when a field is **newly** rejected.

```ts
function edited(field: string) {
    const { [field]: _removed, ...rest } = errors.value;
    errors.value = rest;
}
```

### Refocusing on an identical resubmit

If the user resubmits and exactly the same fields are rejected, focus does not move automatically (the fields are already marked). To move it after every rejected submit, call `focusFirstError()` in your error handler:

```ts
if (fieldErrors) {
    errors.value = fieldErrors;
    form.focusFirstError(); // or form.focusFirstError('summary')
}
```

### Two forms on one page

Give each form an `idPrefix` so shared field names do not produce duplicate ids:

```ts
const zone = useFormErrors(zoneErrors, { idPrefix: 'zone' }); // zone.fieldId('name') === 'zone-name'
const rate = useFormErrors(rateErrors, { idPrefix: 'rate' }); // rate.errorId('name') === 'rate-name-error'
```

### Inertia

Inertia's `form.errors` is one string per field, which the composable accepts directly. This snippet is not covered by the tests in this repo, which have no Inertia dependency.

```ts
const form = useForm({ name: '', email: '' });
const formErrors = useFormErrors(() => form.errors, ['name', 'email'] as const);
```

For a named error bag, pass the bag: `useFormErrors(() => usePage().props.errors.zone ?? {})`.

### axios

`fromLaravel422` takes the parsed body: `errors.value = fromLaravel422(error.response?.data)`. Check `error.response?.status === 422` first, for the same reason `readValidationErrors` returns `null` otherwise.

### Shadow DOM, or scoping lookups to one form

```ts
const formEl = ref<HTMLFormElement | null>(null);
const form = useFormErrors(errors, { root: formEl }); // or a ShadowRoot
```

### Sticky headers

Focus scrolls the control into view, which can leave it under a sticky header. Fix it in CSS with `scroll-margin-top` on your controls, or pass `focusOptions: { preventScroll: true }` and scroll yourself.

## Accessibility behaviour

| Situation | What happens |
|---|---|
| Field never submitted | No `aria-invalid`, no error id in `aria-describedby`. Unjudged is not the same as valid, and announcing every untouched input as `aria-invalid="false"` is noise. |
| Field rejected | `aria-invalid="true"`; `aria-describedby` = its hint ids (if any) + the error id. |
| A field is newly rejected | After the DOM updates, focus moves to the first rejected control in page order (or the summary). |
| Same fields still rejected, messages reworded | Focus does not move. |
| An error is cleared while others remain | Focus does not move. |
| The first rejected control cannot take focus | Focus moves to the next rejected one. |
| Message is `''`, `[]`, or not a string | Treated as no message. |
| Errors present when the component mounts | Focus moves only with `focusOnMount: true`. |
| No `document` (server rendering, a Node test) | The attribute helpers work; focusing is skipped. |

## API

### `useFormErrors(errors, options?)` / `useFormErrors(errors, fields, options?)`

Call it inside `setup()`: it registers a `watch`, and `onMounted` when `focusOnMount` is set.

`errors` is a ref, getter or plain object holding `{ [key]: string | string[] | null | undefined }`.

| Option | Default | |
|---|---|---|
| `fields` | DOM order | Field names in page order. Also types the field names. |
| `idPrefix` | none | Prepended to every id as `${idPrefix}-`. |
| `root` | `document` | Where to look elements up: a ref, getter, element, or shadow root. |
| `autoFocus` | `'field'` | `'field'`, `'summary'` or `false`. |
| `focusOnMount` | `false` | Also focus when mounted with errors already present. |
| `focusOptions` | none | Passed to `element.focus()`. |

`autoFocus` and `fields` are read once, at setup. To change them, remount the component (the demo uses a `:key`).

Returns:

| Member | |
|---|---|
| `fieldId(field)` | The id for the control. Whitespace becomes `-`. |
| `errorId(field)` | `${fieldId}-error`, for the element that shows the messages. |
| `invalid(field)` | `'true'` or `undefined`. |
| `describedBy(field, ...ids)` | The given ids plus the error id when rejected, deduplicated; `undefined` when empty. |
| `fieldAttrs(field, { describedBy? })` | `{ id, 'aria-invalid', 'aria-describedby' }`. |
| `message(field)` / `messages(field)` | The first message / all non-empty messages. |
| `hasError(field)`, `hasErrors()`, `errorCount()` | |
| `errorList()` | `{ field, message, messages, targetId }[]` in page order; `targetId` is `null` for keys with no field. |
| `firstErroredField()` | The first rejected field in page order that has a `targetId`. |
| `focusFirstError(target?)` | Focus the first rejected control, or `'summary'`. Resolves to whether anything took focus. |
| `focusField(field)` | Focus one field's control. Resolves to whether it took focus. |
| `summaryId`, `autoFocus` | Used by `FormErrorSummary`. |

### `<FormField>`

Props: `form`, `name`, `label?`, `hint?`, `group?`. Slots: `default` (receives `{ attrs, invalid, messages }`; bind `attrs` onto the control), `label`, `hint`. Classes: `form-field`, `form-field-group`, `form-field-label`, `form-field-hint`, `form-field-error`, and `data-invalid` on the wrapper.

### `<FormErrorSummary>`

Props: `form`, `title` (default `'There is a problem'`), `headingLevel` (default `2`). Slot: `title`. Classes: `form-error-summary`, `form-error-summary-title`, `form-error-summary-list`.

### `readValidationErrors(response): Promise<Record<string, string[]> | null>`

The field errors of a `fetch` 422 with a JSON body; `null` for any other status or an unreadable body. Consumes the body: pass `response.clone()` if you need it again.

### `fromLaravel422(body): Record<string, string[]>`

Normalises a parsed body's `errors` (Laravel's `string[]` per field, or Inertia's `string`) to `string[]` per field, dropping empty and non-string messages. Returns `{}` for anything else.

## Limitations

- **Not a validator.** There are no client-side rules. It presents errors that something else produced; merge your own client-side errors into the same object if you have them.
- **DOM page order needs the controls rendered** when focus moves. Keys whose control is not on the page go last, unlinked.
- **No live-region announcements per field.** Announcement comes from focus moving (or the summary alert in `'summary'` mode).
- **Not tested with a real screen reader yet.** The behaviour is tested in jsdom and checked in Chromium; the attribute patterns follow WAI-ARIA and the GOV.UK error summary.
- **English default text.** Pass `title` to the summary for other languages; field messages are shown as the server sent them.

## Background

This started as a composable I wrote for a larger private project, a Laravel + Inertia + Vue 3 admin app that is pre-launch and has not been run at scale. There it covered one form and leaned on a wrapper component for part of the wiring. Generalising it into a library meant filling the gaps that context had hidden: DOM page order for dynamic rows, hint-preserving descriptions, an error summary, focus for radio groups and wrapped controls, scoped lookups, and a fetch helper that does not mistake a 500 for "no errors". Bugs found along the way, each fixed with a test, are listed in the [changelog](./CHANGELOG.md).

## Development

```bash
npm ci
npm run typecheck   # vue-tsc, strict
npm test            # Vitest + jsdom
npm run build       # tsc to dist/ (ESM + .d.ts)
npm run example     # the demo, locally
```

## License

[MIT](./LICENSE) © Jeremy Leo
