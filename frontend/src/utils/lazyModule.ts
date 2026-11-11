/**
 * A library the app fetches only when it is needed could not be fetched. In development that is a dev server
 * that re-bundled its dependencies under the open page; in production it is a deploy that moved the chunk the
 * page was still pointing at. Both are fixed by reloading, and neither is "something went wrong" - so they
 * are told apart from a real failure and said in words the user can act on.
 */
export class ModuleLoadError extends Error {
  constructor(public readonly moduleName: string, cause: unknown) {
    super(`Could not load ${moduleName}`, { cause });
    this.name = 'ModuleLoadError';
  }
}

/** Loads a library on demand, naming it if it does not arrive. */
export async function loadModule<T>(moduleName: string, load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (cause) {
    throw new ModuleLoadError(moduleName, cause);
  }
}
