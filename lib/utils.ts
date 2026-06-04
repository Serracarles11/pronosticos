export function cn(...classes: unknown[]) {
  return classes.filter((className): className is string => typeof className === "string" && className.length > 0).join(" ");
}
