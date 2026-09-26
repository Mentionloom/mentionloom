const main = document.querySelector('#launch-main');
const nav = document.querySelector('#launch-nav');
const signOut = document.querySelector('#sign-out');
const toast = document.querySelector('#launch-toast');
const route = location.pathname.replace(/\/+$/, '').split('/').at(-1) || 'overview';
const authRoute = ['sign-in','sign-up','forgot-password','reset-password'].includes(route);
let product = null;
let polling = false;
let toastTimer = null;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: options.body === undefined ? { Accept: 'application/json' } : {
      Accept: 'application/json', 'Content-Type': 'application/json',
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  let result = {};
  try { result = await response.json(); } catch {}
  if (response.status === 401 && !authRoute) {
    const next = location.pathname + location.search;
    location.replace(`/app/sign-in/?next=${encodeURIComponent(next)}`);
    throw new Error('Please sign in to continue.');
  }
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}

function setBusy(value) {
  main.setAttribute('aria-busy', String(value));
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
}

function renderError(target, error) {
  const field = target?.querySelector('[data-form-error]');
  if (field) {
    field.textContent = error.message;
    field.hidden = false;
  } else {
    showToast(error.message);
  }
}

function setPageTitle(title) {
  document.title = `${title} · Mentionloom`;
  const links = [...nav.querySelectorAll('[data-product-route]')];
  for (const link of links) {
    if (link.dataset.productRoute === route) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }
}

function formatDate(value) {
  if (!value) return 'Not started';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusLabel(status) {
  return ({ queued: 'Queued', running: 'In progress', completed: 'Complete', partial: 'Partial results', failed: 'Failed', cancelled: 'Cancelled' })[status] || 'Not started';
}

function statusClass(status) {
  return ['queued','running'].includes(status) ? 'running' : ['completed'].includes(status) ? 'complete' : ['partial'].includes(status) ? 'partial' : ['failed'].includes(status) ? 'failed' : '';
}

function attachSignOut() {
  signOut.hidden = false;
  signOut.onclick = async () => {
    signOut.disabled = true;
    try { await api('/api/auth/sign-out', { method: 'POST', body: {} }); }
    finally { location.assign('/app/sign-in/'); }
  };
}

function renderAuth(kind) {
  nav.hidden = true;
  signOut.hidden = true;
  const signup = kind === 'sign-up';
  const authStatus = new URLSearchParams(location.search).get('auth');
  const authMessage = authStatus === 'confirmation-error'
    ? 'That confirmation link has expired or was already used. Request a new signup link and try again.'
    : authStatus === 'confirmation-missing'
      ? 'The confirmation link was incomplete. Open the latest link from your inbox.'
      : '';
  setPageTitle(signup ? 'Create your workspace' : 'Sign in');
  main.innerHTML = `
    <div class="launch-auth-wrap">
      <section class="launch-auth-card" aria-labelledby="auth-title">
        <p class="launch-eyebrow">Mentionloom workspace</p>
        <h1 id="auth-title">${signup ? 'Start your first analysis' : 'Welcome back'}</h1>
        <p>${signup ? 'Create an account, add your website, and see where AI answers mention your brand.' : 'Sign in to continue to your workspace.'}</p>
        ${authMessage ? `<p class="launch-inline-error" role="alert">${escapeHtml(authMessage)}</p>` : ''}
        <div data-auth-content>
          <form class="launch-form" id="auth-form" novalidate>
            <div class="launch-field"><label for="email">Work email</label><input id="email" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254" /></div>
            <div class="launch-field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="10" maxlength="128" /><small>${signup ? 'Use at least 10 characters.' : 'At least 10 characters.'}</small></div>
            <p class="launch-inline-error" data-form-error role="alert" hidden></p>
            <button class="button primary" type="submit">${signup ? 'Create account' : 'Sign in'}</button>
          </form>
          <p class="launch-auth-switch">${signup ? 'Already have an account?' : 'New to Mentionloom?'} <a href="/app/${signup ? 'sign-in' : 'sign-up'}/">${signup ? 'Sign in' : 'Create an account'}</a></p>
          ${!signup ? '<p class="launch-auth-switch"><a href="/app/forgot-password/">Forgot your password?</a></p>' : ''}
        </div>
      </section>
    </div>`;
  const form = document.querySelector('#auth-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type=submit]');
    const error = form.querySelector('[data-form-error]');
    error.hidden = true;
    if (!form.reportValidity()) return;
    submit.disabled = true;
    submit.textContent = signup ? 'Creating account…' : 'Signing in…';
    try {
      const body = Object.fromEntries(new FormData(form));
      const result = await api(`/api/auth/${signup ? 'sign-up' : 'sign-in'}`, { method: 'POST', body });
      if (signup && result.needsEmailConfirmation) {
        document.querySelector('[data-auth-content]').innerHTML = `
          <div class="launch-confirmation" role="status"><strong>Check your email to confirm your account.</strong><br />We sent a confirmation link to ${escapeHtml(body.email)}. Follow it to finish setting up your workspace.</div>
          <p class="launch-auth-switch"><a href="/app/sign-in/">Return to sign in</a></p>`;
        return;
      }
      const next = new URLSearchParams(location.search).get('next') || '/app/overview/';
      location.assign(next.startsWith('/app/') && !next.startsWith('//') ? next : '/app/overview/');
    } catch (error) {
      renderError(form, error);
      submit.disabled = false;
      submit.textContent = signup ? 'Create account' : 'Sign in';
    }
  });
}

