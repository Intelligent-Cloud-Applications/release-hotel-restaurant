import React, { useState, useEffect, useContext } from "react";
import { API } from "aws-amplify";
import { Button } from "flowbite-react";
import { PaginatedTable } from "../../../../common/DataDisplay/index.jsx";
import { Context } from "../../../../Context/index.jsx";
import QRPopup from "./QRPopup";
import { FaTrash, FaExternalLinkAlt } from "react-icons/fa";
import { toast } from "react-toastify";
const Loader = () => {
  return (
    <div className="flex flex-col items-center justify-center p-12">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-gray-300 border-t-primaryColor rounded-full animate-spin"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xl font-bold">
          QR
        </div>
      </div>
      <p className="mt-4 text-primaryColor font-medium">Loading QR tables...</p>
    </div>
  );
};

const QRManage = () => {
  const { institution,index } = useContext(Context).institutionData;
  const { institutionData,setLoader } = useContext(Context);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const openPopup = () => setIsPopupOpen(true);
  const closePopup = () => setIsPopupOpen(false);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  const head = ["Table No", "View/Download", "Delete"];

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchTableDetails = async () => {
    try {
      setLoading(true);
      const response = await API.get("main", `/any/cafe-detail/${institution}?index=${index}`);
      const tables = response.Table || [];
      setTableData(tables);
    } catch (error) {
      console.error("Error fetching table details:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (institution) {
      fetchTableDetails();
    }
  }, [institution]);

  const handleDelete = async (tableNo) => {
    try {
      setActionLoading(true);
      const indexParam =
      institutionData?.index !== undefined && institutionData?.index !== null
        ? `?index=${institutionData.index}`
        : "?index=0";
      await API.post("main", `/admin/remove-table/${institution}${indexParam}`, {
        body: { tableNo },
      });
      setTableData(tableData.filter((table) => table.tableNo !== tableNo));
      toast.success("Table deleted successfully.");
    } catch (error) {
      console.error("Error deleting table:", error);
      toast.error("Failed to delete table.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    try {
      setActionLoading(true);
      const indexParam =
      institutionData?.index !== undefined && institutionData?.index !== null
        ? `?index=${institutionData.index}`
        : "?index=0";
      const removeRequests = tableData.map((table) =>
        API.post("main", `/admin/remove-table/${institution}${indexParam}`, {
          body: { tableNo: table.tableNo },
        })
      );
      
      await Promise.all(removeRequests);
      setTableData([]);
      toast.success("All tables have been removed successfully.");
    } catch (error) {
      console.error("Error removing tables:", error);
     toast.error("Failed to remove all tables. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };
  
  const ActionLoader = () => (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-primaryColor rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-700">Processing request...</p>
      </div>
    </div>
  );

  return (
    <div className="w-full p-8 bg-gray-100">
      {actionLoading && <ActionLoader />}
      
      <h1 className="text-5xl max478:text-[22px] font-bold mb-8">Manage QR Tables</h1>
      <div className="flex justify-between mb-4">
        <Button onClick={openPopup} className="bg-primaryColor">
          Create QR
        </Button>
        <Button 
          onClick={handleDeleteAll} 
          className="bg-red-600"
          disabled={tableData.length === 0 || loading}
        >
          Delete All
        </Button>
      </div>

      {loading ? (
        <Loader />
      ) : (
        <>
          {tableData.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-6xl text-gray-300 mb-4">🏷️</div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">No QR tables found</h2>
              <p className="text-gray-500">Click "Create QR" button to add your first table QR code.</p>
            </div>
          ) : screenWidth > 1025 ? (
            <PaginatedTable
              head={head}
              data={tableData.map((table) => [
                table.tableNo,
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => window.open(table.qrImage, "_blank")}
                    className="text-primaryColor text-sm underline"
                  >
                    Click here to view and download
                  </button>
                </div>,
                <div>
                  <button
                    onClick={() => handleDelete(table.tableNo)}
                    className="text-red-600 text-sm"
                  >
                    Delete
                  </button>
                </div>,
              ])}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {tableData.map((table) => (
                <div
                  key={table.tableNo}
                  className="relative bg-secondaryColor rounded-lg shadow-sm overflow-hidden p-4 text-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-semibold">Table {table.tableNo}</h2>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => window.open(table.qrImage, "_blank")}
                        className="text-primaryColor text-lg"
                      >
                        <FaExternalLinkAlt />
                      </button>
                      <button
                        onClick={() => handleDelete(table.tableNo)}
                        className="text-red-600 text-lg"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {isPopupOpen && (
        <div className="px-4 max500:px-20">
          <QRPopup onClose={closePopup} tableData={tableData} fetchTableDetails={fetchTableDetails}/>
        </div>
      )}
    </div>
  );
};

export default QRManage;