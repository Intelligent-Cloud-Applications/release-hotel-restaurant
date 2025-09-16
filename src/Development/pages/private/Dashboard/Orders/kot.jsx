import React, { useEffect, useRef, useState } from "react";
import { API } from "aws-amplify";
import { toast } from "react-toastify";

const KOT = ({ show, onClose, selectedOrderId, institutionData, fetchOrders, customerDetails }) => {
  const printRef = useRef(null);
  const [order, setOrder] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await API.get(
          "main",
          `/any/get-order/${institutionData.institution}`,
          {
            queryStringParameters: { orderId: selectedOrderId },
          }
        );
        setOrder(response.orders?.[0]);
      } catch (error) {
        console.error("Error fetching order:", error);
      }
    };

    if (selectedOrderId) {
      fetchOrder();
    }
  }, [selectedOrderId, institutionData.institution]);

  useEffect(() => {
    if (order) {
      handlePrint();
    }
  }, [order]);

  const handlePrint = async () => {
   
    const existingPrintArea = document.getElementById("printArea");
    if (existingPrintArea) {
      document.body.removeChild(existingPrintArea);
    }
    
    const existingStyle = document.querySelector("#printAreaStyle");
    if (existingStyle) {
      document.head.removeChild(existingStyle);
    }
    const kotNo = order.orderId.toString().slice(-3).padStart(3, "0");

    // Print KOT
    const printArea = document.createElement("div");
    printArea.id = "printArea";

    const itemsHTML = order.items
      .map(
        (item) => `
        <tr>
          <td>${item.itemName}</td>
          <td style="text-align: right;">${item.quantity}</td>
        </tr>
      `
      )
      .join("");

    const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);

    printArea.innerHTML = `
      <div class="kot">
        <div class="header">KOT No: ${kotNo}</div>
        <div class="sub-header">${order.tableName === "takeaway" ? "Takeaway" : "Dine-in"}</div>
        <div class="info">${new Date(order.createdAt).toLocaleString()}</div>
        <div class="divider"></div>
        <div class="header">Table: ${order.tableName || "N/A"}</div>
        <div class="divider"></div>
        <table class="table">
         <tr>
  <td colspan="2" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; width: 100%;">
    <b>Item</b>
    <b>Qty</b>
  </td>
</tr>

          ${itemsHTML}
        </table>
        <div class="divider"></div>
        <table class="table total">
          <tr><td><b>Total Qty:</b></td><td style="text-align:right;">${totalQty}</td></tr>
        </table>
      </div>
    `;

    document.body.appendChild(printArea);

    const style = document.createElement("style");
    style.innerHTML = `
      @media print {
        @page {
          size: 55mm auto; 
          margin: 0; 
        }
        body {
          margin: 0;
          margin-top:1px;
          padding: 0;
        }
        body * {
          visibility: hidden;
        }
        #printArea, #printArea * {
          visibility: visible;
        }
        #printArea {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 55mm;
          padding: 0;
          page-break-inside: avoid;
        }
      }
  
      .kot {
        font-family: monospace;
        text-align: left;
        font-size: 30px; 
        padding: 0; 
        line-height: 1; 
        max-width: 55mm;
        word-wrap: break-word;
        margin: 0 auto;
        page-break-inside: avoid; 
      }
      .header {
        font-size: 18px; 
        font-weight: bold;
        text-align: center;
        margin: 0;
      }
      .sub-header, .info {
        font-size: 18px; 
        text-align: center;
        margin: 0;
      }
      .divider {
        border-top: 1px dashed black;
        margin: 1px 0; 
      }
      .table {
        width: 100%;
        font-size: 18px; 
        border-collapse: collapse;
      }
      .table td {
        padding: 0; 
        word-break: break-word;
      }
      .total {
        font-weight: bold;
        border-top: 1px solid black;
      }
    `;
    document.head.appendChild(style);

    window.print();

    window.onafterprint = async () => {
      
      await handlePostPrintConfirmation();
      onClose();
    };
    setTimeout(cleanup, 2000);
  };
  const cleanup = () => {
    const existingPrintArea = document.getElementById("printArea");
    if (existingPrintArea) {
      existingPrintArea.remove();
    }
  
    const existingStyle = document.getElementById("printStyle");  // Note the ID change
    if (existingStyle) {
      existingStyle.remove();
    }
  };
  const handlePostPrintConfirmation = async () => {
    if (order.status === "pending") {
      const confirmUpdate = window.confirm(
        "Do you want to update the order status to 'preparing'?"
      );

      if (confirmUpdate) {
        const updatedOrder = {
          ...order,
          status: "preparing",
          deliveryTime: null,
        };

        try {
          await API.put(
            "main",
            `/chef/update-order/${institutionData.institution}`,
            {
              body: updatedOrder,
            }
          );
          toast.success("Order status updated to 'preparing'.");
          fetchOrders();
        } catch (error) {
          console.error("Error updating order status:", error);
          toast.error("Failed to update order status.");
        }
      }
    }
  };

  if (!order) return null;

  return <div ref={printRef} style={{ display: "none" }} />;
};

export default KOT;
