<script setup lang="ts">
import { reactive, ref } from 'vue';
import { fromLaravel422, useFormErrors, type FieldErrors } from 'vue-form-errors';

/**
 * Two forms on one page, both with `name` and `email` fields. Each gets its
 * own `idPrefix`, so their ids never collide.
 *
 * The fake server (fakeServer.ts) answers with a Laravel-shaped 422. Try
 * submitting the long form empty, then scroll to the top and submit again
 * with only the postcode wrong: focus follows the first rejected field.
 * Use taken@example.com to see a server-only rule.
 */

const registerFields = [
    { name: 'name', label: 'Full name', type: 'text', autocomplete: 'name' },
    { name: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
    { name: 'phone', label: 'Phone (optional)', type: 'tel', autocomplete: 'tel' },
    { name: 'address', label: 'Street address', type: 'text', autocomplete: 'street-address' },
    { name: 'city', label: 'City', type: 'text', autocomplete: 'address-level2' },
    { name: 'postcode', label: 'Postcode', type: 'text', autocomplete: 'postal-code' },
    { name: 'password', label: 'Password', type: 'password', autocomplete: 'new-password' },
    { name: 'password_confirmation', label: 'Confirm password', type: 'password', autocomplete: 'new-password' },
] as const;

type RegisterField = (typeof registerFields)[number]['name'];

const register = reactive(Object.fromEntries(registerFields.map((f) => [f.name, ''])) as Record<RegisterField, string>);
const registerErrors = ref<FieldErrors<RegisterField>>({});
const registerStatus = ref('');
const registerBusy = ref(false);

const registerForm = useFormErrors(
    () => registerErrors.value,
    registerFields.map((f) => f.name),
    { idPrefix: 'register' },
);

type NewsletterField = 'name' | 'email';

const newsletter = reactive<Record<NewsletterField, string>>({ name: '', email: '' });
const newsletterErrors = ref<FieldErrors<NewsletterField>>({});
const newsletterStatus = ref('');

const newsletterForm = useFormErrors(() => newsletterErrors.value, ['name', 'email'] as const, {
    idPrefix: 'newsletter',
});

/** POSTs JSON; on a 422 hands back the field errors, otherwise an empty object. */
async function post(url: string, body: object): Promise<{ ok: boolean; errors: Record<string, string[]> }> {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
    });

    if (response.status === 422) {
        return { ok: false, errors: fromLaravel422(await response.json()) };
    }

    return { ok: response.ok, errors: {} };
}

async function submitRegister(): Promise<void> {
    registerBusy.value = true;
    registerStatus.value = '';

    try {
        const result = await post('/api/register', register);
        registerErrors.value = result.errors;
        registerStatus.value = result.ok ? 'Account created (nothing was stored).' : '';
    } finally {
        registerBusy.value = false;
    }
}

async function submitNewsletter(): Promise<void> {
    const result = await post('/api/newsletter', newsletter);
    newsletterErrors.value = result.errors;
    newsletterStatus.value = result.ok ? 'Subscribed (nothing was stored).' : '';
}
</script>

<template>
    <main>
        <h1>vue-form-errors</h1>
        <p class="lede">
            Submit either form to get a 422 from the fake server. Rejected inputs get
            <code>aria-invalid</code> and <code>aria-describedby</code>, and focus moves to the first rejected field
            in page order.
        </p>

        <section aria-labelledby="newsletter-heading">
            <h2 id="newsletter-heading">Newsletter</h2>
            <form novalidate @submit.prevent="submitNewsletter">
                <div v-for="field in ['name', 'email'] as const" :key="field" class="field">
                    <label :for="newsletterForm.fieldId(field)">{{ field === 'name' ? 'Name' : 'Email' }}</label>
                    <input
                        :id="newsletterForm.fieldId(field)"
                        v-model="newsletter[field]"
                        :type="field === 'email' ? 'email' : 'text'"
                        :aria-invalid="newsletterForm.invalid(field)"
                        :aria-describedby="newsletterForm.describedBy(field)"
                    />
                    <p v-if="newsletterForm.message(field)" :id="newsletterForm.errorId(field)" class="error">
                        {{ newsletterForm.message(field) }}
                    </p>
                </div>
                <button type="submit">Subscribe</button>
                <p role="status" class="status">{{ newsletterStatus }}</p>
            </form>
        </section>

        <section aria-labelledby="register-heading">
            <h2 id="register-heading">Create an account</h2>
            <form novalidate @submit.prevent="submitRegister">
                <div v-for="field in registerFields" :key="field.name" class="field">
                    <label :for="registerForm.fieldId(field.name)">{{ field.label }}</label>
                    <input
                        :id="registerForm.fieldId(field.name)"
                        v-model="register[field.name]"
                        :type="field.type"
                        :autocomplete="field.autocomplete"
                        :aria-invalid="registerForm.invalid(field.name)"
                        :aria-describedby="registerForm.describedBy(field.name)"
                    />
                    <div v-if="registerForm.message(field.name)" :id="registerForm.errorId(field.name)" class="error">
                        <p v-for="message in registerForm.messages(field.name)" :key="message">{{ message }}</p>
                    </div>
                </div>
                <button type="submit" :disabled="registerBusy">{{ registerBusy ? 'Submitting…' : 'Create account' }}</button>
                <p role="status" class="status">{{ registerStatus }}</p>
            </form>
        </section>
    </main>
</template>
