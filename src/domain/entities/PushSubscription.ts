class PushSubscription {
  id: any;
  userId: any;
  endpoint: any;
  p256dh: any;
  auth: any;
  createdAt: any;

  constructor({ id, userId, endpoint, p256dh, auth, createdAt }: any) {
    this.id = id;
    this.userId = userId;
    this.endpoint = endpoint;
    this.p256dh = p256dh;
    this.auth = auth;
    this.createdAt = createdAt;
  }
}

export { PushSubscription };
