/**
 * @since 1.0.0
 */

// Taken from postgres.js under the "UNLICENCE" licence.
// https://github.com/porsager/postgres/blob/master/src/types.js
//
// Thank you!

/**
 * @category transform
 * @since 1.0.0
 */
export const toCamel = (x: string) => {
  let str = x[0]
  for (let i = 1; i < x.length; i++) {
    str += x[i] === "_" ? x[++i].toUpperCase() : x[i]
  }
  return str
}

/**
 * @category transform
 * @since 1.0.0
 */
export const toPascal = (x: string) => {
  let str = x[0].toUpperCase()
  for (let i = 1; i < x.length; i++) {
    str += x[i] === "_" ? x[++i].toUpperCase() : x[i]
  }
  return str
}

/**
 * @category transform
 * @since 1.0.0
 */
export const toKebab = (x: string) => x.replace(/_/g, "-")

/**
 * @category transform
 * @since 1.0.0
 */
export const fromCamel = (x: string) =>
  x.replace(/([A-Z])/g, "_$1").toLowerCase()

/**
 * @category transform
 * @since 1.0.0
 */
export const fromPascal = (x: string) =>
  (x.slice(0, 1) + x.slice(1).replace(/([A-Z])/g, "_$1")).toLowerCase()

/**
 * @category transform
 * @since 1.0.0
 */
export const fromKebab = (x: string) => x.replace(/-/g, "_")
