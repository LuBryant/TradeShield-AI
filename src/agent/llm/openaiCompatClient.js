// OpenAI-compatible chat client for tool calling.
//
// Works with any provider that speaks the OpenAI /chat/completions schema:
//   - DeepSeek   (https://api.deepseek.com, model deepseek-chat)        DEEPSEEK_API_KEY
//   - Qwen       (DashScope OpenAI-compatible mode, model qwen-plus)    DASHSCOPE_API_KEY
//   - OpenAI     (https://api.openai.com/v1)                            OPENAI_API_KEY
//   - Custom     LLM_BASE_URL / LLM_API_KEY / LLM_MODEL
//
// No SDK dependency: uses the global fetch shipped with Node >= 18.
// If no key is configured, isConfigured() returns false and the caller
// should fall back to the deterministic valuation path.

const PROVIDERS = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    keyEnv: 'DEEPSEEK_API_KEY'
  },
  qwen: {
    // DashScope OpenAI-compatible endpoint.
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    keyEnv: 'DASHSCOPE_API_KEY'
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyEnv: 'OPENAI_API_KEY'
  }
};

/**
 * Resolve which provider to use from the environment.
 * Priority: explicit LLM_PROVIDER / custom LLM_* > first provider whose key is set.
 * @returns {{provider:string, baseUrl:string, model:string, apiKey:string}|null}
 */
export function resolveProvider(env = process.env) {
  // Fully custom OpenAI-compatible endpoint.
  if (env.LLM_BASE_URL && env.LLM_API_KEY) {
    return {
      provider: 'custom',
      baseUrl: env.LLM_BASE_URL.replace(/\/$/, ''),
      model: env.LLM_MODEL ?? 'gpt-4o-mini',
      apiKey: env.LLM_API_KEY
    };
  }

  const explicit = env.LLM_PROVIDER && PROVIDERS[env.LLM_PROVIDER];
  const order = explicit ? [env.LLM_PROVIDER] : Object.keys(PROVIDERS);

  for (const name of order) {
    const cfg = PROVIDERS[name];
    const apiKey = env[cfg.keyEnv];
    if (apiKey) {
      return {
        provider: name,
        baseUrl: cfg.baseUrl,
        model: env.LLM_MODEL ?? cfg.model,
        apiKey
      };
    }
  }
  return null;
}

export function isConfigured(env = process.env) {
  return resolveProvider(env) !== null;
}

/**
 * Single /chat/completions call with optional tools.
 * Returns the raw assistant message object: { role, content, tool_calls? }.
 */
export async function chatCompletion({ messages, tools, toolChoice = 'auto', temperature = 0.2, timeoutMs = 45000 }, env = process.env) {
  const cfg = resolveProvider(env);
  if (!cfg) throw new Error('No LLM provider configured. Set DEEPSEEK_API_KEY / DASHSCOPE_API_KEY / OPENAI_API_KEY or LLM_BASE_URL+LLM_API_KEY.');

  const body = { model: cfg.model, messages, temperature };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = toolChoice;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`LLM HTTP ${response.status} from ${cfg.provider}: ${text.slice(0, 500)}`);
    }

    const json = await response.json();
    const message = json.choices?.[0]?.message;
    if (!message) throw new Error(`LLM returned no message: ${JSON.stringify(json).slice(0, 500)}`);
    return message;
  } finally {
    clearTimeout(timer);
  }
}
