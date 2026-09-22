const PROVIDER_ENV = Object.freeze({
  openai: 'OPENAI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
});

let runtimeEnv = null;

export function configureProviderEnv(env = null) {
  runtimeEnv = env;
}

function envValue(name) {
  if (runtimeEnv && runtimeEnv[name]) return runtimeEnv[name];
  if (typeof process !== 'undefined' && process?.env?.[name]) return process.env[name];
  return null;
}

export function providerSecret(provider) {
  const envName = PROVIDER_ENV[provider];
  if (!envName) throw new Error(`Unsupported provider: ${provider}`);
  return envValue(envName);
}

export function configuredProviders() {
  return Object.entries(PROVIDER_ENV)
    .filter(([, envName]) => Boolean(envValue(envName)))
    .map(([provider]) => provider);
}

export function providerConfiguration() {
  return Object.fromEntries(
    Object.keys(PROVIDER_ENV).map((provider) => [provider, Boolean(providerSecret(provider))]),
  );
}
