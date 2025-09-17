import React, { useState } from "react";
import { TextInput, Select, Button } from "flowbite-react";
import { BaseTextInput, EmailInput, CountrySelect, PhoneInput } from "../../../../common/Inputs";
import countries from "../../../../common/Inputs/countries.json";

const StaffForm = ({ initialData, isUpdate, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    name: initialData?.userName || initialData?.name || "",
    email: initialData?.emailId || initialData?.email || "",
    phone: initialData?.phoneNumber?.replace(/^\+\d+/, "") || "",
    countryCode: initialData?.phoneNumber?.match(/^\+(\d+)/) ? initialData?.phoneNumber?.match(/^\+(\d+)/)[1] : "91",
    userType: initialData?.role === "owner" ? "owner" : initialData?.userType || "chef", // Set userType to "owner" if role is "owner"
    country: initialData?.country || "india"
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const formattedPhone = `+${formData.countryCode}${formData.phone}`;
    let finalData = { ...formData };
    // If owner is selected, force userType to admin and add role: owner
    if (finalData.userType === "owner") {
      finalData = {
        ...finalData,
        userType: "admin",
        role: "owner"
      };
    } else {
      // Remove role if userType is not owner
      delete finalData.role;
    }

    onSubmit({
      ...finalData,
      phoneNumber: formattedPhone,
      userName: finalData.name,
      emailId: finalData.email
    });
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
              disabled={isUpdate}
              required={!isUpdate}
            />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (Not Editable)</label>
            <TextInput value={formData.phoneNumber || `+${formData.countryCode}${formData.phone}`} disabled className="opacity-50 cursor-not-allowed" />
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
        <Select
          name="userType"
          value={formData.userType}
          onChange={handleChange}
          className="w-full"
          required
        >
          <option value="chef">Chef</option>
          <option value="waiter">Waiter</option>
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