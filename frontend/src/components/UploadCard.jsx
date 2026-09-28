import React, { useRef, useState } from "react";
import { UploadCloud, CheckCircle, AlertCircle, Calendar, Clock, FileText, Image, Edit3, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { getCurrentLocalDate, formatDisplayDate } from '../utils/dateUtils';
import { apiFetch } from "../config/api";


export default function UploadCard() {
  const [extractedData, setExtractedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [fileType, setFileType] = useState(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [manualData, setManualData] = useState({
    vendor: '',
    amount: '',
    category: '',
    date: getCurrentLocalDate(),
    items: [],
    tags: []
  });
  const fileInput = useRef();

  const categories = [
    'Food & Dining',
    'Shopping',
    'Transportation',
    'Bills & Utilities',
    'Healthcare',
    'Entertainment',
    'Travel',
    'Education',
    'Groceries',
    'Other'
  ];

  const handleAddTag = (target) => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (!trimmed) return;
    if (target === 'manual') {
      if (!manualData.tags?.includes(trimmed)) {
        setManualData(prev => ({ ...prev, tags: [...(prev.tags || []), trimmed] }));
      }
    } else if (extractedData) {
      if (!extractedData.tags?.includes(trimmed)) {
        setExtractedData(prev => ({ ...prev, tags: [...(prev.tags || []), trimmed] }));
      }
    }
    setTagInput('');
  };

  const handleRemoveTag = (target, tagToRemove) => {
    if (target === 'manual') {
      setManualData(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tagToRemove) }));
    } else if (extractedData) {
      setExtractedData(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tagToRemove) }));
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload an image file (JPEG, PNG, GIF, BMP) or PDF document');
      return;
    }
    
    setLoading(true);
    setError("");
    setExtractedData(null);
    setFileType(file.type);

    try {
      const formData = new FormData();
      formData.append(file.type === 'application/pdf' ? 'pdf' : 'image', file);

      const response = await apiFetch('/api/process-bill', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        if (result.manual_entry_required) {
          setExtractedData({
            ...result,
            vendor: 'Enter vendor name',
            amount: 0,
            category: 'Select category',
            date: getCurrentLocalDate(),
            items: ['Manual entry required - Install Tesseract OCR for automatic extraction'],
            tags: [],
            receipt_url: result.receipt_url || null
          });
          setError('Tesseract OCR not installed. Please enter details manually or install Tesseract for automatic extraction.');
        } else {
          setExtractedData({
            ...result,
            tags: result.tags || [],
            receipt_url: result.receipt_url || null
          });
          setError(null);
        }
      } else {
        setError(result.error || 'Failed to process bill');
      }
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('Cannot connect to backend. Please ensure the backend server is running on http://localhost:5000.');
      } else if (err.message.includes('HTTP error')) {
        setError(`Backend error: ${err.message}. Check backend console for details.`);
      } else {
        setError(`Upload failed: ${err.message}`);
      }
      console.error('Upload error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToExpenses = async () => {
    const dataToSave = manualEntry ? manualData : extractedData;
    if (!dataToSave) return;
    
    // Validate manual entry fields
    if (manualEntry) {
      if (!manualData.vendor.trim()) {
        setError('Please enter vendor name');
        return;
      }
      if (!manualData.amount || manualData.amount <= 0) {
        setError('Please enter a valid amount');
        return;
      }
      if (!manualData.category) {
        setError('Please select a category');
        return;
      }
    }
    
    try {
      setLoading(true);
      setError("");
      
      // Create expense object with validated date
      const rawDate = dataToSave.date || dataToSave.dates?.[0];
      let validDate = getCurrentLocalDate(); // Default to current date
      
      if (rawDate && rawDate !== 'Invalid Date' && rawDate !== '') {
        // Clean the date string - remove time if present
        const cleanDate = String(rawDate).split(' ')[0];
        
        // Validate the date format
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
          const testDate = new Date(cleanDate);
          if (!isNaN(testDate.getTime())) {
            validDate = cleanDate;
          }
        }
      }
      
      const expenseData = {
        vendor: dataToSave.vendor,
        amount: parseFloat(dataToSave.amount) || dataToSave.total_amount,
        currency: dataToSave.currency || 'INR',
        category: dataToSave.category,
        date: validDate,
        items: dataToSave.items || [],
        receipt_url: dataToSave.receipt_url || null,
        tags: dataToSave.tags || []
      };
      
      // Send to backend
      const response = await apiFetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expenseData)
      });

      const result = await response.json();
      
      if (result.success) {
        setSaved(true);
        
        // Trigger refresh of expenses list and charts
        window.dispatchEvent(new CustomEvent('expenseAdded', { detail: result.expense }));
        
        // Show success message and reset
        setTimeout(() => {
          setSaved(false);
          setExtractedData(null);
          if (manualEntry) {
            setManualData({
              vendor: '',
              amount: '',
              category: '',
              date: getCurrentLocalDate(),
              items: [],
              tags: []
            });
            setManualEntry(false);
          }
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to save expense');
      }
      
    } catch (err) {
      setError(`Failed to save expense: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntryToggle = () => {
    setManualEntry(!manualEntry);
    setExtractedData(null);
    setError("");
    if (!manualEntry) {
      setManualData({
        vendor: '',
        amount: '',
        category: '',
        date: getCurrentLocalDate(),
        items: [],
        tags: []
      });
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <motion.div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex flex-col gap-4 border border-gray-100 dark:border-gray-700" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* System Status and Date Info */}
      <div className="mb-2 p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Current Date</span>
          </div>
          <span className="text-sm text-blue-700 dark:text-blue-300 font-semibold">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}
          </span>
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          Today: {getCurrentLocalDate()} | Unspecified transaction dates will default to today.
        </p>
      </div>
      
      {/* Manual Entry Toggle */}
      <div className="flex justify-center mb-4">
        <button
          onClick={handleManualEntryToggle}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
            manualEntry 
              ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800' 
              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800'
          }`}
        >
          {manualEntry ? (
            <>
              <UploadCloud size={16} />
              Switch to File Upload
            </>
          ) : (
            <>
              <Edit3 size={16} />
              Manual Entry
            </>
          )}
        </button>
      </div>

      {/* Manual Entry Form */}
      {manualEntry && (
        <div className="space-y-4 p-4 bg-orange-50/60 dark:bg-amber-950/20 rounded-xl border border-orange-200 dark:border-amber-900/40">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 mb-2">
            <Plus size={16} />
            <span className="font-semibold text-sm">Add Expense Manually</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vendor Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Vendor Name *
              </label>
              <input
                type="text"
                value={manualData.vendor}
                onChange={(e) => setManualData(prev => ({...prev, vendor: e.target.value}))}
                placeholder="Enter vendor/store name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Amount Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                value={manualData.amount}
                onChange={(e) => setManualData(prev => ({...prev, amount: e.target.value}))}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Category Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Category *
              </label>
              <select
                value={manualData.category}
                onChange={(e) => setManualData(prev => ({...prev, category: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            {/* Date Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={manualData.date}
                onChange={(e) => setManualData(prev => ({...prev, date: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Tags Section for Manual Entry */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Tags (Optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag("manual"))}
                placeholder="e.g. groceries, office, team-lunch"
                className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => handleAddTag("manual")}
                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold"
              >
                Add Tag
              </button>
            </div>
            {manualData.tags && manualData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {manualData.tags.map(t => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 rounded-full"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag("manual", t)}
                      className="hover:text-red-500 ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Add Button for Manual Entry */}
          <button 
            onClick={handleAddToExpenses}
            disabled={loading || saved || !manualData.vendor.trim() || !manualData.amount || !manualData.category}
            className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition ${
              saved 
                ? 'bg-green-600 text-white' 
                : 'bg-orange-600 text-white hover:bg-orange-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Saving...
              </div>
            ) : saved ? (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle size={16} />
                Added Successfully!
              </div>
            ) : (
              'Add Manual Expense'
            )}
          </button>
        </div>
      )}
      
      {/* File Upload Area */}
      {!manualEntry && (
        <div
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center h-40 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 bg-gray-50/50 dark:bg-gray-700/20 transition"
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInput.current.click()}
        >
          <div className="flex items-center gap-3 mb-2">
            <Image size={24} className="text-blue-500" />
            <FileText size={24} className="text-red-500" />
          </div>
          <UploadCloud size={28} className="text-gray-400 dark:text-gray-500 mb-1" />
          <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">Upload Invoice or Receipt</span>
          <span className="text-gray-500 dark:text-gray-400 text-xs">Supports Images (JPG, PNG) and PDF bills</span>
          <input 
            type="file" 
            ref={fileInput} 
            className="hidden" 
            accept="image/*,application/pdf"
            onChange={e => handleFile(e.target.files[0])} 
          />
        </div>
      )}
      
      {/* Status Messages */}
      {loading && (
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 p-3 rounded-lg text-sm border border-blue-100 dark:border-blue-900/50">
          <div className="animate-spin w-4 h-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full"></div>
          <span>
            Processing {fileType === 'application/pdf' ? 'PDF invoice' : 'receipt image'} with OCR and ML...
          </span>
        </div>
      )}
      
      {error && (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/50">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      
      {/* Success notification */}
      {saved && (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 p-3 rounded-lg border border-green-200 dark:border-green-900/50">
          <CheckCircle size={16} />
          <div>
            <span className="font-semibold text-sm">Expense saved successfully!</span>
            <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
              ₹{(manualEntry ? parseFloat(manualData.amount) : (extractedData?.total_amount || extractedData?.amount))?.toFixed(2)} expense from {manualEntry ? manualData.vendor : extractedData?.vendor} has been added to your records.
            </p>
          </div>
        </div>
      )}
      
      {/* Extracted Data Display */}
      {extractedData && !manualEntry && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle size={16} />
              <span className="font-semibold text-sm">Bill Processed Successfully</span>
            </div>
            {extractedData.receipt_url && (
              <span className="text-xs bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                Receipt Archived
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-600">
              <h3 className="font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Vendor</h3>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{extractedData.vendor}</p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-600">
              <h3 className="font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Amount</h3>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                ₹{(extractedData.amount || extractedData.total_amount || 0).toFixed(2)}
                <span className="text-xs font-normal text-gray-500 ml-1">({extractedData.currency || 'INR'})</span>
              </p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-600">
              <h3 className="font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Category</h3>
              <p className="text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded-full inline-block">
                {extractedData.category}
              </p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-600">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={13} className="text-gray-500 dark:text-gray-400" />
                <h3 className="font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</h3>
              </div>
              {(() => {
                const dateInfo = formatDisplayDate(extractedData.date || extractedData.dates?.[0]);
                return (
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{dateInfo.formatted}</p>
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      {dateInfo.note}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Tags for Extracted Bill */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Attach Tags
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag("extracted"))}
                placeholder="e.g. business, travel, software"
                className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => handleAddTag("extracted")}
                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold"
              >
                Add Tag
              </button>
            </div>
            {extractedData.tags && extractedData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {extractedData.tags.map(t => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-full"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag("extracted", t)}
                      className="hover:text-red-500 ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {extractedData.items && extractedData.items.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-600">
              <h3 className="font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Line Items</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {extractedData.items.slice(0, 5).map((item, index) => (
                  <p key={index} className="text-xs text-gray-700 dark:text-gray-300">• {item}</p>
                ))}
                {extractedData.items.length > 5 && (
                  <p className="text-xs text-gray-400">... and {extractedData.items.length - 5} more items</p>
                )}
              </div>
            </div>
          )}
          
          <button 
            onClick={handleAddToExpenses}
            disabled={loading || saved}
            className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition ${
              saved 
                ? 'bg-green-600 text-white' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Saving...
              </div>
            ) : saved ? (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle size={16} />
                Added Successfully!
              </div>
            ) : (
              'Save to Expenses'
            )}
          </button>
        </div>
      )}
      
      {/* OCR Preview for debugging */}
      {extractedData && !manualEntry && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            View Raw OCR Text
          </summary>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mt-2 text-gray-700 dark:text-gray-300 max-h-32 overflow-auto font-mono">
            {extractedData.extracted_text || "No text extracted"}
          </div>
        </details>
      )}
    </motion.div>
  );
}
