import validator from 'validator';

function isValidEmail(email) {
  return typeof email === 'string' && validator.isEmail(email);
}

export { isValidEmail };
