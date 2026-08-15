/**
 * Concatena classes ignorando valores falsos.
 * Versão mínima de clsx — não vale adicionar dependência para isso.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
