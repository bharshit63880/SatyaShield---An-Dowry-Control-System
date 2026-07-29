let revokeHandler = async () => {};
let publishHandler = async () => {};

export function registerRealtimeRevocationHandler(handler) {
  revokeHandler = typeof handler === 'function' ? handler : async () => {};
}

export async function revokeRealtimeComplaintAccess(event) {
  await revokeHandler(event);
}

export function registerRealtimePublishHandler(handler) {
  publishHandler = typeof handler === 'function' ? handler : async () => {};
}

export async function publishRealtimeCaseEvent(event) {
  await publishHandler(event);
}
