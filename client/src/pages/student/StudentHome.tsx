import React, { useMemo, useState } from 'react';

const StudentHome: React.FC<{ student: any }> = ({ student }) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<any>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const token = useMemo(() => (
        localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    ), []);

    const apiFetch = async (path: string, init?: RequestInit) => {
        const base = (import.meta as any).env?.VITE_API_URL || '/api';
        const res = await fetch(`${base}${path}`, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                Authorization: token ? `Bearer ${token}` : '',
                ...(init?.headers || {})
            }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = (data && (data.message || data.error)) || 'Request failed';
            throw new Error(msg);
        }
        return data;
    };

    const handlePreview = async () => {
        setMessage(null);
        setError(null);
        setPreview(null);
        if (!code.trim()) { setError('Please enter a class code'); return; }
        setLoading(true);
        try {
            const data = await apiFetch(`/subjects/by-code/${encodeURIComponent(code.trim())}`);
            setPreview(data);
        } catch (e: any) {
            setError(e.message || 'Subject not found');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        setMessage(null);
        setError(null);
        if (!code.trim()) { setError('Please enter a class code'); return; }
        setLoading(true);
        try {
            const data = await apiFetch('/subjects/join', {
                method: 'POST',
                body: JSON.stringify({ code: code.trim() })
            });
            setMessage(data?.message || 'Join request submitted');
            setPreview(data?.subject || preview);
        } catch (e: any) {
            setError(e.message || 'Unable to join class');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="class-list">
            <h2>My Classes</h2>
            <div className="class-grid">
                {student.classes?.map((classItem: any, index: number) => (
                    <div key={index} className="class-card">
                        <h3>{classItem.subject}</h3>
                        <p className="teacher">Prof. {classItem.teacher}</p>
                        <p className="schedule">{classItem.schedule}</p>
                        <div className="task-count">
                            {classItem.tasks} Tasks
                        </div>
                    </div>
                ))}
            </div>

            {/* Join Class Panel (scoped classes sjc-*) */}
            <div className="sjc-wrap">
                <div className="sjc-card">
                    <div className="sjc-head">
                        <h3 className="sjc-title">Join a Class</h3>
                        <p className="sjc-sub">Enter the class code provided by your teacher.</p>
                    </div>

                    <div className="sjc-form">
                        <label htmlFor="sjc-code" className="sjc-label">Class Code</label>
                        <div className="sjc-row">
                            <input
                                id="sjc-code"
                                className="sjc-input"
                                type="text"
                                value={code}
                                placeholder="e.g. IT 111"
                                onChange={(e) => setCode(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handlePreview(); }}
                            />
                            <button className="sjc-btn sjc-btn-secondary" disabled={loading} onClick={handlePreview}>
                                {loading ? 'Checking...' : 'Preview'}
                            </button>
                            <button className="sjc-btn sjc-btn-primary" disabled={loading} onClick={handleJoin}>
                                {loading ? 'Joining...' : 'Join'}
                            </button>
                        </div>

                        {message && <div className="sjc-alert sjc-success">{message}</div>}
                        {error && <div className="sjc-alert sjc-error">{error}</div>}
                    </div>

                    {preview && (
                        <div className="sjc-preview">
                            <div className="sjc-rowp"><span className="sjc-pl">Subject</span><span className="sjc-pv">{preview.name || '—'}</span></div>
                            <div className="sjc-rowp"><span className="sjc-pl">Code</span><span className="sjc-pv">{preview.code || '—'}</span></div>
                            <div className="sjc-rowp"><span className="sjc-pl">Teacher</span><span className="sjc-pv">{preview.teacher?.name || '—'}</span></div>
                            <div className="sjc-rowp"><span className="sjc-pl">Students</span><span className="sjc-pv">{preview.enrolledCount ?? preview.enrolledStudents?.length ?? 0}</span></div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
            .sjc-wrap { margin-top: 24px; display: flex; justify-content: center; }
            .sjc-card { width: 100%; max-width: 720px; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; color: #e2e8f0; }
            .sjc-head { margin-bottom: 10px; }
            .sjc-title { margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #e2e8f0; }
            .sjc-sub { margin: 0; font-size: 13px; color: #94a3b8; }
            .sjc-form { margin-top: 10px; }
            .sjc-label { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px; }
            .sjc-row { display: flex; gap: 8px; align-items: center; }
            .sjc-input { flex: 1; background: #0b1220; border: 1px solid #1e293b; color: #e2e8f0; border-radius: 8px; padding: 10px 12px; outline: none; }
            .sjc-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
            .sjc-btn { border: none; border-radius: 8px; padding: 10px 14px; font-weight: 600; cursor: pointer; transition: opacity 0.15s ease-in-out; }
            .sjc-btn[disabled] { opacity: 0.6; cursor: not-allowed; }
            .sjc-btn-primary { background: #3b82f6; color: #fff; }
            .sjc-btn-secondary { background: #0b1220; color: #e2e8f0; border: 1px solid #1e293b; }
            .sjc-alert { margin-top: 10px; padding: 10px 12px; border-radius: 8px; font-size: 13px; }
            .sjc-success { background: #052e1c; color: #86efac; border: 1px solid #064e3b; }
            .sjc-error { background: #2a0d0d; color: #fda4af; border: 1px solid #7f1d1d; }
            .sjc-preview { margin-top: 12px; padding-top: 8px; border-top: 1px solid #1e293b; }
            .sjc-rowp { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
            .sjc-pl { color: #94a3b8; }
            .sjc-pv { color: #e2e8f0; font-weight: 600; }
            @media (max-width: 600px) { .sjc-row { flex-direction: column; align-items: stretch; } .sjc-btn { width: 100%; } }
            `}</style>
        </section>
    );
};

export default StudentHome;