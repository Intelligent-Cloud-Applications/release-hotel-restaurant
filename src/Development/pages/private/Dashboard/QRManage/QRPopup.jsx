import React, { useState, useEffect, useRef, useContext } from "react";
import QRCodeStyling from "qr-code-styling";
import { Storage } from "aws-amplify";
import { Context } from "../../../../Context";
import { API } from "aws-amplify";
import { toast } from "react-toastify";

const QRPopup = ({ onClose, tableData, fetchTableDetails }) => {
  const [numberOfTables, setNumberOfTables] = useState(1);
  const qrCodeInstance = useRef(null);
  const { institutionData, setLoader } = useContext(Context);
  const { logoUrl, PrimaryColor, SecondaryColor, institution } = institutionData;
  const popupRef = useRef(null); 

  useEffect(() => {
    qrCodeInstance.current = new QRCodeStyling({
      width: 300,
      height: 300,
      type: "canvas",
      dotsOptions: {
        color: PrimaryColor || "#000",
        type: "extra-rounded",
      },
      backgroundOptions: {
        color: "#ffffff",
      },
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 5,
        imageSize: 0.4,
      },
    });
  }, [PrimaryColor]);

  const createCircleWithText = (text) => {
    const size = 300;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = PrimaryColor || "#4caf50";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${size * 0.4}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, size / 2, size / 2);

    return canvas.toDataURL();
  };

  const generateHTMLPage = (qrCodeURL, tableName) => {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"> 
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${institution} - ${tableName}</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            background-color: ${SecondaryColor};
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .pamphlet {
            width: 300px;
            background: #ffffff;
            border: 2px solid ${PrimaryColor};
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
            text-align: center;
            padding: 20px;
          }
          .logo img {
            max-width: 80px;
            margin: 10px auto;
          }
          .title {
            font-size: 24px;
            color: ${PrimaryColor};
            font-weight: bold;
            margin: 10px 0;
          }
          .subtitle {
            font-size: 14px;
            color: #777;
            margin-bottom: 10px;
          }
          .qr-code {
            margin: 20px 0;
          }
          .qr-code img {
            width: 200px;
            height: 200px;
          }
          .table-name {
            font-size: 18px;
            font-weight: bold;
            margin: 10px 0;
          }
          .footer {
            font-size: 12px;
            color: #999;
            margin-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="pamphlet">
          <div class="logo">
            <img src="${logoUrl}" alt="${institution} Logo" />
          </div>
          <div class="title">Menu</div>
          <div class="subtitle">Scan the QR Code to order online</div>
          <div class="qr-code">
            <img src="${qrCodeURL}" alt="QR Code" />
          </div>
          <div class="table-name">Table: ${tableName}</div>
        </div>
      </body>
      </html>
    `;
  };
  
  const uploadHTMLToS3 = async (htmlContent, tableName) => {
    try {
      const blob = new Blob([htmlContent], { type: "text/html" });
      const fileName = `${institution}/qr-pages/${tableName.trim()}-${Date.now()}.html`;

      const result = await Storage.vault.put(fileName, blob, {
        contentType: "text/html",
        level: "public",
      });
      let qrImageLink = await Storage.get(result.key);
      qrImageLink = qrImageLink.split("?")[0];
      return qrImageLink;
    } catch (error) {
      console.error("Error uploading HTML:", error);
      throw error;
    }
  };

  const createTableAPI = async (tableName, qrImageLink) => {
    try {
      let url = `/admin/create-table/${institution}`;

if (institutionData.index !== undefined && institutionData.index !== null) {
  url += `?index=${institutionData.index}`;
}

await API.post("main", url, {
        body: {
          tableNo: tableName,
          qrImage: qrImageLink,
        },
      });
      console.log(`Table ${tableName} created successfully!`);
    } catch (error) {
      console.error("Error creating table:", error);
      throw error;
    }
  };

  const generateQRCodes = async () => {
    if (numberOfTables <= 0) {
      toast.info("Please enter a valid number of tables.");
      return;
    }
  
    // Set loader once at the beginning
    setLoader(true);
    onClose();
  
    try {
      const promises = [];
      
      // Create an array of tables to process
      const tablesToCreate = [];
      for (let i = 1; i <= numberOfTables; i++) {
        const tableName = `${i}`;
        const tableExists = tableData.some((table) => table.tableNo === tableName);
        
        if (!tableExists) {
          tablesToCreate.push(tableName);
        } else {
          console.log(`Table ${tableName} already exists. Skipping.`);
        }
      }
      
      // Process each table sequentially to avoid canvas issues
      for (const tableName of tablesToCreate) {
        const circleImage = createCircleWithText(tableName);
        const isProd = process.env.REACT_APP_STAG === 'prod'; 
        const baseDomain = institutionData.domainLink 
          ? institutionData.domainLink.endsWith('/') 
            ? `${institutionData.domainLink}product`
            : `${institutionData.domainLink}/product`
          : isProd 
            ? `${institutionData.institution}.awsaiapp.com/product`
            : `beta${institutionData.institution}.awsaiapp.com/product`;
        
        const qrData = `${baseDomain}?tableName=${tableName}`;
  
        qrCodeInstance.current.update({
          data: qrData,
          image: circleImage,
        });
  
        // Wait for QR code to render
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (qrCodeInstance.current && qrCodeInstance.current._domCanvas) {
          const canvas = qrCodeInstance.current._domCanvas;
          const qrCodeURL = canvas.toDataURL("image/png");
          const htmlContent = generateHTMLPage(qrCodeURL, tableName);
          
          // Upload HTML and create table entry
          const qrImageLink = await uploadHTMLToS3(htmlContent, tableName);
          await createTableAPI(tableName, qrImageLink);
        } else {
          console.error("QR Code canvas not found.");
        }
      }
  
      toast.info("QR Codes generated successfully!");
      fetchTableDetails();
    } catch (error) {
      console.error("Error generating QR codes:", error);
      toast.error("An error occurred while generating QR codes.");
    } finally {
      // Turn off loader only once at the end
      setLoader(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center"
      style={{ zIndex: 1000 }}
    >
      <div ref={popupRef} className="bg-white p-6 rounded-lg shadow-lg text-center relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-3xl text-gray-500 hover:text-gray-700"
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: "5px",
          }}
        >
          &times;
        </button>
        <img
          src={logoUrl}
          alt="Institution Logo"
          style={{ width: "100px", margin: "0 auto 10px" }}
        />
        <h4
          style={{ color: PrimaryColor, marginBottom: "15px" }}
          className="text-xl max478:text-[18px] font-bold"
        >
          Enter Total Number of Tables to Create QR Codes
        </h4>
        <input
          type="number"
          value={numberOfTables}
          onChange={(e) => setNumberOfTables(Math.max(1, parseInt(e.target.value) || 0))}
          min="1"
          placeholder="Enter Total Table Number to Create QR"
          className="border rounded w-full p-2 mb-4"
          style={{
            appearance: "none",
            MozAppearance: "textfield",
            WebkitAppearance: "none",
            outline: "none",
          }}
          onWheel={(e) => e.target.blur()} 
          onKeyDown={(e) =>
            e.key === "ArrowUp" || e.key === "ArrowDown" ? e.preventDefault() : null
          }
        />
        <button
          onClick={generateQRCodes}
          className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
        >
          Create QR Codes
        </button>
      </div>
    </div>
  );
};

export default QRPopup;
