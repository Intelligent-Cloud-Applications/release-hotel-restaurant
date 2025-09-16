import {OtpInput, PasswordInput, PrimaryButton} from "../../../common/Inputs";

const PasswordForm = ({ handler }) => {
  return (
    <form
      onSubmit={handler}
      className={
        `flex flex-col items-center gap-6
        w-full`
      }
    >
      <PasswordInput name='password' className='rounded w-full'/>
      <PasswordInput name='password_confirmation' className='rounded w-full' placeholder='Confirm Password' />
      <OtpInput name='otp' className='w-full rounded'/>
      <PrimaryButton>Change Password</PrimaryButton>
    </form>
  )
}

export default PasswordForm;