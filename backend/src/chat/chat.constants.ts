export const MULTI_AGENT_SUMMARY_TARGET_PREFIX = '__multi_agent_summary__:';

export const buildMultiAgentSummaryTarget = (userMessageId: string) =>
  `${MULTI_AGENT_SUMMARY_TARGET_PREFIX}${userMessageId}`;
