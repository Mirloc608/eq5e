
export function auditAARanks() {
  const defs = game.eq5e?.aa?.definitions ?? [];
  const issues=[];
  for (const d of defs) {
    if (d.maxRank>1 && !d.ranks) issues.push({aaId:d.aaId,issue:"Missing ranks array"});
    if (d.ranks && d.ranks.length!==d.maxRank) issues.push({aaId:d.aaId,issue:"Rank count mismatch"});
  }
  console.table(issues);
  return issues;
}
