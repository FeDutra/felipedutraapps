export function invariant(condition, message) {
  if (!condition) throw new Error("invariant:" + message);
}
