import {OtpInput, PrimaryButton} from "../../common/Inputs";
import {useState, useEffect} from "react";
import {Auth} from "aws-amplify";
import {toast} from "react-toastify";

const OtpForm = ({ handler, phoneNumber, setSignInResponse }) => {
  const [timer, setTimer] = useState(30);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (timer > 0) {
        setTimer(timer - 1);
      } else {
        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [timer]);

  const resendOtp = async () => {
    setTimer(30);
    try {
      setSignInResponse(
        await Auth.signIn(phoneNumber)
      );


      toast.info('OTP sent');
    } catch (error) {
      console.log(error)
      toast.error('Could not resend OTP');
    }
  }

  return (
    <form
      onSubmit={handler}
      className={
        `flex flex-col items-center gap-6
        w-full`
      }
    >
      <OtpInput name='otp' className='w-full rounded'/>
      <PrimaryButton>Login</PrimaryButton>
      {timer > 0 ?
      <p>Resend OTP in {timer} seconds</p> :
      <button type='button' onClick={resendOtp}>Resend OTP</button>}
      {/*<p className='text-red-400'>{errorText}</p>*/}
    </form>
  )
}

export default OtpForm;