function renderForgotPassword() {
  setPageTitle('Reset your password');
  main.innerHTML = `<div class="launch-auth-wrap"><section class="launch-auth-card" aria-labelledby="reset-title"><p class="launch-eyebrow">Account access</p><h1 id="reset-title">Reset your password</h1><p>Enter the email on your account. If it matches, we’ll send a secure reset link.</p><form class="launch-form" id="forgot-form" novalidate><div class="launch-field"><label for="recovery-email">Work email</label><input id="recovery-email" name="email" type="email" autocomplete="email" required maxlength="254" /></div><p class="launch-inline-error" data-form-error role="alert" hidden></p><button class="button primary" type="submit">Send reset link</button></form><p class="launch-auth-switch"><a href="/app/sign-in/">Return to sign in</a></p></section></div>`;
  const form = document.querySelector('#forgot-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('button');
    const error = form.querySelector('[data-form-error]');
    error.hidden = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      await api('/api/auth/password-reset', { method: 'POST', body: { email: new FormData(form).get('email') } });
      form.innerHTML = `<div class="launch-confirmation" role="status"><strong>Check your email.</strong><br />If that address belongs to a Mentionloom account, you’ll receive a password reset link.</div><p class="launch-auth-switch"><a href="/app/sign-in/">Return to sign in</a></p>`;
    } catch (error) {
      renderError(form, error);
      button.disabled = false;
      button.textContent = 'Send reset link';
    }
  });
}

function renderResetPassword() {
  setPageTitle('Choose a new password');
  main.innerHTML = `<div class="launch-auth-wrap"><section class="launch-auth-card" aria-labelledby="reset-title"><p class="launch-eyebrow">Account access</p><h1 id="reset-title">Choose a new password</h1><p>Use at least 10 characters. Your password is stored by Supabase Auth.</p><form class="launch-form" id="reset-form" novalidate><div class="launch-field"><label for="new-password">New password</label><input id="new-password" name="password" type="password" autocomplete="new-password" required minlength="10" maxlength="128" /></div><div class="launch-field"><label for="confirm-password">Confirm new password</label><input id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" required minlength="10" maxlength="128" /></div><p class="launch-inline-error" data-form-error role="alert" hidden></p><button class="button primary" type="submit">Save password</button></form></section></div>`;
  const form = document.querySelector('#reset-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const error = form.querySelector('[data-form-error]');
    const button = form.querySelector('button');
    error.hidden = true;
    if (data.get('password') !== data.get('confirmPassword')) {
      error.textContent = 'Those passwords don’t match.';
      error.hidden = false;
      return;
    }
    button.disabled = true;
    button.textContent = 'Saving…';
    try {
      await api('/api/auth/password-update', { method: 'PUT', body: { password: data.get('password') } });
      location.assign('/app/overview/');
    } catch (error) {
      renderError(form, error);
      button.disabled = false;
      button.textContent = 'Save password';
    }
  });
}

