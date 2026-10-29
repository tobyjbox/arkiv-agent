/** GLM amounts: up to 4 significant digits, plain decimals for small values (never 1.2e-5). */
export const glm = (x: number) => (x === 0 ? "0" : x.toLocaleString("en", { maximumSignificantDigits: 4 }));
