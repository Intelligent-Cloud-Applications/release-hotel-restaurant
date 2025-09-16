import React, { useContext } from 'react'
import { Context } from '../../Context'
import './index.css'

const LoaderProvider = (props) => {
  const {loader} = useContext(Context)

  return (
    <div>
      {loader && (
        <div
          className={`fixed top-0 left-0 w-screen h-screen bg-[#0000006e] z-[100]`}
        >
          <div className={`flex items-center justify-center w-screen h-screen`}>
            <div className="loader-container">
              <div className="loader"></div>
            </div>
          </div>
        </div>
      )}
      {props.children}
    </div>
  )
}

export default LoaderProvider