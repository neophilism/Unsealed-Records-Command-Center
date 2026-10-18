import {createBff} from './server.mjs';

function required(name){const value=process.env[name];if(!value) throw new Error('Missing '+name);return value;}
const server=createBff({
 issuer:required('BFF_ISSUER'),audience:required('BFF_AUDIENCE'),
 jwks:JSON.parse(required('BFF_JWKS_JSON')),
 engineOrigin:required('ENGINE_ORIGIN'),engineToken:required('ENGINE_TOKEN'),
 reports:JSON.parse(required('BFF_REPORT_ROUTES_JSON'))
});
const port=Number(process.env.PORT||3000);
if(!Number.isSafeInteger(port)||port<1||port>65535) throw new Error('Invalid PORT');
server.listen(port,'0.0.0.0');
