import React, { useRef } from 'react'
import AvatarEditor from 'react-avatar-editor'

const ImageCrop = ({
  imageUrl,
  onSave,
  onCancel,
  modalVisible,
  setModalVisible
}) => {
  const editorRef = useRef(null)

  const handleSave = () => {
    const canvas = editorRef.current.getImageScaledToCanvas()
    // You can save the canvas image to your server or state
    // Implement your save logic here

    // Close the modal after saving
    setModalVisible(false)
    onSave(canvas.toDataURL()) // Pass the cropped image data back to parent component
  }

  return (
    <div className={`modal ${modalVisible ? 'visible' : 'hidden'}`}>
      <div className="modal-content">
        <AvatarEditor
          ref={editorRef}
          image={imageUrl}
          width={200}
          height={200}
          border={50}
          color={[255, 255, 255, 0.6]} // RGBA
        />
        <button onClick={handleSave}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

export default ImageCrop