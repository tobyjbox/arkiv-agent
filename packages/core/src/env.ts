const warned = new Set<string>();

/**
 * A setting by its current name, else by its name before the project was renamed (ARKIV_AGENT_*), which
 * still works for one release and warns once.
 */
export function env(name: string, legacy: string): string | undefined {
  if (process.env[name] !== undefined) return process.env[name];
  const value = process.env[legacy];
  if (value !== undefined && !warned.has(legacy)) {
    warned.add(legacy);
    console.warn(`${legacy} is now ${name}. The old name still works, but not after the next release.`);
  }
  return value;
}
