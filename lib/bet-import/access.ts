export function canUserReadBetImport(
  row: { user_id: string },
  userId: string | null | undefined,
  isAdmin = false
) {
  if (!userId) return false;
  return isAdmin || row.user_id === userId;
}

export function canPublishBetImport(status: string) {
  return status === "processed";
}
