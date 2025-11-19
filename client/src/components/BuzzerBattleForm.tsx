import React, { useState, useEffect } from 'react';

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

interface Subject {
  _id: string;
  code: string;
  name: string;
}

interface BuzzerBattleFormProps {
  subjects: Subject[];
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

const defaultSettings: Settings = {
  revealSpeed: 1000,
  allowPartialBuzz: true,
  earlyBuzzBonus: 10,
  wrongAnswerPenalty: -10,
  stealEnabled: true,
  maxSteals: 5,
  answerTimeLimit: 30,
  streakMultiplier: 1.5,
  freezePenalty: false
};

const BuzzerBattleForm: React.FC<BuzzerBattleFormProps> = ({ subjects, initialData, onSubmit, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setSubjectId(initialData.subjectId?._id || initialData.subjectId || '');
      setQuestions(initialData.questions || []);
      setSettings({ ...defaultSettings, ...initialData.settings });
    }
  }, [initialData]);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        text: '',
        type: 'text_input',
        acceptedAnswers: '',
        points: 100,
        category: '',
        difficulty: 'medium'
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

  const updateQuestionType = (index: number, type: 'text_input' | 'multiple_choice') => {
    const updated = [...questions];
    if (type === 'multiple_choice') {
      updated[index] = {
        ...updated[index],
        type,
        options: [
          { text: '' },
          { text: '' },
          { text: '' },
          { text: '' }
        ]
      };
    } else {
      updated[index] = {
        ...updated[index],
        type,
        options: undefined
      };
    }
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questions];
    const question = updated[qIndex];
    if (question.options) {
      question.options[oIndex].text = value;
    }
    setQuestions(updated);
  };

  const addOption = (qIndex: number) => {
    const updated = [...questions];
    const question = updated[qIndex];
    if (question.options && question.options.length < 6) {
      question.options.push({ text: '' });
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

  const updateSettings = (field: keyof Settings, value: any) => {
    setSettings({ ...settings, [field]: value });
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
        
        if (q.type === 'text_input') {
          if (!q.acceptedAnswers.trim()) {
            throw new Error(`Question ${i + 1} must have at least one accepted answer`);
          }
        } else if (q.type === 'multiple_choice') {
          if (!q.options || q.options.length < 2) {
            throw new Error(`Question ${i + 1} must have at least 2 options`);
          }
          const filledOptions = q.options.filter(o => o.text.trim());
          if (filledOptions.length < 2) {
            throw new Error(`Question ${i + 1} must have at least 2 filled options`);
          }
          if (!q.acceptedAnswers.trim()) {
            throw new Error(`Question ${i + 1} must specify correct answer(s)`);
          }
        }

        if (q.points <= 0) throw new Error(`Question ${i + 1} must have positive points`);
      }

      const payload = {
        title,
        description,
        subjectId,
        questions,
        settings,
        status: initialData?.status || 'draft'
      };

      await onSubmit(payload);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="bb-form" onSubmit={handleSubmit}>
      {error && <div className="bb-form-error">{error}</div>}

      {/* Basic Information */}
      <div className="bb-form-section">
        <h4>Basic Information</h4>
        
        <div className="bb-form-group">
          <label>Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter task title"
            required
          />
        </div>

        <div className="bb-form-group">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={3}
          />
        </div>

        <div className="bb-form-group">
          <label>Subject *</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            required
          >
            <option value="">Select a subject</option>
            {subjects.map(subject => (
              <option key={subject._id} value={subject._id}>
                {subject.code} - {subject.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Game Settings */}
      <div className="bb-form-section">
        <h4 onClick={() => setShowAdvancedSettings(!showAdvancedSettings)} style={{ cursor: 'pointer' }}>
          Game Settings {showAdvancedSettings ? '▼' : '▶'}
        </h4>
        
        {showAdvancedSettings && (
          <div className="bb-settings-grid">
            <div className="bb-form-group">
              <label>Reveal Speed (ms/word)</label>
              <input
                type="number"
                value={settings.revealSpeed}
                onChange={(e) => updateSettings('revealSpeed', parseInt(e.target.value))}
                min={50}
                max={1000}
              />
              <small>Time between each word reveal</small>
            </div>

            <div className="bb-form-group">
              <label>Answer Time Limit (sec)</label>
              <input
                type="number"
                value={settings.answerTimeLimit}
                onChange={(e) => updateSettings('answerTimeLimit', parseInt(e.target.value))}
                min={5}
                max={60}
              />
            </div>

            <div className="bb-form-group">
              <label>Early Buzz Bonus</label>
              <input
                type="number"
                value={settings.earlyBuzzBonus}
                onChange={(e) => updateSettings('earlyBuzzBonus', parseInt(e.target.value))}
                min={0}
                max={100}
              />
            </div>

            <div className="bb-form-group">
              <label>Wrong Answer Penalty</label>
              <input
                type="number"
                value={settings.wrongAnswerPenalty}
                onChange={(e) => updateSettings('wrongAnswerPenalty', parseInt(e.target.value))}
                max={0}
              />
            </div>

            <div className="bb-form-group">
              <label>Max Steals</label>
              <input
                type="number"
                value={settings.maxSteals}
                onChange={(e) => updateSettings('maxSteals', parseInt(e.target.value))}
                min={0}
                max={5}
                disabled={!settings.stealEnabled}
              />
            </div>

            <div className="bb-form-group">
              <label>Streak Multiplier</label>
              <input
                type="number"
                step="0.1"
                value={settings.streakMultiplier}
                onChange={(e) => updateSettings('streakMultiplier', parseFloat(e.target.value))}
                min={1}
                max={3}
              />
            </div>

            <div className="bb-form-group bb-checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.allowPartialBuzz}
                  onChange={(e) => updateSettings('allowPartialBuzz', e.target.checked)}
                />
                Allow Partial Buzz (buzz before full question)
              </label>
            </div>

            <div className="bb-form-group bb-checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.stealEnabled}
                  onChange={(e) => updateSettings('stealEnabled', e.target.checked)}
                />
                Enable Steals
              </label>
            </div>

            {/* Freeze penalty removed */}
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="bb-form-section">
        <div className="bb-section-header">
          <h4>Questions ({questions.length})</h4>
          <button type="button" className="bb-btn-add-question" onClick={addQuestion}>
            <i className="fas fa-plus"></i> Add Question
          </button>
        </div>

        {questions.length === 0 && (
          <div className="bb-empty-state">
            <p>No questions added yet. Click "Add Question" to get started.</p>
          </div>
        )}

        {questions.map((question, qIndex) => (
          <div key={qIndex} className="bb-question-card">
            <div className="bb-question-header">
              <span className="bb-question-number">Q{qIndex + 1}</span>
              <button
                type="button"
                className="bb-btn-remove-question"
                onClick={() => removeQuestion(qIndex)}
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>

            <div className="bb-question-body">
              <div className="bb-form-group">
                <label>Question Text *</label>
                <textarea
                  value={question.text}
                  onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                  placeholder="Enter your question"
                  rows={3}
                  required
                />
              </div>

              <div className="bb-form-row">
                <div className="bb-form-group">
                  <label>Type</label>
                  <select
                    value={question.type}
                    onChange={(e) => updateQuestionType(qIndex, e.target.value as 'text_input' | 'multiple_choice')}
                  >
                    <option value="text_input">Text Input</option>
                    <option value="multiple_choice">Multiple Choice</option>
                  </select>
                </div>

                <div className="bb-form-group">
                  <label>Points</label>
                  <input
                    type="number"
                    value={question.points}
                    onChange={(e) => updateQuestion(qIndex, 'points', parseInt(e.target.value))}
                    min={1}
                    required
                  />
                </div>

                <div className="bb-form-group">
                  <label>Difficulty</label>
                  <select
                    value={question.difficulty}
                    onChange={(e) => updateQuestion(qIndex, 'difficulty', e.target.value)}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="bb-form-group">
                <label>Category (optional)</label>
                <input
                  type="text"
                  value={question.category || ''}
                  onChange={(e) => updateQuestion(qIndex, 'category', e.target.value)}
                  placeholder="e.g., Science, History, Math"
                />
              </div>

              {question.type === 'multiple_choice' && (
                <div className="bb-form-group">
                  <label>Options</label>
                  {question.options?.map((option, oIndex) => (
                    <div key={oIndex} className="bb-option-row">
                      <input
                        type="text"
                        value={option.text}
                        onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                        placeholder={`Option ${oIndex + 1}`}
                      />
                      {question.options && question.options.length > 2 && (
                        <button
                          type="button"
                          className="bb-btn-remove-option"
                          onClick={() => removeOption(qIndex, oIndex)}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      )}
                    </div>
                  ))}
                  {question.options && question.options.length < 6 && (
                    <button
                      type="button"
                      className="bb-btn-add-option"
                      onClick={() => addOption(qIndex)}
                    >
                      <i className="fas fa-plus"></i> Add Option
                    </button>
                  )}
                </div>
              )}

              <div className="bb-form-group">
                <label>Accepted Answers * (comma-separated)</label>
                <input
                  type="text"
                  value={question.acceptedAnswers}
                  onChange={(e) => updateQuestion(qIndex, 'acceptedAnswers', e.target.value)}
                  placeholder="answer1, answer2, answer3"
                  required
                />
                <small>Enter all acceptable answers separated by commas (case-insensitive)</small>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form Actions */}
      <div className="bb-form-actions">
        <button type="button" className="bb-btn-cancel" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button type="submit" className="bb-btn-submit" disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update Task' : 'Create Task'}
        </button>
      </div>
    </form>
  );
};

export default BuzzerBattleForm;

