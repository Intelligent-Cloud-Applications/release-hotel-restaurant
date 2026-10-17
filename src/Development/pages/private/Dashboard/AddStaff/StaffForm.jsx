import React, { useState } from "react";
import { TextInput, Select, Button } from "flowbite-react";
import { BaseTextInput, EmailInput, CountrySelect, PhoneInput } from "../../../../common/Inputs";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";

const StaffForm = ({ initialData, isUpdate, onSubmit, isLoading }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: initialData?.userName || initialData?.name || "",
    email: initialData?.emailId || initialData?.email || "",
    phone: initialData?.phoneNumber ? initialData.phoneNumber.replace(/^\+\d{1,3}/, "") : "",
    countryCode: initialData?.phoneNumber?.match(/^\+(\d{1,3})/)?.[1] || "91",
    userType: initialData?.role || initialData?.userType || "chef",
    country: initialData?.country || "india",
    password: ""
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const cleanPhone = (formData.phone || "").replace(/[^\d]/g, "").replace(/^0+/, "");
    const formattedPhone = cleanPhone ? `+${formData.countryCode}${cleanPhone}` : (initialData?.phoneNumber || "");
    let finalData = { ...formData };
    
    // If owner, manager, cashier, or admin, set userType: "admin" and role to the selected role
    if (["owner", "manager", "cashier", "admin"].includes(finalData.userType)) {
      finalData = {
        ...finalData,
        userType: "admin",
        role: finalData.userType
      };
    } else {
      finalData.role = "";
    }

    const payload = {
      ...finalData,
      phoneNumber: formattedPhone,
      userName: finalData.name,
      emailId: finalData.email,
    };

    if (formData.password && formData.password.trim()) {
      payload.password = formData.password.trim();
    }

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <BaseTextInput 
          name="name" 
          value={formData.name}
          onChange={handleChange}
          placeholder="Full Name" 
          className="w-full" 
          required
        />
      </div>

      {!isUpdate && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <EmailInput 
              name="email" 
              value={formData.email}
              onChange={handleChange}
              className="w-full" 
              disabled={isUpdate}
              required={!isUpdate}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <CountrySelect 
              name="countryCode" 
              value={formData.countryCode}
              onChange={handleChange}
              className="w-full" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <PhoneInput 
              name="phone" 
              value={formData.phone}
              onChange={handleChange}
              className="w-full" 
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <TextInput
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter password (e.g. Password@123)"
                className="w-full"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <AiFillEyeInvisible size={20} /> : <AiFillEye size={20} />}
              </button>
            </div>
          </div>
        </>
      )}

      {isUpdate && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (Not Editable)</label>
            <TextInput value={formData.email} disabled className="opacity-50 cursor-not-allowed" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <div className="flex gap-2">
              <div className="w-1/3">
                <CountrySelect 
                  name="countryCode" 
                  value={formData.countryCode}
                  onChange={handleChange}
                  className="w-full"
                />
              </div>
              <div className="w-2/3">
                <PhoneInput 
                  name="phone" 
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Phone Number"
                  className="w-full" 
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password <span className="text-xs text-gray-500 font-normal">(leave blank to keep current)</span>
            </label>
            <div className="relative">
              <TextInput
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter new password to change in Cognito"
                className="w-full"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <AiFillEyeInvisible size={20} /> : <AiFillEye size={20} />}
              </button>
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Role / User Type</label>
        <Select
          name="userType"
          value={formData.userType}
          onChange={handleChange}
          className="w-full"
          required
        >
          <option value="chef">Chef</option>
          <option value="waiter">Waiter</option>
          <option value="manager">Manager</option>
          <option value="cashier">Cashier</option>
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
          {isUpdate && <option value="member">Member</option>}
        </Select>
      </div>

      <Button 
        type="submit" 
        disabled={isLoading}
        className="w-full bg-primaryColor text-white font-semibold px-4 py-2 rounded-lg shadow-md"
      >
        {isLoading ? "Processing..." : isUpdate ? "Update User" : "Create User"}
      </Button>
    </form>
  );
};

export default StaffForm;