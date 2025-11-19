import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import '../../styles/grid_quest_management.css';

type Clue = { points: number; timeLimitSec?: number; prompt: string; acceptedAnswers: string };
type Category = { name: string; clues: Clue[] };

interface GridQuestTask {
  _id: string;
  title: string;
  description: string;
  subjectId: string;
  status: 'draft' | 'published' | 'closed';
  categories: Category[];
  settings: {
    allowNegativeOnWrong: boolean;
    preTimerSec: number;
    suspenseRevealSec: number;
  };
  createdAt: string;
  updatedAt: string;
}

const emptyCategory = (): Category => ({ 
  name: '', 
  clues: Array.from({ length: 5 }).map((_, idx) => ({ 
    points: (idx + 1) * 10, // Progressive: 10pts, 20pts, 30pts, 40pts, 50pts
    timeLimitSec: 15, // All levels get 15 seconds
    prompt: '', 
    acceptedAnswers: '' 
  })) 
});

const GridQuestManagement: React.FC = () => {
  const navigate = useNavigate();
  
  // State for task management
  const [tasks, setTasks] = useState<GridQuestTask[]>([]);
  const [subjects, setSubjects] = useState<Array<{ _id: string; code: string; name: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  
  // State for modals
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<GridQuestTask | null>(null);
  
  // State for create mode (using existing page area)
  const [isCreating, setIsCreating] = useState<boolean>(false);
  
  // State for edit form
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editSubjectId, setEditSubjectId] = useState<string>('');
  const [editCategories, setEditCategories] = useState<Category[]>([]);
  const [editStatus, setEditStatus] = useState<'draft' | 'published' | 'closed'>('draft');

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Fetch subjects
        const subjectsRes = await fetch(`http://localhost:5000/api/subjects?teacherId=${user._id}`);
        if (subjectsRes.ok) {
          const subjectsList = await subjectsRes.json();
          setSubjects(subjectsList || []);
        }
        
        // Fetch tasks
        const tasksRes = await fetch('http://localhost:5000/api/gridquest/tasks');
        if (tasksRes.ok) {
          const tasksList = await tasksRes.json();
          setTasks(tasksList || []);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesSubject = subjectFilter === 'all' || task.subjectId === subjectFilter;
    
    return matchesSearch && matchesStatus && matchesSubject;
  });

  // Handle status change
  const handleStatusChange = async (taskId: string, newStatus: 'draft' | 'published' | 'closed') => {
    try {
      const response = await fetch(`http://localhost:5000/api/gridquest/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const updated = await response.json();
        setTasks(tasks.map(t => t._id === taskId ? updated : t));
      } else {
        alert('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedTask) return;

    try {
      const response = await fetch(`http://localhost:5000/api/gridquest/tasks/${selectedTask._id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setTasks(tasks.filter(t => t._id !== selectedTask._id));
        setShowDeleteModal(false);
        setSelectedTask(null);
      } else {
        alert('Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Error deleting task');
    }
  };

  // Open edit modal
  const openEditModal = (task: GridQuestTask) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditSubjectId(task.subjectId);
    setEditStatus(task.status);
    
    // Convert categories for editing
    const editableCats = task.categories.map(cat => ({
      name: cat.name,
      clues: cat.clues.map(clue => ({
        points: clue.points,
        timeLimitSec: clue.timeLimitSec,
        prompt: clue.prompt,
        acceptedAnswers: Array.isArray(clue.acceptedAnswers) 
          ? clue.acceptedAnswers.join(', ')
          : clue.acceptedAnswers
      }))
    }));
    
    setEditCategories(editableCats);
    setShowEditModal(true);
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!selectedTask) return;

    try {
      const body = {
        title: editTitle,
        description: editDescription,
        subjectId: editSubjectId,
        status: editStatus,
        settings: { allowNegativeOnWrong: true, preTimerSec: 3, suspenseRevealSec: 2 },
        categories: editCategories.map(c => ({
          name: c.name,
          clues: c.clues.map(cl => ({
            points: Number(cl.points) || 0,
            timeLimitSec: Number(cl.timeLimitSec) || 20,
            prompt: cl.prompt,
            acceptedAnswers: typeof cl.acceptedAnswers === 'string'
              ? cl.acceptedAnswers.split(',').map(s => s.trim()).filter(Boolean)
              : cl.acceptedAnswers
          }))
        }))
      };

      const response = await fetch(`http://localhost:5000/api/gridquest/tasks/${selectedTask._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const updated = await response.json();
        setTasks(tasks.map(t => t._id === selectedTask._id ? updated : t));
        setShowEditModal(false);
        setSelectedTask(null);
      } else {
        const errorText = await response.text();
        alert(`Failed to update task: ${errorText}`);
      }
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Error updating task');
    }
  };

  // Get subject name by ID
  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(s => s._id === subjectId);
    return subject ? `${subject.code} - ${subject.name}` : 'Unknown Subject';
  };

  // Get status badge style
  const getStatusBadge = (status: string) => {
    const badges = {
      draft: { class: 'gqm-badge-draft', icon: 'fa-file-alt', label: 'Draft' },
      published: { class: 'gqm-badge-published', icon: 'fa-check-circle', label: 'Published' },
      closed: { class: 'gqm-badge-closed', icon: 'fa-lock', label: 'Closed' }
    };
    
    return badges[status as keyof typeof badges] || badges.draft;
  };

  // Handle host navigation
  const handleHost = (task: GridQuestTask) => {
    if (task.status === 'draft') {
      alert('Please publish the task before hosting!');
      return;
    }
    if (task.status === 'closed') {
      alert('This task is closed. Reopen it as draft or published to host.');
      return;
    }
    
    navigate(`/teacher/grid-quest/host?taskId=${task._id}`);
  };

  // Get QR code URL
  const getQRCodeURL = (taskId: string) => {
    return `${window.location.origin}/student/grid-quest/join?taskId=${taskId}`;
  };

  if (loading) {
    return (
      <div className="gqm-page">
        <div className="gqm-loading">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading Grid Quest tasks...</p>
        </div>
      </div>
    );
  }

  if (isCreating) {
    return <CreateGridQuestForm 
      subjects={subjects}
      onSave={(newTask) => {
        setTasks([newTask, ...tasks]);
        setIsCreating(false);
      }}
      onCancel={() => setIsCreating(false)}
    />;
  }

  return (
    <div className="gqm-page">
      {/* Header */}
      <div className="gqm-header">
        <button className="gqm-back-btn" onClick={() => navigate('/teacher/party-games')}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <div className="gqm-header-content">
          <h1><i className="fas fa-th"></i> Grid Quest Management</h1>
          <p>Create, manage, and host Grid Quest challenges</p>
        </div>
        <button className="gqm-create-btn" onClick={() => setIsCreating(true)}>
          <i className="fas fa-plus"></i> Create New
        </button>
      </div>

      {/* Filters */}
      <div className="gqm-filters">
        <div className="gqm-search">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select 
          className="gqm-filter-select"
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="closed">Closed</option>
        </select>

        <select 
          className="gqm-filter-select"
          value={subjectFilter} 
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          <option value="all">All Subjects</option>
          {subjects.map(s => (
            <option key={s._id} value={s._id}>{s.code} - {s.name}</option>
          ))}
        </select>
      </div>

      {/* Task Stats */}
      <div className="gqm-stats">
        <div className="gqm-stat-card">
          <i className="fas fa-tasks"></i>
          <div>
            <div className="gqm-stat-value">{tasks.length}</div>
            <div className="gqm-stat-label">Total Tasks</div>
          </div>
        </div>
        <div className="gqm-stat-card">
          <i className="fas fa-file-alt"></i>
          <div>
            <div className="gqm-stat-value">{tasks.filter(t => t.status === 'draft').length}</div>
            <div className="gqm-stat-label">Drafts</div>
          </div>
        </div>
        <div className="gqm-stat-card">
          <i className="fas fa-check-circle"></i>
          <div>
            <div className="gqm-stat-value">{tasks.filter(t => t.status === 'published').length}</div>
            <div className="gqm-stat-label">Published</div>
          </div>
        </div>
        <div className="gqm-stat-card">
          <i className="fas fa-lock"></i>
          <div>
            <div className="gqm-stat-value">{tasks.filter(t => t.status === 'closed').length}</div>
            <div className="gqm-stat-label">Closed</div>
          </div>
        </div>
      </div>

      {/* Task Grid */}
      {filteredTasks.length === 0 ? (
        <div className="gqm-empty">
          <i className="fas fa-inbox"></i>
          <h3>No tasks found</h3>
          <p>Create your first Grid Quest challenge to get started</p>
          <button className="gqm-btn-primary" onClick={() => setIsCreating(true)}>
            <i className="fas fa-plus"></i> Create Task
          </button>
        </div>
      ) : (
        <div className="gqm-task-grid">
          {filteredTasks.map(task => {
            const badge = getStatusBadge(task.status);
            
            return (
              <div key={task._id} className="gqm-task-card">
                {/* Card Header */}
                <div className="gqm-task-header">
                  <div className="gqm-task-title-section">
                    <h3>{task.title}</h3>
                    <span className={`gqm-badge ${badge.class}`}>
                      <i className={`fas ${badge.icon}`}></i> {badge.label}
                    </span>
                  </div>
                  <p className="gqm-task-description">{task.description || 'No description'}</p>
                </div>

                {/* Card Body */}
                <div className="gqm-task-body">
                  <div className="gqm-task-meta">
                    <div className="gqm-meta-item">
                      <i className="fas fa-book"></i>
                      <span>{getSubjectName(task.subjectId)}</span>
                    </div>
                    <div className="gqm-meta-item">
                      <i className="fas fa-layer-group"></i>
                      <span>{task.categories?.length || 0} Categories</span>
                    </div>
                    <div className="gqm-meta-item">
                      <i className="fas fa-calendar"></i>
                      <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="gqm-task-actions">
                  {/* Primary Actions */}
                  <div className="gqm-primary-actions">
                    <button 
                      className="gqm-btn-host"
                      onClick={() => handleHost(task)}
                      disabled={task.status !== 'published'}
                      title={task.status !== 'published' ? 'Only published tasks can be hosted' : 'Host this task'}
                    >
                      <i className="fas fa-play"></i> Host
                    </button>
                    
                    <button 
                      className="gqm-btn-edit"
                      onClick={() => openEditModal(task)}
                      disabled={task.status === 'published'}
                      title={task.status === 'published' ? 'Cannot edit published tasks. Change status to Draft or Closed first.' : 'Edit this task'}
                    >
                      <i className="fas fa-edit"></i> Edit
                    </button>

                    <button 
                      className="gqm-btn-analytics"
                      onClick={() => navigate(`/teacher/sessions?taskTitle=${encodeURIComponent(task.title)}`)}
                      title="View analytics sessions for this task"
                    >
                      <i className="fas fa-chart-bar"></i> Analytics
                    </button>
                  </div>

                  {/* Status Actions */}
                  <div className="gqm-status-actions">
                    {task.status === 'draft' && (
                      <button 
                        className="gqm-btn-status publish"
                        onClick={() => handleStatusChange(task._id, 'published')}
                      >
                        <i className="fas fa-upload"></i> Publish
                      </button>
                    )}
                    
                    {task.status === 'published' && (
                      <>
                        <button 
                          className="gqm-btn-status draft"
                          onClick={() => handleStatusChange(task._id, 'draft')}
                        >
                          <i className="fas fa-file-alt"></i> Draft
                        </button>
                        <button 
                          className="gqm-btn-status close"
                          onClick={() => handleStatusChange(task._id, 'closed')}
                        >
                          <i className="fas fa-lock"></i> Close
                        </button>
                      </>
                    )}
                    
                    {task.status === 'closed' && (
                      <button 
                        className="gqm-btn-status draft"
                        onClick={() => handleStatusChange(task._id, 'draft')}
                      >
                        <i className="fas fa-undo"></i> Reopen
                      </button>
                    )}

                    <button 
                      className="gqm-btn-delete"
                      onClick={() => {
                        setSelectedTask(task);
                        setShowDeleteModal(true);
                      }}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTask && (
        <EditGridQuestModal
          task={selectedTask}
          subjects={subjects}
          title={editTitle}
          description={editDescription}
          subjectId={editSubjectId}
          categories={editCategories}
          status={editStatus}
          onTitleChange={setEditTitle}
          onDescriptionChange={setEditDescription}
          onSubjectChange={setEditSubjectId}
          onCategoriesChange={setEditCategories}
          onStatusChange={setEditStatus}
          onSave={handleSaveEdit}
          onClose={() => {
            setShowEditModal(false);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedTask && (
        <div className="gqm-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="gqm-modal-content gqm-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gqm-modal-header">
              <h3><i className="fas fa-exclamation-triangle"></i> Confirm Deletion</h3>
              <button className="gqm-modal-close" onClick={() => setShowDeleteModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="gqm-modal-body">
              <p>Are you sure you want to delete <strong>"{selectedTask.title}"</strong>?</p>
              <p className="gqm-warning-text">This action cannot be undone.</p>
            </div>
            <div className="gqm-modal-actions">
              <button className="gqm-btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="gqm-btn-danger" onClick={handleDelete}>
                <i className="fas fa-trash"></i> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && selectedTask && (
        <div className="gqm-modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="gqm-modal-content gqm-qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gqm-modal-header">
              <h3><i className="fas fa-qrcode"></i> QR Code - {selectedTask.title}</h3>
              <button className="gqm-modal-close" onClick={() => setShowQRModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="gqm-modal-body gqm-qr-body">
              <div className="gqm-qr-container">
                <QRCode value={getQRCodeURL(selectedTask._id)} size={256} />
              </div>
              <p className="gqm-qr-instruction">Students can scan this QR code to join the Grid Quest</p>
              <div className="gqm-qr-link">
                <input 
                  type="text" 
                  value={getQRCodeURL(selectedTask._id)} 
                  readOnly 
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(getQRCodeURL(selectedTask._id));
                    alert('Link copied to clipboard!');
                  }}
                >
                  <i className="fas fa-copy"></i> Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ====================================
// Create Form Component
// ====================================
interface CreateGridQuestFormProps {
  subjects: Array<{ _id: string; code: string; name: string }>;
  onSave: (task: GridQuestTask) => void;
  onCancel: () => void;
}

const CreateGridQuestForm: React.FC<CreateGridQuestFormProps> = ({ subjects, onSave, onCancel }) => {
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>(subjects[0]?._id || '');
  const [status, setStatus] = useState<'draft' | 'published' | 'closed'>('draft');
  const [categories, setCategories] = useState<Category[]>([
    emptyCategory(), emptyCategory(), emptyCategory(), emptyCategory(), emptyCategory()
  ]);
  const [saving, setSaving] = useState<boolean>(false);

  const addCategory = () => setCategories(prev => [...prev, emptyCategory()]);
  const removeCategory = (idx: number) => setCategories(prev => prev.filter((_, i) => i !== idx));
  
  const setClue = (catIdx: number, clueIdx: number, patch: Partial<Clue>) => {
    setCategories(prev => prev.map((c, i) => 
      i !== catIdx ? c : ({
        ...c,
        clues: c.clues.map((cl, r) => 
          r !== clueIdx ? cl : ({ ...cl, ...patch })
        )
      })
    ));
  };

  const handleSave = async () => {
    if (!subjectId) {
      alert('Please select a subject.');
      return;
    }
    
    if (!title.trim()) {
      alert('Please enter a title.');
      return;
    }

    setSaving(true);

    try {
    const body = {
      subjectId,
        title: title.trim(),
        description: description.trim(),
      status,
      settings: { allowNegativeOnWrong: true, preTimerSec: 3, suspenseRevealSec: 2 },
      categories: categories.map(c => ({
        name: c.name,
        clues: c.clues.map(cl => ({
          points: Number(cl.points) || 0,
          timeLimitSec: Number(cl.timeLimitSec) || 20,
          prompt: cl.prompt,
          acceptedAnswers: (cl.acceptedAnswers || '').split(',').map(s => s.trim()).filter(Boolean)
        }))
      }))
    };

      const res = await fetch('http://localhost:5000/api/gridquest/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

    if (res.ok) {
      const created = await res.json();
        onSave(created);
    } else {
      const txt = await res.text();
      alert(`Failed to save: ${txt}`);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Error creating task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gqm-create-page">
      <div className="gqm-create-header">
        <button className="gqm-back-btn" onClick={onCancel}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <div>
          <h1><i className="fas fa-plus-circle"></i> Create Grid Quest</h1>
          <p>Design a new Grid Quest challenge for your students</p>
        </div>
        <button 
          className="gqm-save-btn" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <><i className="fas fa-spinner fa-spin"></i> Saving...</>
          ) : (
            <><i className="fas fa-save"></i> Save Task</>
          )}
        </button>
      </div>

      <div className="gqm-create-form">
        {/* Basic Info Section */}
        <div className="gqm-form-section">
          <h2><i className="fas fa-info-circle"></i> Basic Information</h2>
          <div className="gqm-form-grid">
            <div className="gqm-form-group gqm-full-width">
              <label>Task Title *</label>
              <input
                type="text"
                placeholder="e.g., Science Challenge: Biology Edition"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="gqm-form-group gqm-full-width">
              <label>Description</label>
              <textarea
                placeholder="Brief description of this Grid Quest challenge..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="gqm-form-group">
              <label>Subject *</label>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Select subject</option>
            {subjects.map(s => (
              <option key={s._id} value={s._id}>{s.code} — {s.name}</option>
            ))}
          </select>
        </div>

            <div className="gqm-form-group">
              <label>Initial Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
          </select>
            </div>
          </div>
        </div>

        {/* Categories Section */}
        <div className="gqm-form-section">
          <div className="gqm-section-header">
            <h2><i className="fas fa-layer-group"></i> Categories & Clues</h2>
            <button className="gqm-btn-add-category" onClick={addCategory}>
              <i className="fas fa-plus"></i> Add Category
            </button>
          </div>

          {categories.map((cat, ci) => (
            <div key={ci} className="gqm-category-card">
              <div className="gqm-category-header">
                <input
                  className="gqm-category-name"
                  placeholder={`Category ${ci + 1} name (e.g., Animals)`}
                  value={cat.name}
                  onChange={(e) => setCategories(prev => 
                    prev.map((c, i) => i !== ci ? c : ({ ...c, name: e.target.value }))
                  )}
                />
                <button 
                  className="gqm-btn-remove-category" 
                  onClick={() => removeCategory(ci)}
                  disabled={categories.length <= 1}
                >
                  <i className="fas fa-trash"></i> 
                </button>
              </div>

              <div className="gqm-clues-grid">
                {cat.clues.map((cl, ri) => (
                  <div key={ri} className="gqm-clue-card">
                    <div className="gqm-clue-header">
                      <span className="gqm-clue-level">Level {ri + 1}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                        <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>Points:</label>
                        <input
                          type="number"
                          className="gqm-clue-points"
                          placeholder="Points"
                          value={cl.points}
                          onChange={(e) => setClue(ci, ri, { points: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Time Limit (seconds):</label>
                      <input
                        type="number"
                        className="gqm-clue-time"
                        placeholder="Time (sec)"
                        value={cl.timeLimitSec}
                        onChange={(e) => setClue(ci, ri, { timeLimitSec: Number(e.target.value) })}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Question:</label>
                      <textarea
                        className="gqm-clue-prompt"
                        placeholder="Question prompt..."
                        value={cl.prompt}
                        onChange={(e) => setClue(ci, ri, { prompt: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Accepted Answers:</label>
                      <input
                        className="gqm-clue-answers"
                        placeholder="Answer 1, Answer 2, Answer 3..."
                        value={cl.acceptedAnswers}
                        onChange={(e) => setClue(ci, ri, { acceptedAnswers: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="gqm-form-actions">
          <button className="gqm-btn-cancel" onClick={onCancel}>
            <i className="fas fa-times"></i> Cancel
          </button>
          <button 
            className="gqm-btn-save-primary" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <><i className="fas fa-spinner fa-spin"></i> Saving...</>
            ) : (
              <><i className="fas fa-check"></i> Create Task</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ====================================
// Edit Modal Component
// ====================================
interface EditGridQuestModalProps {
  task: GridQuestTask;
  subjects: Array<{ _id: string; code: string; name: string }>;
  title: string;
  description: string;
  subjectId: string;
  categories: Category[];
  status: 'draft' | 'published' | 'closed';
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onSubjectChange: (subjectId: string) => void;
  onCategoriesChange: (categories: Category[]) => void;
  onStatusChange: (status: 'draft' | 'published' | 'closed') => void;
  onSave: () => void;
  onClose: () => void;
}

const EditGridQuestModal: React.FC<EditGridQuestModalProps> = ({
  subjects,
  title,
  description,
  subjectId,
  categories,
  status,
  onTitleChange,
  onDescriptionChange,
  onSubjectChange,
  onCategoriesChange,
  onStatusChange,
  onSave,
  onClose
}) => {
  const addCategory = () => onCategoriesChange([...categories, emptyCategory()]);
  const removeCategory = (idx: number) => onCategoriesChange(categories.filter((_, i) => i !== idx));
  
  const setClue = (catIdx: number, clueIdx: number, patch: Partial<Clue>) => {
    onCategoriesChange(categories.map((c, i) => 
      i !== catIdx ? c : ({
        ...c,
        clues: c.clues.map((cl, r) => 
          r !== clueIdx ? cl : ({ ...cl, ...patch })
        )
      })
    ));
  };

  return (
    <div className="gqm-modal-overlay" onClick={onClose}>
      <div className="gqm-modal-content gqm-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gqm-modal-header">
          <h3><i className="fas fa-edit"></i> Edit Grid Quest</h3>
          <button className="gqm-modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="gqm-modal-body gqm-edit-body">
          {/* Basic Info */}
          <div className="gqm-edit-section">
            <h4>Basic Information</h4>
            <div className="gqm-edit-grid">
              <div className="gqm-edit-group gqm-full-width">
                <label>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
                />
              </div>

              <div className="gqm-edit-group gqm-full-width">
                <label>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => onDescriptionChange(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="gqm-edit-group">
                <label>Subject</label>
                <select value={subjectId} onChange={(e) => onSubjectChange(e.target.value)}>
                  {subjects.map(s => (
                    <option key={s._id} value={s._id}>{s.code} — {s.name}</option>
                  ))}
                </select>
              </div>

              <div className="gqm-edit-group">
                <label>Status</label>
                <select value={status} onChange={(e) => onStatusChange(e.target.value as any)}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="gqm-edit-section">
            <div className="gqm-section-header">
              <h4>Categories & Clues</h4>
              <button className="gqm-btn-add-small" onClick={addCategory}>
                <i className="fas fa-plus"></i>
              </button>
            </div>

            <div className="gqm-edit-categories">
              {categories.map((cat, ci) => (
                <div key={ci} className="gqm-edit-category">
                  <div className="gqm-edit-category-header">
                    <input
                      placeholder={`Category ${ci + 1}`}
                      value={cat.name}
                      onChange={(e) => onCategoriesChange(categories.map((c, i) => 
                        i !== ci ? c : ({ ...c, name: e.target.value })
                      ))}
                    />
                    <button onClick={() => removeCategory(ci)} disabled={categories.length <= 1}>
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>

                  <div className="gqm-edit-clues">
                    {cat.clues.map((cl, ri) => (
                      <div key={ri} className="gqm-edit-clue">
                        <div className="gqm-clue-mini-header">
                          <span>Level {ri + 1}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>Points:</label>
                          <input
                            type="number"
                            value={cl.points}
                            onChange={(e) => setClue(ci, ri, { points: Number(e.target.value) })}
                            placeholder="Points"
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>Time (sec):</label>
                          <input
                            type="number"
                            value={cl.timeLimitSec}
                            onChange={(e) => setClue(ci, ri, { timeLimitSec: Number(e.target.value) })}
                            placeholder="Seconds"
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>Question:</label>
                          <textarea
                            value={cl.prompt}
                            onChange={(e) => setClue(ci, ri, { prompt: e.target.value })}
                            placeholder="Prompt..."
                            rows={2}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>Answers:</label>
                          <input
                            value={cl.acceptedAnswers}
                            onChange={(e) => setClue(ci, ri, { acceptedAnswers: e.target.value })}
                            placeholder="Answer 1, Answer 2..."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="gqm-modal-actions">
          <button className="gqm-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="gqm-btn-primary" onClick={onSave}>
            <i className="fas fa-save"></i> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default GridQuestManagement;
