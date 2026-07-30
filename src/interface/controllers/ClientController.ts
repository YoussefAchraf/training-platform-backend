class ClientController {
  createClientUseCase: any;
  listClientsUseCase: any;

  constructor({ createClientUseCase, listClientsUseCase }) {
    this.createClientUseCase = createClientUseCase;
    this.listClientsUseCase = listClientsUseCase;
  }

  create = async (req, res) => {
    try {
      const { companyName, email, phone } = req.body;
      const client = await this.createClientUseCase.execute({ requester: req.user, companyName, email, phone });
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
}

export { ClientController };
