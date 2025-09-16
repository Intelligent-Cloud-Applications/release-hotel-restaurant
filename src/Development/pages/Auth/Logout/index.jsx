import { Auth } from 'aws-amplify'
import React, { useEffect } from 'react'
import institutionData from "../../../constants";

const Logout = () => {
  
  const clearCache = () => {
    try {
      localStorage.removeItem('cafeUserData');
      console.log("Cache cleared during logout");
      return true;
    } catch (error) {
      console.error("Error clearing cache during logout:", error);
      return false;
    }
  };

  useEffect(() => {
    const onLoad = async () => {
      const domain = process.env.REACT_APP_STAGE === 'prod' ?
        institutionData.BETA_DOMAIN : institutionData.BETA_DOMAIN;
      const client_id = process.env.REACT_APP_STAGE === 'prod' ?
        process.env.REACT_APP_PROD_CLIENT_ID : process.env.REACT_APP_DEV_CLIENT_ID;
      const redirect = process.env.NODE_ENV === 'development' ?
        'http://localhost:3000' : process.env.REACT_APP_STAGE === 'prod' ?
          institutionData.PROD_DOMAIN : institutionData.BETA_DOMAIN;

      try {
        clearCache();
        
        await Auth.signOut();
        
        await fetch(`https://${domain}/logout?client_id=${client_id}&&logout_uri=${redirect}`, {
          redirect: 'follow',
          mode: 'no-cors',
        });
        
        window.location.href = '/'
      } catch (e) {
        console.log('Logout error:', e)
       
        clearCache();
        window.location.href = '/'
      }
    }

    onLoad();
  }, [])

  return <div>Logging out...</div>
}

export default Logout