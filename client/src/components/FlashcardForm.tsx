import React, { useState, useEffect } from 'react';

interface Question {
  text: string;
  type: 'multiple_choice' | 'text_input';
  options?: { text: string; isCorrect: boolean }[];
  acceptedAnswers?: string;
  points: number;
  hasTimer: boolean;
  timeLimitSec: number;
}

interface Subject {
  _id: string;
  code: string;
  name: string;
}

interface FlashcardFormProps {
  subjects: Subject[];
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

const FlashcardForm: React.FC<FlashcardFormProps> = ({ subjects, initialData, onSubmit, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [allowRepeatedStudents, setAllowRepeatedStudents] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setSubjectId(initialData.subjectId?._id || initialData.subjectId || '');
      setAllowRepeatedStudents(initialData.settings?.allowRepeatedStudents || false);
      setQuestions(initialData.questions || []);
    }
  }, [initialData]);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        text: '',
        type: 'multiple_choice',
        options: [
          { text: '', isCorrect: true },
          { text: '', isCorrect: false }
        ],
        points: 1,
        hasTimer: false,
        timeLimitSec: 30
      }
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const updateQuestionType = (index: number, type: 'multiple_choice' | 'text_input') => {
    const updated = [...questions];
    if (type === 'multiple_choice') {
      updated[index] = {
        ...updated[index],
        type,
        options: [
          { text: '', isCorrect: true },
          { text: '', isCorrect: false }
        ],
        acceptedAnswers: undefined
      };
    } else {
      updated[index] = {
        ...updated[index],
        type,
        acceptedAnswers: '',
        options: undefined
      };
    }
    setQuestions(updated);
  };

  const addOption = (qIndex: number) => {
    const updated = [...questions];
    const question = updated[qIndex];
    if (question.options && question.options.length < 4) {
      question.options.push({ text: '', isCorrect: false });
    }
    setQuestions(updated);
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    const updated = [...questions];
    const question = updated[qIndex];
    if (question.options && question.options.length > 2) {
      question.options.splice(oIndex, 1);
    }
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, field: 'text' | 'isCorrect', value: string | boolean) => {
    const updated = [...questions];
    const question = updated[qIndex];
    if (!question.options) return;

    if (field === 'isCorrect' && value === true) {
      // Only one correct answer for MCQ
      question.options.forEach((opt, i) => {
        opt.isCorrect = i === oIndex;
      });
    } else {
      if (field === 'text' && typeof value === 'string') {
        question.options[oIndex].text = value;
      } else if (field === 'isCorrect' && typeof value === 'boolean') {
        question.options[oIndex].isCorrect = value;
      }
    }
    setQuestions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate
      if (!title.trim()) throw new Error('Title is required');
      if (!subjectId) throw new Error('Subject is required');
      if (questions.length === 0) throw new Error('Add at least one question');

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.text.trim()) throw new Error(`Question ${i + 1} text is required`);
        
        if (q.type === 'multiple_choice') {
          if (!q.options || q.options.length < 2) {
            throw new Error(`Question ${i + 1} must have at least 2 options`);
          }
          if (q.options.some(o => !o.text.trim())) {
            throw new Error(`Question ${i + 1} has empty options`);
          }
          if (!q.options.some(o => o.isCorrect)) {
            throw new Error(`Question ${i + 1} must have one correct answer`);
          }
        } else if (q.type === 'text_input') {
          if (!q.acceptedAnswers || !q.acceptedAnswers.trim()) {
            throw new Error(`Question ${i + 1} must have accepted answers`);
          }
        }
        
        if (q.points < 1) {
          throw new Error(`Question ${i + 1} must have at least 1 point`);
        }
        
        if (q.hasTimer && q.timeLimitSec < 5) {
          throw new Error(`Question ${i + 1} timer must be at least 5 seconds`);
        }
      }

      const data = {
        title,
        description,
        subjectId,
        teacherId: user._id,
        questions,
        settings: {
          allowRepeatedStudents
        },
        status: initialData?.status || 'draft'
      };

      await onSubmit(data);
    } catch (err: any) {
      setError(err.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="flashcard-form" onSubmit={handleSubmit}>
      {error && <div className="fc-error-message">{error}</div>}

      <div className="fc-form-group">
        <label>Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter task title"
          required
        />
      </div>

      <div className="fc-form-group">
        <label>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter task description"
          rows={3}
        />
      </div>

      <div className="fc-form-group">
        <label>Subject *</label>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
          <option value="">Select a subject</option>
          {subjects.map(s => (
            <option key={s._id} value={s._id}>{s.code} - {s.name}</option>
          ))}
        </select>
      </div>

      <div className="fc-form-group fc-checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={allowRepeatedStudents}
            onChange={(e) => setAllowRepeatedStudents(e.target.checked)}
          />
          <span>Allow students to be called multiple times</span>
        </label>
      </div>

      <div className="fc-questions-section">
        <div className="fc-questions-header">
          <h3>Questions</h3>
          <button type="button" className="fc-btn fc-btn-add" onClick={addQuestion}>
            <i className="fas fa-plus"></i> Add Question
          </button>
        </div>

        {questions.map((question, qIdx) => (
          <div key={qIdx} className="fc-question-card">
            <div className="fc-question-header">
              <h4>Question {qIdx + 1}</h4>
              <button
                type="button"
                className="fc-btn fc-btn-danger-small"
                onClick={() => removeQuestion(qIdx)}
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>

            <div className="fc-form-group">
              <label>Question Type</label>
              <select
                value={question.type}
                onChange={(e) => updateQuestionType(qIdx, e.target.value as 'multiple_choice' | 'text_input')}
              >
                <option value="multiple_choice">Multiple Choice</option>
                <option value="text_input">Text Input</option>
              </select>
            </div>

            <div className="fc-form-group">
              <label>Question Text *</label>
              <textarea
                value={question.text}
                onChange={(e) => updateQuestion(qIdx, 'text', e.target.value)}
                placeholder="Enter question text"
                rows={2}
                required
              />
            </div>

            {question.type === 'multiple_choice' ? (
              <div className="fc-options-section">
                <label>Options *</label>
                {question.options?.map((option, oIdx) => (
                  <div key={oIdx} className="fc-option-item">
                    <input
                      type="radio"
                      name={`question-${qIdx}-correct`}
                      checked={option.isCorrect}
                      onChange={() => updateOption(qIdx, oIdx, 'isCorrect', true)}
                      title="Mark as correct answer"
                    />
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => updateOption(qIdx, oIdx, 'text', e.target.value)}
                      placeholder={`Option ${oIdx + 1}`}
                      required
                    />
                    {question.options && question.options.length > 2 && (
                      <button
                        type="button"
                        className="fc-btn-remove-option"
                        onClick={() => removeOption(qIdx, oIdx)}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    )}
                  </div>
                ))}
                {question.options && question.options.length < 4 && (
                  <button
                    type="button"
                    className="fc-btn fc-btn-secondary-small"
                    onClick={() => addOption(qIdx)}
                  >
                    Add Option
                  </button>
                )}
              </div>
            ) : (
              <div className="fc-form-group">
                <label>Accepted Answers * (comma-separated)</label>
                <input
                  type="text"
                  value={question.acceptedAnswers || ''}
                  onChange={(e) => updateQuestion(qIdx, 'acceptedAnswers', e.target.value)}
                  placeholder="e.g., answer1, answer2, answer3"
                  required
                />
                <small>Separate multiple accepted answers with commas</small>
              </div>
            )}

            <div className="fc-question-settings">
              <div className="fc-form-group">
                <label>Points *</label>
                <input
                  type="number"
                  value={question.points}
                  onChange={(e) => updateQuestion(qIdx, 'points', parseInt(e.target.value) || 1)}
                  min="1"
                  required
                />
              </div>

              <div className="fc-form-group fc-checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={question.hasTimer}
                    onChange={(e) => updateQuestion(qIdx, 'hasTimer', e.target.checked)}
                  />
                  <span>Enable Timer</span>
                </label>
              </div>

              {question.hasTimer && (
                <div className="fc-form-group">
                  <label>Time Limit (seconds)</label>
                  <input
                    type="number"
                    value={question.timeLimitSec}
                    onChange={(e) => updateQuestion(qIdx, 'timeLimitSec', parseInt(e.target.value) || 30)}
                    min="5"
                    required
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        {questions.length === 0 && (
          <div className="fc-empty-questions">
            <p>No questions added yet. Click "Add Question" to get started.</p>
          </div>
        )}
      </div>

      <div className="fc-form-actions">
        <button type="button" className="fc-btn fc-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="fc-btn fc-btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Task'}
        </button>
      </div>
    </form>
  );
};

export default FlashcardForm;

