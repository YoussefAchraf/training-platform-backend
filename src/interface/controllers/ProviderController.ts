class ProviderController {
  createProviderUseCase: any;
  listProvidersUseCase: any;
  updateProviderUseCase: any;
  deleteProviderUseCase: any;

  constructor({ createProviderUseCase, listProvidersUseCase, updateProviderUseCase, deleteProviderUseCase }) {
    this.createProviderUseCase = createProviderUseCase;
    this.listProvidersUseCase = listProvidersUseCase;
    this.updateProviderUseCase = updateProviderUseCase;
    this.deleteProviderUseCase = deleteProviderUseCase;
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

  update = async (req, res) => {
    try {
      const { name, description } = req.body;
      const provider = await this.updateProviderUseCase.execute({
        requester: req.user,
        providerId: Number(req.params.id),
        name,
        description,
      });
      res.status(200).json(provider);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  remove = async (req, res) => {
    try {
      await this.deleteProviderUseCase.execute({ requester: req.user, providerId: Number(req.params.id) });
      res.status(204).send();
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { ProviderController };
