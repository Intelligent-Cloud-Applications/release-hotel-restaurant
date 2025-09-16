import React,{useContext} from 'react'
import Item from './Item'
import { Context } from '../../../../Context'
import Error from '../../../Error'
const index = () => {
  const{userData}=useContext(Context);
  if (userData?.userType !== 'admin') {
    return <Error message="Access Denied: Admins Only" />;
  }
  return (
    <div className='bg-gray-100 py-2'>
        <Item />
    </div>
  )
}

export default index