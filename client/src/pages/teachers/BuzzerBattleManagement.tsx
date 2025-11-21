import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/buzzer_battle_management.css';
import BuzzerBattleForm from '../../components/BuzzerBattleForm';

interface Question {
  text: string;
  type: 'text_input' | 'multiple_choice';
  options?: { text: string }[];
  acceptedAnswers: string;
  points: number;
  category?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface Settings {
  revealSpeed: number;
  allowPartialBuzz: boolean;
  earlyBuzzBonus: number;
  wrongAnswerPenalty: number;
  stealEnabled: boolean;
  maxSteals: number;
  answerTimeLimit: number;
  streakMultiplier: number;
  freezePenalty: boolean;
}

interface BuzzerBattleTask {
  _id: string;
  title: string;
  description: string;
  subjectId: string;
  teacherId: string;
  questions: Question[];
  settings: Settings;
  status: 'draft' | 'published' | 'closed';
  createdAt: string;
  updatedAt: string;
}

interface Subject {
  _id: string;
  code: string;
  name: string;
}

const BuzzerBattleManagement: React.FC = () => {
  const navigate = useNavigate();
  
  // State for task management
  const [tasks, setTasks] = useState<BuzzerBattleTask[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  
  // State for create mode (using existing page area)
  const [isCreating, setIsCreating] = useState<boolean>(false);
  
  // State for modals
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<BuzzerBattleTask | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Fetch subjects
      const subjectsRes = await fetch(`https://api.veritelligent.fun/api/subjects?teacherId=${user._id}`);
      if (subjectsRes.ok) {
        const subjectsList = await subjectsRes.json();
        setSubjects(subjectsList || []);
      }
      
      // Fetch tasks
      const tasksRes = await fetch(`https://api.veritelligent.fun/api/buzzerbattle/tasks?teacherId=${user._id}`);
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

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesSubject = subjectFilter === 'all' || task.subjectId === subjectFilter;
    
    return matchesSearch && matchesStatus && matchesSubject;
  });

