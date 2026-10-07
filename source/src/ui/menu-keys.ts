/**
 * Where the focus goes in an open menu when a key is pressed: the arrows step through the items and wrap round, Home and End go to the
 * first and the last. `index` is the item that has the focus, or -1 when none has, and `count` how many there are. `null` for any other key
 * and for a menu with nothing in it.
 */
export function menuStep(key: string, index: number, count: number): number | null {
  if (count === 0) return null
  if (key === 'ArrowDown') return (index + 1) % count
  if (key === 'ArrowUp') return index <= 0 ? count - 1 : index - 1
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}
