/**
 * Which edge of its button a menu's list lines up with, so that the list stays on the screen: the one that was asked for if the list fits that way, otherwise
 * the other if it fits, otherwise the one that was asked for. `end` puts the right edge of the list on the right edge of the button and the list reaches left;
 * `start` puts the left edges together and the list reaches right. A button near the right edge of a bar wants `end`, and one that has wrapped to the middle of
 * a narrow screen needs `start`.
 */
export function menuSide(preferred: 'start' | 'end', buttonLeft: number, buttonRight: number, listWidth: number, viewportWidth: number): 'start' | 'end' {
  const fits = (side: 'start' | 'end') => (side === 'end' ? buttonRight - listWidth >= 0 : buttonLeft + listWidth <= viewportWidth)
  if (fits(preferred)) return preferred
  const other = preferred === 'end' ? 'start' : 'end'
  return fits(other) ? other : preferred
}
