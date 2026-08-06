import webpush from 'web-push';

class WebPushService {
  configured: boolean;

  constructor() {
    const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
    this.configured = Boolean(VAPID_SUBJECT && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
    
    
    
    
    
    if (this.configured) {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    }
  }

  async send(subscription, payload) {
    if (!this.configured) {
      throw new Error('Push notifications are not configured (VAPID_* env vars missing)');
    }
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    };
    try {
      await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    } catch (err: any) {
      
      
      
      if (err.statusCode === 404 || err.statusCode === 410) {
        throw Object.assign(new Error('Push subscription expired'), { expired: true });
      }
      throw err;
    }
  }
}

export { WebPushService };
