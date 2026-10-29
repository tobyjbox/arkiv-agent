/** GLM amounts: up to 4 significant digits, plain decimals for small values (never 1.2e-5). */
export const glm = (x: number) => (x === 0 ? "0" : x.toLocaleString("en", { maximumSignificantDigits: 4 }));

/** USD amounts: cents for normal values, up to 3 significant digits below a cent. */
export const usd = (x: number) =>
  x === 0 ? "$0" : x >= 0.01 ? `$${x.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${x.toLocaleString("en", { maximumSignificantDigits: 3 })}`;
