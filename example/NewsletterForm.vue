<script setup lang="ts">
import { reactive, ref } from 'vue';
import { readValidationErrors, useFormErrors, type FieldErrors } from 'vue-form-errors';

import { fakePost } from './fakeApi';

/**
 * The same library wired by hand, without the components. It shares the
 * field names `name` and `email` with the order form on this page, so it
 * has its own `idPrefix`.
 */
type Field = 'name' | 'email';

const values = reactive<Record<Field, string>>({ name: '', email: '' });
const errors = ref<FieldErrors<Field>>({});
const status = ref('');

const fields = ['name', 'email'] as const;
const form = useFormErrors(errors, fields, { idPrefix: 'newsletter' });

const labels: Record<Field, string> = { name: 'Name', email: 'Email' };

async function submit(): Promise<void> {
    const response = await fakePost('/api/newsletter', values);
    const fieldErrors = await readValidationErrors(response);

    errors.value = fieldErrors ?? {};
    status.value = response.ok ? 'Subscribed (nothing was stored).' : '';
}
</script>

<template>
    <form novalidate @submit.prevent="submit">
        <div v-for="field in fields" :key="field" class="form-field">
            <label :for="form.fieldId(field)" class="form-field-label">{{ labels[field] }}</label>
            <input v-bind="form.fieldAttrs(field)" v-model="values[field]" :type="field === 'email' ? 'email' : 'text'" />
            <p v-if="form.message(field)" :id="form.errorId(field)" class="form-field-error">{{ form.message(field) }}</p>
        </div>
        <button type="submit">Subscribe</button>
        <p role="status" class="status">{{ status }}</p>
    </form>
</template>
