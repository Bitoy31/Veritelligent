import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/results_leaderboard.css';

const Management: React.FC = () => {
  const [teacher, setTeacher] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [subjectForm, setSubjectForm] = useState({
    code: '',
    name: '',
  });
  const [editSubject, setEditSubject] = useState({ code: '', name: '' });
  const [editing, setEditing] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [allEnrolled, setAllEnrolled] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSort, setStudentSort] = useState<'status' | 'subjectName' | 'subjectCode'>('status');
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrSubject, setQrSubject] = useState<any | null>(null);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get teacher data from localStorage (adjust key as needed)
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    setTeacher(userData);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/');
  };

  // Helper to get middle initial
  const getMiddleInitial = (mname: string) => {
    if (!mname) return '';
    return ` ${mname[0].toUpperCase()}.`;
  };

  useEffect(() => {
    if (!teacher?._id) return;
    setLoadingSubjects(true);
    fetch(`http://localhost:5000/api/subjects?teacherId=${teacher._id}`)
      .then(res => res.json())
      .then(data => setSubjects(data))
      .finally(() => setLoadingSubjects(false));
  }, [teacher]);

  useEffect(() => {
    if (!teacher?._id) return;
    // Fetch all subjects for this teacher
    fetch(`http://localhost:5000/api/subjects?teacherId=${teacher._id}`)
      .then(res => res.json())
      .then(async (subjects) => {
        // For each subject, fetch enrolled students
        const all: any[] = [];
        for (const subj of subjects) {
            const res = await fetch(`http://localhost:5000/api/subjects/${subj._id}/enrolled`);
            const students = await res.json();
            students.forEach((student: any) => {
            all.push({
                ...student,
                subjectName: subj.name,
                subjectCode: subj.code,
                subjectId: subj._id,
            });
            });
        }
        setAllEnrolled(all);
        });
  }, [teacher]);

  const handleShowStudents = async (subject: any) => {
    setSelectedSubject(subject);
    setEditSubject({ code: subject.code, name: subject.name });
    setEditing(false);
    setShowStudentsModal(true);
    setStudentsList([]);
    try {
      const res = await fetch(`http://localhost:5000/api/subjects/${subject._id}/enrolled`);
      setStudentsList(await res.json());
    } catch {
      setStudentsList([]);
    }
  };

  const filteredEnrolled = allEnrolled
  .filter(student => student && typeof student === 'object' && student.name && student.subjectName && student.subjectCode && student.status)
  .filter(student =>
    student.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    student.subjectName.toLowerCase().includes(studentSearch.toLowerCase()) ||
    student.subjectCode.toLowerCase().includes(studentSearch.toLowerCase())
  )
  .sort((a, b) => {
    if (studentSort === 'status') return a.status.localeCompare(b.status);
    if (studentSort === 'subjectName') return a.subjectName.localeCompare(b.subjectName);
    if (studentSort === 'subjectCode') return a.subjectCode.localeCompare(b.subjectCode);
    return 0;
  });

  return (
    <div className="rlb-page">
      <div className="rlb-header">
        <div>
          <button className="qm-back-btn" onClick={() => navigate('/home')}>
            <i className="fas fa-arrow-left"></i>
            <span>Back to Home</span>
          </button>
          <h2 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>Subject & Student Management</h2>
          <div className="rlb-subtitle">Manage your subjects and enrolled students</div>
        </div>
        <div className="profile-section" ref={dropdownRef} style={{ position: 'relative' }}>
          {teacher && (
            <>
              <span className="profile-name" style={{ marginRight: '0.5rem' }}>
                {teacher.userFname}
                {getMiddleInitial(teacher.userMname)}
                {' '}
                {teacher.userLname}
              </span>
              <img
                src={teacher.userProfile || '/default-profile.png'}
                alt="Profile"
                className="profile-avatar"
                style={{ cursor: 'pointer', width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #03a696' }}
                onClick={() => setShowDropdown((prev) => !prev)}
              />
              {showDropdown && (
                <div className="profile-management-dropdown" style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 4px 16px rgba(44,62,80,0.12)', minWidth: '150px', zIndex: 10, display: 'flex', flexDirection: 'column', padding: '0.5rem 0' }}>
                  <button onClick={() => navigate('/profile/edit')} style={{ background: 'none', border: 'none', color: '#222', textAlign: 'left', padding: '0.7rem 1.2rem', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                    <i className="fas fa-user-edit"></i> Edit Profile
                  </button>
                  <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#222', textAlign: 'left', padding: '0.7rem 1.2rem', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                    <i className="fas fa-sign-out-alt"></i> Logout
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Subjects Section */}
      <section className="rlb-card" style={{ marginBottom: '2rem' }}>
        <div className="rlb-card-head">
          <h3>Subjects</h3>
          <div className="rlb-actions">
            <button className="rlb-btn rlb-btn-primary" onClick={() => setShowAddSubject(true)}>
              <i className="fas fa-plus"></i> Add Subject
            </button>
          </div>
        </div>
        {showAddSubject && (
          <div className="modal-overlay" onClick={() => setShowAddSubject(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Add Subject</h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const teacherData = {
                    _id: String(teacher?._id),
                    name: `${teacher?.userFname}${teacher?.userMname ? ' ' + teacher.userMname[0].toUpperCase() + '.' : ''} ${teacher?.userLname}`,
                  };
                  const payload = {
                    code: subjectForm.code,
                    name: subjectForm.name,
                    teacher: teacherData,
                    DateCreated: new Date().toISOString(),
                  };
                  try {
                    const res = await fetch('http://localhost:5000/api/subjects', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    if (!res.ok) throw new Error('Failed to add subject');
                    const updated = await fetch(`http://localhost:5000/api/subjects?teacherId=${teacher._id}`);
                    setSubjects(await updated.json());
                    setShowAddSubject(false);
                    setSubjectForm({ code: '', name: '' });
                    alert('Subject added successfully!');
                  } catch (err) {
                    alert('Failed to add subject');
                  }
                }}
              >
                <label>
                  Subject Code:
                  <input
                    type="text"
                    value={subjectForm.code}
                    onChange={e => setSubjectForm(f => ({ ...f, code: e.target.value }))}
                    required
                    style={{ marginTop: '0.5rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', width: '100%' }}
                  />
                </label>
                <label>
                  Subject Name:
                  <input
                    type="text"
                    value={subjectForm.name}
                    onChange={e => setSubjectForm(f => ({ ...f, name: e.target.value }))}
                    required
                    style={{ marginTop: '0.5rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', width: '100%' }}
                  />
                </label>
                <div className="modal-actions">
                  <button type="submit" className="rlb-btn rlb-btn-primary">Add</button>
                  <button type="button" className="rlb-btn rlb-btn-secondary" onClick={() => setShowAddSubject(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
        <div className="rlb-table-wrap">
          {loadingSubjects ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', marginBottom: '1rem' }}></i>
              <p>Loading subjects...</p>
            </div>
          ) : subjects.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              <p>No subjects yet. Click "Add Subject" to create one.</p>
            </div>
          ) : (
            <div className="mgmt-cards-grid">
              {subjects.map((subj) => (
                <div key={subj._id} className="mgmt-card" onClick={() => handleShowStudents(subj)}>
                  <div className="mgmt-card-content">
                    <div className="mgmt-card-header">
                      <span className="mgmt-card-code">{subj.code}</span>
                      <div className="mgmt-card-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="mgmt-icon-btn"
                          title="Show QR for students to join"
                          onClick={() => { setQrSubject(subj); setShowQRModal(true); }}
                        >
                          <i className="fas fa-qrcode"></i>
                        </button>
                        <button
                          className="mgmt-icon-btn mgmt-delete-btn"
                          title="Delete Subject"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm('Delete this subject?')) return;
                            try {
                              const res = await fetch(`http://localhost:5000/api/subjects/${subj._id}`, {
                                method: 'DELETE',
                              });
                              if (!res.ok) throw new Error('Failed to delete');
                              setSubjects(subjects.filter(s => s._id !== subj._id));
                            } catch {
                              alert('Failed to delete subject');
                            }
                          }}
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                    <div className="mgmt-card-title">{subj.name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Enrolled Students Section */}
      <section className="rlb-card">
        <div className="rlb-card-head">
          <h3>Enrolled Students</h3>
          <div className="muted">Total: {filteredEnrolled.length}</div>
        </div>
        <div className="rlb-toolbar" style={{ display: 'flex' }}>
          <div className="rlb-field" style={{ flex: '1', maxWidth: '400px' }}>
            <label>Search</label>
            <input
              type="text"
              placeholder="Search by name or subject..."
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              style={{ width: 'calc(100% - 12px)', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
            />
          </div>
          <div className="rlb-field" style={{ maxWidth: '200px' }}>
            <label>Sort By</label>
            <select
              value={studentSort}
              onChange={e => setStudentSort(e.target.value as any)}
              style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
            >
              <option value="status">Status</option>
              <option value="subjectName">Subject Name</option>
              <option value="subjectCode">Subject Code</option>
            </select>
          </div>
        </div>
        <div className="rlb-table-wrap">
          {filteredEnrolled.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              <p>No enrolled students found.</p>
            </div>
          ) : (
            <div className="mgmt-cards-grid">
              {filteredEnrolled.map((student) => (
                <div key={student.subjectId + '-' + student.studentId} className="mgmt-card mgmt-student-card">
                  <div className="mgmt-card-content">
                    <div className="mgmt-student-header-row">
                      <div className="mgmt-student-primary-info">
                        <div className="mgmt-student-name-row">
                          <span className={`mgmt-status-badge ${student.status}`}>
                            <span className={`status-indicator ${student.status}`}></span>
                            {student.status === 'enrolled' ? 'Enrolled' : 'Pending'}
                          </span>
                          <strong className="mgmt-student-name">{student.name}</strong>
                        </div>
                        <div className="mgmt-subject-info">
                          <i className="fas fa-book" style={{ fontSize: '0.75em', marginRight: '4px', color: '#03a696' }}></i>
                          <span className="mgmt-subject-text">{student.subjectCode} - {student.subjectName}</span>
                        </div>
                      </div>
                      <div className="mgmt-card-actions">
                        {student.status === 'pending' && (
                          <button
                            className="rlb-btn mgmt-action-btn"
                            style={{ background: '#ffe082', color: '#856404' }}
                            onClick={async () => {
                              const res = await fetch(`http://localhost:5000/api/subjects/${student.subjectId}/enrolled/${student.studentId}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'enrolled' }),
                              });
                              if (res.ok) {
                                setAllEnrolled(list =>
                                  list.map(s =>
                                    s.subjectId === student.subjectId && s.studentId === student.studentId
                                      ? { ...s, status: 'enrolled' }
                                      : s
                                  )
                                );
                              } else {
                                alert('Failed to approve student');
                              }
                            }}
                          >
                            <i className="fas fa-check"></i> <span className="btn-label">Approve</span>
                          </button>
                        )}
                        {student.status === 'enrolled' && (
                          <button
                            className="rlb-btn mgmt-action-btn"
                            style={{ background: '#fff3cd', color: '#856404' }}
                            onClick={async () => {
                              const res = await fetch(`http://localhost:5000/api/subjects/${student.subjectId}/enrolled/${student.studentId}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'pending' }),
                              });
                              if (res.ok) {
                                setAllEnrolled(list =>
                                  list.map(s =>
                                    s.subjectId === student.subjectId && s.studentId === student.studentId
                                      ? { ...s, status: 'pending' }
                                      : s
                                  )
                                );
                              } else {
                                alert('Failed to disapprove student');
                              }
                            }}
                          >
                            <i className="fas fa-undo"></i> <span className="btn-label">Disapprove</span>
                          </button>
                        )}
                        <button
                          className="rlb-btn rlb-btn-danger mgmt-action-btn"
                          onClick={async () => {
                            if (!window.confirm('Remove this student from the subject?')) return;
                            const res = await fetch(`http://localhost:5000/api/subjects/${student.subjectId}/enrolled/${student.studentId}`, {
                              method: 'DELETE',
                            });
                            if (res.ok) {
                              setAllEnrolled(list =>
                                list.filter(s =>
                                  !(s.subjectId === student.subjectId && s.studentId === student.studentId)
                                )
                              );
                            } else {
                              alert('Failed to remove student');
                            }
                          }}
                        >
                          <i className="fas fa-trash"></i> <span className="btn-label">Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      {showStudentsModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              {editing ? (
                <>
                  <input
                    type="text"
                    value={editSubject.code}
                    onChange={e => setEditSubject(s => ({ ...s, code: e.target.value }))}
                    style={{ width: 90, fontWeight: 600 }}
                  />
                  <input
                    type="text"
                    value={editSubject.name}
                    onChange={e => setEditSubject(s => ({ ...s, name: e.target.value }))}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="save-btn"
                    onClick={async () => {
                      // Call backend to update subject
                      const res = await fetch(`http://localhost:5000/api/subjects/${selectedSubject._id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(editSubject),
                      });
                      if (res.ok) {
                        setSelectedSubject((s: any) => ({ ...s, ...editSubject }));
                        setEditing(false);
                        // Optionally, refresh subject list in parent
                      } else {
                        alert('Failed to update subject');
                      }
                    }}
                  >Save</button>
                  <button className="cancel-btn" onClick={() => {
                    setEditSubject({ code: selectedSubject.code, name: selectedSubject.name });
                    setEditing(false);
                  }}>Cancel</button>
                </>
              ) : (
                <>
                  <h3 style={{ margin: 0 }}>
                    <span style={{ fontWeight: 600 }}>{selectedSubject?.code}</span> — {selectedSubject?.name}
                  </h3>
                  <button className="edit-btn" onClick={() => setEditing(true)}>Edit</button>
                </>
              )}
            </div>
            {studentsList.length === 0 ? (
              <div>No students enrolled yet.</div>
            ) : (
              <ul className="student-list">
                {studentsList.map((student) => (
                  <li key={student.studentId} className="student-item">
                    <span>{student.name}</span>
                    <span>
                      {student.class?.course} {student.class?.year}-{student.class?.block}
                    </span>
                    <span className={`status ${student.status}`}>{student.status}</span>
                  </li>
                ))}
              </ul>
            )}
            <button className="cancel-btn" onClick={() => setShowStudentsModal(false)}>Close</button>
          </div>
        </div>
      )}
    {showQRModal && qrSubject && (
      <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h3 style={{ marginTop: 0 }}>Scan to Join Subject</h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {(() => {
              const raw = String(qrSubject._id);
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(raw)}`;
              return (
                <>
                  <img src={qrUrl} alt="Join QR" style={{ width: 220, height: 220, border: '1px solid #eee', borderRadius: 8 }} />
                  <div>
                    <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 6 }}>Subject ID</div>
                    <code style={{ display: 'inline-block', padding: '8px 10px', background: '#f3f4f6', borderRadius: 6 }}>{raw}</code>
                    <div style={{ marginTop: 12 }}>
                      <button
                        className="add-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(raw).catch(() => {});
                        }}
                      >Copy</button>
                      <button className="cancel-btn" style={{ marginLeft: 8 }} onClick={() => setShowQRModal(false)}>Close</button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default Management;