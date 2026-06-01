import type { Orientation } from '$lib/layout';

function createOrientation() {
	let value = $state<Orientation>('vertical');
	return {
		get value() {
			return value;
		},
		set(v: Orientation) {
			value = v;
		},
		toggle() {
			value = value === 'horizontal' ? 'vertical' : 'horizontal';
		}
	};
}

export const orientation = createOrientation();
