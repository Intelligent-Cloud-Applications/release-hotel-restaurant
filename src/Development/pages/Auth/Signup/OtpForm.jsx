import {
  OtpInput,
  PrimaryButton
} from "../../../common/Inputs";
import {useState, useEffect} from "react";

const OtpForm = ({ handler, resendHandler, email }) => {
  const [seconds, setSeconds] = useState(30);
  const [isDisabled, setIsDisabled] = useState(true);

  // Function to encode/mask the email
  const encodeEmail = (email) => {
    if (!email) return '';
    
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    
    const [username, domain] = parts;
    
    // Show first 2 characters and last character of username, mask the rest
    const maskedUsername = username.length <= 3 
      ? username.charAt(0) + '*'.repeat(username.length - 1)
      : username.substring(0, 2) + '*'.repeat(username.length - 3) + username.charAt(username.length - 1);
    
    return `${maskedUsername}@${domain}`;
  };

  const reset = () => {
    setIsDisabled(true);
    setSeconds(30);
  };

  const handleResend = () => {
    reset();
    resendHandler();
  }

  useEffect(() => {
    let interval = null;
    if (isDisabled && seconds > 0) {
      interval = setInterval(() => {
        setSeconds((prevSeconds) => prevSeconds - 1);
      }, 1000);
    } else if (seconds === 0) {
      setIsDisabled(false); // Re-enable the button when countdown reaches 0
      clearInterval(interval); // Clear the interval
    }
    return () => clearInterval(interval);
  }, [seconds, isDisabled]);

  return (
    <form
      onSubmit={handler}
      className={
        `flex flex-col items-center gap-6
        w-full`
      }
    >
      <div className="text-center text-gray-700 mb-2">
        <p>Your OTP has been sent to</p>
        <p className="font-medium">{encodeEmail(email)}</p>
      </div>
      <OtpInput name='otp' className='rounded w-full'/>
      <button 
        type="button" 
        onClick={handleResend} 
        disabled={isDisabled} 
        className={`text-blue-500 ${isDisabled ? 'opacity-70' : 'hover:underline'}`}
      >
        {isDisabled ? `Resend OTP in ${seconds}s` : 'Resend OTP'}
      </button>
      <PrimaryButton>Continue</PrimaryButton>
    </form>
  )
}

export default OtpForm;