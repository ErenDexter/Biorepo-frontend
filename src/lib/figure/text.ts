import type { FigureSettings, FontFamily } from './settings.svelte';
import { FONT_STACK } from './theme';

export interface Line {
	text: string;
	italic: boolean;
	/** Size relative to the figure's font size. */
	scale: number;
}

export type Measure = (text: string, size: number, font: FontFamily, italic: boolean) => number;

/** Line advance and baseline offset, as fractions of the line's font size. */
export const LINE_HEIGHT = 1.17;
export const ASCENT = 0.8;
const QUALIFIER_SCALE = 0.86;

let ctx: CanvasRenderingContext2D | null = null;

/** Text width from the browser's own font metrics, in the units of `size`. */
export const measureText: Measure = (text, size, font, italic) => {
	ctx ??= document.createElement('canvas').getContext('2d');
	if (!ctx) return text.length * size * 0.5;
	ctx.font = `${italic ? 'italic ' : ''}${size}px ${FONT_STACK[font]}`;
	return ctx.measureText(text).width;
};

function wrap(text: string, max: number): string[] {
	const out: string[] = [];
	let line = '';
	for (const word of text.split(/\s+/).filter(Boolean)) {
		if (line && line.length + 1 + word.length > max) {
			out.push(line);
			line = word;
		} else {
			line = line ? `${line} ${word}` : word;
		}
	}
	if (line) out.push(line);
	return out;
}

/**
 * The lines drawn for a node. The stored name is split at its first comma into
 * a name and a qualifier ("Lactide production" / "bagasse cogeneration and HFO
 * hot oil"); the qualifier is set smaller and in italics when enabled for that
 * node type.
 */
export function labelLines(
	name: string,
	isOperation: boolean,
	s: FigureSettings,
	annotation?: string
): Line[] {
	const lines: Line[] = [];
	const cut = name.indexOf(', ');
	const head = cut < 0 ? name : name.slice(0, cut);
	const qualifier = cut < 0 ? '' : name.slice(cut + 2);
	for (const text of wrap(head, s.wrap)) lines.push({ text, italic: false, scale: 1 });
	const showQualifier = isOperation ? s.operationQualifiers : s.materialQualifiers;
	if (qualifier && showQualifier) {
		for (const text of wrap(qualifier, Math.round(s.wrap * 1.12))) {
			lines.push({ text, italic: true, scale: QUALIFIER_SCALE });
		}
	}
	if (annotation) lines.push({ text: annotation, italic: false, scale: QUALIFIER_SCALE });
	return lines;
}

export function blockSize(
	lines: Line[],
	fontSize: number,
	font: FontFamily,
	measure: Measure
): { width: number; height: number } {
	let width = 0;
	let height = 0;
	for (const line of lines) {
		const size = fontSize * line.scale;
		width = Math.max(width, measure(line.text, size, font, line.italic));
		height += size * LINE_HEIGHT;
	}
	return { width, height };
}
