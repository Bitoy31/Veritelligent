import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/student.css';
import QRScanner from '../../components/QRScanner';

interface Class {
  _id: string;
  className: string;
  description: string;
  teacherName: string;
  status: 'pending' | 'enrolled' | string;
}

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  // Join Class UI state (scoped sjc-*)
  const [sjcSubjectId, setSjcSubjectId] = useState('');
  const [sjcLoading, setSjcLoading] = useState(false);
  const [sjcMessage, setSjcMessage] = useState<string | null>(null);
  const [sjcError, setSjcError] = useState<string | null>(null);
  const [sjcShowQR, setSjcShowQR] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        // Get user from localStorage
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        console.log('User from localStorage:', user);
        
        if (!user._id) {
          console.error('No user ID found');
          setLoading(false);
          return;
        }

        console.log('Fetching subjects (all statuses) for user ID:', user._id);
        const response = await fetch(`http://localhost:5000/api/subjects/student/${user._id}/all`);

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (response.status === 401) {
          // Token expired or invalid - clear storage and redirect to login
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/login';
          return;
        }

        if (response.ok) {
          const data = await response.json();
          console.log('Raw enrolled subjects data:', data);
          
          // Transform the data to match our Class interface
          const transformedClasses = data.map((subject: any) => ({
            _id: subject._id,
            className: subject.name,
            description: subject.code,
            teacherName: subject.teacher?.name || 'Unknown Teacher',
            status: (subject.enrolledStudents || []).find((s: any) => String(s.studentId) === String(user._id))?.status || 'pending'
          }));
          
          console.log('Transformed classes:', transformedClasses);
          setClasses(transformedClasses);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to fetch enrolled subjects:', errorData);
          setClasses([]);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching classes:', error);
        setClasses([]);
        setLoading(false);
      }
    };

    fetchClasses();
  }, []);

  // API helpers for join
  const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token') || '';

  const removeEnrollment = async (subjectId: string) => {
    try {
      const response = await fetch(`http://localhost:5000/api/subjects/${subjectId}/enrolled/${JSON.parse(localStorage.getItem('user')||'{}')._id}`, {
        method: 'DELETE'
      });
      
      if (response.status === 401) {
        // Token expired or invalid - clear storage and redirect to login
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/login';
        return;
      }
      
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Failed');
      // Refresh
      window.location.reload();
    } catch (err) {
      console.error('Remove enrollment failed:', err);
    }
  };

  const handleJoinById = async () => {
    setSjcMessage(null);
    setSjcError(null);
    if (!sjcSubjectId.trim()) { setSjcError('Please enter a subject ID'); return; }
    setSjcLoading(true);
    try {
      const token = getToken();
      if (!token) {
        setSjcError('You are not logged in. Please log in again.');
        setTimeout(() => {
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/login';
        }, 2000);
        return;
      }

      const response = await fetch('http://localhost:5000/api/join/join-by-id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subjectId: sjcSubjectId.trim() })
      });

      if (response.status === 401) {
        // Token expired or invalid - clear storage and redirect to login
        setSjcError('Your session has expired. Please log in again.');
        localStorage.clear();
        sessionStorage.clear();
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setSjcMessage(data?.message || 'Successfully joined class');
        // Refresh the classes list after joining
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to join class');
      }
    } catch (e: any) {
      setSjcError(e.message || 'Unable to join class');
    } finally {
      setSjcLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="student-dashboard">
      <div className="sjc-toolbar">
        <h1 className="sjc-title-main">My Classes</h1>
        <div className="sjc-inline">
          <input
            id="sjc-subject-id"
            className="sjc-input"
            type="text"
            value={sjcSubjectId}
            placeholder="Join via subject ID (e.g., 6858f75a16b5be1db813f637)"
            onChange={(e) => setSjcSubjectId(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleJoinById(); }}
          />
          <button className="sjc-btn sjc-btn-primary" disabled={sjcLoading} onClick={handleJoinById} title="Join by subject ID">
            {sjcLoading ? 'Joining' : 'Join Class'}
          </button>
          <button className="sjc-btn sjc-btn-qr" onClick={() => setSjcShowQR(true)} title="Scan QR">
            <i className="fas fa-qrcode"></i>
          </button>
        </div>
      </div>

      {(sjcMessage || sjcError) && (
        <div className="sjc-flash">
          {sjcMessage && <span className="sjc-success">{sjcMessage}</span>}
          {sjcError && <span className="sjc-error">{sjcError}</span>}
        </div>
      )}

      {sjcShowQR && (
        <div className="sjc-qr-modal" role="dialog" aria-modal="true">
          <div className="sjc-qr-card">
            <div className="sjc-qr-head">
              <h3>Scan Class QR</h3>
              <button className="sjc-qr-close" onClick={() => setSjcShowQR(false)} aria-label="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="sjc-qr-body">
              <QRScanner onCodeScanned={(code: string) => { setSjcShowQR(false); setSjcSubjectId(code); }} />
            </div>
          </div>
        </div>
      )}

      {/* Enrolled Classes Section (responsive) */}
      <section className="scl-section">
        <div className="scl-head">
          <h2 className="scl-title">Enrolled Classes</h2>
          <span className="scl-count">{classes.length}</span>
        </div>

        {classes.length === 0 ? (
          <div className="scl-empty">
            <i className="fas fa-info-circle"></i>
            <p>You are not enrolled in any class yet. Join using the subject ID above or scan a QR.</p>
          </div>
        ) : (
          <div className="scl-grid">
            {classes.map((c) => (
              <div key={c._id} className="scl-card">
                <div className="scl-card-head">
                  <h3 className="scl-card-title">{c.className}</h3>
                </div>
                <p className="scl-card-desc">Code: {c.description}</p>
                <div className="scl-card-meta">
                  <span className="scl-teacher"><i className="fas fa-chalkboard-teacher"></i> {c.teacherName}</span>
                  <span className={`scl-badge ${c.status === 'enrolled' ? 'enrolled' : 'pending'}`}>{c.status === 'enrolled' ? 'Enrolled' : 'Pending'}</span>
                  <button className="sjc-btn sjc-btn-qr" onClick={() => removeEnrollment(c._id)} title={c.status === 'enrolled' ? 'Drop' : 'Cancel Request'}>
                    {c.status === 'enrolled' ? 'Drop' : 'Cancel'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Scoped styles for classes (scl-*) and toolbar (sjc-*) */}
      <style>{`
        /* Toolbar */
        .sjc-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 8px 0 12px; }
        .sjc-title-main { margin: 0; font-size: 2rem; font-weight: 700; color: #2c3e50; }
        .sjc-inline { display: flex; gap: 8px; align-items: center; }
        .sjc-input { flex: 1; background: #ffffff; border: 1px solid #e5e7eb; color: #2c3e50; border-radius: 8px; padding: 10px 12px; outline: none; }
        .sjc-input::placeholder { color: #9ca3af; }
        .sjc-input:focus { border-color: #03a696; box-shadow: 0 0 0 2px rgba(3,166,150,0.15); }
        .sjc-btn { border: none; border-radius: 8px; padding: 10px 14px; font-weight: 600; cursor: pointer; transition: filter 0.15s ease-in-out; }
        .sjc-btn[disabled] { opacity: 0.6; cursor: not-allowed; }
        .sjc-btn-primary { background: #03a696; color: #ffffff; }
        .sjc-btn-primary:hover { filter: brightness(0.95); }
        .sjc-btn-qr { background: #ffffff; color: #2c3e50; border: 1px solid #e5e7eb; padding: 10px 12px; }
        .sjc-flash { margin: 4px 0 8px; display: flex; gap: 8px; }
        .sjc-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 6px 10px; border-radius: 6px; }
        .sjc-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; padding: 6px 10px; border-radius: 6px; }
        .sjc-qr-modal { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(17, 24, 39, 0.4); z-index: 50; }
        .sjc-qr-card { width: 92%; max-width: 520px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
        .sjc-qr-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #2c3e50; }
        .sjc-qr-close { background: transparent; border: 0; color: #374151; cursor: pointer; }
        .sjc-qr-body { padding: 12px; background: #f9fafb; }

        /* Enrolled classes */
        .scl-section { margin-top: 12px; }
        .scl-head { display: flex; align-items: center; gap: 8px; margin: 8px 0 12px; }
        .scl-title { margin: 0; font-size: 1.25rem; font-weight: 700; color: #2c3e50; }
        .scl-count { background: #03a696; color: #fff; border-radius: 999px; padding: 2px 10px; font-weight: 700; font-size: 0.85rem; }
        .scl-empty { display: flex; gap: 8px; align-items: center; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; color: #6b7280; }
        .scl-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .scl-card { text-align: left; display: flex; flex-direction: column; gap: 6px; padding: 14px; border-radius: 12px; background: #ffffff; border: 1px solid #e5e7eb; }
        .scl-card-head { display: flex; align-items: center; justify-content: space-between; }
        .scl-card-title { margin: 0; font-size: 1rem; font-weight: 700; color: #2c3e50; }
        .scl-card-desc { margin: 0; color: #6b7280; font-size: 0.9rem; min-height: 36px; }
        .scl-card-meta { display: flex; justify-content: space-between; align-items: center; color: #6b7280; font-size: 0.85rem; }
        .scl-teacher { display: inline-flex; align-items: center; gap: 6px; }

        /* Responsive */
        @media (max-width: 900px) {
          .scl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 600px) {
          .sjc-inline { flex-wrap: wrap; }
          .scl-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default StudentDashboard;