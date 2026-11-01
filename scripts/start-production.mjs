import {validateProductionConfig} from './production-config.mjs';
try{
 await validateProductionConfig(process.env);
 await import('../src/bff/main.mjs');
}catch{
 // Do not log raw environment, provider errors or dynamic import diagnostics.
 process.stderr.write('Production startup refused; verify server configuration and application artifact.\n');
 process.exitCode=1;
}
