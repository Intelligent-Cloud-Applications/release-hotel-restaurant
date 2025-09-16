import {
  BaseTextInput,
  CountrySelect,
  EmailInput,
  PasswordInput,
  PhoneInput,
  PrimaryButton,
} from "../../../common/Inputs";
import {Link} from "react-router-dom";

const SignupForm = ({ handler }) => {
  return (
    <form
      onSubmit={handler}
      className={
        `flex flex-col items-center gap-6
        w-full`
      }
    >
      <BaseTextInput name='name' className='rounded w-full' placeholder='Name'/>
      <EmailInput name='email' className='rounded w-full'/>
      <CountrySelect name='country' className='rounded w-full'/>
      <PhoneInput name='phone' className='rounded w-full'/>
      <PasswordInput name='password' className='rounded w-full'/>
      <PasswordInput name='password_confirmation' className='rounded w-full' placeholder='Confirm Password'/>
      <PrimaryButton>Continue</PrimaryButton>
      <p className='text-center'>Already have an account or want to use Google? <Link className='underline' to={'/login'}>Login</Link></p>
    </form>
  )
}

export default SignupForm;