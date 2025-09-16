import {EmailInput, PrimaryButton} from "../../../common/Inputs";

const EmailForm = ({ handler }) => {
  return (
    <form
      onSubmit={handler}
      className={
        `flex flex-col items-center gap-6
        w-full`
      }
    >
      <EmailInput name='email' className='rounded w-full'/>
      <PrimaryButton>Send Otp</PrimaryButton>
    </form>
  )
}

export default EmailForm;