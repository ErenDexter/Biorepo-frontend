/**
 * Highlight state for the superstructure canvas.
 * `nodeIds` / `edgeIds` empty = no highlight, full opacity everywhere.
 */
function createHighlight() {
	let nodeIds = $state(new Set<string>());
	let edgeIds = $state(new Set<string>());

	return {
		get nodeIds() {
			return nodeIds;
		},
		get edgeIds() {
			return edgeIds;
		},
		get active() {
			return nodeIds.size > 0 || edgeIds.size > 0;
		},
		set(nodes: Iterable<string>, edges: Iterable<string>) {
			nodeIds = new Set(nodes);
			edgeIds = new Set(edges);
		},
		clear() {
			nodeIds = new Set();
			edgeIds = new Set();
		}
	};
}

export const highlight = createHighlight();
