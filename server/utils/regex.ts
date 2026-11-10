/**
 * Escapes characters with special meaning in regular expressions
 * to prevent ReDoS attacks and uncaught regex syntax errors.
 */
export function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
