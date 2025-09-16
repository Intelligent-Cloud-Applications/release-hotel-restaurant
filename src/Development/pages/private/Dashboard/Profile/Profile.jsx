import { API, Auth, Storage } from 'aws-amplify'
import React, { useRef, useState } from 'react'
import { useContext, useEffect } from 'react'
import { AiFillEye, AiFillEyeInvisible } from 'react-icons/ai'
import { Context } from '../../../../Context'
import Button2 from './Button2'
import AvatarEditor from 'react-avatar-editor'
import './Profile.css'
import { toast } from 'react-toastify'
import { ChevronDown, ChevronUp } from 'lucide-react'

const Profile = () => {
  const Ctx = useContext(Context)
  const { institution } = useContext(Context).institutionData;
  const { institutionData } = useContext(Context);
  const [ loader,setLoader ] = useState(false);

  const [serviceTax, setServiceTax] = useState(0);
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);
  const [gstin, setGstin] = useState('');
  const [isTaxDetailsExpanded, setIsTaxDetailsExpanded] = useState(false)

  useEffect(() => {
    if (institutionData) {
      setServiceTax(institutionData.serviceTax || 0);
      setCgst(institutionData.cgst || 0);
      setSgst(institutionData.sgst || 0);
      setGstin(institutionData.gstin || '');
    }
  }, [institutionData]);

  // const { setLoader } = useContext(Context);
  const { userData } = useContext(Context)
  const [name, setName] = useState(userData.userName)
  const [country] = useState("India")
  const [currentEmail, setCurrentEmail] = useState(userData.emailId)
  
  const formatDate = (epochDate) => {
    const date = new Date(epochDate)
    const day = date.getDate()
    const month = date.getMonth() + 1
    const year = date.getFullYear()
    const formattedDay = day < 10 ? `0${day}` : day
    const formattedMonth = month < 10 ? `0${month}` : month
    return `${formattedDay}/${formattedMonth}/${year}`
  }

  const [image, setImage] = useState(null)
  const [editor, setEditor] = useState(null)
  const [scale, setScale] = useState(1)
  const fileInputRef = useRef(null)
  const [joiningDate] = useState(formatDate(userData.joiningDate))
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [isChangePassword, setIsChangePassword] = useState(false)
  const [err, setErr] = useState('')
  const [phoneNumber, setPhoneNumber] = useState(userData.phoneNumber)
  const [phoneCode, setPhoneCode] = useState('')
  const [isPhoneChange, setIsPhoneChange] = useState(false)
  const [isPhoneCode, setIsPhoneCode] = useState(false)

  const ifDataChanged = () => {
    if (
      name.trim() === userData.userName.trim() &&
      phoneNumber === userData.phoneNumber &&
      (userData.userType !== 'admin' || (
        serviceTax === userData.serviceTax &&
        sgst === userData.sgst &&
        cgst === userData.cgst &&
        gstin === userData.gstin
      ))
    ) {
      return false
    } else {
      return true
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    setImage(file)
  }

  const handleEditClick = () => {
    fileInputRef.current.click()
  }

  const handleSave = () => {
    if (editor) {
      const canvasScaled = editor.getImageScaledToCanvas()
      const croppedImage = canvasScaled.toDataURL()
      handleFileUpload(croppedImage)
    }
  }

  const handleCancel = () => {
    setImage(null)
    setEditor(null)
  }

  const handleFileUpload = async (base64File) => {
    setLoader(true)
    try {
      const blob = await fetch(base64File).then((res) => res.blob())
      if (blob.size > 5 * 1024 * 1024) {
        throw new Error('File size exceeds 5MB limit.')
      }

      const currentUser = await Auth.currentAuthenticatedUser()
      const cognitoId = currentUser.attributes

      const filename = `${institution}/${cognitoId}/profile-${Date.now()}.jpg`
      const uploadResult = await Storage.put(
        filename,
        blob,
        {
          contentType: 'image/jpeg',
          level: 'public'
        }
      )

      if (!uploadResult.key) {
        throw new Error('Failed to upload image')
      }

      const imageUrl = await Storage.get(filename)
      const response = await API.put(
        "main",
        `/user/update-profile/${institution}`,
        {
          body: {
            emailId: currentEmail,
            userName: name,
            phoneNumber: phoneNumber,
            country: country,
            imgUrl: imageUrl.split('?')[0],
            ...(userData.userType === 'admin' && { serviceTax, cgst, sgst, gstin })
          }
        }
      )

      if (!response || !response.Attributes) {
        throw new Error('Failed to update profile')
      }

      const tempUser = { ...userData, imgUrl: imageUrl.split('?')[0] }
      Ctx.setUserData(tempUser)
      toast.success('Profile picture updated successfully')

    } catch (error) {
      console.error('Error uploading profile picture: ', error)
      toast.error(error.message || 'Failed to upload profile picture')
    } finally {
      setLoader(false)
      setImage(null)
      setEditor(null)
    }
  }

  const getInitials = (name) => {
    if (!name) return '';
    const names = name.split(' ');
    return names.map((name) => name.charAt(0).toUpperCase()).join('');
  };

  const getColor = (name) => {
    if (!name) return '#888888';
    const colors = [
      '#FF5733', '#33FF57', '#5733FF',
      '#FF5733', '#33FF57', '#5733FF',
      '#FF5733', '#33FF57', '#5733FF',
      '#FF5733', '#33FF57', '#5733FF'
    ];
    return colors[name.length % colors.length];
  };

  const onProfileUpdate = async (e) => {
    e.preventDefault()
    if (name.trim() === '') {
      toast.info('Name cannot be empty.');
      setLoader(false);
      return;
    }
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(currentEmail)) {
      toast.info('Please enter a valid email address');
      return;
    }

    // const phonePattern = /^\+\d{1,3}\d{10}$/;
    // if (!phonePattern.test(phoneNumber)) {
    //   toast.info('Please enter a valid phone number (format: +CountryCodeNumber)');
    //   return;
    // }
  const phoneDigits = phoneNumber.replace(/^\+91/, ''); // Remove +91 prefix
  if (phoneDigits.length !== 10) {
    toast.info('Phone number must be exactly 10 digits');
    setLoader(false);
    return;
  }

  const phonePattern = /^\+91\d{10}$/; 
  if (!phonePattern.test(phoneNumber)) {
    toast.info('Please enter a valid 10-digit phone number');
    setLoader(false);
    return;
  }
    if (userData.userType === 'admin' && gstin) {
      const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinPattern.test(gstin)) {
        toast.info('Please enter a valid GSTIN number (e.g., 22AAAAA0000A1Z5)');
        setLoader(false);
        return;
      }
    }

    setLoader(true)
    if (ifDataChanged()) {
      try {
        const userdata = await API.put(
          "main",
          `/user/update-profile/${institution}`,
          {
            body: {
              emailId: currentEmail,
              userName: name,
              phoneNumber: phoneNumber,
              status: userData.status,
              country: country,
              imgUrl: userData.imgUrl || null,
              ...(userData.userType === 'admin' && { serviceTax, cgst, sgst, gstin })
            }
          }
        )

        Ctx.setUserData(userdata.Attributes)
        toast.info('Updated')
        setLoader(false)
      } catch (e) {
        console.log(e)
        toast.warn(e.message)
        setLoader(false)
      }
    } else {
      toast.warn('Nothing is to be changed')
      setLoader(false)
    }
  }

  const passwordValidator = () => {
    if (password.length < 8) {
      setErr('Password is too Short')
      return false
    } else if (password !== confirmPassword) {
      setErr("Password Doesn't Match")
      return false
    } else {
      setErr('')
      return true
    }
  }

  const passwordVisibilityChange = () => {
    setPasswordVisible((prevState) => !prevState)
  }

  const onPasswordChange = async (e) => {
    e.preventDefault()
    setLoader(true)
    if (passwordValidator()) {
      try {
        const currentUser = await Auth.currentAuthenticatedUser()
        await Auth.changePassword(currentUser, oldPassword, password)
        toast.info('Password Changed')
        setIsChangePassword(false)
        setLoader(false)
      } catch (e) {
        setErr(e.message)
        setLoader(false)
      }
    }
    setLoader(false)
  }

  const LoaderComponent = () => (
    <div className="flex flex-col items-center justify-center p-12">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-gray-300 border-t-primaryColor rounded-full animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-primaryColor">👤</div>
    </div>
    <p className="mt-4 text-primaryColor font-medium">Loading profile...</p>
  </div>
  
  );
  if (loader) return <LoaderComponent />;
  return (
    <div className="relative max1050:w-screen flex flex-col items-center">
      <div className="w-[75%] max1050:w-[100%] max-w-[36rem] rounded-3xl p-3 flex flex-col items-center max536:w-[90%] relative bg-[#eceaeac7] mt-2 mb-20">
     
        
        <div className="avatar-editor-container flex flex-row justify-center">
          <input
            type="file"
            onChange={handleImageChange}
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
          {image && (
            <div className="absolute mt-20 max450:mt-14 top-[25%]">
              <div className="flex justify-end">
                <button
                  className="border-none cursor-pointer"
                  onClick={handleCancel}
                >
                  <span className="text-2xl">⨯</span>
                </button>
              </div>
              <AvatarEditor
                ref={(ref) => setEditor(ref)}
                image={image}
                width={200}
                height={200}
                border={50}
                borderRadius={100}
                scale={scale}
              />
              <div className="controls">
                <input
                  type="range"
                  min="1"
                  max="2"
                  step="0.01"
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                />
                <button
                  className="rounded-md w-[4rem] h-8 text-white ml-4"
                  style={{ backgroundColor: "#30AFBC" }}
                  onClick={handleSave}
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
        {!isPhoneChange ? (
          <>
            {!isChangePassword ? (
              <div className="flex flex-col items-center mb-4">
                <div className="relative w-[10rem] h-[10rem] mx-auto mb-6">
                  <div className="relative w-full h-full rounded-full flex items-center justify-center border-[3px] border-solid border-t1 shadow-md shadow-black/40">
                    {userData.imgUrl ? (
                      <img
                        alt="profile"
                        key={"profileUpdate1" + Date.now()}
                        src={userData.imgUrl}
                        className="w-full h-full rounded-full object-cover cursor-pointer"
                        onClick={handleEditClick}
                      />
                    ) : (
                      <div
                        className="w-full h-full rounded-full flex items-center justify-center cursor-pointer"
                        style={{ backgroundColor: getColor(userData.userName) }}
                        onClick={handleEditClick}
                      >
                        <span className="text-[3rem] font-bold text-white">
                          {getInitials(userData.userName)}
                        </span>
                      </div>
                    )}
                    <div
                      className="absolute bottom-0 right-0 w-10 h-10 text-white flex items-center justify-center cursor-pointer"
                      onClick={handleEditClick}
                    >
                      <i className="rounded-full fa-solid fa-pencil pencil-icon"
                        style={{ backgroundColor: institutionData.PrimaryColor }}
                      />
                    </div>
                  </div>
                </div>
                <form className="mt-6 flex flex-col gap-8 max560:w-full">
                  <div className="grid grid-cols-2 gap-4 w-full max536:grid-cols-1 max536:w-full">
                    <div className="flex flex-col gap-1 justify-center">
                      <label className="ml-2">Name</label>
                      <input
                        className="bg-inputBgColor px-4 py-2 rounded-lg rule"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1 justify-center">
                      <label className="ml-2">Phone Number</label>
                      <div className="relative">
                        <input
                          className="bg-inputBgColor px-4 py-2 rounded-lg w-full pl-12"
                          type="text"
                          value={(phoneNumber || '').startsWith('+91') ? (phoneNumber || '').substring(3) : phoneNumber || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            const numbersOnly = value.replace(/[^0-9]/g, '');
                            const limitedNumbers = numbersOnly.slice(0, 10);
                            setPhoneNumber('+91' + limitedNumbers);
                          }}
                        />
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-600">
                          +91
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 justify-center">
                    <label className="ml-2">Country</label>
                    <input
                      className="px-4 py-2 rounded-lg w-full cursor-not-allowed text-gray-600"
                      type="text"
                      value={country}
                      readOnly
                    />
                  </div>

                  <div className="flex flex-col gap-1 justify-center">
                    <label className="ml-2">Email</label>
                    <input
                      className="bg-inputBgColor rounded-lg py-2 w-full pl-4 cursor-not-allowed"
                      type="email"
                      readOnly
                      value={currentEmail}
                      onChange={(e) => setCurrentEmail(e.target.value)}
                    />
                  </div>

                  {userData.userType === 'admin' && (
                    <div className="w-full mt-4">
                      <div
                        className="flex justify-between items-center cursor-pointer bg-[#30AFBC] text-white px-4 py-2 rounded-t-lg"
                        onClick={() => setIsTaxDetailsExpanded(!isTaxDetailsExpanded)}
                      >
                        <span className="font-semibold">Tax Management Details</span>
                        {isTaxDetailsExpanded ? <ChevronUp /> : <ChevronDown />}
                      </div>

                      {isTaxDetailsExpanded && (
                        <div className="bg-white p-4 rounded-b-lg shadow-md">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-medium">Service Tax (%)</label>
                              <select
                                className="px-4 py-2 rounded-lg w-full border border-gray-300"
                                value={serviceTax}
                                onChange={(e) => setServiceTax(Number(e.target.value))}
                              >
                                {[...Array(11)].map((_, index) => (
                                  <option key={index} value={index}>
                                    {index}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-medium">GSTIN</label>
                              <input
                                className="px-4 py-2 rounded-lg w-full border border-gray-300"
                                type="text"
                                value={gstin}
                                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                                placeholder="Enter GSTIN (e.g., 22AAAAA0000A1Z5)"
                                maxLength={15}
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-medium">CGST (%)</label>
                              <select
                                className="px-4 py-2 rounded-lg w-full border border-gray-300"
                                value={cgst}
                                onChange={(e) => setCgst(Number(e.target.value))}
                              >
                                <option value={0}>0%</option>
                                <option value={2.5}>2.5%</option>
                              </select>
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-medium">SGST (%)</label>
                              <select
                                className="px-4 py-2 rounded-lg w-full border border-gray-300"
                                value={sgst}
                                onChange={(e) => setSgst(Number(e.target.value))}
                              >
                                <option value={0}>0%</option>
                                <option value={2.5}>2.5%</option>
                              </select>
                            </div>
                          </div>

                          <div className="mt-4 text-sm text-gray-600">
                            <p>* Service Tax can be set from 0-10%</p>
                            <p>* CGST and SGST are limited to 0% or 2.5%</p>
                            <p>* GSTIN must be 15 characters (e.g., 22AAAAA0000A1Z5)</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-center">
                    <Button2 data={'Update'} fn={onProfileUpdate} w="8rem" />
                  </div>
                </form>
              </div>
            ) : (
              <>
                <form className="flex flex-col items-center my-4 max536:w-[90%]">
                  <p className="text-[1.3rem]">Change Password</p>
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-20 mt-6 max536:flex-col max536:gap-2 max536:items-start">
                      <label className="w-20 max536:ml-2">Old Password</label>
                      <input
                        className="bg-inputBgColor px-4 py-2 rounded-lg"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-20 mt-6 max536:flex-col max536:gap-2 max536:items-start">
                      <label className="w-20 max536:ml-2">Password</label>
                      <input
                        className="bg-inputBgColor px-4 py-2 rounded-lg"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-20 mt-6 max536:flex-col max536:gap-2 max536:items-start relative">
                      <label className="w-20 max536:ml-2">Confirm Password</label>
                      <input
                        className="bg-inputBgColor px-4 py-2 rounded-lg"
                        type={!passwordVisible ? 'password' : 'text'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      {passwordVisible ? (
                        <AiFillEye
                          onClick={passwordVisibilityChange}
                          className="absolute right-4"
                          size={'1.25rem'}
                        />
                      ) : (
                        <AiFillEyeInvisible
                          onClick={passwordVisibilityChange}
                          className="absolute right-4"
                          size={'1.25rem'}
                        />
                      )}
                    </div>
                  </div>

                  {err && (
                    <p className="text-[0.8rem] mt-2 text-red-500">{err}</p>
                  )}
                  <div className="flex gap-5">
                    <Button2
                      data={'Cancel'}
                      fn={(e) => {
                        e.preventDefault()
                        setErr('')
                        setIsChangePassword(false)
                      }}
                      w="8rem"
                    />
                    <Button2
                      data={'Update'}
                      fn={onPasswordChange}
                      w="8rem"
                      className="mt-8"
                    />
                  </div>
                </form>
              </>
            )}
          </>
        ) : (
          <>
            {!isPhoneCode ? (
              <div></div>
            ) : (
              <div></div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Profile