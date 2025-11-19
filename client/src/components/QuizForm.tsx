import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/quiz_management.css';

interface Option {
  text: string;
  isCorrect: boolean;
}

interface Question {
  text: string;
  questionType?: 'single' | 'true_false';
  options: Option[];
  points: number;
  timeLimit: number;
}

interface QuizSettings {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showFeedbackAfterEach: boolean;
  timeLimit: number;
  passingScore: number;
  allowRetake: boolean;
  maxAttempts: number;
}

interface QuizFormProps {
  quizId?: string;
  onSubmit: (quizData: any) => Promise<void>;
  initialData?: any;
}

const defaultSettings: QuizSettings = {
  shuffleQuestions: true,
  shuffleOptions: true,
  showFeedbackAfterEach: false,
  timeLimit: 0,
  passingScore: 60,
  allowRetake: false,
  maxAttempts: 1
};

const QuizForm: React.FC<QuizFormProps> = ({ quizId, onSubmit, initialData }) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<QuizSettings>(defaultSettings);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load subjects
    const fetchSubjects = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const response = await fetch(`http://localhost:5000/api/subjects?teacherId=${user._id}`);
        const data = await response.json();
        setSubjects(data);
      } catch (err) {
        console.error('Failed to fetch subjects:', err);
      }
    };

    fetchSubjects();

    // Load quiz data if editing
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setSubject(initialData.subjectId);
      setQuestions(initialData.questions || []);
      setSettings(initialData.settings || defaultSettings);
    }
  }, [initialData]);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        text: '',
        questionType: 'single',
        options: [
          { text: '', isCorrect: false },
          { text: '', isCorrect: false }
        ],
        points: 1,
        timeLimit: 30
      }
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    setQuestions((prevQuestions) => {
      const updatedQuestions = [...prevQuestions];
      updatedQuestions[index] = {
        ...updatedQuestions[index],
        [field]: value
      };
      return updatedQuestions;
    });
  };

  const addOption = (questionIndex: number) => {
    setQuestions((prev) => {
      const updatedQuestions = [...prev];
      const target = { ...updatedQuestions[questionIndex] };
      // Cap options to maximum of 4 for non-true/false questions
      if ((target.questionType || 'single') !== 'true_false' && target.options.length >= 4) {
        return updatedQuestions;
      }
      target.options = [...target.options, { text: '', isCorrect: false }];
      updatedQuestions[questionIndex] = target;
      return updatedQuestions;
    });
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    setQuestions((prev) => {
      const updatedQuestions = [...prev];
      const target = { ...updatedQuestions[questionIndex] };
      target.options = target.options.filter((_, i) => i !== optionIndex);
      updatedQuestions[questionIndex] = target;
      return updatedQuestions;
    });
  };

  const updateOption = (
    questionIndex: number,
    optionIndex: number,
    field: keyof Option,
    value: string | boolean
  ) => {
    setQuestions((prev) => {
      const updatedQuestions = [...prev];
      const target = { ...updatedQuestions[questionIndex] };
      const type = target.questionType || 'single';
      const nextOptions = [...target.options];
      if (field === 'isCorrect' && typeof value === 'boolean' && value === true && (type === 'single' || type === 'true_false')) {
        for (let i = 0; i < nextOptions.length; i++) {
          nextOptions[i] = { ...nextOptions[i], isCorrect: i === optionIndex };
        }
      } else {
        nextOptions[optionIndex] = { ...nextOptions[optionIndex], [field]: value } as Option;
      }
      target.options = nextOptions;
      updatedQuestions[questionIndex] = target;
      return updatedQuestions;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate questions
      if (questions.length === 0) {
        throw new Error('Add at least one question');
      }

      for (const [i, q] of questions.entries()) {
        if (!q.text.trim()) {
          throw new Error(`Question ${i + 1} is empty`);
        }
        const type = q.questionType || 'single';
        if (type === 'true_false') {
          if (q.options.length !== 2) {
            throw new Error(`Question ${i + 1} (True/False) must have exactly 2 options`);
          }
        } else if (q.options.length < 2 || q.options.length > 4) {
          throw new Error(`Question ${i + 1} needs 2 to 4 options`);
        }
        // Exactly one correct answer for both types
        const correctCount = q.options.filter(o => o.isCorrect).length;
        if (correctCount !== 1) {
          throw new Error(`Question ${i + 1} must have exactly one correct answer`);
        }
        // For true/false, option texts are fixed; skip empty text validation
        if (type !== 'true_false') {
          if (q.options.some(o => !o.text.trim())) {
            throw new Error(`Question ${i + 1} has empty options`);
          }
        }
      }

      // Normalize True/False option labels to ensure consistency
      const normalizedQuestions = questions.map((q) => {
        const type = q.questionType || 'single';
        if (type !== 'true_false') return q;
        const isTrueCorrect = q.options[0]?.isCorrect === true;
        return {
          ...q,
          options: [
            { text: 'True', isCorrect: isTrueCorrect },
            { text: 'False', isCorrect: !isTrueCorrect }
          ]
        };
      });

      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const quizData = {
        title,
        description,
        subjectId: subject,
        teacherId: user._id,
        questions: normalizedQuestions,
        settings,
        status: 'draft'
      };

      await onSubmit(quizData);
      navigate('/teacher/quiz');
    } catch (err: any) {
      setError(err.message || 'Failed to save quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="quiz-form" onSubmit={handleSubmit}>
      {error && <div className="error-message">{error}</div>}
      
      <div className="form-group">
        <label>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter quiz title"
          required
        />
      </div>

      <div className="form-group">
        <label>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter quiz description"
        />
      </div>

      <div className="form-group">
        <label>Subject</label>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        >
          <option value="">Select a subject</option>
          {subjects.map((s) => (
            <option key={s._id} value={s._id}>
              {s.code} - {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="settings-group">
        <div className="settings-item">
          <input
            type="checkbox"
            id="shuffleQuestions"
            checked={settings.shuffleQuestions}
            onChange={(e) => setSettings({ ...settings, shuffleQuestions: e.target.checked })}
          />
          <label htmlFor="shuffleQuestions">Shuffle Questions</label>
        </div>
        <div className="settings-item">
          <input
            type="checkbox"
            id="shuffleOptions"
            checked={settings.shuffleOptions}
            onChange={(e) => setSettings({ ...settings, shuffleOptions: e.target.checked })}
          />
          <label htmlFor="shuffleOptions">Shuffle Options</label>
        </div>
        <div className="settings-item">
          <input
            type="checkbox"
            id="showFeedback"
            checked={settings.showFeedbackAfterEach}
            onChange={(e) => setSettings({ ...settings, showFeedbackAfterEach: e.target.checked })}
          />
          <label htmlFor="showFeedback">Show Feedback</label>
        </div>
        <div className="settings-item">
          <input
            type="checkbox"
            id="allowRetake"
            checked={settings.allowRetake}
            onChange={(e) => setSettings({ ...settings, allowRetake: e.target.checked })}
          />
          <label htmlFor="allowRetake">Allow Retake</label>
        </div>
      </div>

      <div className="questions-list">
        <h3>Questions</h3>
        {questions.map((question, qIndex) => (
          <div key={qIndex} className="question-item">
            <div className="question-header">
              <h4>Question {qIndex + 1}</h4>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => removeQuestion(qIndex)}
              >
                Remove
              </button>
            </div>

            <div className="form-group">
              <label>Question Type</label>
              <select
                value={question.questionType || 'single'}
                onChange={(e) => {
                  const nextType = e.target.value as 'single' | 'true_false';
                  setQuestions((prev) => {
                    const updated = [...prev];
                    const current = { ...updated[qIndex] };
                    current.questionType = nextType;
                    if (nextType === 'true_false') {
                      const isTrueInitiallyCorrect = current.options[0]?.isCorrect ?? true;
                      current.options = [
                        { text: 'True', isCorrect: isTrueInitiallyCorrect },
                        { text: 'False', isCorrect: !isTrueInitiallyCorrect }
                      ];
                    } else {
                      if (!current.options || current.options.length < 2) {
                        current.options = [
                          { text: '', isCorrect: true },
                          { text: '', isCorrect: false }
                        ];
                      } else {
                        let firstTrueSeen = false;
                        current.options = current.options.map((o) => {
                          if (o.isCorrect && !firstTrueSeen) {
                            firstTrueSeen = true;
                            return o;
                          }
                          return { ...o, isCorrect: false };
                        });
                        if (!firstTrueSeen) current.options[0] = { ...current.options[0], isCorrect: true };
                      }
                    }
                    updated[qIndex] = current;
                    return updated;
                  });
                }}
              >
                <option value="single">One correct Answer</option>
                <option value="true_false">True or False</option>
              </select>
            </div>

            <div className="form-group">
              <input
                type="text"
                value={question.text}
                onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                placeholder="Enter question text"
                required
              />
            </div>

            <div className="question-settings">
              <div className="form-group">
                <label>Points</label>
                <input
                  type="number"
                  min="1"
                  value={question.points}
                  onChange={(e) => updateQuestion(qIndex, 'points', parseInt(e.target.value))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Time Limit (seconds)</label>
                <input
                  type="number"
                  min="0"
                  value={question.timeLimit}
                  onChange={(e) => updateQuestion(qIndex, 'timeLimit', parseInt(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="options-list">
              {question.options.map((option, oIndex) => (
                <div key={oIndex} className="option-item">
                  {question.questionType === 'true_false' ? (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="radio"
                        name={`q-${qIndex}-correct`}
                        checked={option.isCorrect}
                        onChange={() => updateOption(qIndex, oIndex, 'isCorrect', true)}
                        aria-label={oIndex === 0 ? 'True' : 'False'}
                        title={oIndex === 0 ? 'True' : 'False'}
                      />
                      <span style={{ fontWeight: 600 }}>{oIndex === 0 ? 'True' : 'False'}</span>
                    </label>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={option.text}
                        onChange={(e) => updateOption(qIndex, oIndex, 'text', e.target.value)}
                        placeholder={`Option ${oIndex + 1}`}
                        required
                      />
                      <input
                        type="checkbox"
                        checked={option.isCorrect}
                        onChange={(e) => updateOption(qIndex, oIndex, 'isCorrect', e.target.checked)}
                        title="Mark as correct answer"
                      />
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => removeOption(qIndex, oIndex)}
                        disabled={question.options.length <= 2}
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              ))}
              { (question.questionType !== 'true_false') && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => addOption(qIndex)}
                  disabled={question.options.length >= 4}
                >
                  Add Option
                </button>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-primary"
          onClick={addQuestion}
        >
          Add Question
        </button>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('/teacher/quiz')}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Quiz'}
        </button>
      </div>
    </form>
  );
};

export default QuizForm; 