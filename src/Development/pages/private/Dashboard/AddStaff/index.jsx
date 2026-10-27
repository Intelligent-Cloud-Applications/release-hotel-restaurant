import React, { useContext, useState, useEffect } from "react";
import { API } from "aws-amplify";
import { Button } from "flowbite-react";
import { FaTrash, FaEdit } from "react-icons/fa";
import { Context } from "../../../../Context/index.jsx";
import { PaginatedTable } from "../../../../common/DataDisplay/index.jsx";
import StaffModal from "./StaffModal.jsx";
import { toast } from "react-toastify";
import Error from "../../../Error.jsx";

const Stafflist = () => {
  const { institution } = useContext(Context).institutionData;
  const { userData } = useContext(Context);
  const [staffData, setStaffData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedUserType, setSelectedUserType] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const head = ["Name", "Email", "Phone Number", "User Type", "Actions"];

  if (userData?.userType !== 'admin' || userData?.role === 'cashier') {
    return <Error message="Access Denied: Admins and Managers Only" />;
  }

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await API.get("main", `/admin/staff-list/${institution}`);
      setStaffData(response);
      setFilteredData(response);
    } catch (error) {
      console.error("Error fetching staff data:", error);
      toast.error("Failed to load staff data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [institution]);

  const handleFilterChange = (event) => {
    const userType = event.target.value;
    setSelectedUserType(userType);

    if (userType) {
      setFilteredData(
        staffData.filter((staff) => {
          const effectiveRole = staff.role || staff.userType;
          return effectiveRole.toLowerCase() === userType.toLowerCase();
        })
      );
    } else {
      setFilteredData(staffData);
    }
  };

  const handleDelete = async (cognitoId) => {
    try {
      const updatedStaffData = staffData.filter((staff) => staff.cognitoId !== cognitoId);
      const updatedFilteredData = filteredData.filter((staff) => staff.cognitoId !== cognitoId);
      
      setStaffData(updatedStaffData);
      setFilteredData(updatedFilteredData);
      
      await API.del("main", `/admin/delete-staff/${institution}/${cognitoId}`);
      toast.success("Staff member deleted successfully");
    } catch (error) {
      console.error("Error deleting staff member:", error);
      toast.error("Failed to delete staff member");
      fetchData();
    }
  };

  const handleOpenModal = (staff = null) => {
    setSelectedStaff(staff);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStaff(null);
  };

  const handleSubmit = async (formData) => {
    setIsLoading(true);
    
    try {
      if (selectedStaff) {
        const updatedPhone = formData.phoneNumber || selectedStaff.phoneNumber;
        const tempStaff = { 
          ...selectedStaff,
          userName: formData.name,
          phoneNumber: updatedPhone,
          userType: formData.userType,
          role: formData.role || undefined
        };
        const updatedStaffData = staffData.map((staff) =>
          staff.cognitoId === selectedStaff.cognitoId ? tempStaff : staff
        );
        
        setStaffData(updatedStaffData);
        
        const effectiveRole = tempStaff.role || tempStaff.userType;
        if (selectedUserType === "" || selectedUserType.toLowerCase() === effectiveRole.toLowerCase()) {
          setFilteredData(filteredData.map((staff) =>
            staff.cognitoId === selectedStaff.cognitoId ? tempStaff : staff
          ));
        } else {
          setFilteredData(filteredData.filter((staff) => 
            staff.cognitoId !== selectedStaff.cognitoId
          ));
        }
        
        const targetEmail = (selectedStaff.emailId || selectedStaff.email || formData.email || "").trim().toLowerCase();
        await API.put("main", `/admin/update-staff/${institution}/${selectedStaff.cognitoId}`, {
          body: {
            name: formData.name,
            userType: formData.userType,
            email: targetEmail,
            phoneNumber: updatedPhone,
            ...(formData?.role ? { role: formData.role } : {}),
            ...(formData?.password ? { password: formData.password } : {}),
          }
        });
        
        toast.success("Staff member updated successfully");
        await fetchData();
      } else {
        const staffEmail = (formData.email || formData.emailId || "").trim().toLowerCase();
        
        // Check if staff with this email already exists
        const existingMember = staffData.find(s => 
          (s.emailId || s.email || "").trim().toLowerCase() === staffEmail
        );

        const tempId = existingMember ? existingMember.cognitoId : `temp-${Date.now()}`;
        const tempStaff = {
          cognitoId: tempId,
          userName: formData.name,
          emailId: staffEmail,
          phoneNumber: formData.phoneNumber,
          userType: formData.userType,
          role: formData.role || undefined
        };
        
        if (existingMember) {
          // Update in-place to avoid duplicate entry
          setStaffData(prevData => prevData.map(staff => 
            staff.cognitoId === existingMember.cognitoId ? { ...staff, ...tempStaff } : staff
          ));
          setFilteredData(prevData => prevData.map(staff => 
            staff.cognitoId === existingMember.cognitoId ? { ...staff, ...tempStaff } : staff
          ));
        } else {
          setStaffData(prevData => [...prevData, tempStaff]);
          const effectiveRole = tempStaff.role || tempStaff.userType;
          if (selectedUserType === "" || selectedUserType.toLowerCase() === effectiveRole.toLowerCase()) {
            setFilteredData(prevData => [...prevData, tempStaff]);
          }
        }
        
        const response = await API.post("main", "/admin/create-staff", {
          body: {
            institution,
            name: formData.name,
            email: staffEmail,
            phoneNumber: formData.phoneNumber,
            country: formData.country || "india",
            userType: formData.userType,
            password: formData.password || "Password@123",
            ...(formData?.role ? { role: formData.role } : {})
          }
        });
        
        const actualStaff = {
          ...response,
          cognitoId: response.cognitoId || tempId,
          userName: response.userName || response.name || formData.name,
          emailId: response.emailId || response.email || formData.email,
          phoneNumber: response.phoneNumber || formData.phoneNumber,
          userType: response.userType || formData.userType,
          role: formData.role || undefined
        };
        
        setStaffData(prevData => prevData.map(staff => 
          (staff.cognitoId === tempId || (staff.emailId && staff.emailId.toLowerCase() === staffEmail)) ? actualStaff : staff
        ));
        
        setFilteredData(prevData => prevData.map(staff => 
          (staff.cognitoId === tempId || (staff.emailId && staff.emailId.toLowerCase() === staffEmail)) ? actualStaff : staff
        ));
        
        if (existingMember || response?.isExisting) {
          toast.success("Staff details and password updated successfully");
        } else {
          toast.success("Staff member created successfully");
        }
        await fetchData();
      }
      
      handleCloseModal();
    } catch (error) {
      console.error("Error handling staff:", error);
      toast.error(error.message || "Failed to process staff data");
      fetchData();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 mb-4">
      <h1 className="text-xl font-bold mb-4">Staff List</h1>

      <div className="flex flex-wrap justify-between items-center mb-4">
        <div className="mb-2 sm:mb-0">
          <label htmlFor="userType" className="mr-2">Filter by Role:</label>
          <select
            id="userType"
            value={selectedUserType}
            onChange={handleFilterChange}
            className="border px-2 py-1 rounded"
          >
            <option value="">All</option>
            <option value="chef">Chef</option>
            <option value="waiter">Waiter</option>
            <option value="manager">Manager</option>
            <option value="cashier">Cashier</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
            <option value="member">Member</option>
          </select>
        </div>

        <Button 
          onClick={() => handleOpenModal()} 
          className="bg-primaryColor text-white"
        >
          Create Staff
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-300 border-t-primaryColor rounded-full animate-spin"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xl font-bold">👨‍🍳</div>
          </div>
          <p className="mt-4 text-primaryColor font-medium">Loading staff members...</p>
        </div>
      ) : (
        <>
          {screenWidth > 1025 ? (
            <PaginatedTable
              head={head}
              data={filteredData.map((staff) => [
                staff.userName,
                staff.emailId,
                staff.phoneNumber || "-",
                staff.role ? (staff.role.charAt(0).toUpperCase() + staff.role.slice(1)) : (staff.userType ? (staff.userType.charAt(0).toUpperCase() + staff.userType.slice(1)) : ""),
                <div className="flex space-x-2">
                  <Button onClick={() => handleOpenModal(staff)} className="bg-primaryColor">
                    <FaEdit />
                  </Button>
                  <Button onClick={() => handleDelete(staff.cognitoId)} className="bg-red-500">
                    <FaTrash />
                  </Button>
                </div>,
              ])}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {filteredData.map((staff) => (
                <div
                  key={staff.cognitoId}
                  className="relative rounded-lg shadow-lg overflow-hidden bg-secondaryColor"
                >
                  <div className="relative p-6">
                    <h2 className="text-xl font-bold mb-4">{staff.userName}</h2>
                    <div className="mb-2">
                      <span className="block text-sm font-medium">Email:</span>
                      <span className="block">{staff.emailId}</span>
                    </div>
                    <div className="mb-2">
                      <span className="block text-sm font-medium">Phone Number:</span>
                      <span className="block">{staff.phoneNumber}</span>
                    </div>
                    <div className="mb-2">
                      <span className="block text-sm font-medium">User Type:</span>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                          staff.role === "owner" || staff.userType === 'admin'
                            ? 'bg-blue-600 text-white'
                            : 'bg-green-600 text-white'
                        }`}
                      >
                        {staff.role ? (staff.role.charAt(0).toUpperCase() + staff.role.slice(1)) : (staff.userType ? (staff.userType.charAt(0).toUpperCase() + staff.userType.slice(1)) : "")}
                      </span>
                    </div>
                
                    <div className="flex space-x-4 mt-6">
                      <button
                        onClick={() => handleOpenModal(staff)}
                        className="flex items-center justify-center flex-1 px-4 py-2 text-white bg-primaryColor shadow-md rounded-md"
                      >
                        <FaEdit className="mr-2" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(staff.cognitoId)}
                        className="flex items-center justify-center flex-1 px-4 py-2 text-white bg-red-500 rounded-md hover:bg-red-600 shadow-md transform hover:scale-105 transition-transform duration-200"
                      >
                        <FaTrash className="mr-2" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <StaffModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        initialData={selectedStaff}
        isUpdate={!!selectedStaff}
        isLoading={isLoading}
        existingStaffList={staffData}
      />
    </div>
  );
};

export default Stafflist;