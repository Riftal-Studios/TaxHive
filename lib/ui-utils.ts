/**
 * Common class names for form inputs that respect theme
 */
export const inputClassName = `
  mt-1 block w-full rounded-md 
  border-gray-300 dark:border-gray-600 
  bg-white dark:bg-gray-700 
  text-gray-900 dark:text-white 
  shadow-sm 
  focus:border-indigo-500 focus:ring-indigo-500
  dark:focus:border-indigo-400 dark:focus:ring-indigo-400
`.replace(/\s+/g, ' ').trim()

export const selectClassName = inputClassName

export const textareaClassName = inputClassName

/**
 * Get input class with optional error state
 */
export function getInputClassName(hasError?: boolean): string {
  if (hasError) {
    return inputClassName.replace(
      'border-gray-300 dark:border-gray-600',
      'border-red-300 dark:border-red-500'
    )
  }
  return inputClassName
}

/**
 * Special input for exchange rate
 */
export const exchangeRateInputClassName = `
  w-32 px-3 py-1 text-sm 
  border border-yellow-300 dark:border-yellow-700 
  rounded-md bg-white dark:bg-gray-800 
  text-gray-900 dark:text-white
  focus:ring-yellow-500 focus:border-yellow-500
`.replace(/\s+/g, ' ').trim()

/**
 * Dropdown button styles
 */
export const dropdownButtonClassName = `
  mt-1 w-full px-3 py-2 text-left 
  border rounded-md shadow-sm 
  bg-white dark:bg-gray-700 
  text-gray-900 dark:text-white
  border-gray-300 dark:border-gray-600
  focus:ring-indigo-500 focus:border-indigo-500
`.replace(/\s+/g, ' ').trim()

export function getDropdownButtonClassName(hasError?: boolean): string {
  if (hasError) {
    return dropdownButtonClassName.replace(
      'border-gray-300 dark:border-gray-600',
      'border-red-300 dark:border-red-500'
    )
  }
  return dropdownButtonClassName
}

/**
 * Dropdown container styles
 */
export const dropdownContainerClassName = `
  absolute z-10 mt-1 w-full 
  bg-white dark:bg-gray-700 
  border border-gray-300 dark:border-gray-600 
  rounded-md shadow-lg
`.replace(/\s+/g, ' ').trim()

/**
 * Dropdown item styles
 */
export const dropdownItemClassName = `
  block w-full px-4 py-2 text-left 
  text-gray-900 dark:text-white
  hover:bg-gray-100 dark:hover:bg-gray-600
`.replace(/\s+/g, ' ').trim()

/**
 * Common button styles
 */
export const buttonClassName = {
  primary: `
    px-4 py-2 text-sm font-medium text-white 
    bg-indigo-600 hover:bg-indigo-700 
    border border-transparent rounded-md 
    focus:outline-none focus:ring-2 focus:ring-offset-2 
    focus:ring-indigo-500 dark:focus:ring-offset-gray-800 
    disabled:opacity-50 disabled:cursor-not-allowed
  `.replace(/\s+/g, ' ').trim(),
  
  secondary: `
    px-4 py-2 text-sm font-medium 
    text-gray-700 dark:text-gray-300 
    bg-white dark:bg-gray-700 
    border border-gray-300 dark:border-gray-600 
    rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 
    focus:outline-none focus:ring-2 focus:ring-offset-2 
    focus:ring-indigo-500 dark:focus:ring-offset-gray-800
  `.replace(/\s+/g, ' ').trim(),
}