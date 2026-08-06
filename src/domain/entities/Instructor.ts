class Instructor {
  id: any;
  userId: any;
  bio: any;
  firstname: any;
  lastname: any;
  email: any;
  status: any;
  skills: any;

  constructor({ id, userId, bio, firstname, lastname, email, status, skills = [] }: any) {
    this.id = id;
    this.userId = userId;
    this.bio = bio;
    this.firstname = firstname;
    this.lastname = lastname;
    this.email = email;
    this.status = status;
    this.skills = skills;
  }
}

export { Instructor };
