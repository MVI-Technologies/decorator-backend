/**
 * Converte avatarUrl relativa (ex.: /uploads/avatars/xxx.jpg) em URL absoluta.
 * Se já for absoluta (http/https) ou baseUrl não estiver definida, retorna sem alterar.
 */
export function toAbsoluteAvatarUrl(
  avatarUrl: string | null | undefined,
  baseUrl: string | undefined,
): string | null | undefined {
  if (avatarUrl == null || avatarUrl === '') return avatarUrl;
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) return avatarUrl;
  if (!baseUrl || !baseUrl.trim()) return avatarUrl;
  const base = baseUrl.replace(/\/$/, '');
  const path = avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`;
  return `${base}${path}`;
}