function pageHeading(title, description, eyebrow = 'Your workspace') {
  return `<header class="launch-page-heading"><div><p class="launch-eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div></header>`;
}

function metric(label, value, note) {
  return `<section class="launch-panel launch-metric"><span class="launch-metric-label"><i class="launch-metric-dot" aria-hidden="true"></i>${escapeHtml(label)}</span><strong class="launch-metric-value">${escapeHtml(value)}</strong><span class="launch-metric-note">${escapeHtml(note)}</span></section>`;
}

function progressBar(done, total) {
  const width = total ? Math.round(Math.min(100, done / total * 100)) : 0;
  return `<div class="launch-progress" role="progressbar" aria-label="Completed analyses" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><span style="width:${width}%"></span></div>`;
}

function renderProviderCoverage(summary) {
  const providers = [
    ['openai', 'OpenAI'],
    ['perplexity', 'Perplexity'],
  ];
  return providers.map(([id, label]) => {
    const provider = summary?.providers?.[id] || { total: 0, completed: 0, failed: 0 };
    return `<div class="launch-provider"><strong>${label}</strong>${progressBar(provider.completed, provider.total)}<span class="launch-muted">${provider.completed} / ${provider.total}${provider.failed ? ` · ${provider.failed} failed` : ''}</span></div>`;
  }).join('');
}

function renderStageCoverage(summary) {
  return ['discovery','comparison','decision'].map((stage) => {
    const row = summary?.stages?.[stage] || { total: 0, mentioned: 0, recommended: 0 };
    const percent = row.total ? Math.round(row.mentioned / row.total * 100) : 0;
    return `<div class="launch-stage"><strong class="launch-stage-name">${stage}</strong><div class="launch-stage-bar" role="progressbar" aria-label="${stage} mention rate" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div><span class="launch-stage-count">${row.mentioned} mentioned · ${row.recommended} recommended</span></div>`;
  }).join('');
}

function renderCompetitors(evidence = [], company) {
  const names = company?.profile?.competitors || [];
  if (!names.length) return `<div class="launch-empty"><strong>No competitor context yet</strong>Add likely alternatives to your company profile to compare how they appear in buyer answers.</div>`;
  const rows = names.map(({ name }) => {
    const counts = { mentioned: 0, shortlisted: 0, recommended: 0 };
    for (const item of evidence) {
      const state = item.competitorStates?.[name];
      if (state && state !== 'absent') counts[state] = (counts[state] || 0) + 1;
    }
    return `<div class="launch-provider"><strong>${escapeHtml(name)}</strong><span class="launch-muted">${counts.mentioned + counts.shortlisted + counts.recommended} mentions across answers</span><span class="launch-tag">${counts.recommended + counts.shortlisted} recommended</span></div>`;
  }).join('');
  return rows;
}

function renderEvidence(evidence = []) {
  const items = evidence.filter((item) => item.answer).slice(0, 8);
  if (!items.length) return `<div class="launch-empty"><strong>No answers to review yet</strong>Question responses and citations will appear here as the first run finishes.</div>`;
  return items.map((item) => {
    const citations = (item.citations || []).slice(0, 4).map((citation) => `<a href="${escapeHtml(citation.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(citation.domain || citation.title || 'Source')}</a>`).join('');
    return `<article class="launch-evidence"><div class="launch-evidence-question">${escapeHtml(item.question)}</div><p class="launch-evidence-answer">${escapeHtml(item.answer)}</p><div class="launch-evidence-meta"><span class="launch-tag">${escapeHtml(item.provider)}</span><span class="launch-tag">${escapeHtml(item.classification || 'not classified')}</span>${item.region ? `<span class="launch-tag">${escapeHtml(item.region)}</span>` : ''}</div>${citations ? `<div class="launch-citations" aria-label="Citations">${citations}</div>` : ''}</article>`;
  }).join('');
}

