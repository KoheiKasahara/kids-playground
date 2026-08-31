/** Public game types kept in a small module so UI consumers do not need to
 * know which model file owns a particular value. */
export type { Direction, DirectionDelta } from './direction'
export type { PartKind, PartDefinition, PlacedPart } from './partDefinitions'
export type { Board, BoardCell, BoardSize, CellCoordinate, PartPlacement } from './boardModel'
export type { Point, Vector, PathSpec } from './roadGeometry'
export type { CarRoute, RouteOptions, RouteSample, RouteSegment, RouteStopReason } from './routeModel'
export type { VehicleDefinition, VehicleId } from './vehicleDefinitions'
