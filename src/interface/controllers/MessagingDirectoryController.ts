class MessagingDirectoryController {
  listReachablePeopleUseCase: any;

  constructor({ listReachablePeopleUseCase }) {
    this.listReachablePeopleUseCase = listReachablePeopleUseCase;
  }

  list = async (req, res) => {
    try {
      const people = await this.listReachablePeopleUseCase.execute({ requester: req.user, search: req.query.search });
      res.status(200).json(people);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

export { MessagingDirectoryController };
