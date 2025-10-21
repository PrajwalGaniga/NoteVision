import React, { useState } from 'react';
import './App.css';

// --- Receive notebookId AND onNoteSaved as props ---
function Uploader({ notebookId, onNoteSaved }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [finalSummary, setFinalSummary] = useState('');
  const [statusMessage, setStatusMessage] = useState('Please select an image to upload.');
  const token = localStorage.getItem('token'); // Get token for API calls

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setStatusMessage('File selected. Click "Upload & Summarize".');
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setStatusMessage('Error: No file selected!');
      return;
    }
    if (!token) {
      setStatusMessage('Error: Not logged in.');
      return;
    }
    if (!notebookId) {
      setStatusMessage('Error: Cannot determine notebook ID.');
      console.error("ERROR: notebookId prop is missing in Uploader!");
      return;
    }

    setStatusMessage('Step 1: Uploading and extracting text...');
    console.log(`DEBUG: Uploading for notebook ID: ${notebookId}`);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // --- STEP 1: OCR ---
      const ocrResponse = await fetch('http://127.0.0.1:8000/upload-image/', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (!ocrResponse.ok) {
        const errorData = await ocrResponse.json();
        if (ocrResponse.status === 401) throw new Error('Session expired.');
        throw new Error(`OCR Error: ${errorData.detail || 'Failed'}`);
      }
      const ocrData = await ocrResponse.json();
      const rawText = ocrData.extracted_text;

      setStatusMessage('Step 2: Summarizing text with AI...');
      console.log('DEBUG: Step 1 - Got raw text, sending to summarize...');

      // --- STEP 2: SUMMARIZE ---
      const summaryResponse = await fetch('http://127.0.0.1:8000/summarize-text/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: rawText }),
      });
      if (!summaryResponse.ok) {
        const errorData = await summaryResponse.json();
        if (summaryResponse.status === 401) throw new Error('Session expired.');
        throw new Error(`Summarize Error: ${errorData.detail || 'Failed'}`);
      }
      const summaryData = await summaryResponse.json();
      const summary = summaryData.summary;
      setFinalSummary(summary); // Show the summary immediately

      setStatusMessage('Step 3: Saving note to notebook...');
      console.log('DEBUG: Step 2 - Got summary, sending to save...');

      // --- STEP 3: SAVE NOTE ---
      const saveNoteResponse = await fetch(`http://127.0.0.1:8000/notebooks/${notebookId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: summary }), // Send the summary as content
      });

      if (!saveNoteResponse.ok) {
        const errorData = await saveNoteResponse.json();
        if (saveNoteResponse.status === 401) throw new Error('Session expired.');
        throw new Error(`Save Note Error: ${errorData.detail || 'Failed'}`);
      }

      const savedNoteData = await saveNoteResponse.json();
      console.log('DEBUG: Step 3 - Note saved successfully:', savedNoteData);
      setStatusMessage('Success! Note saved.');

      // --- !! CALL THE CALLBACK FUNCTION !! ---
      // This sends the newly saved note back up to NotebookView
      if (onNoteSaved) {
        onNoteSaved(savedNoteData);
      }

      // --- Optional: Clear the uploader after success ---
      // setSelectedFile(null);
      // // Find the file input and reset its value
      // const fileInput = document.querySelector('input[type="file"]');
      // if (fileInput) {
      //   fileInput.value = '';
      // }
      // setFinalSummary(''); // Clear the preview

    } catch (error) {
      console.error('ERROR: Process failed:', error);
      setStatusMessage(`Error: ${error.message}. Please try again or log out.`);
    }
  };

  return (
    // The JSX part of the uploader remains unchanged
    <div className="App-container">
      <header>
        <h1>Add Note to Notebook</h1> {/* Updated title */}
      </header>
      <main>
        <div className="upload-box">
          <input type="file" onChange={handleFileChange} accept="image/*" />
          <button onClick={handleUpload}>Upload, Summarize, and Save</button> {/* Updated button text */}
        </div>
        <div className="status-box">
          <p>{statusMessage}</p>
        </div>
        <div className="output-box">
          <h2>Summary Preview:</h2>
          <pre>{finalSummary || 'Summary will appear here after processing...'}</pre>
        </div>
      </main>
    </div>
  );
}

export default Uploader;