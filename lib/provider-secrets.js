const PROVIDER_ENV = Object.freeze({
  openai: 'OPENAI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
});

export function providerSecret(provider) {
  const envName = PROVIDER_ENV[provider];
  if (!envName) throw new Error(`Unsupported provider: ${provider}`);
  return process.env[envName] || null;
}

export function configuredProviders() {
  return Object.entries(PROVIDER_ENV)
    .filter(([, envName]) => Boolean(process.env[envName]))
    .map(([provider]) => provider);
}

export function providerConfiguration() {
  return Object.fromEntries(
    Object.keys(PROVIDER_ENV).map((provider) => [provider, Boolean(providerSecret(provider))]),
  );
}
