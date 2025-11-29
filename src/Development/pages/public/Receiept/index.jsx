import React, { useState, useEffect, useContext } from 'react';
import { API } from 'aws-amplify';
import { Context } from '../../../Context';

const BillPage = () => {
  const [billData, setBillData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { institutionData } = useContext(Context);

  useEffect(() => {
    const fetchBillData = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const orderIdsParam = searchParams.get('orderIds');

        const orderIds = orderIdsParam
          ? orderIdsParam.split('&&').map(id => id.trim()).filter(id => id)
          : [];

        if (orderIds.length === 0) {
          setError('No order IDs found in the URL');
          setLoading(false);
          return;
        }

        const institution = searchParams.get('institution') || institutionData.institution;

        const apiEndpoint = '/admin/get-receipt';

        const response = await API.get('main', apiEndpoint, {
          queryStringParameters: {
            institution,
            orderIds: orderIds.join(',')
          }
        });

        setBillData(response);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch bill data');
        setLoading(false);
        console.error('Error fetching bill:', err);
      }
    };

    fetchBillData();
  }, [institutionData]);

  // Format date and time
  const formatDateTime = (billData) => {
    const earliestTimestamp = billData.orders && billData.orders.length > 0
      ? Math.min(...billData.orders.map(order => order.createdAt))
      : Date.now();

    const orderDate = new Date(Number(earliestTimestamp));

    return orderDate.toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).replace(",", "");
  };

  // Print bill function
  const printBill = () => {
    window.print();
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-500"></div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  // Ensure billData exists before rendering
  if (!billData) {
    return null;
  }

  // Calculate totals based on mergedItems, similar to PrintBill
  const billSubtotal = billData.mergedItems
    ? billData.mergedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    : 0;

  const cgstRate = institutionData?.cgst !== undefined ? institutionData.cgst : 0;
  const sgstRate = institutionData?.sgst !== undefined ? institutionData.sgst : 0;
  const serviceTaxRate = institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0;

  const calculatedCgst = (billSubtotal * cgstRate) / 100;
  const calculatedSgst = (billSubtotal * sgstRate) / 100;
  const calculatedServiceTax = (billSubtotal * serviceTaxRate) / 100;

  let calculatedTotal;
  if (institutionData.cgst === 0 || institutionData.sgst === 0) {
    calculatedTotal = Math.round(billSubtotal);
  } else {
    calculatedTotal = Math.round(billSubtotal + calculatedCgst + calculatedSgst + calculatedServiceTax);
  }

  // Calculate total quantity
  const totalQty = billData.mergedItems
    ? billData.mergedItems.reduce((sum, item) => sum + item.quantity, 0)
    : 0;

  const tableNumber = billData.orders[0]?.tableName || 'N/A';

  // Conditionally render subtotal row
  const subtotalRow = (institutionData.cgst === 0 || institutionData.sgst === 0)
    ? null
    : (
      <div className="summary-row">
        <span>Subtotal:</span>
        <span>₹{billSubtotal.toFixed(2)}</span>
      </div>
    );

  return (
    <div className="bill-container">
      <div className="bill-header">
        <h1>{institutionData?.companyName || "Restaurant Name"}</h1>
        <p className="address">{institutionData?.Query_Address || "Restaurant Address"}</p>
        <div className="contact-info">
          <div>Contact: {institutionData?.Query_PhoneNumber || "N/A"}</div>
          <div>{formatDateTime(billData)}</div>
          <div>Table: {tableNumber}</div>
        </div>
        {institutionData?.gstin && <div className="gstin">GSTIN: {institutionData.gstin}</div>}
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {billData.mergedItems && billData.mergedItems.map((item, index) => (
            <tr key={index}>
              <td className="item-name">{item.name}</td>
              <td className="item-qty">{item.quantity}</td>
              <td className="item-rate">₹{item.price % 1 === 0 ? item.price : item.price.toFixed(2)}</td>
              <td className="item-total">₹{(item.price * item.quantity) % 1 === 0 ? item.price * item.quantity : (item.price * item.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="bill-summary">
        <div className="summary-row">
          <span>Total Qty:</span>
          <span>{totalQty}</span>
        </div>
        {subtotalRow}
        <div className="summary-row">
          <span>CGST ({cgstRate}%):</span>
          <span>₹{calculatedCgst.toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span>SGST ({sgstRate}%):</span>
          <span>₹{calculatedSgst.toFixed(2)}</span>
        </div>
        {calculatedServiceTax > 0 && (
          <div className="summary-row">
            <span>Service Tax ({serviceTaxRate}%):</span>
            <span>₹{calculatedServiceTax.toFixed(2)}</span>
          </div>
        )}
        <div className="summary-row grand-total">
          <span><b>Total (Including Taxes):</b></span>
          <span><b>₹{calculatedTotal.toFixed(2)}</b></span>
        </div>
      </div>

      <div className="bill-footer">
        <p>Thank you, visit again!</p>
        <p>Empower your business with tekkzy.com</p>
        <button
          onClick={printBill}
          className="print-button"
        >
          Print Bill
        </button>
      </div>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .bill-container, .bill-container * {
            visibility: visible;
          }
          .bill-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
          .print-button {
            display: none;
          }
        }

        .bill-container {
          font-family: 'Courier New', Courier, monospace;
          max-width: 80mm;
          margin: 0 auto;
          padding: 5mm;
          box-sizing: border-box;
          font-size: 10pt;
          line-height: 1.4;
          border: 1px solid #ddd;
        }

        .bill-header {
          text-align: center;
          margin-bottom: 5mm;
          border-bottom: 1px dashed #000;
          padding-bottom: 3mm;
        }

        .bill-header h1 {
          margin: 0;
          font-size: 14pt;
          font-weight: bold;
        }

        .bill-header .address {
          margin: 2mm 0;
          font-size: 9pt;
        }

        .contact-info {
          font-size: 9pt;
          text-align: center;
          line-height: 1.4;
        }

        .gstin {
          font-size: 9pt;
          text-align: center;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 3mm;
          font-size: 9pt;
        }

        .items-table thead {
          border-bottom: 1px solid #000;
        }

        .items-table th, .items-table td {
          padding: 1mm;
          text-align: left;
        }

        .items-table th {
          font-weight: bold;
          background-color: #f2f2f2;
        }

        .item-name { width: 40%; }
        .item-qty { width: 20%; text-align: center; }
        .item-rate { width: 20%; text-align: right; }
        .item-total { width: 20%; text-align: right; }

        .bill-summary {
          margin-top: 3mm;
          font-size: 10pt;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 1mm 0;
          border-bottom: 1px dashed #ddd;
        }

        .grand-total {
          font-weight: bold;
          border-bottom: none;
          border-top: 1px solid #000;
          padding-top: 2mm;
        }

        .bill-footer {
          text-align: center;
          margin-top: 5mm;
          font-size: 8pt;
          border-top: 1px dashed #000;
          padding-top: 3mm;
        }

        .print-button {
          margin-bottom: 10px;
          padding: 5px 10px;
          background-color: #f0f0f0;
          border: 1px solid #ddd;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default BillPage;
