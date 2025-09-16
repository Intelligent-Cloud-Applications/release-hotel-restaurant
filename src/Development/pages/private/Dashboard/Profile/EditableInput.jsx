import React, { useState, useRef } from 'react';
import { FaPencilAlt } from 'react-icons/fa';

const EditableInput = ({ label, value, onChange }) => {
  const [isEditable, setIsEditable] = useState(false);
  const inputRef = useRef(null);

  const handleEditClick = () => {
    setIsEditable(true);
    setTimeout(() => {
      inputRef.current.focus();
    }, 0);
  };

  return (
    <div className="relative flex flex-col gap-1 justify-center">
      <label className="ml-2">{label}</label>
      <input
        ref={inputRef}
        className="bg-inputBgColor px-4 py-2 rounded-lg w-full"
        type="text"
        value={value}
        readOnly={!isEditable}
        onChange={onChange}
        onBlur={() => setIsEditable(false)}
      />
      <FaPencilAlt
        className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer"
        onClick={handleEditClick}
      />
    </div>
  );
};

export default EditableInput;