function renderOverview(data) {
  setPageTitle('Overview');
  const run = data.latestRun;
  const summary = data.summary;
  const running = run && ['queued','running'].includes(run.status);
  const completed = summary?.completed || 0;
  const total = summary?.total || 0;
  const stageAnswers = summary ? Object.values(summary.stages).reduce((sum, stage) => sum + stage.total, 0) : 0;
  let runCard;
  if (!run) {
    runCard = `<section class="launch-run-card"><div><h2>Your first analysis is ready to run</h2><p>We’ll ask ${data.questions.length} approved buyer questions across OpenAI and Perplexity, then show the answers and sources here.</p></div><button class="button primary" type="button" data-run-analysis>Run first analysis</button></section>`;
  } else {
    const sentence = running
      ? `${completed} of ${total} provider answers are ready. This page refreshes while the run is working.`
      : run.status === 'failed'
        ? 'The run could not complete. Review provider setup and try again.'
        : `${completed} of ${total} provider answers completed${run.status === 'partial' ? '; failed probes are marked in coverage.' : '.'}`;
    runCard = `<section class="launch-run-card"><div><h2>${run.status === 'completed' ? 'Your first analysis is complete' : running ? 'Analysis in progress' : statusLabel(run.status)}</h2><p>${escapeHtml(sentence)}<br />Last run: ${escapeHtml(formatDate(run.completed_at || run.created_at))}</p></div><div class="launch-button-row">${running ? `<span class="launch-status running">${escapeHtml(statusLabel(run.status))}</span>` : `<button class="button primary" type="button" data-run-analysis>${run.status === 'partial' || run.status === 'failed' ? 'Run analysis again' : 'Run again'}</button>`}</div></section>`;
  }
  const share = summary?.recommendationShare === null || summary?.recommendationShare === undefined ? '—' : `${Math.round(summary.recommendationShare * 100)}%`;
  const mentions = summary ? `${summary.mentions} / ${completed}` : '—';
  const citations = summary ? String(summary.citationCount) : '—';
  const pendingNote = total ? `${completed} of ${total} answers available` : 'No analysis has run yet';
  main.innerHTML = `${pageHeading(data.company?.name || 'Overview', 'See when AI answers surface your brand, which sources support those answers, and how results differ by buyer stage.')}
    ${runCard}
    <div class="launch-grid metrics">${metric('Recommended or shortlisted', share, completed ? 'Rule-based signal; review provider answers below' : pendingNote)}${metric('Brand mentions', mentions, 'Answers that name your company')}${metric('Citations', citations, 'Sources returned with provider answers')}</div>
    <div class="launch-grid two">
      <section class="launch-panel"><div class="launch-panel-heading"><div><h2>Provider coverage</h2><p>Answer coverage from the latest run.</p></div>${run ? `<span class="launch-status ${statusClass(run.status)}">${escapeHtml(statusLabel(run.status))}</span>` : ''}</div>${summary ? renderProviderCoverage(summary) : `<div class="launch-empty"><strong>Waiting for your first run</strong>OpenAI and Perplexity coverage will appear here.</div>`}</section>
      <section class="launch-panel"><div class="launch-panel-heading"><div><h2>Buyer-stage signals</h2><p>Brand mentions across Discovery, Comparison, and Decision questions.</p></div></div>${summary && stageAnswers ? renderStageCoverage(summary) : `<div class="launch-empty"><strong>No stage results yet</strong>Signals are grouped by the stage of each approved buyer question.</div>`}</section>
      <section class="launch-panel"><div class="launch-panel-heading"><div><h2>Competitor context</h2><p>How tracked alternatives appear in the same answers.</p></div></div><div class="launch-list">${renderCompetitors(data.evidence || [], data.company)}</div></section>
      <section class="launch-panel"><div class="launch-panel-heading"><div><h2>Recent answers</h2><p>Provider responses with their source links.</p></div><a class="text-button" href="/app/questions/">View questions</a></div><div class="launch-list">${renderEvidence(data.evidence || [])}</div></section>
      <section class="launch-panel"><div class="launch-panel-heading"><div><h2>Opportunities</h2><p>Evidence-backed actions for your team.</p></div><a class="text-button" href="/app/opportunities/">Open page</a></div>${data.opportunities?.length ? `<div class="launch-list">${data.opportunities.map((item) => `<article class="launch-evidence"><strong>${escapeHtml(item.title)}</strong><div class="launch-evidence-meta"><span class="launch-tag">${escapeHtml(item.status)}</span></div></article>`).join('')}</div>` : `<div class="launch-empty"><strong>No opportunities to review yet</strong>There isn’t enough measured evidence to suggest a next step. This section will fill in when the analysis produces evidence-backed opportunities.</div>`}</section>
      <section class="launch-panel"><div class="launch-panel-heading"><div><h2>Question set</h2><p>${data.questions.length} approved questions across three buyer stages.</p></div><a class="text-button" href="/app/questions/">Review questions</a></div><div class="launch-list">${renderStageCoverage(summary)}</div></section>
    </div>`;
  bindRunButton();
  if (running) scheduleRefresh();
}

