/**
 * Calculate possible points pool for an event based on player count.
 *
 * Formula (must match server: server/src/services/event.service.ts → calculateEventPoints):
 *   - Base pool: 10 points for 10 or fewer players
 *   - +2 points per player beyond 10
 *
 * @param playerCount - Number of currently registered / checked-in players
 * @returns Total points pool available for the event
 */
export function calculatePossiblePoints(playerCount: number): number {
  const extraPlayers = Math.max(0, playerCount - 10);
  return 10 + extraPlayers * 2;
}
