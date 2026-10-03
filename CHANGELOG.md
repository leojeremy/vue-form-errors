# Changelog

## 0.2.0

Turns the extracted composable into a standalone library.

### Added

- `fields` is optional. Without it every key in the errors is a field, and page order is read from the DOM, so dynamic rows such as `items.3.qty` work.
- `fieldAttrs(field, { describedBy })` returns `id`, `aria-invalid` and `aria-describedby` to `v-bind` onto a control.
- `describedBy(field, ...ids)` keeps hint ids alongside the error id.
- `errorList()`, `hasErrors()`, `errorCount()`: every rejected key in page order, including form-level keys that match no field.
- `focusFirstError()` and `focusField()`, for an identical resubmit or a summary link.
- Options: `root` (shadow DOM or a scoping element), `autoFocus` (`'field'`, `'summary'` or `false`), `focusOnMount`, `focusOptions`.
- `FormField` and `FormErrorSummary`: optional, unstyled components.
- `readValidationErrors(response)`: field errors from a `fetch` 422, or `null` for anything else.
- `errors` may be a ref as well as a getter.
- A live demo on GitHub Pages.

### Fixed

- Focus now reaches radio groups (the checked radio, else the first) and controls inside a wrapper that carries the id, and moves on to the next rejected field when one cannot take focus.
- Ids never contain whitespace.

### Unchanged

- `useFormErrors(errors, fields, options)` still works as in 0.1.0.

## 0.1.0

- `useFormErrors` with `idPrefix`, and `fromLaravel422`.
- Fixed while extracting: id collisions between forms sharing field names, `[]` counting as an error, focus moving when an error was cleared, and a crash outside a browser.
