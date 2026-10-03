import { afterEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import type { Component } from 'vue';

// These mount into the real document so focus can be asserted, and focus is
// resolved by id. Without teardown the ids from one test are still in the
// DOM during the next.
const mounted: VueWrapper[] = [];

afterEach(() => {
    while (mounted.length > 0) {
        mounted.pop()?.unmount();
    }

    document.body.innerHTML = '';
});

export function mountAttached(component: Component): VueWrapper {
    const wrapper = mount(component, { attachTo: document.body });
    mounted.push(wrapper);

    return wrapper;
}

/** Lets watchers run, then the `nextTick` that focusing awaits. */
export async function settle(): Promise<void> {
    await flushPromises();
    await flushPromises();
}

export function activeId(): string {
    return (document.activeElement as HTMLElement | null)?.id ?? '';
}
