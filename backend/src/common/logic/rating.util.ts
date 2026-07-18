/** Reviews & ratings (Phase 4). Average rating with bounds validation. */
export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

export function averageRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((s, r) => s + r, 0);
  return Math.round((sum / ratings.length) * 100) / 100;
}