  // Handle update task
  const handleUpdateTask = async (taskData: any) => {
    if (!selectedTask) return;

    try {
      const response = await fetch(`https://api.veritelligent.fun/api/buzzerbattle/tasks/${selectedTask._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      if (response.ok) {
        const updated = await response.json();
        setTasks(tasks.map(t => t._id === selectedTask._id ? updated : t));
        setShowEditModal(false);
        setSelectedTask(null);
      } else {
        alert('Failed to update task');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Error updating task');
    }
  };

  // Handle status change
  const handleStatusChange = async (taskId: string, newStatus: 'draft' | 'published' | 'closed') => {
    try {
      const response = await fetch(`https://api.veritelligent.fun/api/buzzerbattle/tasks/${taskId}/status`, {
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
      const response = await fetch(`https://api.veritelligent.fun/api/buzzerbattle/tasks/${selectedTask._id}`, {
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

  // Handle host
  const handleHost = (task: BuzzerBattleTask) => {
    if (task.status !== 'published') {
      alert('Please publish the task before hosting');
      return;
    }
    navigate('/teacher/buzzer-battle/host', { state: { taskId: task._id, subjectId: task.subjectId } });
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const badges = {
      draft: { class: 'bb-badge-draft', text: 'Draft' },
      published: { class: 'bb-badge-published', text: 'Published' },
      closed: { class: 'bb-badge-closed', text: 'Closed' }
    };
    const badge = badges[status as keyof typeof badges] || badges.draft;
    return <span className={`bb-badge ${badge.class}`}>{badge.text}</span>;
  };

  // Get subject display
  const getSubjectDisplay = (subjectId: string) => {
    const subject = subjects.find(s => s._id === subjectId);
    return subject ? `${subject.code} - ${subject.name}` : 'Unknown Subject';
  };

  // Calculate stats
  const stats = {
    total: tasks.length,
    draft: tasks.filter(t => t.status === 'draft').length,
    published: tasks.filter(t => t.status === 'published').length,
    closed: tasks.filter(t => t.status === 'closed').length
  };

  if (loading) {
    return (
      <div className="bb-page">
        <div className="bb-loading">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading Buzzer Battle tasks...</p>
        </div>
      </div>
    );
  }

  if (isCreating) {
    return (
      <CreateBuzzerBattleForm 
        subjects={subjects}
        onSave={(newTask) => {
          setTasks([newTask, ...tasks]);
          setIsCreating(false);
        }}
        onCancel={() => setIsCreating(false)}
      />
    );
  }

  return (
    <div className="bb-page">
      {/* Header */}
      <div className="bb-header">
        <button className="bb-back-btn" onClick={() => navigate('/teacher/party-games')}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <div className="bb-header-content">
          <h1 className="bb-title"><i className="fas fa-bell"></i> Buzzer Battle Management</h1>
          <p className="bb-subtitle">Create and manage fast-paced team buzzer competitions</p>
        </div>
        <button className="bb-create-btn" onClick={() => setIsCreating(true)}>
          <i className="fas fa-plus"></i> Create New
        </button>
      </div>

      {/* Stats */}
      <div className="bb-stats">
        <div className="bb-stat-card">
          <i className="fas fa-clipboard-list"></i>
          <div className="bb-stat-value">{stats.total}</div>
          <div className="bb-stat-label">Total Tasks</div>
        </div>
        <div className="bb-stat-card">
          <i className="fas fa-check-circle"></i>
          <div className="bb-stat-value">{stats.published}</div>
          <div className="bb-stat-label">Published</div>
        </div>
        <div className="bb-stat-card">
          <i className="fas fa-edit"></i>
          <div className="bb-stat-value">{stats.draft}</div>
          <div className="bb-stat-label">Drafts</div>
        </div>
        <div className="bb-stat-card">
          <i className="fas fa-lock"></i>
          <div className="bb-stat-value">{stats.closed}</div>
          <div className="bb-stat-label">Closed</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bb-filters">
        <div className="bb-search">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="bb-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="closed">Closed</option>
        </select>
        <select
          className="bb-filter-select"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          <option value="all">All Subjects</option>
          {subjects.map(subject => (
            <option key={subject._id} value={subject._id}>
              {subject.code} - {subject.name}
            </option>
          ))}
        </select>
      </div>

      {/* Task Grid */}
      {filteredTasks.length === 0 ? (
        <div className="bb-empty">
          <i className="fas fa-bell"></i>
          <h3>No tasks found</h3>
          <p>Create your first Buzzer Battle task to get started!</p>
          <button className="bb-btn-primary" onClick={() => setIsCreating(true)}>
            <i className="fas fa-plus"></i> Create Task
          </button>
        </div>
      ) : (
        <div className="bb-task-grid">
          {filteredTasks.map(task => (
            <div key={task._id} className="bb-task-card">
              <div className="bb-task-header">
                <div className="bb-task-title-section">
                  <h3>{task.title}</h3>
                  {getStatusBadge(task.status)}
                </div>
              </div>
              <div className="bb-task-body">
                <p className="bb-task-description">{task.description || 'No description'}</p>
                <div className="bb-task-meta">
                  <div className="bb-meta-item">
                    <i className="fas fa-book"></i>
                    <span>{getSubjectDisplay(task.subjectId)}</span>
                  </div>
                  <div className="bb-meta-item">
                    <i className="fas fa-question-circle"></i>
                    <span>{task.questions.length} Questions</span>
                  </div>
                  <div className="bb-meta-item">
                    <i className="fas fa-clock"></i>
                    <span>~{Math.ceil((task.questions.length * (task.settings.revealSpeed / 1000 * 10 + task.settings.answerTimeLimit)) / 60)} min</span>
                  </div>
                </div>
              </div>
              <div className="bb-task-actions">
                <div className="bb-primary-actions">
                  <button 
                    className="bb-btn-host"
                    onClick={() => handleHost(task)}
                    disabled={task.status !== 'published'}
                  >
                    <i className="fas fa-play"></i> Host
                  </button>
                  <button 
                    className="bb-btn-edit"
                    onClick={() => {
                      setSelectedTask(task);
                      setShowEditModal(true);
                    }}
                  >
                    <i className="fas fa-edit"></i> Edit
                  </button>
                  <button 
                    className="bb-btn-analytics"
                    onClick={() => navigate(`/teacher/sessions?taskTitle=${encodeURIComponent(task.title)}`)}
                  >
                    <i className="fas fa-chart-bar"></i> Analytics
                  </button>
                </div>
                <div className="bb-status-actions">
                  {task.status === 'draft' && (
                    <button 
                      className="bb-btn-status publish"
                      onClick={() => handleStatusChange(task._id, 'published')}
                    >
                      Publish
                    </button>
                  )}
                  {task.status === 'published' && (
                    <>
                      <button 
                        className="bb-btn-status draft"
                        onClick={() => handleStatusChange(task._id, 'draft')}
                      >
                        Draft
                      </button>
                      <button 
                        className="bb-btn-status close"
                        onClick={() => handleStatusChange(task._id, 'closed')}
                      >
                        Close
                      </button>
                    </>
                  )}
                  {task.status === 'closed' && (
                    <button 
                      className="bb-btn-status publish"
                      onClick={() => handleStatusChange(task._id, 'published')}
                    >
                      Reopen
                    </button>
                  )}
                  <button 
                    className="bb-btn-delete"
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
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTask && (
        <div className="bb-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="bb-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="bb-modal-header">
              <h3>Edit Buzzer Battle Task</h3>
              <button className="bb-modal-close" onClick={() => setShowEditModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="bb-modal-body">
              <BuzzerBattleForm
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

      {/* Delete Modal */}
      {showDeleteModal && selectedTask && (
        <div className="bb-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="bb-modal-content bb-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bb-modal-header">
              <h3>Delete Task</h3>
              <button className="bb-modal-close" onClick={() => setShowDeleteModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="bb-modal-body">
              <p className="bb-warning-text">
                Are you sure you want to delete "<strong>{selectedTask.title}</strong>"?
                This action cannot be undone.
              </p>
            </div>
            <div className="bb-modal-actions">
              <button className="bb-btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="bb-btn-danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal removed */}
    </div>
  );
};

// ====================================
// Create Form Component
// ====================================
interface CreateBuzzerBattleFormProps {
  subjects: Subject[];
  onSave: (task: BuzzerBattleTask) => void;
  onCancel: () => void;
}

const CreateBuzzerBattleForm: React.FC<CreateBuzzerBattleFormProps> = ({ subjects, onSave, onCancel }) => {
  const [saving, setSaving] = useState<boolean>(false);

  const handleCreate = async (taskData: any) => {
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await fetch('https://api.veritelligent.fun/api/buzzerbattle/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...taskData,
          teacherId: user._id
        })
      });

      if (response.ok) {
        const created = await response.json();
        onSave(created);
      } else {
        const errorText = await response.text();
        alert(`Failed to create task: ${errorText}`);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Error creating task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bb-create-page">
      <div className="bb-create-header">
        <button className="bb-back-btn" onClick={onCancel}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <div>
          <h1><i className="fas fa-plus-circle"></i> Create Buzzer Battle</h1>
          <p>Design a new fast-paced team buzzer competition</p>
        </div>
      </div>

      <div className="bb-create-form">
        <BuzzerBattleForm
          subjects={subjects}
          onSubmit={handleCreate}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
};

export default BuzzerBattleManagement;

