function notImplemented(className, methodName) {
  throw new Error(`${className}.${methodName}() must be implemented by a concrete repository`);
}

export { notImplemented };