function renderQuestionPage(data) {
  setPageTitle('Questions');
  const groups = ['discovery','comparison','decision'];
  const evidenceByQuestion = new Map((data.evidence || []).map((item) => [item.question, item]));
  main.innerHTML = `${pageHeading('Buyer questions', 'The approved questions behind your latest provider analysis. Edit them in onboarding before a future run.', 'Measurement')}
    <section class="launch-panel"><div class="launch-panel-heading"><div><h2>${data.questions.length} active questions</h2><p>Each approved question is sent to both providers in a baseline run.</p></div></div>
    ${groups.map((stage) => `<div class="launch-panel-heading" style="margin:24px 0 8px"><div><h2 style="text-transform:capitalize">${stage}</h2></div></div><div class="launch-list">${data.questions.filter((question) => question.stage === stage).map((question) => {
      const result = evidenceByQuestion.get(question.text);
      return `<article class="launch-evidence"><div class="launch-evidence-question">${escapeHtml(question.text)}</div><div class="launch-evidence-meta" style="margin-top:8px"><span class="launch-tag">${result ? `${escapeHtml(result.provider)} · ${escapeHtml(result.classification || result.status)}` : 'Awaiting next run'}</span>${result?.citations?.length ? `<span class="launch-tag">${result.citations.length} citations</span>` : ''}</div></article>`;
    }).join('') || `<div class="launch-empty">No ${stage} questions yet.</div>`}</div>`).join('')}</section>`;
}

function renderOpportunityPage(data) {
  setPageTitle('Opportunities');
  const rows = data.opportunities || [];
  main.innerHTML = `${pageHeading('Opportunities', 'Evidence-backed improvements based on the answers your approved buyer questions receive.', 'Your next moves')}
    <section class="launch-panel"><div class="launch-panel-heading"><div><h2>Recommended actions</h2><p>Suggestions are shown only when there is supporting measurement evidence.</p></div></div>${rows.length ? `<div class="launch-list">${rows.map((item) => `<article class="launch-evidence"><strong>${escapeHtml(item.title)}</strong><p class="launch-evidence-answer">${escapeHtml(item.suggested_change?.summary || item.suggested_change?.description || 'Review the supporting evidence for this opportunity.')}</p><div class="launch-evidence-meta"><span class="launch-tag">${escapeHtml(item.status)}</span></div></article>`).join('')}</div>` : `<div class="launch-empty"><strong>No evidence-backed opportunities yet</strong>Opportunities remain empty until the analysis produces enough evidence to support a useful action.</div>`}</section>`;
}

function renderWebsiteStep() {
  setPageTitle('Add your website');
  const website = product.data.company?.website || '';
  return `${onboardingHeading(1, 'Start with your website', 'We’ll read the public website and prepare a company profile you can review before anything is measured.')}
    <section class="launch-panel"><form id="website-form" class="launch-form" novalidate><div class="launch-field"><label for="website">Company website</label><div class="launch-input-row"><input id="website" name="website" type="text" inputmode="url" placeholder="example.com" autocomplete="url" required maxlength="500" value="${escapeHtml(website)}" /><button class="button primary" type="submit">Analyze website</button></div><small>Use a public HTTPS site. Mentionloom analyzes a single page and won’t change anything on your site.</small></div><p class="launch-inline-error" data-form-error role="alert" hidden></p></form></section></div>`;
}

