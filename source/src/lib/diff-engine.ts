/**
 * What an engine that diffs two lists of strings has to be: one function, so that the engine behind `lineDiff` is one module that another can replace. The
 * items are strings: the lines of a text, or the words of a line.
 */

/** A run of items that two lists have in common: `a[a..a+length)` equals `b[b..b+length)`. */
export interface Common {
  a: number
  b: number
  length: number
}

export interface DiffEngine {
  /**
   * The runs of items that `a` and `b` have in common, in order, each of at least one item, none overlapping another in either list. What is not in a run is
   * removed (in `a`) or added (in `b`): the edits, whose number is the items of `a` outside the runs plus the items of `b` outside them. It gives null when the
   * diff that it found has more than `maxEdits` edits (an engine that finds the fewest edits: when no diff has fewer). It never throws and reads no clock, so
   * the same lists give the same runs on every machine.
   *
   * `common(['a', 'b', 'c'], ['a', 'x', 'c'], 10)` is `[{ a: 0, b: 0, length: 1 }, { a: 2, b: 2, length: 1 }]`, and with `maxEdits` 1 it is null (two edits).
   */
  common(a: readonly string[], b: readonly string[], maxEdits: number): Common[] | null
}
