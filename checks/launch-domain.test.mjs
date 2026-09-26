import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAnswer,
  providerCostMicrousd,
  validateQuestionSet,
  validateWebsiteUrl,
  websiteTextFromHtml,
} from '../lib/launch-domain.js';

function questionSet() {
  return Array.from({ length: 24 }, (_, index) => ({
    id: null,
    stage: ['discovery','comparison','decision'][Math.floor(index / 8)],
    text: `What should buyers know about option ${index + 1}?`,
  }));
}

test('company website accepts public HTTPS hosts and rejects local/private targets', () => {
  assert.equal(validateWebsiteUrl('example.com'), 'https://example.com/');
  assert.throws(() => validateWebsiteUrl('http://example.com'), /HTTPS/);
  assert.throws(() => validateWebsiteUrl('https://localhost'), /HTTPS/);
  assert.throws(() => validateWebsiteUrl('https://127.0.0.1'), /HTTPS/);
  assert.throws(() => validateWebsiteUrl('https://example.com:8443'), /HTTPS/);
});

test('website extraction removes scripts and keeps readable page content', () => {
  const page = websiteTextFromHtml('<title>Brand</title><meta name="description" content="Good tools"><script>ignore me</script><main>Good &amp; useful tools for teams.</main>');
  assert.equal(page.title, 'Brand');
  assert.equal(page.description, 'Good tools');
  assert.equal(page.text, 'Good & useful tools for teams.');
});

test('question set enforces 20–25 distinct questions across all three stages', () => {
  const valid = validateQuestionSet(questionSet(), { minCount: 20, maxCount: 25, minPerStage: 4 });
  assert.equal(valid.length, 24);
  assert.throws(() => validateQuestionSet(questionSet().slice(0, 19)), /20 and 25/);
  const duplicate = questionSet();
  duplicate[1].text = duplicate[0].text;
  assert.throws(() => validateQuestionSet(duplicate), /duplicate/);
});

test('question identifiers cannot be reused across edited rows', () => {
  const questions = questionSet();
  questions[0].id = '85b2cf20-2569-40f7-88cb-207a85131775';
  questions[1].id = questions[0].id;
  assert.throws(() => validateQuestionSet(questions), /more than once/);
});

test('classification distinguishes recommendations, mentions and absence', () => {
  const result = classifyAnswer('For a small team, Acme is a strong choice. Buyers also consider Rival Co.', 'Acme', ['Rival Co']);
  assert.equal(result.brandState, 'recommended');
  assert.equal(result.competitorStates['Rival Co'], 'mentioned');
  assert.equal(classifyAnswer('Try Rival Co instead.', 'Acme').brandState, 'absent');
});

test('provider cost math uses current configured rates and web call counts', () => {
  assert.equal(providerCostMicrousd({ provider: 'openai', inputTokens: 100, outputTokens: 20, searchCalls: 1 }), 10_020);
  assert.equal(providerCostMicrousd({ provider: 'openai', inputTokens: 100, cachedInputTokens: 60, outputTokens: 20 }), 15);
  assert.equal(providerCostMicrousd({ provider: 'openai', inputTokens: 100, cacheWriteTokens: 40 }), 11);
  assert.equal(providerCostMicrousd({ provider: 'perplexity', inputTokens: 100, outputTokens: 20, searchCalls: 1 }), 75);
});