function onboardingHeading(step, title, description) {
  const current = Math.min(3, step);
  return `<div class="launch-onboarding">${pageHeading(title, description, `Onboarding · Step ${step} of 3`)}<div class="launch-steps" aria-label="Onboarding progress">${[1,2,3].map((index) => `<span class="launch-step ${index < current ? 'done' : ''} ${index === current ? 'active' : ''}" aria-hidden="true"></span>`).join('')}</div>`;
}

function textareaField(name, label, value, help = '') {
  const content = Array.isArray(value) ? value.join('\n') : String(value || '');
  return `<div class="launch-field"><label for="profile-${name}">${escapeHtml(label)}</label><textarea id="profile-${name}" name="${escapeHtml(name)}">${escapeHtml(content)}</textarea>${help ? `<small>${escapeHtml(help)}</small>` : ''}</div>`;
}

function renderProfileStep(company) {
  setPageTitle('Confirm your company profile');
  const profile = company?.profile || {};
  const competitorText = (profile.competitors || []).map((item) => `${item.name}${item.website ? ` | ${item.website}` : ''}`).join('\n');
  return `${onboardingHeading(2, 'Review your company profile', 'We drafted this from the website. Correct anything that is missing before we generate buyer questions.')}
    <section class="launch-panel"><form id="profile-form" class="launch-form" novalidate>
      <div class="launch-profile-grid">
        <div class="launch-field"><label for="profile-name">Company name</label><input id="profile-name" name="name" required maxlength="120" value="${escapeHtml(company?.name || '')}" /></div>
        <div class="launch-field"><label for="profile-website">Website</label><input id="profile-website" name="website" type="url" required value="${escapeHtml(company?.website || '')}" /></div>
        <div class="launch-field"><label for="profile-category">Category</label><input id="profile-category" name="category" maxlength="180" value="${escapeHtml(profile.category || '')}" /></div>
        ${textareaField('products','Products',profile.products)}
        ${textareaField('services','Services',profile.services)}
        ${textareaField('useCases','Use cases',profile.useCases)}
        ${textareaField('targetAudiences','Target audiences',profile.targetAudiences)}
        ${textareaField('markets','Countries or markets',profile.markets)}
        ${textareaField('languages','Languages',profile.languages)}
        ${textareaField('keyClaims','Key claims',profile.keyClaims)}
        ${textareaField('pricingHints','Pricing hints',profile.pricingHints)}
        <div class="launch-field wide"><label for="profile-competitors">Likely competitors</label><textarea id="profile-competitors" name="competitors">${escapeHtml(competitorText)}</textarea><small>One per line. Optional website after a vertical bar, for example: Example Co | https://example.com</small></div>
      </div>
      <p class="launch-inline-error" data-form-error role="alert" hidden></p>
      <div class="launch-button-row"><button class="button primary" type="submit">Confirm profile and continue</button></div>
    </form></section></div>`;
}

