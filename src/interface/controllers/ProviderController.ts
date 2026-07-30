class ProviderController {
  createProviderUseCase: any;
  listProvidersUseCase: any;

  constructor({ createProviderUseCase, listProvidersUseCase }) {
    this.createProviderUseCase = createProviderUseCase;
    this.listProvidersUseCase = listProvidersUseCase;
  }

  create = async (req, res) => {
    try {
      const { name, description } = req.body;
      const provider = await this.createProviderUseCase.execute({ requester: req.user, name, description });
      res.status(201).json(provider);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  list = async (req, res) => {
    try {
      const providers = await this.listProvidersUseCase.execute();
      res.status(200).json(providers);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { ProviderController };
