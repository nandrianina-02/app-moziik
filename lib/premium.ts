export function hasPremiumAccess(params: {
  role?: string;
  subscriptionStatus?: string | null;
}): boolean {
  if (params.role === "admin") return true;
  return params.subscriptionStatus === "active";
}
