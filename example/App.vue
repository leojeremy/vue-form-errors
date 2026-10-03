<script setup lang="ts">
import { ref } from 'vue';

import NewsletterForm from './NewsletterForm.vue';
import OrderForm from './OrderForm.vue';

/** Switching mode remounts the order form, since `autoFocus` is fixed at setup. */
const mode = ref<'field' | 'summary'>('field');
</script>

<template>
    <main>
        <h1>vue-form-errors</h1>
        <p class="lede">
            Submit a form to get a Laravel-shaped 422 from a fake API that runs in your browser. Rejected controls get
            <code>aria-invalid</code> and <code>aria-describedby</code>, and focus moves to the first problem in page
            order. Nothing is stored or sent anywhere.
            <a href="https://github.com/leojeremy/vue-form-errors">Source and docs on GitHub</a>.
        </p>

        <section aria-labelledby="order-heading">
            <h2 id="order-heading">Place an order</h2>
            <p class="lede">
                Things to try: submit it empty; fix one field and watch focus stay put while its error clears; add
                product rows and break the second one; order more than 50 units; tick "simulate a server failure".
            </p>

            <fieldset class="mode">
                <legend>On a rejected submit, focus</legend>
                <label class="choice"><input v-model="mode" type="radio" value="field" /> the first rejected field</label>
                <label class="choice"><input v-model="mode" type="radio" value="summary" /> the error summary</label>
            </fieldset>

            <OrderForm :key="mode" :auto-focus="mode" />
        </section>

        <section aria-labelledby="newsletter-heading">
            <h2 id="newsletter-heading">Newsletter</h2>
            <p class="lede">
                Wired by hand with <code>fieldAttrs()</code>, no components. It shares the field names
                <code>name</code> and <code>email</code> with the order form, so it uses its own
                <code>idPrefix</code>.
            </p>
            <NewsletterForm />
        </section>
    </main>
</template>
