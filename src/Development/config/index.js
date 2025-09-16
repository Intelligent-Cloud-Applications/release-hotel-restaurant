import { dsDev } from './ds-config';
import { dsProd } from './ds-config';
let config;

if (process.env.REACT_APP_STAGE === 'prod') {
    config = dsProd;
} else {
    config = dsDev;
}

export default config;