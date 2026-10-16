/** Clase instanciable (se usa para registrar controladores y middlewares en el contenedor). */
export interface Constructor<T = object> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): T;
}
