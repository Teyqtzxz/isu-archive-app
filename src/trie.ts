// Pure prefix tree (Trie): no React, no firebase. Examples in trie.check.ts
// (node src/trie.check.ts). A drawing is in docs/16-smart-search.md.
//
// A Trie stores words letter by letter. Words that start the same share the
// same first nodes: "soil" and "soils" share s → o → i → l. To find every
// word that starts with "soi", walk s → o → i (three steps, however many
// words are stored) and collect everything below that node. That is why
// autocomplete does not have to scan the whole word list on each keystroke.
//
// This file knows nothing about studies. It stores any value under a text
// key; smartSearch.ts decides what the keys and values are.

/** One node: its children, one per next letter, and the values whose key
 *  ends exactly here (several values may share one key). */
interface TrieNode<T> {
  children: Map<string, TrieNode<T>>;
  values: T[];
}

function newNode<T>(): TrieNode<T> {
  return { children: new Map(), values: [] };
}

export class Trie<T> {
  private root: TrieNode<T> = newNode();

  /** Stores `value` under `key`, adding the missing nodes on the way down.
   *  Letters are code points ([...key]), so "ñ" is one step, not two. */
  insert(key: string, value: T): void {
    let node = this.root;
    for (const letter of [...key]) {
      let child = node.children.get(letter);
      if (!child) {
        child = newNode();
        node.children.set(letter, child);
      }
      node = child;
    }
    node.values.push(value);
  }

  /** Every value whose key starts with `prefix` (the key itself included).
   *  An empty prefix returns everything; a prefix no key starts with returns []. */
  withPrefix(prefix: string): T[] {
    const start = this.nodeAt(prefix);
    if (!start) return [];
    const found: T[] = [];
    collect(start, found);
    return found;
  }

  /** The node reached by walking `prefix` letter by letter, or null when a
   *  letter has no child (no stored key starts that way). */
  private nodeAt(prefix: string): TrieNode<T> | null {
    let node = this.root;
    for (const letter of [...prefix]) {
      const child = node.children.get(letter);
      if (!child) return null;
      node = child;
    }
    return node;
  }
}

/** Adds the values of `node` and of every node below it to `found`.
 *  Uses a list of nodes still to visit instead of recursion, so a very long
 *  key cannot overflow the call stack. */
function collect<T>(node: TrieNode<T>, found: T[]): void {
  const toVisit: TrieNode<T>[] = [node];
  while (toVisit.length > 0) {
    const current = toVisit.pop()!;
    for (const v of current.values) found.push(v);
    for (const child of current.children.values()) toVisit.push(child);
  }
}
