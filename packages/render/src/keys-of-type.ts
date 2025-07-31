/**
 * This utility type allows you to access dynamically to the specified object type attributes that match the specified value type.
 * @template T The object type from we extract keys
 * @template V The value type that extracted keys associated values should match
 * @return The union of the keys from the specified object type that its associated value match the specified value type
 *
 * @example
 * type Test = { A?: string; B: boolean; C: string; D: number; E: string | number };
 * KeysOfType<Test, string> => "C"
 * KeysOfType<Test, number> => "D"
 * KeysOfType<Test, string | number> => "C" | "D" | "E"
 * KeysOfType<Test, string | undefined> => "A" | "C"
 */
export type KeysOfType<T, V> = {
  [K in keyof T]-?: T[K] extends V ? (V extends T[K] ? K : never) : never;
}[keyof T];