function renderQuestionStep(data) {
  setPageTitle('Review buyer questions');
  const questions = data.questions || [];
  const groups = ['discovery','comparison','decision'];
  if (!questions.length) {
    return `${onboardingHeading(3, 'Build your question set', 'We’ll draft 24 buyer questions from your confirmed company profile. You can review and edit every question.')}
      <section class="launch-panel"><p class="launch-muted" style="margin:0">24 questions, balanced across Discovery, Comparison, and Decision.</p><p class="launch-inline-error" data-form-error role="alert" hidden></p><div class="launch-button-row"><button class="button primary" type="button" data-generate-questions>Generate buyer questions</button></div></section></div>`;
  }
  let index = 0;
  const list = groups.map((stage) => `<h3 class="launch-section-kicker">${stage}</h3>${questions.filter((question) => question.stage === stage).map((question) => {
    index += 1;
    return `<div class="launch-question-row" data-question-row><div class="launch-question-index">Question ${index}<input type="hidden" name="questionId" value="${escapeHtml(question.id)}" /><select name="stage" aria-label="Question ${index} stage">${groups.map((option) => `<option value="${option}" ${option === question.stage ? 'selected' : ''}>${option[0].toUpperCase()}${option.slice(1)}</option>`).join('')}</select></div><textarea name="text" aria-label="Question ${index}" required minlength="12" maxlength="280">${escapeHtml(question.text)}</textarea></div>`;
  }).join('')}`).join('');
  return `${onboardingHeading(3, 'Review buyer questions', 'These questions cover Discovery, Comparison, and Decision. Edit them to sound like the way your buyers actually search.')}
    <section class="launch-panel"><div class="launch-panel-heading"><div><h2>${questions.length} draft questions</h2><p>Keep 20–25 questions and at least four in each stage.</p></div></div>
      <form id="questions-form"><div class="launch-question-list">${list}</div><p class="launch-inline-error" data-form-error role="alert" hidden></p><div class="launch-button-row"><button class="button ghost" type="button" data-generate-questions>Regenerate draft</button><button class="button" type="button" data-save-questions>Save draft</button><button class="button primary" type="submit">Approve questions</button></div></form>
    </section></div>`;
}

function renderOnboarding(data) {
  nav.hidden = true;
  const step = data.workspace.onboarding_step;
  const confirmed = Boolean(data.workspace.onboarding_profile_confirmed_at);
  let markup;
  if (step === 'website' || !data.company) markup = renderWebsiteStep();
  else if (step === 'profile' || !confirmed) markup = renderProfileStep(data.company);
  else markup = renderQuestionStep(data);
  main.innerHTML = markup;
  bindOnboarding();
}

function profileFromForm(form) {
  const formData = new FormData(form);
  const list = (name) => String(formData.get(name) || '').split(/\n+/).map((value) => value.trim()).filter(Boolean);
  const competitors = list('competitors').map((line) => {
    const [name, website = ''] = line.split('|', 2).map((value) => value.trim());
    return { name, website };
  }).filter((item) => item.name);
  return {
    name: formData.get('name'),
    website: formData.get('website'),
    profile: {
      category: formData.get('category'),
      products: list('products'), services: list('services'), useCases: list('useCases'),
      targetAudiences: list('targetAudiences'), markets: list('markets'), languages: list('languages'),
      keyClaims: list('keyClaims'), pricingHints: list('pricingHints'), competitors,
    },
  };
}

function questionSetFromForm(form) {
  return [...form.querySelectorAll('[data-question-row]')].map((row) => ({
    id: row.querySelector('[name=questionId]').value || null,
    stage: row.querySelector('[name=stage]').value,
    text: row.querySelector('[name=text]').value,
  }));
}

async function refreshProduct({ renderPage = true } = {}) {
  const result = await api('/api/product');
  product = { workspace: result.workspace, data: result.data };
  document.querySelector('#workspace-name').textContent = result.workspace.name;
  document.querySelector('#workspace-name').hidden = false;
  attachSignOut();
  if (renderPage) {
    nav.hidden = route === 'onboarding';
    if (route === 'onboarding') renderOnboarding(product.data);
    else if (route === 'questions') renderQuestionPage(product.data);
    else if (route === 'opportunities') renderOpportunityPage(product.data);
    else renderOverview(product.data);
  }
  setBusy(false);
  return product;
}

