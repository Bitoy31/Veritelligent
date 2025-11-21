import React, { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface QRScannerProps {
  onCodeScanned: (result: string) => void;
  onError?: (err: any) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onCodeScanned, onError }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [key, setKey] = useState(0); // Add key to force re-mount

  const initializeScanner = () => {
    // Clean up any existing scanner instance
    if (scannerRef.current) {
      scannerRef.current.clear()
        .then(() => {
          scannerRef.current = null;
          // Clean up the DOM
          const el = document.getElementById("qr-reader");
          if (el) el.innerHTML = "";
          
          // Create new scanner instance
          createNewScanner();
        })
        .catch((error) => {
          console.error("Error clearing scanner:", error);
          // Force cleanup and retry
          scannerRef.current = null;
          const el = document.getElementById("qr-reader");
          if (el) el.innerHTML = "";
          createNewScanner();
        });
    } else {
      createNewScanner();
    }
  };

  const createNewScanner = () => {
    if (document.getElementById("qr-reader")) {
      try {
        scannerRef.current = new Html5QrcodeScanner(
          "qr-reader",
          { 
            fps: 10,
            qrbox: 180,
            aspectRatio: 1.0,
            rememberLastUsedCamera: false,
            showTorchButtonIfSupported: true,
          },
          false
        );

        scannerRef.current.render(
          (decodedText) => {
            if (decodedText) {
              onCodeScanned(decodedText);
              // Stop scanning and clear resources after successful scan
              if (scannerRef.current) {
                scannerRef.current.clear()
                  .then(() => {
                    scannerRef.current = null;
                    setKey(prev => prev + 1); // Force re-mount after successful scan
                  })
                  .catch(console.error);
              }
            }
          },
          (error) => {
            if (
              onError && 
              error && 
              typeof error === "object" && 
              "name" in error && 
              (error as any).name !== "NotFoundException"
            ) {
              onError(error);
            }
          }
        );
      } catch (error) {
        console.error("Error creating scanner:", error);
        // Force a component remount if scanner creation fails
        setKey(prev => prev + 1);
      }
    }
  };

  useEffect(() => {
    initializeScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear()
          .then(() => {
            scannerRef.current = null;
            const el = document.getElementById("qr-reader");
            if (el) el.innerHTML = "";
          })
          .catch((error) => {
            console.error("Error in cleanup:", error);
            // Force cleanup
            scannerRef.current = null;
            const el = document.getElementById("qr-reader");
            if (el) el.innerHTML = "";
          });
      }
    };
  }, [key]); // Re-run effect when key changes

  return (
    <div className="qr-scanner">
      <div id="qr-reader" />
      {!scannerRef.current && (
        <button 
          onClick={() => setKey(prev => prev + 1)}
          className="restart-scanner-button"
        >
          Restart Scanner
        </button>
      )}
    </div>
  );
};

export default QRScanner;