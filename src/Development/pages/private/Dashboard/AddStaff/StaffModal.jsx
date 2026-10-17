import React from "react";
import { Modal } from "flowbite-react";
import { AiOutlineClose } from "react-icons/ai";
import StaffForm from "./StaffForm";

const StaffModal = ({ isOpen, onClose, onSubmit, initialData, isUpdate, isLoading, existingStaffList }) => {
  return (
    <Modal show={isOpen} onClose={onClose} size="md">
      <div className="flex flex-col px-6 py-6 bg-white rounded-lg shadow-lg space-y-4">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-600 hover:text-gray-900"
        >
          <AiOutlineClose size={24} />
        </button>

        <h2 className="text-xl font-semibold text-center">
          {isUpdate ? "Update Staff" : "Create Staff"}
        </h2>

        <StaffForm
          initialData={initialData}
          isUpdate={isUpdate}
          onSubmit={onSubmit}
          isLoading={isLoading}
          existingStaffList={existingStaffList}
        />
      </div>
    </Modal>
  );
};

export default StaffModal;