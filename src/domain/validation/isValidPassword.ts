const MIN_LENGTH = 10;

function isValidPassword(password) {
  if (typeof password !== 'string') return false;
  if (password.length < MIN_LENGTH) return false;
  if (!/[a-zA-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

export { isValidPassword, MIN_LENGTH };
