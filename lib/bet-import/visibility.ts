export function resolveImportVisibility(requestedVisibility: string, unresolvedEventNames: string[]) {
  if (unresolvedEventNames.length > 0) return "borrador";
  return ["publico", "seguidores", "borrador"].includes(requestedVisibility)
    ? requestedVisibility
    : "publico";
}
