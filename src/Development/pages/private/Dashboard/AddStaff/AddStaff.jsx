// import React, { useState } from "react";
// import { BaseTextInput, EmailInput, PrimaryButton, CountrySelect, PhoneInput } from "../../../../common/Inputs";
// import { Select } from "flowbite-react"; // Select from Flowbite

// const AddStaff = ({ handler }) => {
//   const [role, setRole] = useState("chef");

//   return (
//     <form onSubmit={handler} className="space-y-4">
//       <BaseTextInput placeholder="Name" name="name" className="w-full" />

//       <Select
//         name="role"
//         value={role}
//         onChange={(e) => setRole(e.target.value)}
//         className="w-full"
//       >
//         <option value="chef">Chef</option>
//         <option value="waiter">Waiter</option>
//         <option value="admin">Admin</option>
//       </Select>

//       <CountrySelect name="country" className="w-full" />

//       <PhoneInput name="phone" className="w-full" />

//       <EmailInput name="email" className="w-full" />

//       <PrimaryButton className="w-full bg-primaryColor text-white font-semibold px-4 py-2 rounded-lg shadow-md">
//         Create User
//       </PrimaryButton>
//     </form>
//   );
// };

// export default AddStaff;
