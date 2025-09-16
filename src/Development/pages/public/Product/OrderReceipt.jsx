import React, { useRef, useState, useContext, useEffect } from "react";
import html2canvas from "html2canvas";
import { getCurrencySymbol } from "../../../common/Inputs";
import { Context } from "../../../Context";

const OrderReceipt = ({ order }) => {
  const receiptRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { institutionData, userData } = useContext(Context);
  const [institution, setInstitution] = useState("");

  const capitalizeWords = (str) => {
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const calculateTotalWithTax = (order) => {
    const cgstAmount = order.cgst || 0;
    const sgstAmount = order.sgst || 0;
    const serviceCharge = order.serviceTax || 0;

    const itemTotal =
      order.totalAmount - cgstAmount - sgstAmount - serviceCharge;

    const cgstPercentage = ((cgstAmount / itemTotal) * 100).toFixed(1);
    const sgstPercentage = ((sgstAmount / itemTotal) * 100).toFixed(1);
    const serviceChargePercentage = Math.round(
      (serviceCharge / itemTotal) * 100
    );

    return {
      itemTotal: itemTotal.toFixed(2),
      cgstAmount,
      sgstAmount,
      serviceCharge,
      cgstPercentage,
      sgstPercentage,
      serviceChargePercentage,
      finalTotal: order.totalAmount.toFixed(2),
    };
  };

  const downloadReceipt = async () => {
    setIsGenerating(true);

    try {
      const element = receiptRef.current;
      if (!element) {
        throw new Error("Receipt element not found");
      }

      element.style.position = "fixed";
      element.style.visibility = "visible";
      element.style.pointerEvents = "none";
      if (userData.userType === "admin") {
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        document.body.appendChild(iframe);
      
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(`
          <html>
            <head>
              <title>Receipt - ${order.orderId}</title>
              <style>
                @media print {
                  html, body {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    box-sizing: border-box;
                  }
                  #receipt-container {
                    width: 100%;         /* Full page width */
                    height: 100%;        /* Full page height */
                    padding: 0;          /* No padding */
                    margin: 0;           /* No margin */
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                    line-height: 1.5;
                    text-align: center;
                    box-sizing: border-box;
                  }
                  .bold { font-weight: bold; }
                  .divider { border-top: 1px dashed #000; margin: 8px 0; }
                }
              </style>
            </head>
            <body>
              <div id="receipt-container">${element.innerHTML}</div>
            </body>
          </html>
        `);
        iframeDoc.close();
      
        iframe.onload = () => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          document.body.removeChild(iframe);
        };
      }
      else {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          allowTaint: true,
          onclone: (clonedDoc) => {
            const clonedLogo = clonedDoc.querySelector("#receipt-logo");
            if (clonedLogo) {
              clonedLogo.crossOrigin = "anonymous";
            }
          },
        });

        element.style.position = "absolute";
        element.style.visibility = "hidden";
        element.style.pointerEvents = "none";

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              throw new Error("Failed to generate blob");
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.download = `receipt-${order.orderId}.png`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          },
          "image/png",
          1.0
        );
      }
    } catch (error) {
      console.error("Error generating receipt:", error);
      alert("Failed to generate receipt. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div
        id="receipt-container"
        ref={receiptRef}
        style={{
          position: "absolute",
          top: "-9999px",
          left: "-9999px",
          width: "300px",
          padding: "20px",
          backgroundColor: "white",
          fontFamily: "Arial, sans-serif",
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        <div className="mb-4 text-center">
          <div
            style={{
              fontSize: "16px",
              fontWeight: "bold",
              marginBottom: "10px",
            }}
          >
            {capitalizeWords(
              institutionData?.companyName ||
                institutionData?.institutionId ||
                ""
            )}
          </div>

          <h2
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              marginBottom: "8px",
            }}
          >
            Order Receipt
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "#666",
            }}
          >
            Order ID: {order.orderId}
          </p>
          <p
            style={{
              fontSize: "14px",
              color: "#666",
            }}
          >
            {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <div style={{ borderBottom: "1px solid #ddd", margin: "12px 0" }} />

        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "14px" }}>
            <strong>Table:</strong> {order.tableName}
          </p>
          <p style={{ fontSize: "14px" }}>
            <strong>Customer:</strong> {order.name}
          </p>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <h3 style={{ fontWeight: "bold", marginBottom: "8px" }}>Items</h3>
          {order.items.map((item, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "14px",
                marginBottom: "4px",
              }}
            >
              <span>
                {item.name} x{item.quantity}
              </span>
              <span>
                {getCurrencySymbol(order.currency)}
                {item.price}
              </span>
            </div>
          ))}
        </div>

        <div style={{ borderBottom: "1px solid #ddd", margin: "12px 0" }} />

        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "14px",
              marginBottom: "4px",
            }}
          >
            <span>Items Total:</span>
            <span>
              {getCurrencySymbol(order.currency)}
              {isNaN(calculateTotalWithTax(order).itemTotal)
                ? order.totalAmount
                : calculateTotalWithTax(order).itemTotal}
            </span>
          </div>

          {calculateTotalWithTax(order).cgstAmount > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "14px",
                marginBottom: "4px",
              }}
            >
              <span>
                CGST ({calculateTotalWithTax(order).cgstPercentage}%):
              </span>
              <span>
                {getCurrencySymbol(order.currency)}
                {calculateTotalWithTax(order).cgstAmount}
              </span>
            </div>
          )}

          {calculateTotalWithTax(order).sgstAmount > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "14px",
                marginBottom: "4px",
              }}
            >
              <span>
                SGST ({calculateTotalWithTax(order).sgstPercentage}%):
              </span>
              <span>
                {getCurrencySymbol(order.currency)}
                {calculateTotalWithTax(order).sgstAmount}
              </span>
            </div>
          )}

          {calculateTotalWithTax(order).serviceCharge > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "14px",
                marginBottom: "4px",
              }}
            >
              <span>
                Service Charge (
                {calculateTotalWithTax(order).serviceChargePercentage}%):
              </span>
              <span>
                {getCurrencySymbol(order.currency)}
                {calculateTotalWithTax(order).serviceCharge}
              </span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "16px",
              fontWeight: "bold",
              marginTop: "8px",
            }}
          >
            <span>Final Total:</span>
            <span>
              {getCurrencySymbol(order.currency)}
              {calculateTotalWithTax(order).finalTotal}
            </span>
          </div>
        </div>

        <div style={{ borderBottom: "1px solid #ddd", margin: "12px 0" }} />

        <div
          style={{
            borderBottom: "1px solid #ddd",
            textAlign: "center",
            fontSize: "14px",
          }}
          className="mb-1"
        >
          <p>
            <strong>Payment Method:</strong> {order.paymentMode} (
            {order.paymentMethod})
          </p>
          <p style={{ marginTop: "14px" }} className="mb-2">
            Thank you for visiting!
          </p>
         
        </div>
        <div
          className="flex flex-col justify-center"
          style={{ textAlign: "center", fontSize: "14px" }}
        >
          <p
            style={{
              fontSize: "14px",
              color: "#666",
            }}
          >
            {institutionData?.Query_Address || ""}
          </p>
          <p
            style={{
              fontSize: "14px",
              color: "#666",
            }}
          >
            {institutionData?.Query_PhoneNumber || ""}
          </p>
          <p style={{ marginTop: "2px" }} className="mb-2">
          powered by awsaiapp
          </p>
        </div>
      </div>

      <button
        onClick={downloadReceipt}
        disabled={isGenerating}
        className={`flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg transition duration-200 ${
          isGenerating ? "opacity-50 cursor-not-allowed" : "hover:bg-green-700"
        }`}
      >
        {isGenerating ? (
          <span>Generating...</span>
        ) : (
          <>
            {userData.userType === "admin" ? (
              <>
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M6 2a1 1 0 00-1 1v4h10V3a1 1 0 00-1-1H6zM4 8v8a2 2 0 002 2h8a2 2 0 002-2V8H4zm3 3h6v2H7v-2z" />
                </svg>
                Print Receipt
              </>
            ) : (
              <>
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" />
                </svg>
                Download Receipt
              </>
            )}
          </>
        )}
      </button>
    </div>
  );
};

export default OrderReceipt;
