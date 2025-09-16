// Packages
import { Select, TextInput } from "flowbite-react";
import React, { useContext, useEffect, useState } from "react";

// Local
import {LuClock, LuHash, LuLock, LuMail, LuPhone, LuText} from "react-icons/lu";
import { Context } from "../../Context";
import countries from "./countries.json";
import currencies from "./currencies.json"

export const CountrySelect = (props) => {
  const { userData } = useContext(Context);
  const [country, setCountry] = useState(userData?.location?.countryValue);

  useEffect(() => {
    setCountry(userData?.location?.countryValue);
  }, [userData?.location?.countryValue]);
  const handleChange = (event) => {
    setCountry(event.target.value);
  };
  return (
    <Select value={country} onChange={handleChange} {...props}>
      {countries.map((item, index) => (
        <option key={index} value={item.value}>
          {item.name}
        </option>
      ))}
    </Select>
  );
};
export const getCurrencySymbol = (currencyCode) => {
  const currency = currencies.find(item => item.code === currencyCode);
  return currency ? currency.symbol : null; 
};
export const PhoneInput = (props) => {
  return (
    <TextInput
      type="tel"
      maxLength="10"
      placeholder="Phone Number"
      icon={LuPhone}
      required
      pattern="[0-9]{9,10}"
      title="Phone Numbers are 9 or 10 digits"
      {...props}
    />
  );
};

export const EmailInput = (props) => {
  return (
    <TextInput
      type="email"
      placeholder="Email Address"
      icon={LuMail}
      {...props}
    />
  );
};

export const PasswordInput = (props) => {
  return (
    <TextInput
      type="password"
      placeholder="Password"
      icon={LuLock}
      required
      {...props}
    />
  )
}

export const OtpInput = (props) => {
  return (
    <TextInput
      type="text"
      placeholder="OTP"
      icon={LuHash}
      required
      pattern="[0-9]{6}"
      title="OTP is 6 digits"
      {...props}
    />
  );
};

export const BaseTextInput = (props) => {
  return (
    <TextInput
      type="text"
      placeholder="Enter text here..."
      icon={LuText}
      required
      {...props}
    />
  );
};

export const BaseNumberInput = (props) => {
  return (
    <TextInput
      type="number"
      placeholder="Enter number here..."
      icon={LuClock}
      required
      {...props}
    />
  )
}

export const PrimaryButton = ({ children, ...props }) => {
  const { PrimaryColor } = useContext(Context).institutionData;
  //  const { PrimaryColor } = useSelector((state) => state.institutionData.data);

  return (
    <button
      // style={{
      //   backgroundColor: PrimaryColor,
      //   width: "100%",
      //   height: "40px",
      //   color: "white",
      //   borderRadius: "10px",
      // }}
      className='bg-primaryColor disabled:bg-lightPrimaryColor w-full h-10 text-white rounded'
      {...props}
    >
      {children}
    </button>
  );
};

// Components used in old components

export const Button1 = ({ data, fn, w = "auto", h = "auto" }) => {
  return (
    <button
      className={`sans-serif tracking-wider bg-[#2f2f2f] text-[#e1e1e1] h-[${h}] rounded-lg py-2 px-2 w-[${w}]`}
      onClick={fn}
    >
      {data}
    </button>
  );
};

export const Button2 = ({
  data,
  fn,
  w = "auto",
  h = "auto",
  className = "",
}) => {
  const InstitutionData = useContext(Context).institutionData;
  return (
    <button
      className={`sans-serif tracking-wider font-semibold rounded-lg py-2 px-2 text-white h-[${h}] w-[${w}] ${className}`}
      style={{
        backgroundColor: InstitutionData.PrimaryColor,
      }}
      onClick={fn}
    >
      {data}
    </button>
  );
};
