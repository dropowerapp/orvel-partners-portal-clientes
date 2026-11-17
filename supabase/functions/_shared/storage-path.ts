/** Defesa adicional antes de usar a chave de serviço num objeto de Storage. */
export function isProcessStoragePath(path: string, organizationId: string, processId: string): boolean {
  return path.startsWith(`${organizationId}/${processId}/`) &&
    !path.includes("..") && !path.includes("\\") &&
    path.split("/").every((part) => part.length > 0 && part !== ".");
}
