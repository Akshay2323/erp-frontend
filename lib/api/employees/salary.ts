/** Mirrors backend expectation: `basic + HRA + allowances - deductions`. */
export function computeNetSalary(
  basicSalary: number,
  hra = 0,
  allowances = 0,
  deductions = 0,
): number {
  const n =
    Number(basicSalary) + Number(hra) + Number(allowances) - Number(deductions);
  return Math.round(n * 100) / 100;
}
