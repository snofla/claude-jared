import type { Common, DiffEngine } from './diff-engine.ts'

/**
 * The engine behind `lineDiff`: Myers' O(ND) greedy algorithm (the one `git diff` uses by default), which finds the fewest edits between two lists. It looks for a
 * diff of at most `d` edits for d = 0, 1, 2, … and keeps what each round reached, so that the way back to the start can be read off. Time is about (N + M) · D in
 * the worst case and N + M + D² in a usual one, with N and M the lengths and D the edits; the memory of the rounds is about D² numbers; both are bounded by
 * `maxEdits`.
 */

/** What a run of the engine cost, for the speed check: the diagonals it visited, and the comparisons that followed a diagonal as far as it went. */
export interface MyersWork {
  steps: number
}

/** The engine as a function, counting its work in `work` when one is given. */
export function myersCommon(a: readonly string[], b: readonly string[], maxEdits: number, work?: MyersWork): Common[] | null {
  // No number of edits, or fewer than none: not even equal lists are within it.
  if (!(maxEdits >= 0)) return null
  const n = a.length
  const m = b.length
  const limit = Math.min(n + m, Math.floor(maxEdits))
  // Items as numbers, so that comparing two of them is cheap whatever the length of a line.
  const ids = new Map<string, number>()
  const idOf = (item: string): number => {
    let id = ids.get(item)
    if (id === undefined) ids.set(item, (id = ids.size))
    return id
  }
  const ia = Int32Array.from(a, idOf)
  const ib = Int32Array.from(b, idOf)
  // furthest[off + k] is how far along `a` the best path on diagonal k (x - y = k) has got; `rounds[d]` is a copy of the diagonals -d..d before round d.
  const off = limit + 1
  const furthest = new Int32Array(2 * limit + 3)
  const rounds: Int32Array[] = []
  let steps = 0
  let found = -1
  search: for (let d = 0; d <= limit; d++) {
    rounds.push(furthest.slice(off - d, off + d + 1))
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && furthest[off + k - 1] < furthest[off + k + 1]) ? furthest[off + k + 1] : furthest[off + k - 1] + 1
      let y = x - k
      while (x < n && y < m && ia[x] === ib[y]) {
        x++
        y++
        steps++
      }
      steps++
      furthest[off + k] = x
      if (x >= n && y >= m) {
        found = d
        break search
      }
    }
  }
  if (work) work.steps += steps
  if (found < 0) return null
  // Back from the end, round by round: which diagonal the path came from, and the run of equal items that it followed to get to where it was.
  const runs: Common[] = []
  let x = n
  let y = m
  for (let d = found; d > 0; d--) {
    const before = rounds[d]
    const k = x - y
    const down = k === -d || (k !== d && before[k - 1 + d] < before[k + 1 + d])
    const fromK = down ? k + 1 : k - 1
    const fromX = before[fromK + d]
    const startX = down ? fromX : fromX + 1
    if (x > startX) runs.push({ a: startX, b: startX - k, length: x - startX })
    x = fromX
    y = fromX - fromK
  }
  if (x > 0) runs.push({ a: 0, b: 0, length: x })
  return runs.reverse()
}

export const myers: DiffEngine = { common: (a, b, maxEdits) => myersCommon(a, b, maxEdits) }
