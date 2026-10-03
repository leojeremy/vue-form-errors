<script setup lang="ts">
import { reactive, ref } from 'vue';
import {
    FormErrorSummary,
    FormField,
    readValidationErrors,
    useFormErrors,
    type AutoFocus,
    type ErrorSource,
} from 'vue-form-errors';

import { fakePost } from './fakeApi';

/**
 * A long form with the components doing the wiring.
 *
 * No `fields` list is passed: page order is read from the DOM, which is what
 * makes the item rows work. Their keys (`items.0.qty`, `items.1.qty`, ...)
 * exist only at runtime.
 */
const props = defineProps<{ autoFocus: AutoFocus }>();

interface Row {
    key: number;
    product: string;
    qty: string;
}

let nextKey = 0;
const row = (): Row => ({ key: nextKey++, product: '', qty: '1' });

const values = reactive({
    name: '',
    email: '',
    plan: '',
    items: [row()] as Row[],
    address: '',
    postcode: '',
    terms: false,
});

const errors = ref<ErrorSource>({});
const status = ref('');
const busy = ref(false);
const serverError = ref(false);

const form = useFormErrors(errors, { idPrefix: 'order', autoFocus: props.autoFocus });

async function submit(): Promise<void> {
    busy.value = true;
    status.value = '';

    try {
        const response = await fakePost(
            '/api/orders',
            { ...values, items: values.items.map(({ product, qty }) => ({ product, qty })) },
            { serverError: serverError.value },
        );
        const fieldErrors = await readValidationErrors(response);

        if (fieldErrors !== null) {
            errors.value = fieldErrors;
            // Same fields rejected as last time: the automatic rule stays
            // quiet so it never fights the cursor, so ask explicitly.
            void form.focusFirstError(props.autoFocus === 'summary' ? 'summary' : 'field');
        } else if (response.ok) {
            errors.value = {};
            status.value = 'Order placed (nothing was stored).';
        } else {
            // Not a validation failure: keep the field errors that are
            // showing, and say what happened.
            status.value = `The server failed (HTTP ${response.status}). Your answers are still here; try again.`;
        }
    } finally {
        busy.value = false;
    }
}

/** Clear one field's error as soon as the user edits it. Focus stays put. */
function edited(field: string): void {
    if (form.hasError(field)) {
        const { [field]: _removed, ...rest } = errors.value;
        errors.value = rest;
    }
}

function removeRow(index: number): void {
    values.items.splice(index, 1);
    // Row keys are positional, so errors for later rows no longer line up.
    errors.value = Object.fromEntries(Object.entries(errors.value).filter(([key]) => !key.startsWith('items.')));
}
</script>

<template>
    <form novalidate @submit.prevent="submit">
        <FormErrorSummary :form="form" title="Your order could not be placed" />

        <FormField :form="form" name="name" label="Full name">
            <template #default="{ attrs }">
                <input v-bind="attrs" v-model="values.name" autocomplete="name" @input="edited('name')" />
            </template>
        </FormField>

        <FormField :form="form" name="email" label="Email" hint="Try taken@example.com to see a server-only rule.">
            <template #default="{ attrs }">
                <input v-bind="attrs" v-model="values.email" type="email" autocomplete="email" @input="edited('email')" />
            </template>
        </FormField>

        <FormField :form="form" name="plan" label="Plan" hint="Team is not available yet." group>
            <label v-for="plan in ['basic', 'pro', 'team']" :key="plan" class="choice">
                <input v-model="values.plan" type="radio" name="plan" :value="plan" @change="edited('plan')" />
                {{ plan[0]!.toUpperCase() + plan.slice(1) }}
            </label>
        </FormField>

        <FormField :form="form" name="items" label="Items" hint="More than 50 units in total triggers an order-level error." group>
            <div v-for="(item, index) in values.items" :key="item.key" class="row">
                <div>
                    <label :for="form.fieldId(`items.${index}.product`)">Product {{ index + 1 }}</label>
                    <input
                        v-bind="form.fieldAttrs(`items.${index}.product`)"
                        v-model="item.product"
                        @input="edited(`items.${index}.product`)"
                    />
                    <p v-if="form.message(`items.${index}.product`)" :id="form.errorId(`items.${index}.product`)" class="error">
                        {{ form.message(`items.${index}.product`) }}
                    </p>
                </div>
                <div class="qty">
                    <label :for="form.fieldId(`items.${index}.qty`)">Quantity</label>
                    <input
                        v-bind="form.fieldAttrs(`items.${index}.qty`)"
                        v-model="item.qty"
                        inputmode="numeric"
                        @input="edited(`items.${index}.qty`)"
                    />
                    <p v-if="form.message(`items.${index}.qty`)" :id="form.errorId(`items.${index}.qty`)" class="error">
                        {{ form.message(`items.${index}.qty`) }}
                    </p>
                </div>
                <button type="button" class="secondary" :aria-label="`Remove product ${index + 1}`" @click="removeRow(index)">
                    Remove
                </button>
            </div>
            <button type="button" class="secondary" @click="values.items.push(row())">Add a product</button>
        </FormField>

        <FormField :form="form" name="address" label="Street address">
            <template #default="{ attrs }">
                <input v-bind="attrs" v-model="values.address" autocomplete="street-address" @input="edited('address')" />
            </template>
        </FormField>

        <FormField :form="form" name="postcode" label="Postcode" hint="5 digits.">
            <template #default="{ attrs }">
                <input
                    v-bind="attrs"
                    v-model="values.postcode"
                    inputmode="numeric"
                    autocomplete="postal-code"
                    @input="edited('postcode')"
                />
            </template>
        </FormField>

        <FormField :form="form" name="terms" label="Terms" group>
            <label class="choice">
                <input v-model="values.terms" type="checkbox" @change="edited('terms')" />
                I accept the terms
            </label>
        </FormField>

        <label class="choice simulate">
            <input v-model="serverError" type="checkbox" />
            Simulate a server failure (HTTP 500) on the next submit
        </label>

        <button type="submit" :disabled="busy">{{ busy ? 'Placing order…' : 'Place order' }}</button>
        <p role="status" class="status">{{ status }}</p>
    </form>
</template>
