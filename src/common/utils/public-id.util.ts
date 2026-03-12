/**
 * Gera um ID público sequencial legível para exibição na interface.
 *
 * @param prefix - Prefixo do ID ('P' para profissional, 'C' para cliente, 'A' para ambiente/projeto)
 * @param count  - Número atual de registros na tabela (antes de inserir o novo)
 * @returns ID formatado, ex: '#P001', '#C012', '#A100'
 *
 * @example
 * generatePublicId('P', 0)  // → '#P001'
 * generatePublicId('C', 9)  // → '#C010'
 * generatePublicId('A', 99) // → '#A100'
 */
export function generatePublicId(prefix: 'P' | 'C' | 'A', count: number): string {
  const next = count + 1;
  const padded = String(next).padStart(3, '0');
  return `#${prefix}${padded}`;
}
