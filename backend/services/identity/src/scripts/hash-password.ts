import 'reflect-metadata';
import { ScryptPasswordHasher } from '../security/password-hasher.js';

/**
 * Genera el hash de una contraseña para usar en scripts SQL.
 *   npm run hash-password -- "MiClaveSegura"
 */
const password = process.argv[2];
if (!password) {
  console.error('Uso: npm run hash-password -- "<contraseña>"');
  process.exit(1);
}

console.log(await new ScryptPasswordHasher().hash(password));
