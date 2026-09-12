// A recorded shortlist position is our demo recommendation signal.
// Frequency is evidence of association, not proof of why a model chose a brand.
export function recommendationEvidence(rows) {
  const recommended = rows.filter((r) => r.mention && r.position > 0);
  const lost = rows.filter((r) => !r.mention && r.competitors.length);
  const questions = new Set(rows.map((r) => r.question));
  const rank = (values) => [...new Set(values)].map((name) => ({
    name, count: values.filter((value) => value === name).length,
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    samples: rows.length,
    recommendations: recommended.length,
    share: rows.length ? recommended.length / rows.length * 100 : 0,
    questions: questions.size,
    lostAnswers: lost.length,
    lostQuestions: new Set(lost.map((r) => r.question)).size,
    competitors: rank(lost.flatMap((r) => r.competitors)),
    sources: rank(lost.map((r) => r.external).filter(Boolean)),
  };
}
