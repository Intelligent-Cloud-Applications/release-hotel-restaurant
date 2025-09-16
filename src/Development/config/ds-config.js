import institutionData from "../constants";

export const dsDev = {
    Auth: {
        mandatorySignIn: true,
        region: 'us-east-2',
        userPoolId: process.env.REACT_APP_DEV_USER_POOL_ID,
        identityPoolId: process.env.REACT_APP_DEV_IDENTITY_POOL_ID,
        userPoolWebClientId: process.env.REACT_APP_DEV_CLIENT_ID,
        oauth: {
            domain: process.env.REACT_APP_AUTH_DOMAIN_BETA,
            scope: ['openid', 'email', 'profile'],
            redirectSignIn: process.env.NODE_ENV === 'development' ?
              'http://localhost:3000/redirect' : institutionData.BETA_DOMAIN + '/redirect',
            redirectSignOut: process.env.NODE_ENV === 'development' ?
              'http://localhost:3000' : institutionData.BETA_DOMAIN,
            responseType: 'code',
        }
    },
    Storage: {
        region: "us-east-1",
        bucket: "institution-utils",
        identityPoolId:process.env.REACT_APP_DEV_IDENTITY_POOL_ID
         
       
      },
    API: {
        endpoints: [
            {
                name: 'main',
                endpoint: 'https://7irwe2hmkj.execute-api.us-east-2.amazonaws.com/dev',
                region: 'us-east-2',
            }
        ]
    }
}
export const dsProd = {
    Auth: {
        mandatorySignIn: true,
        region: 'us-east-1',
        userPoolId: process.env.REACT_APP_PROD_USER_POOL_ID,
        identityPoolId: process.env.REACT_APP_PROD_IDENTITY_POOL_ID,
        userPoolWebClientId: process.env.REACT_APP_PROD_CLIENT_ID,
        oauth: {
            domain: process.env.REACT_APP_AUTH_DOMAIN_PROD,
            scope: ['openid', 'email', 'profile'],
            redirectSignIn: process.env.NODE_ENV === 'development' ?
              'http://localhost:3000/redirect' : institutionData.PROD_DOMAIN + '/redirect',
            redirectSignOut: process.env.NODE_ENV === 'development' ?
              'http://localhost:3000' : institutionData.PROD_DOMAIN,
            responseType: 'code',
        }
    },
    Storage: {
        region: 'us-east-1',
        bucket: 'institution-utils',
        identityPoolId: process.env.REACT_APP_PROD_IDENTITY_POOL_ID,
    },
    API: {
        endpoints: [
            {
                name: 'main',
                endpoint: 'https://ilqbk6cpwl.execute-api.us-east-1.amazonaws.com/prod',
                region: 'us-east-1',
            },
            {
                name: 'hotelHouseKeeping',
                endpoint: 'https://aj3jjl9pkb.execute-api.us-east-1.amazonaws.com/prod',
                region: 'us-east-1',
            },
        ]
    }
}

