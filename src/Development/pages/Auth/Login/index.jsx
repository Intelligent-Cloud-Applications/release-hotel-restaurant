import {useContext} from "react";
import { Auth, API } from "aws-amplify";
import {toast} from "react-toastify";
import {Context} from "../../../Context";
import {Link, useNavigate} from "react-router-dom";
import {CognitoHostedUIIdentityProvider} from "@aws-amplify/auth";
import {HR} from "flowbite-react";
import {EmailInput, PasswordInput, PrimaryButton} from "../../../common/Inputs";
import {FormWrapper} from "../../../common/Layouts";

const customTheme = {
  "hrLine": "my-4 h-px w-64 border-0 bg-gray-700 dark:bg-gray-200"
}

const AuthPage = () => {
  const { setLoader } = useContext(Context);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();

    setLoader(true);
    try {
      await Auth.signIn(event.target.email.value, event.target.password.value);
      setLoader(false);
      navigate('/redirect');
    } catch (e) {
      console.log(e);
      if (e.name === 'NotAuthorizedException')
        toast.error('Incorrect password');
      else {
        toast.error('Please signup first.');
        navigate('/signup');
      }
    } finally {
      setLoader(false);
    }
  }

  return (
    <FormWrapper heading='Login'>
      <form
        onSubmit={handleLogin}
        className='flex flex-col items-center gap-6 w-full'
      >
        <button
          className="flex items-center bg-white text-black px-4 py-2 border rounded-md"
          type='button'
          onClick={() => Auth.federatedSignIn({provider: CognitoHostedUIIdentityProvider.Google})}
        >
          <img
            className="w-6 h-6 mr-2"
            src="https://www.gstatic.com/images/branding/product/1x/gsa_48dp.png"
            alt="Google Icon"
          />
          Sign in with Google
        </button>
        <HR.Text text='or' theme={customTheme}/>
        <EmailInput name='email' className='rounded w-full'/>
        <PasswordInput name='password' className='rounded w-full'/>
        <Link to={'/forgot-password'}>Forgot password?</Link>
        <PrimaryButton>Continue</PrimaryButton>
        <p>Dont have an account? <Link className='underline' to={'/signup'}>Signup</Link></p>
      </form>
    </FormWrapper>
  );
}

export default AuthPage;