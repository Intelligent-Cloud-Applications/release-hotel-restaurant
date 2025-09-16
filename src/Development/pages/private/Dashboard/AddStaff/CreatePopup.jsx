// import { useContext, useState } from "react";
// import { API } from "aws-amplify";
// import { toast } from "react-toastify";
// import { Context } from "../../../../Context";
// import countries from "../../../../common/Inputs/countries.json";
// import { AiOutlineClose } from "react-icons/ai"; // Close icon from react-icons
// import { Modal, Button } from "flowbite-react"; // Flowbite Modal & Button components
// import AddStaff from "./AddStaff";

// const CreatePopup = ({ onClose, onSuccess }) => {
//   const { setLoader, institutionData } = useContext(Context);
  
//   const { institution } = institutionData;
//   const [country, setCountry] = useState("");

//   const handleAddStaff = async (event) => {
//     event.preventDefault();

//     const name = event.target.name.value;
//     const email = event.target.email.value;
//     const phone = "+" + event.target.country.value + event.target.phone.value;
//     const role = event.target.role.value;
//     if (!name.trim()) {
//       alert("Name cannot be empty.");
//       return;
//     }
    
//     // Find country
//     for (let country of countries) {
//       if (country.value === event.target.country.value) {
//         setCountry(country.name.split(" (")[0]);
//         break;
//       }
//     }

//     const requestBody = {
//       institution,
//       name,
//       email,
//       phoneNumber: phone,
//       country: "india",
//       userType: role,
//     };
    
//     const newStaff = {
//       ...requestBody,
//       id: `temp-${Date.now()}`,
//     };

//     onSuccess(newStaff);

//     try {
//       const response = await API.post("main", "/admin/create-staff", {
//         body: requestBody,
//       });
      
//       onSuccess(response);
//       toast.success("User created successfully!");
//     } catch (error) {
//       console.error("Error creating user:", error);
//       toast.error(error.message || "Failed to create user");
//     }
//   };

//   return (
//     <Modal show={true} onClose={onClose} size="md" >
   
//       <div className="flex flex-col px-6 py-6 bg-white rounded-lg shadow-lg space-y-4">
    
//         <button
//           onClick={onClose}
//           className="absolute top-2 right-2 text-gray-600 hover:text-gray-900"
//         >
//           <AiOutlineClose size={24} />
//         </button>

//         <h2 className="text-xl font-semibold text-center">Create Staff</h2>

//         <AddStaff handler={handleAddStaff} />

      
//       </div>
//     </Modal>
//   );
// };
// export default CreatePopup;