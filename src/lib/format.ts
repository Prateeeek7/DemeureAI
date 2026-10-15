// Whole rupees stay whole; anything with paise always shows two decimals (₹1,942.50, not ₹1,942.5).
export const inr = (n: number) => n.toLocaleString('en-IN', {
  minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  maximumFractionDigits: 2,
});
