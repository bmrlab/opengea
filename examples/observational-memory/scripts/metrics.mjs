export function cacheUsage(calls) {
  const sum = (key) =>
    calls.every((call) => call.usage?.inputTokenDetails?.[key] != null)
      ? calls.reduce(
          (total, call) => total + call.usage.inputTokenDetails[key],
          0,
        )
      : null;
  const input = calls.every((call) => call.usage?.inputTokens != null)
    ? calls.reduce((total, call) => total + call.usage.inputTokens, 0)
    : null;
  const read = sum("cacheReadTokens");
  return {
    calls: calls.length,
    inputTokens: input,
    cacheReadTokens: read,
    cacheWriteTokens: sum("cacheWriteTokens"),
    noCacheTokens: sum("noCacheTokens"),
    cacheReadShare: input > 0 && read != null ? read / input : null,
  };
}
