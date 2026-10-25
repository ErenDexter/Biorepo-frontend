// Figure settings, persisted per browser. Lengths are in points (1/72 in) unless
// the name says otherwise, so the figure's natural size is its printed size.

export type Notation = 'pgraph' | 'block';
export type Direction = 'DOWN' | 'RIGHT';
export type EdgeStyle = 'orthogonal' | 'rounded' | 'spline';
export type Palette = 'mono' | 'colour';
export type FontFamily = 'sans' | 'serif';

export interface FigureSettings {
	notation: Notation;
	direction: Direction;
	font: FontFamily;
	/** Text size at natural (1:1) size, in pt. */
	fontSize: number;
	/** Multiplier on every gap between nodes and edges. */
	spacing: number;
	edgeStyle: EdgeStyle;
	palette: Palette;
	legend: boolean;
	/** Characters per label line before wrapping. */
	wrap: number;
	materialQualifiers: boolean;
	operationQualifiers: boolean;
	markAugmented: boolean;
	annotateScaling: boolean;
	/** Whitespace around the drawing, in mm. */
	marginMm: number;
	/** Export width in mm; null keeps the natural size. */
	widthMm: number | null;
	dpi: number;
	transparent: boolean;
}

export const DEFAULTS: FigureSettings = {
	notation: 'pgraph',
	direction: 'DOWN',
	font: 'sans',
	fontSize: 8,
	spacing: 1,
	edgeStyle: 'orthogonal',
	palette: 'mono',
	legend: true,
	wrap: 24,
	materialQualifiers: false,
	operationQualifiers: true,
	markAugmented: true,
	annotateScaling: true,
	marginMm: 1.5,
	widthMm: null,
	dpi: 1000,
	transparent: false
};

/** Elsevier column widths, in mm. */
export const COLUMN_WIDTHS = [
	{ label: 'Natural size', value: null },
	{ label: 'Single column · 90 mm', value: 90 },
	{ label: '1.5 column · 140 mm', value: 140 },
	{ label: 'Double column · 190 mm', value: 190 }
] as const;

export const DPI_CHOICES = [300, 600, 1000, 1200] as const;

/** Smallest printed text size Elsevier accepts for normal lettering. */
export const MIN_PRINT_PT = 7;

const KEY = 'biorepo.figure.v1';

function load(): FigureSettings {
	try {
		const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
		if (raw) {
			// Keep only known settings, so keys from older versions are dropped.
			const saved = JSON.parse(raw);
			const known = Object.keys(DEFAULTS).filter((k) => k in saved);
			return { ...DEFAULTS, ...Object.fromEntries(known.map((k) => [k, saved[k]])) };
		}
	} catch {
		// Unreadable or blocked storage: fall back to defaults.
	}
	return structuredClone(DEFAULTS);
}

export const figure = $state<FigureSettings>(load());

export function saveFigureSettings(): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(figure));
	} catch {
		// Storage is a convenience; the figure still renders without it.
	}
}

export function resetFigureSettings(): void {
	Object.assign(figure, structuredClone(DEFAULTS));
}
