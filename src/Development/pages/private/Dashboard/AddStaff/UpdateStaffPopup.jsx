// import React, { useState } from 'react';
// import { API } from 'aws-amplify';
// import { Button, Modal, TextInput, Select } from "flowbite-react";
// import { Context } from '../../../../Context';
// import { useContext } from 'react';
// const UpdateStaffPopup = ({ staff, institution, onClose, onSuccess }) => {
//   const [name, setName] = useState(staff.userName);
//   const [userType, setUserType] = useState(staff.userType);
//   const [loading, setLoader] = useState(false);
//   // const { setLoader } = useContext(Context);

//   const handleUpdate = async () => {
//     try {
//       if (!name.trim()) {
//         alert("Name cannot be empty.");
//         return;
//       }
//       setLoader(true);

  
//       const payload = { name, userType,email: 
//         staff.emailId,        
//         phoneNumber: staff.phoneNumber,  };

    
//       await API.put("main", `/admin/update-staff/${institution}/${staff.cognitoId}`, {
//         body: payload,
//       });

    
//       onSuccess({ ...staff, name, userType });
//       alert("Staff member updated successfully.");
//       onClose();
//     } catch (error) {
//       console.error('Error updating staff member:', error);
//       alert("Failed to update staff member.");
//     } finally {
//       setLoader(false);
//     }
//   };

//   return (
//     <Modal show onClose={onClose} size="md">
//       <Modal.Header>Update Staff Member</Modal.Header>
//       <Modal.Body>
//         <div className="space-y-4">
//           <div>
//             <label className="block text-sm font-medium text-gray-700">Email (Not Editable)</label>
//             <TextInput value={staff.emailId} disabled className="opacity-50 cursor-not-allowed" />
//           </div>
//           <div>
//             <label className="block text-sm font-medium text-gray-700">Phone Number (Not Editable)</label>
//             <TextInput value={staff.phoneNumber} disabled className="opacity-50 cursor-not-allowed" />
//           </div>
//           <div>
//             <label className="block text-sm font-medium text-gray-700">Name</label>
//             <TextInput
//               value={name}
//               onChange={(e) => setName(e.target.value)}
//               required
//             />
//           </div>
//           <div>
//             <label className="block text-sm font-medium text-gray-700">User Type</label>
//             <Select
//               value={userType}
//               onChange={(e) => setUserType(e.target.value)}
//               required
//             >
//               <option value="member">Member</option>
//               <option value="chef">Chef</option>
//               <option value="waiter">Waiter</option>
//               <option value="admin">Admin</option>
//             </Select>
//           </div>
//         </div>
//       </Modal.Body>
//       <Modal.Footer>
//         <Button onClick={handleUpdate} disabled={loading}>
//           {loading ? "Updating..." : "Update"}
//         </Button>
//         <Button onClick={onClose} color="gray">
//           Cancel
//         </Button>
//       </Modal.Footer>
//     </Modal>
//   );
// };

// export default UpdateStaffPopup;
