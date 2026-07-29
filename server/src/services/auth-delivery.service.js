let adapter = {
  async deliver() {
    return { state: 'skipped_not_configured' };
  }
};

export function setAuthDeliveryAdapter(nextAdapter) {
  adapter = nextAdapter;
}

export function resetAuthDeliveryAdapter() {
  adapter = { async deliver() { return { state: 'skipped_not_configured' }; } };
}

export async function deliverAuthChallenge({ purpose, recipient, token }) {
  const result = await adapter.deliver({ purpose, recipient, token });
  return {
    state: ['queued', 'sent', 'failed', 'skipped_not_configured'].includes(result?.state)
      ? result.state
      : 'failed'
  };
}
