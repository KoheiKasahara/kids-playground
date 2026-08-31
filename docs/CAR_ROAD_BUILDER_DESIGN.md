# くるまのみちづくり (car-road-builder)

## Phase 1 scope

The game is a small, two-dimensional grid builder for young children. A 4×4
board can be expanded once to 5×5; expansion appends one column on the east
and one row on the south. Cells keep their IDs and placed part state when the
board grows. The board UI owns no pixel dimensions, so it remains usable in a
scroll container on a 320px-wide phone.

Phase 1 has `start`, `straight`, `curve`, and `goal` cells. Straight and curve
pieces are the roads children edit. A placed part stores only `kind` and
`rotationStep`; its ports are derived from `partDefinitions.ts`.

## Direction and ports

Directions are one clockwise table: `N, NE, E, SE, S, SW, W, NW`.
Rotation is in 45-degree steps. A cardinal port ends at the centre of a cell
edge and a diagonal port ends at that cell corner. `neighborCell` advances by
the corresponding one-cell delta. A connection is valid only if the next cell
has the opposite port (for example, `E` / `W`); proximity never creates a
connection.

`straight` exposes four unique poses: N–S, NE–SW, E–W, and SE–NW. `curve` is
the N+E right-angle curve rotated through all eight poses. `start` has one
rotatable exit. `goal` is not rotated and accepts all eight incoming ports.

## Shared route geometry

`roadGeometry.ts` creates normalized path specifications. Both SVG/cell road
drawing and the car route walker use the same `PathSpec`, including samples,
tangents, SVG path data, and measured length. Curves are quadratic halves that
meet at the cell centre. Route animation samples by measured length, giving a
constant speed despite a curve being longer than a straight line.

The route walker starts at the start centre, follows the start exit, and then
uses the non-entry port of each road. It stops at an empty cell, a missing
neighbour, a port mismatch, a goal, or a repeated `(cell,incoming)` state. No
warping across cells is possible. While the car runs, the board and editing
controls are locked.

## Child-facing interactions

The palette is horizontally scrollable. Tapping a part selects it, then tapping
a cell places it; native dragging from the palette is also supported. The
selected-cell controls rotate by 45° or remove a part. Start and goal are each
limited to one. The status line is `aria-live="polite"`; controls use large
touch targets, and the layout respects reduced motion.
