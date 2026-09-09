class PushController {
  subscribeToPushUseCase: any;
  unsubscribeFromPushUseCase: any;

  constructor({ subscribeToPushUseCase, unsubscribeFromPushUseCase }) {
    this.subscribeToPushUseCase = subscribeToPushUseCase;
    this.unsubscribeFromPushUseCase = unsubscribeFromPushUseCase;
  }

  subscribe = async (req, res) => {
    try {
      const { endpoint, keys, silent } = req.body;
      const subscription = await this.subscribeToPushUseCase.execute({
        requester: req.user,
        endpoint,
        keys,
        silent: Boolean(silent),
      });
      res.status(201).json(subscription);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  unsubscribe = async (req, res) => {
    try {
      const { endpoint } = req.body;
      const result = await this.unsubscribeFromPushUseCase.execute({ requester: req.user, endpoint });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { PushController };
