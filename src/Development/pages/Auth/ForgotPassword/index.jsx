import {FormWrapper} from "../../../common/Layouts";
import {useContext, useState} from "react";
import {Auth} from "aws-amplify";
import {toast} from "react-toastify";
import {useNavigate} from "react-router-dom";
import EmailForm from "./EmailForm";
import PasswordForm from "./PasswordForm";
import {Context} from "../../../Context";

const ForgotPassword = () => {
  const { setLoader } = useContext(Context);
  const [formState, setFormState] = useState('email');
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const sendCode = async (event) => {
    event.preventDefault();

    setLoader(true);
    try {
      await Auth.forgotPassword(event.target.email.value);
      setEmail(event.target.email.value);
      setFormState('password');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoader(false);
    }
  }

  const confirmCode = async (event) => {
    event.preventDefault();

    if (event.target.password.value !== event.target.password_confirmation.value) {
      toast.error('Passwords do not match');
      return;
    }

    setLoader(true);
    try {
      await Auth.forgotPasswordSubmit(email, event.target.otp.value, event.target.password.value);
      toast.success('Password Changed successfully');
      setLoader(false);
      navigate('/login');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoader(false);
    }
  }

  return (
    <FormWrapper heading='Forget Password'>
      {formState === 'email' ? <EmailForm handler={sendCode} /> :
        <PasswordForm handler={confirmCode} />}
    </FormWrapper>
  )
}

export default ForgotPassword;