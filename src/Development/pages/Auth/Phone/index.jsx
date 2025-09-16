import Header from "../../components/Header";
import {useContext, useState} from "react";
import LoginForm from "./LoginForm";
import OtpForm from "./OtpForm";
import SignupForm from "./SignupForm";
import { Context } from "../../Context";
import {API, Auth} from "aws-amplify";
import {toast} from "react-toastify";
import {useNavigate} from "react-router-dom";
import countries from "../../common/Inputs/countries.json";

const AuthPage = () => {
  const { setLoader, setUserData, setIsAuth, institutionData } = useContext(Context);
  const { institution } = institutionData;

  const navigate = useNavigate();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState("");
  const [signInResponse, setSignInResponse] = useState();
  const [formState, setFormState] = useState('login')


  const handleLogin = async (event) => {
    event.preventDefault();
    setLoader(true);
    const phoneNumber = `+${event.target.country.value}${event.target.phone.value}`;

    for (let country of countries) {
      if (country.value === event.target.country.value) {
        console.log(country.name);
        setCountry(country.name.split(' (')[0]);
        break;
      }
    }

    try {
      setSignInResponse(
        await Auth.signIn(phoneNumber)
      );
      setFormState('otp');
    } catch {
      setFormState('signup');
    } finally {
      setPhoneNumber(phoneNumber);
      setLoader(false);
    }
  }


  const otpHandler = async (event) => {
    event.preventDefault();
    setLoader(true);
    const otp = event.target.otp.value;

    try {
      await Auth.sendCustomChallengeAnswer(signInResponse, otp);
      await Auth.currentAuthenticatedUser();

      const userdata = await API.get(
          'main',
          `/user/get-userdata/${ institution }`,
          {}
      );

      setUserData(userdata);
      setLoader(false);

      toast.info('Logged in');
      navigate(`/dashboard`);
    } catch (error) {
      if (error === 'The user is not authenticated')
        toast.error('Incorrect OTP. Try again');
      else if (error.name === 'NotAuthorizedException')
        toast.error('OTP expired. Use resend OTP');
      else if (error.response.status === 404)
        toast.error('User data not found. Delete old data');

      console.log(error);
    } finally {
      setLoader(false);
    }
  }

  const handleSignUp = async (event) => {
    event.preventDefault();
    setLoader(true);
    const name = event.target.name.value;
    const email = event.target.email.value;

    try {
      await Auth.signUp({
        username: phoneNumber,
        password: "Password@123",
        attributes: {
          phone_number: phoneNumber,
          name: name,
          email: email || 'none@none.com',
          'custom:country': country
        }
      });

      setSignInResponse(
          await Auth.signIn(phoneNumber)
      );

      setFormState('otp');
    } catch {
      toast.error('Unknown error occurred');
    } finally {
      setLoader(false);
    }
  }


  return (
    <div>
      <Header />
      <div className='flex flex-col items-center mt-10'>
        <div
          className={
            `flex flex-col items-center gap-4
            shadow-xl px-20 py-12 w-[480px] rounded-xl max980:w-full max980:px-2`
          }
        >
          <h2 className='font-bold text-2xl'>Auth</h2>
          <p className='text-center w-64'>{
            formState === 'login' ? 'Please enter your Phone Number for verification.' :
            formState === 'signup' ? 'Please enter your data to create your account' :
            'Please enter the otp to finish your login process'
          }</p>
          {
            formState === 'login' ?
              <LoginForm handler={handleLogin} /> :
            formState === 'signup' ?
              <SignupForm handler={handleSignUp} /> :
            <OtpForm handler={otpHandler} phoneNumber={phoneNumber} setSignInResponse={setSignInResponse} />
          }
        </div>
      </div>
    </div>
  )
}

export default AuthPage;