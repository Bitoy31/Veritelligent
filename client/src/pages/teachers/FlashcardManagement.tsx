import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/flashcard_management.css';
import FlashcardForm from '../../components/FlashcardForm';

interface FlashcardTask {
  _id: string;
  title: string;
  description: string;
  subjectId: string; // Just ObjectId, not populated
  status: 'draft' | 'published' | 'closed';
  questions: any[];
  settings: {
    allowRepeatedStudents: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface Subject {
  _id: string;
  code: string;
  name: string;
}

const FlashcardManagement: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<FlashcardTask[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    status: '',
    subject: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<FlashcardTask | null>(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchTasks();
    fetchSubjects();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`https://api.veritelligent.fun/api/flashcard/tasks?teacherId=${user._id}`);
      
      if (!response.ok) {
        console.error('Failed to fetch tasks:', response.status);
        setTasks([]);
        return;
      }
      
      const data = await response.json();
      console.log('Fetched tasks:', data);
      
      // Ensure data is an array
      if (Array.isArray(data)) {
        setTasks(data);
      } else {
        console.error('Tasks data is not an array:', data);
        setTasks([]);
      }
    } catch (error) {
      console.error('Error fetching flashcard tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await fetch(`https://api.veritelligent.fun/api/subjects?teacherId=${user._id}`);
      const data = await response.json();
      setSubjects(data);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  const handleCreateTask = async (taskData: any) => {
    try {
      console.log('Creating task with data:', taskData);
      const response = await fetch('https://api.veritelligent.fun/api/flashcard/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      if (response.ok) {
        await fetchTasks();
        setShowCreateModal(false);
        alert('Flashcard task created successfully!');
      } else {
        const error = await response.json();
        console.error('Server error:', error);
        alert(error.error || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task. Check console for details.');
    }
  };

  const handleUpdateTask = async (taskData: any) => {
    if (!selectedTask) return;

    try {
      const response = await fetch(`https://api.veritelligent.fun/api/flashcard/tasks/${selectedTask._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      if (response.ok) {
        await fetchTasks();
        setShowEditModal(false);
        setSelectedTask(null);
        alert('Task updated successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update task');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    }
  };

  const handleDelete = async () => {
    if (!selectedTask) return;

    try {
      const response = await fetch(`https://api.veritelligent.fun/api/flashcard/tasks/${selectedTask._id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchTasks();
        setShowDeleteModal(false);
        setSelectedTask(null);
        alert('Task deleted successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: 'draft' | 'published' | 'closed') => {
    try {
      const response = await fetch(`https://api.veritelligent.fun/api/flashcard/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        await fetchTasks();
      } else {
        alert('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleHost = (task: FlashcardTask) => {
    navigate('/teacher/flashcard/host', { 
      state: { 
        taskId: task._id, 
        subjectId: task.subjectId,
        taskTitle: task.title 
      } 
    });
  };

  const filteredTasks = (tasks || []).filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filter.status || task.status === filter.status;
    const matchesSubject = !filter.subject || task.subjectId === filter.subject;
    return matchesSearch && matchesStatus && matchesSubject;
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: { class: 'fcm-badge-draft', text: 'Draft' },
      published: { class: 'fcm-badge-published', text: 'Published' },
      closed: { class: 'fcm-badge-closed', text: 'Closed' }
    };
    return badges[status as keyof typeof badges] || badges.draft;
  };

  const getSubjectDisplay = (subjectId: string) => {
    const subject = subjects.find(s => s._id === subjectId);
    return subject ? subject.code : 'Unknown';
  };

  return (
    <div className="fcm-page">
      {/* Header */}
      <div className="fcm-header">
        <button className="fcm-back-btn" onClick={() => navigate('/teacher/solo-games')}>
        <i className="fas fa-arrow-left"></i> Back to Games
      </button>
        <div className="fcm-header-content">
          <h1 className="fcm-title">Flashcard Management</h1>
          <p className="fcm-subtitle">Create and manage recitation game tasks</p>
        </div>
        <button className="fcm-create-btn" onClick={() => setShowCreateModal(true)}>
          <i className="fas fa-plus"></i> Create Task
        </button>
      </div>

      {/* Filters */}
      <div className="fcm-filters">
        <div className="fcm-search">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="fcm-filter-select"
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="closed">Closed</option>
        </select>
        <select
          className="fcm-filter-select"
          value={filter.subject}
          onChange={(e) => setFilter({ ...filter, subject: e.target.value })}
        >
          <option value="">All Subjects</option>
          {subjects.map(s => (
            <option key={s._id} value={s._id}>{s.code} - {s.name}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="fcm-stats">
        <div className="fcm-stat-card">
          <i className="fas fa-file-alt"></i>
          <div>
            <div className="fcm-stat-value">{tasks.length}</div>
            <div className="fcm-stat-label">Total Tasks</div>
          </div>
        </div>
        <div className="fcm-stat-card">
          <i className="fas fa-check-circle"></i>
          <div>
            <div className="fcm-stat-value">{tasks.filter(t => t.status === 'published').length}</div>
            <div className="fcm-stat-label">Published</div>
          </div>
        </div>
        <div className="fcm-stat-card">
          <i className="fas fa-edit"></i>
          <div>
            <div className="fcm-stat-value">{tasks.filter(t => t.status === 'draft').length}</div>
            <div className="fcm-stat-label">Drafts</div>
          </div>
        </div>
      </div>

      {/* Task Grid */}
      {loading ? (
        <div className="fcm-loading">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="fcm-empty">
          <i className="fas fa-cards-blank"></i>
          <h3>No flashcard tasks found</h3>
          <p>Create your first task to get started!</p>
        </div>
      ) : (
        <div className="fcm-task-grid">
          {filteredTasks.map(task => {
            const badge = getStatusBadge(task.status);
            return (
              <div
                key={task._id}
                className="fcm-task-card"
                onClick={() => navigate(`/teacher/sessions?taskTitle=${encodeURIComponent(task.title)}`)}
                style={{ cursor: 'pointer' }}
                title="View sessions for this task"
              >
                <div className="fcm-task-header">
                  <div className="fcm-task-title-section">
                    <h3>{task.title}</h3>
                    <span className={`fcm-badge ${badge.class}`}>{badge.text}</span>
                  </div>
                </div>
                <div className="fcm-task-body">
                  <p className="fcm-task-description">{task.description || 'No description'}</p>
                  <div className="fcm-task-meta">
                    <div className="fcm-meta-item">
                      <i className="fas fa-book"></i>
                      <span>{getSubjectDisplay(task.subjectId)}</span>
                    </div>
                    <div className="fcm-meta-item">
                      <i className="fas fa-question-circle"></i>
                      <span>{task.questions.length} questions</span>
                    </div>
                    <div className="fcm-meta-item">
                      <i className="fas fa-sync-alt"></i>
                      <span>{task.settings?.allowRepeatedStudents ? 'Repeats allowed' : 'No repeats'}</span>
                    </div>
                  </div>
                </div>
              <div
                className="fcm-task-actions"
                onClick={() => navigate(`/teacher/sessions?taskTitle=${encodeURIComponent(task.title)}`)}
                style={{ cursor: 'pointer' }}
                title="View sessions for this task"
              >
                  {/* Published status: show Host and Close */}
                  {task.status === 'published' && (
                    <div className="fcm-primary-actions">
                      <button
                        className="fcm-btn-host"
                        onClick={(e) => { e.stopPropagation(); handleHost(task); }}
                      >
                        <i className="fas fa-play"></i> Host
                      </button>
                      <button
                        className="fcm-btn-status close"
                        onClick={(e) => { e.stopPropagation(); handleStatusChange(task._id, 'closed'); }}
                      >
                        Close
                      </button>
                    </div>
                  )}
                  
                  {/* Draft or Closed status: show Edit, Publish, and Delete */}
                  {(task.status === 'draft' || task.status === 'closed') && (
                    <div className="fcm-primary-actions">
                      <button
                        className="fcm-btn-edit"
                      onClick={(e) => {
                        e.stopPropagation();
                          setSelectedTask(task);
                          setShowEditModal(true);
                        }}
                      >
                        <i className="fas fa-edit"></i> Edit
                      </button>
                      <button
                        className="fcm-btn-status publish"
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(task._id, 'published'); }}
                      >
                        Publish
                      </button>
                      <button
                        className="fcm-btn-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                          setSelectedTask(task);
                          setShowDeleteModal(true);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fcm-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="fcm-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="fcm-modal-header">
              <h3>Create Flashcard Task</h3>
              <button className="fcm-modal-close" onClick={() => setShowCreateModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="fcm-modal-body">
              <FlashcardForm
                subjects={subjects}
                onSubmit={handleCreateTask}
                onCancel={() => setShowCreateModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTask && (
        <div className="fcm-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="fcm-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="fcm-modal-header">
              <h3>Edit Flashcard Task</h3>
              <button className="fcm-modal-close" onClick={() => setShowEditModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="fcm-modal-body">
              <FlashcardForm
                subjects={subjects}
                initialData={selectedTask}
                onSubmit={handleUpdateTask}
                onCancel={() => {
                  setShowEditModal(false);
                  setSelectedTask(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedTask && (
        <div className="fcm-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="fcm-modal-content fcm-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fcm-modal-header">
              <h3>Delete Task</h3>
              <button className="fcm-modal-close" onClick={() => setShowDeleteModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="fcm-modal-body">
              <p className="fcm-warning-text">
                Are you sure you want to delete "{selectedTask.title}"? This action cannot be undone.
              </p>
            </div>
            <div className="fcm-modal-actions">
              <button className="fcm-btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="fcm-btn-danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlashcardManagement;

