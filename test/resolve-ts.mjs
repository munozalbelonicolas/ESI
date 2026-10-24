// Las funciones de api/ importan './x.js' (lo que Vercel ejecuta tras compilar);
// en los tests corren como .ts con strip-types, así que se resuelve al .ts hermano.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error?.code === 'ERR_MODULE_NOT_FOUND' && /^\.\.?\/.*\.js$/.test(specifier)) {
        return nextResolve(specifier.replace(/\.js$/, '.ts'), context);
      }
      throw error;
    }
  },
});
