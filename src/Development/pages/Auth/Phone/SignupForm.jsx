import {BaseTextInput, EmailInput, PrimaryButton} from "../../common/Inputs";
import {useState} from "react";
import {Link} from "react-router-dom";

const SignupForm = ({ handler }) => {
  const [errorText, setErrorText] = useState('')
  return (
    <form
      onSubmit={handler}
      className='flex flex-wrap items-center gap-x-4 gap-y-8'
    >
      <BaseTextInput
        placeholder='Name'
        name='name'
        className='rounded w-full'
      />
      <EmailInput
          name='email'
          className='rounded w-full'
      />
      {/* <BaseTextInput
        placeholder='Referral Code'
        name='referralCode'
        className='rounded w-full'
        required={false}
      /> */}

      <PrimaryButton>Send OTP</PrimaryButton>
      <p className='text-red-400'>{errorText}</p>
      <p className='text-center'>
        *By creating an account you agree to our
        <Link to='/signup'> Terms of use</Link> as well as
        <Link to='/signup'> Privacy Policy</Link>
      </p>
      {/*<p className='col-span-2 text-center'>Already have an account? <Link to='/signup'>Login</Link></p>*/}
    </form>
  )
}

export default SignupForm;