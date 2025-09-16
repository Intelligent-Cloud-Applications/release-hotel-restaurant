import React from 'react'


const Button2 = ({ data, fn, w = 'auto', h = 'auto', className = '' }) => {

  return (
    <button
      className={`sans-serif tracking-wider font-semibold rounded-lg py-2 px-2 text-white h-[${h}] w-[${w}] ${className}`}
      style={{
        backgroundColor: "#000000"
      }}
      onClick={fn}
    >
      {data}
    </button>
  )
}

export default Button2