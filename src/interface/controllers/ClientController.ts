class ClientController {
  createClientUseCase: any;
  listClientsUseCase: any;
  updateClientUseCase: any;
  deleteClientUseCase: any;

  constructor({ createClientUseCase, listClientsUseCase, updateClientUseCase, deleteClientUseCase }) {
    this.createClientUseCase = createClientUseCase;
    this.listClientsUseCase = listClientsUseCase;
    this.updateClientUseCase = updateClientUseCase;
    this.deleteClientUseCase = deleteClientUseCase;
  }

  create = async (req, res) => {
    try {
      const { companyName, email, phone, country } = req.body;
      const client = await this.createClientUseCase.execute({ requester: req.user, companyName, email, phone, country });
      res.status(201).json(client);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  list = async (req, res) => {
    try {
      const clients = await this.listClientsUseCase.execute();
      res.status(200).json(clients);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  update = async (req, res) => {
    try {
      const { companyName, email, phone, country } = req.body;
      const client = await this.updateClientUseCase.execute({
        requester: req.user,
        clientId: Number(req.params.id),
        companyName,
        email,
        phone,
        country,
      });
      res.status(200).json(client);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  remove = async (req, res) => {
    try {
      await this.deleteClientUseCase.execute({ requester: req.user, clientId: Number(req.params.id) });
      res.status(204).send();
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { ClientController };