function bindOnboarding() {
  const websiteForm = document.querySelector('#website-form');
  websiteForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!websiteForm.reportValidity()) return;
    const button = websiteForm.querySelector('button[type=submit]');
    const error = websiteForm.querySelector('[data-form-error]');
    error.hidden = true;
    button.disabled = true;
    button.textContent = 'Reading your website…';
    try {
      await api('/api/onboarding/analyze', { method: 'POST', body: { website: new FormData(websiteForm).get('website') } });
      await refreshProduct();
    } catch (error) {
      renderError(websiteForm, error);
      button.disabled = false;
      button.textContent = 'Analyze website';
    }
  });

  const profileForm = document.querySelector('#profile-form');
  profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!profileForm.reportValidity()) return;
    const button = profileForm.querySelector('button[type=submit]');
    const error = profileForm.querySelector('[data-form-error]');
    error.hidden = true;
    button.disabled = true;
    button.textContent = 'Saving profile…';
    try {
      await api('/api/onboarding/profile', { method: 'PUT', body: { company: profileFromForm(profileForm), confirmed: true } });
      await refreshProduct();
    } catch (error) {
      renderError(profileForm, error);
      button.disabled = false;
      button.textContent = 'Confirm profile and continue';
    }
  });

  for (const button of document.querySelectorAll('[data-generate-questions]')) {
    button.addEventListener('click', async () => {
      const error = document.querySelector('[data-form-error]');
      if (error) error.hidden = true;
      button.disabled = true;
      button.textContent = button.textContent.includes('Regenerate') ? 'Regenerating…' : 'Generating questions…';
      try {
        await api('/api/onboarding/questions', { method: 'POST', body: {} });
        await refreshProduct();
      } catch (error) {
        const form = document.querySelector('#questions-form') || document.querySelector('.launch-panel');
        renderError(form, error);
        button.disabled = false;
        button.textContent = 'Generate buyer questions';
      }
    });
  }

  const questionsForm = document.querySelector('#questions-form');
  document.querySelector('[data-save-questions]')?.addEventListener('click', () => saveQuestions(questionsForm, false));
  questionsForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (questionsForm.reportValidity()) saveQuestions(questionsForm, true);
  });
}

async function saveQuestions(form, approve) {
  const error = form.querySelector('[data-form-error]');
  error.hidden = true;
  const buttons = [...form.querySelectorAll('button')];
  buttons.forEach((button) => { button.disabled = true; });
  try {
    const result = await api('/api/onboarding/questions', {
      method: 'PUT', body: { questions: questionSetFromForm(form), approve },
    });
    if (approve && result.approved) location.assign('/app/overview/');
    else await refreshProduct();
  } catch (error) {
    renderError(form, error);
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function bindRunButton() {
  document.querySelector('[data-run-analysis]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Starting…';
    try {
      await api('/api/analysis/run', { method: 'POST', body: {} });
      await refreshProduct();
      showToast('Your analysis is queued. Results will appear here as answers finish.');
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Run first analysis';
      showToast(error.message);
    }
  });
}

function scheduleRefresh() {
  if (polling) return;
  polling = true;
  setTimeout(async () => {
    polling = false;
    if (!document.hidden && ['overview','opportunities'].includes(route)) {
      try { await refreshProduct(); } catch (error) { showToast(error.message); }
    }
  }, 6000);
}

async function start() {
  setBusy(true);
  if (['sign-in','sign-up','forgot-password','reset-password'].includes(route)) {
    try {
      const session = await api('/api/auth/session');
      if (route === 'reset-password') {
        if (!session.authenticated) {
          location.replace('/app/sign-in/');
          return;
        }
        renderResetPassword();
        setBusy(false);
        return;
      }
      if (session.authenticated) {
        const next = new URLSearchParams(location.search).get('next');
        location.replace(next?.startsWith('/app/') && !next.startsWith('//') ? next : '/app/overview/');
        return;
      }
    } catch {}
    if (route === 'forgot-password') renderForgotPassword();
    else renderAuth(route);
    setBusy(false);
    return;
  }
  try {
    await refreshProduct();
  } catch (error) {
    main.innerHTML = `${pageHeading('We couldn’t load your workspace', 'The workspace service could not return its current setup. Please retry in a moment.')}
      <section class="launch-panel"><div class="launch-inline-error" role="alert">${escapeHtml(error.message)}</div><div class="launch-button-row"><button class="button primary" type="button" id="retry-load">Try again</button></div></section>`;
    document.querySelector('#retry-load').addEventListener('click', () => { location.reload(); });
    setBusy(false);
  }
}

start();
