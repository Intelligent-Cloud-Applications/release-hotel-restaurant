import React, { useState, useEffect } from "react";
import { TextInput, Select, Button } from "flowbite-react";
import { BaseTextInput, EmailInput, CountrySelect, PhoneInput } from "../../../../common/Inputs";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";

const StaffForm = ({ initialData, isUpdate, onSubmit, isLoading, existingStaffList = [] }) => {
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

  const trimmedEmail = (formData.email || "").trim().toLowerCase();
  const matchedStaff = !isUpdate && trimmedEmail
    ? existingStaffList.find(s => (s.emailId || s.email || "").trim().toLowerCase() === trimmedEmail)
    : null;

  // Auto-fill existing details when an existing staff email is typed during creation
  useEffect(() => {
    if (matchedStaff && !isUpdate) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || matchedStaff.userName || matchedStaff.name || "",
        phone: prev.phone || (matchedStaff.phoneNumber ? matchedStaff.phoneNumber.replace(/^\+\d{1,3}/, "") : ""),
        userType: matchedStaff.role || matchedStaff.userType || prev.userType,
        countryCode: matchedStaff.phoneNumber?.match(/^\+(\d{1,3})/)?.[1] || prev.countryCode || "91",
      }));
    }
  }, [matchedStaff, isUpdate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const cleanPhone = (formData.phone || "").replace(/[^\d]/g, "").replace(/^0+/, "");
    const formattedPhone = cleanPhone ? `+${formData.countryCode || "91"}${cleanPhone}` : (initialData?.phoneNumber || "");
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

    const finalEmail = (formData.email || "").trim().toLowerCase();
    const finalName = (formData.name || "").trim();

    const payload = {
      ...finalData,
      phoneNumber: formattedPhone,
      userName: finalName,
      name: finalName,
      emailId: finalEmail,
      email: finalEmail,
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

          {matchedStaff && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800 space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-amber-900">
                <span>⚠️</span>
                <span>Staff email already exists ({matchedStaff.userName || matchedStaff.name})</span>
              </div>
              <p className="text-xs text-amber-700">
                This staff member is already created. You can change their password and edit details below. Saving will update their password in Cognito and update their details.
              </p>
            </div>
          )}

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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {matchedStaff ? "New Password" : "Password"}
              {matchedStaff && (
                <span className="text-xs text-gray-500 font-normal ml-1">
                  (will update password in Cognito)
                </span>
              )}
            </label>
            <div className="relative">
              <TextInput
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={matchedStaff ? "Enter new password (e.g. Password@123)" : "Enter password (e.g. Password@123)"}
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
          <option value="captain">Captain</option>
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
        {isLoading 
          ? "Processing..." 
          : isUpdate 
            ? "Update User" 
            : matchedStaff 
              ? "Save & Update Staff" 
              : "Create User"}
      </Button>
    </form>
  );
};

export default StaffForm;