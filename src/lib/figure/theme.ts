import type { FontFamily, Palette } from './settings.svelte';

/** Fonts every journal accepts and every PDF viewer has: Arial/Helvetica and Times. */
export const FONT_STACK: Record<FontFamily, string> = {
	sans: 'Arial, Helvetica, sans-serif',
	serif: "'Times New Roman', Times, serif"
};

/** The matching standard-14 PDF fonts, so exported PDFs embed nothing. */
export const PDF_FONT: Record<FontFamily, string> = { sans: 'helvetica', serif: 'times' };

export type NodeKind = 'raw' | 'raw-aug' | 'intermediate' | 'product' | 'byproduct' | 'operation';

export interface Swatch {
	stroke: string;
	fill: string;
	/** Inner mark (product bullseye) or bar fill. */
	mark: string;
	dashed?: boolean;
}

export interface Theme {
	ink: string;
	text: string;
	qualifier: string;
	edge: string;
	/** Colours for everything outside a highlighted structure. */
	muted: { stroke: string; fill: string; text: string; light: string };
	node: Record<NodeKind, Swatch>;
}

const MUTED = { stroke: '#c6c6c6', fill: '#c6c6c6', text: '#a6a6a6', light: '#f4f4f4' };

export const THEMES: Record<Palette, Theme> = {
	mono: {
		ink: '#000000',
		text: '#000000',
		qualifier: '#3a3a3a',
		edge: '#000000',
		muted: MUTED,
		node: {
			raw: { stroke: '#000000', fill: '#e6e6e6', mark: '#000000' },
			'raw-aug': { stroke: '#000000', fill: '#e6e6e6', mark: '#ffffff', dashed: true },
			intermediate: { stroke: '#000000', fill: '#ffffff', mark: '#000000' },
			product: { stroke: '#000000', fill: '#ffffff', mark: '#000000' },
			byproduct: { stroke: '#000000', fill: '#ffffff', mark: '#ffffff', dashed: true },
			operation: { stroke: '#000000', fill: '#ffffff', mark: '#000000' }
		}
	},
	colour: {
		ink: '#1a1a1a',
		text: '#1a1a1a',
		qualifier: '#4a4a4a',
		edge: '#333333',
		muted: MUTED,
		node: {
			raw: { stroke: '#2e7d32', fill: '#e6f2e6', mark: '#2e7d32' },
			'raw-aug': { stroke: '#b45309', fill: '#fdf0dc', mark: '#ffffff', dashed: true },
			intermediate: { stroke: '#1a1a1a', fill: '#ffffff', mark: '#1a1a1a' },
			product: { stroke: '#1f4e9a', fill: '#e5ecf8', mark: '#1f4e9a' },
			byproduct: { stroke: '#6b6b6b', fill: '#ffffff', mark: '#ffffff', dashed: true },
			operation: { stroke: '#1a1a1a', fill: '#f3f3f3', mark: '#262626' }
		}
	}
};

export const LEGEND_TEXT: Record<NodeKind, string> = {
	raw: 'Raw material',
	'raw-aug': 'Raw material (augmented)',
	intermediate: 'Intermediate material',
	product: 'Product',
	byproduct: 'By-product',
	operation: 'Operating unit'
};

export const LEGEND_ORDER: NodeKind[] = [
	'raw',
	'raw-aug',
	'intermediate',
	'product',
	'byproduct',
	'operation'
];
