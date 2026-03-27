/**
 * Template variable resolution for prompts.
 *
 * Replaces {{variable}} placeholders with values from a vars map.
 * Warns on unresolved variables, leaves placeholder in place.
 */

const TEMPLATE_PATTERN = /\{\{(\w+(?:\.\w+)*)\}\}/g;

/**
 * Resolve template variables in a prompt string.
 *
 * @param template - Prompt text with {{variable}} placeholders
 * @param vars - Map of variable names to runtime values
 * @returns Resolved text with placeholders replaced
 */
export function resolveTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(TEMPLATE_PATTERN, (match, varName: string) => {
    if (varName in vars) {
      return vars[varName];
    }
    console.warn(`[prompts] Unresolved template variable: ${match}`);
    return match;
  });
}
