import { ClassifiedModel, ComboTier, ModelCategory, RecommendedCombo } from './types.js';

export function isReasoningModel(modelId: string): boolean {
  return /(o1|o3|reasoner|deepseek-r|thinking|qwq)/i.test(modelId);
}

export function isCodingModel(modelId: string): boolean {
  return /(sonnet|opus|gpt-4o(?!-mini)|deepseek-chat|deepseek-v3|qwen.*coder|codestral|command-r|gemini-1\.5-pro|gemini-2\.5-pro)/i.test(modelId);
}

export function isSpeedModel(modelId: string): boolean {
  return /(haiku|flash|mini|groq|llama.*8b|qwen.*7b|cerebras|fast)/i.test(modelId);
}

export function isBudgetModel(modelId: string): boolean {
  return /(deepseek|flash|mini|qwen|llama|glm|free|mistral|haiku)/i.test(modelId);
}

export function classifyModel(modelId: string, avgLatencyMs: number = 0): ClassifiedModel {
  // 1. Deep Reasoning (OpenAI o1/o3, DeepSeek-R1, QwQ, etc.)
  if (isReasoningModel(modelId)) {
    return {
      model: modelId,
      category: 'reasoning',
      categoryName: 'Deep Reasoning',
      icon: '🧠',
      avgLatencyMs
    };
  }

  // 2. Coding Pro (Sonnet, Opus, GPT-4o, DeepSeek-V3/Chat, Qwen-Coder, Codestral)
  if (isCodingModel(modelId)) {
    return {
      model: modelId,
      category: 'coding',
      categoryName: 'Coding Pro',
      icon: '💻',
      avgLatencyMs
    };
  }

  // 3. Speed & Autocomplete (Haiku, Flash, Mini, Groq, 7b/8b, Fast)
  if (isSpeedModel(modelId)) {
    return {
      model: modelId,
      category: 'speed',
      categoryName: 'Speed/Autocomplete',
      icon: '⚡',
      avgLatencyMs
    };
  }

  // 4. Budget / Saver (DeepSeek, Gemini Flash, Mini, Qwen, Llama, GLM, Free)
  if (isBudgetModel(modelId)) {
    return {
      model: modelId,
      category: 'budget',
      categoryName: 'Budget Saver',
      icon: '💰',
      avgLatencyMs
    };
  }

  // 5. Default General
  return {
    model: modelId,
    category: 'general',
    categoryName: 'General AI',
    icon: '🤖',
    avgLatencyMs
  };
}

export function formatModelLabel(modelId: string, avgLatencyMs?: number): string {
  const info = classifyModel(modelId, avgLatencyMs);
  const latencyStr = avgLatencyMs && avgLatencyMs > 0 ? ` (${avgLatencyMs}ms)` : '';
  return `${info.icon} [${info.categoryName}] ${modelId}${latencyStr}`;
}

export function buildRecommendedCombos(
  activeModels: Array<{ model: string; avgLatencyMs: number }>
): RecommendedCombo[] {
  if (!activeModels || activeModels.length === 0) {
    return [];
  }

  const classified = activeModels.map(m => classifyModel(m.model, m.avgLatencyMs));

  const sortByLatency = (a: ClassifiedModel, b: ClassifiedModel) =>
    (a.avgLatencyMs || 9999) - (b.avgLatencyMs || 9999);

  // Helper to pick unique models for a combo chain using matching predicates
  function pickTiers(
    isPrimaryMatch: (id: string) => boolean,
    isSecondaryMatch: (id: string) => boolean,
    sortMode: 'quality' | 'latency' = 'quality'
  ): ComboTier[] {
    const tiers: ComboTier[] = [];
    const used = new Set<string>();

    // Primary Tier
    let primaryCandidates = classified.filter(m => isPrimaryMatch(m.model));
    if (sortMode === 'latency') {
      primaryCandidates = [...primaryCandidates].sort(sortByLatency);
    }

    const primary = primaryCandidates[0] || (classified[0] as ClassifiedModel);
    if (primary) {
      tiers.push({
        tier: 1,
        tierName: 'Tier 1 (Primary)',
        model: primary.model,
        avgLatencyMs: primary.avgLatencyMs
      });
      used.add(primary.model);
    }

    // Secondary Tier (Fallback)
    let secondaryCandidates = classified.filter(
      m => !used.has(m.model) && (isSecondaryMatch(m.model) || isPrimaryMatch(m.model))
    );
    if (secondaryCandidates.length === 0) {
      secondaryCandidates = classified.filter(m => !used.has(m.model));
    }
    if (sortMode === 'latency') {
      secondaryCandidates = [...secondaryCandidates].sort(sortByLatency);
    }

    const secondary = secondaryCandidates[0];
    if (secondary) {
      tiers.push({
        tier: 2,
        tierName: 'Tier 2 (Fallback)',
        model: secondary.model,
        avgLatencyMs: secondary.avgLatencyMs
      });
      used.add(secondary.model);
    }

    // Tertiary Tier (Emergency)
    let emergencyCandidates = classified.filter(m => !used.has(m.model));
    emergencyCandidates = [...emergencyCandidates].sort(sortByLatency);

    const emergency = emergencyCandidates[0];
    if (emergency) {
      tiers.push({
        tier: 3,
        tierName: 'Tier 3 (Emergency)',
        model: emergency.model,
        avgLatencyMs: emergency.avgLatencyMs
      });
      used.add(emergency.model);
    }

    return tiers;
  }

  const combos: RecommendedCombo[] = [];

  // 1. Coding Pro Combo
  const codingTiers = pickTiers(isCodingModel, isReasoningModel, 'quality');
  if (codingTiers.length > 0) {
    combos.push({
      id: 'coding-pro',
      name: 'Coding Pro Combo',
      description: 'Prioritas akurasi kode (Cursor/Cline) dengan fallback otomatis saat rate limit',
      icon: '🔥',
      modelChain: codingTiers.map(t => t.model),
      tiers: codingTiers
    });
  }

  // 2. Speed & Autocomplete Combo
  const speedTiers = pickTiers(isSpeedModel, isBudgetModel, 'latency');
  if (speedTiers.length > 0) {
    combos.push({
      id: 'speed-autocomplete',
      name: 'Speed & Autocomplete Combo',
      description: 'Latensi terendah & TTFT kilat untuk tab-completion dan refactoring cepat',
      icon: '⚡',
      modelChain: speedTiers.map(t => t.model),
      tiers: speedTiers
    });
  }

  // 3. Deep Reasoning Combo
  const reasoningTiers = pickTiers(isReasoningModel, isCodingModel, 'quality');
  if (reasoningTiers.length > 0) {
    combos.push({
      id: 'deep-reasoning',
      name: 'Deep Reasoning Combo',
      description: 'Khusus debugging logika rumit, arsitektur sistem, dan matematika',
      icon: '🧠',
      modelChain: reasoningTiers.map(t => t.model),
      tiers: reasoningTiers
    });
  }

  // 4. Budget Saver Combo
  const budgetTiers = pickTiers(isBudgetModel, isSpeedModel, 'latency');
  if (budgetTiers.length > 0) {
    combos.push({
      id: 'budget-saver',
      name: 'Budget Saver Combo',
      description: 'Memaksimalkan efisiensi token harian menggunakan model hemat & aktif',
      icon: '💰',
      modelChain: budgetTiers.map(t => t.model),
      tiers: budgetTiers
    });
  }

  return combos;
}
